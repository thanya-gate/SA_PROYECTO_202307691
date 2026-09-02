import { useEffect, useRef, useState } from 'react';
import type { Capitulo } from '../api/catalog';
import { formatSegundos } from '../utils/video';

export interface ApunteBarra {
  apunteId: string;
  posicion: number;
  titulo: string;
}

interface PlayerProgressBarProps {
  currentSeconds: number;
  duracion: number;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onSeek: (seconds: number) => void;
  capitulos?: Capitulo[];
  apuntes?: ApunteBarra[];
  onAbrirApunte?: (apunteId: string | null, seconds: number) => void;
}

const UMBRAL_APUNTE_SEGUNDOS = 8;

function ordenarCapitulos(capitulos: Capitulo[]): Capitulo[] {
  return [...capitulos].sort((a, b) => a.orden - b.orden || a.inicioSegundos - b.inicioSegundos);
}

function LapizIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

export function PlayerProgressBar({
  currentSeconds,
  duracion,
  isPlaying,
  onTogglePlay,
  onSeek,
  capitulos,
  apuntes,
  onAbrirApunte,
}: PlayerProgressBarProps) {
  const barraRef = useRef<HTMLButtonElement>(null);
  const [hoverSegundos, setHoverSegundos] = useState<number | null>(null);
  const hoverTimeoutRef = useRef<number | null>(null);

  function limpiarTimeoutHover() {
    if (hoverTimeoutRef.current !== null) {
      window.clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  }

  function fijarHover(segundos: number | null) {
    limpiarTimeoutHover();
    if (segundos === null) {
      hoverTimeoutRef.current = window.setTimeout(() => setHoverSegundos(null), 180);
    } else {
      setHoverSegundos(segundos);
    }
  }

  const ordenados = ordenarCapitulos(capitulos ?? []);
  const progreso = duracion > 0 ? Math.min(100, Math.max(0, (currentSeconds / duracion) * 100)) : 0;

  useEffect(() => limpiarTimeoutHover, []);

  const activo = ordenados.findIndex(
    (capitulo) => currentSeconds >= capitulo.inicioSegundos && currentSeconds < capitulo.finSegundos,
  );

  const pinesApunte = (apuntes ?? []).filter(
    (apunte) => apunte.posicion >= 0 && apunte.posicion <= duracion,
  );

  function apunteCercano(segundos: number): ApunteBarra | null {
    let mejor: ApunteBarra | null = null;
    for (const apunte of pinesApunte) {
      if (Math.abs(apunte.posicion - segundos) <= UMBRAL_APUNTE_SEGUNDOS) {
        if (!mejor || Math.abs(apunte.posicion - segundos) < Math.abs(mejor.posicion - segundos)) {
          mejor = apunte;
        }
      }
    }
    return mejor;
  }

  const apunteEnHover = hoverSegundos !== null ? apunteCercano(hoverSegundos) : null;

  function segundosDesdeEvento(clientX: number): number {
    const rect = barraRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return 0;
    const porcentaje = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return Math.min(duracion, Math.floor(porcentaje * duracion));
  }

  function manejarSeek(clientX: number) {
    if (duracion <= 0) return;
    onSeek(segundosDesdeEvento(clientX));
  }

  return (
    <div className="clase__barra-controles">
      <button
        type="button"
        className="clase__barra-play"
        onClick={onTogglePlay}
        aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
        title={isPlaying ? 'Pausar' : 'Reproducir'}
      >
        {isPlaying ? '❚❚' : '▶'}
      </button>

      <span className="clase__barra-tiempo">{formatSegundos(Math.max(0, Math.floor(currentSeconds)))}</span>

      <button
        type="button"
        ref={barraRef}
        className="clase__barra-seek"
        role="slider"
        aria-label="Barra de progreso del video"
        aria-valuemin={0}
        aria-valuemax={Math.max(0, Math.floor(duracion))}
        aria-valuenow={Math.max(0, Math.floor(currentSeconds))}
        onMouseMove={(e) => {
          if (!onAbrirApunte || duracion <= 0) return;
          fijarHover(segundosDesdeEvento(e.clientX));
        }}
        onMouseLeave={() => fijarHover(null)}
        onPointerDown={(e) => {
          e.preventDefault();
          manejarSeek(e.clientX);
        }}
        onKeyDown={(e) => {
          if (duracion <= 0) return;
          const delta = e.key === 'ArrowRight' ? 5 : e.key === 'ArrowLeft' ? -5 : 0;
          if (delta !== 0) {
            e.preventDefault();
            onSeek(Math.max(0, Math.min(duracion, currentSeconds + delta)));
          }
        }}
      >
        <span className="clase__barra-track" aria-hidden="true">
          <span className="clase__barra-track-base" />
          {duracion > 0 &&
            ordenados.map((capitulo, index) => {
              const left = (capitulo.inicioSegundos / duracion) * 100;
              const width = Math.max(0.6, ((capitulo.finSegundos - capitulo.inicioSegundos) / duracion) * 100);
              return (
                <span
                  key={capitulo.capituloId}
                  className={`clase__barra-capitulo${index === activo ? ' clase__barra-capitulo--activo' : ''}`}
                  style={{ left: `${left}%`, width: `${width}%` }}
                />
              );
            })}
          <span className="clase__barra-llenado" style={{ width: `${progreso}%` }} />
          {duracion > 0 && <span className="clase__barra-punto" style={{ left: `${progreso}%` }} />}
        </span>
      </button>

      <span className="clase__barra-duracion">{duracion > 0 ? formatSegundos(duracion) : '0:00'}</span>

      {duracion > 0 &&
        pinesApunte.map((apunte) => (
          <button
            key={apunte.apunteId}
            type="button"
            className="clase__barra-pin"
            style={{ left: `${Math.min(100, Math.max(0, (apunte.posicion / duracion) * 100))}%` }}
            title={`${apunte.titulo} · ${formatSegundos(apunte.posicion)}`}
            aria-label={`Apunte ${apunte.titulo} en ${formatSegundos(apunte.posicion)}. Ver apunte.`}
            onMouseEnter={() => fijarHover(apunte.posicion)}
            onClick={(e) => {
              e.stopPropagation();
              setHoverSegundos(null);
              onAbrirApunte?.(apunte.apunteId, apunte.posicion);
            }}
          >
            <LapizIcon size={14} />
          </button>
        ))}

      {onAbrirApunte && hoverSegundos !== null && duracion > 0 && (
        <div
          className="clase__barra-tooltip"
          role="tooltip"
          style={{ left: `${Math.min(100, Math.max(0, (hoverSegundos / duracion) * 100))}%` }}
          onMouseEnter={() => fijarHover(hoverSegundos)}
          onMouseLeave={() => fijarHover(null)}
        >
          <span className="clase__barra-tooltip-tiempo">{formatSegundos(hoverSegundos)}</span>
          <button
            type="button"
            className={`clase__barra-tooltip-boton${apunteEnHover ? ' clase__barra-tooltip-boton--ver' : ''}`}
            onClick={() => {
              setHoverSegundos(null);
              onAbrirApunte(apunteEnHover ? apunteEnHover.apunteId : null, hoverSegundos);
            }}
          >
            {apunteEnHover ? (
              <>
                <LapizIcon size={13} />
                {apunteEnHover.titulo}
              </>
            ) : (
              'Nuevo apunte'
            )}
          </button>
        </div>
      )}
    </div>
  );
}
