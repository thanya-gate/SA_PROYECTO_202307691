#!/usr/bin/env node

/**
 * Prueba de integración HTTP contra el borde público de YoUSAC.
 *
 * La misma batería se puede ejecutar contra la VM (`CLOUD_*`) y, de forma
 * opcional, contra un entorno de referencia (`REFERENCE_*`). No requiere
 * dependencias npm: Node 20 aporta fetch, AbortController y randomUUID.
 *
 * Variables mínimas:
 *   CLOUD_BASE_URL       URL pública de la aplicación (dominio o IP)
 *   CLOUD_TEST_EMAIL     cuenta institucional de prueba
 *   CLOUD_TEST_PASSWORD  contraseña de la cuenta
 *
 * Variables opcionales:
 *   CLOUD_WEB_BASE_URL             URL pública del frontend; por defecto BASE
 *   CLOUD_API_BASE_URL             URL del gateway; por defecto BASE + /api
 *   CLOUD_CLASS_ID                 clase usada para los flujos integrados
 *   CLOUD_WRITE_TESTS              true para checkpoint, apuntes y foro
 *   CLOUD_FORUM_WRITE_TESTS        sobrescribe el valor anterior para el foro
 *   CLOUD_REQUIRE_SAMPLE_DATA      exige capítulos, materiales y dudas no vacíos
 *   CLOUD_REPORT_FILE              ruta para guardar el reporte JSON
 *   REFERENCE_BASE_URL             ejecuta la misma batería en el referente
 *   REFERENCE_*                    equivalentes por entorno cuando difieran
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_RETRIES = 1;
const HEALTH_SERVICES = [
  'authService',
  'catalogService',
  'reproductionService',
  'analiticaService',
  'inscripcionService',
  'notificacionesService',
];
const STUDENT_ROLES = new Set(['ROLE_ESTUDIANTE', 'ROLE_ADMIN', 'ROLE_AUXILIAR']);

function env(name) {
  const value = process.env[name];
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function booleanEnv(name, fallback = false) {
  const value = env(name).toLowerCase();
  if (!value) return fallback;
  return ['1', 'true', 'yes', 'si', 'sí'].includes(value);
}

function normalizeBase(label, value) {
  if (!value) throw new Error(`${label} es obligatorio`);
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${label} no es una URL válida: ${value}`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`${label} debe usar http o https`);
  }
  return parsed.toString().replace(/\/+$/, '');
}

function firstDefined(value, ...keys) {
  if (!value || typeof value !== 'object') return undefined;
  for (const key of keys) {
    if (value[key] !== undefined && value[key] !== null) return value[key];
  }
  return undefined;
}

function asArray(value, ...keys) {
  const candidate = firstDefined(value, ...keys);
  return Array.isArray(candidate) ? candidate : null;
}

function entityId(value, ...keys) {
  const id = firstDefined(value, ...keys);
  return typeof id === 'string' && id.trim() ? id.trim() : '';
}

function responseSnippet(response) {
  const body = response.text?.trim() || '<respuesta vacía>';
  return body.length > 500 ? `${body.slice(0, 500)}…` : body;
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function expectStatus(response, expected, operation) {
  if (response.status !== expected) {
    throw new Error(`${operation}: se esperaba HTTP ${expected}, se recibió ${response.status}. ${responseSnippet(response)}`);
  }
}

function expectJsonObject(response, operation) {
  assert(response.body && typeof response.body === 'object' && !Array.isArray(response.body), `${operation}: la respuesta no es un objeto JSON`);
  return response.body;
}

function expectArray(body, keys, operation) {
  const values = asArray(body, ...keys);
  assert(values, `${operation}: la respuesta no contiene un arreglo ${keys.join(' / ')}`);
  return values;
}

function isServing(value) {
  return ['SERVING', 'OK'].includes(String(value ?? '').toUpperCase());
}

function targetFromEnv(prefix, required) {
  const rawBase = env(`${prefix}_BASE_URL`);
  if (!rawBase && !required) return null;
  const base = normalizeBase(`${prefix}_BASE_URL`, rawBase);
  const webBase = normalizeBase(
    `${prefix}_WEB_BASE_URL`,
    env(`${prefix}_WEB_BASE_URL`) || base,
  );
  const apiBase = normalizeBase(
    `${prefix}_API_BASE_URL`,
    env(`${prefix}_API_BASE_URL`) || `${base}/api`,
  );
  const defaultWriteTests = booleanEnv('CLOUD_WRITE_TESTS', false);

  return {
    label: prefix.toLowerCase(),
    prefix,
    base,
    webBase,
    apiBase,
    email: env(`${prefix}_TEST_EMAIL`) || env('CLOUD_TEST_EMAIL'),
    password: env(`${prefix}_TEST_PASSWORD`) || env('CLOUD_TEST_PASSWORD'),
    classId: env(`${prefix}_CLASS_ID`) || env('CLOUD_CLASS_ID'),
    writeTests: booleanEnv(`${prefix}_WRITE_TESTS`, defaultWriteTests),
    forumWriteTests: booleanEnv(`${prefix}_FORUM_WRITE_TESTS`, defaultWriteTests),
    requireSampleData: booleanEnv(
      `${prefix}_REQUIRE_SAMPLE_DATA`,
      booleanEnv('CLOUD_REQUIRE_SAMPLE_DATA', false),
    ),
    timeoutMs: Number(env('CLOUD_REQUEST_TIMEOUT_MS')) || DEFAULT_TIMEOUT_MS,
    retries: Number(env('CLOUD_REQUEST_RETRIES')) || DEFAULT_RETRIES,
    token: '',
    user: null,
    roles: [],
    class: null,
    results: [],
    ok: false,
    error: null,
  };
}

async function request(base, pathname, options = {}, target) {
  const headers = {
    Accept: 'application/json',
    ...(options.headers ?? {}),
  };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  let requestBody = options.body;
  if (requestBody !== undefined && requestBody !== null && typeof requestBody !== 'string') {
    headers['Content-Type'] = 'application/json';
    requestBody = JSON.stringify(requestBody);
  }

  let lastError = null;
  const retries = target?.retries ?? DEFAULT_RETRIES;
  const timeoutMs = target?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${base}${pathname}`, {
        method: options.method ?? 'GET',
        headers,
        body: requestBody,
        signal: controller.signal,
        redirect: 'manual',
      });
      const text = await response.text();
      let body = null;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        // Algunas rutas, como exportar el cuaderno, devuelven texto Markdown.
      }
      if (response.status >= 500 && attempt < retries) continue;
      return { status: response.status, headers: response.headers, text, body };
    } catch (error) {
      lastError = error;
      if (attempt >= retries) break;
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error(`${options.method ?? 'GET'} ${pathname}: ${errorMessage(lastError)}`);
}

async function check(target, name, operation) {
  const started = Date.now();
  try {
    const result = await operation();
    target.results.push({
      name,
      status: 'passed',
      ok: true,
      durationMs: Date.now() - started,
    });
    console.log(`PASS [${target.label}] ${name}`);
    return result;
  } catch (error) {
    const message = errorMessage(error);
    target.results.push({
      name,
      status: 'failed',
      ok: false,
      durationMs: Date.now() - started,
      error: message,
    });
    console.error(`FAIL [${target.label}] ${name}: ${message}`);
    throw error;
  }
}

function skip(target, name, reason) {
  target.results.push({ name, status: 'skipped', ok: true, reason });
  console.log(`SKIP [${target.label}] ${name}: ${reason}`);
}

async function runTarget(target) {
  assert(target.email && target.password, `${target.prefix}_TEST_EMAIL y ${target.prefix}_TEST_PASSWORD son obligatorios para probar autenticación`);

  await check(target, 'frontend público /healthz', async () => {
    const response = await request(target.webBase, '/healthz', {}, target);
    expectStatus(response, 200, 'GET /healthz');
  });

  const health = await check(target, 'gateway /health y dependencias gRPC', async () => {
    const response = await request(target.apiBase, '/health', {}, target);
    expectStatus(response, 200, 'GET /health');
    const body = expectJsonObject(response, 'GET /health');
    assert(String(body.status).toLowerCase() === 'ok', 'GET /health: el gateway no reporta status ok');
    for (const service of HEALTH_SERVICES) {
      assert(isServing(body[service]), `GET /health: ${service} reporta ${body[service] ?? 'ausente'}`);
    }
    return body;
  });

  const login = await check(target, 'auth login institucional', async () => {
    const response = await request(target.apiBase, '/auth/login', {
      method: 'POST',
      body: { email: target.email, password: target.password },
    }, target);
    expectStatus(response, 200, 'POST /auth/login');
    const body = expectJsonObject(response, 'POST /auth/login');
    const token = firstDefined(body, 'accessToken', 'access_token');
    assert(typeof token === 'string' && token.length > 20, 'POST /auth/login: no devolvió un access token');
    const user = firstDefined(body, 'user');
    assert(user && typeof user === 'object', 'POST /auth/login: no devolvió el usuario');
    target.token = token;
    target.user = user;
    const roles = firstDefined(user, 'roles');
    target.roles = Array.isArray(roles) ? roles.map((role) => String(role).toUpperCase()) : [];
    return body;
  });

  await check(target, 'auth sesión /auth/me', async () => {
    const response = await request(target.apiBase, '/auth/me', { token: target.token }, target);
    expectStatus(response, 200, 'GET /auth/me');
    const body = expectJsonObject(response, 'GET /auth/me');
    const user = firstDefined(body, 'user');
    assert(user && String(firstDefined(user, 'email')).toLowerCase() === target.email.toLowerCase(), 'GET /auth/me: usuario distinto al autenticado');
  });

  await check(target, 'auth perfiles /profiles/me', async () => {
    const response = await request(target.apiBase, '/profiles/me', { token: target.token }, target);
    expectStatus(response, 200, 'GET /profiles/me');
    const body = expectJsonObject(response, 'GET /profiles/me');
    assert(Array.isArray(firstDefined(body, 'roles', 'profiles')), 'GET /profiles/me: no devolvió roles/perfiles');
  });

  const catalog = await check(target, 'catálogo listar clases', async () => {
    const response = await request(target.apiBase, '/catalog/classes?page=1&pageSize=10', { token: target.token }, target);
    expectStatus(response, 200, 'GET /catalog/classes');
    const body = expectJsonObject(response, 'GET /catalog/classes');
    const classes = expectArray(body, ['resultados', 'results'], 'GET /catalog/classes');
    assert(classes.length > 0, `GET /catalog/classes: no hay clases disponibles; carga datos o define ${target.prefix}_CLASS_ID`);
    const selected = target.classId
      ? classes.find((item) => entityId(item, 'claseId', 'clase_id', 'id') === target.classId)
      : classes[0];
    if (target.classId) {
      assert(selected, `${target.prefix}_CLASS_ID=${target.classId} no apareció en el catálogo`);
    }
    target.classId = target.classId || entityId(selected, 'claseId', 'clase_id', 'id');
    assert(target.classId, 'GET /catalog/classes: la clase no contiene identificador');
    return { body, classes };
  });

  const detail = await check(target, 'catálogo detalle de clase', async () => {
    const response = await request(target.apiBase, `/catalog/classes/${encodeURIComponent(target.classId)}`, { token: target.token }, target);
    expectStatus(response, 200, 'GET /catalog/classes/:claseId');
    const body = expectJsonObject(response, 'GET /catalog/classes/:claseId');
    const clase = firstDefined(body, 'clase');
    assert(clase && typeof clase === 'object', 'GET /catalog/classes/:claseId: no devolvió clase');
    const returnedId = entityId(clase, 'claseId', 'clase_id', 'id');
    assert(!returnedId || returnedId === target.classId, 'GET /catalog/classes/:claseId: identificador inconsistente');
    assert(Number(firstDefined(clase, 'duracion', 'duration') ?? 0) >= 0, 'La duración de la clase no es válida');
    target.class = clase;
    return clase;
  });

  const chapters = await check(target, 'capítulos listar y validar intervalos', async () => {
    const response = await request(target.apiBase, `/catalog/classes/${encodeURIComponent(target.classId)}/chapters`, { token: target.token }, target);
    expectStatus(response, 200, 'GET /catalog/classes/:claseId/chapters');
    const body = expectJsonObject(response, 'GET /catalog/classes/:claseId/chapters');
    const values = expectArray(body, ['capitulos', 'chapters'], 'GET /catalog/classes/:claseId/chapters');
    for (const chapter of values) {
      const start = Number(firstDefined(chapter, 'inicioSegundos', 'inicio_segundos'));
      const end = Number(firstDefined(chapter, 'finSegundos', 'fin_segundos'));
      assert(Number.isInteger(start) && start >= 0, 'Capítulo con inicio inválido');
      assert(Number.isInteger(end) && end > start, 'Capítulo con fin inválido o intervalo vacío');
      assert(entityId(chapter, 'capituloId', 'capitulo_id', 'id'), 'Capítulo sin identificador');
    }
    if (target.requireSampleData) assert(values.length > 0, 'No hay capítulos de muestra en la clase seleccionada');
    return values;
  });

  const materials = await check(target, 'materiales listar y validar contrato', async () => {
    const response = await request(target.apiBase, `/catalog/classes/${encodeURIComponent(target.classId)}/materials`, { token: target.token }, target);
    expectStatus(response, 200, 'GET /catalog/classes/:claseId/materials');
    const body = expectJsonObject(response, 'GET /catalog/classes/:claseId/materials');
    const values = expectArray(body, ['materiales', 'materials'], 'GET /catalog/classes/:claseId/materials');
    for (const material of values) {
      assert(entityId(material, 'materialId', 'material_id', 'id'), 'Material sin identificador');
      assert(Number(firstDefined(material, 'tamanoBytes', 'tamano_bytes') ?? 0) >= 0, 'Material con tamaño inválido');
    }
    if (target.requireSampleData) assert(values.length > 0, 'No hay materiales de muestra en la clase seleccionada');
    return values;
  });

  const forum = await check(target, 'foro de dudas listar y validar timestamps', async () => {
    const response = await request(target.apiBase, `/catalog/classes/${encodeURIComponent(target.classId)}/dudas`, { token: target.token }, target);
    expectStatus(response, 200, 'GET /catalog/classes/:claseId/dudas');
    const body = expectJsonObject(response, 'GET /catalog/classes/:claseId/dudas');
    const values = expectArray(body, ['dudas', 'questions'], 'GET /catalog/classes/:claseId/dudas');
    for (const question of values) {
      assert(entityId(question, 'dudaId', 'duda_id', 'id'), 'Duda sin identificador');
      assert(Number(firstDefined(question, 'posicionSegundos', 'posicion_segundos') ?? -1) >= 0, 'Duda con timestamp inválido');
      assert(Array.isArray(firstDefined(question, 'respuestas', 'answers') ?? []), 'Duda sin arreglo de respuestas');
    }
    // Cuando se habilitan las escrituras, el flujo de foro crea su propia
    // duda temporal después de esta lectura; no exigir una duda previa en ese
    // caso. Capítulos y materiales sí deben existir si se solicita la muestra.
    if (target.requireSampleData && !target.forumWriteTests) {
      assert(values.length > 0, 'No hay dudas de muestra en la clase seleccionada');
    }
    return values;
  });

  await check(target, 'notificaciones bandeja autenticada', async () => {
    const response = await request(target.apiBase, '/notificaciones/me', { token: target.token }, target);
    expectStatus(response, 200, 'GET /notificaciones/me');
    const body = expectJsonObject(response, 'GET /notificaciones/me');
    expectArray(body, ['items', 'notificaciones'], 'GET /notificaciones/me');
  });

  await check(target, 'analítica consulta integrada', async () => {
    const response = await request(target.apiBase, '/analitica/clases-mas-vistas?limite=5', { token: target.token }, target);
    expectStatus(response, 200, 'GET /analitica/clases-mas-vistas');
    const body = expectJsonObject(response, 'GET /analitica/clases-mas-vistas');
    expectArray(body, ['items'], 'GET /analitica/clases-mas-vistas');
  });

  if (target.roles.some((role) => STUDENT_ROLES.has(role))) {
    await check(target, 'inscripción panel del estudiante', async () => {
      const response = await request(target.apiBase, '/inscripcion/panel/me', { token: target.token }, target);
      expectStatus(response, 200, 'GET /inscripcion/panel/me');
      const body = expectJsonObject(response, 'GET /inscripcion/panel/me');
      expectArray(body, ['items'], 'GET /inscripcion/panel/me');
    });
  } else if (target.roles.includes('ROLE_CATEDRATICO')) {
    await check(target, 'inscripción cursos del catedrático', async () => {
      const response = await request(target.apiBase, '/inscripcion/cursos-catedratico', { token: target.token }, target);
      expectStatus(response, 200, 'GET /inscripcion/cursos-catedratico');
      const body = expectJsonObject(response, 'GET /inscripcion/cursos-catedratico');
      expectArray(body, ['items'], 'GET /inscripcion/cursos-catedratico');
    });
  } else {
    skip(target, 'inscripción panel/cursos', 'la cuenta no tiene un rol compatible con la consulta');
  }

  const notes = await check(target, 'apuntes listar por clase', async () => {
    const response = await request(target.apiBase, `/reproduccion/apuntes?claseId=${encodeURIComponent(target.classId)}`, { token: target.token }, target);
    expectStatus(response, 200, 'GET /reproduccion/apuntes');
    const body = expectJsonObject(response, 'GET /reproduccion/apuntes');
    return expectArray(body, ['apuntes', 'notes'], 'GET /reproduccion/apuntes');
  });

  await check(target, 'reproducción checkpoint de integración', async () => {
    const response = await request(target.apiBase, `/reproduccion/checkpoint/${encodeURIComponent(target.classId)}`, { token: target.token }, target);
    expectStatus(response, 200, 'GET /reproduccion/checkpoint/:claseId');
    const body = expectJsonObject(response, 'GET /reproduccion/checkpoint/:claseId');
    const checkpoint = Object.prototype.hasOwnProperty.call(body, 'checkpoint')
      ? body.checkpoint
      : undefined;
    assert(checkpoint === null || typeof checkpoint === 'object', 'Checkpoint con formato inválido');
  });

  await check(target, 'reproducción historial reciente', async () => {
    const response = await request(target.apiBase, '/reproduccion/historial', { token: target.token }, target);
    expectStatus(response, 200, 'GET /reproduccion/historial');
    const body = expectJsonObject(response, 'GET /reproduccion/historial');
    expectArray(body, ['items'], 'GET /reproduccion/historial');
  });

  if (notes.length > 0) {
    await check(target, 'apuntes exportar Markdown', async () => {
      const response = await request(target.apiBase, `/reproduccion/apuntes/${encodeURIComponent(target.classId)}/exportar`, { token: target.token }, target);
      expectStatus(response, 200, 'GET /reproduccion/apuntes/:claseId/exportar');
      assert(response.text.includes('#') || response.text.includes('['), 'La exportación no contiene Markdown');
      assert((response.headers.get('content-type') ?? '').includes('text/markdown'), 'La exportación no declara text/markdown');
    });
  } else {
    skip(target, 'apuntes exportar Markdown', 'no hay apuntes existentes; activa CLOUD_WRITE_TESTS para ejercitar crear/actualizar/exportar/eliminar');
  }

  if (target.writeTests) {
    assert(target.roles.some((role) => STUDENT_ROLES.has(role)), 'CLOUD_WRITE_TESTS requiere una cuenta con ROLE_ESTUDIANTE, ROLE_AUXILIAR o ROLE_ADMIN');
    await runWriteFlows(target, detail);
  } else {
    skip(target, 'flujos mutables checkpoint/apuntes/foro', 'CLOUD_WRITE_TESTS no está habilitado');
  }

  // Evita advertencias de variables no usadas al leerlas en el reporte y deja
  // el resultado de cada bloque explícito para quien revise la evidencia.
  void health;
  void login;
  void catalog;
  void chapters;
  void materials;
  void forum;
}

async function runWriteFlows(target, detail) {
  const configuredDuration = Number(
    env(`${target.prefix}_VIDEO_DURATION_SECONDS`) || env('CLOUD_VIDEO_DURATION_SECONDS'),
  );
  const detailDuration = Number(firstDefined(detail, 'duracion', 'duration') ?? 0);
  const duration = Number.isFinite(configuredDuration) && configuredDuration > 1
    ? Math.floor(configuredDuration)
    : detailDuration > 1
      ? Math.floor(detailDuration)
      : 60;
  const second = Math.max(0, Math.min(30, duration - 1));

  await check(target, 'reproducción guardar y consultar checkpoint', async () => {
    const save = await request(target.apiBase, '/reproduccion/checkpoint', {
      method: 'POST',
      token: target.token,
      body: {
        claseId: target.classId,
        segundoActual: second,
        duracion: duration,
        evento: 'integracion-cloud',
      },
    }, target);
    expectStatus(save, 200, 'POST /reproduccion/checkpoint');
    const saved = expectJsonObject(save, 'POST /reproduccion/checkpoint');
    assert(entityId(saved, 'historialId', 'historial_id'), 'El checkpoint no devolvió historialId');
    const current = await request(target.apiBase, `/reproduccion/checkpoint/${encodeURIComponent(target.classId)}`, { token: target.token }, target);
    expectStatus(current, 200, 'GET /reproduccion/checkpoint/:claseId después de guardar');
    const currentBody = expectJsonObject(current, 'GET /reproduccion/checkpoint/:claseId después de guardar');
    const checkpoint = Object.prototype.hasOwnProperty.call(currentBody, 'checkpoint')
      ? currentBody.checkpoint
      : undefined;
    assert(checkpoint && Number(firstDefined(checkpoint, 'segundoActual', 'segundo_actual')) === second, 'El checkpoint consultado no coincide con el guardado');
  });

  let apunteId = '';
  const marker = '[00:01]';
  const suffix = randomUUID().slice(0, 8);
  const title = `Integración cloud ${suffix}`;
  try {
    await check(target, 'apuntes crear', async () => {
      const response = await request(target.apiBase, '/reproduccion/apuntes', {
        method: 'POST',
        token: target.token,
        body: {
          claseId: target.classId,
          titulo: title,
          contenidoMarkdown: `${marker} Nota temporal de integración ${suffix}`,
          posicionSegundos: 1,
        },
      }, target);
      expectStatus(response, 201, 'POST /reproduccion/apuntes');
      const body = expectJsonObject(response, 'POST /reproduccion/apuntes');
      const note = firstDefined(body, 'apunte', 'note');
      apunteId = entityId(note, 'apunteId', 'apunte_id', 'id');
      assert(apunteId, 'POST /reproduccion/apuntes no devolvió apunteId');
    });

    await check(target, 'apuntes actualizar', async () => {
      const response = await request(target.apiBase, '/reproduccion/apuntes', {
        method: 'POST',
        token: target.token,
        body: {
          claseId: target.classId,
          apunteId,
          titulo: `${title} actualizado`,
          contenidoMarkdown: `${marker} Contenido actualizado ${suffix}`,
          posicionSegundos: 1,
        },
      }, target);
      expectStatus(response, 200, 'POST /reproduccion/apuntes (actualizar)');
      const body = expectJsonObject(response, 'POST /reproduccion/apuntes (actualizar)');
      const note = firstDefined(body, 'apunte', 'note');
      assert(entityId(note, 'apunteId', 'apunte_id', 'id') === apunteId, 'La actualización cambió el identificador del apunte');
    });

    await check(target, 'apuntes exportar contenido actualizado', async () => {
      const response = await request(target.apiBase, `/reproduccion/apuntes/${encodeURIComponent(target.classId)}/exportar`, { token: target.token }, target);
      expectStatus(response, 200, 'GET /reproduccion/apuntes/:claseId/exportar');
      assert(response.text.includes(suffix), 'La exportación no contiene el apunte recién actualizado');
      assert((response.headers.get('content-disposition') ?? '').includes('attachment'), 'La exportación no declara descarga de archivo');
    });
  } finally {
    if (apunteId) {
      await check(target, 'apuntes eliminar y limpiar', async () => {
        const response = await request(target.apiBase, `/reproduccion/apuntes/${encodeURIComponent(apunteId)}`, {
          method: 'DELETE',
          token: target.token,
        }, target);
        expectStatus(response, 200, 'DELETE /reproduccion/apuntes/:apunteId');
        const body = expectJsonObject(response, 'DELETE /reproduccion/apuntes/:apunteId');
        assert(firstDefined(body, 'eliminado', 'deleted') === true, 'El backend no confirmó la eliminación del apunte');
      });
    }
  }

  if (!target.forumWriteTests) {
    skip(target, 'foro crear/responder/verificar', 'CLOUD_FORUM_WRITE_TESTS no está habilitado');
    return;
  }

  let dudaId = '';
  await check(target, 'foro crear duda con timestamp', async () => {
    const suffix = randomUUID().slice(0, 8);
    const response = await request(target.apiBase, `/catalog/classes/${encodeURIComponent(target.classId)}/dudas`, {
      method: 'POST',
      token: target.token,
      body: {
        posicionSegundos: 1,
        pregunta: `Pregunta temporal de integración ${suffix}`,
      },
    }, target);
    expectStatus(response, 201, 'POST /catalog/classes/:claseId/dudas');
    const body = expectJsonObject(response, 'POST /catalog/classes/:claseId/dudas');
    dudaId = entityId(firstDefined(body, 'duda', 'question'), 'dudaId', 'duda_id', 'id');
    assert(dudaId, 'La duda creada no devolvió dudaId');
  });

  let respuestaId = '';
  await check(target, 'foro responder duda', async () => {
    const response = await request(target.apiBase, `/catalog/dudas/${encodeURIComponent(dudaId)}/respuestas`, {
      method: 'POST',
      token: target.token,
      body: { contenido: 'Respuesta temporal de integración.' },
    }, target);
    expectStatus(response, 201, 'POST /catalog/dudas/:dudaId/respuestas');
    const body = expectJsonObject(response, 'POST /catalog/dudas/:dudaId/respuestas');
    respuestaId = entityId(firstDefined(body, 'respuesta', 'answer'), 'respuestaId', 'respuesta_id', 'id');
    assert(respuestaId, 'La respuesta creada no devolvió respuestaId');
  });

  await check(target, 'foro verificar respuesta', async () => {
    const response = await request(target.apiBase, `/catalog/respuestas/${encodeURIComponent(respuestaId)}/verificar`, {
      method: 'POST',
      token: target.token,
    }, target);
    expectStatus(response, 200, 'POST /catalog/respuestas/:respuestaId/verificar');
    const body = expectJsonObject(response, 'POST /catalog/respuestas/:respuestaId/verificar');
    const duda = firstDefined(body, 'duda', 'question');
    assert(duda && firstDefined(duda, 'resuelta', 'resolved') === true, 'La duda no quedó resuelta al verificar la respuesta');
  });

  console.warn(`[${target.label}] El foro no tiene endpoint de borrado; la prueba dejó una duda temporal identificada por ${dudaId}.`);
}

function parityMismatches(cloud, reference) {
  const cloudChecks = new Map(cloud.results.map((result) => [result.name, result]));
  const referenceChecks = new Map(reference.results.map((result) => [result.name, result]));
  const names = new Set([...cloudChecks.keys(), ...referenceChecks.keys()]);
  const mismatches = [];
  for (const name of names) {
    const cloudResult = cloudChecks.get(name);
    const referenceResult = referenceChecks.get(name);
    if (!cloudResult || !referenceResult || cloudResult.ok !== referenceResult.ok) {
      mismatches.push({
        name,
        cloud: cloudResult?.status ?? 'missing',
        reference: referenceResult?.status ?? 'missing',
      });
    }
  }
  return mismatches;
}

async function writeReport(report) {
  const reportFile = env('CLOUD_REPORT_FILE');
  if (!reportFile) return;
  await mkdir(dirname(reportFile), { recursive: true });
  await writeFile(reportFile, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`Reporte generado: ${reportFile}`);
}

async function main() {
  const cloud = targetFromEnv('CLOUD', true);
  const reference = targetFromEnv('REFERENCE', false);
  const targets = [cloud, ...(reference ? [reference] : [])];

  for (const target of targets) {
    try {
      await runTarget(target);
      target.ok = !target.results.some((result) => !result.ok);
    } catch (error) {
      target.ok = false;
      target.error = errorMessage(error);
    }
  }

  let parity = null;
  if (reference) {
    const mismatches = parityMismatches(cloud, reference);
    parity = { ok: mismatches.length === 0, mismatches };
    if (parity.ok) {
      console.log('PASS [paridad] Cloud y referencia respondieron el mismo contrato funcional.');
    } else {
      console.error(`FAIL [paridad] ${mismatches.length} comprobación(es) difieren entre Cloud y referencia.`);
      for (const mismatch of mismatches) {
        console.error(`  - ${mismatch.name}: cloud=${mismatch.cloud}, referencia=${mismatch.reference}`);
      }
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    writeTests: cloud.writeTests,
    requireSampleData: cloud.requireSampleData,
    parity,
    targets: targets.map((target) => ({
      label: target.label,
      base: target.base,
      webBase: target.webBase,
      apiBase: target.apiBase,
      classId: target.classId,
      roles: target.roles,
      ok: target.ok,
      error: target.error,
      results: target.results,
    })),
  };
  await writeReport(report);

  const targetFailed = targets.some((target) => !target.ok);
  if (targetFailed || (parity && !parity.ok)) process.exitCode = 1;
}

main().catch(async (error) => {
  console.error(`ERROR cloud-parity: ${errorMessage(error)}`);
  process.exitCode = 1;
});
