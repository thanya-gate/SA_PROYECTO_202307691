import { useEffect, useState } from 'react';
import { catalogApi, type Capitulo } from '../api/catalog';
import { useAuth } from '../auth/auth-context';
import { formatSegundos, parseDuracionInput } from '../utils/video';
import { Alert } from './ui/Alert';
import { Button } from './ui/Button';

interface ChapterManagerProps {
  claseId: string;
  duracion: number;
  capitulos: Capitulo[];
  onChange: (capitulos: Capitulo[]) => void;
}

interface FormState {
  titulo: string;
  inicio: string;
  fin: string;
  orden: string;
}

function ordenarCapitulos(capitulos: Capitulo[]): Capitulo[] {
  return [...capitulos].sort((a, b) => a.orden - b.orden || a.inicioSegundos - b.inicioSegundos);
}

function formInicial(duracion: number): FormState {
  return {
    titulo: '',
    inicio: '0:00',
    fin: duracion > 0 ? formatSegundos(duracion) : '',
    // La base de datos asigna el siguiente orden disponible al crear.
    orden: '0',
  };
}

export function ChapterManager({ claseId, duracion, capitulos, onChange }: ChapterManagerProps) {
  const { token } = useAuth();
  const [form, setForm] = useState<FormState>(() => formInicial(duracion));
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  useEffect(() => {
    if (!editandoId) {
      setForm((prev) => ({ ...prev, fin: prev.fin || (duracion > 0 ? formatSegundos(duracion) : '') }));
    }
  }, [duracion, editandoId]);

  function actualizarCampo(campo: keyof FormState, valor: string) {
    setForm((prev) => ({ ...prev, [campo]: valor }));
  }

  function limpiarFormulario() {
    setEditandoId(null);
    setForm(formInicial(duracion));
    setError(null);
  }

  function editar(capitulo: Capitulo) {
    setEditandoId(capitulo.capituloId);
    setForm({
      titulo: capitulo.titulo,
      inicio: formatSegundos(capitulo.inicioSegundos),
      fin: formatSegundos(capitulo.finSegundos),
      orden: String(capitulo.orden),
    });
    setError(null);
    setMensaje(null);
  }

  async function guardar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    setError(null);
    setMensaje(null);
    const inicio = parseDuracionInput(form.inicio);
    const fin = parseDuracionInput(form.fin);
    const orden = Number(form.orden);

    if (duracion <= 0) {
      setError('Primero asigna una duración válida al video para poder segmentarlo.');
      return;
    }
    if (inicio === null || fin === null || !Number.isInteger(orden)) {
      setError('Usa tiempos válidos como 00:00 o 01:30 y un orden entero.');
      return;
    }
    if (inicio < 0 || fin <= inicio) {
      setError('El final debe ser mayor que el inicio del capítulo.');
      return;
    }
    if (fin > duracion) {
      setError(`El final no puede superar la duración del video (${formatSegundos(duracion)}).`);
      return;
    }

    setOcupado(true);
    try {
      if (editandoId) {
        const result = await catalogApi.actualizarCapitulo(
          editandoId,
          { claseId, titulo: form.titulo.trim(), inicioSegundos: inicio, finSegundos: fin, orden },
          token,
        );
        onChange(ordenarCapitulos(capitulos.map((item) => (item.capituloId === editandoId ? result.capitulo : item))));
        setMensaje('Capítulo actualizado.');
      } else {
        const result = await catalogApi.crearCapitulo(
          claseId,
          { titulo: form.titulo.trim(), inicioSegundos: inicio, finSegundos: fin, orden },
          token,
        );
        onChange(ordenarCapitulos([...capitulos, result.capitulo]));
        setMensaje('Capítulo creado.');
      }
      limpiarFormulario();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el capítulo.');
    } finally {
      setOcupado(false);
    }
  }

  async function eliminar(capitulo: Capitulo) {
    if (!token || !window.confirm(`¿Eliminar el capítulo "${capitulo.titulo}"?`)) return;
    setOcupado(true);
    setError(null);
    setMensaje(null);
    try {
      await catalogApi.eliminarCapitulo(capitulo.capituloId, token);
      onChange(capitulos.filter((item) => item.capituloId !== capitulo.capituloId));
      if (editandoId === capitulo.capituloId) limpiarFormulario();
      setMensaje('Capítulo eliminado.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el capítulo.');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section className="clase__segmentacion-admin" aria-label="Establecer capítulos">
      <div className="clase__segmentacion-cabecera">
        <div>
          <p className="clase__segmentacion-kicker">Segmentación de la grabación</p>
          <h2 className="clase__ficha-titulo">Establecer capítulos</h2>
        </div>
        <span className="clase__segmentacion-total">{capitulos.length} {capitulos.length === 1 ? 'capítulo' : 'capítulos'}</span>
      </div>

      <p className="clase__subida-desc">
        Agrega el nombre y el intervalo de cada tema para que los estudiantes puedan saltar directamente a esa parte de la grabación.
      </p>

      {duracion <= 0 && <Alert tone="info">La duración del video aún no está disponible.</Alert>}
      {error && <Alert tone="error">{error}</Alert>}
      {mensaje && <Alert tone="success">{mensaje}</Alert>}

      <form className="clase__segmentacion-form" onSubmit={(event) => void guardar(event)}>
        <label>
          <span>Nombre</span>
          <input
            type="text"
            value={form.titulo}
            onChange={(event) => actualizarCampo('titulo', event.target.value)}
            placeholder="Ej. Introducción"
            maxLength={200}
            required
            disabled={ocupado || duracion <= 0}
          />
        </label>
        <label>
          <span>Inicio</span>
          <input
            type="text"
            inputMode="numeric"
            value={form.inicio}
            onChange={(event) => actualizarCampo('inicio', event.target.value)}
            placeholder="00:00"
            required
            disabled={ocupado || duracion <= 0}
          />
        </label>
        <label>
          <span>Fin</span>
          <input
            type="text"
            inputMode="numeric"
            value={form.fin}
            onChange={(event) => actualizarCampo('fin', event.target.value)}
            placeholder="15:30"
            required
            disabled={ocupado || duracion <= 0}
          />
        </label>
        <input type="hidden" name="orden" value={form.orden} />
        <div className="clase__segmentacion-form-acciones">
          <Button type="submit" loading={ocupado} disabled={duracion <= 0}>
            {editandoId ? 'Guardar cambios' : 'Agregar más'}
          </Button>
          {editandoId && (
            <Button type="button" variant="secondary" onClick={() => limpiarFormulario()} disabled={ocupado}>
              Cancelar
            </Button>
          )}
        </div>
      </form>

      {capitulos.length === 0 ? (
        <p className="clase__estado">Aún no hay capítulos. El primero puede comenzar en 00:00.</p>
      ) : (
        <div className="clase__segmentacion-admin-tabla">
          <div className="clase__segmentacion-admin-encabezado" aria-hidden="true">
            <span>Nombre</span>
            <span>Inicio</span>
            <span>Fin</span>
            <span />
          </div>
          <ol className="clase__segmentacion-admin-lista">
            {ordenarCapitulos(capitulos).map((capitulo, index) => (
              <li key={capitulo.capituloId} className="clase__segmentacion-admin-item">
                <div className="clase__segmentacion-admin-nombre">
                  <span className="clase__segmentacion-numero">{String(index + 1).padStart(2, '0')}</span>
                  <strong title={capitulo.titulo}>{capitulo.titulo}</strong>
                </div>
                <span className="clase__segmentacion-admin-tiempo" data-label="Inicio">
                  {formatSegundos(capitulo.inicioSegundos)}
                </span>
                <span className="clase__segmentacion-admin-tiempo" data-label="Fin">
                  {formatSegundos(capitulo.finSegundos)}
                </span>
                <div className="clase__segmentacion-admin-acciones">
                  <Button type="button" variant="secondary" onClick={() => editar(capitulo)} disabled={ocupado}>
                    Editar
                  </Button>
                  <Button type="button" variant="danger" onClick={() => void eliminar(capitulo)} disabled={ocupado}>
                    Eliminar
                  </Button>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
