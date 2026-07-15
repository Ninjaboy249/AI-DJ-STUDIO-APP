// granite.ts — Groq AI DJ assistant client.
//
// Calls the Groq Chat Completions API with a structured system prompt that
// describes the full DeckFlow control surface. The model replies with JSON:
//
//   { "message": "...", "actions": [ { "action": "...", ... }, ... ] }
//
// The UI renders `message` as chat text and executes each action on the decks.
//
// Required environment variable (set in .env.local, never committed):
//   VITE_GROQ_API_KEY — from https://console.groq.com/keys

import type { TrackAnalysis } from './track';

const API_KEY = process.env.GROQ_API_KEY as string | undefined;
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL    = 'llama-3.3-70b-versatile';

// ---------------------------------------------------------------------------
// Action types the AI can emit
// ---------------------------------------------------------------------------

export type DeckId = 'A' | 'B';

export type GraniteAction =
  | { action: 'play';            deck: DeckId }
  | { action: 'pause';           deck: DeckId }
  | { action: 'setTempo';        deck: DeckId; value: number }   // 0.5–2.0
  | { action: 'setVolume';       deck: DeckId; value: number }   // 0–1
  | { action: 'setEq';           deck: DeckId; band: 'eqLow' | 'eqMid' | 'eqHigh'; value: number } // dB -12..12
  | { action: 'setFilter';       deck: DeckId; value: number }   // -1..1
  | { action: 'setCrossfader';   value: number }                  // -1 (A) .. 1 (B)
  | { action: 'setMasterVolume'; value: number }                  // 0–1
  | { action: 'setLoopIn';       deck: DeckId }
  | { action: 'setLoopOut';      deck: DeckId }
  | { action: 'toggleLoop';      deck: DeckId }
  | { action: 'jumpCue';         deck: DeckId }
  | { action: 'seek';            deck: DeckId; norm: number };   // 0–1

export interface GraniteResponse {
  message: string;
  actions: GraniteAction[];
}

export interface TrackFeatures {
  name: string;
  duration: number;    // seconds
  analysis: TrackAnalysis;
}

export interface RecommendationFeature {
  label: string;  // e.g. "BPM", "Energy"
  value: string;  // e.g. "128", "High"
  match: 'good' | 'caution' | 'neutral';
}

export interface TrackRecommendation {
  summary: string;                       // one-sentence description
  why: string;                           // why it pairs well with the current track
  suggestedTransition: string;           // e.g. "EQ swap at the drop"
  tempoAdvice: string;                   // e.g. "Nudge tempo +3% to match"
  eqAdvice: string;                      // e.g. "Cut lows on Deck A before bringing in Deck B"
  features: RecommendationFeature[];     // displayed as the analysis card
  actions: GraniteAction[];              // optional mix actions to apply immediately
}

// ---------------------------------------------------------------------------
// System prompt — describes the control surface to the model
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are an AI DJ assistant controlling DeckFlow Web, a two-deck browser DJ mixer.

The mixer has:
- Deck A and Deck B, each with: play/pause, tempo (0.5–2.0, where 1.0 is normal speed), volume (0–1),
  3-band EQ (eqLow/eqMid/eqHigh, -12 to +12 dB), a DJ filter (-1 = LPF, 0 = off, 1 = HPF),
  a cue point (jumpCue), loop in/out points, and seek (normalized 0–1 position).
- A crossfader (-1 = full Deck A, 0 = center, +1 = full Deck B).
- A master volume (0–1).

When the user gives a mixing instruction, respond with valid JSON in this exact format:
{
  "message": "<short conversational reply explaining what you're doing>",
  "actions": [ <zero or more action objects from the list below> ]
}

Available action objects:
  { "action": "play",            "deck": "A"|"B" }
  { "action": "pause",           "deck": "A"|"B" }
  { "action": "setTempo",        "deck": "A"|"B", "value": <0.5–2.0> }
  { "action": "setVolume",       "deck": "A"|"B", "value": <0–1> }
  { "action": "setEq",           "deck": "A"|"B", "band": "eqLow"|"eqMid"|"eqHigh", "value": <-12..12> }
  { "action": "setFilter",       "deck": "A"|"B", "value": <-1..1> }
  { "action": "setCrossfader",   "value": <-1..1> }
  { "action": "setMasterVolume", "value": <0–1> }
  { "action": "setLoopIn",       "deck": "A"|"B" }
  { "action": "setLoopOut",      "deck": "A"|"B" }
  { "action": "toggleLoop",      "deck": "A"|"B" }
  { "action": "jumpCue",         "deck": "A"|"B" }
  { "action": "seek",            "deck": "A"|"B", "norm": <0–1> }

Only output raw JSON — no markdown, no code fences, no extra keys.
If a request is conversational (e.g. "what can you do?"), respond with an empty actions array.`;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function askGranite(
  userMessage: string,
  history: { role: 'user' | 'assistant'; content: string }[],
): Promise<GraniteResponse> {
  if (!API_KEY) {
    throw new Error(
      'Groq is not configured. Add VITE_GROQ_API_KEY to .env.local.',
    );
  }

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...history,
        { role: 'user', content: userMessage },
      ],
      temperature: 0.3,
      max_tokens: 512,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) throw new Error(`Groq API error: ${res.status} ${await res.text()}`);

  const data = await res.json();
  const raw: string = data.choices?.[0]?.message?.content ?? '';

  try {
    return JSON.parse(raw) as GraniteResponse;
  } catch {
    return { message: raw, actions: [] };
  }
}

// ---------------------------------------------------------------------------
// Track recommendation
// ---------------------------------------------------------------------------

const RECOMMEND_SYSTEM = `You are an expert DJ analyst. You will be given audio feature data for one or two tracks
that have been analysed from their PCM waveform. Your job is to recommend what kind of track should
come next and explain why, based on musical compatibility.

The features provided are:
- tempoBpm: estimated BPM (onset-detection based, ±5 BPM accuracy)
- energy: low / medium / high (RMS loudness)
- brightness: dark / balanced / bright (spectral centroid proxy)
- dynamicRange: crest factor in dB (higher = more dynamic / less compressed)
- duration: track length in seconds

Respond with valid JSON in this exact format:
{
  "summary": "<one sentence describing the ideal next track>",
  "why": "<one sentence explaining why it pairs well musically>",
  "suggestedTransition": "<concrete transition technique, e.g. EQ swap, filter sweep, loop out>",
  "tempoAdvice": "<tempo matching advice, e.g. nudge +3% or already compatible>",
  "eqAdvice": "<EQ preparation advice for a smooth handover>",
  "features": [
    { "label": "BPM", "value": "<estimated BPM>", "match": "good"|"caution"|"neutral" },
    { "label": "Energy", "value": "<low|medium|high>", "match": "good"|"caution"|"neutral" },
    { "label": "Brightness", "value": "<dark|balanced|bright>", "match": "good"|"caution"|"neutral" },
    { "label": "Dynamic Range", "value": "<value dB>", "match": "good"|"caution"|"neutral" },
    { "label": "Duration", "value": "<m:ss>", "match": "neutral" }
  ],
  "actions": []
}

Only output raw JSON. No markdown, no code fences.`;

export async function recommendNextTrack(
  current: TrackFeatures,
  other?: TrackFeatures,
): Promise<TrackRecommendation> {
  if (!API_KEY) {
    throw new Error('Groq is not configured. Add VITE_GROQ_API_KEY to .env.local.');
  }

  const fmt = (t: TrackFeatures) => {
    const m = Math.floor(t.duration / 60);
    const s = Math.floor(t.duration % 60);
    return `Track: "${t.name}"
  BPM estimate: ${t.analysis.tempoBpm}
  Energy: ${t.analysis.energy} (RMS ${t.analysis.rmsEnergy})
  Brightness: ${t.analysis.brightness} (centroid ${t.analysis.spectralCentroid})
  Dynamic range: ${t.analysis.dynamicRange} dB
  Duration: ${m}:${String(s).padStart(2, '0')}`;
  };

  const userContent = other
    ? `Currently playing on Deck A:\n${fmt(current)}\n\nLoaded on Deck B:\n${fmt(other)}\n\nAnalyse both tracks and recommend how to transition to Deck B, or suggest what kind of track to load next if Deck B is not yet suitable.`
    : `Currently playing:\n${fmt(current)}\n\nNo second track loaded. Recommend what kind of track to play next.`;

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: RECOMMEND_SYSTEM },
        { role: 'user',   content: userContent },
      ],
      temperature: 0.4,
      max_tokens: 600,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) throw new Error(`Groq API error: ${res.status} ${await res.text()}`);

  const data = await res.json();
  const raw: string = data.choices?.[0]?.message?.content ?? '';
  return JSON.parse(raw) as TrackRecommendation;
}

// ---------------------------------------------------------------------------
// Beat Generator
// ---------------------------------------------------------------------------

/** One step in a 16-step pattern: on/off + optional velocity 0..1 */
export interface Step { on: boolean; vel: number; }

export interface BeatSpec {
  bpm: number;                  // 60–180
  genre: string;                // e.g. "cyberpunk", "techno"
  mood: string;                 // e.g. "dark", "energetic"
  bars: number;                 // 1–4
  // 16-step patterns (one entry per step, true = hit)
  drums: {
    kick:    Step[];  // 16 steps
    snare:   Step[];
    hihat:   Step[];
    openhat: Step[];
    clap:    Step[];
  };
  bass: {
    notes:  number[]; // 16 MIDI notes (0 = rest, 36–72)
    octave: number;   // transpose -2..+2
  };
  synth: {
    notes:  number[]; // 16 MIDI notes (0 = rest)
    wave:   'sawtooth' | 'square' | 'sine';
    filterCutoff: number; // 200–8000 Hz
    detune: number;       // 0–50 cents
  };
  fx: {
    reverb:    number;  // 0..1 wet
    delay:     number;  // 0..1 wet
    distortion:number;  // 0..1
  };
  description: string;   // human-readable summary of the beat
}

const BEAT_SYSTEM = `You are an expert electronic music composer and beat programmer.
The user will describe a beat they want. You will output a complete 16-step beat pattern as JSON.

Rules:
- bpm: integer between 60 and 180
- All pattern arrays must have exactly 16 elements
- For drum steps: { "on": true|false, "vel": 0.0-1.0 }
- For note arrays: MIDI note numbers where 0 = rest, 36 = C2, 48 = C3, 60 = C4, etc.
- synth.wave: "sawtooth", "square", or "sine"
- synth.filterCutoff: Hz between 200 and 8000
- synth.detune: cents between 0 and 50
- fx values: 0.0 to 1.0
- description: one sentence describing the feel of the beat

Respond with raw JSON only — no markdown, no code fences.

Example structure:
{
  "bpm": 138,
  "genre": "techno",
  "mood": "dark",
  "bars": 2,
  "drums": {
    "kick":    [{"on":true,"vel":1},{"on":false,"vel":0},...],
    "snare":   [...16 steps...],
    "hihat":   [...16 steps...],
    "openhat": [...16 steps...],
    "clap":    [...16 steps...]
  },
  "bass": { "notes": [36,0,36,0,38,0,36,0,41,0,41,0,38,0,0,0], "octave": 0 },
  "synth": { "notes": [60,0,0,63,0,0,60,0,0,58,0,0,60,0,0,0], "wave": "sawtooth", "filterCutoff": 1200, "detune": 20 },
  "fx": { "reverb": 0.3, "delay": 0.2, "distortion": 0.4 },
  "description": "Dark pounding techno with a driving kick and acid bassline."
}`;

export async function generateBeat(prompt: string): Promise<BeatSpec> {
  if (!API_KEY) {
    throw new Error('Groq is not configured. Add VITE_GROQ_API_KEY to .env.local.');
  }

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: BEAT_SYSTEM },
        { role: 'user',   content: `Generate a beat for: ${prompt}` },
      ],
      temperature: 0.7,
      max_tokens: 1200,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) throw new Error(`Groq API error: ${res.status} ${await res.text()}`);

  const data = await res.json();
  const raw: string = data.choices?.[0]?.message?.content ?? '';
  return JSON.parse(raw) as BeatSpec;
}

// ---------------------------------------------------------------------------
// AI Effects Generator
// ---------------------------------------------------------------------------

/**
 * A single timed FX event. `start` and `end` are seconds from "now".
 * All fields optional — only the ones used by that effect type need to be set.
 */
export interface FxEvent {
  effect: 'filterSweep' | 'echo' | 'reverb' | 'whiteNoise' | 'bassBoost' | 'delay' | 'stutter';
  start: number;      // seconds from trigger (0 = immediate)
  duration: number;   // seconds the effect lasts
  // filterSweep
  filterFrom?: number;   // Hz start (20–20000)
  filterTo?: number;     // Hz end
  filterType?: 'lowpass' | 'highpass' | 'bandpass';
  // echo / delay
  delayTime?: number;    // seconds (0.05–0.75)
  feedback?: number;     // 0–1
  wetMix?: number;       // 0–1
  // reverb
  reverbDecay?: number;  // seconds (0.5–4)
  reverbWet?: number;    // 0–1
  // whiteNoise
  noiseLevel?: number;   // 0–1
  // bassBoost
  boostDb?: number;      // dB 0–12
  boostFreq?: number;    // Hz (60–200)
  // stutter
  stutterRate?: number;  // Hz (4–32)
  stutterDepth?: number; // 0–1 (gate depth)
}

export interface FxSpec {
  label: string;           // e.g. "Explosive transition"
  totalDuration: number;   // seconds total
  description: string;     // one sentence human summary
  events: FxEvent[];
}

const FX_SYSTEM = `You are an expert DJ effects programmer.
The user describes an effect or transition they want applied to the mix.
You output a timed sequence of audio effects as JSON.

Available effects:
- filterSweep: sweeps a biquad filter. Fields: filterFrom (Hz), filterTo (Hz), filterType ("lowpass"|"highpass"|"bandpass")
- echo: short repeat echo. Fields: delayTime (0.05–0.5s), feedback (0–0.8), wetMix (0–1)
- reverb: convolution reverb. Fields: reverbDecay (0.5–4s), reverbWet (0–1)
- whiteNoise: white noise burst. Fields: noiseLevel (0–1)
- bassBoost: low-shelf boost. Fields: boostDb (0–12), boostFreq (60–200 Hz)
- delay: rhythmic delay. Fields: delayTime (0.05–0.75s), feedback (0–0.7), wetMix (0–1)
- stutter: volume gate stutter. Fields: stutterRate (4–32 Hz), stutterDepth (0–1)

Rules:
- start: seconds from now when the effect begins (can overlap with others)
- duration: how long the effect runs in seconds
- totalDuration: the total length of the effect sequence in seconds (max 16)
- Keep the sequence musical and DJ-appropriate
- For "explosive transition": use filterSweep up, bassBoost, whiteNoise burst, echo, reverb
- For "build up": filterSweep from low to high, bassBoost, delay
- For "drop": stutter before, then filterSweep down, reverb
- For "chill": reverb, echo, filterSweep to lowpass
- For "stutter break": stutter at increasing rates, echo

Respond with raw JSON only — no markdown, no code fences.

Example for "explosive transition":
{
  "label": "Explosive transition",
  "totalDuration": 8,
  "description": "High-energy transition with filter sweep, white noise burst, bass boost, and reverb tail.",
  "events": [
    { "effect": "filterSweep", "start": 0, "duration": 4, "filterFrom": 200, "filterTo": 18000, "filterType": "lowpass" },
    { "effect": "bassBoost",   "start": 0, "duration": 6, "boostDb": 8, "boostFreq": 80 },
    { "effect": "whiteNoise",  "start": 3, "duration": 1, "noiseLevel": 0.3 },
    { "effect": "echo",        "start": 3.5, "duration": 4, "delayTime": 0.25, "feedback": 0.5, "wetMix": 0.4 },
    { "effect": "reverb",      "start": 4, "duration": 4, "reverbDecay": 2.5, "reverbWet": 0.45 }
  ]
}`;

export async function generateFx(prompt: string): Promise<FxSpec> {
  if (!API_KEY) {
    throw new Error('Groq is not configured. Add VITE_GROQ_API_KEY to .env.local.');
  }

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: FX_SYSTEM },
        { role: 'user',   content: `Create an effects sequence for: "${prompt}"` },
      ],
      temperature: 0.5,
      max_tokens: 900,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) throw new Error(`Groq API error: ${res.status} ${await res.text()}`);

  const data = await res.json();
  const raw: string = data.choices?.[0]?.message?.content ?? '';
  return JSON.parse(raw) as FxSpec;
}

// ---------------------------------------------------------------------------
// Crowd Mood Detection
// ---------------------------------------------------------------------------

/**
 * Simulated sensor snapshot — either from real webcam analysis (future) or
 * generated randomly to represent a live crowd reading.
 */
export interface CrowdSensorReading {
  /** 0–1  estimated motion level (0 = still, 1 = moshing) */
  motionLevel: number;
  /** 0–1  estimated noise level (0 = quiet, 1 = roaring) */
  noiseLevel: number;
  /** 0–100 approximate crowd density percentage */
  density: number;
  /** Average "brightness" of faces detected (proxy for smiles / energy) */
  faceBrightness: number; // 0–1
  /** Number of detected faces / people (simulated) */
  faceCount: number;
  /** Timestamp of the reading */
  timestamp: number;
}

export type MoodId = 'happy' | 'excited' | 'low_energy' | 'tense' | 'neutral';

export interface CrowdRecommendation {
  action: string;         // short verb phrase, e.g. "Drop a festival banger"
  reason: string;         // one sentence explanation
  djAction: GraniteAction | null; // optional immediate mixer tweak
}

export interface CrowdMoodResult {
  mood: MoodId;
  emoji: string;          // e.g. "😊"
  label: string;          // e.g. "Happy"
  confidence: number;     // 0–1
  summary: string;        // one sentence crowd read
  recommendations: CrowdRecommendation[];  // 2–4 actionable suggestions
  sensorSnapshot: CrowdSensorReading;
}

/** Generate a random simulated crowd sensor reading */
export function simulateCrowdSensor(): CrowdSensorReading {
  // Randomise in ranges that feel natural for a club environment
  const motionLevel    = parseFloat((Math.random() * 0.9 + 0.05).toFixed(2));
  const noiseLevel     = parseFloat((Math.random() * 0.85 + 0.1).toFixed(2));
  const density        = Math.round(Math.random() * 70 + 20); // 20–90 %
  const faceBrightness = parseFloat((Math.random() * 0.8 + 0.15).toFixed(2));
  const faceCount      = Math.round(Math.random() * 90 + 10);  // 10–100
  return { motionLevel, noiseLevel, density, faceBrightness, faceCount, timestamp: Date.now() };
}

const CROWD_SYSTEM = `You are an expert crowd-mood analyst for a live DJ set.
You receive simulated sensor readings representing what a camera and microphone
detect from the dance floor. Your job is to interpret the data and tell the DJ
what the crowd is feeling and what to do next.

Sensor fields:
- motionLevel: 0–1 (0 = nobody moving, 1 = intense dancing / mosh)
- noiseLevel: 0–1 (0 = silent, 1 = roaring crowd / loud cheers)
- density: 0–100% (how packed the dance floor is)
- faceBrightness: 0–1 (proxy for smiling / happy faces)
- faceCount: number of people visible

Mood categories:
- "happy":      crowd is smiling, dancing moderately, good energy
- "excited":    crowd is moving a lot, loud, high density — peak energy
- "low_energy": crowd is quiet/still, sparse — energy needs lifting
- "tense":      high motion + low brightness — crowd may be edgy, needs release
- "neutral":    mixed or unreadable signals

Respond with raw JSON only — no markdown, no code fences.

JSON format:
{
  "mood": "happy"|"excited"|"low_energy"|"tense"|"neutral",
  "emoji": "<single emoji representing the mood>",
  "label": "<one or two words>",
  "confidence": <0.0–1.0>,
  "summary": "<one sentence crowd read>",
  "recommendations": [
    {
      "action": "<short verb phrase e.g. 'Drop a festival banger'>",
      "reason": "<one sentence why>",
      "djAction": null | { <one GraniteAction object — see below> }
    }
  ]
}

Available GraniteAction shapes (use exactly one per recommendation, or null):
  { "action": "setTempo",        "deck": "A"|"B", "value": <0.5–2.0> }
  { "action": "setEq",           "deck": "A"|"B", "band": "eqLow"|"eqMid"|"eqHigh", "value": <-12..12> }
  { "action": "setFilter",       "deck": "A"|"B", "value": <-1..1> }
  { "action": "setCrossfader",   "value": <-1..1> }
  { "action": "setMasterVolume", "value": <0–1> }
  { "action": "toggleLoop",      "deck": "A"|"B" }

Provide exactly 3 recommendations. Each must have a different action strategy.`;

export async function analyzeCrowdMood(
  reading: CrowdSensorReading,
): Promise<CrowdMoodResult> {
  if (!API_KEY) {
    throw new Error('Groq is not configured. Add VITE_GROQ_API_KEY to .env.local.');
  }

  const userContent = `Analyse this crowd sensor reading and tell me the mood:

motionLevel: ${reading.motionLevel}
noiseLevel: ${reading.noiseLevel}
density: ${reading.density}%
faceBrightness: ${reading.faceBrightness}
faceCount: ${reading.faceCount} people`;

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: CROWD_SYSTEM },
        { role: 'user',   content: userContent },
      ],
      temperature: 0.4,
      max_tokens: 700,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) throw new Error(`Groq API error: ${res.status} ${await res.text()}`);

  const data = await res.json();
  const raw: string = data.choices?.[0]?.message?.content ?? '';
  const parsed = JSON.parse(raw) as Omit<CrowdMoodResult, 'sensorSnapshot'>;
  return { ...parsed, sensorSnapshot: reading };
}

// ---------------------------------------------------------------------------
// Voice Command Parser
// ---------------------------------------------------------------------------

export interface VoiceCommandResult {
  /** Transcript exactly as spoken */
  transcript: string;
  /** Short human-readable confirmation of what was understood */
  confirmation: string;
  /** The actions to execute on the mixer (may be empty for unrecognised input) */
  actions: GraniteAction[];
  /** Whether the command was understood */
  recognised: boolean;
}

const VOICE_SYSTEM = `You are a DJ voice-command interpreter for DeckFlow Web, a two-deck browser mixer.
The user speaks a short voice command. You parse it into mixer actions.

The mixer has:
- Deck A and Deck B, each with: play/pause, tempo (0.5–2.0), volume (0–1),
  3-band EQ (eqLow/eqMid/eqHigh, -12 to +12 dB), a DJ filter (-1 = LPF, 0 = off, 1 = HPF),
  cue point (jumpCue), loop in/out/toggle, seek (0–1).
- A crossfader (-1 = full A, 0 = centre, +1 = full B).
- A master volume (0–1).

When a deck is not specified, default to Deck A.
Voice command phrasings and their intent:
- "play" / "play next" / "start" → play Deck A
- "pause" / "stop" → pause Deck A
- "drop bass" / "more bass" / "boost bass" → setEq Deck A eqLow +8
- "cut bass" / "less bass" → setEq Deck A eqLow -8
- "increase tempo" / "faster" / "speed up" → setTempo Deck A 1.1 (or current+0.1)
- "slow down" / "decrease tempo" / "slower" → setTempo Deck A 0.9
- "loop" / "loop 8 bars" / "set loop" → setLoopIn Deck A + setLoopOut Deck A + toggleLoop Deck A
- "add echo" / "echo" → setFilter Deck A 0.3 (approximation)
- "add reverb" / "reverb" → setFilter Deck A -0.3
- "crossfade" / "fade to b" / "switch deck" → setCrossfader 0.8
- "back to a" / "fade to a" → setCrossfader -0.8
- "centre" / "center crossfader" → setCrossfader 0
- "volume up" / "louder" → setMasterVolume 0.9
- "volume down" / "quieter" → setMasterVolume 0.5
- "full volume" → setMasterVolume 1.0
- "cue" / "jump cue" / "back to cue" → jumpCue Deck A
- "filter up" / "high pass" → setFilter Deck A 0.7
- "filter down" / "low pass" → setFilter Deck A -0.7
- "clear filter" / "remove filter" → setFilter Deck A 0

Respond with raw JSON only — no markdown, no code fences:
{
  "transcript": "<exact words spoken>",
  "confirmation": "<short friendly confirmation, e.g. 'Bass boosted on Deck A'>",
  "recognised": true|false,
  "actions": [ <zero or more GraniteAction objects> ]
}

Available action objects:
  { "action": "play",            "deck": "A"|"B" }
  { "action": "pause",           "deck": "A"|"B" }
  { "action": "setTempo",        "deck": "A"|"B", "value": <0.5–2.0> }
  { "action": "setVolume",       "deck": "A"|"B", "value": <0–1> }
  { "action": "setEq",           "deck": "A"|"B", "band": "eqLow"|"eqMid"|"eqHigh", "value": <-12..12> }
  { "action": "setFilter",       "deck": "A"|"B", "value": <-1..1> }
  { "action": "setCrossfader",   "value": <-1..1> }
  { "action": "setMasterVolume", "value": <0–1> }
  { "action": "setLoopIn",       "deck": "A"|"B" }
  { "action": "setLoopOut",      "deck": "A"|"B" }
  { "action": "toggleLoop",      "deck": "A"|"B" }
  { "action": "jumpCue",         "deck": "A"|"B" }
  { "action": "seek",            "deck": "A"|"B", "norm": <0–1> }

If the command is not a DJ command or is unrecognisable, set recognised to false and actions to [].`;

export async function parseVoiceCommand(transcript: string): Promise<VoiceCommandResult> {
  if (!API_KEY) {
    throw new Error('Groq is not configured. Add VITE_GROQ_API_KEY to .env.local.');
  }

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: VOICE_SYSTEM },
        { role: 'user',   content: `Voice command: "${transcript}"` },
      ],
      temperature: 0.1,   // low temp — deterministic command parsing
      max_tokens: 300,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) throw new Error(`Groq API error: ${res.status} ${await res.text()}`);

  const data = await res.json();
  const raw: string = data.choices?.[0]?.message?.content ?? '';
  return JSON.parse(raw) as VoiceCommandResult;
}
