// audio.ts — the single Web Audio + Elementary entry point.
//
// @elemaudio/web-renderer ships as a WASM + CommonJS bundle that is not
// executable on the server (no AudioContext, no SharedArrayBuffer for WASM).
// We dynamic-import it inside initAudio() so the module graph on the server
// side never touches it — preventing the webpack
// "__webpack_modules__[moduleId] is not a function" error.

// WebRenderer type only — the value is loaded lazily below.
import type WebRenderer from '@elemaudio/web-renderer';

export interface AudioRuntime {
  ctx: AudioContext;
  core: WebRenderer;
  analyser: AnalyserNode;
}

let runtime: AudioRuntime | null = null;

interface NativeDeck {
  buffer: AudioBuffer;
  source: AudioBufferSourceNode | null;
  gain: GainNode;
  offset: number;
  startedAt: number;
  playing: boolean;
  rate: number;
}
const nativeDecks = new Map<string, NativeDeck>();

/** Returns the shared AnalyserNode (available once initAudio() has been called). */
export function getAnalyser(): AnalyserNode | null {
  return runtime?.analyser ?? null;
}

/**
 * Boots the AudioContext + Elementary WebRenderer. Must be called from a user
 * gesture (click/tap) — browsers refuse to start an AudioContext otherwise.
 * Safe to call repeatedly; it initializes once and resumes a suspended context.
 */
export async function initAudio(): Promise<AudioRuntime> {
  if (runtime) {
    if (runtime.ctx.state === 'suspended') await runtime.ctx.resume();
    return runtime;
  }

  // Dynamic import keeps @elemaudio/web-renderer out of the server bundle.
  const { default: WebRendererClass } = await import('@elemaudio/web-renderer');

  const ctx  = new AudioContext();
  const core = new WebRendererClass();

  // The renderer resolves to a WebAudio node that contains the WASM runtime.
  const node = await core.initialize(
    ctx,
    {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [2],
    },
    50,
  );

  // Tap the output for visualisation: Elementary → analyser → destination.
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.8;
  node.connect(analyser);
  analyser.connect(ctx.destination);

  if (ctx.state === 'suspended') await ctx.resume();

  runtime = { ctx, core, analyser };
  return runtime;
}

export function getRuntime(): AudioRuntime | null {
  return runtime;
}

export function registerNativeDeck(id: string, buffer: AudioBuffer): void {
  if (!runtime) throw new Error('Audio engine is not ready');
  const old = nativeDecks.get(id);
  if (old?.source) { try { old.source.stop(); } catch {} }
  const gain = old?.gain ?? runtime.ctx.createGain();
  if (!old) gain.connect(runtime.analyser);
  gain.gain.value = 1;
  nativeDecks.set(id, { buffer, source: null, gain, offset: 0, startedAt: 0, playing: false, rate: 1 });
}

function startNative(deck: NativeDeck): void {
  if (!runtime) return;
  const source = runtime.ctx.createBufferSource();
  source.buffer = deck.buffer;
  source.playbackRate.value = deck.rate;
  source.connect(deck.gain);
  deck.source = source;
  deck.startedAt = runtime.ctx.currentTime;
  deck.playing = true;
  source.onended = () => {
    if (deck.source !== source) return;
    const elapsed = (runtime!.ctx.currentTime - deck.startedAt) * deck.rate;
    if (deck.offset + elapsed >= deck.buffer.duration - 0.05) deck.offset = 0;
    deck.playing = false; deck.source = null;
  };
  source.start(0, Math.min(deck.offset, Math.max(0, deck.buffer.duration - 0.01)));
}

export async function toggleNativeDeck(id: string): Promise<boolean> {
  const deck = nativeDecks.get(id); if (!runtime || !deck) return false;
  if (runtime.ctx.state !== 'running') await runtime.ctx.resume();
  if (deck.playing) {
    deck.offset = Math.min(deck.buffer.duration, deck.offset + (runtime.ctx.currentTime - deck.startedAt) * deck.rate);
    const source = deck.source; deck.source = null; deck.playing = false;
    if (source) { source.onended = null; try { source.stop(); } catch {} }
    return false;
  }
  if (deck.offset >= deck.buffer.duration) deck.offset = 0;
  startNative(deck); return true;
}

export function seekNativeDeck(id: string, norm: number): void {
  const deck = nativeDecks.get(id); if (!runtime || !deck) return;
  const wasPlaying = deck.playing; const source = deck.source;
  deck.source = null; deck.playing = false; deck.offset = Math.max(0, Math.min(1, norm)) * deck.buffer.duration;
  if (source) { source.onended = null; try { source.stop(); } catch {} }
  if (wasPlaying) startNative(deck);
}

export function nativeDeckPosition(id: string): number {
  const deck = nativeDecks.get(id); if (!runtime || !deck || !deck.buffer.duration) return 0;
  const seconds = deck.playing ? deck.offset + (runtime.ctx.currentTime - deck.startedAt) * deck.rate : deck.offset;
  return Math.max(0, Math.min(1, seconds / deck.buffer.duration));
}

export function updateNativeDeck(id: string, volume: number, rate: number): void {
  const deck = nativeDecks.get(id); if (!runtime || !deck) return;
  deck.gain.gain.setTargetAtTime(volume, runtime.ctx.currentTime, 0.015);
  if (deck.playing && deck.source && rate !== deck.rate) {
    deck.offset += (runtime.ctx.currentTime - deck.startedAt) * deck.rate;
    deck.startedAt = runtime.ctx.currentTime;
    deck.rate = rate; deck.source.playbackRate.setTargetAtTime(rate, runtime.ctx.currentTime, 0.02);
  } else deck.rate = rate;
}
