'use client';
// GranitePanel — AI DJ assistant chat panel (Groq / Llama 3.3).
//
// UI matches the mockup:
//   🎤 Ask AI DJ          [✕]
//   ─────────────────────
//   > Make this mix smoother        ← user bubble
//   AI:
//   ✓ Added echo
//   ✓ Raised BPM to 126
//   ✓ Matched key
//   ✓ Created transition
//   ─────────────────────
//   [input]         [Send]

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { askGranite, recommendNextTrack, generateFx } from '../lib/api';
import type { GraniteAction, GraniteResponse, DeckId, TrackRecommendation, TrackFeatures, FxSpec, FxEvent } from '../lib/granite';
import { triggerFxSpec } from '../lib/fxengine';
import type { ActiveFx } from '../lib/fxengine';
import { initAudio } from '../lib/audio';
import type { UseDeck } from '../lib/useDeck';

interface Props {
  deckA: UseDeck;
  deckB: UseDeck;
  crossfader: number;
  setCrossfader: (v: number) => void;
  masterVolume: number;
  setMasterVolume: (v: number) => void;
  isOpen: boolean;
  onClose: () => void;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  actions?: GraniteAction[];
  error?: boolean;
}

const SUGGESTIONS = [
  'Make this mix smoother',
  'Increase the energy',
  'Create a festival drop',
  'Crossfade to Deck B',
  'Make it chill — drop the highs',
  'What can you control?',
];

// ── FX preset prompts ─────────────────────────────────────────────────────────
const FX_PRESETS = [
  'Make the next transition explosive',
  'Build up the energy',
  'Create a drop',
  'Stutter break',
  'Chill reverb wash',
  'Delay echo cascade',
];

// ── FX effect metadata for display ───────────────────────────────────────────
const FX_META: Record<FxEvent['effect'], { label: string; color: string; icon: string }> = {
  filterSweep: { label: 'Filter Sweep', color: '#ff8c00', icon: '⌁' },
  echo:        { label: 'Echo',         color: '#ffaa44', icon: '◎' },
  reverb:      { label: 'Reverb',       color: '#cc60ff', icon: '≋' },
  whiteNoise:  { label: 'White Noise',  color: '#e0e0e0', icon: '∿' },
  bassBoost:   { label: 'Bass Boost',   color: '#ff4400', icon: '↓' },
  delay:       { label: 'Delay',        color: '#44aaff', icon: '↩' },
  stutter:     { label: 'Stutter',      color: '#ff2266', icon: '▌' },
};

// ── FX Timeline — displays the generated effect sequence ─────────────────────
function FxTimeline({
  spec, activeFx, now,
}: { spec: FxSpec; activeFx: ActiveFx | null; now: number }) {
  const totalDur = spec.totalDuration || 8;
  // How far through the sequence are we (0–1)?
  const progress = activeFx
    ? Math.min(1, (now - activeFx.triggeredAt) / totalDur)
    : 0;

  return (
    <div className="fx-timeline">
      <div className="fx-timeline-header">
        <span className="fx-timeline-label">{spec.label}</span>
        <span className="fx-timeline-dur">{totalDur}s</span>
      </div>
      <p className="fx-timeline-desc">{spec.description}</p>

      {/* Progress bar */}
      {activeFx && (
        <div className="fx-progress-track">
          <div className="fx-progress-fill" style={{ width: `${progress * 100}%` }} />
        </div>
      )}

      {/* Event lanes */}
      <div className="fx-lanes">
        {spec.events.map((ev, i) => {
          const meta = FX_META[ev.effect];
          const left = (ev.start / totalDur) * 100;
          const width = Math.max(4, (ev.duration / totalDur) * 100);
          return (
            <div key={i} className="fx-lane">
              <span className="fx-lane-label">
                <span className="fx-lane-icon">{meta.icon}</span>
                {meta.label}
              </span>
              <div className="fx-lane-track">
                <div
                  className="fx-lane-block"
                  style={{
                    left: `${left}%`,
                    width: `${width}%`,
                    background: meta.color,
                    boxShadow: `0 0 6px ${meta.color}88`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Recommendation card ──────────────────────────────────────────────────────

const MATCH_ICON: Record<string, string> = {
  good: '✓',
  caution: '~',
  neutral: '·',
};

function RecommendationCard({
  rec, onDismiss,
}: { rec: TrackRecommendation; onDismiss: () => void }) {
  return (
    <div className="rec-card">
      <div className="rec-card-header">
        <span className="rec-card-title">🎵 Next track recommendation</span>
        <button className="rec-dismiss" onClick={onDismiss} title="Dismiss">✕</button>
      </div>

      <p className="rec-summary">{rec.summary}</p>

      <div className="rec-features">
        {rec.features.map((f) => (
          <div key={f.label} className={`rec-feature rec-feature-${f.match}`}>
            <span className="rec-feature-icon">{MATCH_ICON[f.match]}</span>
            <span className="rec-feature-label">{f.label}</span>
            <span className="rec-feature-value">{f.value}</span>
          </div>
        ))}
      </div>

      <div className="rec-details">
        <div className="rec-detail">
          <span className="rec-detail-label">Why it works</span>
          <span className="rec-detail-text">{rec.why}</span>
        </div>
        <div className="rec-detail">
          <span className="rec-detail-label">Transition</span>
          <span className="rec-detail-text">{rec.suggestedTransition}</span>
        </div>
        <div className="rec-detail">
          <span className="rec-detail-label">Tempo</span>
          <span className="rec-detail-text">{rec.tempoAdvice}</span>
        </div>
        <div className="rec-detail">
          <span className="rec-detail-label">EQ prep</span>
          <span className="rec-detail-text">{rec.eqAdvice}</span>
        </div>
      </div>
    </div>
  );
}

function actionLabel(action: GraniteAction): string {
  switch (action.action) {
    case 'play':            return `Playing Deck ${action.deck}`;
    case 'pause':           return `Paused Deck ${action.deck}`;
    case 'setTempo': {
      const pct = Math.round((action.value - 1) * 100);
      return `${pct >= 0 ? 'Raised' : 'Lowered'} tempo on Deck ${action.deck} to ${action.value === 1 ? 'normal' : `${pct > 0 ? '+' : ''}${pct}%`}`;
    }
    case 'setVolume':       return `Set Deck ${action.deck} volume to ${Math.round(action.value * 100)}%`;
    case 'setEq': {
      const band = action.band === 'eqLow' ? 'bass' : action.band === 'eqMid' ? 'mids' : 'highs';
      return `${action.value >= 0 ? 'Boosted' : 'Cut'} ${band} on Deck ${action.deck} by ${Math.abs(action.value)}dB`;
    }
    case 'setFilter': {
      if (Math.abs(action.value) < 0.02) return `Removed filter on Deck ${action.deck}`;
      return action.value < 0
        ? `Applied low-pass filter on Deck ${action.deck}`
        : `Applied high-pass filter on Deck ${action.deck}`;
    }
    case 'setCrossfader': {
      if (Math.abs(action.value) < 0.05) return 'Centered the crossfader';
      return action.value < 0
        ? `Moved crossfader toward Deck A`
        : `Moved crossfader toward Deck B`;
    }
    case 'setMasterVolume': return `Set master volume to ${Math.round(action.value * 100)}%`;
    case 'setLoopIn':       return `Marked loop in on Deck ${action.deck}`;
    case 'setLoopOut':      return `Marked loop out on Deck ${action.deck}`;
    case 'toggleLoop':      return `Toggled loop on Deck ${action.deck}`;
    case 'jumpCue':         return `Jumped to cue on Deck ${action.deck}`;
    case 'seek':            return `Seeked Deck ${action.deck} to ${Math.round(action.norm * 100)}%`;
  }
}

function applyAction(
  action: GraniteAction,
  deckA: UseDeck,
  deckB: UseDeck,
  setCrossfader: (v: number) => void,
  setMasterVolume: (v: number) => void,
) {
  const deck = (id: DeckId) => (id === 'A' ? deckA : deckB);
  switch (action.action) {
    case 'play':            deck(action.deck).togglePlay(); break;
    case 'pause':           deck(action.deck).togglePlay(); break;
    case 'setTempo':        deck(action.deck).setTempo(action.value); break;
    case 'setVolume':       deck(action.deck).setVolume(action.value); break;
    case 'setEq':           deck(action.deck).setEq(action.band, action.value); break;
    case 'setFilter':       deck(action.deck).setFilter(action.value); break;
    case 'setCrossfader':   setCrossfader(action.value); break;
    case 'setMasterVolume': setMasterVolume(action.value); break;
    case 'setLoopIn':       deck(action.deck).setLoopIn(deck(action.deck).position); break;
    case 'setLoopOut':      deck(action.deck).setLoopOut(deck(action.deck).position); break;
    case 'toggleLoop':      deck(action.deck).toggleLoop(); break;
    case 'jumpCue':         deck(action.deck).jumpCue(); break;
    case 'seek':            deck(action.deck).seek(action.norm); break;
  }
}

export default function GranitePanel({
  deckA, deckB, setCrossfader, setMasterVolume, isOpen, onClose,
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [recommendation, setRecommendation] = useState<TrackRecommendation | null>(null);
  const [recLoading, setRecLoading] = useState(false);
  // FX state
  const [fxPrompt, setFxPrompt] = useState('');
  const [fxSpec, setFxSpec] = useState<FxSpec | null>(null);
  const [fxLoading, setFxLoading] = useState(false);
  const [fxError, setFxError] = useState<string | null>(null);
  const [activeFx, setActiveFx] = useState<ActiveFx | null>(null);
  const [fxNow, setFxNow] = useState(0);
  const fxTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 50);
  }, [isOpen]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;
      setInput('');
      setMessages((prev) => [...prev, { role: 'user', content: trimmed }]);
      setLoading(true);

      const history = messages
        .filter((m) => !m.error)
        .map((m) => ({ role: m.role, content: m.content }));

      try {
        const resp: GraniteResponse = await askGranite(trimmed, history);
        for (const action of resp.actions) {
          applyAction(action, deckA, deckB, setCrossfader, setMasterVolume);
        }
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: resp.message, actions: resp.actions },
        ]);
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: String(err), error: true },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [loading, messages, deckA, deckB, setCrossfader, setMasterVolume],
  );

  const requestRecommendation = useCallback(async () => {
    const trackA = deckA.state.track;
    const trackB = deckB.state.track;
    if (!trackA) return;

    setRecLoading(true);
    setRecommendation(null);
    try {
      const current: TrackFeatures = { name: trackA.name, duration: trackA.duration, analysis: trackA.analysis };
      const other: TrackFeatures | undefined = trackB
        ? { name: trackB.name, duration: trackB.duration, analysis: trackB.analysis }
        : undefined;
      const rec = await recommendNextTrack(current, other);
      setRecommendation(rec);
      // Apply any immediate actions the model suggests
      for (const action of rec.actions ?? []) {
        applyAction(action, deckA, deckB, setCrossfader, setMasterVolume);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Recommendation failed: ${String(err)}`, error: true },
      ]);
    } finally {
      setRecLoading(false);
    }
  }, [deckA, deckB, setCrossfader, setMasterVolume]);

  // ── FX trigger ─────────────────────────────────────────────────────────────
  const triggerFx = useCallback(async (prompt: string) => {
    const trimmed = prompt.trim();
    if (!trimmed || fxLoading) return;

    setFxLoading(true);
    setFxError(null);
    setFxSpec(null);
    setActiveFx(null);

    // Clear any running progress ticker
    if (fxTimerRef.current) {
      clearInterval(fxTimerRef.current);
      fxTimerRef.current = null;
    }

    try {
      const spec = await generateFx(trimmed);
      setFxSpec(spec);

      const { ctx } = await initAudio();
      const active = triggerFxSpec(ctx, spec);
      setActiveFx(active);
      setFxNow(ctx.currentTime);

      // Tick progress every 100ms until the effect ends
      fxTimerRef.current = setInterval(() => {
        const now = ctx.currentTime;
        setFxNow(now);
        if (now >= active.endsAt) {
          clearInterval(fxTimerRef.current!);
          fxTimerRef.current = null;
          setActiveFx(null);
        }
      }, 100);
    } catch (err) {
      setFxError(String(err));
    } finally {
      setFxLoading(false);
    }
  }, [fxLoading]);

  // Clean up ticker on unmount
  useEffect(() => {
    return () => {
      if (fxTimerRef.current) clearInterval(fxTimerRef.current);
    };
  }, []);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); }
  };

  const hasTrack = !!deckA.state.track || !!deckB.state.track;

  return (
    <AnimatePresence>
    {isOpen && (
    <motion.aside
      className="ai-panel open"
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 32 }}
    >

      {/* ── Header ── */}
      <div className="ai-panel-header">
        <div className="ai-panel-title">
          <span className="ai-panel-icon">🎤</span>
          <span>Ask AI DJ</span>
        </div>
        <button className="ai-close-btn" onClick={onClose} title="Close">✕</button>
      </div>

      {/* ── Recommendation button + card ── */}
      <div className="rec-bar">
        <button
          className="rec-btn"
          disabled={!hasTrack || recLoading}
          onClick={requestRecommendation}
        >
          {recLoading ? '⏳ Analysing…' : '🎵 Recommend next track'}
        </button>
      </div>
      {recommendation && (
        <RecommendationCard rec={recommendation} onDismiss={() => setRecommendation(null)} />
      )}

      {/* ── AI Effects Generator ── */}
      <div className="fx-section">
        <div className="fx-section-header">
          <span className="fx-section-title">⚡ AI FX</span>
        </div>
        <div className="fx-preset-chips">
          {FX_PRESETS.map((p) => (
            <button
              key={p}
              className="fx-preset-chip"
              disabled={fxLoading}
              onClick={() => { setFxPrompt(p); triggerFx(p); }}
            >
              {p}
            </button>
          ))}
        </div>
        <div className="fx-input-row">
          <input
            className="fx-input"
            placeholder="Describe an effect…"
            value={fxPrompt}
            onChange={(e) => setFxPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') triggerFx(fxPrompt); }}
            disabled={fxLoading}
          />
          <button
            className="fx-fire-btn"
            disabled={fxLoading || !fxPrompt.trim()}
            onClick={() => triggerFx(fxPrompt)}
          >
            {fxLoading ? '…' : '▶ Fire'}
          </button>
        </div>
        {fxError && <p className="fx-error">{fxError}</p>}
        {fxSpec && (
          <FxTimeline spec={fxSpec} activeFx={activeFx} now={fxNow} />
        )}
      </div>

      {/* ── Thread ── */}
      <div className="ai-messages">

        {messages.length === 0 && (
          <div className="ai-empty">
            <p className="ai-empty-title">Tell the AI what you want from the mix.</p>
            <div className="ai-suggestions">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="ai-suggestion" onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`ai-turn${msg.error ? ' ai-turn-error' : ''}`}>
            {msg.role === 'user' ? (
              <div className="ai-user-line">
                <span className="ai-prompt-arrow">&gt;</span>
                <span className="ai-user-text">{msg.content}</span>
              </div>
            ) : (
              <div className="ai-reply">
                {!msg.error && <span className="ai-reply-label">AI:</span>}
                {msg.error ? (
                  <span className="ai-reply-error">{msg.content}</span>
                ) : (
                  <>
                    {msg.actions && msg.actions.length > 0 ? (
                      <ul className="ai-action-list">
                        {msg.actions.map((a, j) => (
                          <li key={j} className="ai-action-item">
                            <span className="ai-check">✓</span>
                            {actionLabel(a)}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="ai-reply-text">{msg.content}</p>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="ai-turn">
            <div className="ai-reply">
              <span className="ai-reply-label">AI:</span>
              <div className="ai-thinking"><span /><span /><span /></div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Input ── */}
      <div className="ai-input-row">
        <textarea
          ref={inputRef}
          className="ai-input"
          rows={2}
          placeholder="Tell the AI what to do…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={loading}
        />
        <button
          className="ai-send-btn"
          onClick={() => send(input)}
          disabled={loading || !input.trim()}
        >
          Send
        </button>
      </div>

    </motion.aside>
    )}
    </AnimatePresence>
  );
}
