'use client';
// App.tsx — AI DJ Studio shell.
// All WebAudio/WASM/Three.js imports are dynamic (lazy) — static imports of these
// run during the server-side module graph walk and crash with ReactCurrentOwner errors.
// NOTE: All imports MUST be at the top of the file — import-after-function is a
// parse error in strict ES modules.

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { initAudio, getRuntime, getMixRecordingStream, updateNativeDeck } from '@/lib/audio';
import { useDeck } from '@/lib/useDeck';
import type { UseDeck } from '@/lib/useDeck';
import TopNav           from './TopNav';
import Sidebar          from './Sidebar';
import DeckPanel        from './DeckPanel';
import MixerColumn      from './MixerColumn';
import PlaylistSection  from './PlaylistSection';
import AIAssistantPanel from './AIAssistantPanel';
import LiveVizSection   from './LiveVizSection';
import LearnerPanel     from './LearnerPanel';
import StreamPanel      from './StreamPanel';
import Waveform         from './Waveform';
import FeatureDashboard from './FeatureDashboard';
import ProfilePortal    from './ProfilePortal';
import DropTheBeat      from './DropTheBeat';
import DeckTutorial     from './DeckTutorial';
import AnimatedFooter   from './AnimatedFooter';
import { createClient } from '@/lib/supabase/client';
import { getSupabaseConfig } from '@/lib/env';

const Viz3D = dynamic(() => import('./Viz3D'), { ssr: false });
const VRMode = dynamic(() => import('./VRMode'), { ssr: false });
export type ActiveView = 'deck' | 'playlist' | 'ai' | 'beatmaker' | 'settings' | 'learner' | 'stream' | 'visuals' | 'help';

export interface StudioUser {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
  provider: 'local' | 'google' | 'facebook' | 'email';
}

// ── Helper used by DeckWaveformHeader ──────────────────────────────────────
function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ── Mini waveform strip inside the top dual-waveform header ───────────────
function DeckWaveformHeader({ deck, side }: { deck: UseDeck; side: 'a' | 'b' }) {
  const { track } = deck.state;
  const isA = side === 'a';

  return (
    <div className="waveform-header-deck">
      <div className="waveform-header-art">
        {track
          ? <span style={{ fontSize: '1.2rem' }}>{isA ? '🎵' : '🎶'}</span>
          : <span style={{ color: 'var(--muted)', fontSize: '0.7rem' }}>—</span>
        }
      </div>
      <div className="waveform-header-info">
        <div className="waveform-header-title">{track ? track.name : 'No track'}</div>
        {track && (
          <div className="waveform-header-meta">
            <span className="waveform-header-bpm">
              {Math.round(deck.state.tempo * 128)} BPM
            </span>
            <span className={`waveform-header-key${isA ? '' : ' deck-b'}`}>
              {isA ? '8A' : '9A'}
            </span>
          </div>
        )}
        <div className="waveform-header-canvas" style={{ height: 52, minHeight: 52 }}>
          <Waveform
            peaks={track?.peaks ?? null}
            position={deck.position}
            onSeek={deck.seek}
            cueNorm={deck.state.cueNorm}
            loopIn={deck.state.loopIn}
            loopOut={deck.state.loopOut}
            looping={deck.state.looping}
            deckColor={isA ? '#e040fb' : '#00e5ff'}
          />
        </div>
      </div>
    </div>
  );
}

// ── Main shell ────────────────────────────────────────────────────────────
export default function App() {
  const [audioReady, setAudioReady]   = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [activeTab, setActiveTab]     = useState<ActiveView>('deck');
  const [sidebarView, setSidebarView] = useState<string>('djdeck');
  const [viz3d, setViz3d]             = useState(false);
  const [vizOverlay, setVizOverlay]   = useState(false);
  const [navOpen, setNavOpen]         = useState(true);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [studioUser, setStudioUser] = useState<StudioUser | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [keyboardShortcuts, setKeyboardShortcuts] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);

  const deckA = useDeck('A', audioReady);
  const deckB = useDeck('B', audioReady);

  const [crossfader,   setCrossfader]   = useState(0);
  const [masterVolume, setMasterVolume] = useState(0.8);

  const ensureAudio = useCallback(async () => {
    await initAudio();
    setAudioReady(true);
  }, []);

  const downloadRecording = useCallback((blob: Blob) => {
    const ext = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm';
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    a.href = url;
    a.download = `ai-dj-studio-recording-${stamp}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      await ensureAudio();
      if (!('MediaRecorder' in window)) throw new Error('Recording is not supported in this browser.');
      const stream = getMixRecordingStream();
      const candidates = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4'];
      const mimeType = candidates.find(type => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = event => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        chunksRef.current = [];
        if (blob.size > 0) downloadRecording(blob);
      };
      recorder.start(1000);
      recorderRef.current = recorder;
      setRecording(true);
      setRecordingSeconds(0);
      if (recordingTimerRef.current !== null) window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = window.setInterval(() => setRecordingSeconds(v => v + 1), 1000);
    } catch (err) {
      setError(`Recording failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [downloadRecording, ensureAudio]);

  const stopRecording = useCallback(() => {
    if (recordingTimerRef.current !== null) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    const recorder = recorderRef.current;
    recorderRef.current = null;
    setRecording(false);
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  }, []);

  useEffect(() => () => {
    if (recordingTimerRef.current !== null) window.clearInterval(recordingTimerRef.current);
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
  }, []);

  // Native Web Audio playback is used for browser-selected files. Elementary stays
  // initialized with silence for the synthesis tools, avoiding duplicate playback.
  useEffect(() => {
    if (!audioReady) return;
    const rt = getRuntime();
    if (!rt) return;
    const t = (crossfader + 1) / 2;
    updateNativeDeck('A', deckA.state.volume * masterVolume * Math.cos(t * Math.PI * .5), deckA.state.tempo);
    updateNativeDeck('B', deckB.state.volume * masterVolume * Math.sin(t * Math.PI * .5), deckB.state.tempo);
  }, [audioReady, deckA.state.volume, deckA.state.tempo, deckB.state.volume, deckB.state.tempo, crossfader, masterVolume]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('view') === 'stream' || params.has('spotify_token') || params.has('spotify_error')) {
      setActiveTab('stream');
      setSidebarView('stream');
    }
  }, []);

  useEffect(() => {
    setKeyboardShortcuts(localStorage.getItem('keyboard-shortcuts-enabled') === 'true');
    const onSetting = (event: Event) => {
      setKeyboardShortcuts(Boolean((event as CustomEvent<boolean>).detail));
    };
    window.addEventListener('keyboard-shortcuts-setting', onSetting);
    return () => window.removeEventListener('keyboard-shortcuts-setting', onSetting);
  }, []);

  useEffect(() => {
    if (!keyboardShortcuts || activeTab !== 'deck' || sidebarView !== 'djdeck') return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, button, [contenteditable="true"]')) return;
      const key = event.key.toLowerCase();
      const targetDeck = event.shiftKey ? deckB : deckA;
      if (key === ' ') {
        event.preventDefault();
        if (event.shiftKey ? deckB.state.track : deckA.state.track) targetDeck.togglePlay();
      } else if (/^[1-8]$/.test(key)) {
        event.preventDefault();
        const index = Number(key) - 1;
        if (targetDeck.state.track) {
          if (targetDeck.state.hotCues[index] === null) targetDeck.setHotCue(index, targetDeck.position);
          else targetDeck.jumpHotCue(index);
        }
      } else if (key === 'q') { event.preventDefault(); if (deckA.state.track) deckA.setBeatLoop(4); }
      else if (key === 'w') { event.preventDefault(); if (deckA.state.track) deckA.setBeatLoop(8); }
      else if (key === 'e') { event.preventDefault(); if (deckA.state.track) deckA.setBeatLoop(16); }
      else if (key === 'a') { event.preventDefault(); if (deckB.state.track) deckB.setBeatLoop(4); }
      else if (key === 's') { event.preventDefault(); if (deckB.state.track) deckB.setBeatLoop(8); }
      else if (key === 'd') { event.preventDefault(); if (deckB.state.track) deckB.setBeatLoop(16); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeTab, deckA, deckB, keyboardShortcuts, sidebarView]);

  const loadDroppedFile = async (file: File, target: 'A' | 'B') => {
    setError(null);
    try {
      await ensureAudio();
      await (target === 'A' ? deckA : deckB).load(file);
    } catch (err) {
      setError(`Drop load failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <div
      className="studio-shell"
      onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDragActive(false); }}
      onDrop={(e) => {
        e.preventDefault();
        setDragActive(false);
        const file = Array.from(e.dataTransfer.files).find(f => f.type.startsWith('audio/') || /\.(mp3|wav|m4a|aac|flac|ogg|opus)$/i.test(f.name));
        if (file) void loadDroppedFile(file, e.shiftKey ? 'B' : 'A');
      }}
    >
      {/* ── Top nav bar ── */}
      <TopNav
        activeTab={activeTab}
        setActiveTab={(tab) => {
          if (tab === 'settings' && !studioUser) {
            setProfileOpen(true);
            return;
          }
          setActiveTab(tab);
          if (tab === 'deck')           setSidebarView('djdeck');
          else if (tab === 'learner')   setSidebarView('learner');
          else if (tab === 'stream')    setSidebarView('stream');
          else if (tab === 'beatmaker') setSidebarView('beatmaker');
          if (tab === 'ai') setAssistantOpen(true);
        }}
        deckAName={deckA.state.track?.name}
        deckBName={deckB.state.track?.name}
        onProfile={() => setProfileOpen(true)}
        profileImage={profileImage}
        user={studioUser}
      />

      <div className="studio-body">
        {/* ── Left sidebar ── */}
        <Sidebar
          activeView={sidebarView}
          setActiveView={(view) => {
            setSidebarView(view);
            if (view === 'djdeck')    setActiveTab('deck');
          else if (view === 'learner')  setActiveTab('learner');
          else if (view === 'stream')   setActiveTab('stream');
          else if (view === 'beatmaker') setActiveTab('beatmaker');
          else if (view === 'help') setActiveTab('help');
          else setActiveTab('deck');
          }}
          deckA={deckA}
          deckB={deckB}
          open={navOpen}
          onToggle={() => setNavOpen(v => !v)}
          onSettings={() => {
            if (!studioUser) {
              setProfileOpen(true);
              return;
            }
            setSidebarView('settings');
            setActiveTab('settings');
          }}
          onHelp={() => { setSidebarView('help'); setActiveTab('help'); }}
          onLogout={() => {
            if (!studioUser) return;
            const cfg = getSupabaseConfig();
            if (cfg.url && cfg.anonKey) void createClient().auth.signOut();
            setStudioUser(null);
            setProfileImage(null);
            setActiveTab('deck');
            setSidebarView('djdeck');
            try { localStorage.removeItem('studio-user'); } catch {}
          }}
          user={studioUser}
        />

        {/* ── Center stage ── */}
        <div className="center-stage">
          {activeTab === 'deck' && sidebarView === 'djdeck' && (
            <>
              {/* Dual waveform header */}
              <div className="waveform-header">
                <DeckWaveformHeader deck={deckA} side="a" />
                <div className="waveform-center-col">
                  <div className="waveform-center-time">
                    {deckA.state.track
                      ? fmt(deckA.position * (deckA.state.track.duration ?? 0))
                      : '0:00'}
                  </div>
                  <DropTheBeat
                    compact
                    enabled={Boolean(deckA.state.track || deckB.state.track)}
                    onDrop={async () => {
                      await ensureAudio();
                      const target = deckA.state.track ? deckA : deckB;
                      if (!target.state.playing) target.togglePlay();
                      setVizOverlay(true);
                    }}
                    onClose={() => setVizOverlay(false)}
                  />
                  <button
                    className={`record-mix-btn${recording ? ' recording' : ''}`}
                    onClick={() => recording ? stopRecording() : void startRecording()}
                    title={recording ? 'Stop and download recording' : 'Record the mixed output'}
                  >
                    {recording ? `STOP ${fmt(recordingSeconds)}` : 'REC'}
                  </button>
                </div>
                <DeckWaveformHeader deck={deckB} side="b" />
              </div>

              {/* Decks + mixer */}
              <div className="decks-row">
                <DeckPanel
                  deck={deckA}
                  label="A"
                  deckClass="deck-a"
                  ensureAudio={ensureAudio}
                />
                <MixerColumn
                  crossfader={crossfader}     setCrossfader={setCrossfader}
                  masterVolume={masterVolume}  setMasterVolume={setMasterVolume}
                  deckA={deckA} deckB={deckB}
                />
                <DeckPanel deck={deckB} label="B" deckClass="deck-b" ensureAudio={ensureAudio} />
              </div>
              {(deckA.state.playing || deckB.state.playing) && (
                <div className="deck-nitrogen" aria-hidden="true">
                  {Array.from({ length: 12 }, (_, i) => <i key={i} style={{ '--fog-i': i } as React.CSSProperties} />)}
                  <span className="nitrogen-jet left" /><span className="nitrogen-jet right" />
                </div>
              )}

              {/* Bottom: Playlist + Live Visualizer */}
              <div className="bottom-panel">
                <PlaylistSection onLoadToDeck={ensureAudio} deckA={deckA} deckB={deckB} user={studioUser} onLogin={() => setProfileOpen(true)} />
                <LiveVizSection viz3d={viz3d} setViz3d={setViz3d} onExpand3d={() => setVizOverlay(v => !v)} />
              </div>
              {keyboardShortcuts && (
                <div className="keyboard-live-badge" title="Keyboard shortcuts are enabled">
                  KEYBOARD ON · Space play · 1-8 cues · Q/W/E loops
                </div>
              )}
            </>
          )}

          {activeTab === 'learner' && <LearnerPanel />}
          {activeTab === 'stream'  && <StreamPanel deckA={deckA} deckB={deckB} ensureAudio={ensureAudio} />}
          {activeTab === 'playlist' && <PlaylistSection onLoadToDeck={ensureAudio} deckA={deckA} deckB={deckB} user={studioUser} onLogin={() => setProfileOpen(true)} />}
          {activeTab !== 'deck' && activeTab !== 'learner' && activeTab !== 'stream' && (
            activeTab !== 'playlist' && <FeatureDashboard
              view={activeTab}
              onBack={() => { setActiveTab('deck'); setSidebarView('djdeck'); }}
              deckA={deckA}
              deckB={deckB}
              ensureAudio={ensureAudio}
              user={studioUser}
              onLogin={() => setProfileOpen(true)}
            />
          )}
          {activeTab === 'deck' && sidebarView === 'library' && (
            <PlaylistSection onLoadToDeck={ensureAudio} deckA={deckA} deckB={deckB} user={studioUser} onLogin={() => setProfileOpen(true)} />
          )}
          {activeTab === 'deck' && sidebarView !== 'djdeck' && !['learner', 'stream'].includes(sidebarView) && (
            sidebarView !== 'library' && <FeatureDashboard
              view={sidebarView}
              onBack={() => { setSidebarView('djdeck'); }}
              deckA={deckA}
              deckB={deckB}
              ensureAudio={ensureAudio}
              user={studioUser}
              onLogin={() => setProfileOpen(true)}
            />
          )}
          <div className="studio-animated-footer-wrap">
            <AnimatedFooter headingLines={['BUILT BY', 'SHIVAM']} leftImage="/animated-footer/image1.png" rightImage="/animated-footer/image1.png" />
          </div>
        </div>

        {/* ── Right: AI Assistant panel ── */}
        <AIAssistantPanel
          deckA={deckA} deckB={deckB}
          crossfader={crossfader}    setCrossfader={setCrossfader}
          masterVolume={masterVolume} setMasterVolume={setMasterVolume}
          open={assistantOpen}
          onToggle={() => setAssistantOpen(v => !v)}
        />
      </div>

      {/* 3D visualizer overlay */}
      <Viz3D active={vizOverlay} />
      <VRMode />
      <ProfilePortal
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        image={profileImage}
        setImage={setProfileImage}
        user={studioUser}
        setUser={setStudioUser}
      />
      {/* First-visit DJ Deck tutorial */}
      <DeckTutorial
        active={activeTab === 'deck' && sidebarView === 'djdeck'}
        onNavigate={(target) => {
          if (target === 'library') setSidebarView('library');
          if (target === 'ai') setAssistantOpen(true);
          setActiveTab('deck');
        }}
      />
      {error && (
        <div className="error-msg" style={{ position: 'fixed', bottom: 8, left: 170, right: 330, zIndex: 999 }}>
          {error}
        </div>
      )}
      {dragActive && (
        <div className="drop-audio-overlay">
          <b>DROP AUDIO TO LOAD DECK A</b>
          <span>Hold Shift while dropping to load Deck B</span>
        </div>
      )}
    </div>
  );
}
