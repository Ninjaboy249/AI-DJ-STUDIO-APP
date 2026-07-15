'use client';
// VoiceCommand.tsx — Voice command mic button + feedback overlay.
//
// Renders a floating mic button. On press:
//   1. Web Speech API captures the utterance (live waveform ring animates)
//   2. Final transcript is sent to Groq via parseVoiceCommand()
//   3. Confirmed actions are applied to the mixer
//   4. A toast-style confirmation fades in over the button
//
// If the browser doesn't support SpeechRecognition, the button shows a
// tooltip instead of silently failing.

import { useCallback, useEffect, useRef, useState } from 'react';
import { parseVoiceCommand } from '../lib/api';
import type { VoiceCommandResult, GraniteAction, DeckId } from '../lib/granite';
import { useVoiceCommand } from '../hooks/useVoiceCommand';
import type { UseDeck } from '../lib/useDeck';

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  deckA: UseDeck;
  deckB: UseDeck;
  setCrossfader: (v: number) => void;
  setMasterVolume: (v: number) => void;
}

// ── Command history item ──────────────────────────────────────────────────────

interface HistoryItem {
  id: number;
  transcript: string;
  confirmation: string;
  recognised: boolean;
  actions: GraniteAction[];
  ts: number;
}

// ── Apply actions to mixer (mirrors GranitePanel.applyAction) ─────────────────

function applyActions(
  actions: GraniteAction[],
  deckA: UseDeck,
  deckB: UseDeck,
  setCrossfader: (v: number) => void,
  setMasterVolume: (v: number) => void,
) {
  const deck = (id: DeckId) => (id === 'A' ? deckA : deckB);
  for (const a of actions) {
    switch (a.action) {
      case 'play':            deck(a.deck).togglePlay(); break;
      case 'pause':           deck(a.deck).togglePlay(); break;
      case 'setTempo':        deck(a.deck).setTempo(a.value); break;
      case 'setVolume':       deck(a.deck).setVolume(a.value); break;
      case 'setEq':           deck(a.deck).setEq(a.band, a.value); break;
      case 'setFilter':       deck(a.deck).setFilter(a.value); break;
      case 'setCrossfader':   setCrossfader(a.value); break;
      case 'setMasterVolume': setMasterVolume(a.value); break;
      case 'setLoopIn':       deck(a.deck).setLoopIn(deck(a.deck).position); break;
      case 'setLoopOut':      deck(a.deck).setLoopOut(deck(a.deck).position); break;
      case 'toggleLoop':      deck(a.deck).toggleLoop(); break;
      case 'jumpCue':         deck(a.deck).jumpCue(); break;
      case 'seek':            deck(a.deck).seek(a.norm); break;
    }
  }
}

// ── Example commands shown in the tooltip / empty state ──────────────────────

const EXAMPLES = [
  'Play next',
  'Drop bass',
  'Increase tempo',
  'Loop 8 bars',
  'Add echo',
  'Crossfade',
  'Volume up',
  'Back to cue',
];

// ── Waveform ring — animated SVG arcs that pulse while listening ──────────────

function WaveRing({ active }: { active: boolean }) {
  // 8 arcs evenly spaced around a circle
  const arcs = Array.from({ length: 8 }, (_, i) => {
    const angle   = (i / 8) * 360;
    const delay   = i * 0.12;
    const x1 = 50 + 38 * Math.cos((angle - 10) * (Math.PI / 180));
    const y1 = 50 + 38 * Math.sin((angle - 10) * (Math.PI / 180));
    const x2 = 50 + 38 * Math.cos((angle + 10) * (Math.PI / 180));
    const y2 = 50 + 38 * Math.sin((angle + 10) * (Math.PI / 180));
    return { x1, y1, x2, y2, delay };
  });

  return (
    <svg className={`vc-wave-ring${active ? ' active' : ''}`} viewBox="0 0 100 100">
      {arcs.map((a, i) => (
        <line
          key={i}
          x1={a.x1} y1={a.y1}
          x2={a.x2} y2={a.y2}
          strokeWidth="3"
          strokeLinecap="round"
          style={{ animationDelay: `${a.delay}s` }}
        />
      ))}
    </svg>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function VoiceCommand({
  deckA, deckB, setCrossfader, setMasterVolume,
}: Props) {
  const [parsing, setParsing]       = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [toast, setToast]           = useState<{ text: string; ok: boolean } | null>(null);
  const [history, setHistory]       = useState<HistoryItem[]>([]);
  const [historyOpen, setHistOpen]  = useState(false);
  const toastTimerRef               = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idRef                       = useRef(0);

  const showToast = useCallback((text: string, ok: boolean) => {
    setToast({ text, ok });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 3500);
  }, []);

  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);

  const handleFinal = useCallback(async (transcript: string) => {
    if (!transcript.trim()) return;
    setParsing(true);
    setParseError(null);
    try {
      const result: VoiceCommandResult = await parseVoiceCommand(transcript);
      applyActions(result.actions, deckA, deckB, setCrossfader, setMasterVolume);
      const id = ++idRef.current;
      setHistory((prev) => [
        { id, transcript: result.transcript || transcript, confirmation: result.confirmation,
          recognised: result.recognised, actions: result.actions, ts: Date.now() },
        ...prev.slice(0, 19), // keep last 20
      ]);
      showToast(
        result.recognised ? result.confirmation : `Not recognised: "${transcript}"`,
        result.recognised,
      );
    } catch (err) {
      const msg = String(err);
      setParseError(msg);
      showToast('Command failed', false);
    } finally {
      setParsing(false);
    }
  }, [deckA, deckB, setCrossfader, setMasterVolume, showToast]);

  const voice = useVoiceCommand({ onFinal: handleFinal });

  const handleMicClick = useCallback(() => {
    if (!voice.supported) return;
    if (voice.listening) {
      voice.stop();
    } else {
      voice.start();
    }
  }, [voice]);

  const isActive = voice.listening || parsing;

  return (
    <div className="vc-root">

      {/* ── Mic button ── */}
      <div className="vc-btn-wrap">
        <WaveRing active={voice.listening} />

        <button
          className={`vc-btn${isActive ? ' active' : ''}${!voice.supported ? ' unsupported' : ''}`}
          onClick={handleMicClick}
          title={
            !voice.supported
              ? 'Voice recognition not supported in this browser'
              : voice.listening
              ? 'Listening… click to cancel'
              : parsing
              ? 'Parsing command…'
              : 'Voice command (click to speak)'
          }
          disabled={parsing}
        >
          {parsing ? (
            <span className="vc-btn-icon vc-spinner">◌</span>
          ) : (
            <span className="vc-btn-icon">{voice.listening ? '⏹' : '🎙'}</span>
          )}
        </button>

        {/* Status label under the button */}
        <span className="vc-status">
          {!voice.supported
            ? 'Not supported'
            : parsing
            ? 'Thinking…'
            : voice.listening
            ? 'Listening…'
            : 'Tap to speak'}
        </span>
      </div>

      {/* ── Live interim transcript bubble ── */}
      {voice.interimTranscript && (
        <div className="vc-interim">
          <span className="vc-interim-text">"{voice.interimTranscript}"</span>
        </div>
      )}

      {/* ── Toast confirmation ── */}
      {toast && (
        <div className={`vc-toast${toast.ok ? ' ok' : ' fail'}`}>
          <span className="vc-toast-icon">{toast.ok ? '✓' : '✕'}</span>
          {toast.text}
        </div>
      )}

      {/* ── Parse error ── */}
      {parseError && (
        <p className="vc-parse-error">{parseError}</p>
      )}

      {/* ── Voice error ── */}
      {voice.error && (
        <p className="vc-parse-error">{voice.error}</p>
      )}

      {/* ── Example commands hint ── */}
      <div className="vc-examples">
        <p className="vc-examples-title">Try saying…</p>
        <div className="vc-example-chips">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              className="vc-example-chip"
              disabled={parsing || voice.listening}
              onClick={() => handleFinal(ex)}
              title={`Simulate: "${ex}"`}
            >
              {ex}
            </button>
          ))}
        </div>
      </div>

      {/* ── History toggle ── */}
      {history.length > 0 && (
        <div className="vc-history">
          <button
            className="vc-history-toggle"
            onClick={() => setHistOpen((v) => !v)}
          >
            {historyOpen ? '▾' : '▸'} Recent commands ({history.length})
          </button>
          {historyOpen && (
            <ul className="vc-history-list">
              {history.map((h) => (
                <li key={h.id} className={`vc-history-item${h.recognised ? '' : ' unrecognised'}`}>
                  <span className="vc-history-icon">{h.recognised ? '✓' : '?'}</span>
                  <div className="vc-history-body">
                    <span className="vc-history-transcript">"{h.transcript}"</span>
                    <span className="vc-history-confirm">{h.confirmation}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

    </div>
  );
}
