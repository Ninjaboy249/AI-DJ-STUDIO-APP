'use client';
// DeckTutorial — First-visit onboarding overlay for the DJ Deck.
// Shows 10 tooltip steps pointing to real deck controls.
// Stored in localStorage; never shows again once dismissed.

import { useEffect, useState } from 'react';

interface Step {
  id: number;
  title: string;
  body: string;
  icon: string;
  // approximate position hint (for the spotlight ring)
  area: 'waveform' | 'deck-a' | 'deck-b' | 'mixer' | 'library' | 'ai' | 'topnav';
}

const STEPS: Step[] = [
  {
    id: 1,
    icon: '👋',
    title: 'Welcome to AI DJ Studio',
    body: 'This quick tour shows you the 10 key controls of your DJ Deck. Click Next to begin — or Skip to jump straight in.',
    area: 'waveform',
  },
  {
    id: 2,
    icon: '〰',
    title: 'Waveform Display',
    body: 'The coloured waveforms at the top show both tracks. Click anywhere on a waveform to jump to that point in the song. The playhead (vertical line) shows exactly where you are.',
    area: 'waveform',
  },
  {
    id: 3,
    icon: '▶',
    title: 'Play / Pause & CUE',
    body: 'Press Play (▶) to start a deck. Press CUE (⏺) to set a jump-back point — hold it to preview from that point without the crowd hearing, release to snap back. Great for building anticipation before a drop.',
    area: 'deck-a',
  },
  {
    id: 4,
    icon: '⟳',
    title: 'SYNC Button',
    body: 'SYNC locks this deck\'s BPM to the master so both tracks play in perfect time. The pink/cyan ring pulses when sync is active. Turn it off to take manual BPM control.',
    area: 'deck-a',
  },
  {
    id: 5,
    icon: '⚙',
    title: 'Pitch Slider (Tempo)',
    body: 'The pitch slider adjusts tempo ±8%. Drag down = faster, drag up = slower. Use tiny nudges to fine-tune the beat alignment after SYNC.',
    area: 'deck-a',
  },
  {
    id: 6,
    icon: '🎵',
    title: 'EQ Knobs — Hi / Mid / Low',
    body: 'Three knobs shape each frequency band. Pro move: cut the Low (bass) on the incoming track, fade it in, then swap both Lows on the downbeat. Never have both Lows at 100% at the same time — it muddles the mix.',
    area: 'deck-a',
  },
  {
    id: 7,
    icon: '✕',
    title: 'Crossfader',
    body: 'The long slider at the bottom of the mixer blends between Deck A (pink) and Deck B (cyan). Center = equal mix. Slide fully left for only Deck A, fully right for only Deck B.',
    area: 'mixer',
  },
  {
    id: 8,
    icon: '🎚',
    title: 'Channel Faders & Master Volume',
    body: 'Each deck has a vertical volume fader. Keep both at 70–80% for headroom. The Master Volume controls your main output — keep the meter in the yellow zone, never solid red.',
    area: 'mixer',
  },
  {
    id: 9,
    icon: '📂',
    title: 'Music Library',
    body: 'The Library at the bottom shows your tracks with BPM, Key, and Energy. Click 🔬 Analyze on any track to see its waveform, beat grid, and suggested cue points. Click A or B to load it onto a deck.',
    area: 'library',
  },
  {
    id: 10,
    icon: '🤖',
    title: 'AI DJ Copilot',
    body: 'Click the 🤖 AI button on the right to open your AI Copilot. It reads your live BPM, energy, and key — then gives real-time suggestions and explains the music theory behind every recommendation.',
    area: 'ai',
  },
];

const STORAGE_KEY = 'dj-tutorial-done-v1';

interface Props {
  /** Only show when the DJ Deck is the active view */
  active: boolean;
  onNavigate?: (target: Step['area']) => void;
}

export default function DeckTutorial({ active, onNavigate }: Props) {
  const [step, setStep]   = useState(0); // 0 = not started
  const [done, setDone]   = useState(true); // default true until we check localStorage

  useEffect(() => {
    const seen = typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEY);
    if (!seen) setDone(false);
  }, []);

  // Auto-start on first visit when DJ Deck is shown
  useEffect(() => {
    if (active && !done && step === 0) setStep(1);
  }, [active, done, step]);

  const dismiss = () => {
    setDone(true);
    setStep(0);
    localStorage.setItem(STORAGE_KEY, '1');
  };

  const next = () => {
    if (step >= STEPS.length) { dismiss(); return; }
    setStep(s => s + 1);
  };

  const prev = () => setStep(s => Math.max(1, s - 1));

  if (done || step === 0 || !active) return null;

  const current = STEPS[step - 1];
  const isLast  = step === STEPS.length;
  const canNavigate = current.area === 'library' || current.area === 'ai';

  return (
    <div className="tutorial-overlay" role="dialog" aria-modal="true" aria-label="DJ Deck tutorial">
      {/* Dark backdrop */}
      <div className="tutorial-backdrop" onClick={dismiss} />

      {/* Floating card */}
      <div className="tutorial-card">
        {/* Progress dots */}
        <div className="tutorial-dots">
          {STEPS.map((_, i) => (
            <button
              key={i}
              className={`tutorial-dot${step === i + 1 ? ' active' : step > i ? ' done' : ''}`}
              onClick={() => setStep(i + 1)}
              aria-label={`Step ${i + 1}`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="tutorial-icon">{current.icon}</div>
        <div className="tutorial-step-label">Step {step} of {STEPS.length}</div>
        <div className="tutorial-title">{current.title}</div>
        <p className="tutorial-body">{current.body}</p>

        {/* Actions */}
        <div className="tutorial-actions">
          <button className="tutorial-skip" onClick={dismiss}>Skip tour</button>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {canNavigate && (
              <button className="tutorial-nav-btn" onClick={() => onNavigate?.(current.area)}>
                Open {current.area === 'library' ? 'Library' : 'AI Copilot'}
              </button>
            )}
            {step > 1 && (
              <button className="tutorial-nav-btn" onClick={prev}>← Back</button>
            )}
            <button className="tutorial-nav-btn primary" onClick={next}>
              {isLast ? '🎉 Let\'s DJ!' : 'Next →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
