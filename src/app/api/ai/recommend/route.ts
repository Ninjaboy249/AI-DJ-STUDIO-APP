// /api/ai/recommend — POST
// LangChain chain for smart track recommendation from PCM analysis.

import { NextRequest, NextResponse } from 'next/server';
import { ChatGroq } from '@langchain/groq';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { JsonOutputParser } from '@langchain/core/output_parsers';
import { z } from 'zod';
import { getGroqApiKey } from '@/lib/env';

const SYSTEM_PROMPT = `You are an expert DJ analyst. You will be given audio feature data for one or two tracks.
Your job is to recommend what kind of track should come next and explain why, based on musical compatibility.

Respond with valid JSON only:
{
  "summary": "<one sentence describing the ideal next track>",
  "why": "<one sentence explaining why it pairs well musically>",
  "suggestedTransition": "<concrete transition technique>",
  "tempoAdvice": "<tempo matching advice>",
  "eqAdvice": "<EQ preparation advice for a smooth handover>",
  "features": [
    { "label": "BPM",           "value": "<estimated BPM>",         "match": "good"|"caution"|"neutral" },
    { "label": "Energy",        "value": "<low|medium|high>",        "match": "good"|"caution"|"neutral" },
    { "label": "Brightness",    "value": "<dark|balanced|bright>",   "match": "good"|"caution"|"neutral" },
    { "label": "Dynamic Range", "value": "<value dB>",               "match": "good"|"caution"|"neutral" },
    { "label": "Duration",      "value": "<m:ss>",                   "match": "neutral" }
  ],
  "actions": []
}

No markdown, no code fences.`;

type TrackArg = { name: string; duration: number; analysis: Record<string, unknown> };

const RequestSchema = z.object({
  current: z.object({ name: z.string(), duration: z.number(), analysis: z.record(z.unknown()) }),
  other:   z.object({ name: z.string(), duration: z.number(), analysis: z.record(z.unknown()) }).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const { current, other } = RequestSchema.parse(await req.json());
    const apiKey = getGroqApiKey();
    if (!apiKey) {
      return NextResponse.json({ error: 'Groq API key is not configured. Add GROQ_API_KEY or VITE_GROQ_API_KEY to your environment.' }, { status: 200 });
    }

    const fmt = (t: TrackArg) => {
      const m = Math.floor(t.duration / 60);
      const s = Math.floor(t.duration % 60);
      return `Track: "${t.name}"
  BPM estimate: ${t.analysis.tempoBpm}
  Energy: ${t.analysis.energy} (RMS ${t.analysis.rmsEnergy})
  Brightness: ${t.analysis.brightness}
  Dynamic range: ${t.analysis.dynamicRange} dB
  Duration: ${m}:${String(s).padStart(2, '0')}`;
    };

    const userContent = other
      ? `Currently on Deck A:\n${fmt(current as TrackArg)}\n\nLoaded on Deck B:\n${fmt(other as TrackArg)}\n\nRecommend transition or next track.`
      : `Currently playing:\n${fmt(current as TrackArg)}\n\nNo second track. Recommend what to play next.`;

    const model = new ChatGroq({ apiKey, model: 'llama-3.3-70b-versatile', temperature: 0.4, maxTokens: 600 });
    const prompt = ChatPromptTemplate.fromMessages([['system', SYSTEM_PROMPT], ['human', '{input}']]);
    const chain = prompt.pipe(model).pipe(new JsonOutputParser());

    const result = await chain.invoke({ input: userContent });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
