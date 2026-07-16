'use client';

import { useEffect, useRef, useState } from 'react';
import { getAnalyser } from '@/lib/audio';

const freqData = new Uint8Array(128);

function readFreq() {
  const analyser = getAnalyser();
  if (analyser) analyser.getByteFrequencyData(freqData);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

interface Props { active: boolean; embedded?: boolean; }

export default function Viz3D({ active, embedded = false }: Props) {
  const [bars, setBars] = useState<number[]>(() => Array.from({ length: 28 }, () => 0.2));
  // Keep a ref to the running frame so we can cancel it synchronously
  const frameRef = useRef<number>(0);

  useEffect(() => {
    // Always cancel any existing frame first — handles both deactivation and re-activation
    window.cancelAnimationFrame(frameRef.current);

    if (!active) {
      setBars(Array.from({ length: 28 }, () => 0));
      return;
    }

    const tick = () => {
      readFreq();
      const next = Array.from({ length: 28 }, (_, index) => {
        const sampleIndex = Math.floor((index / 27) * (freqData.length - 1));
        return clamp(freqData[sampleIndex] / 255, 0.08, 1);
      });
      setBars(next);
      frameRef.current = window.requestAnimationFrame(tick);
    };

    frameRef.current = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameRef.current);
  }, [active]);

  if (!active) return null;

  return (
    <div
      style={{
        position: embedded ? 'absolute' : 'fixed',
        inset: 0,
        zIndex: embedded ? 3 : 80,
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
          key={`ring-${index}`}
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: `${36 + index * (embedded ? 8 : 18)}px`,
            height: `${36 + index * (embedded ? 8 : 18)}px`,
            border: `1px solid rgba(${index % 2 ? '0,229,255' : '224,64,251'},${0.12 + value * 0.45})`,
            borderRadius: '50%',
            transform: `translate(-50%, -50%) rotate(${index * 11 + value * 90}deg) scale(${0.85 + value * 0.5})`,
            boxShadow: `0 0 ${8 + value * 22}px rgba(0,229,255,${0.08 + value * 0.2})`,
          }}
        />
      ))}
      {bars.map((value, index) => (
        <div
          key={`bar-${index}`}
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
