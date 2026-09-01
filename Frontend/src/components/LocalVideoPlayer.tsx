import { useCallback, useEffect, useRef, useState } from 'react';
import type { Capitulo } from '../api/catalog';
import { YT_STATE } from './YouTubePlayer';
import { PlayerProgressBar, type ApunteBarra } from './PlayerProgressBar';

export interface LocalPlayer {
  getCurrentTime: () => number;
  getDuration: () => number;
  seekTo: (seconds: number) => void;
  playVideo: () => void;
  pauseVideo: () => void;
}

interface LocalVideoPlayerProps {
  src: string;
  startSeconds: number;
  onReady?: (player: LocalPlayer) => void;
  onStateChange?: (state: number) => void;
  onTick?: (seconds: number) => void;
  capitulos?: Capitulo[];
  apuntes?: ApunteBarra[];
  onAbrirApunte?: (apunteId: string | null, seconds: number) => void;
}

export function LocalVideoPlayer({
  src,
  startSeconds,
  onReady,
  onStateChange,
  onTick,
  capitulos,
  apuntes,
  onAbrirApunte,
}: LocalVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const startRef = useRef(startSeconds);
  const onReadyRef = useRef(onReady);
  const onStateChangeRef = useRef(onStateChange);
  const onTickRef = useRef(onTick);

  const [currentSeconds, setCurrentSeconds] = useState(0);
  const [duracion, setDuracion] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  startRef.current = startSeconds;
  onReadyRef.current = onReady;
  onStateChangeRef.current = onStateChange;
  onTickRef.current = onTick;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      if (startRef.current > 0) {
        video.currentTime = Math.min(startRef.current, video.duration || startRef.current);
      }
      setDuracion(video.duration || 0);
      onReadyRef.current?.({
        getCurrentTime: () => video.currentTime,
        getDuration: () => video.duration || 0,
        seekTo: (seconds: number) => {
          video.currentTime = seconds;
        },
        playVideo: () => {
          void video.play();
        },
        pauseVideo: () => {
          video.pause();
        },
      });
    };
    const handlePlay = () => {
      setIsPlaying(true);
      onStateChangeRef.current?.(YT_STATE.PLAYING);
    };
    const handlePause = () => {
      setIsPlaying(false);
      onStateChangeRef.current?.(YT_STATE.PAUSED);
    };
    const handleEnded = () => {
      setIsPlaying(false);
      onStateChangeRef.current?.(YT_STATE.ENDED);
    };
    const handleTimeUpdate = () => {
      const t = video.currentTime;
      setCurrentSeconds(t);
      onTickRef.current?.(t);
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('timeupdate', handleTimeUpdate);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, []);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play();
    } else {
      video.pause();
    }
  }, []);

  const handleSeek = useCallback((seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(seconds, video.duration || seconds));
  }, []);

  return (
    <div className="clase__player-shell">
      <video
        ref={videoRef}
        className="clase__local-video"
        src={src}
        preload="metadata"
        playsInline
        data-testid="local-video-player"
      />
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
