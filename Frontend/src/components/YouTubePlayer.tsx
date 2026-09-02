import { useCallback, useEffect, useRef, useState } from 'react';
import type { Capitulo } from '../api/catalog';
import { PlayerProgressBar, type ApunteBarra } from './PlayerProgressBar';

export const YT_STATE = {
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
} as const;

interface YTPlayerOptions {
  videoId: string;
  playerVars?: Record<string, unknown>;
  events: {
    onReady?: (event: { target: YTPlayer }) => void;
    onStateChange?: (event: { data: number; target: YTPlayer }) => void;
    onError?: (event: { data: number }) => void;
  };
}

export interface YTPlayer {
  getCurrentTime: () => number;
  getDuration: () => number;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  destroy: () => void;
}

declare global {
  interface Window {
    YT?: {
      Player: new (element: HTMLElement, options: YTPlayerOptions) => YTPlayer;
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

function loadYouTubeApi(): Promise<void> {
  return new Promise((resolve) => {
    if (window.YT?.Player) {
      resolve();
      return;
    }
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
  });
}

interface YouTubePlayerProps {
  videoId: string;
  startSeconds: number;
  onReady?: (player: YTPlayer) => void;
  onStateChange?: (state: number) => void;
  onTick?: (seconds: number) => void;
  capitulos?: Capitulo[];
  apuntes?: ApunteBarra[];
  onAbrirApunte?: (apunteId: string | null, seconds: number) => void;
}

export function YouTubePlayer({
  videoId,
  startSeconds,
  onReady,
  onStateChange,
  onTick,
  capitulos,
  apuntes,
  onAbrirApunte,
}: YouTubePlayerProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const startRef = useRef(startSeconds);
  const onReadyRef = useRef(onReady);
  const onStateChangeRef = useRef(onStateChange);
  const onTickRef = useRef(onTick);
  const tickRef = useRef<number | null>(null);

  const [currentSeconds, setCurrentSeconds] = useState(0);
  const [duracion, setDuracion] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  startRef.current = startSeconds;
  onReadyRef.current = onReady;
  onStateChangeRef.current = onStateChange;
  onTickRef.current = onTick;

  useEffect(() => {
    let cancelled = false;
    let player: YTPlayer | null = null;

    loadYouTubeApi().then(() => {
      if (cancelled || !hostRef.current) return;
      player = new window.YT!.Player(hostRef.current, {
        videoId,
        playerVars: {
          start: Math.max(0, Math.floor(startRef.current)),
          rel: 0,
          playsinline: 1,
          controls: 0,
        },
        events: {
          onReady: (event) => {
            playerRef.current = event.target;
            setDuracion(event.target.getDuration() || 0);
            setCurrentSeconds(event.target.getCurrentTime());
            onReadyRef.current?.(event.target);
          },
          onStateChange: (event) => {
            const state = event.data;
            if (state === YT_STATE.PLAYING) {
              setIsPlaying(true);
              tickRef.current = window.setInterval(() => {
                const t = playerRef.current?.getCurrentTime() ?? 0;
                setCurrentSeconds(t);
                onTickRef.current?.(t);
              }, 1000);
            } else if (state === YT_STATE.PAUSED || state === YT_STATE.ENDED) {
              setIsPlaying(false);
              if (tickRef.current !== null) {
                window.clearInterval(tickRef.current);
                tickRef.current = null;
              }
            }
            onStateChangeRef.current?.(state);
          },
          onError: () => {
          },
        },
      });
    });

    return () => {
      cancelled = true;
      if (tickRef.current !== null) {
        window.clearInterval(tickRef.current);
        tickRef.current = null;
      }
      playerRef.current = null;
      player?.destroy();
    };
  }, [videoId]);

  const togglePlay = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    if (isPlaying) {
      player.pauseVideo();
    } else {
      player.playVideo();
    }
  }, [isPlaying]);

  const handleSeek = useCallback((seconds: number) => {
    playerRef.current?.seekTo(Math.max(0, Math.floor(seconds)), true);
  }, []);

  return (
    <div className="clase__player-shell">
      <div ref={hostRef} className="clase__youtube-host" data-testid="youtube-player" />
      <PlayerProgressBar
        currentSeconds={currentSeconds}
        duracion={duracion}
        isPlaying={isPlaying}
        onTogglePlay={togglePlay}
        onSeek={handleSeek}
        capitulos={capitulos}
        apuntes={apuntes}
        onAbrirApunte={onAbrirApunte}
      />
    </div>
  );
}
