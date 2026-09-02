import { useRef, useState } from 'react';
import { jsPDF } from 'jspdf';
import Markdown from 'react-markdown';
import { reproduccionApi, type Apunte } from '../api/reproduccion';
import { useAuth } from '../auth/auth-context';
import { Alert } from './ui/Alert';
import { Button } from './ui/Button';
import { formatSegundos } from '../utils/video';

interface ApunteEditorProps {
  claseId: string;
  currentSeconds: number;
  apunte: Apunte | null;
  onGuardado: (apunte: Apunte) => void;
  onEliminado: (apunteId: string) => void;
  onCerrar: () => void;
  onSeek: (seconds: number) => void;
}

function formatMarcador(segundos: number): string {
  const mins = Math.floor(Math.max(0, segundos) / 60);
  const secs = Math.floor(Math.max(0, segundos) % 60);
  return `[${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}]`;
}

function CronometroIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2 2" />
      <path d="M9 2h6" />
    </svg>
  );
}

function EnlaceIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function preprocesarMarkdown(texto: string): string {
  return texto.replace(/\[(\d{2}):(\d{2})\]/g, '[$1:$2](apunte-time://$1:$2)');
}

const PDF_PRIMARY = [62, 143, 214] as const;
const PDF_INK = [33, 37, 41] as const;
const PDF_MUTED = [110, 116, 125] as const;

function formatearFecha(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' });
}

function limpiarTextoMarkdown(texto: string): string {
  return texto
    .replace(/\[(\d{2}):(\d{2})\]\(apunte-time:\/\/\d{2}:\d{2}\)/g, '$1:$2')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s*/, '');
}

function exportarApuntePDF(titulo: string, contenido: string, fecha: string | undefined, posicionSegundos: number) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 48;
  const maxWidth = pageWidth - margin * 2;
  let y = margin + 60;

  doc.setFillColor(62, 143, 214);
  doc.rect(0, 0, pageWidth, 8, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...PDF_PRIMARY);
  doc.text(titulo || 'Apunte', margin, y);
  y += 18;

  const meta: string[] = [];
  if (posicionSegundos > 0) meta.push(`Tiempo: ${formatSegundos(posicionSegundos)}`);
  const fechaTexto = formatearFecha(fecha);
  if (fechaTexto) meta.push(`Fecha: ${fechaTexto}`);
  if (meta.length > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...PDF_MUTED);
    doc.text(meta.join('   ·   '), margin, y);
    y += 16;
  }

  doc.setDrawColor(...PDF_MUTED);
  doc.setLineWidth(0.6);
  doc.line(margin, y, pageWidth - margin, y);
  y += 22;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...PDF_INK);

  const lineas = contenido.split(/\r?\n/);
  for (const linea of lineas) {
    if (y > pageHeight - 60) {
      doc.addPage();
      doc.setFillColor(62, 143, 214);
      doc.rect(0, 0, pageWidth, 8, 'F');
      y = margin + 40;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(...PDF_INK);
    }

    let texto = limpiarTextoMarkdown(linea);
    const esEncabezado = /^#{1,6}\s/.test(linea);
    const esLista = /^\s*[-*+]\s+/.test(linea);
    const esMarcador = /^\[\d{2}:\d{2}\]$/.test(linea.trim());
    const esVacio = texto.trim() === '';

    if (esEncabezado) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(...PDF_PRIMARY);
      y += 12;
    } else if (esMarcador) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...PDF_PRIMARY);
      y += 6;
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(...PDF_INK);
    }

    if (esVacio) {
      y += 8;
    } else {
      texto = esLista ? texto.replace(/^\s*[-*+]\s+/, '•  ') : texto;
      const wrapped = doc.splitTextToSize(texto, maxWidth);
      for (const piece of wrapped as string[]) {
        if (y > pageHeight - 60) {
          doc.addPage();
          doc.setFillColor(62, 143, 214);
          doc.rect(0, 0, pageWidth, 8, 'F');
          y = margin + 40;
        }
        doc.text(piece, esLista ? margin + 14 : margin, y);
        y += (esEncabezado ? 20 : 15);
      }
    }
  }

  doc.save(`apunte-${(titulo || 'sin-titulo').replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').toLowerCase()}.pdf`);
}

export function ApunteEditor({ claseId, currentSeconds, apunte, onGuardado, onEliminado, onCerrar, onSeek }: ApunteEditorProps) {
  const { token } = useAuth();
  const [titulo, setTitulo] = useState(apunte?.titulo ?? '');
  const [contenido, setContenido] = useState(apunte?.contenidoMarkdown ?? '');
  const [guardando, setGuardando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const esNuevo = !apunte;

  function insertarMarcador() {
    const marker = formatMarcador(currentSeconds);
    const textarea = textareaRef.current;
    if (!textarea) {
      setContenido((prev) => prev + (prev.endsWith('\n') || prev === '' ? '' : '\n') + marker + ' ');
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = contenido.slice(0, start);
    const after = contenido.slice(end);
    const needsNewline = before.length > 0 && !before.endsWith('\n');
    const insertion = (needsNewline ? '\n' : '') + marker + ' ';
    const newContent = before + insertion + after;
    setContenido(newContent);
    setTimeout(() => {
      const pos = start + insertion.length;
      textarea.selectionStart = pos;
      textarea.selectionEnd = pos;
      textarea.focus();
    }, 0);
  }

  function insertarFormato(before: string, after: string) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = contenido.slice(start, end);
    const newContent = contenido.slice(0, start) + before + selected + after + contenido.slice(end);
    setContenido(newContent);
    setTimeout(() => {
      if (selected) {
        textarea.selectionStart = start + before.length;
        textarea.selectionEnd = start + before.length + selected.length;
      } else {
        textarea.selectionStart = start + before.length;
        textarea.selectionEnd = start + before.length;
      }
      textarea.focus();
    }, 0);
  }

  async function guardar() {
    if (!titulo.trim()) {
      setError('El título es obligatorio.');
      return;
    }
    setGuardando(true);
    setError(null);
    setExito(null);
    try {
      const posicionGuardada =
        apunte && typeof apunte.posicionSegundos === 'number' && apunte.posicionSegundos > 0
          ? apunte.posicionSegundos
          : Math.max(0, Math.floor(currentSeconds));
      const data = await reproduccionApi.guardarApunte(claseId, apunte?.apunteId ?? '', titulo.trim(), contenido, posicionGuardada, token ?? '');
      onGuardado(data.apunte);
      setExito('Apunte guardado correctamente.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el apunte');
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar() {
    if (!apunte) return;
    if (!window.confirm('¿Eliminar este apunte? No se puede deshacer.')) return;
    setEliminando(true);
    setError(null);
    setExito(null);
    try {
      await reproduccionApi.eliminarApunte(apunte.apunteId, token ?? '');
      onEliminado(apunte.apunteId);
      onCerrar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el apunte');
    } finally {
      setEliminando(false);
    }
  }

  function exportar() {
    exportarApuntePDF(
      (titulo || apunte?.titulo) ?? 'Apunte',
      (contenido || apunte?.contenidoMarkdown) ?? '',
      apunte?.fechaCreacion,
      apunte?.posicionSegundos ?? 0,
    );
  }

  function exportarMd() {
    const nombreTitulo = (titulo || apunte?.titulo || 'apunte').replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').toLowerCase();
    const contenidoMd = `# ${titulo || apunte?.titulo || 'Apunte'}\n\n${(contenido || apunte?.contenidoMarkdown) ?? ''}`;
    const blob = new Blob([contenidoMd], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `apunte-${nombreTitulo}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <aside className="clase__apunte-panel" aria-label="Aparte de apuntes">
      <div className="clase__apunte-header">
        <h2 className="clase__ficha-titulo">{esNuevo ? 'Nuevo apunte' : 'Editar apunte'}</h2>
        <button type="button" className="clase__apunte-cerrar" onClick={onCerrar} title="Cerrar editor">
          ✕
        </button>
      </div>

      <input
        type="text"
        className="clase__apunte-titulo-input"
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        placeholder="Título del apunte…"
        disabled={guardando}
      />

      <div className="clase__apunte-toolbar">
        <button type="button" className="clase__apunte-toolbar-btn" onClick={() => insertarFormato('**', '**')} title="Negrita">
          <strong>B</strong>
        </button>
        <button type="button" className="clase__apunte-toolbar-btn" onClick={() => insertarFormato('*', '*')} title="Cursiva">
          <em>I</em>
        </button>
        <button type="button" className="clase__apunte-toolbar-btn" onClick={() => insertarFormato('## ', '')} title="Encabezado">
          H
        </button>
        <button type="button" className="clase__apunte-toolbar-btn" onClick={() => insertarFormato('[texto](url)', '')} title="Enlace">
          <EnlaceIcon />
        </button>
        <button
          type="button"
          className="clase__apunte-toolbar-btn clase__apunte-toolbar-btn--marker"
          onClick={insertarMarcador}
          title={`Insertar marcador ${formatMarcador(currentSeconds)}`}
        >
          <CronometroIcon /> {formatMarcador(currentSeconds)}
        </button>
      </div>

      <div className="clase__apunte-editor-body">
        <textarea
          ref={textareaRef}
          className="clase__apunte-textarea"
          value={contenido}
          onChange={(e) => setContenido(e.target.value)}
          placeholder={'Escribe tus apuntes aquí…'}
          disabled={guardando}
          rows={14}
          onKeyDown={(e) => {
            if (e.key === 'b' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              insertarFormato('**', '**');
            }
            if (e.key === 'i' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              insertarFormato('*', '*');
            }
          }}
        />
        <div className="clase__apunte-preview">
          {contenido ? (
            <Markdown
              components={{
                a: ({ href, children }) => {
                  if (typeof href === 'string' && href.startsWith('apunte-time://')) {
                    const match = href.match(/apunte-time:\/\/(\d{2}):(\d{2})/);
                    if (match) {
                      const seconds = Number(match[1]) * 60 + Number(match[2]);
                      return (
                        <button type="button" className="clase__apunte-marcador" onClick={() => onSeek(seconds)} title={`Ir a ${formatSegundos(seconds)}`}>
                          ⏱ {children}
                        </button>
                      );
                    }
                  }
                  return (
                    <a href={href} target="_blank" rel="noopener noreferrer">
                      {children}
                    </a>
                  );
                },
              }}
            >
              {preprocesarMarkdown(contenido)}
            </Markdown>
          ) : (
            <p className="clase__apunte-preview-placeholder">La vista previa aparecerá aquí…</p>
          )}
        </div>
      </div>

      {error && <Alert tone="error">{error}</Alert>}
      {exito && <Alert tone="success">{exito}</Alert>}

      <div className="clase__apunte-footer">
        <div className="clase__apunte-footer-acciones">
          <Button onClick={() => void guardar()} disabled={guardando || !titulo.trim()} loading={guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </Button>
          {!esNuevo && (
            <>
              <Button variant="secondary" onClick={exportar} disabled={guardando}>
                Exportar PDF
              </Button>
              <Button variant="secondary" onClick={exportarMd} disabled={guardando}>
                Exportar .md
              </Button>
              <Button variant="danger" onClick={() => void eliminar()} loading={eliminando} disabled={guardando}>
                {eliminando ? 'Eliminando…' : 'Eliminar'}
              </Button>
            </>
          )}
        </div>
        <span className="clase__apunte-tiempo-actual">Marcador: {formatMarcador(currentSeconds)}</span>
      </div>
    </aside>
  );
}
