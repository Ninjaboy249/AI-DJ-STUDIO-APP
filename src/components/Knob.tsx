'use client';
// Knob — a small rotary control. Drag vertically to change; double-click to reset.
// Used for the 3-band EQ and the DJ filter. Ported from the desktop EQKnob, with the
// Tailwind classes swapped for plain CSS.

import { useCallback, useRef } from 'react';

interface Props {
  label: string;
  value: number;
  min: number;
  max: number;
  defaultValue?: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
  size?: number; // diameter in px, default 40
}

export default function Knob({
  label,
  value,
  min,
  max,
  defaultValue = 0,
  onChange,
  format,
  size = 40,
}: Props) {
  const dragRef = useRef<{ startY: number; startValue: number } | null>(null);

  // Map value → -135°..+135° sweep.
  const rotation = ((value - min) / (max - min)) * 270 - 135;

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      dragRef.current = { startY: e.clientY, startValue: value };
      const range = max - min;

      const move = (ev: PointerEvent) => {
        if (!dragRef.current) return;
        const deltaY = dragRef.current.startY - ev.clientY;
        const next = dragRef.current.startValue + (deltaY * range) / 150; // 150px = full sweep
        onChange(Math.max(min, Math.min(max, Math.round(next * 10) / 10)));
      };
      const up = () => {
        dragRef.current = null;
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    },
    [value, min, max, onChange],
  );

  const inner = Math.round(size * 0.7);

  return (
    <div className="knob">
      {label && <span className="knob-label">{label}</span>}
      <div
        className="knob-body"
        style={{ width: size, height: size }}
        onPointerDown={handlePointerDown}
        onDoubleClick={() => onChange(defaultValue)}
      >
        <div
          style={{
            width: inner, height: inner, borderRadius: '50%',
            background: 'radial-gradient(circle at 40% 35%, #2e2e3e, #16161f)',
            display: 'flex', justifyContent: 'center',
            transform: `rotate(${rotation}deg)`,
          }}
        >
          <div className="knob-tick" style={{ width: 2, height: Math.round(inner * 0.3), marginTop: 3 }} />
        </div>
      </div>
      <span className="knob-val">{format ? format(value) : value.toFixed(1)}</span>
    </div>
  );
}
