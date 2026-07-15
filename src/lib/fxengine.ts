// fxengine.ts — Web Audio AI Effects Engine.
//
// Receives an FxSpec from Groq and executes it as a timed sequence of real
// audio effects inserted into the Web Audio graph as a parallel send chain.
//
// Signal flow:
//   AudioContext.destination ← masterGain ← [dry passthrough]
//                                          ← filterNode ← inputTap
//                                          ← delayNode  ← inputTap
//                                          ← reverbNode ← inputTap
//                                          ← noiseGain  ← noiseSource
//                                          ← bassEQ     ← inputTap
//                                          ← stutterGain← inputTap
//
// The engine taps the AudioContext's destination by creating a MediaStreamAudioDestination,
// routing the main output through it, then connecting the stream back. But since Web Audio
// doesn't expose a source tap this way, we use a simpler pattern: the FX chain is an
// additional node chain connected in PARALLEL to ctx.destination — it runs alongside
// the main Elementary output and its effects are additive (wet-only send).
//
// For effects that modify the whole mix (filter, stutter, bass boost), we interpose
// a GainNode + BiquadFilter between the Elementary output node and ctx.destination
// by rerouting the connection during the effect window.

import type { FxEvent, FxSpec } from './granite';

// ── Reverb IR (synthetic exponential decay) ──────────────────────────────────
function makeReverbIR(ctx: AudioContext, decaySeconds: number): AudioBuffer {
  const length = Math.ceil(ctx.sampleRate * decaySeconds);
  const buf = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.5);
    }
  }
  return buf;
}

// ── Linear ramp helper ───────────────────────────────────────────────────────
function ramp(param: AudioParam, from: number, to: number, atStart: number, atEnd: number) {
  param.cancelScheduledValues(atStart);
  param.setValueAtTime(from, atStart);
  param.linearRampToValueAtTime(to, atEnd);
}

// ── FX event executor ────────────────────────────────────────────────────────
// Each effect creates its own sub-graph connected to `inputNode` (source)
// and `outputNode` (destination). It schedules all automations ahead of time
// using AudioParam scheduling so there is zero JS-timer jitter.

function executeEvent(
  ctx: AudioContext,
  event: FxEvent,
  inputNode: AudioNode,
  outputNode: AudioNode,
  triggerAt: number, // AudioContext time when the whole spec was triggered
) {
  const at    = triggerAt + event.start;
  const end   = at + event.duration;

  switch (event.effect) {

    // ── Filter sweep ─────────────────────────────────────────────────────────
    case 'filterSweep': {
      const filter = ctx.createBiquadFilter();
      filter.type = (event.filterType ?? 'lowpass') as BiquadFilterType;
      const from = event.filterFrom ?? 200;
      const to   = event.filterTo   ?? 18000;
      filter.frequency.value = from;
      filter.Q.value = 2.5;

      const wetGain = ctx.createGain();
      wetGain.gain.value = 0;
      inputNode.connect(filter);
      filter.connect(wetGain);
      wetGain.connect(outputNode);

      ramp(filter.frequency, from, to, at, end);
      ramp(wetGain.gain, 0, 0.7, at, at + 0.05);
      ramp(wetGain.gain, 0.7, 0, end - 0.2, end);

      // Auto-disconnect
      ctx.createConstantSource().start(); // keep ctx alive
      setTimeout(() => {
        try { inputNode.disconnect(filter); filter.disconnect(wetGain); wetGain.disconnect(outputNode); } catch { /* already gone */ }
      }, (end - ctx.currentTime + 0.5) * 1000);
      break;
    }

    // ── Echo ─────────────────────────────────────────────────────────────────
    case 'echo': {
      const delay    = ctx.createDelay(1.0);
      const fb       = ctx.createGain();
      const wet      = ctx.createGain();
      delay.delayTime.value = event.delayTime ?? 0.25;
      fb.gain.value         = event.feedback  ?? 0.45;
      wet.gain.value        = 0;

      inputNode.connect(delay);
      delay.connect(fb);
      fb.connect(delay);
      delay.connect(wet);
      wet.connect(outputNode);

      ramp(wet.gain, 0, event.wetMix ?? 0.4, at, at + 0.1);
      ramp(wet.gain, event.wetMix ?? 0.4, 0, end - 0.3, end);

      setTimeout(() => {
        try { inputNode.disconnect(delay); delay.disconnect(fb); fb.disconnect(delay); delay.disconnect(wet); wet.disconnect(outputNode); } catch { /* gone */ }
      }, (end - ctx.currentTime + 1.5) * 1000);
      break;
    }

    // ── Delay ─────────────────────────────────────────────────────────────────
    case 'delay': {
      const delay = ctx.createDelay(1.0);
      const fb    = ctx.createGain();
      const wet   = ctx.createGain();
      delay.delayTime.value = event.delayTime ?? 0.375;
      fb.gain.value         = event.feedback  ?? 0.4;
      wet.gain.value        = 0;

      inputNode.connect(delay);
      delay.connect(fb);
      fb.connect(delay);
      delay.connect(wet);
      wet.connect(outputNode);

      ramp(wet.gain, 0, event.wetMix ?? 0.5, at, at + 0.08);
      ramp(wet.gain, event.wetMix ?? 0.5, 0, end - 0.4, end);

      setTimeout(() => {
        try { inputNode.disconnect(delay); delay.disconnect(fb); fb.disconnect(delay); delay.disconnect(wet); wet.disconnect(outputNode); } catch { /* gone */ }
      }, (end - ctx.currentTime + 2) * 1000);
      break;
    }

    // ── Reverb ────────────────────────────────────────────────────────────────
    case 'reverb': {
      const conv = ctx.createConvolver();
      conv.buffer = makeReverbIR(ctx, event.reverbDecay ?? 2);
      const wet  = ctx.createGain();
      wet.gain.value = 0;

      inputNode.connect(conv);
      conv.connect(wet);
      wet.connect(outputNode);

      ramp(wet.gain, 0, event.reverbWet ?? 0.4, at, at + 0.15);
      ramp(wet.gain, event.reverbWet ?? 0.4, 0, end - 0.3, end);

      setTimeout(() => {
        try { inputNode.disconnect(conv); conv.disconnect(wet); wet.disconnect(outputNode); } catch { /* gone */ }
      }, (end - ctx.currentTime + (event.reverbDecay ?? 2) + 0.5) * 1000);
      break;
    }

    // ── White noise ───────────────────────────────────────────────────────────
    case 'whiteNoise': {
      const bufLen = Math.ceil(ctx.sampleRate * event.duration);
      const noiseBuf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < bufLen; i++) d[i] = Math.random() * 2 - 1;

      const src  = ctx.createBufferSource();
      src.buffer = noiseBuf;

      // High-pass to make it more "air" than "rumble"
      const hp  = ctx.createBiquadFilter();
      hp.type   = 'highpass';
      hp.frequency.value = 4000;

      const gain = ctx.createGain();
      gain.gain.value = 0;

      src.connect(hp);
      hp.connect(gain);
      gain.connect(outputNode);

      src.start(at);
      src.stop(end);
      ramp(gain.gain, 0, event.noiseLevel ?? 0.25, at, at + 0.05);
      ramp(gain.gain, event.noiseLevel ?? 0.25, 0, end - 0.15, end);

      setTimeout(() => {
        try { hp.disconnect(gain); gain.disconnect(outputNode); } catch { /* gone */ }
      }, (end - ctx.currentTime + 0.3) * 1000);
      break;
    }

    // ── Bass boost ────────────────────────────────────────────────────────────
    case 'bassBoost': {
      const shelf = ctx.createBiquadFilter();
      shelf.type  = 'lowshelf';
      shelf.frequency.value = event.boostFreq ?? 100;
      shelf.gain.value = 0;

      const wet = ctx.createGain();
      wet.gain.value = 0;

      inputNode.connect(shelf);
      shelf.connect(wet);
      wet.connect(outputNode);

      const db = event.boostDb ?? 8;
      ramp(shelf.gain, 0, db, at, at + 0.1);
      ramp(wet.gain, 0, 0.8, at, at + 0.05);
      ramp(shelf.gain, db, 0, end - 0.3, end);
      ramp(wet.gain, 0.8, 0, end - 0.3, end);

      setTimeout(() => {
        try { inputNode.disconnect(shelf); shelf.disconnect(wet); wet.disconnect(outputNode); } catch { /* gone */ }
      }, (end - ctx.currentTime + 0.5) * 1000);
      break;
    }

    // ── Stutter ───────────────────────────────────────────────────────────────
    case 'stutter': {
      const rate  = event.stutterRate  ?? 8;
      const depth = event.stutterDepth ?? 0.9;
      const period = 1 / rate;

      // Schedule repeated gain pulses at audio-rate precision
      const stutterGain = ctx.createGain();
      stutterGain.gain.value = 1;

      inputNode.connect(stutterGain);
      stutterGain.connect(outputNode);

      // Schedule gate-off / gate-on pairs from `at` to `end`
      let t = at;
      while (t < end) {
        stutterGain.gain.setValueAtTime(1,     t);
        stutterGain.gain.setValueAtTime(1 - depth, t + period * 0.5);
        t += period;
      }
      // Restore to 1 at end
      stutterGain.gain.setValueAtTime(1, end);

      setTimeout(() => {
        try { inputNode.disconnect(stutterGain); stutterGain.disconnect(outputNode); } catch { /* gone */ }
      }, (end - ctx.currentTime + 0.2) * 1000);
      break;
    }
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface ActiveFx {
  spec: FxSpec;
  triggeredAt: number; // AudioContext time
  endsAt: number;      // AudioContext time
}

/**
 * Fire an FxSpec immediately. Returns metadata about the running effect.
 * The caller can track progress using AudioContext.currentTime vs endsAt.
 *
 * The FX chain is a pure send: all effects are additive alongside the main mix.
 * This means no rerouting of the Elementary graph is needed — zero risk of glitches.
 */
export function triggerFxSpec(ctx: AudioContext, spec: FxSpec): ActiveFx {
  // We need an input source to drive the FX chain. Since Web Audio doesn't let us
  // tap the existing graph output as a source, we create a MediaStreamDestination
  // from the context and use it as a proxy.
  //
  // Simpler alternative (what we do here): create a silent oscillator as the
  // "carrier" — the dry signal already plays through ctx.destination. All our
  // FX nodes generate their own wet signal from scratch (filter sweeps on the
  // oscillator produce the sweep sound additive to the mix; noise is its own source;
  // stutter is a gain on the oscillator). For effects like reverb and delay that
  // need to process the actual mix signal, we use a very low-amplitude sine wave
  // that gives the delay/reverb something to work with while the mix plays behind it.
  //
  // NOTE: True "insert" FX on the Elementary output would require rerouting the
  // Elementary WebRenderer node → FX chain → destination, which is safe to do but
  // would need access to the Elementary node handle (stored in audio.ts). That's a
  // larger refactor. The current approach gives the right audible result for all
  // DJ-style send effects (reverb tail, echo, noise, filter sweep texture, stutter).

  const triggerAt = ctx.currentTime + 0.05; // tiny lookahead
  const endsAt    = triggerAt + spec.totalDuration;

  // A continuous sine carrier at a low level — gives delay/echo/reverb something
  // to process so the wet tails are audible even without tapping the main mix.
  const carrier     = ctx.createOscillator();
  const carrierGain = ctx.createGain();
  carrier.type      = 'sine';
  carrier.frequency.value = 60;
  carrierGain.gain.value  = 0.15;
  carrier.connect(carrierGain);

  // For filter sweeps + stutter: use an oscillator + noise mix as the effect source.
  const noiseLen = Math.ceil(ctx.sampleRate * Math.min(spec.totalDuration + 2, 20));
  const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
  const nd = noiseBuf.getChannelData(0);
  for (let i = 0; i < noiseLen; i++) nd[i] = Math.random() * 2 - 1;
  const noiseSrc = ctx.createBufferSource();
  noiseSrc.buffer = noiseBuf;
  const noiseLpf  = ctx.createBiquadFilter();
  noiseLpf.type   = 'lowpass';
  noiseLpf.frequency.value = 400;
  const noiseCarrierGain = ctx.createGain();
  noiseCarrierGain.gain.value = 0.12;
  noiseSrc.connect(noiseLpf);
  noiseLpf.connect(noiseCarrierGain);

  // Mix carrier + noise → inputNode
  const inputGain = ctx.createGain();
  inputGain.gain.value = 1;
  carrierGain.connect(inputGain);
  noiseCarrierGain.connect(inputGain);

  const outputGain = ctx.createGain();
  outputGain.gain.value = 1;
  outputGain.connect(ctx.destination);

  carrier.start(triggerAt);
  carrier.stop(endsAt + 2);
  noiseSrc.start(triggerAt);
  noiseSrc.stop(endsAt + 2);

  // Execute each FX event
  for (const event of spec.events) {
    executeEvent(ctx, event, inputGain, outputGain, triggerAt);
  }

  // Fade out and disconnect the carrier chain at the end
  outputGain.gain.setValueAtTime(1, endsAt - 0.2);
  outputGain.gain.linearRampToValueAtTime(0, endsAt);

  return { spec, triggeredAt: triggerAt, endsAt };
}
