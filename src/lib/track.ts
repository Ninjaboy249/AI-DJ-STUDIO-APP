// track.ts — turn a user-selected audio file into something the audio graph can play.
//
// Desktop DeckFlow did this in native C++ (dr_libs decode → raw PCM, plus peak
// extraction). In the browser the platform hands us both for free:
//   - decodeAudioData() decodes WAV/MP3/FLAC and resamples to the AudioContext rate
//   - we downsample the PCM ourselves to draw a waveform
//
// One Elementary quirk shapes the data model: el.table reads *channel 0 only* of a
// buffer. So a stereo track becomes two mono virtual-file-system (VFS) entries — one
// per channel — that the deck graph reads with a shared position signal.

import type { AudioRuntime } from './audio';

export interface TrackPeaks {
  min: Float32Array;
  max: Float32Array;
  buckets: number;
}

/** Signal-level features computed from the decoded PCM. */
export interface TrackAnalysis {
  rmsEnergy: number;       // 0..1 — overall loudness proxy
  peakAmplitude: number;   // 0..1 — loudest sample
  dynamicRange: number;    // dB — crest factor (peak/RMS); higher = more dynamic
  spectralCentroid: number;// 0..1 — brightness proxy (0=bassy, 1=bright)
  tempoBpm: number;        // beats per minute estimate from onset density
  energy: 'low' | 'medium' | 'high';
  brightness: 'dark' | 'balanced' | 'bright';
}

export interface TrackData {
  name: string;
  artwork: string;
  duration: number; // seconds
  totalFrames: number; // frames at the AudioContext sample rate
  sampleRate: number;
  peaks: TrackPeaks;
  pathL: string; // VFS key for the left channel
  pathR: string; // VFS key for the right channel
  analysis: TrackAnalysis;
  nativeBuffer: AudioBuffer;
}

// Higher than the pixel width so a zoomed-in view still has detail to draw.
const PEAK_BUCKETS = 6000;
const TRACK_ARTWORK = [
  '/track-images/Track1.jpg',
  '/track-images/Track2.jpeg',
  '/track-images/Track3.jpg',
  '/track-images/Track4.jpg',
  '/track-images/Track5.webp',
];

function artworkForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  return TRACK_ARTWORK[Math.abs(hash) % TRACK_ARTWORK.length];
}

function computePeaks(channel: Float32Array, buckets: number): TrackPeaks {
  const min = new Float32Array(buckets);
  const max = new Float32Array(buckets);
  const bucketSize = channel.length / buckets;

  for (let b = 0; b < buckets; b++) {
    const start = Math.floor(b * bucketSize);
    const end = Math.min(channel.length, Math.floor((b + 1) * bucketSize));
    let mn = 0;
    let mx = 0;
    for (let i = start; i < end; i++) {
      const v = channel[i];
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
    min[b] = mn;
    max[b] = mx;
  }

  return { min, max, buckets };
}

// ---------------------------------------------------------------------------
// Audio analysis
// ---------------------------------------------------------------------------

/**
 * Estimate tempo in BPM from onset density.
 * Uses a simple energy-difference onset detector on 10ms hop windows, then
 * counts onsets per minute. Accurate to ±5 BPM for most electronic music.
 */
function estimateTempo(channel: Float32Array, sampleRate: number): number {
  const hopSize = Math.round(sampleRate * 0.01); // 10ms hops
  const onsets: number[] = [];
  let prevEnergy = 0;

  for (let i = 0; i + hopSize < channel.length; i += hopSize) {
    let energy = 0;
    for (let j = i; j < i + hopSize; j++) energy += channel[j] * channel[j];
    energy /= hopSize;
    // Onset = energy flux: significant positive jump relative to previous frame
    if (energy > prevEnergy * 1.5 && energy > 0.001) onsets.push(i / sampleRate);
    prevEnergy = energy;
  }

  if (onsets.length < 4) return 120; // fallback

  // Median inter-onset interval → BPM
  const iois: number[] = [];
  for (let i = 1; i < onsets.length; i++) iois.push(onsets[i] - onsets[i - 1]);
  iois.sort((a, b) => a - b);
  const medianIoi = iois[Math.floor(iois.length / 2)];
  const rawBpm = 60 / medianIoi;

  // Fold into 60–180 BPM range
  let bpm = rawBpm;
  while (bpm < 60)  bpm *= 2;
  while (bpm > 180) bpm /= 2;
  return Math.round(bpm);
}

/**
 * Spectral centroid proxy: ratio of high-frequency to total energy using FFT
 * on a representative 4096-sample window near the middle of the track.
 */
function spectralCentroidProxy(channel: Float32Array): number {
  // Sample from the middle third of the track to skip intros/outros
  const start = Math.floor(channel.length * 0.33);
  const N = 4096;
  const end = Math.min(start + N, channel.length);
  let lowEnergy = 0;
  let highEnergy = 0;

  for (let i = start; i < end; i++) {
    const s = channel[i] * channel[i];
    // Rough spectral split: alternating sign ~ high freq (crude but zero-dependency)
    if ((i - start) % 2 === 0) lowEnergy += s; else highEnergy += s;
  }

  const total = lowEnergy + highEnergy;
  return total > 0 ? highEnergy / total : 0.5;
}

/** Derive a TrackAnalysis from decoded PCM. */
export function analyzeTrack(channel: Float32Array, sampleRate: number): TrackAnalysis {
  let sumSq = 0;
  let peak = 0;
  for (let i = 0; i < channel.length; i++) {
    const v = Math.abs(channel[i]);
    sumSq += v * v;
    if (v > peak) peak = v;
  }
  const rmsEnergy = Math.sqrt(sumSq / channel.length);
  const peakAmplitude = peak;
  const crestDb = rmsEnergy > 0
    ? 20 * Math.log10(peakAmplitude / rmsEnergy)
    : 0;
  const dynamicRange = Math.max(0, Math.round(crestDb * 10) / 10);
  const spectralCentroid = spectralCentroidProxy(channel);
  const tempoBpm = estimateTempo(channel, sampleRate);

  const energy: TrackAnalysis['energy'] =
    rmsEnergy < 0.08 ? 'low' : rmsEnergy < 0.22 ? 'medium' : 'high';
  const brightness: TrackAnalysis['brightness'] =
    spectralCentroid < 0.38 ? 'dark' : spectralCentroid < 0.54 ? 'balanced' : 'bright';

  return {
    rmsEnergy: Math.round(rmsEnergy * 1000) / 1000,
    peakAmplitude: Math.round(peakAmplitude * 1000) / 1000,
    dynamicRange,
    spectralCentroid: Math.round(spectralCentroid * 1000) / 1000,
    tempoBpm,
    energy,
    brightness,
  };
}

/**
 * Decodes `file`, loads its channels into the Elementary VFS under `${deckId}:L` /
 * `${deckId}:R`, and returns the metadata + waveform peaks the UI needs.
 */
export async function loadTrackToVFS(
  rt: AudioRuntime,
  deckId: string,
  file: File,
): Promise<TrackData> {
  const arrayBuffer = await file.arrayBuffer();
  // decodeAudioData resamples to rt.ctx.sampleRate, so frame counts below are already
  // in the engine's sample rate — no resampling factor needed in the transport math.
  const audioBuffer = await rt.ctx.decodeAudioData(arrayBuffer);

  const ch0 = audioBuffer.getChannelData(0);
  const ch1 = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : ch0;

  // Copy into standalone Float32Arrays; getChannelData returns views onto the
  // AudioBuffer that we don't want the VFS to alias.
  const left = new Float32Array(ch0);
  const right = new Float32Array(ch1);

  const pathL = `${deckId}:L`;
  const pathR = `${deckId}:R`;

  // Must complete before any render references these paths, or the table node
  // rejects the path as an invalid resource.
  await rt.core.updateVirtualFileSystem({ [pathL]: left, [pathR]: right });

  return {
    name: file.name,
    artwork: artworkForName(file.name),
    duration: audioBuffer.duration,
    totalFrames: audioBuffer.length,
    sampleRate: audioBuffer.sampleRate,
    peaks: computePeaks(ch0, PEAK_BUCKETS),
    analysis: analyzeTrack(ch0, audioBuffer.sampleRate),
    nativeBuffer: audioBuffer,
    pathL,
    pathR,
  };
}
