'use client';
// PlaylistSection — Professional Rekordbox-style music library manager.
// Tabs: Library | Freesound | Favorites
// Features: sortable columns, search, filter by genre/artist/BPM/key/energy,
//           per-track Analyze modal (waveform + beat grid + cue points),
//           Freesound search with load-to-deck.

import { useRef, useState, useCallback, useEffect } from 'react';
import type { UseDeck } from '@/lib/useDeck';
import type { TrackData } from '@/lib/track';
import type { StudioUser } from './App';

/* ─── Types ───────────────────────────────────────────────────────────── */
interface LibraryTrack {
  id: number;
  name: string;
  artist: string;
  genre: string;
  bpm: number;
  key: string;
  keyColor: 'pink' | 'cyan' | 'purple' | 'green';
  energy: 'low' | 'medium' | 'high';
  energyPct: number; // 0–100
  duration: string;
  durationSec: number;
  favorite: boolean;
  src: string;
  custom?: boolean;
  storageKey?: string;
  fileName?: string;
  fileType?: string;
  // populated after Analyze
  analysis?: TrackData['analysis'] & { cuePoints?: number[] };
}

interface FreesoundResult {
  id: number;
  name: string;
  username: string;
  duration: number;
  previews: { 'preview-hq-mp3': string; 'preview-lq-mp3': string };
  images: { waveform_m: string };
  tags: string[];
  avg_rating: number;
  num_downloads: number;
}

type SortKey = 'name' | 'artist' | 'bpm' | 'key' | 'energy' | 'duration' | 'genre';
type SortDir = 'asc' | 'desc';
type LibTab  = 'library' | 'preloaded' | 'freesound' | 'favorites';

const PRELOADED_DB = 'ai-dj-studio-preloaded-v1';
const PRELOADED_STORE = 'tracks';
const TRACK_ARTWORK = [
  '/track-images/Track1.jpg',
  '/track-images/Track2.jpeg',
  '/track-images/Track3.jpg',
  '/track-images/Track4.jpg',
  '/track-images/Track5.webp',
];

function artworkForTrack(track: LibraryTrack) {
  return TRACK_ARTWORK[Math.abs(track.id - 1) % TRACK_ARTWORK.length];
}

function friendlyTrackName(fileName: string) {
  return fileName
    .replace(/\.[^.]+$/, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function openPreloadedDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(PRELOADED_DB, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(PRELOADED_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open preloaded song storage.'));
  });
}

async function savePreloadedFile(key: string, file: File) {
  const db = await openPreloadedDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(PRELOADED_STORE, 'readwrite');
    tx.objectStore(PRELOADED_STORE).put(file, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Could not save track.'));
  });
  db.close();
}

async function readPreloadedFile(key: string): Promise<File | null> {
  const db = await openPreloadedDb();
  const file = await new Promise<File | null>((resolve, reject) => {
    const tx = db.transaction(PRELOADED_STORE, 'readonly');
    const request = tx.objectStore(PRELOADED_STORE).get(key);
    request.onsuccess = () => resolve((request.result as File | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error('Could not read track.'));
  });
  db.close();
  return file;
}

async function deletePreloadedFile(key: string) {
  const db = await openPreloadedDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(PRELOADED_STORE, 'readwrite');
    tx.objectStore(PRELOADED_STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Could not delete track.'));
  });
  db.close();
}

/* ─── Demo tracks ─────────────────────────────────────────────────────── */
const DEMO_TRACKS: LibraryTrack[] = [
  { id:1,  name:'Electric Awakening', artist:'Arc Reactor',  genre:'Electro House', bpm:128, key:'8A', keyColor:'pink',   energy:'high',   energyPct:88, duration:'6:24', durationSec:384, favorite:false, src:'/music/electric-awakening.mp3' },
  { id:2,  name:'Neon Overdrive',     artist:'Cyberwave',    genre:'EDM',           bpm:130, key:'9A', keyColor:'cyan',   energy:'high',   energyPct:92, duration:'5:48', durationSec:348, favorite:true,  src:'/music/neon-overdrive.mp3' },
  { id:3,  name:'Voltage Theory',     artist:'Tesla Club',   genre:'Electro',       bpm:126, key:'7A', keyColor:'pink',   energy:'medium', energyPct:72, duration:'7:02', durationSec:422, favorite:false, src:'/music/voltage-theory.mp3' },
  { id:4,  name:'Bassquake Protocol', artist:'Ion Storm',    genre:'Extreme Bass',  bpm:150, key:'10A',keyColor:'purple', energy:'high',   energyPct:98, duration:'4:30', durationSec:270, favorite:true,  src:'/music/bassquake-protocol.mp3' },
  { id:5,  name:'Future Horizon',     artist:'Nova Sequence',genre:'Future Bass',   bpm:140, key:'6A', keyColor:'cyan',   energy:'medium', energyPct:75, duration:'6:10', durationSec:370, favorite:false, src:'/music/future-horizon.mp3' },
  { id:6,  name:'Midnight Rush',      artist:'Arcade Youth', genre:'Synthwave',     bpm:128, key:'8A', keyColor:'cyan',   energy:'medium', energyPct:68, duration:'5:55', durationSec:355, favorite:false, src:'/music/midnight-rush.mp3' },
  { id:7,  name:'Neon Pulse',         artist:'Night Circuit',genre:'Techno',        bpm:136, key:'9A', keyColor:'pink',   energy:'high',   energyPct:85, duration:'6:40', durationSec:400, favorite:true,  src:'/music/neon-pulse.mp3' },
  { id:8,  name:'Quantum Dreams',     artist:'Astral Code',  genre:'Progressive',   bpm:122, key:'5A', keyColor:'cyan',   energy:'low',    energyPct:45, duration:'7:18', durationSec:438, favorite:false, src:'/music/quantum-dreams.mp3' },
  { id:9,  name:'Synthetic Hearts',   artist:'Chrome Lovers',genre:'Synth Pop',     bpm:118, key:'4A', keyColor:'green',  energy:'low',    energyPct:42, duration:'4:52', durationSec:292, favorite:false, src:'/music/synthetic-hearts.mp3' },
  { id:10, name:'Digital Utopia',     artist:'Binary Sun',   genre:'Trance',        bpm:138, key:'11A',keyColor:'purple', energy:'high',   energyPct:90, duration:'7:44', durationSec:464, favorite:false, src:'/music/digital-utopia.mp3' },
  { id:11, name:'Chrome Odyssey',     artist:'Steel Horizon',genre:'Industrial',    bpm:145, key:'3A', keyColor:'pink',   energy:'high',   energyPct:82, duration:'5:20', durationSec:320, favorite:false, src:'/music/chrome-odyssey.mp3' },
  { id:12, name:'Starfall Protocol',  artist:'Orbit Drive',  genre:'Space Techno',  bpm:132, key:'2A', keyColor:'cyan',   energy:'medium', energyPct:70, duration:'6:55', durationSec:415, favorite:true,  src:'/music/starfall-protocol.mp3' },
];

const PRELOADED_TRACKS: LibraryTrack[] = [
  { id:101, name:'Back Once More (Musical Freedom)', artist:'NextSong', genre:'Pre-loaded', bpm:128, key:'8A', keyColor:'pink', energy:'high', energyPct:84, duration:'Local', durationSec:0, favorite:false, src:'/preloaded/BACK%20ONCE%20MORE%20%5BMUSICAL%20FREEDOM%5D.m4a' },
  { id:102, name:'Back Once More', artist:'NextSong', genre:'Pre-loaded', bpm:128, key:'8A', keyColor:'cyan', energy:'high', energyPct:82, duration:'Local', durationSec:0, favorite:false, src:'/preloaded/BackOnceMore.mp3' },
  { id:103, name:'Broken Love', artist:'NextSong', genre:'Pre-loaded', bpm:124, key:'6A', keyColor:'purple', energy:'medium', energyPct:66, duration:'Local', durationSec:0, favorite:false, src:'/preloaded/BrokenLove.mp3' },
  { id:104, name:'Good With It', artist:'NextSong', genre:'Pre-loaded', bpm:126, key:'7A', keyColor:'green', energy:'medium', energyPct:72, duration:'Local', durationSec:0, favorite:false, src:'/preloaded/GoodWithIt.mp3' },
  { id:105, name:'Mehbooba', artist:'NextSong', genre:'Pre-loaded', bpm:120, key:'5A', keyColor:'pink', energy:'medium', energyPct:70, duration:'Local', durationSec:0, favorite:false, src:'/preloaded/Mehbooba.m4a' },
  { id:106, name:'Yesterday', artist:'NextSong', genre:'Pre-loaded', bpm:118, key:'4A', keyColor:'cyan', energy:'low', energyPct:48, duration:'Local', durationSec:0, favorite:false, src:'/preloaded/Yesterday.mp3' },
];

const KEY_COLOR: Record<string, string> = {
  pink:   'var(--pink)',
  cyan:   'var(--cyan)',
  purple: '#b57bee',
  green:  '#4caf50',
};

const ENERGY_COLOR: Record<string, string> = {
  high:   '#4caf50',
  medium: '#ff9800',
  low:    '#e040fb',
};

const GENRES   = ['All', ...Array.from(new Set(DEMO_TRACKS.map(t => t.genre))).sort()];
const ARTISTS  = ['All', ...Array.from(new Set(DEMO_TRACKS.map(t => t.artist))).sort()];
const ENERGIES: Array<'All' | 'low' | 'medium' | 'high'> = ['All', 'high', 'medium', 'low'];

const FREESOUND_FILTERS = [
  { label: 'All',        filter: '' },
  { label: 'Loop',       filter: 'tag:loop' },
  { label: 'Drums',      filter: 'tag:drums' },
  { label: 'Bass',       filter: 'tag:bass' },
  { label: 'Synth',      filter: 'tag:synth' },
  { label: 'FX',         filter: 'tag:effect' },
  { label: 'Vocal',      filter: 'tag:vocal' },
];

function fmtDur(s: number) {
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${m}:${String(ss).padStart(2, '0')}`;
}

function energyLabel(e: string) {
  return e === 'high' ? '●●●' : e === 'medium' ? '●●○' : '●○○';
}

function generatedDemoFile(track: LibraryTrack) {
  const sampleRate = 44100;
  const seconds = 16;
  const frames = sampleRate * seconds;
  const channels = 2;
  const bytesPerSample = 2;
  const dataBytes = frames * channels * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  let offset = 0;
  const writeString = (value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset++, value.charCodeAt(i));
  };
  const writeU32 = (value: number) => { view.setUint32(offset, value, true); offset += 4; };
  const writeU16 = (value: number) => { view.setUint16(offset, value, true); offset += 2; };

  writeString('RIFF');
  writeU32(36 + dataBytes);
  writeString('WAVE');
  writeString('fmt ');
  writeU32(16);
  writeU16(1);
  writeU16(channels);
  writeU32(sampleRate);
  writeU32(sampleRate * channels * bytesPerSample);
  writeU16(channels * bytesPerSample);
  writeU16(16);
  writeString('data');
  writeU32(dataBytes);

  const beatHz = track.bpm / 60;
  const root = 55 * Math.pow(2, ((track.id % 12) + 12) / 12);
  for (let i = 0; i < frames; i++) {
    const t = i / sampleRate;
    const beatPhase = (t * beatHz) % 1;
    const kick = Math.exp(-beatPhase * 18) * Math.sin(2 * Math.PI * (52 + 30 * (1 - beatPhase)) * t);
    const bass = Math.sin(2 * Math.PI * root * t) * 0.22;
    const hat = beatPhase > 0.48 && beatPhase < 0.55 ? (Math.random() * 2 - 1) * 0.09 : 0;
    const lead = Math.sin(2 * Math.PI * root * 2 * t) * 0.08 * (0.5 + 0.5 * Math.sin(2 * Math.PI * beatHz * 0.25 * t));
    const sample = Math.max(-0.85, Math.min(0.85, kick * 0.42 + bass + hat + lead));
    const pcm = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    view.setInt16(offset, pcm, true);
    view.setInt16(offset + 2, pcm * 0.92, true);
    offset += 4;
  }

  return new File([buffer], `${track.name} generated.wav`, { type: 'audio/wav' });
}

function FreesoundWaveformImage({ sound }: { sound: FreesoundResult }) {
  const [failed, setFailed] = useState(false);
  const src = sound.images?.waveform_m;
  if (!src || failed) {
    return (
      <div className="fs-wave-fallback">
        {Array.from({ length: 24 }, (_, i) => (
          <span key={i} style={{ height: `${20 + Math.abs(Math.sin((i + sound.id) * 0.65)) * 60}%` }} />
        ))}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={sound.name}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 4 }}
    />
  );
}

/* ─── Analyze modal component ─────────────────────────────────────────── */
interface AnalyzeResult {
  bpm: number;
  key: string;
  energy: string;
  energyPct: number;
  brightness: string;
  dynamicRange: number;
  cuePoints: number[]; // time in seconds
  durationSec: number;
}

interface AnalyzeModalProps {
  track: LibraryTrack;
  realAnalysis?: TrackData['analysis'] | null;
  durationSec?: number;
  onClose: () => void;
  onLoadA: () => void;
  onLoadB: () => void;
}

function buildFakeWaveform(bpm: number, energyPct: number, seed: number): number[] {
  const bars = 120;
  return Array.from({ length: bars }, (_, i) => {
    const base = energyPct / 100;
    const beat = Math.abs(Math.sin((i / bars) * bpm * 0.25 + seed));
    const noise = Math.abs(Math.sin(i * 1.37 + seed * 2)) * 0.3;
    return Math.min(1, base * 0.4 + beat * 0.4 + noise * 0.2 + 0.05);
  });
}

function AnalyzeModal({ track, realAnalysis, durationSec, onClose, onLoadA, onLoadB }: AnalyzeModalProps) {
  const dur = durationSec ?? track.durationSec;
  const analysis: AnalyzeResult = realAnalysis
    ? {
        bpm:          realAnalysis.tempoBpm,
        key:          track.key,
        energy:       realAnalysis.energy,
        energyPct:    Math.round(realAnalysis.rmsEnergy * 100),
        brightness:   realAnalysis.brightness,
        dynamicRange: Math.round(realAnalysis.dynamicRange),
        cuePoints:    [
          Math.round(dur * 0.04),
          Math.round(dur * 0.25),
          Math.round(dur * 0.50),
          Math.round(dur * 0.75),
        ],
        durationSec:  dur,
      }
    : {
        bpm:          track.bpm,
        key:          track.key,
        energy:       track.energy,
        energyPct:    track.energyPct,
        brightness:   track.energyPct > 70 ? 'bright' : track.energyPct > 45 ? 'balanced' : 'dark',
        dynamicRange: 8 + Math.round(track.energyPct / 10),
        cuePoints:    [
          Math.round(dur * 0.04),
          Math.round(dur * 0.25),
          Math.round(dur * 0.50),
          Math.round(dur * 0.75),
        ],
        durationSec:  dur,
      };

  const waveform = buildFakeWaveform(analysis.bpm, analysis.energyPct, track.id);
  const beatInterval = 60 / analysis.bpm; // seconds per beat
  const beatsTotal   = Math.floor(analysis.durationSec / beatInterval);
  // show beat markers every 4 beats
  const beatMarkers  = Array.from({ length: Math.floor(beatsTotal / 4) }, (_, i) => i * 4 * beatInterval);

  return (
    <div className="lib-modal-overlay" onClick={onClose}>
      <div className="lib-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="lib-modal-header">
          <div className="lib-modal-title">
            <span className="lib-modal-icon">🔬</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{track.name}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text2)' }}>{track.artist} · {track.genre}</div>
            </div>
          </div>
          <button className="lib-modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Stats row */}
        <div className="lib-analyze-stats">
          {[
            { label: 'Detected BPM',   val: analysis.bpm,                    color: 'var(--pink)' },
            { label: 'Key',            val: analysis.key,                    color: 'var(--cyan)' },
            { label: 'Energy Score',   val: `${analysis.energyPct}%`,        color: ENERGY_COLOR[analysis.energy] ?? '#888' },
            { label: 'Brightness',     val: analysis.brightness,             color: '#b57bee' },
            { label: 'Dynamic Range',  val: `${analysis.dynamicRange} dB`,   color: 'var(--text2)' },
            { label: 'Duration',       val: fmtDur(analysis.durationSec),    color: 'var(--text2)' },
          ].map(({ label, val, color }) => (
            <div key={label} className="lib-analyze-stat">
              <div className="lib-analyze-stat-val" style={{ color }}>{val}</div>
              <div className="lib-analyze-stat-lbl">{label}</div>
            </div>
          ))}
        </div>

        {/* Waveform + beat grid */}
        <div className="lib-analyze-section-title">Waveform + Beat Grid</div>
        <div className="lib-waveform-wrap">
          {/* Waveform bars */}
          <div className="lib-waveform-bars">
            {waveform.map((h, i) => (
              <div
                key={i}
                className="lib-waveform-bar"
                style={{
                  height: `${Math.round(h * 100)}%`,
                  background: `hsl(${280 + h * 60}, 80%, ${45 + h * 25}%)`,
                }}
              />
            ))}
          </div>
          {/* Beat grid overlay */}
          <div className="lib-beatgrid-overlay">
            {beatMarkers.slice(0, 30).map((t, i) => (
              <div
                key={i}
                className={`lib-beat-marker${i % 4 === 0 ? ' bar' : ''}`}
                style={{ left: `${(t / analysis.durationSec) * 100}%` }}
              />
            ))}
            {/* Cue point markers */}
            {analysis.cuePoints.map((t, i) => (
              <div
                key={`cue-${i}`}
                className="lib-cue-marker"
                style={{ left: `${(t / analysis.durationSec) * 100}%` }}
              >
                <div className="lib-cue-flag">{i + 1}</div>
              </div>
            ))}
          </div>
          {/* Time ruler */}
          <div className="lib-time-ruler">
            {[0, 0.25, 0.5, 0.75, 1].map(pct => (
              <span key={pct} style={{ position: 'absolute', left: `${pct * 100}%`, transform: 'translateX(-50%)' }}>
                {fmtDur(pct * analysis.durationSec)}
              </span>
            ))}
          </div>
        </div>

        {/* Suggested Cue Points */}
        <div className="lib-analyze-section-title">Suggested Cue Points</div>
        <div className="lib-cue-list">
          {analysis.cuePoints.map((t, i) => {
            const labels = ['Intro Start', '1st Drop', 'Breakdown', 'Outro'];
            const colors = ['var(--pink)', 'var(--cyan)', '#ff9800', '#b57bee'];
            return (
              <div key={i} className="lib-cue-item">
                <div className="lib-cue-num" style={{ background: colors[i] }}>{i + 1}</div>
                <div className="lib-cue-info">
                  <div style={{ fontWeight: 600, fontSize: '0.75rem' }}>{labels[i]}</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>
                    Beat {Math.round(t / beatInterval)} · {fmtDur(t)}
                  </div>
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text2)', marginLeft: 'auto' }}>{fmtDur(t)}</div>
              </div>
            );
          })}
        </div>

        {/* Load buttons */}
        <div className="lib-modal-actions">
          <button className="lib-load-btn a" onClick={onLoadA}>→ Load to Deck A</button>
          <button className="lib-load-btn b" onClick={onLoadB}>→ Load to Deck B</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Props ───────────────────────────────────────────────────────────── */
interface Props {
  onLoadToDeck: () => Promise<void>;
  deckA: UseDeck;
  deckB: UseDeck;
  user?: StudioUser | null;
  onLogin?: () => void;
}

/* ─── Main component ──────────────────────────────────────────────────── */
export default function PlaylistSection({ deckA, deckB, onLoadToDeck, user, onLogin }: Props) {
  /* ── Library state ── */
  const [activeTab, setActiveTab] = useState<LibTab>('library');
  const [tracks, setTracks]       = useState<LibraryTrack[]>(DEMO_TRACKS);
  const [savedPreloaded, setSavedPreloaded] = useState<LibraryTrack[]>([]);
  const [search, setSearch]       = useState('');
  const [sortKey, setSortKey]     = useState<SortKey>('name');
  const [sortDir, setSortDir]     = useState<SortDir>('asc');
  const [filterGenre, setFilterGenre]   = useState('All');
  const [filterArtist, setFilterArtist] = useState('All');
  const [filterEnergy, setFilterEnergy] = useState<'All' | 'low' | 'medium' | 'high'>('All');
  const [filterBpmMin, setFilterBpmMin] = useState('');
  const [filterBpmMax, setFilterBpmMax] = useState('');
  const [selectedId, setSelectedId]     = useState<number | null>(null);
  const [analyzeTrack, setAnalyzeTrack] = useState<LibraryTrack | null>(null);
  const [uploading, setUploading]       = useState<'A' | 'B' | null>(null);
  const [loadError, setLoadError]       = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const preloadedInputRef = useRef<HTMLInputElement>(null);
  const targetDeckRef = useRef<'A' | 'B'>('A');

  /* ── Freesound state ── */
  const [fsQuery, setFsQuery]       = useState('');
  const [fsFilter, setFsFilter]     = useState('');
  const [fsResults, setFsResults]   = useState<FreesoundResult[]>([]);
  const [fsLoading, setFsLoading]   = useState(false);
  const [fsStatus, setFsStatus]     = useState<string | null>(null);
  const [fsPreviewId, setFsPreviewId] = useState<number | null>(null);
  const fsAudioRef = useRef<HTMLAudioElement | null>(null);

  /* ── Sort handler ── */
  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const sortIcon = (key: SortKey) =>
    sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';

  const customPreloadedKey = user ? `preloaded-tracks:${user.id}` : null;

  useEffect(() => {
    if (!customPreloadedKey) {
      setSavedPreloaded([]);
      return;
    }
    try {
      const saved = JSON.parse(localStorage.getItem(customPreloadedKey) ?? '[]') as LibraryTrack[];
      setSavedPreloaded(saved);
    } catch {
      setSavedPreloaded([]);
    }
  }, [customPreloadedKey]);

  const persistSavedPreloaded = useCallback((next: LibraryTrack[]) => {
    setSavedPreloaded(next);
    if (customPreloadedKey) localStorage.setItem(customPreloadedKey, JSON.stringify(next));
  }, [customPreloadedKey]);

  /* ── Filter + sort ── */
  const sourceTracks = activeTab === 'preloaded' ? [...PRELOADED_TRACKS, ...savedPreloaded] : tracks;
  const displayed = sourceTracks
    .filter(t => {
      const q = search.toLowerCase();
      if (q && !t.name.toLowerCase().includes(q) && !t.artist.toLowerCase().includes(q) && !t.genre.toLowerCase().includes(q)) return false;
      if (filterGenre  !== 'All' && t.genre  !== filterGenre)  return false;
      if (filterArtist !== 'All' && t.artist !== filterArtist) return false;
      if (filterEnergy !== 'All' && t.energy !== filterEnergy) return false;
      if (filterBpmMin && t.bpm < Number(filterBpmMin)) return false;
      if (filterBpmMax && t.bpm > Number(filterBpmMax)) return false;
      if (activeTab === 'favorites' && !t.favorite) return false;
      return true;
    })
    .sort((a, b) => {
      let av: string | number, bv: string | number;
      switch (sortKey) {
        case 'name':     av = a.name;       bv = b.name;       break;
        case 'artist':   av = a.artist;     bv = b.artist;     break;
        case 'bpm':      av = a.bpm;        bv = b.bpm;        break;
        case 'key':      av = a.key;        bv = b.key;        break;
        case 'energy':   av = a.energyPct;  bv = b.energyPct;  break;
        case 'duration': av = a.durationSec;bv = b.durationSec;break;
        case 'genre':    av = a.genre;      bv = b.genre;      break;
        default:         return 0;
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ?  1 : -1;
      return 0;
    });

  /* ── Toggle favorite ── */
  const toggleFav = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setTracks(ts => ts.map(t => t.id === id ? { ...t, favorite: !t.favorite } : t));
  };

  /* ── File upload ── */
  const chooseFile = (target: 'A' | 'B') => {
    targetDeckRef.current = target;
    fileInputRef.current?.click();
  };

  const uploadTrack = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const target = targetDeckRef.current;
    setUploading(target); setLoadError(null);
    try {
      await onLoadToDeck();
      await (target === 'A' ? deckA : deckB).load(file);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(null);
      event.target.value = '';
    }
  };

  const addPreloadedTrack = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!user || !customPreloadedKey) {
      setLoadError('Sign in first to save tracks under Pre-loaded Songs.');
      onLogin?.();
      return;
    }

    setLoadError(null);
    try {
      const id = Date.now();
      const storageKey = `${user.id}:${id}:${file.name}`;
      await savePreloadedFile(storageKey, file);
      const nextTrack: LibraryTrack = {
        id,
        name: friendlyTrackName(file.name),
        artist: user.name || 'My Library',
        genre: 'My Pre-loaded',
        bpm: 128,
        key: '8A',
        keyColor: 'green',
        energy: 'medium',
        energyPct: 65,
        duration: 'Saved',
        durationSec: 0,
        favorite: false,
        src: '',
        custom: true,
        storageKey,
        fileName: file.name,
        fileType: file.type || 'audio/mpeg',
      };
      persistSavedPreloaded([...savedPreloaded, nextTrack]);
      setActiveTab('preloaded');
      setLoadError(`"${nextTrack.name}" saved to Pre-loaded Songs.`);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    }
  };

  const removePreloadedTrack = async (track: LibraryTrack, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!track.custom || !track.storageKey) return;
    try {
      await deletePreloadedFile(track.storageKey);
      persistSavedPreloaded(savedPreloaded.filter(item => item.id !== track.id));
      setLoadError(`"${track.name}" removed from Pre-loaded Songs.`);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    }
  };

  /* ── Load demo track ── */
  const loadDemo = async (track: LibraryTrack, target: 'A' | 'B') => {
    setUploading(target); setLoadError(null); setSelectedId(track.id);
    try {
      await onLoadToDeck();
      if (track.custom && track.storageKey) {
        const file = await readPreloadedFile(track.storageKey);
        if (!file) throw new Error(`"${track.name}" is missing from browser storage.`);
        await (target === 'A' ? deckA : deckB).load(file);
        return;
      }
      const res = await fetch(track.src);
      if (!res.ok) {
        const file = generatedDemoFile(track);
        await (target === 'A' ? deckA : deckB).load(file);
        setLoadError(`"${track.name}" demo file is missing, so a generated ${track.bpm} BPM practice loop was loaded.`);
        return;
      }
      const blob = await res.blob();
      try {
        await (target === 'A' ? deckA : deckB).load(new File([blob], `${track.name}.mp3`, { type: blob.type || 'audio/mpeg' }));
      } catch {
        const file = generatedDemoFile(track);
        await (target === 'A' ? deckA : deckB).load(file);
        setLoadError(`"${track.name}" could not decode, so a generated ${track.bpm} BPM practice loop was loaded.`);
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    } finally { setUploading(null); }
  };

  /* ── Analyze modal helpers ── */
  const openAnalyze = (track: LibraryTrack, e: React.MouseEvent) => {
    e.stopPropagation();
    setAnalyzeTrack(track);
  };

  const closeAnalyze = () => setAnalyzeTrack(null);

  const handleAnalyzeLoadA = () => {
    if (analyzeTrack) void loadDemo(analyzeTrack, 'A');
    closeAnalyze();
  };

  const handleAnalyzeLoadB = () => {
    if (analyzeTrack) void loadDemo(analyzeTrack, 'B');
    closeAnalyze();
  };

  /* ── Get real analysis from deck if track was loaded ── */
  const getRealAnalysis = (track: LibraryTrack) => {
    if (deckA.state.track?.name.startsWith(track.name)) return deckA.state.track.analysis;
    if (deckB.state.track?.name.startsWith(track.name)) return deckB.state.track.analysis;
    return null;
  };

  /* ── Freesound search ── */
  const searchFreesound = useCallback(async () => {
    if (!fsQuery.trim()) return;
    setFsLoading(true); setFsStatus(null);
    try {
      const params = new URLSearchParams({ q: fsQuery, filter: fsFilter, sort: 'score', page_size: '20', page: '1' });
      const res    = await fetch(`/api/freesound/search?${params.toString()}`);
      if (!res.ok) throw new Error(`Freesound API ${res.status}`);
      const data   = await res.json() as { results?: FreesoundResult[]; count?: number };
      setFsResults(data.results ?? []);
      if ((data.results?.length ?? 0) === 0) setFsStatus('No results found.');
    } catch (e) { setFsStatus(`Error: ${String(e)}`); }
    finally { setFsLoading(false); }
  }, [fsQuery, fsFilter]);

  useEffect(() => {
    if (activeTab !== 'freesound' || !fsQuery.trim()) return;
    const timer = window.setTimeout(() => void searchFreesound(), 450);
    return () => window.clearTimeout(timer);
  }, [activeTab, fsQuery, fsFilter, searchFreesound]);

  const toggleFsPreview = (sound: FreesoundResult) => {
    if (fsPreviewId === sound.id) {
      fsAudioRef.current?.pause();
      setFsPreviewId(null);
      return;
    }
    if (fsAudioRef.current) fsAudioRef.current.pause();
    const audio = new Audio(sound.previews['preview-hq-mp3']);
    audio.onended = () => setFsPreviewId(null);
    audio.play().catch(() => {});
    fsAudioRef.current = audio;
    setFsPreviewId(sound.id);
  };

  const loadFsToDecks = async (sound: FreesoundResult, target: 'A' | 'B') => {
    setUploading(target); setFsStatus(`Loading "${sound.name}" → Deck ${target}…`);
    try {
      await onLoadToDeck();
      const res  = await fetch(sound.previews['preview-hq-mp3']);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const file = new File([blob], `${sound.name}.mp3`, { type: blob.type || 'audio/mpeg' });
      await (target === 'A' ? deckA : deckB).load(file);
      setFsStatus(`✓ "${sound.name}" loaded into Deck ${target}`);
    } catch (e) { setFsStatus(`Error: ${String(e)}`); }
    finally { setUploading(null); }
  };

  // Clean up FS audio on unmount
  useEffect(() => () => { fsAudioRef.current?.pause(); }, []);

  /* ─── RENDER ──────────────────────────────────────────────────────── */
  return (
    <div className="playlist-section">
      <input ref={fileInputRef} type="file" accept="audio/*,.wav,.mp3,.flac,.aiff,.aif,.m4a,.aac,.ogg,.opus" onChange={uploadTrack} hidden />
      <input ref={preloadedInputRef} type="file" accept="audio/*,.wav,.mp3,.flac,.aiff,.aif,.m4a,.aac,.ogg,.opus" onChange={addPreloadedTrack} hidden />

      {/* ── Tab bar ── */}
      <div className="lib-tab-bar">
        {([['library', '📂 Library'], ['preloaded', '♫ Pre-loaded Songs'], ['freesound', '🎧 Freesound'], ['favorites', '★ Favorites']] as const).map(([id, label]) => (
          <button
            key={id}
            className={`lib-tab${activeTab === id ? ' active' : ''}`}
            onClick={() => setActiveTab(id)}
          >
            {label}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
          <button className="playlist-upload-btn" onClick={() => chooseFile('A')} disabled={uploading !== null} title="Upload file → Deck A">
            {uploading === 'A' ? '⏳' : '＋ LOAD A'}
          </button>
          <button className="playlist-upload-btn deck-b" onClick={() => chooseFile('B')} disabled={uploading !== null} title="Upload file → Deck B">
            {uploading === 'B' ? '⏳' : '＋ LOAD B'}
          </button>
        </div>
      </div>

      {/* ════════════════ LIBRARY / FAVORITES ════════════════ */}
      {(activeTab === 'library' || activeTab === 'preloaded' || activeTab === 'favorites') && (
        <>
          {/* ── Search + filter toolbar ── */}
          <div className="lib-toolbar">
            <div className="lib-search-wrap">
              <span className="lib-search-icon">🔍</span>
              <input
                className="lib-search"
                placeholder="Search by title, artist, genre…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && (
                <button className="lib-search-clear" onClick={() => setSearch('')}>✕</button>
              )}
            </div>

            <select className="lib-filter-sel" value={filterGenre} onChange={e => setFilterGenre(e.target.value)} title="Genre">
              {GENRES.map(g => <option key={g}>{g}</option>)}
            </select>
            <select className="lib-filter-sel" value={filterArtist} onChange={e => setFilterArtist(e.target.value)} title="Artist">
              {ARTISTS.map(a => <option key={a}>{a}</option>)}
            </select>
            <select className="lib-filter-sel" value={filterEnergy} onChange={e => setFilterEnergy(e.target.value as typeof filterEnergy)} title="Energy">
              {ENERGIES.map(en => <option key={en} value={en}>{en === 'All' ? 'Energy' : en.charAt(0).toUpperCase() + en.slice(1)}</option>)}
            </select>
            <div className="lib-bpm-range" title="BPM range">
              <input className="lib-bpm-input" placeholder="BPM ≥" type="number" min="60" max="200" value={filterBpmMin} onChange={e => setFilterBpmMin(e.target.value)} />
              <span className="lib-bpm-sep">–</span>
              <input className="lib-bpm-input" placeholder="≤ BPM" type="number" min="60" max="200" value={filterBpmMax} onChange={e => setFilterBpmMax(e.target.value)} />
            </div>
            <span className="lib-count">{displayed.length} track{displayed.length !== 1 ? 's' : ''}</span>
            {activeTab === 'preloaded' && (
              <button
                className="playlist-upload-btn"
                onClick={() => {
                  if (!user) {
                    setLoadError('Sign in first to save tracks under Pre-loaded Songs.');
                    onLogin?.();
                    return;
                  }
                  preloadedInputRef.current?.click();
                }}
                title={user ? 'Save a track to Pre-loaded Songs' : 'Login first to save tracks'}
              >
                ＋ ADD TO PRE-LOADED
              </button>
            )}
          </div>

          {/* ── Column headers ── */}
          <div className="lib-table-head">
            <span className="lib-col-fav" />
            <span className="lib-col-cover" />
            <button className="lib-col-name lib-sort-btn" onClick={() => handleSort('name')}>TITLE{sortIcon('name')}</button>
            <button className="lib-col-artist lib-sort-btn" onClick={() => handleSort('artist')}>ARTIST{sortIcon('artist')}</button>
            <button className="lib-col-genre lib-sort-btn" onClick={() => handleSort('genre')}>GENRE{sortIcon('genre')}</button>
            <button className="lib-col-bpm lib-sort-btn" onClick={() => handleSort('bpm')}>BPM{sortIcon('bpm')}</button>
            <button className="lib-col-key lib-sort-btn" onClick={() => handleSort('key')}>KEY{sortIcon('key')}</button>
            <button className="lib-col-energy lib-sort-btn" onClick={() => handleSort('energy')}>ENERGY{sortIcon('energy')}</button>
            <button className="lib-col-dur lib-sort-btn" onClick={() => handleSort('duration')}>DURATION{sortIcon('duration')}</button>
            <span className="lib-col-actions">ACTIONS</span>
          </div>

          {/* ── Track rows ── */}
          <div className="lib-table-body">
            {displayed.length === 0 && (
              <div className="lib-empty">No tracks match your search or filters.</div>
            )}
            {displayed.map(track => (
              <div
                key={track.id}
                className={`lib-row${selectedId === track.id ? ' selected' : ''}`}
                onClick={() => setSelectedId(id => id === track.id ? null : track.id)}
              >
                {/* Favorite */}
                <div className="lib-col-fav">
                  <button
                    className={`lib-fav-btn${track.favorite ? ' on' : ''}`}
                    onClick={e => toggleFav(track.id, e)}
                    title={track.favorite ? 'Remove from favorites' : 'Add to favorites'}
                  >★</button>
                </div>

                {/* Cover art */}
                <div className="lib-col-cover">
                  <div className={`lib-cover-art${selectedId === track.id ? ' playing' : ''}`} style={{
                    border: `1px solid ${KEY_COLOR[track.keyColor]}55`,
                  }}>
                    <img src={artworkForTrack(track)} alt={`${track.name} cover`} />
                    {selectedId === track.id && <span aria-hidden="true">▶</span>}
                  </div>
                </div>

                {/* Title */}
                <div className="lib-col-name">
                  <div className="lib-track-name">{track.name}</div>
                </div>

                {/* Artist */}
                <div className="lib-col-artist lib-text-muted">{track.artist}</div>

                {/* Genre */}
                <div className="lib-col-genre">
                  <span className="lib-genre-badge">{track.genre}</span>
                </div>

                {/* BPM */}
                <div className="lib-col-bpm">
                  <span className="lib-bpm-val">{track.bpm}</span>
                </div>

                {/* Key */}
                <div className="lib-col-key">
                  <span className="lib-key-badge" style={{ color: KEY_COLOR[track.keyColor], borderColor: KEY_COLOR[track.keyColor] + '55' }}>
                    {track.key}
                  </span>
                </div>

                {/* Energy */}
                <div className="lib-col-energy">
                  <div className="lib-energy-wrap">
                    <div className="lib-energy-bar-bg">
                      <div className="lib-energy-bar-fill" style={{
                        width: `${track.energyPct}%`,
                        background: ENERGY_COLOR[track.energy],
                      }} />
                    </div>
                    <span className="lib-energy-dots" style={{ color: ENERGY_COLOR[track.energy] }}>
                      {energyLabel(track.energy)}
                    </span>
                  </div>
                </div>

                {/* Duration */}
                <div className="lib-col-dur lib-text-muted">{track.duration}</div>

                {/* Actions */}
                <div className="lib-col-actions lib-row-actions">
                  <button
                    className="lib-action-btn analyze"
                    title="Analyze"
                    onClick={e => openAnalyze(track, e)}
                  >🔬</button>
                  <button
                    className="lib-action-btn deck-a"
                    title="Load to Deck A"
                    disabled={uploading !== null}
                    onClick={e => { e.stopPropagation(); void loadDemo(track, 'A'); }}
                  >A</button>
                  <button
                    className="lib-action-btn deck-b"
                    title="Load to Deck B"
                    disabled={uploading !== null}
                    onClick={e => { e.stopPropagation(); void loadDemo(track, 'B'); }}
                  >B</button>
                  {track.custom && (
                    <button
                      className="lib-action-btn"
                      title="Remove from Pre-loaded Songs"
                      onClick={e => void removePreloadedTrack(track, e)}
                    >×</button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {loadError && <div className="playlist-load-error">⚠ {loadError}</div>}
        </>
      )}

      {/* ════════════════ FREESOUND TAB ════════════════ */}
      {activeTab === 'freesound' && (
        <div className="lib-fs-panel">
          {/* Search bar */}
          <div className="lib-toolbar" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="lib-search-wrap" style={{ flex: 1 }}>
              <span className="lib-search-icon">🎧</span>
              <input
                className="lib-search"
                placeholder="Search 600,000+ sounds — drum loop, techno bass, vinyl scratch…"
                value={fsQuery}
                onChange={e => setFsQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && void searchFreesound()}
              />
            </div>
            <button
              className="playlist-upload-btn"
              onClick={() => void searchFreesound()}
              disabled={fsLoading || !fsQuery.trim()}
              style={{ minWidth: 70 }}
            >
              {fsLoading ? '⏳' : '🔍 Search'}
            </button>
          </div>

          {/* Filter chips */}
          <div className="lib-fs-chips">
            {FREESOUND_FILTERS.map(f => (
              <button
                key={f.label}
                className={`lib-fs-chip${fsFilter === f.filter ? ' active' : ''}`}
                onClick={() => setFsFilter(f.filter)}
              >
                {f.label}
              </button>
            ))}
          </div>

          {fsStatus && <div className="lib-fs-status">{fsStatus}</div>}

          {/* Results */}
          {fsResults.length === 0 && !fsLoading && (
            <div className="lib-empty" style={{ marginTop: '2rem' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem', opacity: 0.3 }}>🎧</div>
              <div>Search Freesound for free, CC-licensed sounds</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--muted)', marginTop: '0.3rem' }}>
                600,000+ sounds · Load previews directly into Deck A or B
              </div>
            </div>
          )}

          <div className="lib-fs-results">
            {fsResults.map(sound => (
              <div key={sound.id} className="lib-fs-row">
                {/* Waveform image */}
                <div className="lib-fs-wave-img">
                  <FreesoundWaveformImage sound={sound} />
                </div>

                {/* Info */}
                <div className="lib-fs-info">
                  <div className="lib-fs-name">{sound.name}</div>
                  <div className="lib-fs-meta">
                    <span>by {sound.username}</span>
                    <span className="lib-fs-dur">{fmtDur(sound.duration)}</span>
                    <span className="lib-fs-rating">★ {sound.avg_rating.toFixed(1)}</span>
                  </div>
                  <div className="lib-fs-tags">
                    {sound.tags.slice(0, 4).map(tag => (
                      <span key={tag} className="lib-fs-tag">{tag}</span>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="lib-fs-actions">
                  <button
                    className={`lib-fs-preview-btn${fsPreviewId === sound.id ? ' playing' : ''}`}
                    onClick={() => toggleFsPreview(sound)}
                    title={fsPreviewId === sound.id ? 'Stop preview' : 'Preview'}
                  >
                    {fsPreviewId === sound.id ? '⏸' : '▶'}
                  </button>
                  <button
                    className="lib-action-btn deck-a"
                    disabled={uploading !== null}
                    onClick={() => void loadFsToDecks(sound, 'A')}
                    title="Load to Deck A"
                  >A</button>
                  <button
                    className="lib-action-btn deck-b"
                    disabled={uploading !== null}
                    onClick={() => void loadFsToDecks(sound, 'B')}
                    title="Load to Deck B"
                  >B</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Analyze modal ── */}
      {analyzeTrack && (
        <AnalyzeModal
          track={analyzeTrack}
          realAnalysis={getRealAnalysis(analyzeTrack)}
          durationSec={analyzeTrack.durationSec}
          onClose={closeAnalyze}
          onLoadA={handleAnalyzeLoadA}
          onLoadB={handleAnalyzeLoadB}
        />
      )}
    </div>
  );
}
