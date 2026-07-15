'use client';
// PlaylistSection — bottom left panel with tabs, search, track list.

import { useRef, useState } from 'react';
import type { UseDeck } from '@/lib/useDeck';

interface DemoTrack {
  id: number;
  name: string;
  artist: string;
  bpm: number;
  key: string;
  keyColor: 'orange' | 'blue';
  genre: string;
  duration: string;
  energyBars: number[];
  src: string;
}

const DEMO_TRACKS: DemoTrack[] = [
  { id:1, name:'Electric Awakening', artist:'Arc Reactor', bpm:128, key:'8A', keyColor:'orange', genre:'Electro House', duration:'DEMO', energyBars:[10,13,12,14,11], src:'/music/electric-awakening.mp3' },
  { id:2, name:'Neon Overdrive', artist:'Cyberwave', bpm:130, key:'9A', keyColor:'blue', genre:'EDM', duration:'DEMO', energyBars:[14,12,13,14,12], src:'/music/neon-overdrive.mp3' },
  { id:3, name:'Voltage Theory', artist:'Tesla Club', bpm:126, key:'7A', keyColor:'orange', genre:'Electro', duration:'DEMO', energyBars:[12,10,14,11,13], src:'/music/voltage-theory.mp3' },
  { id:4, name:'Bassquake Protocol', artist:'Ion Storm', bpm:150, key:'10A', keyColor:'blue', genre:'Extreme Bass', duration:'DEMO', energyBars:[14,14,13,14,14], src:'/music/bassquake-protocol.mp3' },
  { id:5, name:'Future Horizon', artist:'Nova Sequence', bpm:140, key:'6A', keyColor:'orange', genre:'Future Bass', duration:'DEMO', energyBars:[11,13,12,14,13], src:'/music/future-horizon.mp3' },
  { id:6, name:'Midnight Rush', artist:'Arcade Youth', bpm:128, key:'8A', keyColor:'blue', genre:'Synthwave', duration:'DEMO', energyBars:[10,14,9,13,12], src:'/music/midnight-rush.mp3' },
  { id:7, name:'Neon Pulse', artist:'Night Circuit', bpm:126, key:'9A', keyColor:'orange', genre:'Techno', duration:'DEMO', energyBars:[14,10,12,13,11], src:'/music/neon-pulse.mp3' },
  { id:8, name:'Quantum Dreams', artist:'Astral Code', bpm:122, key:'5A', keyColor:'blue', genre:'Progressive', duration:'DEMO', energyBars:[9,12,11,13,10], src:'/music/quantum-dreams.mp3' },
  { id:9, name:'Synthetic Hearts', artist:'Chrome Lovers', bpm:118, key:'4A', keyColor:'orange', genre:'Synth Pop', duration:'DEMO', energyBars:[9,11,10,12,11], src:'/music/synthetic-hearts.mp3' },
];

const TABS = ['PLAYLIST', 'MY LIBRARY', 'FAVORITES', 'RECENT', 'DOWNLOADS'];

interface Props {
  onLoadToDeck: () => Promise<void>;
  deckA: UseDeck;
  deckB: UseDeck;
}

export default function PlaylistSection({ deckA, deckB, onLoadToDeck }: Props) {
  const [activeTab, setActiveTab] = useState('PLAYLIST');
  const [search, setSearch] = useState('');
  const [playingId, setPlayingId] = useState<number | null>(1);
  const [uploading, setUploading] = useState<'A' | 'B' | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const targetDeckRef = useRef<'A' | 'B'>('A');

  const chooseFile = (target: 'A' | 'B') => {
    targetDeckRef.current = target;
    fileInputRef.current?.click();
  };

  const uploadTrack = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const target = targetDeckRef.current;
    setUploading(target);
    try {
      await onLoadToDeck();
      await (target === 'A' ? deckA : deckB).load(file);
    } finally {
      setUploading(null);
      event.target.value = '';
    }
  };

  const loadDemo = async (track: DemoTrack, target: 'A' | 'B') => {
    setUploading(target); setLoadError(null); setPlayingId(track.id);
    try {
      await onLoadToDeck();
      const response = await fetch(track.src);
      if (!response.ok) throw new Error(`Could not load ${track.name}`);
      const blob = await response.blob();
      await (target === 'A' ? deckA : deckB).load(new File([blob], `${track.name}.mp3`, { type: blob.type || 'audio/mpeg' }));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : String(error));
    } finally { setUploading(null); }
  };

  const filtered = DEMO_TRACKS.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.artist.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="playlist-section">
      {/* Tabs */}
      <div className="playlist-tabs">
        {TABS.map(tab => (
          <button
            key={tab}
            className={`playlist-tab${activeTab === tab ? ' active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="playlist-toolbar">
        <input ref={fileInputRef} type="file" accept="audio/*,.wav,.mp3,.flac,.aiff,.aif,.m4a,.aac,.ogg,.opus" onChange={uploadTrack} hidden />
        <button className="playlist-upload-btn" onClick={() => chooseFile('A')} disabled={uploading !== null} title="Upload a local audio file to Deck A">
          {uploading === 'A' ? 'LOADING…' : '＋ LOAD A'}
        </button>
        <button className="playlist-upload-btn deck-b" onClick={() => chooseFile('B')} disabled={uploading !== null} title="Upload a local audio file to Deck B">
          {uploading === 'B' ? 'LOADING…' : '＋ LOAD B'}
        </button>
        <input
          className="playlist-search"
          placeholder="Search tracks..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {(['Genre', 'BPM', 'Key'] as const).map(f => (
          <select key={f} className="playlist-filter-select">
            <option>{f}</option>
          </select>
        ))}
        <div className="playlist-view-btns">
          <button className="playlist-view-btn">⊞</button>
          <button className="playlist-view-btn">☰</button>
        </div>
      </div>

      {/* Table */}
      <div className="playlist-table">
        <div className="playlist-head">
          <span>#</span>
          <span>TRACK NAME</span>
          <span>ARTIST</span>
          <span>BPM</span>
          <span>KEY</span>
          <span>GENRE</span>
          <span>DURATION</span>
          <span />
        </div>

        {filtered.map(track => (
          <div
            key={track.id}
            className={`playlist-row${track.id === playingId ? ' active' : ''}`}
            onClick={() => setPlayingId(track.id)}
          >
            <div className="playlist-row-num">
              {track.id === playingId
                ? <span className="playlist-row-play">▶</span>
                : track.id
              }
            </div>
            <div className="playlist-row-title">
              <div className="playlist-row-art">
                {track.id === playingId ? '🎵' : '🎶'}
              </div>
              <span className="playlist-row-name">{track.name}</span>
            </div>
            <div className="playlist-row-artist">{track.artist}</div>
            <div className="playlist-row-bpm">{track.bpm}</div>
            <div className={`playlist-row-key ${track.keyColor}`}>{track.key}</div>
            <div className="playlist-row-genre">{track.genre}</div>
            <div className="playlist-row-dur">
              {track.duration}
              <div className={`energy-bars${track.keyColor === 'blue' ? ' deck-b' : ''}`}>
                {track.energyBars.slice(0, 4).map((h, i) => (
                  <div key={i} className="energy-bar" style={{ height: h }} />
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 3, justifyContent: 'center' }}>
              <button
                className="stream-deck-btn"
                onClick={e => { e.stopPropagation(); void loadDemo(track, 'A'); }}
                title="Load to Deck A"
              >A</button>
              <button
                className="stream-deck-btn b"
                onClick={e => { e.stopPropagation(); void loadDemo(track, 'B'); }}
                title="Load to Deck B"
              >B</button>
            </div>
          </div>
        ))}
      </div>
      {loadError && <div className="playlist-load-error">⚠ {loadError}</div>}
    </div>
  );
}
