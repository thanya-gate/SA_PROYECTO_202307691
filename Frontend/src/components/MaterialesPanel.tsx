import { useRef, useState, type ChangeEvent } from 'react';
import {
  MATERIALES_ACEPTADOS,
  TAMANO_MAXIMO_MATERIAL,
  materialesApi,
  type MaterialAdjunto,
} from '../api/materiales';
import { useAuth } from '../auth/auth-context';
import { Alert } from './ui/Alert';
import { Button } from './ui/Button';
import { formatFecha, formatTamanoBytes } from '../utils/video';

interface MaterialesPanelProps {
  claseId: string;
  materialesIniciales: MaterialAdjunto[];
  puedeGestionar: boolean;
}

const ETIQUETAS_EXTENSION: Record<string, string> = {
  '.pdf': 'PDF',
  '.doc': 'DOC',
  '.docx': 'DOCX',
  '.ppt': 'PPT',
  '.pptx': 'PPTX',
  '.txt': 'TXT',
  '.png': 'IMG',
  '.jpg': 'IMG',
  '.zip': 'ZIP',
  '.py': 'PY',
  '.go': 'GO',
  '.sql': 'SQL',
};

function etiquetaExtension(material: MaterialAdjunto): string {
  return ETIQUETAS_EXTENSION[material.extension?.toLowerCase()] ?? 'ARCHIVO';
}

export function MaterialesPanel({ claseId, materialesIniciales, puedeGestionar }: MaterialesPanelProps) {
  const { token } = useAuth();
  const [materiales, setMateriales] = useState<MaterialAdjunto[]>(materialesIniciales);
  const [subiendo, setSubiendo] = useState(false);
  const [ocupadoId, setOcupadoId] = useState<string | null>(null);
  const [descargandoId, setDescargandoId] = useState<string | null>(null);
  const [materialVersionandoId, setMaterialVersionandoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const inputVersionRef = useRef<HTMLInputElement>(null);

  async function refrescarLista() {
    if (!token) return;
    const res = await materialesApi.listar(claseId, token).catch(() => null);
    if (res) setMateriales(res.materiales ?? []);
  }

  async function manejarSubida(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !token) return;
    if (file.size > TAMANO_MAXIMO_MATERIAL) {
      setError('El archivo supera el límite de 50 MB.');
      return;
    }
    setSubiendo(true);
    setError(null);
    setExito(null);
    try {
      await materialesApi.subir(claseId, file, token);
      await refrescarLista();
      setExito(`Material "${file.name}" publicado.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo subir el material');
    } finally {
      setSubiendo(false);
    }
  }

  function abrirSelectorVersion(materialId: string) {
    setMaterialVersionandoId(materialId);
    inputVersionRef.current?.click();
  }

  async function manejarNuevaVersion(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    const materialId = materialVersionandoId;
    setMaterialVersionandoId(null);
    if (!file || !materialId || !token) return;
    if (file.size > TAMANO_MAXIMO_MATERIAL) {
      setError('El archivo supera el límite de 50 MB.');
      return;
    }
    setOcupadoId(materialId);
    setError(null);
    setExito(null);
    try {
      const res = await materialesApi.subirVersion(materialId, file, token);
      await refrescarLista();
      setExito(res.message ?? 'Nueva versión publicada.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo publicar la nueva versión');
    } finally {
      setOcupadoId(null);
    }
  }

  async function manejarEliminar(material: MaterialAdjunto) {
    if (!token) return;
    const confirmacion = window.confirm(
      `¿Eliminar "${material.nombreArchivo}"? Se borran todas sus versiones y no se puede deshacer.`,
    );
    if (!confirmacion) return;
    setOcupadoId(material.materialId);
    setError(null);
    setExito(null);
    try {
      await materialesApi.eliminar(material.materialId, token);
      await refrescarLista();
      setExito('Material eliminado.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el material');
    } finally {
      setOcupadoId(null);
    }
  }

  async function manejarDescarga(material: MaterialAdjunto) {
    setDescargandoId(material.materialId);
    try {
      // Misma ruta que el reproductor de videos: /media es same-origin del SPA.
      const response = await fetch(material.urlArchivo, { credentials: 'include' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const ancla = document.createElement('a');
      ancla.href = url;
      ancla.download = material.nombreArchivo;
      document.body.appendChild(ancla);
      ancla.click();
      ancla.remove();
      URL.revokeObjectURL(url);
    } catch {
      // Respaldo para URLs externas (bucket GCS): abrir en otra pestaña.
      window.open(material.urlArchivo, '_blank', 'noopener,noreferrer');
    } finally {
      setDescargandoId(null);
    }
    // Métrica best-effort: no debe romper la descarga si falla.
    if (token) {
      void materialesApi
        .registrarDescarga(material.materialId, token)
        .then((res) => {
          setMateriales((prev) =>
            prev.map((m) => (m.materialId === material.materialId ? { ...m, totalDescargas: res.totalDescargas } : m)),
          );
        })
        .catch(() => {});
    }
  }

  return (
    <div className="clase__repo">
      <h2 className="clase__ficha-titulo">Material del Curso</h2>

      {puedeGestionar && (
        <div className="clase__repo-subida">
          <label className="clase__subida-input">
            <input
              type="file"
              accept={MATERIALES_ACEPTADOS}
              onChange={manejarSubida}
              disabled={subiendo}
            />
            <span>{subiendo ? 'Subiendo…' : 'Subir material'}</span>
          </label>
          {/* Input oculto reutilizado para subir nuevas versiones */}
          <input
            ref={inputVersionRef}
            type="file"
            accept={MATERIALES_ACEPTADOS}
            onChange={manejarNuevaVersion}
            disabled={ocupadoId !== null}
            hidden
          />
        </div>
      )}

      {error && <Alert tone="error">{error}</Alert>}
      {exito && <Alert tone="success">{exito}</Alert>}

      {materiales.length === 0 ? (
        <p className="clase__estado">Esta clase aún no tiene materiales adjuntos.</p>
      ) : (
        <ul className="clase__materiales-lista">
          {materiales.map((material) => (
            <li key={material.materialId} className="clase__material-item">
              <span className="clase__material-icono" aria-hidden="true">
                {etiquetaExtension(material)}
              </span>
              <div className="clase__material-info">
                <span className="clase__material-nombre">{material.nombreArchivo}</span>
                <span className="clase__material-meta">
                  v{material.versionActual} · {formatTamanoBytes(material.tamanoBytes)} ·{' '}
                  {material.totalDescargas} descargas
                  {material.fechaSubida ? ` · ${formatFecha(material.fechaSubida)}` : ''}
                </span>
              </div>
              <div className="clase__material-acciones">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void manejarDescarga(material)}
                  loading={descargandoId === material.materialId}
                >
                  Descargar
                </Button>
                {puedeGestionar && (
                  <>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => abrirSelectorVersion(material.materialId)}
                      loading={ocupadoId === material.materialId}
                    >
                      Nueva versión
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      onClick={() => void manejarEliminar(material)}
                      loading={ocupadoId === material.materialId}
                    >
                      Eliminar
                    </Button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
