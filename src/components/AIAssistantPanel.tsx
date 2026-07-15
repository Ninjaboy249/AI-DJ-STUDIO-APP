'use client';
// AIAssistantPanel — right panel with chat, AI suggestions, generate playlist.

import { useState, useRef, useEffect } from 'react';
import type { UseDeck } from '@/lib/useDeck';

interface Message {
  id: number;
  type: 'user' | 'ai';
  text: string;
  actions?: string[];
  time: string;
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

const SUGGESTIONS = [
  { name: 'Quantum Drive',   artist: 'Neon Riders',  bpm: 126, key: '8A', keyClass: 'blue'  },
  { name: 'Electric Dreams', artist: 'Synthbound',   bpm: 130, key: '9A', keyClass: 'orange'},
  { name: 'Midnight Rush',   artist: 'Arcade Youth', bpm: 128, key: '8A', keyClass: 'blue'  },
];

const INITIAL_MESSAGES: Message[] = [
  {
    id: 1,
    type: 'user',
    text: 'Make the transition smoother and increase energy',
    time: '10:30 PM',
  },
  {
    id: 2,
    type: 'ai',
    text: "Sure! I've made the transition smoother and increased the energy for you.",
    actions: ['Matched BPM', 'Applied Echo Out', 'Raised Energy Level', 'Next track suggested'],
    time: '10:30 PM',
  },
];

function now() {
  const d = new Date();
  const h = d.getHours() % 12 || 12;
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m} ${d.getHours() >= 12 ? 'PM' : 'AM'}`;
}

export default function AIAssistantPanel({ deckA, deckB, open, onToggle }: Props) {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    const userMsg: Message = { id: Date.now(), type: 'user', text, time: now() };
    setMessages(m => [...m, userMsg]);
    setLoading(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMsg].map(m => ({
            role: m.type === 'user' ? 'human' : 'assistant',
            content: m.text,
          })),
          deckA: { bpm: Math.round(deckA.state.tempo * 128), playing: deckA.state.playing },
          deckB: { bpm: Math.round(deckB.state.tempo * 128), playing: deckB.state.playing },
        }),
      });
      const data = await res.json() as { reply?: string; actions?: string[] };
      setMessages(m => [...m, {
        id: Date.now() + 1,
        type: 'ai',
        text: data.reply ?? 'Done!',
        actions: data.actions,
        time: now(),
      }]);
    } catch {
      setMessages(m => [...m, {
        id: Date.now() + 1,
        type: 'ai',
        text: 'Could not reach AI — check your API key.',
        time: now(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <aside className={`right-panel${open ? ' open' : ' collapsed'}`}>
      {!open && (
        <button className="ai-drawer-launcher" onClick={onToggle} aria-label="Open AI DJ Assistant" title="Open AI DJ Assistant">
          <span>🤖</span><span className="ai-launcher-label">AI</span>
        </button>
      )}
      {open && <>
      {/* Header */}
      <div className="ai-panel-header">
        <span className="ai-panel-icon">🤖</span>
        <span className="ai-panel-title">AI DJ ASSISTANT</span>
        <button className="ai-pin-btn" onClick={onToggle} title="Collapse AI assistant" aria-label="Collapse AI assistant">›</button>
      </div>

      {/* Messages */}
      <div className="ai-messages">
        {messages.map(msg => (
          <div key={msg.id}>
            {msg.type === 'user' ? (
              <div className="ai-msg-bubble">{msg.text}</div>
            ) : (
              <div className="ai-msg-reply">
                {msg.text}
                {msg.actions && msg.actions.length > 0 && (
                  <div className="ai-checklist">
                    {msg.actions.map((a, i) => (
                      <div key={i} className="ai-checklist-item">
                        <span className="ai-checklist-check">✓</span>
                        {a}
                      </div>
                    ))}
                  </div>
                )}
                {/* Mini waveform decoration */}
                <svg className="ai-mini-wave" viewBox="0 0 200 20" width="100%" height="20">
                  {Array.from({ length: 50 }, (_, i) => {
                    const h = 3 + Math.sin(i * 0.8) * 5 + Math.sin(i * 0.3) * 3;
                    return (
                      <rect key={i} x={i * 4} y={(20 - h) / 2} width={2.5} height={h}
                        fill="#7c3aed" opacity="0.6" rx="1" />
                    );
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

      {/* AI Suggestions */}
      <div className="ai-suggestions">
        <div className="ai-suggestions-header">
          <div>
            <div className="ai-suggestions-title">AI SUGGESTIONS</div>
            <div className="ai-suggestions-sub">BASED ON CURRENT MIX</div>
          </div>
          <button className="ai-pin-btn">⊞</button>
        </div>

        {SUGGESTIONS.map(s => (
          <div key={s.name} className="ai-suggestion-item">
            <div className="ai-suggestion-art">🎵</div>
            <div className="ai-suggestion-info">
              <div className="ai-suggestion-name">{s.name}</div>
              <div className="ai-suggestion-meta">
                <span>{s.artist}</span>
                <span>{s.bpm} BPM •</span>
                <span className={`key-badge ${s.keyClass}`}>{s.key}</span>
              </div>
            </div>
            <button className="ai-suggestion-play">▶</button>
          </div>
        ))}

        <button className="btn-generate-playlist">⊕ GENERATE PLAYLIST</button>
      </div>

      {/* Input row */}
      <div className="ai-input-row">
        <input
          className="ai-input"
          placeholder="Ask AI DJ anything..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendMessage(); } }}
        />
        <button className="ai-send-btn" onClick={() => void sendMessage()} disabled={loading}>
          ➤
        </button>
      </div>
      </>}
    </aside>
  );
}
