import { useEffect, useRef } from 'react';
import { YT_STATE } from './YouTubePlayer';

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
}

export function LocalVideoPlayer({ src, startSeconds, onReady, onStateChange, onTick }: LocalVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const startRef = useRef(startSeconds);
  const onReadyRef = useRef(onReady);
  const onStateChangeRef = useRef(onStateChange);
  const onTickRef = useRef(onTick);

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
    const handlePlay = () => onStateChangeRef.current?.(YT_STATE.PLAYING);
    const handlePause = () => onStateChangeRef.current?.(YT_STATE.PAUSED);
    const handleEnded = () => onStateChangeRef.current?.(YT_STATE.ENDED);
    const handleTimeUpdate = () => onTickRef.current?.(video.currentTime);

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

  return (
    <video
      ref={videoRef}
      className="clase__local-video"
      src={src}
      controls
      preload="metadata"
      playsInline
      data-testid="local-video-player"
    />
  );
}
