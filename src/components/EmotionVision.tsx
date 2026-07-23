'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import CameraDetector from './CameraDetector';
import EmotionHUD from './EmotionHUD';
import { MOOD_PROFILES, type EmotionReading } from './emotion';
import type { UseDeck } from '@/lib/useDeck';

const INITIAL: EmotionReading = { emotion: 'relaxed', confidence: 0, energy: 0, faceDetected: false };

export default function EmotionVision({ deckA, deckB, ensureAudio }: { deckA: UseDeck; deckB: UseDeck; ensureAudio: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [voice, setVoice] = useState(false);
  const [reading, setReading] = useState(INITIAL);
  const [status, setStatus] = useState('Camera disabled');
  const previousEmotion = useRef(reading.emotion);
  const onReading = useCallback((next: EmotionReading) => setReading(next), []);
  const onStatus = useCallback((next: string) => setStatus(next), []);

  useEffect(() => {
    if (!voice || !reading.faceDetected || previousEmotion.current === reading.emotion) return;
    previousEmotion.current = reading.emotion;
    speechSynthesis.cancel();
    speechSynthesis.speak(new SpeechSynthesisUtterance(MOOD_PROFILES[reading.emotion].voice));
  }, [reading, voice]);

  return (
    <>
      <button className="emotion-floating-launcher" onClick={() => setOpen(value => !value)} aria-label="Open AI Emotion Detection" title="AI Emotion Detection"><span>◉</span><small>MOOD AI</small></button>
      {open && <aside className="emotion-vision-panel" aria-label="AI Vision Scanner">
        <header><div><span>AI VISION SCANNER</span><small>{status}</small></div><button onClick={() => setOpen(false)} aria-label="Close emotion scanner">×</button></header>
        <CameraDetector enabled={enabled} onReading={onReading} onStatus={onStatus} />
        <EmotionHUD reading={reading} status={status} deckA={deckA} deckB={deckB} ensureAudio={ensureAudio} />
        <footer>
          <button className={enabled ? 'active' : ''} onClick={() => setEnabled(value => !value)}>{enabled ? 'DISABLE CAMERA' : 'ENABLE CAMERA'}</button>
          <button className={voice ? 'active' : ''} onClick={() => setVoice(value => !value)}>VOICE {voice ? 'ON' : 'OFF'}</button>
        </footer>
        <p className="emotion-privacy">Frames remain on this device. Mood is an entertainment-oriented expression estimate.</p>
      </aside>}
    </>
  );
}
