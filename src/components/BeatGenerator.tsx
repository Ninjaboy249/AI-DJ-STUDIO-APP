'use client';
// BeatGenerator — AI beat generation panel.
//
// The user types a prompt ("cyberpunk intro", "lofi chill", etc.).
// Groq returns a structured BeatSpec (bpm, drum patterns, bass notes, synth melody).
// The BeatPlayer synthesises the spec in real time with the Web Audio API.
// A 16-step grid shows the active pattern; the current step is highlighted live.

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { generateBeat } from '../lib/api';
import type { BeatSpec } from '../lib/granite';
import { BeatPlayer } from '../lib/beatsynth-tone';
import { initAudio } from '../lib/audio';

// ── Preset prompts ────────────────────────────────────────────────────────────
const PRESETS = [
  'Cyberpunk intro',
  'Dark techno drop',
  'Lofi hip-hop chill',
  'Festival crowd builder',
  'Acid house bassline',
  'Drum and bass break',
];

// ── Drum row labels ───────────────────────────────────────────────────────────
type DrumKey = 'kick' | 'snare' | 'hihat' | 'openhat' | 'clap';
const DRUM_ROWS: { key: DrumKey; label: string; color: string }[] = [
  { key: 'kick',    label: 'KICK',     color: '#ff8c00' },
  { key: 'snare',   label: 'SNARE',    color: '#ff6020' },
  { key: 'hihat',   label: 'HI-HAT',  color: '#ffcc00' },
  { key: 'openhat', label: 'OPEN HAT',color: '#ffa040' },
  { key: 'clap',    label: 'CLAP',     color: '#ff4080' },
];

// ── Step grid ─────────────────────────────────────────────────────────────────
function StepGrid({
  label, color, steps, activeStep,
}: {
  label: string;
  color: string;
  steps: { on: boolean; vel: number }[];
  activeStep: number;
}) {
  return (
    <div className="beat-row">
      <span className="beat-row-label">{label}</span>
      <div className="beat-steps">
        {steps.map((s, i) => (
          <div
            key={i}
            className={[
              'beat-step',
              s.on ? 'beat-step-on' : '',
              i === activeStep ? 'beat-step-active' : '',
              i % 4 === 0 ? 'beat-step-bar' : '',
            ].filter(Boolean).join(' ')}
            style={s.on ? { '--step-color': color } as React.CSSProperties : undefined}
          />
        ))}
      </div>
    </div>
  );
}

// ── Note row (bass / synth) ───────────────────────────────────────────────────
const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
function noteName(midi: number): string {
  if (midi === 0) return '·';
  return NOTE_NAMES[midi % 12] + Math.floor(midi / 12 - 1);
}

function NoteGrid({
  label, color, notes, activeStep,
}: {
  label: string;
  color: string;
  notes: number[];
  activeStep: number;
}) {
  return (
    <div className="beat-row">
      <span className="beat-row-label">{label}</span>
      <div className="beat-steps">
        {notes.map((n, i) => (
          <div
            key={i}
            className={[
              'beat-step beat-step-note',
              n > 0 ? 'beat-step-on' : '',
              i === activeStep ? 'beat-step-active' : '',
              i % 4 === 0 ? 'beat-step-bar' : '',
            ].filter(Boolean).join(' ')}
            style={n > 0 ? { '--step-color': color } as React.CSSProperties : undefined}
          >
            {n > 0 ? <span className="beat-note-name">{noteName(n)}</span> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function BeatGenerator({ isOpen, onClose }: Props) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [spec, setSpec] = useState<BeatSpec | null>(null);
  const [playing, setPlaying] = useState(false);
  const [activeStep, setActiveStep] = useState(-1);

  const playerRef = useRef<BeatPlayer | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 50);
  }, [isOpen]);

  // Stop and clean up when panel closes
  useEffect(() => {
    if (!isOpen) {
      playerRef.current?.stop();
      setPlaying(false);
      setActiveStep(-1);
    }
  }, [isOpen]);

  const generate = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setPrompt(trimmed);
    setLoading(true);
    setError(null);

    // Stop any playing beat first
    playerRef.current?.stop();
    setPlaying(false);
    setActiveStep(-1);

    try {
      const newSpec = await generateBeat(trimmed);
      setSpec(newSpec);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [loading]);

  const togglePlay = useCallback(async () => {
    if (!spec) return;

    if (playerRef.current?.isPlaying()) {
      playerRef.current.stop();
      setPlaying(false);
      setActiveStep(-1);
      return;
    }

    // Boot AudioContext on first gesture
    const rt = await initAudio();
    const player = new BeatPlayer(rt.ctx, spec);
    player.onStep = (step) => setActiveStep(step);
    playerRef.current = player;
    player.start();
    setPlaying(true);
  }, [spec]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') generate(prompt);
  };

  return (
    <AnimatePresence>
    {isOpen && (
    <motion.div
      className="beat-panel open"
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >

      {/* ── Header ── */}
      <div className="beat-header">
        <div className="beat-header-title">
          <span>🥁</span>
          <span>AI Beat Generator</span>
        </div>
        <button className="ai-close-btn" onClick={onClose} title="Close">✕</button>
      </div>

      {/* ── Prompt bar ── */}
      <div className="beat-prompt-bar">
        <input
          ref={inputRef}
          className="beat-prompt-input"
          type="text"
          placeholder="Describe your beat… e.g. cyberpunk intro"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={loading}
        />
        <button
          className="beat-generate-btn"
          onClick={() => generate(prompt)}
          disabled={loading || !prompt.trim()}
        >
          {loading ? '⏳' : '✦ Generate'}
        </button>
      </div>

      {/* ── Preset chips ── */}
      <div className="beat-presets">
        {PRESETS.map((p) => (
          <button key={p} className="beat-preset" onClick={() => { setPrompt(p); generate(p); }}>
            {p}
          </button>
        ))}
      </div>

      {/* ── Error ── */}
      {error && <p className="beat-error">{error}</p>}

      {/* ── Spec info + playback ── */}
      {spec && !loading && (
        <>
          <div className="beat-info-bar">
            <span className="beat-info-genre">{spec.genre.toUpperCase()}</span>
            <span className="beat-info-mood">{spec.mood}</span>
            <span className="beat-info-bpm">{spec.bpm} BPM</span>
            <button
              className={`beat-play-btn${playing ? ' playing' : ''}`}
              onClick={togglePlay}
            >
              {playing ? '◼ Stop' : '▶ Play'}
            </button>
          </div>

          <p className="beat-description">{spec.description}</p>

          {/* ── Step sequencer grid ── */}
          <div className="beat-grid">
            {/* Bar numbers */}
            <div className="beat-row beat-row-ruler">
              <span className="beat-row-label" />
              <div className="beat-steps">
                {Array.from({ length: 16 }, (_, i) => (
                  <div key={i} className={`beat-step beat-step-ruler${i % 4 === 0 ? ' beat-step-bar' : ''}`}>
                    {i % 4 === 0 ? <span>{i / 4 + 1}</span> : null}
                  </div>
                ))}
              </div>
            </div>

            {/* Drums */}
            {DRUM_ROWS.map((row) => (
              <StepGrid
                key={row.key}
                label={row.label}
                color={row.color}
                steps={spec.drums[row.key]}
                activeStep={activeStep}
              />
            ))}

            {/* Bass */}
            <NoteGrid
              label="BASS"
              color="#40aaff"
              notes={spec.bass.notes}
              activeStep={activeStep}
            />

            {/* Synth */}
            <NoteGrid
              label={`SYNTH (${spec.synth.wave})`}
              color="#c060ff"
              notes={spec.synth.notes}
              activeStep={activeStep}
            />
          </div>

          {/* ── FX meters ── */}
          <div className="beat-fx-row">
            <div className="beat-fx">
              <span className="beat-fx-label">REVERB</span>
              <div className="beat-fx-bar"><div className="beat-fx-fill" style={{ width: `${spec.fx.reverb * 100}%` }} /></div>
            </div>
            <div className="beat-fx">
              <span className="beat-fx-label">DELAY</span>
              <div className="beat-fx-bar"><div className="beat-fx-fill" style={{ width: `${spec.fx.delay * 100}%` }} /></div>
            </div>
            <div className="beat-fx">
              <span className="beat-fx-label">DIST</span>
              <div className="beat-fx-bar"><div className="beat-fx-fill beat-fx-fill-dist" style={{ width: `${spec.fx.distortion * 100}%` }} /></div>
            </div>
          </div>
        </>
      )}

      {/* ── Loading shimmer ── */}
      {loading && (
        <div className="beat-loading">
          <div className="beat-thinking"><span /><span /><span /><span /></div>
          <p>Composing your beat…</p>
        </div>
      )}

    </motion.div>
    )}
    </AnimatePresence>
  );
}
