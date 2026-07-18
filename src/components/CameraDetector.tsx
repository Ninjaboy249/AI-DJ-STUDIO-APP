'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Emotion, EmotionReading } from './emotion';

interface Blendshape { categoryName: string; score: number }

const MEDIAPIPE_DIAGNOSTIC = /(?:Created TensorFlow Lite XNNPACK|face_landmarker_graph\.cc|gl_context\.cc|OpenGL error checking is disabled)/i;

function detectWithoutDevOverlay<T>(detect: () => T): T {
  // MediaPipe's Emscripten runtime sends benign native INFO/WARNING output to
  // console.error. Next's development overlay mistakes that output for a thrown
  // application error, so filter only those exact diagnostics during inference.
  const originalError = console.error;
  const originalWarn = console.warn;
  const filter = (original: typeof console.error) => (...args: unknown[]) => {
    const message = args.map(value => typeof value === 'string' ? value : String(value)).join(' ');
    if (!MEDIAPIPE_DIAGNOSTIC.test(message)) original(...args);
  };
  console.error = filter(originalError);
  console.warn = filter(originalWarn);
  try {
    return detect();
  } finally {
    console.error = originalError;
    console.warn = originalWarn;
  }
}

function inferEmotion(categories: Blendshape[]): EmotionReading {
  const scores = new Map(categories.map(item => [item.categoryName, item.score]));
  const get = (name: string) => scores.get(name) ?? 0;
  const smile = (get('mouthSmileLeft') + get('mouthSmileRight')) / 2;
  const frown = (get('mouthFrownLeft') + get('mouthFrownRight')) / 2;
  const browDown = (get('browDownLeft') + get('browDownRight')) / 2;
  const eyeWide = (get('eyeWideLeft') + get('eyeWideRight')) / 2;
  const blink = (get('eyeBlinkLeft') + get('eyeBlinkRight')) / 2;
  const jawOpen = get('jawOpen');
  const browUp = get('browInnerUp');
  let emotion: Emotion = 'relaxed';
  let signal = .48;
  if (smile > .48 && (jawOpen > .24 || eyeWide > .22)) { emotion = 'excited'; signal = Math.max(smile, jawOpen, eyeWide); }
  else if (smile > .32) { emotion = 'happy'; signal = smile; }
  else if (jawOpen > .38 && (eyeWide > .24 || browUp > .28)) { emotion = 'surprised'; signal = Math.max(jawOpen, eyeWide); }
  else if (browDown > .34 && (frown > .2 || jawOpen > .18)) { emotion = 'angry'; signal = Math.max(browDown, frown); }
  else if (frown > .3 || browUp > .42) { emotion = 'sad'; signal = Math.max(frown, browUp); }
  else if (blink > .55) { emotion = 'tired'; signal = blink; }
  const energy = Math.round(Math.min(100, Math.max(12, (smile * .35 + jawOpen * .3 + eyeWide * .2 + browDown * .15) * 125)));
  return { emotion, confidence: Math.round(Math.min(96, 55 + signal * 43)), energy, faceDetected: true };
}

export default function CameraDetector({ enabled, onReading, onStatus }: {
  enabled: boolean;
  onReading: (reading: EmotionReading) => void;
  onStatus: (status: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<{ detectForVideo: (video: HTMLVideoElement, timestamp: number) => { faceBlendshapes?: Array<{ categories: Blendshape[] }> }; close: () => void } | null>(null);
  const frameRef = useRef<number | null>(null);
  const [active, setActive] = useState(false);

  const stop = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    landmarkerRef.current?.close();
    landmarkerRef.current = null;
    setActive(false);
  }, []);

  useEffect(() => {
    if (!enabled) { stop(); return; }
    let cancelled = false;
    const start = async () => {
      try {
        onStatus('Requesting camera permission…');
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
        if (cancelled) { stream.getTracks().forEach(track => track.stop()); return; }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        onStatus('Loading on-device vision model…');
        const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
        const vision = await FilesetResolver.forVisionTasks('/mediapipe');
        const landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: '/mediapipe/face_landmarker.task', delegate: 'GPU' },
          runningMode: 'VIDEO', numFaces: 1, outputFaceBlendshapes: true,
          minFaceDetectionConfidence: .55, minFacePresenceConfidence: .55, minTrackingConfidence: .5,
        });
        if (cancelled) { landmarker.close(); return; }
        landmarkerRef.current = landmarker;
        setActive(true);
        onStatus('Scanning facial expression locally');
        let lastVideoTime = -1;
        let lastUpdate = 0;
        let lastTimestamp = 0;
        let reportedFrameError = false;
        const scan = (now: number) => {
          if (cancelled || !videoRef.current || !landmarkerRef.current) return;
          const currentVideo = videoRef.current;
          if (currentVideo.readyState >= 2 && currentVideo.videoWidth > 0 && currentVideo.videoHeight > 0 && currentVideo.currentTime !== lastVideoTime) {
            lastVideoTime = currentVideo.currentTime;
            const timestamp = Math.max(lastTimestamp + 1, now);
            lastTimestamp = timestamp;
            try {
              const result = detectWithoutDevOverlay(() => landmarkerRef.current!.detectForVideo(currentVideo, timestamp));
              const categories = result.faceBlendshapes?.[0]?.categories;
              reportedFrameError = false;
              if (now - lastUpdate > 220) {
                lastUpdate = now;
                onReading(categories?.length ? inferEmotion(categories) : { emotion: 'relaxed', confidence: 0, energy: 0, faceDetected: false });
              }
            } catch {
              // Camera dimensions and MediaPipe state can briefly become invalid
              // during startup, tab visibility changes, or React cleanup.
              if (!reportedFrameError && !cancelled) {
                reportedFrameError = true;
                onStatus('Vision scanner is stabilizing…');
              }
            }
          }
          frameRef.current = requestAnimationFrame(scan);
        };
        frameRef.current = requestAnimationFrame(scan);
      } catch (error) {
        onStatus(error instanceof Error ? error.message : 'Camera or AI vision could not be started.');
        stop();
      }
    };
    void start();
    return () => { cancelled = true; stop(); };
  }, [enabled, onReading, onStatus, stop]);

  return (
    <div className={`emotion-camera${active ? ' active' : ''}`}>
      <video ref={videoRef} muted playsInline aria-label="Live camera preview" />
      <div className="emotion-scan-line" />
      {!active && <div className="emotion-camera-placeholder"><span>📷</span><small>Live Camera</small></div>}
      <span className="emotion-local-badge">ON-DEVICE</span>
    </div>
  );
}
