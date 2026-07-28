'use client';

import { useEffect, useRef, useState } from 'react';

export default function TutorialPresenter({ show, onDone }: { show: boolean; onDone: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number | null>(null);
  const [ready, setReady] = useState(false);
  const [needsStart, setNeedsStart] = useState(false);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    if (!show) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return;

    const draw = () => {
      if (video.readyState >= 2 && video.videoWidth && video.videoHeight) {
        const maxWidth = 440;
        const scale = Math.min(1, maxWidth / video.videoWidth);
        const width = Math.max(1, Math.round(video.videoWidth * scale));
        const height = Math.max(1, Math.round(video.videoHeight * scale));
        if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
        context.drawImage(video, 0, 0, width, height);
        const frame = context.getImageData(0, 0, width, height);
        const pixels = frame.data;
        for (let i = 0; i < pixels.length; i += 4) {
          const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
          const greenDominance = g - Math.max(r, b);
          if (g > 70 && greenDominance > 22) {
            pixels[i + 3] = Math.max(0, 255 - (greenDominance - 22) * 7);
          } else if (g > r * 1.08 && g > b * 1.08) {
            pixels[i + 1] = Math.round(g * 0.62);
          }
        }
        context.putImageData(frame, 0, 0);
        setReady(true);
      }
      if (!video.ended) frameRef.current = requestAnimationFrame(draw);
    };

    video.muted = muted;
    video.volume = 1;
    void video.play().then(() => setNeedsStart(false)).catch(() => setNeedsStart(true));
    frameRef.current = requestAnimationFrame(draw);
    return () => { if (frameRef.current !== null) cancelAnimationFrame(frameRef.current); video.pause(); };
  }, [show, muted]);

  if (!show) return null;
  return <aside className={`tutorial-presenter${ready ? ' ready' : ''}`} aria-label="Tutorial completion presenter">
    <video ref={videoRef} src="/tutorial-presenter.mp4" playsInline preload="auto" onEnded={onDone} />
    <canvas ref={canvasRef} />
    <div className="tutorial-presenter-caption"><b>YOU’RE READY.</b><span>Welcome to AI DJ Studio</span></div>
    {needsStart && <button className="tutorial-presenter-sound" onClick={() => {
      const video = videoRef.current;
      if (!video) return;
      video.muted = false;
      video.volume = 1;
      void video.play().then(() => setNeedsStart(false));
    }}>▶ PLAY WITH SOUND</button>}
    <button className="tutorial-presenter-audio" onClick={() => {
      const next = !muted;
      setMuted(next);
      if (videoRef.current) videoRef.current.muted = next;
    }} aria-label={muted ? 'Enable video sound' : 'Disable video sound'} title={muted ? 'Sound off' : 'Sound on'}>
      {muted ? '🔇' : '🔊'}
    </button>
    <button className="tutorial-presenter-close" onClick={onDone} aria-label="Close presenter">×</button>
  </aside>;
}
