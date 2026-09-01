import type { Capitulo } from '../api/catalog';
import { formatSegundos } from '../utils/video';

export interface ApunteTimeline {
  apunteId: string;
  posicion: number;
  titulo: string;
}

interface ChapterTimelineProps {
  capitulos: Capitulo[];
  duracion: number;
  currentSeconds: number;
  onSeek: (seconds: number) => void;
}

function ordenarCapitulos(capitulos: Capitulo[]): Capitulo[] {
  return [...capitulos].sort((a, b) => a.orden - b.orden || a.inicioSegundos - b.inicioSegundos);
}

export function ChapterTimeline({ capitulos, duracion, currentSeconds, onSeek }: ChapterTimelineProps) {
  const ordenados = ordenarCapitulos(capitulos);

  if (ordenados.length === 0) return null;

  const activo = ordenados.findIndex(
    (capitulo) => currentSeconds >= capitulo.inicioSegundos && currentSeconds < capitulo.finSegundos,
  );

  return (
    <section className="clase__segmentacion" aria-label="Capítulos de la clase">
      <div className="clase__segmentacion-cabecera">
        <div>
          <p className="clase__segmentacion-kicker">Navegación rápida</p>
          <h2 className="clase__ficha-titulo">Capítulos y temas</h2>
        </div>
        <span className="clase__segmentacion-tiempo">
          {formatSegundos(Math.max(0, Math.floor(currentSeconds)))}
          {duracion > 0 ? ` / ${formatSegundos(duracion)}` : ''}
        </span>
      </div>

      <ol className="clase__segmentacion-lista">
        {ordenados.map((capitulo, index) => (
          <li key={capitulo.capituloId}>
            <button
              type="button"
              className={`clase__segmentacion-item${index === activo ? ' clase__segmentacion-item--activo' : ''}`}
              onClick={() => onSeek(capitulo.inicioSegundos)}
              aria-current={index === activo ? 'true' : undefined}
            >
              <span className="clase__segmentacion-numero">{String(index + 1).padStart(2, '0')}</span>
              <span className="clase__segmentacion-item-info">
                <strong>{capitulo.titulo}</strong>
                <span>
                  {formatSegundos(capitulo.inicioSegundos)} – {formatSegundos(capitulo.finSegundos)}
                </span>
              </span>
              <span className="clase__segmentacion-ir" aria-hidden="true">›</span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
