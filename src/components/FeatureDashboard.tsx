'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ActiveView, StudioUser } from './App';
import type { UseDeck } from '@/lib/useDeck';
import { getRuntime } from '@/lib/audio';
import { triggerFxSpec } from '@/lib/fxengine';
import type { FxSpec } from '@/lib/granite';

interface Props {
  view: ActiveView | string;
  onBack: () => void;
  deckA: UseDeck;
  deckB: UseDeck;
  ensureAudio: () => Promise<void>;
  user: StudioUser | null;
  onLogin: () => void;
}

const DATA: Record<string, { icon: string; title: string; sub: string; cards: Array<[string,string,string]> }> = {
  ai: { icon:'*', title:'AI DJ Assistant', sub:'Open the copilot on the right rail for live transition help', cards:[['Crowd Mood','Live','Energy-aware suggestions'],['Mix Explain','Ready','Theory behind every recommendation'],['Voice Commands','Enabled','Control decks by speech'],['Track Match','Analyzes','BPM, key and energy fit']] },
  settings: { icon:'⚙', title:'Studio Settings', sub:'Audio, profile and connected-service state', cards:[['Audio Engine','Web Audio','Low-latency browser playback'],['Freesound','Search ready','Preview and load samples'],['Spotify','OAuth route','Callback configured'],['Profile','Account based','Used by community and support']] },
  visuals: { icon:'◈', title:'Live Visuals', sub:'Audio-reactive visual modes controlled from the deck', cards:[['3D Scene','Available','Use Drop the Beat'],['Waveforms','Live','Deck A/B timeline'],['Meters','Reactive','Analyzer-driven levels'],['Lighting','Triggered','Drop overlay and pulses']] },
};

interface EditorTrack {
  id: string;
  name: string;
  url: string;
  buffer: AudioBuffer;
  start: number;
  end: number;
  selected: boolean;
}

function encodeWav(buffer: AudioBuffer) {
  const channels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const length = buffer.length * channels * 2 + 44;
  const arrayBuffer = new ArrayBuffer(length);
  const view = new DataView(arrayBuffer);
  let offset = 0;
  const writeString = (value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset++, value.charCodeAt(i));
  };
  writeString('RIFF');
  view.setUint32(offset, length - 8, true); offset += 4;
  writeString('WAVEfmt ');
  view.setUint32(offset, 16, true); offset += 4;
  view.setUint16(offset, 1, true); offset += 2;
  view.setUint16(offset, channels, true); offset += 2;
  view.setUint32(offset, sampleRate, true); offset += 4;
  view.setUint32(offset, sampleRate * channels * 2, true); offset += 4;
  view.setUint16(offset, channels * 2, true); offset += 2;
  view.setUint16(offset, 16, true); offset += 2;
  writeString('data');
  view.setUint32(offset, length - 44, true); offset += 4;

  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < channels; ch++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

async function renderTracks(tracks: EditorTrack[]) {
  if (tracks.length === 0) throw new Error('Select at least one track.');
  const sampleRate = tracks[0].buffer.sampleRate;
  const channels = Math.max(...tracks.map(t => t.buffer.numberOfChannels));
  const segmentLengths = tracks.map(t => Math.max(1, Math.round((t.end - t.start) * sampleRate)));
  const totalLength = segmentLengths.reduce((sum, length) => sum + length, 0);
  const offline = new OfflineAudioContext(channels, totalLength, sampleRate);
  const output = offline.createBuffer(channels, totalLength, sampleRate);
  let cursor = 0;

  tracks.forEach((track, trackIndex) => {
    const startSample = Math.round(track.start * track.buffer.sampleRate);
    const length = segmentLengths[trackIndex];
    for (let ch = 0; ch < channels; ch++) {
      const source = track.buffer.getChannelData(Math.min(ch, track.buffer.numberOfChannels - 1));
      const dest = output.getChannelData(ch);
      for (let i = 0; i < length; i++) dest[cursor + i] = source[startSample + i] ?? 0;
    }
    cursor += length;
  });

  const source = offline.createBufferSource();
  source.buffer = output;
  source.connect(offline.destination);
  source.start();
  return offline.startRendering();
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

const FX_PRESETS: FxSpec[] = [
  {
    label: 'Echo Out',
    totalDuration: 4,
    description: 'Quarter-beat echo tail for clean phrase exits.',
    events: [{ effect: 'echo', start: 0, duration: 3.5, delayTime: 0.25, feedback: 0.55, wetMix: 0.45 }],
  },
  {
    label: 'Riser Sweep',
    totalDuration: 5,
    description: 'Low-pass sweep with a light noise lift for buildups.',
    events: [
      { effect: 'filterSweep', start: 0, duration: 4.5, filterFrom: 220, filterTo: 16000, filterType: 'lowpass' },
      { effect: 'whiteNoise', start: 3.2, duration: 1, noiseLevel: 0.22 },
    ],
  },
  {
    label: 'Bass Punch',
    totalDuration: 3,
    description: 'Short bass reinforcement for a drop impact.',
    events: [{ effect: 'bassBoost', start: 0, duration: 2.5, boostDb: 7, boostFreq: 88 }],
  },
  {
    label: 'Stutter Break',
    totalDuration: 3,
    description: 'Tight gate chop before switching phrase.',
    events: [
      { effect: 'stutter', start: 0, duration: 1.5, stutterRate: 12, stutterDepth: 0.85 },
      { effect: 'echo', start: 1.2, duration: 1.6, delayTime: 0.18, feedback: 0.4, wetMix: 0.35 },
    ],
  },
];

function EffectSlider({ label, value, min, max, step, onChange, format }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
}) {
  return (
    <label className="fx-control">
      <span>{label}<b>{format(value)}</b></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} />
    </label>
  );
}

function PitchBpmCalculator() {
  const [original, setOriginal] = useState(100);
  const [next, setNext] = useState(120);
  const [precision, setPrecision] = useState(2);
  const safeOriginal = Math.max(1, original);
  const ratio = Math.max(0.01, next / safeOriginal);
  const semitones = 12 * Math.log2(ratio);
  const cents = semitones * 100;
  const tempoPct = (ratio - 1) * 100;
  const places = Math.max(0, Math.min(4, precision));

  return (
    <div className="fx-panel">
      <h3>BPM / Pitch Calculator</h3>
      <div className="pitch-calc-grid">
        <label>Original BPM<input type="number" min={1} value={original} onChange={e => setOriginal(Number(e.target.value) || 1)} /></label>
        <label>New BPM<input type="number" min={1} value={next} onChange={e => setNext(Number(e.target.value) || 1)} /></label>
        <label>Precision<input type="number" min={0} max={4} value={precision} onChange={e => setPrecision(Number(e.target.value) || 0)} /></label>
      </div>
      <p className="fx-help">Calculates pitch change when tempo changes without time-stretching.</p>
      <div className="pitch-result-grid">
        <div><b>{semitones >= 0 ? '+' : ''}{semitones.toFixed(places)}</b><span>semitones</span></div>
        <div><b>{cents >= 0 ? '+' : ''}{cents.toFixed(1)}</b><span>cents</span></div>
        <div><b>{ratio.toFixed(3)}</b><span>ratio</span></div>
        <div><b>{tempoPct >= 0 ? '+' : ''}{tempoPct.toFixed(1)}%</b><span>tempo</span></div>
      </div>
      <p className="support-status">
        Ratio = {next} / {safeOriginal} = {ratio.toFixed(4)}. Semitones = 12 x log2({ratio.toFixed(4)}) = {semitones.toFixed(places)}.
      </p>
    </div>
  );
}

function camelotDistance(a?: string, b?: string) {
  const pa = a?.match(/^(\d+)([AB])$/i);
  const pb = b?.match(/^(\d+)([AB])$/i);
  if (!pa || !pb) return null;
  const na = Number(pa[1]);
  const nb = Number(pb[1]);
  const ring = Math.min(Math.abs(na - nb), 12 - Math.abs(na - nb));
  const mode = pa[2].toUpperCase() === pb[2].toUpperCase() ? 0 : 1;
  return ring + mode;
}

function SmartMixPanel({ deckA, deckB }: Pick<Props, 'deckA' | 'deckB'>) {
  const aBpm = deckA.state.track?.analysis.tempoBpm ?? Math.round(deckA.state.tempo * 128);
  const bBpm = deckB.state.track?.analysis.tempoBpm ?? Math.round(deckB.state.tempo * 128);
  const ratio = aBpm ? bBpm / aBpm : 1;
  const pitch = 12 * Math.log2(Math.max(0.01, ratio));
  const keyA = '8A';
  const keyB = '9A';
  const keyFit = camelotDistance(keyA, keyB);
  const aDur = deckA.state.track?.duration ?? 0;
  const bDur = deckB.state.track?.duration ?? 0;
  const transitionAt = aDur ? Math.max(0, aDur * 0.72) : 0;
  const introBeats = bDur ? 16 : 0;

  return (
    <div className="fx-panel">
      <h3>Smart Transition / Match</h3>
      <div className="pitch-result-grid">
        <div><b>{aBpm}</b><span>Deck A BPM</span></div>
        <div><b>{bBpm}</b><span>Deck B BPM</span></div>
        <div><b>{((ratio - 1) * 100).toFixed(1)}%</b><span>tempo shift</span></div>
        <div><b>{pitch.toFixed(2)}</b><span>pitch semitones</span></div>
      </div>
      <p className="support-status">
        Suggested transition: start mixing Deck B around {transitionAt ? `${Math.round(transitionAt)}s` : 'the final 25%'} of Deck A and use a {introBeats || 16}-beat intro loop if the phrase feels short.
      </p>
      <p className="support-status">
        Harmonic match: {keyA} to {keyB} is {keyFit !== null && keyFit <= 1 ? 'compatible' : 'usable with EQ/filter help'}; use EQ lows carefully during the bass swap.
      </p>
      <button className="support-submit" onClick={() => deckB.setTempo(aBpm / Math.max(1, bBpm))} disabled={!deckA.state.track || !deckB.state.track}>
        Auto-match Deck B tempo to Deck A
      </button>
    </div>
  );
}

function StemSeparatorPanel() {
  const [status, setStatus] = useState('Upload a track to render quick browser stem previews.');

  const renderStem = async (file: File, mode: 'drums' | 'bass' | 'vocals') => {
    setStatus(`Rendering ${mode} preview...`);
    const ctx = new AudioContext();
    try {
      const buffer = await ctx.decodeAudioData(await file.arrayBuffer());
      const offline = new OfflineAudioContext(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
      const source = offline.createBufferSource();
      source.buffer = buffer;
      const filter = offline.createBiquadFilter();
      if (mode === 'bass') {
        filter.type = 'lowpass';
        filter.frequency.value = 180;
      } else if (mode === 'vocals') {
        filter.type = 'bandpass';
        filter.frequency.value = 1800;
        filter.Q.value = 0.9;
      } else {
        filter.type = 'highpass';
        filter.frequency.value = 120;
      }
      source.connect(filter);
      filter.connect(offline.destination);
      source.start();
      const rendered = await offline.startRendering();
      downloadBlob(encodeWav(rendered), `${file.name.replace(/\.[^.]+$/, '')}-${mode}.wav`);
      setStatus(`${mode} preview exported. This is a lightweight browser isolation, not a studio-grade neural stem model yet.`);
    } finally {
      await ctx.close();
    }
  };

  return (
    <div className="fx-panel">
      <h3>Experimental Stem Lab</h3>
      <p className="fx-help">Quick browser stem previews using Web Audio filters. Roadmap-ready for WebNN or TensorFlow.js model replacement.</p>
      <label className="support-submit">Upload for stems
        <input
          type="file"
          accept="audio/*"
          hidden
          onChange={e => {
            const file = e.target.files?.[0];
            if (file) void renderStem(file, 'vocals');
            e.currentTarget.value = '';
          }}
        />
      </label>
      <div className="auth-mode-row" style={{ marginTop: '.7rem' }}>
        {(['vocals', 'drums', 'bass'] as const).map(mode => (
          <label key={mode} className="support-submit">{mode}
            <input
              type="file"
              accept="audio/*"
              hidden
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) void renderStem(file, mode);
                e.currentTarget.value = '';
              }}
            />
          </label>
        ))}
      </div>
      <div className="support-status">{status}</div>
    </div>
  );
}

function EffectsPanel({ deckA, deckB, ensureAudio }: Pick<Props, 'deckA' | 'deckB' | 'ensureAudio'>) {
  const [target, setTarget] = useState<'A' | 'B'>('A');
  const [status, setStatus] = useState('Ready');
  const deck = target === 'A' ? deckA : deckB;
  const track = deck.state.track?.name ?? 'No track loaded';

  const firePreset = async (spec: FxSpec) => {
    await ensureAudio();
    const rt = getRuntime();
    if (!rt) {
      setStatus('Audio engine is not ready yet.');
      return;
    }
    triggerFxSpec(rt.ctx, spec);
    setStatus(`${spec.label} running for ${spec.totalDuration}s`);
  };

  const resetDeck = () => {
    deck.setEq('eqHigh', 0);
    deck.setEq('eqMid', 0);
    deck.setEq('eqLow', 0);
    deck.setFilter(0);
    deck.setTempo(1);
    deck.setVolume(0.8);
    setStatus(`Deck ${target} reset`);
  };

  return (
    <section className="feature-dashboard fx-page">
      <div className="feature-hero">
        <span>⚡</span>
        <div><h2>Effects Lab</h2><p>Shape the live deck with real EQ, filter, tempo, volume and timed Web Audio FX.</p></div>
      </div>
      <div className="fx-toolbar">
        <div className="auth-mode-row fx-target">
          <button className={target === 'A' ? 'active' : ''} onClick={() => setTarget('A')}>Deck A</button>
          <button className={target === 'B' ? 'active' : ''} onClick={() => setTarget('B')}>Deck B</button>
        </div>
        <div className="fx-track">{track}</div>
        <button className="support-submit" onClick={resetDeck}>Reset Deck</button>
      </div>

      <div className="fx-layout">
        <div className="fx-panel">
          <h3>Mixer Controls</h3>
          <EffectSlider label="High EQ" value={deck.state.eqHigh} min={-12} max={12} step={1} onChange={v => deck.setEq('eqHigh', v)} format={v => `${v > 0 ? '+' : ''}${v} dB`} />
          <EffectSlider label="Mid EQ" value={deck.state.eqMid} min={-12} max={12} step={1} onChange={v => deck.setEq('eqMid', v)} format={v => `${v > 0 ? '+' : ''}${v} dB`} />
          <EffectSlider label="Low EQ" value={deck.state.eqLow} min={-12} max={12} step={1} onChange={v => deck.setEq('eqLow', v)} format={v => `${v > 0 ? '+' : ''}${v} dB`} />
          <EffectSlider label="Filter" value={deck.state.filterCutoff} min={-1} max={1} step={0.01} onChange={deck.setFilter} format={v => Math.abs(v) < 0.02 ? 'Off' : v < 0 ? `LP ${Math.round(-v * 100)}` : `HP ${Math.round(v * 100)}`} />
          <EffectSlider label="Tempo" value={deck.state.tempo} min={0.5} max={2} step={0.01} onChange={deck.setTempo} format={v => `${Math.round((v - 1) * 100)}%`} />
          <EffectSlider label="Volume" value={deck.state.volume} min={0} max={1} step={0.01} onChange={deck.setVolume} format={v => `${Math.round(v * 100)}%`} />
        </div>

        <div className="fx-panel">
          <h3>Performance FX</h3>
          <div className="fx-preset-grid">
            {FX_PRESETS.map(spec => (
              <button key={spec.label} className="fx-preset-card" onClick={() => void firePreset(spec)}>
                <strong>{spec.label}</strong>
                <span>{spec.description}</span>
              </button>
            ))}
          </div>
          <div className="support-status">{status}</div>
        </div>
      </div>
      <div className="fx-layout" style={{ marginTop: '1rem' }}>
        <PitchBpmCalculator />
        <SmartMixPanel deckA={deckA} deckB={deckB} />
      </div>
      <div className="fx-layout" style={{ marginTop: '1rem' }}>
        <StemSeparatorPanel />
        <div className="fx-panel">
          <h3>Keyboard Manual</h3>
          <p className="fx-help">Enable Keyboard Shortcuts in Studio Settings, then use Space for Deck A play, Shift+Space for Deck B, 1-8 for Deck A hot cues, Shift+1-8 for Deck B, Q/W/E for 4/8/16 beat loops on Deck A, and A/S/D for Deck B.</p>
        </div>
      </div>
    </section>
  );
}

interface CommunityMessage {
  id: string;
  user: string;
  email: string;
  text: string;
  createdAt: string;
}

function CommunityPanel({ user, onLogin }: Pick<Props, 'user' | 'onLogin'>) {
  const [text, setText] = useState('');
  const [messages, setMessages] = useState<CommunityMessage[]>([]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('community-messages') ?? '[]') as CommunityMessage[];
      setMessages(saved);
    } catch {}
  }, []);

  const post = () => {
    if (!user || !text.trim()) return;
    const next = [{ id: crypto.randomUUID(), user: user.name, email: user.email, text: text.trim(), createdAt: new Date().toISOString() }, ...messages].slice(0, 80);
    setMessages(next);
    localStorage.setItem('community-messages', JSON.stringify(next));
    setText('');
  };

  return (
    <section className="feature-dashboard community-page">
      <div className="feature-hero">
        <span>◉</span>
        <div><h2>Community</h2><p>Send messages to signed-in studio users on this app instance.</p></div>
      </div>
      {!user ? (
        <div className="support-card">
          <h3>Login required</h3>
          <p>Sign in with Google or email to join the studio community chat.</p>
          <button className="support-submit" onClick={onLogin}>Open Login</button>
        </div>
      ) : (
        <>
          <div className="community-composer">
            <div className="community-user"><b>{user.name}</b><span>Signed in</span></div>
            <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Share a mix idea, ask for feedback, or invite others into a set..." />
            <button className="support-submit" onClick={post} disabled={!text.trim()}>Send Message</button>
          </div>
          <div className="community-feed">
            {messages.length === 0 && <div className="lib-empty">No community messages yet.</div>}
            {messages.map(msg => (
              <article key={msg.id} className="community-message">
                <div><b>{msg.user}</b><time>{new Date(msg.createdAt).toLocaleString()}</time></div>
                <p>{msg.text}</p>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function HelpPanel({ user }: Pick<Props, 'user'>) {
  const [kind, setKind] = useState<'support' | 'bug'>('support');
  const [email, setEmail] = useState(user?.email ?? '');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => { if (user?.email) setEmail(user.email); }, [user]);

  const submit = async () => {
    setStatus('Sending...');
    const res = await fetch('/api/support', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, email, name: user?.name ?? 'Studio user', message }),
    });
    const data = await res.json() as { ok: boolean; message: string; mailto?: string };
    setStatus(data.message);
    if (data.ok) setMessage('');
    if (data.mailto) window.location.href = data.mailto;
  };

  const faqs = [
    ['How do I load music?', 'Open Library, pick Load A or Load B, or upload your own audio file.'],
    ['Why are YouTube lessons no-cookie?', 'Lessons embed from youtube-nocookie.com to avoid regular YouTube tracking cookies before playback.'],
    ['How does progress save?', 'Lesson steps are stored locally in this browser and update as you complete them.'],
    ['How do I enable real email delivery?', 'Add the Gmail SMTP env values in .env.local. The receiving mailbox is kept on the server and is not shown in the app.'],
  ];

  return (
    <section className="feature-dashboard support-page">
      <div className="feature-hero">
        <span>?</span>
        <div><h2>Help & Feedback</h2><p>FAQ, support messages and bug reports in one working place.</p></div>
      </div>
      <div className="support-layout">
        <div className="support-card">
          <h3>FAQ</h3>
          {faqs.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}
        </div>
        <div className="support-card">
          <h3>{kind === 'support' ? 'Contact Support' : 'Report a Bug'}</h3>
          <div className="auth-mode-row">
            <button className={kind === 'support' ? 'active' : ''} onClick={() => setKind('support')}>Support</button>
            <button className={kind === 'bug' ? 'active' : ''} onClick={() => setKind('bug')}>Bug</button>
          </div>
          <label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
          <label>Message<textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Tell me what happened..." /></label>
          <button className="support-submit" onClick={() => void submit()} disabled={!email.trim() || !message.trim()}>Send</button>
          {status && <div className="support-status">{status}</div>}
        </div>
      </div>
    </section>
  );
}

function SettingsPanel({ user, onLogin }: Pick<Props, 'user' | 'onLogin'>) {
  const [settings, setSettings] = useState({
    tutorials: true,
    compactNav: false,
    highQualityViz: true,
    saveProgress: true,
    communityPresence: true,
    keyboardShortcuts: false,
  });

  useEffect(() => {
    setSettings(current => ({
      ...current,
      keyboardShortcuts: localStorage.getItem('keyboard-shortcuts-enabled') === 'true',
    }));
  }, []);

  const toggle = (key: keyof typeof settings) => {
    setSettings(current => {
      const next = { ...current, [key]: !current[key] };
      if (key === 'keyboardShortcuts') {
        localStorage.setItem('keyboard-shortcuts-enabled', String(next.keyboardShortcuts));
        window.dispatchEvent(new CustomEvent('keyboard-shortcuts-setting', { detail: next.keyboardShortcuts }));
      }
      return next;
    });
  };

  if (!user) {
    return (
      <section className="feature-dashboard support-page">
        <div className="feature-hero">
          <span>⚙</span>
          <div><h2>Studio Settings</h2><p>Login is required before studio preferences are shown.</p></div>
        </div>
        <div className="support-card">
          <h3>Account required</h3>
          <p>Your settings are tied to your studio identity so community, support and progress stay connected.</p>
          <button className="support-submit" onClick={onLogin}>Login / Sign up</button>
        </div>
      </section>
    );
  }

  return (
    <section className="feature-dashboard settings-page">
      <div className="feature-hero">
        <span>⚙</span>
        <div><h2>Studio Settings</h2><p>{user.name} · {user.email}</p></div>
      </div>
      <div className="settings-grid">
        {[
          ['tutorials', 'Deck Tutorials', 'Show guided deck training when new features are added.'],
          ['compactNav', 'Compact Navigation', 'Keep the side navigation collapsed by default.'],
          ['highQualityViz', 'High Quality Visualizer', 'Use richer 3D rings and analyzer animation.'],
          ['saveProgress', 'Save Learn DJ Progress', 'Store lesson task progress in this browser.'],
          ['communityPresence', 'Community Presence', 'Show your signed-in name in community messages.'],
          ['keyboardShortcuts', 'Keyboard Shortcuts', 'Enable deck control from keyboard and show the shortcut manual.'],
        ].map(([key, title, desc]) => (
          <label key={key} className="settings-toggle">
            <span><b>{title}</b><small>{desc}</small></span>
            <input type="checkbox" checked={settings[key as keyof typeof settings]} onChange={() => toggle(key as keyof typeof settings)} />
          </label>
        ))}
      </div>
      {settings.keyboardShortcuts && (
        <div className="shortcut-manual">
          <h3>Keyboard Navigation Enabled</h3>
          <div className="shortcut-grid">
            <span><b>Space</b>Deck A Play/Pause</span>
            <span><b>Shift + Space</b>Deck B Play/Pause</span>
            <span><b>1-8</b>Deck A Hot Cues</span>
            <span><b>Shift + 1-8</b>Deck B Hot Cues</span>
            <span><b>Q / W / E</b>Deck A 4 / 8 / 16 beat loop</span>
            <span><b>A / S / D</b>Deck B 4 / 8 / 16 beat loop</span>
          </div>
        </div>
      )}
    </section>
  );
}

function MusicEditorPanel() {
  const [tracks, setTracks] = useState<EditorTrack[]>([]);
  const [status, setStatus] = useState('Upload audio files to cut, edit, or merge.');

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setStatus('Decoding audio...');
    try {
      const audioContext = new AudioContext();
      const loaded = await Promise.all(Array.from(files).map(async (file) => {
        const buffer = await audioContext.decodeAudioData(await file.arrayBuffer());
        return {
          id: crypto.randomUUID(),
          name: file.name,
          url: URL.createObjectURL(file),
          buffer,
          start: 0,
          end: Number(buffer.duration.toFixed(2)),
          selected: true,
        } satisfies EditorTrack;
      }));
      await audioContext.close();
      setTracks(current => [...current, ...loaded]);
      setStatus(`${loaded.length} file${loaded.length === 1 ? '' : 's'} ready.`);
    } catch (error) {
      setStatus(`Could not decode audio: ${String(error)}`);
    }
  };

  const updateTrack = (id: string, patch: Partial<EditorTrack>) => {
    setTracks(current => current.map(track => track.id === id ? { ...track, ...patch } : track));
  };

  const removeTrack = (id: string) => {
    setTracks(current => {
      const target = current.find(track => track.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return current.filter(track => track.id !== id);
    });
  };

  const exportSelected = async (merge: boolean) => {
    const selected = tracks.filter(track => track.selected && track.end > track.start);
    if (selected.length === 0) {
      setStatus('Select at least one valid clip.');
      return;
    }
    try {
      setStatus(merge ? 'Rendering merged WAV...' : 'Rendering cut WAV...');
      if (merge) {
        const rendered = await renderTracks(selected);
        downloadBlob(encodeWav(rendered), 'ai-dj-studio-merged.wav');
        setStatus('Merged WAV exported.');
      } else {
        await Promise.all(selected.map(async (track) => {
          const rendered = await renderTracks([track]);
          downloadBlob(encodeWav(rendered), `${track.name.replace(/\.[^.]+$/, '')}-cut.wav`);
        }));
        setStatus('Selected cut exported.');
      }
    } catch (error) {
      setStatus(`Export failed: ${String(error)}`);
    }
  };

  return (
    <section className="feature-dashboard editor-page">
      <div className="feature-hero">
        <span>✂</span>
        <div><h2>Music Editor</h2><p>Cut, trim and merge songs directly in the browser.</p></div>
      </div>
      <div className="editor-toolbar">
        <label className="support-submit">Upload Audio<input type="file" accept="audio/*" multiple hidden onChange={e => void addFiles(e.target.files)} /></label>
        <button className="support-submit" onClick={() => void exportSelected(false)} disabled={tracks.length === 0}>Export Cuts</button>
        <button className="support-submit" onClick={() => void exportSelected(true)} disabled={tracks.length === 0}>Merge Selected</button>
        <div className="fx-track">{status}</div>
      </div>
      <div className="editor-list">
        {tracks.length === 0 && <div className="lib-empty">No audio loaded yet.</div>}
        {tracks.map(track => (
          <article key={track.id} className="editor-track">
            <label className="editor-select"><input type="checkbox" checked={track.selected} onChange={e => updateTrack(track.id, { selected: e.target.checked })} /> Use</label>
            <div className="editor-info">
              <b>{track.name}</b>
              <audio controls src={track.url} />
            </div>
            <label>Start<input type="number" min={0} max={track.end} step={0.1} value={track.start} onChange={e => updateTrack(track.id, { start: Math.max(0, Number(e.target.value)) })} /></label>
            <label>End<input type="number" min={track.start} max={track.buffer.duration} step={0.1} value={track.end} onChange={e => updateTrack(track.id, { end: Math.min(track.buffer.duration, Number(e.target.value)) })} /></label>
            <button className="sidebar-bottom-btn" onClick={() => removeTrack(track.id)} title="Remove">x</button>
          </article>
        ))}
      </div>
    </section>
  );
}

export default function FeatureDashboard(props: Props) {
  const { view, onBack, deckA, deckB, ensureAudio, user, onLogin } = props;
  const data = useMemo(() => DATA[view] ?? DATA.ai, [view]);

  if (view === 'effects') return <EffectsPanel deckA={deckA} deckB={deckB} ensureAudio={ensureAudio} />;
  if (view === 'community') return <CommunityPanel user={user} onLogin={onLogin} />;
  if (view === 'help') return <HelpPanel user={user} />;
  if (view === 'settings') return <SettingsPanel user={user} onLogin={onLogin} />;
  if (view === 'beatmaker') return <MusicEditorPanel />;

  return (
    <section className="feature-dashboard">
      <div className="feature-hero">
        <button onClick={onBack}>← DJ DECK</button>
        <span>{data.icon}</span>
        <div><h2>{data.title}</h2><p>{data.sub}</p></div>
      </div>
      <div className="feature-grid">
        {data.cards.map(([title, value, desc]) => (
          <div className="feature-card" key={title}><i>{title}</i><strong>{value}</strong><small>{desc}</small></div>
        ))}
      </div>
      <div className="analytics-strip">
        <div><b>{deckA.state.track ? Math.round(deckA.state.tempo * 128) : 128}</b><span>BPM</span></div>
        <div><b>{deckA.state.track || deckB.state.track ? 'LIVE' : 'READY'}</b><span>DECK STATE</span></div>
        <div><b>{user ? 'ON' : 'OFF'}</b><span>ACCOUNT</span></div>
        <div><b>{deckB.state.track ? 'B' : 'A'}</b><span>NEXT DECK</span></div>
      </div>
    </section>
  );
}
