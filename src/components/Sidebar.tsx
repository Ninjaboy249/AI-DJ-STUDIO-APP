'use client';
import type { UseDeck } from '@/lib/useDeck';
import type { StudioUser } from './App';

interface Props {
  activeView: string;
  setActiveView: (v: string) => void;
  deckA: UseDeck;
  deckB: UseDeck;
  open: boolean;
  onToggle: () => void;
  onSettings: () => void;
  onHelp: () => void;
  onLogout: () => void;
  user: StudioUser | null;
}

const NAV_ITEMS = [
  { id: 'djdeck',    icon: '⬡', label: 'DJ DECK'      },
  { id: 'library',   icon: '◧', label: 'LIBRARY'      },
  { id: 'beatmaker', icon: '⊕', label: 'BEAT MAKER'   },
  { id: 'effects',   icon: '⚙', label: 'EFFECTS'      },
  { id: 'visuals',   icon: '◈', label: 'LIVE VISUALS'  },
  { id: 'community', icon: '◉', label: 'COMMUNITY'    },
  { id: 'learner',   icon: '🎓', label: 'LEARN DJ'     },
  { id: 'stream',    icon: '☁', label: 'STREAM'       },
];

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function Sidebar({ activeView, setActiveView, deckA, open, onToggle, onSettings, onHelp, onLogout, user }: Props) {
  const track = deckA.state.track;
  const progress = track ? deckA.position : 0;

  return (
    <aside className={`sidebar${open ? ' open' : ' collapsed'}`}>
      <button className="drawer-toggle nav-drawer-toggle" onClick={onToggle} aria-label={open ? 'Collapse navigation' : 'Open navigation'} title={open ? 'Collapse navigation' : 'Open navigation'}>
        {open ? '‹' : '☰'}
      </button>
      <nav className="sidebar-nav">
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            className={`sidebar-item${activeView === item.id ? ' active' : ''}`}
            onClick={() => setActiveView(item.id)}
            title={!open ? item.label : undefined}
            aria-label={item.label}
          >
            <span className="sidebar-item-icon">{item.icon}</span>
            <span className="sidebar-item-label">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Now playing mini card */}
      {open && <div className="sidebar-now-playing">
        <div className="sidebar-np-label">NOW PLAYING</div>
        <div className="sidebar-np-track">{track ? track.name : 'No track'}</div>
        <div className="sidebar-np-artist" style={{ color: 'var(--text2)', fontSize: '0.66rem' }}>
          {track ? 'Local File' : '—'}
        </div>
        <div className="sidebar-np-waveform">
          <div
            className="sidebar-np-progress"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <div className="sidebar-bpm">
          <span>{track ? fmt(deckA.position * (track.duration ?? 0)) : '0:00'}</span>
          <span style={{ marginLeft: 'auto' }}>
            {track ? fmt(track.duration ?? 0) : '0:00'}
          </span>
        </div>
        {track && (
          <div className="sidebar-bpm">
            <span style={{ fontWeight: 700, color: 'var(--text2)' }}>
              {Math.round(deckA.state.tempo * 128)} BPM
            </span>
            <span className="key-badge" style={{ marginLeft: 'auto' }}>8A</span>
          </div>
        )}
      </div>}

      {/* Sidebar bottom icons */}
      <div className="sidebar-bottom">
        {user && <button className="sidebar-bottom-btn" title="Settings" onClick={onSettings}>⚙</button>}
        <button className="sidebar-bottom-btn" title="Help and feedback" onClick={onHelp}>?</button>
        <button className="sidebar-bottom-btn" title={user ? 'Log out' : 'Login first to enable logout'} onClick={onLogout} disabled={!user}>⎋</button>
      </div>
    </aside>
  );
}
