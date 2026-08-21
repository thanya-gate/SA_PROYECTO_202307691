import { useEffect, useState } from 'react';
import {
  notificacionesApi,
  type NotificacionItem,
  type PlantillaItem,
  type ColaItem,
} from '../api/notificaciones';
import { useAuth } from '../auth/auth-context';
import { AppLayout } from '../components/AppLayout';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';

type Tab = 'bandeja' | 'enviar' | 'plantillas' | 'cola';

function formatearFecha(iso: string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const anio = d.getFullYear();
  const hora = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dia}/${mes}/${anio} ${hora}:${min}`;
}

function claseEstado(estado: string): string {
  const map: Record<string, string> = {
    ENVIADA: 'notif__estado--enviada',
    PENDIENTE: 'notif__estado--pendiente',
    FALLIDA: 'notif__estado--fallida',
    FALLIDA_DEFINITIVA: 'notif__estado--fallida',
    EN_COLA: 'notif__estado--pendiente',
    PROCESANDO: 'notif__estado--pendiente',
  };
  return map[estado] ?? '';
}

export default function NotificacionesPage() {
  const { token, user } = useAuth();
  const tokenActual = token ?? '';

  const isAdmin = user?.roles.includes('ROLE_ADMIN') ?? false;
  const [tab, setTab] = useState<Tab>('bandeja');

  const [notificaciones, setNotificaciones] = useState<NotificacionItem[]>([]);
  const [cargandoNotif, setCargandoNotif] = useState(true);
  const [errorNotif, setErrorNotif] = useState<string | null>(null);

  const [mensaje, setMensaje] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [exitoEnvio, setExitoEnvio] = useState<string | null>(null);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);

  const [plantillas, setPlantillas] = useState<PlantillaItem[]>([]);
  const [cargandoPlantillas, setCargandoPlantillas] = useState(true);
  const [errorPlantillas, setErrorPlantillas] = useState<string | null>(null);

  const [cola, setCola] = useState<ColaItem[]>([]);
  const [cargandoCola, setCargandoCola] = useState(true);
  const [errorCola, setErrorCola] = useState<string | null>(null);

  useEffect(() => {
    if (!tokenActual) return;
    let active = true;
    setCargandoNotif(true);
    setErrorNotif(null);
    notificacionesApi
      .listarNotificaciones(tokenActual)
      .then((res) => {
        if (active) setNotificaciones(res.items);
      })
      .catch((err: unknown) => {
        if (active) setErrorNotif(err instanceof Error ? err.message : 'Error al cargar notificaciones');
      })
      .finally(() => {
        if (active) setCargandoNotif(false);
      });
    return () => { active = false; };
  }, [tokenActual]);

  useEffect(() => {
    if (!isAdmin || !tokenActual) return;
    let active = true;
    if (tab === 'plantillas') {
      setCargandoPlantillas(true);
      setErrorPlantillas(null);
      notificacionesApi
        .listarPlantillas(tokenActual)
        .then((res) => { if (active) setPlantillas(res.items); })
        .catch((err: unknown) => {
          if (active) setErrorPlantillas(err instanceof Error ? err.message : 'Error al cargar plantillas');
        })
        .finally(() => { if (active) setCargandoPlantillas(false); });
    }
    if (tab === 'cola') {
      setCargandoCola(true);
      setErrorCola(null);
      notificacionesApi
        .consultarCola(tokenActual)
        .then((res) => { if (active) setCola(res.items); })
        .catch((err: unknown) => {
          if (active) setErrorCola(err instanceof Error ? err.message : 'Error al consultar cola');
        })
        .finally(() => { if (active) setCargandoCola(false); });
    }
    return () => { active = false; };
  }, [isAdmin, tokenActual, tab]);

  async function handleEnviarAviso(e: React.FormEvent) {
    e.preventDefault();
    if (!tokenActual || !mensaje.trim()) return;
    setEnviando(true);
    setErrorEnvio(null);
    setExitoEnvio(null);
    try {
      const res = await notificacionesApi.enviarAvisoGeneral(tokenActual, mensaje.trim());
      setExitoEnvio(
        `Aviso encolado: ${res.notificacionesEncoladas} notificación(es) para ${res.destinatarioIds.length} destinatario(s).`,
      );
      setMensaje('');
    } catch (err: unknown) {
      setErrorEnvio(err instanceof Error ? err.message : 'Error al enviar aviso');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <AppLayout>
      <section className="notif">
        <div className="catalogo__hero">
          <h1 className="catalogo__title">Notificaciones</h1>
          <p className="catalogo__subtitle">
            Bandeja de notificaciones del sistema, envío de avisos y estado de la cola de correo.
          </p>
        </div>

        <div className="notif__tabs" role="tablist">
          <button
            role="tab"
            aria-selected={tab === 'bandeja'}
            className={`notif__tab${tab === 'bandeja' ? ' notif__tab--active' : ''}`}
            onClick={() => setTab('bandeja')}
          >
            Bandeja
          </button>
          {isAdmin && (
            <>
              <button
                role="tab"
                aria-selected={tab === 'enviar'}
                className={`notif__tab${tab === 'enviar' ? ' notif__tab--active' : ''}`}
                onClick={() => setTab('enviar')}
              >
                Enviar aviso
              </button>
              <button
                role="tab"
                aria-selected={tab === 'plantillas'}
                className={`notif__tab${tab === 'plantillas' ? ' notif__tab--active' : ''}`}
                onClick={() => setTab('plantillas')}
              >
                Plantillas
              </button>
              <button
                role="tab"
                aria-selected={tab === 'cola'}
                className={`notif__tab${tab === 'cola' ? ' notif__tab--active' : ''}`}
                onClick={() => setTab('cola')}
              >
                Cola de envío
              </button>
            </>
          )}
        </div>

        {tab === 'bandeja' && (
          <div role="tabpanel" className="notif__panel">
            {errorNotif && <Alert tone="error"><strong>Error:</strong> {errorNotif}</Alert>}
            {cargandoNotif ? (
              <p className="catalogo__estado" role="status">Cargando notificaciones…</p>
            ) : notificaciones.length === 0 ? (
              <p className="catalogo__estado">No tienes notificaciones.</p>
            ) : (
              <div className="notif__inbox">
                {notificaciones.map((n) => (
                  <article key={n.id} className="notif__item">
                    <div className="notif__item-header">
                      <span className="notif__item-tipo">{n.tipo}</span>
                      <span className={`notif__item-estado ${claseEstado(n.estado)}`}>
                        {n.estado}
                      </span>
                    </div>
                    <h3 className="notif__item-asunto">{n.asunto}</h3>
                    {n.cuerpo && <p className="notif__item-cuerpo">{n.cuerpo}</p>}
                    <footer className="notif__item-footer">
                      <span title="Fecha de creación">
                        Creada: {formatearFecha(n.fechaCreacion)}
                      </span>
                      {n.fechaEnvio && (
                        <span title="Fecha de envío">
                          Enviada: {formatearFecha(n.fechaEnvio)}
                        </span>
                      )}
                    </footer>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'enviar' && isAdmin && (
          <div role="tabpanel" className="notif__panel">
            <div className="notif__admin">
              <h2 className="notif__admin-titulo">Enviar aviso general</h2>
              <p className="notif__admin-desc">
                El aviso se enviará por correo electrónico a todos los estudiantes inscritos.
                Puedes especificar destinatarios específicos omitiendo la lista para enviar a todos.
              </p>
              {exitoEnvio && <Alert tone="success">{exitoEnvio}</Alert>}
              {errorEnvio && <Alert tone="error"><strong>Error:</strong> {errorEnvio}</Alert>}
              <form className="notif__form" onSubmit={handleEnviarAviso}>
                <label className="notif__label">
                  Mensaje del aviso
                  <textarea
                    className="notif__textarea"
                    rows={5}
                    value={mensaje}
                    onChange={(e) => setMensaje(e.target.value)}
                    placeholder="Escribe el mensaje del aviso aquí…"
                    required
                  />
                </label>
                <Button type="submit" loading={enviando} disabled={!mensaje.trim()}>
                  Enviar aviso
                </Button>
              </form>
            </div>
          </div>
        )}

        {tab === 'plantillas' && isAdmin && (
          <div role="tabpanel" className="notif__panel">
            <div className="notif__admin">
              <h2 className="notif__admin-titulo">Plantillas de correo</h2>
              <p className="notif__admin-desc">
                Plantillas disponibles para el envío automático de correos electrónicos del sistema.
              </p>
              {errorPlantillas && <Alert tone="error"><strong>Error:</strong> {errorPlantillas}</Alert>}
              {cargandoPlantillas ? (
                <p className="catalogo__estado" role="status">Cargando plantillas…</p>
              ) : plantillas.length === 0 ? (
                <p className="catalogo__estado">No hay plantillas registradas.</p>
              ) : (
                <div className="notif__tabla-wrapper">
                  <table className="notif__tabla">
                    <thead>
                      <tr>
                        <th>Nombre</th>
                        <th>Tipo</th>
                        <th>Asunto</th>
                        <th>Cuerpo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plantillas.map((p) => (
                        <tr key={p.id}>
                          <td className="notif__tabla-nombre">{p.nombre}</td>
                          <td><span className="notif__badge">{p.tipo}</span></td>
                          <td>{p.asunto}</td>
                          <td className="notif__tabla-cuerpo">{p.cuerpo}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'cola' && isAdmin && (
          <div role="tabpanel" className="notif__panel">
            <div className="notif__admin">
              <h2 className="notif__admin-titulo">Cola de envío de correo</h2>
              <p className="notif__admin-desc">
                Estado actual de la cola de envío. Muestra los intentos, errores y el próximo reintento programado.
              </p>
              {errorCola && <Alert tone="error"><strong>Error:</strong> {errorCola}</Alert>}
              {cargandoCola ? (
                <p className="catalogo__estado" role="status">Consultando cola…</p>
              ) : cola.length === 0 ? (
                <p className="catalogo__estado">La cola de envío está vacía.</p>
              ) : (
                <div className="notif__tabla-wrapper">
                  <table className="notif__tabla">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Correo destino</th>
                        <th>Estado</th>
                        <th>Intentos</th>
                        <th>Último error</th>
                        <th>Próximo reintento</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cola.map((c) => (
                        <tr key={c.colaId}>
                          <td>{c.colaId}</td>
                          <td>{c.correoDestino}</td>
                          <td>
                            <span className={`notif__badge notif__badge--${c.estado.toLowerCase()}`}>
                              {c.estado}
                            </span>
                          </td>
                          <td>{c.intentos}</td>
                          <td className="notif__tabla-error">{c.ultimoError || '-'}</td>
                          <td>{c.fechaProximoIntento ? formatearFecha(c.fechaProximoIntento) : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </AppLayout>
  );
}
