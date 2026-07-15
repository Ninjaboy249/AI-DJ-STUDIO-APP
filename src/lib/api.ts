// src/lib/api.ts — Client-side helpers for the Next.js AI API routes.
//
// These replace the direct Groq fetch calls in granite.ts.
// The API key is now server-side only; the browser calls /api/ai/* routes.
// All response shapes are identical to the original granite.ts types.

import type {
  GraniteResponse, TrackFeatures, TrackRecommendation,
  BeatSpec, FxSpec, VoiceCommandResult, CrowdSensorReading, CrowdMoodResult,
} from './granite';

// Re-export simulateCrowdSensor so components can import it from this module
export { simulateCrowdSensor } from './granite';

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data as T;
}

export const askGranite = (
  message: string,
  history: { role: 'user' | 'assistant'; content: string }[],
): Promise<GraniteResponse> =>
  post('/api/ai/chat', { message, history });

export const recommendNextTrack = (
  current: TrackFeatures,
  other?: TrackFeatures,
): Promise<TrackRecommendation> =>
  post('/api/ai/recommend', { current, other });

export const generateBeat = (prompt: string): Promise<BeatSpec> =>
  post('/api/ai/beat', { prompt });

export const generateFx = (prompt: string): Promise<FxSpec> =>
  post('/api/ai/fx', { prompt });

export const parseVoiceCommand = (transcript: string): Promise<VoiceCommandResult> =>
  post('/api/ai/voice', { transcript });

export const analyzeCrowdMood = async (
  reading: CrowdSensorReading,
): Promise<CrowdMoodResult> => post('/api/ai/crowd', reading);
