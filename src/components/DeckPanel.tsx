'use client';
// DeckPanel — cyberpunk turntable deck with vinyl platter, FX buttons, hot cues.

import { useRef, useState } from 'react';
import type { UseDeck } from '@/lib/useDeck';

interface Props {
  deck: UseDeck;
  label: string;
  deckClass: 'deck-a' | 'deck-b';
  ensureAudio: () => Promise<void>;
}

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function tempoLabel(v: number): string {
  const pct = Math.round((v - 1) * 100);
  if (pct === 0) return '0%';
  return pct > 0 ? `+${pct}%` : `${pct}%`;
}

const FX_BUTTONS = ['FX', 'ECHO', 'REVERB', 'FILTER', 'LOOP'];

export default function DeckPanel({ deck, label, deckClass, ensureAudio }: Props) {
  const [loading, setLoading] = useState(false);
  const [activeFx, setActiveFx] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isA = deckClass === 'deck-a';
  const { track } = deck.state;

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setLoading(true);
    try {
      await ensureAudio();
      await deck.load(file);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const remaining = track
    ? fmt((1 - deck.position) * (track.duration ?? 0))
    : '0:00';

  const bpm = Math.round(deck.state.tempo * 128);

  return (
    <div className={`deck-panel ${deckClass}`}>
      {/* Top transport row */}
      <div className="deck-top-row">
        <button
          className="deck-settings-btn"
          onClick={() => fileInputRef.current?.click()}
          style={{ marginLeft: 0, marginRight: 4 }}
          title="Load track"
        >
          ⚙
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,.wav,.mp3,.flac,.aiff,.aif"
          onChange={onPickFile}
          hidden
        />

        <div className="deck-transport-group">
          <button
            className="btn-cue"
            disabled={!track}
            onClick={() => {
              if (!deck.state.playing) deck.setCue(deck.position);
              else deck.jumpCue();
            }}
          >
            CUE
          </button>
          <button
            className="btn-pause"
            disabled={!track || loading}
            onClick={deck.togglePlay}
            title={deck.state.playing ? 'Pause' : 'Play'}
          >
            {deck.state.playing ? '⏸' : '▶'}
          </button>
          <button
            className={`btn-sync${isA ? '' : ' deck-b'}${deck.state.playing ? ' active' : ''}`}
            disabled={!track}
          >
            SYNC
          </button>
        </div>

        <span className="deck-settings-btn" style={{ marginLeft: 'auto', cursor: 'default', fontSize: '0.7rem', color: 'var(--muted)' }}>
          {loading ? 'Loading…' : track ? track.name.substring(0, 14) : 'No track'}
        </span>
      </div>

      {/* Main area: FX col + turntable + pitch slider */}
      <div className="deck-main">
        {/* FX buttons left column */}
        <div className="fx-col">
          {FX_BUTTONS.map(fx => (
            <button
              key={fx}
              className={`btn-fx${activeFx === fx ? ' active' : ''}`}
              onClick={() => setActiveFx(v => v === fx ? null : fx)}
            >
              {fx}
            </button>
          ))}
        </div>

        {/* Vinyl platter */}
        <div className="turntable">
          <div className={`turntable-ring ${deckClass}${deck.state.playing ? ' playing' : ''}`}>
            <div className="turntable-grooves" />
            <div className="turntable-label">
              <div className="turntable-bpm">
                {bpm}.0
                <div className="turntable-bpm-unit">BPM</div>
              </div>
              <div className="turntable-time">
                {track ? `00:${fmt(deck.position * (track.duration ?? 0))}` : '00:00:00'}
              </div>
              <div className="turntable-remain">REMAIN</div>
            </div>
            {/* Tonearm SVG */}
            <svg className="turntable-tonearm" viewBox="0 0 60 80" fill="none">
              <line x1="50" y1="8" x2="12" y2="65" stroke="#888" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="50" cy="8" r="5" fill="#555" stroke="#777" strokeWidth="1" />
              <circle cx="12" cy="65" r="3" fill="#aaa" />
            </svg>
          </div>
        </div>

        {/* Pitch fader right column */}
        <div className="pitch-col">
          <span className="pitch-label">PITCH</span>
          <input
            className={`pitch-slider${isA ? '' : ' deck-b'}`}
            type="range"
            min={0.5}
            max={2.0}
            step={0.01}
            value={deck.state.tempo}
            onChange={e => deck.setTempo(parseFloat(e.target.value))}
            onDoubleClick={() => deck.setTempo(1.0)}
            title="Double-click to reset"
          />
          <span className="pitch-value">{tempoLabel(deck.state.tempo)}</span>
        </div>
      </div>

      {/* Bottom: loop controls + hot cue pads */}
      <div className="deck-bottom">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="loop-buttons">
            <button
              className="btn-loop"
              disabled={!track}
              onClick={() => deck.setLoopIn(deck.position)}
            >
              IN
            </button>
            <button
              className="btn-loop"
              disabled={!track}
              onClick={() => deck.setLoopOut(deck.position)}
            >
              OUT
            </button>
            <button className="btn-loop" disabled={!track} style={{ minWidth: 55 }}>
              4 BEAT ▾
            </button>
            <button
              className={`btn-loop${deck.state.looping ? ' active' : ''}`}
              disabled={!track || deck.state.loopIn >= deck.state.loopOut}
              onClick={deck.toggleLoop}
            >
              LOOP
            </button>
          </div>
          <span className="hot-cue-label">HOT CUE</span>
        </div>

        <div className="hot-cue-pads">
          {[1,2,3,4,5,6,7,8].map(n => (
            <div
              key={n}
              className={`hot-cue-pad${n === 1 && deck.state.cueNorm > 0 ? ' active' : ''}`}
              onClick={() => {
                if (n === 1) {
                  if (!deck.state.playing) deck.setCue(deck.position);
                  else deck.jumpCue();
                }
              }}
            >
              {n}
            </div>
          ))}
        </div>
      </div>

      {error && <p className="error-msg">{error}</p>}
    </div>
  );
}
