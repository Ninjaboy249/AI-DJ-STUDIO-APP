'use client';
import { useEffect, useRef, useState } from 'react';

interface Props {
  enabled: boolean;
  deckAAvailable: boolean;
  deckBAvailable: boolean;
  onDrop: (selection: 'both' | 'a' | 'b') => Promise<void>;
  onClose?: () => void; // called when user dismisses the cinematic (Back button)
  compact?: boolean;    // compact mode for use inside the waveform header
}

export default function DropTheBeat({ enabled, deckAAvailable, deckBAvailable, onDrop, onClose, compact = false }: Props) {
  const [phase, setPhase] = useState<'idle' | 'countdown' | 'impact' | 'live'>('idle');
  const [choosing, setChoosing] = useState(false);
  const [selection, setSelection] = useState<'both' | 'a' | 'b'>('both');
  const [count, setCount] = useState(3);
  const onDropRef = useRef(onDrop);

  useEffect(() => {
    onDropRef.current = onDrop;
  }, [onDrop]);

  const handleClose = () => {
    setPhase('idle');
    // Cancel any speech still running
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    onClose?.();
  };

  useEffect(() => {
    if (phase !== 'countdown') return;
    if (count === 0) {
      setPhase('impact');
      void onDropRef.current(selection).catch(() => setPhase('idle'));
      if ('speechSynthesis' in window) {
        speechSynthesis.cancel();
        const voice = new SpeechSynthesisUtterance("Welcome to AI DJ Studio. Let's create something unforgettable.");
        voice.rate = 0.92; voice.pitch = 0.86;
        speechSynthesis.speak(voice);
      }
      const done = window.setTimeout(() => setPhase('live'), 1500);
      return () => clearTimeout(done);
    }
    const timer = window.setTimeout(() => setCount(v => v - 1), 900);
    return () => clearTimeout(timer);
  }, [phase, count, selection]);

  const start = (nextSelection: 'both' | 'a' | 'b') => {
    if (!enabled || phase === 'countdown' || phase === 'impact') return;
    setChoosing(false);
    setSelection(nextSelection);
    setCount(3);
    setPhase('countdown');
  };

  return (
    <>
      <button
        className={`drop-beat-btn ${phase}${compact ? ' compact' : ''}`}
        disabled={!enabled}
        onClick={() => setChoosing(true)}
        title={
          compact
            ? enabled
              ? phase === 'live' ? 'Beat is Live!' : phase === 'countdown' ? 'Dropping…' : 'Drop the Beat'
              : 'Load a track first'
            : enabled ? 'Drop the Beat' : 'Load a track first'
        }
      >
        {compact
          ? '⚡'
          : `⚡ ${phase === 'live' ? 'BEAT LIVE' : 'DROP THE BEAT'}`
        }
      </button>

      {choosing && (
        <div className="drop-track-picker" role="dialog" aria-modal="true" aria-labelledby="drop-track-picker-title">
          <div className="drop-track-picker-card">
            <b id="drop-track-picker-title">Which track should play?</b>
            <p>Choose what you want to hear before the beat drops.</p>
            <div className="drop-track-picker-actions">
              <button disabled={!deckAAvailable || !deckBAvailable} onClick={() => start('both')}>Both Tracks</button>
              <button disabled={!deckAAvailable} onClick={() => start('a')}>Play A</button>
              <button disabled={!deckBAvailable} onClick={() => start('b')}>Play B</button>
            </div>
            <button className="drop-track-picker-cancel" onClick={() => setChoosing(false)}>Cancel</button>
          </div>
        </div>
      )}

      {phase !== 'idle' && (
        <div className={`drop-cinematic ${phase}`} aria-live="assertive">
          <div className="drop-blackout" />
          <div className="drop-smoke s1" /><div className="drop-smoke s2" />
          <div className="drop-lightning l1" /><div className="drop-lightning l2" />
          <div className="drop-shockwave" />
          <div className="drop-lasers">
            {Array.from({ length: 9 }, (_, i) => (
              <i key={i} style={{ transform: `rotate(${i * 20 - 80}deg)` }} />
            ))}
          </div>
          {phase === 'countdown' && <div className="drop-count">{count || ''}</div>}
          {(phase === 'impact' || phase === 'live') && (
            <div className="ai-drop-greeting">
              <span>◉</span>
              <div>
                <b>AI DJ ONLINE</b>
                <p>Welcome to AI DJ Studio.<br />Let&apos;s create something unforgettable.</p>
              </div>
            </div>
          )}
          <button className="drop-close" onClick={handleClose}>← BACK TO DJ DECK</button>
        </div>
      )}
    </>
  );
}
