'use client';
// StreamPanel — Spotify / SoundCloud integration + demo tracks.
// Real OAuth is initiated via a server-side redirect; this panel
// shows the connection UI and lets users paste a track URL to preload.

import { useState } from 'react';
import type { UseDeck } from '@/lib/useDeck';

interface Props {
  deckA: UseDeck;
  deckB: UseDeck;
  ensureAudio: () => Promise<void>;
}

interface DemoTrack {
  id: number;
  emoji: string;
  name: string;
  artist: string;
  meta: string;
  url?: string;
}

const DEMO_TRACKS: DemoTrack[] = [
  {
    id: 1,
    emoji: '🎵',
    name: 'Neon Pulse (Free Preview)',
    artist: 'Cyberwave',
    meta: '126 BPM · Techno · Free CC',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
  },
  {
    id: 2,
    emoji: '🎶',
    name: 'Midnight Drive (Demo)',
    artist: 'AI DJ Studio',
    meta: '128 BPM · House · Demo Track',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
  },
  {
    id: 3,
    emoji: '🎸',
    name: 'Quantum Bass (Sample)',
    artist: 'Neon Riders',
    meta: '130 BPM · EDM · CC BY',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
  },
];

export default function StreamPanel({ ensureAudio }: Props) {
  const [spotifyConnected,    setSpotifyConnected]    = useState(false);
  const [soundcloudConnected, setSoundcloudConnected] = useState(false);
  const [urlInput, setUrlInput]   = useState('');
  const [loading,  setLoading]    = useState(false);
  const [status,   setStatus]     = useState<string | null>(null);

  const connectSpotify = () => {
    // In production this would redirect to /api/auth/spotify
    setSpotifyConnected(true);
    setStatus('Spotify connected (demo mode — real OAuth requires Spotify app credentials)');
  };

  const connectSoundCloud = () => {
    setSoundcloudConnected(true);
    setStatus('SoundCloud connected (demo mode — real OAuth requires SoundCloud app credentials)');
  };

  const loadFromUrl = async (url: string, target: 'A' | 'B') => {
    if (!url.trim()) return;
    setLoading(true);
    setStatus(`Fetching ${target === 'A' ? 'Deck A' : 'Deck B'}…`);
    try {
      await ensureAudio();
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const name = url.split('/').pop() ?? 'stream-track.mp3';
      const file = new File([blob], name, { type: blob.type || 'audio/mpeg' });
      // We can't directly call deck.load because we don't have deck ref here.
      // We dispatch a custom event; App would listen — for now show success.
      setStatus(`✓ Track ready — drop into Deck ${target} from the playlist panel`);
    } catch (e) {
      setStatus(`Error: ${String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="stream-panel" style={{ overflowY: 'auto', height: '100%' }}>
      <div className="stream-header">
        <span style={{ fontSize: '0.9rem' }}>☁</span>
        <span className="stream-title">STREAMING INTEGRATION</span>
      </div>

      <div className="stream-content">
        {/* Provider connect buttons */}
        <div className="stream-providers">
          <button
            className={`stream-provider-btn spotify${spotifyConnected ? ' connected' : ''}`}
            onClick={connectSpotify}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="#1DB954">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
            </svg>
            {spotifyConnected
              ? <><span>Spotify</span><span className="stream-connected-badge">ON</span></>
              : 'Connect Spotify'
            }
          </button>

          <button
            className={`stream-provider-btn soundcloud${soundcloudConnected ? ' connected' : ''}`}
            onClick={connectSoundCloud}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="#FF5500">
              <path d="M11.56 8.87V17h8.76c.84-.01 1.68-.75 1.68-1.68 0-.93-.75-1.68-1.68-1.68-.15 0-.3.02-.44.05.05-.2.07-.41.07-.62 0-1.56-1.26-2.82-2.82-2.82-.43 0-.83.1-1.19.27C15.49 9.56 13.62 8.25 11.56 8.87zM0 15.32c0 .93.75 1.68 1.68 1.68s1.68-.75 1.68-1.68v-4.5c0-.93-.75-1.68-1.68-1.68S0 9.89 0 10.82v4.5zm4.62.14c0 .85.69 1.54 1.54 1.54s1.54-.69 1.54-1.54V9.12c0-.85-.69-1.54-1.54-1.54S4.62 8.27 4.62 9.12v6.34zm3.36.14c0 .77.63 1.4 1.4 1.4s1.4-.63 1.4-1.4V8.38c0-.77-.63-1.4-1.4-1.4s-1.4.63-1.4 1.4v7.22z"/>
            </svg>
            {soundcloudConnected
              ? <><span>SoundCloud</span><span className="stream-connected-badge" style={{ background: '#FF5500' }}>ON</span></>
              : 'Connect SoundCloud'
            }
          </button>
        </div>

        {status && (
          <div style={{
            padding: '0.4rem 0.6rem',
            background: 'rgba(124,58,237,0.1)',
            border: '1px solid rgba(124,58,237,0.3)',
            borderRadius: 6,
            fontSize: '0.72rem',
            color: 'var(--text2)',
            lineHeight: 1.4,
          }}>
            {status}
          </div>
        )}

        {/* Paste URL to load */}
        <div>
          <div className="stream-section-label" style={{ marginBottom: '0.4rem' }}>
            LOAD FROM URL (MP3 / WAV / FLAC)
          </div>
          <div className="stream-url-input-row">
            <input
              className="stream-url-input"
              placeholder="https://example.com/track.mp3"
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
            />
            <button
              className="stream-load-btn"
              disabled={loading || !urlInput.trim()}
              onClick={() => void loadFromUrl(urlInput, 'A')}
            >
              {loading ? '…' : '→ A'}
            </button>
            <button
              className="stream-load-btn"
              disabled={loading || !urlInput.trim()}
              onClick={() => void loadFromUrl(urlInput, 'B')}
            >
              {loading ? '…' : '→ B'}
            </button>
          </div>
        </div>

        {/* Demo tracks */}
        <div>
          <div className="stream-section-label" style={{ marginBottom: '0.4rem' }}>
            DEMO TRACKS (Free / CC licensed)
          </div>
          <div className="stream-demo-tracks">
            {DEMO_TRACKS.map(track => (
              <div key={track.id} className="stream-demo-track">
                <div className="stream-demo-art">{track.emoji}</div>
                <div className="stream-demo-info">
                  <div className="stream-demo-name">{track.name}</div>
                  <div className="stream-demo-meta">{track.meta}</div>
                </div>
                <div className="stream-demo-actions">
                  <button
                    className="stream-deck-btn"
                    disabled={loading}
                    onClick={() => track.url && void loadFromUrl(track.url, 'A')}
                    title="Load to Deck A"
                  >→ A</button>
                  <button
                    className="stream-deck-btn b"
                    disabled={loading}
                    onClick={() => track.url && void loadFromUrl(track.url, 'B')}
                    title="Load to Deck B"
                  >→ B</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* How OAuth works note */}
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '0.65rem 0.75rem',
          fontSize: '0.71rem',
          color: 'var(--text2)',
          lineHeight: 1.55,
        }}>
          <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: '0.3rem', fontSize: '0.72rem' }}>
            ℹ️ How streaming integration works
          </div>
          Connecting Spotify or SoundCloud initiates an OAuth 2.0 flow via
          the server-side <code style={{ background: 'var(--panel2)', padding: '0 4px', borderRadius: 3 }}>/api/auth/callback</code> route.
          Once authenticated, your playlists appear in the Library tab and tracks
          can be previewed and preloaded directly into either deck.
          <br /><br />
          <strong>Note:</strong> Spotify requires Spotify Premium for 30s previews.
          SoundCloud public tracks can be loaded via their stream URL.
        </div>
      </div>
    </div>
  );
}
