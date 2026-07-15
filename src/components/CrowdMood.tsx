'use client';
// CrowdMood.tsx — AI Crowd Mood Detection panel.
//
// Uses simulated sensor readings (motion, noise, density, face brightness,
// face count) fed to Groq which returns:
//   • A mood classification (happy / excited / low_energy / tense / neutral)
//   • A confidence score + one-sentence crowd read
//   • 3 DJ recommendations, each with an optional immediate GraniteAction
//
// The panel can also poll automatically every N seconds (live mode).

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { analyzeCrowdMood, simulateCrowdSensor } from '../lib/api';
import type { CrowdMoodResult, CrowdRecommendation, CrowdSensorReading, MoodId } from '../lib/granite';
import type { UseDeck } from '../lib/useDeck';

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  deckA: UseDeck;
  deckB: UseDeck;
  setCrossfader: (v: number) => void;
  setMasterVolume: (v: number) => void;
  isOpen: boolean;
  onClose: () => void;
}

// ── Mood display config ───────────────────────────────────────────────────────

const MOOD_CONFIG: Record<MoodId, { color: string; glow: string; bg: string }> = {
  happy:      { color: '#ffd740', glow: 'rgba(255,215,64,0.4)',  bg: '#1a1800' },
  excited:    { color: '#ff6b35', glow: 'rgba(255,107,53,0.45)', bg: '#1a0c00' },
  low_energy: { color: '#5bb8ff', glow: 'rgba(91,184,255,0.4)',  bg: '#001020' },
  tense:      { color: '#cc44ff', glow: 'rgba(200,68,255,0.4)',  bg: '#120020' },
  neutral:    { color: '#aaaaaa', glow: 'rgba(170,170,170,0.3)', bg: '#141414' },
};

// ── Sensor bar ────────────────────────────────────────────────────────────────

function SensorBar({ label, value, unit = '' }: { label: string; value: number; unit?: string }) {
  const pct = Math.min(100, Math.max(0, value * 100));
  return (
    <div className="crowd-sensor-row">
      <span className="crowd-sensor-label">{label}</span>
      <div className="crowd-sensor-track">
        <div className="crowd-sensor-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="crowd-sensor-val">
        {unit === '%' ? `${Math.round(value * 100)}%` : value.toFixed(2)}{unit !== '%' ? unit : ''}
      </span>
    </div>
  );
}

// ── Recommendation card ───────────────────────────────────────────────────────

function RecCard({
  rec, index, onApply,
}: { rec: CrowdRecommendation; index: number; onApply: (rec: CrowdRecommendation) => void }) {
  const icons = ['▶', '◆', '⬡'];
  return (
    <div className="crowd-rec-card">
      <div className="crowd-rec-top">
        <span className="crowd-rec-icon">{icons[index] ?? '▸'}</span>
        <span className="crowd-rec-action">{rec.action}</span>
        {rec.djAction && (
          <button className="crowd-rec-apply" onClick={() => onApply(rec)} title="Apply to mixer">
            Apply
          </button>
        )}
      </div>
      <p className="crowd-rec-reason">{rec.reason}</p>
      {rec.djAction && (
        <p className="crowd-rec-dj-action">{formatDjAction(rec.djAction)}</p>
      )}
    </div>
  );
}

function formatDjAction(a: CrowdRecommendation['djAction']): string {
  if (!a) return '';
  switch (a.action) {
    case 'setTempo': {
      const pct = Math.round((a.value - 1) * 100);
      return `Deck ${a.deck} tempo ${pct >= 0 ? '+' : ''}${pct}%`;
    }
    case 'setEq': {
      const band = a.band === 'eqLow' ? 'bass' : a.band === 'eqMid' ? 'mids' : 'highs';
      return `Deck ${a.deck} ${band} ${a.value >= 0 ? '+' : ''}${a.value} dB`;
    }
    case 'setFilter':
      return `Deck ${a.deck} filter ${a.value < 0 ? 'LPF' : a.value > 0 ? 'HPF' : 'off'}`;
    case 'setCrossfader':
      return `Crossfader → ${a.value < 0 ? 'Deck A' : a.value > 0 ? 'Deck B' : 'center'}`;
    case 'setMasterVolume':
      return `Master volume ${Math.round(a.value * 100)}%`;
    case 'toggleLoop':
      return `Loop on Deck ${a.deck}`;
    default:
      return '';
  }
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CrowdMood({
  deckA, deckB, setCrossfader, setMasterVolume, isOpen, onClose,
}: Props) {
  const [result, setResult]         = useState<CrowdMoodResult | null>(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [liveMode, setLiveMode]     = useState(false);
  const [appliedIdx, setAppliedIdx] = useState<number | null>(null);
  const [lastScan, setLastScan]     = useState<number | null>(null);
  const liveRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Scan ───────────────────────────────────────────────────────────────────
  const scan = useCallback(async (reading?: CrowdSensorReading) => {
    setLoading(true);
    setError(null);
    setAppliedIdx(null);
    const r = reading ?? simulateCrowdSensor();
    try {
      const res = await analyzeCrowdMood(r);
      setResult(res);
      setLastScan(Date.now());
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Live mode toggle ───────────────────────────────────────────────────────
  useEffect(() => {
    if (liveMode) {
      liveRef.current = setInterval(() => scan(), 15_000); // every 15 s
      return () => {
        if (liveRef.current) clearInterval(liveRef.current);
      };
    } else {
      if (liveRef.current) { clearInterval(liveRef.current); liveRef.current = null; }
    }
  }, [liveMode, scan]);

  // ── Cleanup on unmount ─────────────────────────────────────────────────────
  useEffect(() => {
    return () => { if (liveRef.current) clearInterval(liveRef.current); };
  }, []);

  // ── Apply recommendation ───────────────────────────────────────────────────
  const applyRec = useCallback((rec: CrowdRecommendation, idx: number) => {
    const a = rec.djAction;
    if (!a) return;
    const deck = (id: 'A' | 'B') => (id === 'A' ? deckA : deckB);
    switch (a.action) {
      case 'setTempo':        deck(a.deck).setTempo(a.value); break;
      case 'setVolume':       deck(a.deck).setVolume(a.value); break;
      case 'setEq':           deck(a.deck).setEq(a.band, a.value); break;
      case 'setFilter':       deck(a.deck).setFilter(a.value); break;
      case 'setCrossfader':   setCrossfader(a.value); break;
      case 'setMasterVolume': setMasterVolume(a.value); break;
      case 'toggleLoop':      deck(a.deck).toggleLoop(); break;
    }
    setAppliedIdx(idx);
  }, [deckA, deckB, setCrossfader, setMasterVolume]);

  const mood   = result ? MOOD_CONFIG[result.mood] : null;
  const sensor = result?.sensorSnapshot ?? null;

  return (
    <AnimatePresence>
    {isOpen && (
    <motion.aside
      className="crowd-panel open"
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0 }}
      transition={{ type: 'spring', stiffness: 310, damping: 31 }}
    >

      {/* ── Header ── */}
      <div className="crowd-header">
        <div className="crowd-header-title">
          <span className="crowd-header-icon">👥</span>
          <span>Crowd Mood</span>
        </div>
        <button className="crowd-close-btn" onClick={onClose} title="Close">✕</button>
      </div>

      {/* ── Controls ── */}
      <div className="crowd-controls">
        <button
          className="crowd-scan-btn"
          onClick={() => scan()}
          disabled={loading}
        >
          {loading ? '⏳ Reading crowd…' : '📡 Scan Crowd'}
        </button>
        <label className="crowd-live-toggle" title="Auto-scan every 15 seconds">
          <input
            type="checkbox"
            checked={liveMode}
            onChange={(e) => setLiveMode(e.target.checked)}
            disabled={loading}
          />
          <span className={`crowd-live-dot${liveMode ? ' pulsing' : ''}`} />
          Live
        </label>
      </div>

      {error && <p className="crowd-error">{error}</p>}

      {/* ── Mood display ── */}
      {result && mood && (
        <>
          <div
            className="crowd-mood-card"
            style={{ background: mood.bg, borderColor: `${mood.color}55` }}
          >
            <div className="crowd-mood-top">
              <span
                className="crowd-mood-emoji"
                style={{ filter: `drop-shadow(0 0 8px ${mood.glow})` }}
              >
                {result.emoji}
              </span>
              <div className="crowd-mood-meta">
                <span
                  className="crowd-mood-label"
                  style={{ color: mood.color, textShadow: `0 0 8px ${mood.glow}` }}
                >
                  {result.label}
                </span>
                <div className="crowd-confidence-row">
                  <div className="crowd-confidence-track">
                    <div
                      className="crowd-confidence-fill"
                      style={{ width: `${result.confidence * 100}%`, background: mood.color, boxShadow: `0 0 6px ${mood.glow}` }}
                    />
                  </div>
                  <span className="crowd-confidence-val">{Math.round(result.confidence * 100)}%</span>
                </div>
              </div>
            </div>
            <p className="crowd-summary">{result.summary}</p>
          </div>

          {/* ── Sensor readings ── */}
          {sensor && (
            <div className="crowd-sensors">
              <p className="crowd-sensors-title">Floor reading</p>
              <SensorBar label="Motion"   value={sensor.motionLevel} />
              <SensorBar label="Noise"    value={sensor.noiseLevel} />
              <SensorBar label="Density"  value={sensor.density / 100} unit="%" />
              <SensorBar label="Smiles"   value={sensor.faceBrightness} />
              <div className="crowd-sensor-row">
                <span className="crowd-sensor-label">People</span>
                <span className="crowd-sensor-people">{sensor.faceCount}</span>
              </div>
              {lastScan && (
                <p className="crowd-scan-time">
                  Last scan: {new Date(lastScan).toLocaleTimeString()}
                </p>
              )}
            </div>
          )}

          {/* ── Recommendations ── */}
          <div className="crowd-recs">
            <p className="crowd-recs-title">DJ Recommendations</p>
            {result.recommendations.map((rec, i) => (
              <RecCard
                key={i}
                rec={rec}
                index={i}
                onApply={(r) => applyRec(r, i)}
              />
            ))}
            {appliedIdx !== null && (
              <p className="crowd-applied">✓ Applied to mixer</p>
            )}
          </div>
        </>
      )}

      {/* ── Empty state ── */}
      {!result && !loading && (
        <div className="crowd-empty">
          <div className="crowd-empty-emoji">👥</div>
          <p className="crowd-empty-text">
            Hit <strong>Scan Crowd</strong> to read the floor energy and get AI recommendations.
          </p>
          <p className="crowd-empty-sub">
            Simulates motion, noise, and facial brightness sensors.
          </p>
        </div>
      )}

    </motion.aside>
    )}
    </AnimatePresence>
  );
}
