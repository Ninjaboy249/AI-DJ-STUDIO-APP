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
let recordingDestination: MediaStreamAudioDestinationNode | null = null;

interface NativeDeck {
  buffer: AudioBuffer;
  reverseBuffer: AudioBuffer;
  source: AudioBufferSourceNode | null;
  scratchSource: AudioBufferSourceNode | null;
  filter: BiquadFilterNode;
  dryGain: GainNode;
  echoDelay: DelayNode;
  echoFeedback: GainNode;
  echoWet: GainNode;
  reverb: ConvolverNode;
  reverbWet: GainNode;
  gain: GainNode;
  analyser: AnalyserNode;
  meterData: Float32Array<ArrayBuffer>;
  offset: number;
  startedAt: number;
  playing: boolean;
  rate: number;
  loopIn: number;
  loopOut: number;
  looping: boolean;
}
const nativeDecks = new Map<string, NativeDeck>();

function createImpulse(ctx: AudioContext): AudioBuffer {
  const seconds = 1.8;
  const length = Math.floor(ctx.sampleRate * seconds);
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < impulse.numberOfChannels; ch++) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.2);
    }
  }
  return impulse;
}

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

export function getMixRecordingStream(): MediaStream {
  if (!runtime) throw new Error('Audio engine is not ready');
  if (!recordingDestination) {
    recordingDestination = runtime.ctx.createMediaStreamDestination();
    runtime.analyser.connect(recordingDestination);
  }
  return recordingDestination.stream;
}

export function registerNativeDeck(id: string, buffer: AudioBuffer): void {
  if (!runtime) throw new Error('Audio engine is not ready');
  const old = nativeDecks.get(id);
  if (old?.source) { try { old.source.stop(); } catch {} }
  if (old?.scratchSource) { try { old.scratchSource.stop(); } catch {} }
  const gain = old?.gain ?? runtime.ctx.createGain();
  const filter = old?.filter ?? runtime.ctx.createBiquadFilter();
  const dryGain = old?.dryGain ?? runtime.ctx.createGain();
  const echoDelay = old?.echoDelay ?? runtime.ctx.createDelay(1.5);
  const echoFeedback = old?.echoFeedback ?? runtime.ctx.createGain();
  const echoWet = old?.echoWet ?? runtime.ctx.createGain();
  const reverb = old?.reverb ?? runtime.ctx.createConvolver();
  const reverbWet = old?.reverbWet ?? runtime.ctx.createGain();
  const analyser = old?.analyser ?? runtime.ctx.createAnalyser();
  const meterData = old?.meterData ?? new Float32Array(512);
  const reverseBuffer = runtime.ctx.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const input = buffer.getChannelData(channel);
    const output = reverseBuffer.getChannelData(channel);
    for (let i = 0; i < input.length; i++) output[i] = input[input.length - 1 - i];
  }
  if (!old) {
    filter.type = 'allpass';
    filter.frequency.value = 20000;
    dryGain.gain.value = 1;
    echoDelay.delayTime.value = 0.32;
    echoFeedback.gain.value = 0.36;
    echoWet.gain.value = 0;
    reverb.buffer = createImpulse(runtime.ctx);
    reverbWet.gain.value = 0;

    filter.connect(dryGain);
    dryGain.connect(gain);
    filter.connect(echoDelay);
    echoDelay.connect(echoFeedback);
    echoFeedback.connect(echoDelay);
    echoDelay.connect(echoWet);
    echoWet.connect(gain);
    filter.connect(reverb);
    reverb.connect(reverbWet);
    reverbWet.connect(gain);
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.18;
    gain.connect(analyser);
    analyser.connect(runtime.analyser);
  }
  gain.gain.value = 1;
  nativeDecks.set(id, {
    buffer,
    reverseBuffer,
    source: null,
    scratchSource: null,
    filter,
    dryGain,
    echoDelay,
    echoFeedback,
    echoWet,
    reverb,
    reverbWet,
    gain,
    analyser,
    meterData,
    offset: 0,
    startedAt: 0,
    playing: false,
    rate: 1,
    loopIn: 0,
    loopOut: 1,
    looping: false,
  });
}

/** Instantaneous post-fader level for one native deck, shaped for a responsive VU meter. */
export function nativeDeckLevel(id: string): number {
  const deck = nativeDecks.get(id);
  if (!deck || !deck.playing) return 0;
  deck.analyser.getFloatTimeDomainData(deck.meterData);
  let sum = 0;
  let peak = 0;
  for (let i = 0; i < deck.meterData.length; i++) {
    const sample = Math.abs(deck.meterData[i]);
    sum += sample * sample;
    if (sample > peak) peak = sample;
  }
  const rms = Math.sqrt(sum / deck.meterData.length);
  return Math.max(0, Math.min(1, rms * 4.8 + peak * 0.32));
}

function startNative(deck: NativeDeck): void {
  if (!runtime) return;
  const source = runtime.ctx.createBufferSource();
  source.buffer = deck.buffer;
  source.playbackRate.value = deck.rate;
  source.connect(deck.filter);
  source.loop = deck.looping && deck.loopOut > deck.loopIn;
  if (source.loop) {
    source.loopStart = deck.loopIn * deck.buffer.duration;
    source.loopEnd = deck.loopOut * deck.buffer.duration;
  }
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
    deck.offset = nativeDeckPosition(id) * deck.buffer.duration;
    const source = deck.source; deck.source = null; deck.playing = false;
    if (source) { source.onended = null; try { source.stop(); } catch {} }
    return false;
  }
  if (deck.scratchSource) {
    deck.scratchSource.onended = null;
    try { deck.scratchSource.stop(); } catch {}
    deck.scratchSource = null;
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

/** Plays the short piece of audio traversed by a vinyl jog movement. */
export function scratchNativeDeck(id: string, fromNorm: number, toNorm: number, seconds: number): void {
  const deck = nativeDecks.get(id); if (!runtime || !deck || fromNorm === toNorm) return;
  const duration = deck.buffer.duration;
  const from = Math.max(0, Math.min(1, fromNorm));
  const to = Math.max(0, Math.min(1, toNorm));
  deck.offset = to * duration;

  const previous = deck.scratchSource;
  if (previous) { previous.onended = null; try { previous.stop(); } catch {} }

  const backwards = to < from;
  const source = runtime.ctx.createBufferSource();
  source.buffer = backwards ? deck.reverseBuffer : deck.buffer;
  source.playbackRate.value = Math.max(.2, Math.min(4, Math.abs(to - from) * duration / Math.max(.008, seconds)));
  source.connect(deck.filter);
  deck.scratchSource = source;
  source.onended = () => { if (deck.scratchSource === source) deck.scratchSource = null; };
  const offset = backwards ? (1 - from) * duration : from * duration;
  source.start(0, Math.max(0, Math.min(duration - .001, offset)));
  source.stop(runtime.ctx.currentTime + Math.max(.04, Math.min(.12, seconds * 2)));
}

export function updateNativeDeckLoop(id: string, loopIn: number, loopOut: number, looping: boolean): void {
  const deck = nativeDecks.get(id); if (!runtime || !deck) return;
  deck.loopIn = Math.max(0, Math.min(1, loopIn));
  deck.loopOut = Math.max(deck.loopIn, Math.min(1, loopOut));
  deck.looping = looping && deck.loopOut > deck.loopIn;
  if (!deck.source) return;
  deck.source.loop = deck.looping;
  if (deck.source.loop) {
    deck.source.loopStart = deck.loopIn * deck.buffer.duration;
    deck.source.loopEnd = deck.loopOut * deck.buffer.duration;
  }
}

export function nativeDeckPosition(id: string): number {
  const deck = nativeDecks.get(id); if (!runtime || !deck || !deck.buffer.duration) return 0;
  let seconds = deck.playing ? deck.offset + (runtime.ctx.currentTime - deck.startedAt) * deck.rate : deck.offset;
  if (deck.looping && deck.loopOut > deck.loopIn) {
    const start = deck.loopIn * deck.buffer.duration;
    const end = deck.loopOut * deck.buffer.duration;
    const len = Math.max(0.01, end - start);
    if (seconds >= end) seconds = start + ((seconds - start) % len);
  }
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

export function updateNativeDeckFx(
  id: string,
  fx: { filterCutoff?: number; echo?: boolean; reverb?: boolean },
): void {
  const deck = nativeDecks.get(id); if (!runtime || !deck) return;
  const now = runtime.ctx.currentTime;
  if (fx.filterCutoff !== undefined) {
    const cutoff = Math.max(-1, Math.min(1, fx.filterCutoff));
    if (Math.abs(cutoff) < 0.02) {
      deck.filter.type = 'allpass';
      deck.filter.frequency.setTargetAtTime(20000, now, 0.02);
    } else if (cutoff < 0) {
      deck.filter.type = 'lowpass';
      deck.filter.frequency.setTargetAtTime(20000 * Math.pow(100 / 20000, Math.abs(cutoff)), now, 0.02);
    } else {
      deck.filter.type = 'highpass';
      deck.filter.frequency.setTargetAtTime(20 * Math.pow(10000 / 20, cutoff), now, 0.02);
    }
  }
  if (fx.echo !== undefined) {
    deck.echoWet.gain.setTargetAtTime(fx.echo ? 0.32 : 0, now, 0.03);
  }
  if (fx.reverb !== undefined) {
    deck.reverbWet.gain.setTargetAtTime(fx.reverb ? 0.24 : 0, now, 0.04);
  }
}
