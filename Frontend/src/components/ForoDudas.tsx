import { useState, type FormEvent } from 'react';
import { catalogApi, type DudaForo, type RespuestaDuda } from '../api/catalog';
import { Alert } from './ui/Alert';
import { Button } from './ui/Button';
import { formatFecha, formatSegundos } from '../utils/video';

interface ForoDudasProps {
  claseId: string;
  token: string;
  currentSeconds: number;
  dudas: DudaForo[];
  userId: string;
  roles: string[];
  onDudaCreada: (duda: DudaForo) => void;
  onRespuestaPublicada: (dudaId: string, respuesta: RespuestaDuda) => void;
  onDudaVerificada: (duda: DudaForo) => void;
}

function ordenarDudas(dudas: DudaForo[]): DudaForo[] {
  return [...dudas].sort(
    (a, b) => a.posicionSegundos - b.posicionSegundos || a.fechaCreacion.localeCompare(b.fechaCreacion),
  );
}

function formatearFecha(iso: string): string {
  const fecha = new Date(iso);
  if (isNaN(fecha.getTime())) return '';
  return formatFecha(fecha.toISOString());
}

export function ForoDudas({
  claseId,
  token,
  currentSeconds,
  dudas,
  userId,
  roles,
  onDudaCreada,
  onRespuestaPublicada,
  onDudaVerificada,
}: ForoDudasProps) {
  const [pregunta, setPregunta] = useState('');
  const [publicando, setPublicando] = useState(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);
  const [hiloAbierto, setHiloAbierto] = useState<string | null>(null);
  const [respuestasEnProceso, setRespuestasEnProceso] = useState<Record<string, string>>({});
  const [enviandoRespuesta, setEnviandoRespuesta] = useState<Record<string, boolean>>({});
  const [verificando, setVerificando] = useState<string | null>(null);
  const [errorHilo, setErrorHilo] = useState<string | null>(null);

  const esDocente =
    roles.includes('ROLE_CATEDRATICO') || roles.includes('ROLE_ADMIN') || roles.includes('ROLE_AUXILIAR');

  async function publicarDuda(event: FormEvent) {
    event.preventDefault();
    const texto = pregunta.trim();
    if (!texto || publicando) return;
    setPublicando(true);
    setErrorForm(null);
    try {
      const res = await catalogApi.crearDuda(
        claseId,
        { posicionSegundos: Math.max(0, Math.floor(currentSeconds)), pregunta: texto },
        token,
      );
      setPregunta('');
      onDudaCreada(res.duda);
    } catch (err) {
      setErrorForm(err instanceof Error ? err.message : 'No se pudo publicar la duda');
    } finally {
      setPublicando(false);
    }
  }

  function alternarHilo(dudaId: string) {
    setErrorHilo(null);
    setHiloAbierto((prev) => (prev === dudaId ? null : dudaId));
  }

  function irAlMinuto(segundos: number) {
    setErrorHilo(null);
    const destino = Math.max(0, Math.floor(segundos));
    window.dispatchEvent(new CustomEvent('clase:seek', { detail: destino }));
  }

  async function publicarRespuesta(dudaId: string, contenido: string) {
    const texto = contenido.trim();
    if (!texto || enviandoRespuesta[dudaId]) return;
    setEnviandoRespuesta((prev) => ({ ...prev, [dudaId]: true }));
    setErrorHilo(null);
    try {
      const res = await catalogApi.responderDuda(dudaId, texto, token);
      setRespuestasEnProceso((prev) => ({ ...prev, [dudaId]: '' }));
      onRespuestaPublicada(dudaId, res.respuesta);
    } catch (err) {
      setErrorHilo(err instanceof Error ? err.message : 'No se pudo publicar la respuesta');
    } finally {
      setEnviandoRespuesta((prev) => ({ ...prev, [dudaId]: false }));
    }
  }

  async function verificar(respuesta: RespuestaDuda) {
    if (verificando) return;
    setVerificando(respuesta.respuestaId);
    setErrorHilo(null);
    try {
      const res = await catalogApi.marcarRespuestaVerificada(respuesta.respuestaId, token);
      onDudaVerificada(res.duda);
    } catch (err) {
      setErrorHilo(err instanceof Error ? err.message : 'No se pudo marcar la respuesta como verificada');
    } finally {
      setVerificando(null);
    }
  }

  return (
    <section className="clase__foro" id="clase__foro" aria-label="Foro de dudas de la clase">
      <h2 className="clase__ficha-titulo">Foro de dudas</h2>
      <div className="clase__foro-tiempo">Preguntando sobre: {formatSegundos(Math.max(0, Math.floor(currentSeconds)))}</div>

      <form className="clase__foro-form" onSubmit={publicarDuda}>
        <textarea
          className="clase__foro-textarea"
          value={pregunta}
          onChange={(e) => setPregunta(e.target.value)}
          placeholder={`¿Qué duda tienes en el minuto ${formatSegundos(Math.max(0, Math.floor(currentSeconds)))}?`}
          rows={3}
          maxLength={2000}
          disabled={publicando}
          aria-label="Pregunta de la duda"
        />
        <div className="clase__foro-acciones">
          <Button type="submit" variant="primary" disabled={pregunta.trim().length === 0 || publicando} loading={publicando}>
            {publicando ? 'Publicando…' : 'Publicar duda'}
          </Button>
        </div>
        {errorForm && <Alert tone="error">{errorForm}</Alert>}
      </form>

      {dudas.length === 0 ? (
        <p className="clase__estado">Aún no hay dudas planteadas en esta clase.</p>
      ) : (
        <ul className="clase__foro-lista">
          {ordenarDudas(dudas).map((duda) => {
            const puedoVerificar = duda.autorId === userId || esDocente;
            return (
              <li key={duda.dudaId} className="clase__foro-duda">
                <div className="clase__foro-duda-cabecera">
                  <span className={`clase__foro-badge${duda.resuelta ? ' clase__foro-badge--resuelta' : ''}`}>
                    {duda.resuelta ? 'Resuelta' : 'Abierta'}
                  </span>
                  <span className="clase__foro-minuto" title="Ir al minuto de la duda">
                    {formatSegundos(duda.posicionSegundos)}
                  </span>
                </div>
                <p className="clase__foro-pregunta">{duda.pregunta}</p>
                <div className="clase__foro-meta">
                  <span>{duda.totalRespuestas} {duda.totalRespuestas === 1 ? 'respuesta' : 'respuestas'}</span>
                  <span>·</span>
                  <span>{formatearFecha(duda.fechaCreacion)}</span>
                  <Button
                    type="button"
                    variant="secondary"
                    className="clase__foro-minuto-btn"
                    onClick={() => irAlMinuto(duda.posicionSegundos)}
                  >
                    Ver en el video
                  </Button>
                  <Button type="button" variant="oauth" onClick={() => alternarHilo(duda.dudaId)}>
                    {hiloAbierto === duda.dudaId ? 'Cerrar hilo' : 'Responder'}
                  </Button>
                </div>

                {hiloAbierto === duda.dudaId && (
                  <div className="clase__foro-hilo">
                    {duda.respuestas.length > 0 && (
                      <ul className="clase__foro-respuestas">
                        {duda.respuestas.map((respuesta) => (
                          <li key={respuesta.respuestaId} className="clase__foro-respuesta">
                            <div className="clase__foro-respuesta-cabecera">
                              <span className="clase__foro-respuesta-tiempo">{formatearFecha(respuesta.fechaCreacion)}</span>
                              {respuesta.esVerificada && (
                                <span className="clase__foro-verificada" title="Marcada como respuesta correcta">
                                  ✓ Respuesta Correcta
                                </span>
                              )}
                            </div>
                            <p className="clase__foro-respuesta-contenido">{respuesta.contenido}</p>
                            {puedoVerificar && !respuesta.esVerificada && (
                              <Button
                                type="button"
                                variant="secondary"
                                className="clase__foro-verificar-btn"
                                loading={verificando === respuesta.respuestaId}
                                disabled={verificando !== null}
                                onClick={() => void verificar(respuesta)}
                              >
                                Marcar como verificada
                              </Button>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="clase__foro-responder">
                      <textarea
                        className="clase__foro-textarea"
                        value={respuestasEnProceso[duda.dudaId] ?? ''}
                        onChange={(e) =>
                          setRespuestasEnProceso((prev) => ({ ...prev, [duda.dudaId]: e.target.value }))
                        }
                        placeholder="Escribe una respuesta…"
                        rows={2}
                        maxLength={2000}
                        disabled={enviandoRespuesta[duda.dudaId]}
                        aria-label={`Responder a la duda en ${formatSegundos(duda.posicionSegundos)}`}
                      />
                      <Button
                        type="button"
                        variant="primary"
                        disabled={(respuestasEnProceso[duda.dudaId] ?? '').trim().length === 0 || enviandoRespuesta[duda.dudaId]}
                        loading={enviandoRespuesta[duda.dudaId]}
                        onClick={() => void publicarRespuesta(duda.dudaId, respuestasEnProceso[duda.dudaId] ?? '')}
                      >
                        {enviandoRespuesta[duda.dudaId] ? 'Enviando…' : 'Responder'}
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {errorHilo && <Alert tone="error">{errorHilo}</Alert>}
    </section>
  );
}