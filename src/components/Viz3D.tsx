'use client';

import { useEffect, useState } from 'react';
import { getAnalyser } from '@/lib/audio';

const freqData = new Uint8Array(128);

function readFreq() {
  const analyser = getAnalyser();
  if (analyser) analyser.getByteFrequencyData(freqData);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

interface Props { active: boolean; }

export default function Viz3D({ active }: Props) {
  const [bars, setBars] = useState<number[]>(() => Array.from({ length: 28 }, () => 0.2));

  useEffect(() => {
    if (!active) return;

    let frame = 0;
    const tick = () => {
      readFreq();
      const next = Array.from({ length: 28 }, (_, index) => {
        const sampleIndex = Math.floor((index / 27) * (freqData.length - 1));
        return clamp(freqData[sampleIndex] / 255, 0.08, 1);
      });
      setBars(next);
      frame = window.requestAnimationFrame(tick);
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [active]);

  if (!active) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        background: 'radial-gradient(circle at top, rgba(255,140,0,0.22), transparent 45%), rgba(5,7,12,0.85)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(255,255,255,0.04), transparent 35%, rgba(0,229,255,0.1))',
          filter: 'blur(4px)',
        }}
      />
      {bars.map((value, index) => (
        <div
          key={index}
          style={{
            position: 'absolute',
            left: `${(index / (bars.length - 1)) * 100}%`,
            bottom: 0,
            width: '2px',
            height: `${Math.max(8, value * 220)}px`,
            transform: 'translateX(-50%)',
            background: `linear-gradient(180deg, rgba(255,140,0,0.95), rgba(0,229,255,0.85))`,
            boxShadow: '0 0 12px rgba(255,140,0,0.35)',
            opacity: 0.8,
            borderRadius: 999,
          }}
        />
      ))}
    </div>
  );
}
