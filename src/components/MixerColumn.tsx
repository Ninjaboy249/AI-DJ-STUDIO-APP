'use client';
// MixerColumn — center channel: EQ knobs, level faders, crossfader, master, CUE.

import { useState } from 'react';
import Knob from './Knob';
import type { UseDeck } from '@/lib/useDeck';

interface Props {
  crossfader: number;
  setCrossfader: (v: number) => void;
  masterVolume: number;
  setMasterVolume: (v: number) => void;
  deckA: UseDeck;
  deckB: UseDeck;
}

const dB = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(0)}`;

export default function MixerColumn({
  crossfader, setCrossfader, masterVolume, setMasterVolume, deckA, deckB
}: Props) {
  const [activeMode, setActiveMode] = useState<'MIXER' | 'EQ' | 'FILTER' | 'FX' | 'SAMPLER'>('MIXER');
  const [cueA, setCueA] = useState(false);
  const [cueB, setCueB] = useState(false);
  const modes = ['MIXER', 'EQ', 'FILTER', 'FX', 'SAMPLER'] as const;

  return (
    <div className="mixer-col" data-mode={activeMode.toLowerCase()}>
      <div className="mixer-tabs" aria-label="Mixer modes">
        {modes.map(mode => (
          <button
            key={mode}
            type="button"
            className={activeMode === mode ? 'active' : ''}
            aria-pressed={activeMode === mode}
            onClick={() => setActiveMode(mode)}
          >{mode}</button>
        ))}
      </div>

      {/* EQ knobs row: HIGH / MID / HID / MID for A+B */}
      <div className="mixer-eq-row">
        {/* Deck A EQ */}
        <div className="mixer-knob-col">
          <span className="mixer-knob-label">HIGH</span>
          <Knob size={28} label="" value={deckA.state.eqHigh} min={-12} max={12}
            onChange={v => deckA.setEq('eqHigh', v)} format={dB} />
        </div>
        <div className="mixer-knob-col">
          <span className="mixer-knob-label">MID</span>
          <Knob size={28} label="" value={deckA.state.eqMid} min={-12} max={12}
            onChange={v => deckA.setEq('eqMid', v)} format={dB} />
        </div>
        {/* Deck B EQ */}
        <div className="mixer-knob-col">
          <span className="mixer-knob-label">HID</span>
          <Knob size={28} label="" value={deckB.state.eqHigh} min={-12} max={12}
            onChange={v => deckB.setEq('eqHigh', v)} format={dB} />
        </div>
        <div className="mixer-knob-col">
          <span className="mixer-knob-label">MID</span>
          <Knob size={28} label="" value={deckB.state.eqMid} min={-12} max={12}
            onChange={v => deckB.setEq('eqMid', v)} format={dB} />
        </div>
      </div>

      <div className="mixer-cue-row">
        <button className={cueA ? 'active a' : 'a'} onClick={() => setCueA(value => !value)}>CUE</button>
        <span>{activeMode}</span>
        <button className={cueB ? 'active b' : 'b'} onClick={() => setCueB(value => !value)}>CUE</button>
      </div>

      {/* Second EQ row: LOW / LIN / LOW / MID */}
      <div className="mixer-eq-row">
        <div className="mixer-knob-col">
          <span className="mixer-knob-label">LOW</span>
          <Knob size={28} label="" value={deckA.state.eqLow} min={-12} max={12}
            onChange={v => deckA.setEq('eqLow', v)} format={dB} />
        </div>
        <div className="mixer-knob-col">
          <span className="mixer-knob-label">LIN</span>
          <Knob size={28} label="" value={deckA.state.filterCutoff} min={-1} max={1}
            onChange={v => deckA.setFilter(v)} format={v => v.toFixed(1)} />
        </div>
        <div className="mixer-knob-col">
          <span className="mixer-knob-label">LOW</span>
          <Knob size={28} label="" value={deckB.state.eqLow} min={-12} max={12}
            onChange={v => deckB.setEq('eqLow', v)} format={dB} />
        </div>
        <div className="mixer-knob-col">
          <span className="mixer-knob-label">MID</span>
          <Knob size={28} label="" value={deckB.state.filterCutoff} min={-1} max={1}
            onChange={v => deckB.setFilter(v)} format={v => v.toFixed(1)} />
        </div>
      </div>

      {/* Channel faders + level meters */}
      <div className="mixer-faders">
        {/* Deck A fader */}
        <div className="level-fader-wrap">
          <div className="level-meter">
            <div className="level-bar" style={{ height: `${Math.max(12, deckA.level * 100)}%` }} />
          </div>
          <input
            className="channel-fader"
            type="range" min={0} max={1} step={0.01}
            value={deckA.state.volume}
            onChange={e => deckA.setVolume(parseFloat(e.target.value))}
          />
          <button className="fader-label a" onClick={() => setCrossfader(-1)}>A</button>
        </div>

        {/* Master knob in center */}
        <div className="master-section">
          <span className="master-label">MASTER</span>
          <Knob size={32} label="" value={masterVolume} min={0} max={1} defaultValue={0.8}
            onChange={setMasterVolume} format={v => `${Math.round(v * 100)}`} />
          {/* CUE center button */}
          <button className="cue-center-btn" style={{ marginTop: 6 }}>CUE</button>
          <div style={{ height: 16 }} />
          <div className="level-meter" style={{ height: 60, width: 40, flexDirection: 'row', gap: 2 }}>
            <div style={{ flex: 1, background: 'var(--surface)', borderRadius: 3, overflow: 'hidden', display:'flex', flexDirection:'column-reverse' }}>
              <div className="level-bar" style={{ height: `${Math.max(18, Math.max(deckA.level, deckB.level) * 100)}%` }} />
            </div>
            <div style={{ flex: 1, background: 'var(--surface)', borderRadius: 3, overflow: 'hidden', display:'flex', flexDirection:'column-reverse' }}>
              <div className="level-bar" style={{ height: `${Math.max(14, Math.max(deckA.level, deckB.level) * 95)}%` }} />
            </div>
          </div>
        </div>

        {/* Deck B fader */}
        <div className="level-fader-wrap">
          <div className="level-meter">
            <div className="level-bar" style={{ height: `${Math.max(12, deckB.level * 100)}%` }} />
          </div>
          <input
            className="channel-fader"
            type="range" min={0} max={1} step={0.01}
            value={deckB.state.volume}
            onChange={e => deckB.setVolume(parseFloat(e.target.value))}
          />
          <button className="fader-label b" onClick={() => setCrossfader(1)}>B</button>
        </div>
      </div>

      {/* Crossfader */}
      <div className="crossfader-section">
        <div className="crossfader-labels">
          <span className="lbl-a">A</span>
          <span className="lbl-b">B</span>
        </div>
        <input
          className="crossfader-input"
          type="range" min={-1} max={1} step={0.01}
          value={crossfader}
          onChange={e => setCrossfader(parseFloat(e.target.value))}
          onDoubleClick={() => setCrossfader(0)}
          title="Double-click to center"
        />
      </div>
    </div>
  );
}
