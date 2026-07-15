// beatsynth-tone.ts — Tone.js beat synthesiser.
//
// Replaces the raw Web Audio API lookahead scheduler (beatsynth.ts) with
// Tone.js Transport + Sequence, which gives us:
//   - Precise BPM-locked scheduling with built-in lookahead
//   - MembraneSynth for kick, MetalSynth for hi-hats/claps, Synth for bass/melody
//   - Tone.Reverb, Tone.FeedbackDelay for FX — no manual IR generation needed
//   - onStep callback for UI step-grid highlighting (same interface as before)
//
// Usage is identical to the old BeatPlayer class:
//   const player = new BeatPlayer(audioCtx, spec);
//   player.onStep = (i) => setActiveStep(i);
//   player.start();
//   player.stop();

import type { BeatSpec } from './granite';

// Tone.js is browser-only — imported dynamically when needed.
// The type import is fine in a .ts file (erased at compile time).
import type * as ToneType from 'tone';

let Tone: typeof ToneType | null = null;

async function getTone(): Promise<typeof ToneType> {
  if (!Tone) Tone = await import('tone');
  return Tone;
}

// ── MIDI → frequency ─────────────────────────────────────────────────────────
const midiToNote = (midi: number): string => {
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(midi / 12) - 1;
  return `${notes[midi % 12]}${octave}`;
};

// ── BeatPlayer ────────────────────────────────────────────────────────────────

export class BeatPlayer {
  private spec: BeatSpec;
  private audioCtx: AudioContext;
  private started = false;

  // Tone nodes — populated in start()
  private kick:    ToneType.MembraneSynth | null = null;
  private snare:   ToneType.NoiseSynth    | null = null;
  private hihat:   ToneType.MetalSynth    | null = null;
  private openhat: ToneType.MetalSynth    | null = null;
  private clap:    ToneType.NoiseSynth    | null = null;
  private bass:    ToneType.Synth         | null = null;
  private synth:   ToneType.PolySynth     | null = null;
  private reverb:  ToneType.Reverb        | null = null;
  private delay:   ToneType.FeedbackDelay | null = null;
  private master:  ToneType.Gain          | null = null;
  private seq:     ToneType.Sequence<number> | null = null;

  onStep?: (step: number) => void;

  constructor(audioCtx: AudioContext, spec: BeatSpec) {
    this.audioCtx = audioCtx;
    this.spec     = spec;
  }

  async start() {
    if (this.started) return;
    this.started = true;

    const T = await getTone();

    // Share the existing AudioContext so Elementary and Tone use the same clock
    // and both output through the shared AnalyserNode chain.
    await T.setContext(this.audioCtx as unknown as ToneType.BaseContext);
    await T.start();

    T.getTransport().bpm.value = this.spec.bpm;
    T.getTransport().timeSignature = 4;

    // ── FX chain ─────────────────────────────────────────────────────────────
    this.reverb  = new T.Reverb({ decay: 1.5, wet: this.spec.fx.reverb }).toDestination();
    this.delay   = new T.FeedbackDelay({ delayTime: '8n', feedback: 0.35, wet: this.spec.fx.delay * 0.6 }).toDestination();
    this.master  = new T.Gain(0.85).toDestination();

    // ── Synth voices → FX ────────────────────────────────────────────────────
    this.kick = new T.MembraneSynth({ pitchDecay: 0.08, octaves: 6 }).connect(this.master);
    this.kick.connect(this.reverb);

    this.snare = new T.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.18, sustain: 0 } }).connect(this.master);

    this.hihat = new T.MetalSynth({ envelope: { attack: 0.001, decay: 0.06, sustain: 0 }, harmonicity: 5.1, modulationIndex: 32, resonance: 4000, octaves: 1.5 }).connect(this.master);

    this.openhat = new T.MetalSynth({ envelope: { attack: 0.001, decay: 0.28, sustain: 0 }, harmonicity: 5.1, modulationIndex: 32, resonance: 4000, octaves: 1.5 }).connect(this.master);

    this.clap = new T.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.001, decay: 0.1, sustain: 0 } }).connect(this.master);

    this.bass = new T.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.001, decay: 0.35, sustain: 0, release: 0.1 }, volume: -6 }).connect(this.master);

    this.synth = new T.PolySynth(T.Synth, {
      oscillator: { type: this.spec.synth.wave as 'sawtooth' | 'square' | 'sine' },
      envelope: { attack: 0.001, decay: 0.25, sustain: 0.1, release: 0.15 },
      volume: -10,
    }).connect(this.master);
    this.synth.connect(this.delay);
    this.synth.connect(this.reverb);

    // ── Sequence ─────────────────────────────────────────────────────────────
    const steps = Array.from({ length: 16 }, (_, i) => i);

    this.seq = new T.Sequence((time: number, step: number) => {
      const s = this.spec;

      // Drums
      if (s.drums.kick[step]?.on)    this.kick!.triggerAttackRelease('C1', '8n', time, s.drums.kick[step].vel);
      if (s.drums.snare[step]?.on)   this.snare!.triggerAttackRelease('8n', time, s.drums.snare[step].vel);
      if (s.drums.hihat[step]?.on)   this.hihat!.triggerAttackRelease('32n', time, s.drums.hihat[step].vel * 0.5);
      if (s.drums.openhat[step]?.on) this.openhat!.triggerAttackRelease('8n', time, s.drums.openhat[step].vel * 0.5);
      if (s.drums.clap[step]?.on)    this.clap!.triggerAttackRelease('16n', time, s.drums.clap[step].vel * 0.7);

      // Bass
      const bassNote = s.bass.notes[step];
      if (bassNote > 0) {
        const hz = midiToNote(bassNote + (s.bass.octave - 3) * 12);
        this.bass!.triggerAttackRelease(hz, '16n', time, 0.8);
      }

      // Synth
      const synthNote = s.synth.notes[step];
      if (synthNote > 0) {
        this.synth!.triggerAttackRelease(midiToNote(synthNote), '16n', time, 0.6);
      }

      // UI callback — schedule to fire on next animation frame
      T.getDraw().schedule(() => { this.onStep?.(step); }, time);
    }, steps, '16n');

    this.seq.start(0);
    T.getTransport().start();
  }

  stop() {
    if (!this.started) return;
    this.started = false;

    // Fade out master then clean up all nodes
    void getTone().then((T) => {
      T.getTransport().stop();
      this.seq?.stop();
      this.seq?.dispose();
      this.kick?.dispose();
      this.snare?.dispose();
      this.hihat?.dispose();
      this.openhat?.dispose();
      this.clap?.dispose();
      this.bass?.dispose();
      this.synth?.dispose();
      this.reverb?.dispose();
      this.delay?.dispose();
      this.master?.dispose();
      this.seq = null;
    });
  }

  isPlaying() { return this.started; }

  updateSpec(spec: BeatSpec) {
    this.spec = spec;
    void getTone().then((T) => {
      T.getTransport().bpm.value = spec.bpm;
    });
  }
}
