import { useEffect, useState } from 'react';
import type { MoodProfile } from './emotion';
import type { UseDeck } from '@/lib/useDeck';

interface MoodTrack {
  id: string;
  title: string;
  artist: string;
  artwork: string;
  previewUrl: string;
  source: 'Pre-loaded' | 'Web';
  reason: string;
}

const PRELOADED: MoodTrack[] = [
  { id: 'electric', title: 'Electric Awakening', artist: 'Arc Reactor', artwork: '/track-images/Track1.jpg', previewUrl: '/music/electric-awakening.mp3', source: 'Pre-loaded', reason: 'High-energy electro lift' },
  { id: 'neon', title: 'Neon Overdrive', artist: 'Cyberwave', artwork: '/track-images/Track2.jpeg', previewUrl: '/music/neon-overdrive.mp3', source: 'Pre-loaded', reason: 'Bright peak-time momentum' },
  { id: 'future', title: 'Future Horizon', artist: 'Nova Sequence', artwork: '/track-images/Track3.jpg', previewUrl: '/music/future-horizon.mp3', source: 'Pre-loaded', reason: 'Melodic and uplifting' },
  { id: 'quantum', title: 'Quantum Dreams', artist: 'Astral Code', artwork: '/track-images/Track4.jpg', previewUrl: '/music/quantum-dreams.mp3', source: 'Pre-loaded', reason: 'Calm progressive atmosphere' },
  { id: 'synthetic', title: 'Synthetic Hearts', artist: 'Chrome Lovers', artwork: '/track-images/Track5.webp', previewUrl: '/music/synthetic-hearts.mp3', source: 'Pre-loaded', reason: 'Soft low-energy groove' },
];

function localMatches(profile: MoodProfile): MoodTrack[] {
  const start = profile.targetBpm >= 135 ? 0 : profile.targetBpm <= 100 ? 3 : 2;
  return [PRELOADED[start], PRELOADED[(start + 1) % PRELOADED.length]];
}

export default function MusicRecommendation({ profile, active, deckA, deckB, ensureAudio }: { profile: MoodProfile; active: boolean; deckA: UseDeck; deckB: UseDeck; ensureAudio: () => Promise<void> }) {
  const [webTracks, setWebTracks] = useState<MoodTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [shuffle, setShuffle] = useState(0);
  const rows = [
    ['Tempo', `${profile.targetBpm} BPM`], ['Key Match', profile.key], ['Lighting', profile.lighting],
    ['Fog', profile.fog], ['FX', profile.effects.join(' · ')], ['Visualizer', profile.visualizer],
  ];

  useEffect(() => {
    if (!active) { setWebTracks([]); return; }
    const controller = new AbortController();
    setLoading(true);
    fetch('/api/ai/mood-tracks', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emotion: profile.emotion, genres: profile.genres, targetBpm: profile.targetBpm, shuffle }),
      signal: controller.signal,
    })
      .then(async response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<{ tracks?: MoodTrack[] }>;
      })
      .then(data => setWebTracks(data.tracks ?? []))
      .catch(error => { if (error instanceof Error && error.name !== 'AbortError') setStatus('Online suggestions unavailable'); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [active, profile.emotion, profile.genres, profile.targetBpm, shuffle]);

  const loadTrack = async (track: MoodTrack, target: 'A' | 'B') => {
    setStatus(`Loading ${track.title} to Deck ${target}…`);
    try {
      await ensureAudio();
      const response = await fetch(track.previewUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      await (target === 'A' ? deckA : deckB).load(new File([blob], `${track.title} - ${track.artist}.mp3`, { type: blob.type || 'audio/mpeg' }));
      setStatus(`${track.title} loaded on Deck ${target}`);
    } catch (error) {
      setStatus(`Could not load track: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const tracks = [...localMatches(profile), ...webTracks].slice(0, 5);
  return <>
    <div className="emotion-recommendation">{rows.map(([label, value]) => <div key={label}><span>{label}</span><b>{value}</b></div>)}</div>
    {active && <section className="mood-tracks">
      <div className="mood-tracks-heading"><span>AI TRACK PICKS</span><button onClick={() => setShuffle(value => value + 1)} disabled={loading}>{loading ? 'SEARCHING…' : 'SHUFFLE'}</button></div>
      {tracks.map(track => <article key={`${track.source}-${track.id}`}>
        <img src={track.artwork} alt="" />
        <div><b>{track.title}</b><small>{track.artist} · {track.source}</small><em>{track.reason}</em></div>
        <button onClick={() => void loadTrack(track, 'A')}>A</button><button onClick={() => void loadTrack(track, 'B')}>B</button>
      </article>)}
      {status && <p>{status}</p>}
    </section>}
  </>;
}
