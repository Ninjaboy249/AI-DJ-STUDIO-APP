'use client';
import type { ActiveView } from './App';

interface Props {
  activeTab: ActiveView;
  setActiveTab: (v: ActiveView) => void;
  deckAName?: string;
  deckBName?: string;
  onProfile: () => void;
  profileImage: string | null;
}

const TABS: { id: ActiveView; label: string }[] = [
  { id: 'deck',      label: 'DJ DECK'      },
  { id: 'playlist',  label: 'PLAYLIST'     },
  { id: 'ai',        label: 'AI ASSISTANT' },
  { id: 'beatmaker', label: 'BEAT MAKER'   },
  { id: 'settings',  label: 'SETTINGS'     },
];

export default function TopNav({ activeTab, setActiveTab, onProfile, profileImage }: Props) {
  return (
    <header className="topnav">
      {/* Logo */}
      <div className="topnav-logo">
        <div className="topnav-logo-icon">
          {[14, 22, 16, 20, 12, 18].map((h, i) => (
            <span key={i} style={{ height: h }} />
          ))}
        </div>
        <span className="topnav-logo-text">AI DJ STUDIO</span>
      </div>

      {/* Center tabs */}
      <nav className="topnav-tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`topnav-tab${activeTab === t.id ? ' active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* Right section */}
      <div className="topnav-right">
        <div className="live-badge">
          <div className="live-dot" />
          LIVE
        </div>
        <div className="viewer-count">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
          </svg>
          1.2K
        </div>
        <button className="topnav-avatar" onClick={onProfile} title="Login and edit profile">{profileImage ? <img src={profileImage} alt="DJ profile" /> : 'DJ'}</button>
      </div>
    </header>
  );
}
