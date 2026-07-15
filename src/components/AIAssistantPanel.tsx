'use client';
// AIAssistantPanel — AI DJ Copilot operating center.
// Layout: header → current track stats → live suggestions → action buttons → chat

import { useState, useRef, useEffect, useCallback } from 'react';
import type { UseDeck } from '@/lib/useDeck';

/* ─── types ───────────────────────────────────────────────────────────── */
interface Message {
  id: number;
  role: 'user' | 'ai';
  text: string;
  actions?: string[];
  time: string;
  attachmentName?: string;
}

interface AISuggestion {
  icon: string;
  label: string;
  reason: string;
  action?: string; // optional one-word action tag
}

interface AttachmentContext {
  name: string;
  type: string;
  sizeKb: number;
  kind: 'image' | 'audio' | 'other';
  duration?: number;
  previewUrl?: string;
}

interface Props {
  deckA: UseDeck;
  deckB: UseDeck;
  crossfader: number;
  setCrossfader: (v: number) => void;
  masterVolume: number;
  setMasterVolume: (v: number) => void;
  open: boolean;
  onToggle: () => void;
}

/* ─── helpers ─────────────────────────────────────────────────────────── */
function nowStr() {
  const d = new Date();
  const h = d.getHours() % 12 || 12;
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m} ${d.getHours() >= 12 ? 'PM' : 'AM'}`;
}

/** Derive a musical key label from spectral centroid (rough, visual-only). */
function estimateKey(centroid: number, bpm: number): string {
  const keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const mode = bpm % 2 === 0 ? 'maj' : 'min'; // very rough — just decorative
  const idx  = Math.round(centroid * (keys.length - 1)) % keys.length;
  return `${keys[idx]} ${mode}`;
}

/** Convert normalized level (0–1) to crowd energy % */
function levelToPct(level: number) {
  return Math.round(Math.min(level * 150, 100)); // amplify a bit
}

/* ─── static fallback suggestions shown when no track is loaded ──────── */
const IDLE_SUGGESTIONS: AISuggestion[] = [
  {
    icon: '🎵',
    label: 'Load a track to get started',
    reason: 'Drop an audio file on Deck A or B to unlock AI analysis and real-time suggestions.',
  },
  {
    icon: '🎛',
    label: 'Try the Beat Maker',
    reason: 'Generate an AI-crafted beat pattern to practice mixing or fill a gap in your set.',
  },
  {
    icon: '🎓',
    label: 'Check the Learn panel',
    reason: 'The DJ Learn tab has 15 tutorial videos and a full deck anatomy guide.',
  },
];

/* ─── action button definitions ──────────────────────────────────────── */
const ACTION_BUTTONS = [
  { id: 'decklesson', label: 'Teach Deck',         icon: '🎓' },
  { id: 'automix',    label: 'Auto Mix',           icon: '⚡' },
  { id: 'analyze',    label: 'Analyze Mix',        icon: '🔬' },
  { id: 'transition', label: 'Fix Transition',     icon: '🔀' },
  { id: 'explain',    label: 'Explain',            icon: '💡' },
] as const;

type ActionId = typeof ACTION_BUTTONS[number]['id'];

/* ─── prompt templates for action buttons ────────────────────────────── */
function actionPrompt(id: ActionId, deckABpm: number, deckBBpm: number, trackA: string, trackB: string): string {
  switch (id) {
    case 'decklesson':
      return `Teach me the AI DJ Studio deck using my current setup. Explain what Play, Cue, Sync, EQ, Filter, Crossfader, Loop, waveform seeking, and the Library load buttons do, then give me a small practice task I can do right now.`;
    case 'automix':
      return `I have "${trackA}" on Deck A (${deckABpm} BPM) and "${trackB || 'nothing'}" on Deck B (${deckBBpm} BPM). Suggest the optimal auto-mix transition: timing, EQ moves, crossfader speed, and any FX.`;
    case 'analyze':
      return `Analyze my current mix: Deck A is "${trackA}" at ${deckABpm} BPM, Deck B is "${trackB || 'empty'}" at ${deckBBpm} BPM. What's working well and what could I improve?`;
    case 'transition':
      return `The transition between "${trackA}" (${deckABpm} BPM) and "${trackB || 'the next track'}" (${deckBBpm} BPM) feels rough. How do I fix it? Give step-by-step instructions and explain the theory.`;
    case 'explain':
      return `Explain what I should do right now with my current mix: Deck A "${trackA}" at ${deckABpm} BPM${trackB ? `, Deck B "${trackB}" at ${deckBBpm} BPM` : ''}. Give me 3 specific actionable tips and the musical reason behind each.`;
  }
}

/* ─── component ───────────────────────────────────────────────────────── */
export default function AIAssistantPanel({ deckA, deckB, open, onToggle }: Props) {
  const [messages, setMessages]     = useState<Message[]>([]);
  const [input, setInput]           = useState('');
  const [loading, setLoading]       = useState(false);
  const [suggestions, setSuggestions] = useState<AISuggestion[]>(IDLE_SUGGESTIONS);
  const [sugLoading, setSugLoading] = useState(false);
  const [activeAction, setActiveAction] = useState<ActionId | null>(null);
  const [chatExpanded, setChatExpanded] = useState(false);
  const [attachment, setAttachment] = useState<AttachmentContext | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* scroll chat to bottom on new messages */
  useEffect(() => {
    if (chatExpanded) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, chatExpanded]);

  /* ── Derive deck stats ────────────────────────────────────────────── */
  const trackA    = deckA.state.track;
  const trackB    = deckB.state.track;
  const bpmA      = trackA ? trackA.analysis.tempoBpm : 0;
  const bpmB      = trackB ? trackB.analysis.tempoBpm : 0;
  const activeDeck = deckA.state.playing ? deckA : deckB.state.playing ? deckB : deckA;
  const activeTrack = activeDeck.state.track;
  const crowdEnergy = Math.max(levelToPct(deckA.level), levelToPct(deckB.level));
  const keyLabel    = activeTrack
    ? estimateKey(activeTrack.analysis.spectralCentroid, activeTrack.analysis.tempoBpm)
    : '—';

  /* energy color */
  const energyColor = crowdEnergy >= 80 ? '#4caf50' : crowdEnergy >= 50 ? '#ff9800' : '#e040fb';

  /* ── Auto-generate suggestions when a track loads ─────────────────── */
  const prevTrackName = useRef<string | null>(null);
  useEffect(() => {
    const name = activeTrack?.name ?? null;
    if (name === prevTrackName.current) return;
    prevTrackName.current = name;
    if (!name) { setSuggestions(IDLE_SUGGESTIONS); return; }

    setSugLoading(true);
    const bpm = activeTrack!.analysis.tempoBpm;

    fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{
          role: 'human',
          content: `I'm playing "${name}" at ${bpm} BPM (${activeTrack!.analysis.energy} energy, ${activeTrack!.analysis.brightness} brightness). Give me 4 specific DJ suggestions right now. For each, include a short reason (one sentence, musical explanation). Respond as JSON: { "suggestions": [{ "icon": "emoji", "label": "short action", "reason": "why" }] }`,
        }],
        deckA: { bpm: bpmA, playing: deckA.state.playing },
        deckB: { bpm: bpmB, playing: deckB.state.playing },
      }),
    })
      .then(r => r.json())
      .then((d: Record<string, unknown>) => {
        // The LLM reply comes back as { reply, actions } from /api/ai/chat.
        // We embed the suggestion list in `reply` as stringified JSON.
        let parsed: AISuggestion[] | null = null;
        try {
          // Try direct structure first (if model returns it as top-level)
          if (Array.isArray((d as { suggestions?: unknown }).suggestions)) {
            parsed = (d as { suggestions: AISuggestion[] }).suggestions;
          } else {
            // reply might be a JSON string
            const reply = (d as { reply?: string }).reply ?? '';
            const match = reply.match(/\{[\s\S]*\}/);
            if (match) {
              const inner = JSON.parse(match[0]) as { suggestions?: AISuggestion[] };
              if (Array.isArray(inner.suggestions)) parsed = inner.suggestions;
            }
          }
        } catch { /* fall through to fallback */ }

        if (parsed && parsed.length > 0) {
          setSuggestions(parsed.slice(0, 4));
        } else {
          // Fallback: build from the actions array
          const actions = Array.isArray((d as { actions?: unknown[] }).actions)
            ? (d as { actions: string[] }).actions
            : [];
          setSuggestions(
            actions.length > 0
              ? actions.slice(0, 4).map((a, i) => ({ icon: ['🎚', '⏱', '🔊', '🎛'][i] ?? '✓', label: a, reason: '' }))
              : IDLE_SUGGESTIONS,
          );
        }
      })
      .catch(() => setSuggestions(IDLE_SUGGESTIONS))
      .finally(() => setSugLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTrack?.name]);

  /* ── Send chat message ─────────────────────────────────────────────── */
  const sendMessage = useCallback(async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || loading) return;
    setInput('');
    setChatExpanded(true);
    const attachmentPrompt = attachment
      ? `\n\nUploaded ${attachment.kind}: ${attachment.name} (${attachment.type || 'unknown type'}, ${attachment.sizeKb} KB${attachment.duration ? `, ${attachment.duration.toFixed(1)} seconds` : ''}). Use this file context when answering. If it is a song, give DJ editing/mixing advice. If it is an image, explain visible DJ gear/layout concepts that may apply.`
      : '';
    const userMsg: Message = { id: Date.now(), role: 'user', text, time: nowStr(), attachmentName: attachment?.name };
    setMessages(m => [...m, userMsg]);
    setLoading(true);
    setActiveAction(null);

    try {
      const res  = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMsg].map(m => ({
            role: m.role === 'user' ? 'human' : 'assistant',
            content: m.id === userMsg.id ? `${m.text}${attachmentPrompt}` : m.text,
          })),
          deckA: { bpm: bpmA, playing: deckA.state.playing },
          deckB: { bpm: bpmB, playing: deckB.state.playing },
        }),
      });
      const data = await res.json() as { reply?: string; actions?: string[] };
      setMessages(m => [...m, {
        id: Date.now() + 1,
        role: 'ai',
        text: data.reply ?? 'Done!',
        actions: data.actions,
        time: nowStr(),
      }]);
    } catch {
      setMessages(m => [...m, {
        id: Date.now() + 1,
        role: 'ai',
        text: 'Could not reach AI — check your GROQ_API_KEY in .env.local.',
        time: nowStr(),
      }]);
    } finally {
      setLoading(false);
      setAttachment(null);
    }
  }, [attachment, input, loading, messages, bpmA, bpmB, deckA.state.playing, deckB.state.playing]);

  const attachFile = async (file: File | undefined) => {
    if (!file) return;
    const kind = file.type.startsWith('image/') ? 'image' : file.type.startsWith('audio/') ? 'audio' : 'other';
    const next: AttachmentContext = {
      name: file.name,
      type: file.type,
      sizeKb: Math.round(file.size / 1024),
      kind,
      previewUrl: kind === 'image' || kind === 'audio' ? URL.createObjectURL(file) : undefined,
    };
    if (kind === 'audio') {
      next.duration = await new Promise<number | undefined>((resolve) => {
        const audio = document.createElement('audio');
        audio.preload = 'metadata';
        audio.src = next.previewUrl!;
        audio.onloadedmetadata = () => resolve(audio.duration);
        audio.onerror = () => resolve(undefined);
      });
    }
    setAttachment(current => {
      if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl);
      return next;
    });
    setChatExpanded(true);
  };

  /* ── Action button handler ─────────────────────────────────────────── */
  const handleAction = (id: ActionId) => {
    setActiveAction(id);
    const prompt = actionPrompt(
      id,
      bpmA || 128,
      bpmB || 128,
      trackA?.name ?? 'current track',
      trackB?.name ?? '',
    );
    void sendMessage(prompt);
  };

  /* ── BPM mismatch warning ──────────────────────────────────────────── */
  const bpmDiff  = bpmA && bpmB ? Math.abs(bpmA - bpmB) : 0;
  const bpmWarn  = bpmDiff > 6;

  /* ─────────────────────────────────────────────────────────────────────
     RENDER
  ───────────────────────────────────────────────────────────────────── */
  return (
    <aside className={`right-panel${open ? ' open' : ' collapsed'}`}>
      {/* Collapsed launcher */}
      {!open && (
        <button className="ai-drawer-launcher" onClick={onToggle} aria-label="Open AI DJ Assistant" title="Open AI DJ Assistant">
          <span>🤖</span><span className="ai-launcher-label">AI</span>
        </button>
      )}

      {open && (
        <div className="ai-copilot-root">

          {/* ── Header ── */}
          <div className="ai-panel-header">
            <span className="ai-panel-icon">🤖</span>
            <span className="ai-panel-title">AI DJ COPILOT</span>
            <button className="ai-pin-btn" onClick={onToggle} title="Collapse" aria-label="Collapse AI assistant">›</button>
          </div>

          <div className="ai-copilot-scroll">

            {/* ══ CURRENT TRACK STATS ══ */}
            <div className="ai-section">
              <div className="ai-section-label">🎤 Current Track</div>

              {activeTrack ? (
                <>
                  <div className="ai-track-name">{activeTrack.name.replace(/\.[^.]+$/, '')}</div>

                  <div className="ai-stat-row">
                    <div className="ai-stat-card" style={{ borderColor: 'var(--pink)' }}>
                      <div className="ai-stat-val" style={{ color: 'var(--pink)' }}>{activeTrack.analysis.tempoBpm}</div>
                      <div className="ai-stat-lbl">BPM</div>
                    </div>
                    <div className="ai-stat-card" style={{ borderColor: 'var(--cyan)' }}>
                      <div className="ai-stat-val" style={{ color: 'var(--cyan)', fontSize: '0.85rem' }}>{keyLabel}</div>
                      <div className="ai-stat-lbl">Key</div>
                    </div>
                    <div className="ai-stat-card" style={{ borderColor: energyColor }}>
                      <div className="ai-stat-val" style={{ color: energyColor }}>{crowdEnergy}%</div>
                      <div className="ai-stat-lbl">Energy</div>
                    </div>
                  </div>

                  {/* Crowd energy bar */}
                  <div style={{ margin: '0.45rem 0 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem', color: 'var(--muted)', marginBottom: '0.2rem' }}>
                      <span>Crowd Energy</span><span style={{ color: energyColor, fontWeight: 700 }}>{crowdEnergy}%</span>
                    </div>
                    <div className="ai-energy-bar-bg">
                      <div className="ai-energy-bar-fill" style={{ width: `${crowdEnergy}%`, background: energyColor }} />
                    </div>
                  </div>

                  {/* Deck A vs B row */}
                  {trackA && trackB && (
                    <div className="ai-deck-compare">
                      <div className="ai-deck-compare-item" style={{ color: 'var(--pink)' }}>
                        <span className="ai-deck-compare-label">A</span>
                        <span className="ai-deck-compare-bpm">{bpmA} BPM</span>
                      </div>
                      <div className={`ai-deck-compare-diff${bpmWarn ? ' warn' : ''}`}>
                        {bpmWarn ? `⚠ ${bpmDiff} BPM diff` : `≈ ${bpmDiff} BPM diff`}
                      </div>
                      <div className="ai-deck-compare-item" style={{ color: 'var(--cyan)', textAlign: 'right' }}>
                        <span className="ai-deck-compare-bpm">{bpmB} BPM</span>
                        <span className="ai-deck-compare-label">B</span>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="ai-no-track">
                  <div className="ai-no-track-icon">🎵</div>
                  <div>No track loaded</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--muted)', marginTop: '0.2rem' }}>
                    Drop an audio file on Deck A or B
                  </div>
                </div>
              )}
            </div>

            {/* ══ LIVE SUGGESTIONS ══ */}
            <div className="ai-section">
              <div className="ai-section-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span>💡 Suggestions</span>
                {sugLoading && <span className="ai-sug-loading-dot" />}
                {activeTrack && !sugLoading && (
                  <span style={{ marginLeft: 'auto', fontSize: '0.6rem', color: 'var(--muted)' }}>
                    Based on current mix
                  </span>
                )}
              </div>

              <div className="ai-suggestions-list">
                {suggestions.map((sug, i) => (
                  <div key={i} className="ai-sug-card">
                    <div className="ai-sug-card-top">
                      <span className="ai-sug-card-icon">{sug.icon}</span>
                      <span className="ai-sug-card-check">✓</span>
                      <span className="ai-sug-card-label">{sug.label}</span>
                    </div>
                    {sug.reason && (
                      <div className="ai-sug-card-reason">"{sug.reason}"</div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* ══ ACTION BUTTONS ══ */}
            <div className="ai-section">
              <div className="ai-section-label">⚡ Actions</div>
              <div className="ai-action-grid">
                {ACTION_BUTTONS.map(btn => (
                  <button
                    key={btn.id}
                    className={`ai-action-btn${activeAction === btn.id && loading ? ' loading' : ''}`}
                    disabled={loading}
                    onClick={() => handleAction(btn.id)}
                    title={btn.label}
                  >
                    <span className="ai-action-btn-icon">{btn.icon}</span>
                    <span className="ai-action-btn-label">{btn.label}</span>
                    {activeAction === btn.id && loading && (
                      <span className="ai-action-spinner" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* ══ CHAT (collapsible) ══ */}
            <div className="ai-section ai-chat-section">
              <button
                className="ai-chat-toggle"
                onClick={() => setChatExpanded(v => !v)}
              >
                <span>💬 Ask AI anything</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>{chatExpanded ? '▲' : '▼'}</span>
              </button>

              {chatExpanded && (
                <div className="ai-chat-body">
                  {/* Messages */}
                  <div className="ai-messages">
                    {messages.length === 0 && (
                      <div className="ai-chat-empty">
                        Ask anything — transition tips, track selection, EQ advice, beat matching…
                      </div>
                    )}
                    {messages.map(msg => (
                      <div key={msg.id}>
                        {msg.role === 'user' ? (
                          <div className="ai-msg-bubble">{msg.text}{msg.attachmentName && <small className="ai-attachment-note">Attached: {msg.attachmentName}</small>}</div>
                        ) : (
                          <div className="ai-msg-reply">
                            {msg.text}
                            {msg.actions && msg.actions.length > 0 && (
                              <div className="ai-checklist">
                                {msg.actions.map((a, i) => (
                                  <div key={i} className="ai-checklist-item">
                                    <span className="ai-checklist-check">✓</span>{a}
                                  </div>
                                ))}
                              </div>
                            )}
                            {/* mini waveform decoration */}
                            <svg className="ai-mini-wave" viewBox="0 0 200 20" width="100%" height="16">
                              {Array.from({ length: 50 }, (_, i) => {
                                const h = 3 + Math.sin(i * 0.8) * 4 + Math.sin(i * 0.3) * 2;
                                return <rect key={i} x={i * 4} y={(20 - h) / 2} width={2.5} height={h} fill="#7c3aed" opacity="0.5" rx="1" />;
                              })}
                            </svg>
                          </div>
                        )}
                        <div className="ai-msg-time">{msg.time}</div>
                      </div>
                    ))}

                    {loading && (
                      <div className="ai-msg-reply" style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                        {[0, 0.15, 0.3].map((d, i) => (
                          <span key={i} style={{
                            display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
                            background: 'var(--purple)', animation: `ai-bounce 1.2s ${d}s infinite ease-in-out`,
                          }} />
                        ))}
                      </div>
                    )}
                    <div ref={bottomRef} />
                  </div>

                  {/* Input bar */}
                  <div className="ai-input-row">
                    <input ref={fileInputRef} type="file" accept="image/*,audio/*" hidden onChange={e => void attachFile(e.target.files?.[0])} />
                    <button className="ai-send-btn attach" onClick={() => fileInputRef.current?.click()} title="Upload image or song">＋</button>
                    <input
                      className="ai-input"
                      placeholder="Ask AI DJ anything or upload image/song…"
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendMessage(); } }}
                    />
                    <button className="ai-send-btn" onClick={() => void sendMessage()} disabled={loading || !input.trim()}>
                      ➤
                    </button>
                  </div>
                  {attachment && (
                    <div className="ai-attachment-card">
                      {attachment.kind === 'image' && attachment.previewUrl && <img src={attachment.previewUrl} alt="" />}
                      {attachment.kind === 'audio' && attachment.previewUrl && <audio controls src={attachment.previewUrl} />}
                      <span>{attachment.name}</span>
                      <button onClick={() => setAttachment(null)}>Remove</button>
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>{/* .ai-copilot-scroll */}
        </div>
      )}
    </aside>
  );
}
