# Federación de catálogos YoUSAC

Contrato para que dos instancias de YoUSAC compartan sus clases grabadas. Cada grupo hace dos cosas con **el mismo formato**:

1. **Exponer** su catálogo con las rutas de [`openapi/federacion.yaml`](../../Backend/api-gateway/openapi/federacion.yaml).
2. **Consumir** el catálogo del grupo aliado con esas mismas rutas.

- Swagger (para verlo y probarlo): `https://yousac-thany.duckdns.org/federation/docs`
- Contrato crudo (para agentes y generadores): `https://yousac-thany.duckdns.org/federation/v1/openapi.yaml`

## Rutas

| Método | Ruta | API key | Para qué |
|---|---|---|---|
| GET | `/federation/v1/salud` | No | Saber si el servicio está arriba (smoke tests) |
| GET | `/federation/v1/clases?q=&curso=&page=&pageSize=` | Sí | Buscar y listar clases |
| GET | `/federation/v1/clases/{id}` | Sí | Detalle con capítulos para reproducir |

Reglas comunes:
- Header `X-API-Key: <clave>`. Sin clave o con una clave inválida se responde `401`.
- Límite de **60 peticiones por minuto por clave**. Al pasarlo se responde `429`.
- Errores con el formato `{ "error": { "code": "...", "message": "..." } }`.
- Solo datos públicos de la clase. Nunca datos de estudiantes, foro ni usuarios.
- `videoUrl` se reproduce directamente: es un archivo público (`tipoVideo: "archivo"`) o un enlace de YouTube (`tipoVideo: "youtube"`).
- `capitulos` son los marcadores de tiempo, en segundos. En el listado pueden venir vacíos; el detalle los trae completos.
- `pageSize` máximo 20.

Ejemplo de clase:

```json
{
  "id": "3f2a9c1e-0b7d-4c5e-9a11-2d4e6f8a0b1c",
  "titulo": "Subredes VLSM",
  "curso": "Redes de Computadoras 1",
  "codigoCurso": "0770",
  "unidad": "Unidad 2",
  "semestre": "Segundo Semestre",
  "anio": 2026,
  "catedratico": "Ing. Pérez",
  "duracionSeg": 3600,
  "videoUrl": "https://storage.googleapis.com/yousac-videos/clases/3f2a.mp4",
  "tipoVideo": "archivo",
  "notasMd": "",
  "capitulos": [{ "titulo": "Introducción", "inicioSeg": 0, "finSeg": 420 }],
  "origen": { "grupo": "YoUSAC G4", "institucion": "Facultad de Ingeniería USAC" }
}
```

## Consumir nuestro catálogo

- URL base: `https://yousac-thany.duckdns.org/federation/v1`
- API key: pídanla al grupo G4 por un canal privado. **No la suban a su repositorio**: guárdenla en su `.env` o en un Secret.

```bash
curl https://yousac-thany.duckdns.org/federation/v1/salud
curl -H "X-API-Key: $YOUSAC_G4_KEY" "https://yousac-thany.duckdns.org/federation/v1/clases?q=redes&page=1"
curl -H "X-API-Key: $YOUSAC_G4_KEY" https://yousac-thany.duckdns.org/federation/v1/clases/<id>
```

## Exponer el suyo

Implementen las mismas tres rutas con el mismo JSON. Cuando estén listas, envíennos:
- su URL base (de preferencia un dominio, no una IP, para que no cambie si recrean la nube);
- una API key para nosotros.

Nosotros les entregamos la nuestra.

## Instrucciones para su agente

> Implementa el contrato OpenAPI de `https://yousac-thany.duckdns.org/federation/v1/openapi.yaml` en dos partes:
> 1. **Servidor**: expón `/federation/v1/salud`, `/federation/v1/clases` y `/federation/v1/clases/{id}` en nuestro API Gateway, leyendo de nuestro catálogo. Valida `X-API-Key` contra claves guardadas en variables de entorno, aplica un límite de 60 peticiones por minuto por clave y responde exactamente los esquemas del contrato (camelCase, errores `{error:{code,message}}`).
> 2. **Cliente**: crea un adaptador que consuma esas mismas rutas del grupo aliado (URL y key desde `.env`), con timeout de 3 s, validación del esquema y degradación a resultados vacíos si el aliado no responde. Úsalo en el buscador para mezclar clases locales y externas con una etiqueta de origen, y en el reproductor para las clases externas, usando `capitulos` como marcadores.
