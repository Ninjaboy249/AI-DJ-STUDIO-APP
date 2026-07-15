'use client';
// LiveVizSection — bottom right visualizer panel.

import dynamic from 'next/dynamic';

// Load canvas visualizer only on client
const Visualizer = dynamic(() => import('./Visualizer'), { ssr: false });

interface Props {
  viz3d: boolean;
  setViz3d: (v: boolean) => void;
}

const VIZ_MODES = ['Cyberpunk City', 'Spectrum', 'Waveform', '3D Rings'];

export default function LiveVizSection({ viz3d, setViz3d }: Props) {
  return (
    <div className="live-viz-section">
      <div className="live-viz-header">
        <span className="live-viz-title">LIVE VISUALIZER</span>
        <select
          className="live-viz-mode-select"
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { setViz3d(e.target.value === '3D Rings'); }}
        >
          {VIZ_MODES.map(m => (
            <option key={m}>{m}</option>
          ))}
        </select>
        <button
          className="live-viz-expand"
          onClick={() => { setViz3d(!viz3d); }}
          title="Toggle 3D / fullscreen"
        >
          ⛶
        </button>
      </div>

      <div className="live-viz-canvas">
        <div className="live-viz-render"><Visualizer active={!viz3d} /></div>
        {/* Neon tunnel placeholder SVG shown when no audio */}
        <svg
          viewBox="0 0 360 180"
          width="100%" height="100%"
          className="live-viz-placeholder"
          style={{ position: 'absolute', inset: 0, opacity: 0.22, pointerEvents: 'none' }}
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <radialGradient id="tg" cx="50%" cy="50%" r="55%">
              <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#0d0d12" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="360" height="180" fill="#050510" />
          <rect width="360" height="180" fill="url(#tg)" />
          {/* Perspective grid */}
          {[-6,-4,-2,0,2,4,6].map((x, i) => (
            <line key={`v${i}`}
              x1={180 + x * 10} y1={90}
              x2={180 + x * 120} y2={180}
              stroke="#7c3aed" strokeWidth="0.5" strokeOpacity="0.4" />
          ))}
          {[1,2,3,4,5].map((y, i) => {
            const t = y / 6;
            const w = 360 * t;
            const cx = 180 - w / 2;
            return <line key={`h${i}`} x1={cx} y1={90 + t * 90} x2={cx + w} y2={90 + t * 90}
              stroke="#7c3aed" strokeWidth="0.5" strokeOpacity={0.2 + t * 0.2} />;
          })}
          {/* Neon circle */}
          <circle cx="180" cy="95" r="55"
            fill="none" stroke="#e040fb" strokeWidth="1.5" strokeOpacity="0.6" />
          <circle cx="180" cy="95" r="38"
            fill="none" stroke="#7c3aed" strokeWidth="1" strokeOpacity="0.5" />
          <circle cx="180" cy="95" r="20"
            fill="none" stroke="#00e5ff" strokeWidth="1" strokeOpacity="0.4" />
        </svg>
      </div>

      {/* Mini wavestrip */}
      <div className="live-viz-wavestrip">
        <svg viewBox="0 0 360 20" width="100%" height="20" preserveAspectRatio="none">
          {Array.from({ length: 90 }, (_, i) => {
            const h = 3 + Math.sin(i * 0.4) * 5 + Math.random() * 4;
            return (
              <rect key={i} x={i * 4} y={(20 - h) / 2} width={2.5} height={h}
                fill={i < 45 ? '#e040fb' : '#00e5ff'} opacity="0.7" rx="1" />
            );
          })}
        </svg>
      </div>
    </div>
  );
}
