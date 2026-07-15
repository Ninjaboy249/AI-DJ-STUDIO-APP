'use client';
// StreamPanel — Spotify OAuth + Freesound search + demo tracks.
// Freesound API calls go through /api/freesound/search (server proxy — keeps key off client).

import { useState, useEffect, useCallback, useRef } from 'react';
import type { UseDeck } from '@/lib/useDeck';

interface Props {
  deckA: UseDeck;
  deckB: UseDeck;
  ensureAudio: () => Promise<void>;
}

/* ─── Demo tracks ─────────────────────────────────────────────────────── */
interface DemoTrack {
  id: number;
  emoji: string;
  name: string;
  artist: string;
  meta: string;
  url: string;
}

const DEMO_TRACKS: DemoTrack[] = [
  { id: 1, emoji: '🎵', name: 'Neon Pulse (Free Preview)',  artist: 'Cyberwave',   meta: '126 BPM · Techno · CC', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
  { id: 2, emoji: '🎶', name: 'Midnight Drive (Demo)',      artist: 'AI DJ Studio', meta: '128 BPM · House · Demo', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' },
  { id: 3, emoji: '🎸', name: 'Quantum Bass (Sample)',      artist: 'Neon Riders',  meta: '130 BPM · EDM · CC BY', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3' },
];

/* ─── Freesound types ─────────────────────────────────────────────────── */
interface FreesoundSound {
  id: number;
  name: string;
  username: string;
  duration: number;
  license: string;
  previews: { 'preview-hq-mp3': string; 'preview-lq-mp3': string };
  images: { waveform_m: string; spectral_m: string };
  tags: string[];
  avg_rating: number;
  num_downloads: number;
}

/* ─── Spotify types ───────────────────────────────────────────────────── */
interface SpotifyPlaylist {
  id: string;
  name: string;
  images: { url: string }[];
  tracks: { total: number };
  external_urls: { spotify: string };
}

interface SpotifyTrack {
  id: string;
  name: string;
  artists: { name: string }[];
  album: { images: { url: string }[] };
  duration_ms: number;
  preview_url: string | null;
  external_urls: { spotify: string };
}

/* ─── Helpers ─────────────────────────────────────────────────────────── */
function buildSpotifyAuthUrl(): string {
  const clientId   = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID ?? '';
  const redirectUri = `${window.location.origin}/api/auth/spotify/callback`;
  const scopes = [
    'user-read-private',
    'playlist-read-private',
    'playlist-read-collaborative',
    'streaming',
    'user-read-playback-state',
  ].join(' ');
  const params = new URLSearchParams({ response_type: 'code', client_id: clientId, scope: scopes, redirect_uri: redirectUri, show_dialog: 'false' });
  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

function fmtSec(s: number): string {
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${m}:${ss.toString().padStart(2, '0')}`;
}

function fmtMs(ms: number): string { return fmtSec(ms / 1000); }

const FREESOUND_FILTERS = [
  { label: 'All',        filter: '' },
  { label: 'Music',      filter: 'type:mp3 tag:music' },
  { label: 'Electronic', filter: 'tag:electronic' },
  { label: 'Drums',      filter: 'tag:drums' },
  { label: 'Bass',       filter: 'tag:bass' },
  { label: 'Ambient',    filter: 'tag:ambient' },
  { label: 'Loop',       filter: 'tag:loop' },
];

const FREESOUND_SORTS = [
  { label: 'Relevance', value: 'score' },
  { label: 'Downloads', value: 'downloads_desc' },
  { label: 'Rating',    value: 'rating_desc' },
  { label: 'Duration',  value: 'duration_desc' },
  { label: 'Newest',    value: 'created_desc' },
];

/* ═══════════════════════════════════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════════════════════════════════ */
export default function StreamPanel({ deckA, deckB, ensureAudio }: Props) {

  /* ── Provider state ─────────────────────────────────────────────────── */
  const [activeProvider, setActiveProvider] = useState<'spotify' | 'freesound'>('spotify');

  /* ── Global ─────────────────────────────────────────────────────────── */
  const [loading, setLoading] = useState(false);
  const [status,  setStatus]  = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState('');

  /* ── Spotify ─────────────────────────────────────────────────────────── */
  const [spotifyToken,    setSpotifyToken]    = useState<string | null>(null);
  const [spotifyUser,     setSpotifyUser]     = useState<string | null>(null);
  const [spotifyView,     setSpotifyView]     = useState<'main' | 'playlists' | 'tracks'>('main');
  const [playlists,       setPlaylists]       = useState<SpotifyPlaylist[]>([]);
  const [playlistLoading, setPlaylistLoading] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState<SpotifyPlaylist | null>(null);
  const [spotifyTracks,   setSpotifyTracks]   = useState<SpotifyTrack[]>([]);
  const [tracksLoading,   setTracksLoading]   = useState(false);

  /* ── Freesound ───────────────────────────────────────────────────────── */
  const [fsQuery,   setFsQuery]   = useState('');
  const [fsFilter,  setFsFilter]  = useState('');
  const [fsSort,    setFsSort]    = useState('score');
  const [fsResults, setFsResults] = useState<FreesoundSound[]>([]);
  const [fsLoading, setFsLoading] = useState(false);
  const [fsPage,    setFsPage]    = useState(1);
  const [fsTotal,   setFsTotal]   = useState(0);
  const [fsNextUrl, setFsNextUrl] = useState<string | null>(null);
  const [fsPreviewId, setFsPreviewId] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  /* ── Pick up Spotify token from ?spotify_token= callback ───────────── */
  useEffect(() => {
    const params    = new URLSearchParams(window.location.search);
    const token     = params.get('spotify_token');
    const authError = params.get('spotify_error');
    if (authError) {
      setStatus(`Spotify auth error: ${decodeURIComponent(authError)}`);
      window.history.replaceState(null, '', window.location.pathname);
      return;
    }
    if (token) {
      setSpotifyToken(token);
      window.history.replaceState(null, '', window.location.pathname);
      fetch('https://api.spotify.com/v1/me', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(d => setSpotifyUser(d.display_name ?? d.id ?? 'Spotify User'))
        .catch(() => {});
    }
  }, []);

  /* ── Spotify: connect ───────────────────────────────────────────────── */
  const connectSpotify = useCallback(() => {
    const clientId = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID ?? '';
    if (!clientId) {
      window.open('https://www.spotify.com', '_blank');
      setStatus('No NEXT_PUBLIC_SPOTIFY_CLIENT_ID found — add it to .env.local.');
      return;
    }
    window.location.href = buildSpotifyAuthUrl();
  }, []);

  /* ── Spotify: fetch playlists ───────────────────────────────────────── */
  const fetchPlaylists = useCallback(async () => {
    if (!spotifyToken) return;
    setPlaylistLoading(true); setStatus(null);
    try {
      const res  = await fetch('https://api.spotify.com/v1/me/playlists?limit=20', { headers: { Authorization: `Bearer ${spotifyToken}` } });
      if (!res.ok) throw new Error(`Spotify ${res.status}`);
      const data = await res.json();
      setPlaylists(data.items ?? []);
      setSpotifyView('playlists');
    } catch (e) { setStatus(`Error: ${String(e)}`); }
    finally { setPlaylistLoading(false); }
  }, [spotifyToken]);

  /* ── Spotify: fetch playlist tracks ────────────────────────────────── */
  const fetchPlaylistTracks = useCallback(async (pl: SpotifyPlaylist) => {
    if (!spotifyToken) return;
    setSelectedPlaylist(pl); setTracksLoading(true); setSpotifyView('tracks');
    try {
      const res  = await fetch(
        `https://api.spotify.com/v1/playlists/${pl.id}/tracks?limit=30&fields=items(track(id,name,artists,album,duration_ms,preview_url,external_urls))`,
        { headers: { Authorization: `Bearer ${spotifyToken}` } }
      );
      if (!res.ok) throw new Error(`Spotify ${res.status}`);
      const data = await res.json();
      setSpotifyTracks((data.items ?? []).map((i: { track: SpotifyTrack }) => i.track).filter(Boolean));
    } catch (e) { setStatus(`Error: ${String(e)}`); }
    finally { setTracksLoading(false); }
  }, [spotifyToken]);

  /* ── Freesound: search ──────────────────────────────────────────────── */
  const searchFreesound = useCallback(async (page = 1) => {
    if (!fsQuery.trim()) return;
    setFsLoading(true); setStatus(null);
    try {
      const params = new URLSearchParams({ q: fsQuery, filter: fsFilter, sort: fsSort, page_size: '15', page: String(page) });
      const res    = await fetch(`/api/freesound/search?${params.toString()}`);
      if (!res.ok) throw new Error(`Freesound API ${res.status}`);
      const data   = await res.json();
      if (page === 1) setFsResults(data.results ?? []);
      else            setFsResults(prev => [...prev, ...(data.results ?? [])]);
      setFsTotal(data.count ?? 0);
      setFsNextUrl(data.next ?? null);
      setFsPage(page);
    } catch (e) { setStatus(`Freesound error: ${String(e)}`); }
    finally { setFsLoading(false); }
  }, [fsQuery, fsFilter, fsSort]);

  /* ── Freesound: preview playback ────────────────────────────────────── */
  const togglePreview = useCallback((sound: FreesoundSound) => {
    if (fsPreviewId === sound.id) {
      audioRef.current?.pause();
      setFsPreviewId(null);
      return;
    }
    if (audioRef.current) audioRef.current.pause();
    const audio  = new Audio(sound.previews['preview-hq-mp3']);
    audio.onended = () => setFsPreviewId(null);
    audio.play().catch(() => {});
    audioRef.current = audio;
    setFsPreviewId(sound.id);
  }, [fsPreviewId]);

  /* ── Load from URL into deck ────────────────────────────────────────── */
  const loadFromUrl = useCallback(async (url: string, target: 'A' | 'B', label?: string) => {
    if (!url.trim()) return;
    setLoading(true);
    setStatus(`Loading "${label ?? url.split('/').pop()}" → Deck ${target}…`);
    try {
      await ensureAudio();
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const name = label ?? url.split('/').pop() ?? 'track.mp3';
      const file = new File([blob], name, { type: blob.type || 'audio/mpeg' });
      await (target === 'A' ? deckA : deckB).load(file);
      setStatus(`✓ "${name}" loaded into Deck ${target}`);
    } catch (e) { setStatus(`Error: ${String(e)}`); }
    finally { setLoading(false); }
  }, [ensureAudio, deckA, deckB]);

  const spotifyConnected = Boolean(spotifyToken);

  /* ─────────────────────────────────────────────────────────────────────
     RENDER
  ───────────────────────────────────────────────────────────────────── */
  return (
    <div className="stream-panel" style={{ overflowY: 'auto', height: '100%' }}>

      {/* ── Header ── */}
      <div className="stream-header">
        <span style={{ fontSize: '0.9rem' }}>☁</span>
        <span className="stream-title">STREAMING INTEGRATION</span>
        {spotifyConnected && activeProvider === 'spotify' && spotifyView !== 'main' && (
          <button className="stream-back-btn" onClick={() => setSpotifyView(v => v === 'tracks' ? 'playlists' : 'main')}>
            ← Back
          </button>
        )}
      </div>

      <div className="stream-content">

        {/* ── Provider tabs ── */}
        <div className="stream-provider-tabs">
          <button
            className={`stream-provider-tab spotify${activeProvider === 'spotify' ? ' active' : ''}`}
            onClick={() => {
              setActiveProvider('spotify');
              // If not connected yet, clicking Spotify tab opens the OAuth flow immediately
              if (!spotifyToken) connectSpotify();
            }}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
            </svg>
            Spotify{spotifyConnected ? <span className="stream-connected-badge" style={{ marginLeft: 4 }}>ON</span> : ''}
          </button>
          <button
            className={`stream-provider-tab freesound${activeProvider === 'freesound' ? ' active' : ''}`}
            onClick={() => setActiveProvider('freesound')}
          >
            🎧 Freesound
          </button>
        </div>

        {/* ── Status bar ── */}
        {status && <div className="stream-status-msg">{status}</div>}

        {/* ══════════════════════════════════════════════════
            SPOTIFY PANEL
        ══════════════════════════════════════════════════ */}
        {activeProvider === 'spotify' && (
          <>
            {/* Not connected — visual funnel + connect button */}
            {!spotifyConnected && (
              <div className="stream-spotify-flow">
                {/* Flow diagram: User → Login → Token → Playlists → DJ Deck */}
                <div className="stream-flow-title">Connect Spotify to your DJ Deck</div>
                <div className="stream-funnel">
                  {[
                    { icon: '👤', label: 'User',            color: '#1DB954' },
                    { icon: '🔐', label: 'Login with Spotify', color: '#1DB954' },
                    { icon: '🔑', label: 'Get Access Token',   color: '#1ed760' },
                    { icon: '📋', label: 'Fetch Playlists',    color: '#00e5ff' },
                    { icon: '🎛', label: 'Display in DJ Deck', color: '#e040fb' },
                  ].map((node, i, arr) => (
                    <div key={i} className="stream-funnel-row">
                      <div className="stream-funnel-node" style={{ borderColor: node.color, color: node.color }}>
                        <span className="stream-funnel-icon">{node.icon}</span>
                        <span className="stream-funnel-label">{node.label}</span>
                      </div>
                      {i < arr.length - 1 && (
                        <div className="stream-funnel-arrow">↓</div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="stream-flow-steps" style={{ marginTop: '0.6rem' }}>
                  {[
                    { label: 'OAuth 2.0 Authorization Code flow — industry-standard secure login.' },
                    { label: 'Client Secret stays server-side — never exposed to the browser.' },
                    { label: 'Access your private & collaborative Spotify playlists.' },
                    { label: 'Load any 30-second preview directly into Deck A or B.' },
                  ].map((item, i) => (
                    <div key={i} className="stream-flow-step">
                      <div className="stream-flow-step-num">{i + 1}</div>
                      <div className="stream-flow-step-label" style={{ fontSize: '0.7rem', color: 'var(--text2)', fontWeight: 400 }}>
                        {item.label}
                      </div>
                    </div>
                  ))}
                </div>
                <button className="stream-spotify-login-btn" style={{ marginTop: '0.7rem' }} onClick={connectSpotify}>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="#fff">
                    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                  </svg>
                  Login with Spotify
                </button>
              </div>
            )}

            {/* Connected — browse playlists button */}
            {spotifyConnected && spotifyView === 'main' && (
              <>
                <div className="stream-spotify-connected-bar">
                  <div className="stream-spotify-connected-info">
                    <span style={{ color: '#1DB954', fontSize: '1rem' }}>✓</span>
                    <div>
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#1DB954' }}>
                        Connected{spotifyUser ? ` as ${spotifyUser}` : ''}
                      </div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>Spotify account linked</div>
                    </div>
                  </div>
                  <button
                    className="stream-spotify-login-btn"
                    style={{ width: 'auto', padding: '0.45rem 1rem', fontSize: '0.72rem' }}
                    onClick={() => { setSpotifyToken(null); setSpotifyUser(null); setPlaylists([]); setSpotifyView('main'); }}
                  >
                    Disconnect
                  </button>
                </div>
                <button className="stream-spotify-login-btn" onClick={fetchPlaylists} disabled={playlistLoading} style={{ marginTop: '0.4rem' }}>
                  {playlistLoading ? '⏳ Loading…' : '📋 Browse My Playlists'}
                </button>
              </>
            )}

            {/* Playlists grid */}
            {spotifyConnected && spotifyView === 'playlists' && (
              <div>
                <div className="stream-section-label" style={{ marginBottom: '0.5rem' }}>YOUR SPOTIFY PLAYLISTS</div>
                {playlistLoading && <div className="stream-loading">⏳ Loading playlists…</div>}
                <div className="stream-playlist-grid">
                  {playlists.map(pl => (
                    <div key={pl.id} className="stream-playlist-card" onClick={() => void fetchPlaylistTracks(pl)}>
                      <div className="stream-playlist-art">
                        {pl.images?.[0]?.url
                          ? <img src={pl.images[0].url} alt={pl.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6 }} />
                          : '🎵'}
                      </div>
                      <div className="stream-playlist-name">{pl.name}</div>
                      <div className="stream-playlist-count">{pl.tracks.total} tracks</div>
                    </div>
                  ))}
                </div>
                {!playlistLoading && playlists.length === 0 && (
                  <div style={{ color: 'var(--muted)', fontSize: '0.75rem', textAlign: 'center', padding: '1rem' }}>No playlists found.</div>
                )}
              </div>
            )}

            {/* Track list */}
            {spotifyConnected && spotifyView === 'tracks' && selectedPlaylist && (
              <div>
                <div className="stream-tracks-header">
                  <div className="stream-tracks-pl-art">
                    {selectedPlaylist.images?.[0]?.url
                      ? <img src={selectedPlaylist.images[0].url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6 }} />
                      : '🎵'}
                  </div>
                  <div>
                    <div className="stream-section-label">{selectedPlaylist.name}</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>{selectedPlaylist.tracks.total} tracks · Spotify</div>
                  </div>
                  <a href={selectedPlaylist.external_urls.spotify} target="_blank" rel="noopener noreferrer" className="stream-open-spotify-btn">↗ Open</a>
                </div>
                {tracksLoading && <div className="stream-loading">⏳ Loading tracks…</div>}
                <div className="stream-demo-tracks">
                  {spotifyTracks.map(track => (
                    <div key={track.id} className="stream-demo-track">
                      <div className="stream-demo-art">
                        {track.album.images?.[0]?.url
                          ? <img src={track.album.images[0].url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 3 }} />
                          : '🎵'}
                      </div>
                      <div className="stream-demo-info">
                        <div className="stream-demo-name">{track.name}</div>
                        <div className="stream-demo-meta">
                          {track.artists.map(a => a.name).join(', ')} · {fmtMs(track.duration_ms)}
                          {!track.preview_url && <span style={{ color: 'var(--muted)', marginLeft: 4 }}>(no preview)</span>}
                        </div>
                      </div>
                      <div className="stream-demo-actions">
                        <button className="stream-deck-btn" disabled={loading || !track.preview_url}
                          onClick={() => track.preview_url && void loadFromUrl(track.preview_url, 'A', track.name)}>→ A</button>
                        <button className="stream-deck-btn b" disabled={loading || !track.preview_url}
                          onClick={() => track.preview_url && void loadFromUrl(track.preview_url, 'B', track.name)}>→ B</button>
                        <a href={track.external_urls.spotify} target="_blank" rel="noopener noreferrer"
                          className="stream-deck-btn" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}>↗</a>
                      </div>
                    </div>
                  ))}
                </div>
                {!tracksLoading && spotifyTracks.length === 0 && (
                  <div style={{ color: 'var(--muted)', fontSize: '0.75rem', textAlign: 'center', padding: '1rem' }}>No playable tracks found.</div>
                )}
              </div>
            )}
          </>
        )}

        {/* ══════════════════════════════════════════════════
            FREESOUND PANEL
        ══════════════════════════════════════════════════ */}
        {activeProvider === 'freesound' && (
          <>
            {/* Brand header */}
            <div className="fs-brand">
              <span className="fs-brand-icon">🎧</span>
              <div>
                <div className="fs-brand-title">Freesound</div>
                <div className="fs-brand-sub">Search 600,000+ free sounds — CC licensed, load directly into any deck</div>
              </div>
            </div>

            {/* Search bar */}
            <div className="fs-search-row">
              <input
                className="fs-search-input"
                placeholder="Search sounds… e.g. drum loop, techno bass, vinyl scratch"
                value={fsQuery}
                onChange={e => setFsQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && void searchFreesound(1)}
              />
              <button className="fs-search-btn" onClick={() => void searchFreesound(1)} disabled={fsLoading || !fsQuery.trim()}>
                {fsLoading ? '⏳' : '🔍'}
              </button>
            </div>

            {/* Filter chips */}
            <div className="fs-filter-row">
              {FREESOUND_FILTERS.map(f => (
                <button
                  key={f.label}
                  className={`fs-filter-chip${fsFilter === f.filter ? ' active' : ''}`}
                  onClick={() => setFsFilter(f.filter)}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Sort row */}
            <div className="fs-sort-row">
              <span className="fs-sort-label">SORT:</span>
              {FREESOUND_SORTS.map(s => (
                <button
                  key={s.value}
                  className={`fs-sort-btn${fsSort === s.value ? ' active' : ''}`}
                  onClick={() => setFsSort(s.value)}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* Results */}
            {fsResults.length > 0 && (
              <div className="stream-section-label" style={{ marginBottom: '0.3rem' }}>
                {fsTotal.toLocaleString()} RESULTS
              </div>
            )}

            <div className="fs-results">
              {fsResults.map(sound => (
                <div key={sound.id} className="fs-result-card">
                  {/* Waveform image */}
                  <div className="fs-result-wave">
                    <img src={sound.images.waveform_m} alt="waveform" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px 4px 0 0', opacity: 0.85 }} />
                    {/* Preview play button */}
                    <button
                      className={`fs-preview-btn${fsPreviewId === sound.id ? ' playing' : ''}`}
                      onClick={() => togglePreview(sound)}
                      title={fsPreviewId === sound.id ? 'Stop preview' : 'Preview sound'}
                    >
                      {fsPreviewId === sound.id ? '■' : '▶'}
                    </button>
                  </div>

                  {/* Info */}
                  <div className="fs-result-info">
                    <div className="fs-result-name" title={sound.name}>{sound.name}</div>
                    <div className="fs-result-meta">
                      <span className="fs-result-user">by {sound.username}</span>
                      <span className="fs-result-dur">{fmtSec(sound.duration)}</span>
                      <span className="fs-result-license" title={sound.license}>
                        {sound.license.includes('by/3') ? 'CC BY 3' : sound.license.includes('by/4') ? 'CC BY 4' : sound.license.includes('0/') ? 'CC0' : 'CC'}
                      </span>
                    </div>
                    <div className="fs-result-tags">
                      {sound.tags.slice(0, 4).map(tag => (
                        <span key={tag} className="fs-result-tag">{tag}</span>
                      ))}
                    </div>
                  </div>

                  {/* Load buttons */}
                  <div className="fs-result-actions">
                    <button
                      className="stream-deck-btn"
                      disabled={loading}
                      onClick={() => void loadFromUrl(sound.previews['preview-hq-mp3'], 'A', sound.name)}
                      title="Load HQ preview to Deck A"
                    >→ A</button>
                    <button
                      className="stream-deck-btn b"
                      disabled={loading}
                      onClick={() => void loadFromUrl(sound.previews['preview-hq-mp3'], 'B', sound.name)}
                      title="Load HQ preview to Deck B"
                    >→ B</button>
                    <a
                      href={`https://freesound.org/s/${sound.id}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="stream-deck-btn"
                      style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}
                      title="Open on Freesound"
                    >↗</a>
                  </div>
                </div>
              ))}
            </div>

            {/* Load more */}
            {fsNextUrl && (
              <button className="fs-load-more-btn" onClick={() => void searchFreesound(fsPage + 1)} disabled={fsLoading}>
                {fsLoading ? '⏳ Loading…' : `Load more (${fsTotal - fsResults.length} remaining)`}
              </button>
            )}

            {/* Empty state */}
            {!fsLoading && fsQuery && fsResults.length === 0 && (
              <div style={{ color: 'var(--muted)', fontSize: '0.75rem', textAlign: 'center', padding: '1.5rem 0' }}>
                No results for "{fsQuery}" — try different keywords or filters
              </div>
            )}

            {/* No search yet */}
            {!fsQuery && fsResults.length === 0 && (
              <div className="fs-empty-state">
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🎧</div>
                <div style={{ fontWeight: 700, color: 'var(--text2)', marginBottom: '0.3rem' }}>Search Freesound</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--muted)', lineHeight: 1.5 }}>
                  600,000+ Creative Commons sounds.<br />
                  Powered by <strong style={{ color: 'var(--text2)' }}>freesound.org</strong>
                </div>
                <div className="fs-suggest-chips">
                  {['drum loop', 'vinyl scratch', 'techno bass', 'ambient pad', 'crowd cheer', 'clap'].map(s => (
                    <button key={s} className="fs-suggest-chip" onClick={() => { setFsQuery(s); void searchFreesound(1); }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Always-visible demo tracks ── */}
        <div style={{ marginTop: '0.5rem' }}>
          <div className="stream-section-label" style={{ marginBottom: '0.4rem' }}>DEMO TRACKS (Free / CC licensed)</div>
          <div className="stream-demo-tracks">
            {DEMO_TRACKS.map(track => (
              <div key={track.id} className="stream-demo-track">
                <div className="stream-demo-art">{track.emoji}</div>
                <div className="stream-demo-info">
                  <div className="stream-demo-name">{track.name}</div>
                  <div className="stream-demo-meta">{track.meta}</div>
                </div>
                <div className="stream-demo-actions">
                  <button className="stream-deck-btn" disabled={loading} onClick={() => void loadFromUrl(track.url, 'A', track.name)}>→ A</button>
                  <button className="stream-deck-btn b" disabled={loading} onClick={() => void loadFromUrl(track.url, 'B', track.name)}>→ B</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── URL loader ── */}
        <div>
          <div className="stream-section-label" style={{ marginBottom: '0.4rem' }}>LOAD FROM URL (MP3 / WAV)</div>
          <div className="stream-url-input-row">
            <input className="stream-url-input" placeholder="https://example.com/track.mp3" value={urlInput} onChange={e => setUrlInput(e.target.value)} />
            <button className="stream-load-btn" disabled={loading || !urlInput.trim()} onClick={() => void loadFromUrl(urlInput, 'A')}>{loading ? '…' : '→ A'}</button>
            <button className="stream-load-btn" disabled={loading || !urlInput.trim()} onClick={() => void loadFromUrl(urlInput, 'B')}>{loading ? '…' : '→ B'}</button>
          </div>
        </div>

      </div>
    </div>
  );
}
