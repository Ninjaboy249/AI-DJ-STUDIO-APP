// /api/ai/fx — POST
// OpenAI GPT-4o-mini chain for AI FX sequence generation.

import { NextRequest, NextResponse } from 'next/server';
import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { JsonOutputParser } from '@langchain/core/output_parsers';
import { z } from 'zod';
import { getOpenAIApiKey } from '@/lib/env';

const SYSTEM_PROMPT = `You are an expert DJ effects programmer.
The user describes an effect or transition they want applied to the mix.
Output a timed sequence of audio effects as JSON.

Available effects: filterSweep, echo, reverb, whiteNoise, bassBoost, delay, stutter
Rules:
- start: seconds from now when the effect begins
- duration: how long the effect runs in seconds
- totalDuration: total sequence length in seconds (max 16)
Raw JSON only — no markdown, no code fences.

Example output format:
{
  "label": "Explosive transition",
  "totalDuration": 8,
  "description": "High-energy filter sweep with reverb tail.",
  "events": [
    { "effect": "filterSweep", "start": 0, "duration": 4, "filterFrom": 200, "filterTo": 18000, "filterType": "lowpass" },
    { "effect": "reverb",      "start": 4, "duration": 4, "reverbDecay": 2.5, "reverbWet": 0.45 }
  ]
}`;

const RequestSchema = z.object({ prompt: z.string() });

export async function POST(req: NextRequest) {
  try {
    const { prompt } = RequestSchema.parse(await req.json());
    const apiKey = getOpenAIApiKey();
    if (!apiKey) {
      return NextResponse.json({ error: 'OPENAI_API_KEY is not configured. Add it to .env.local.' }, { status: 200 });
    }
    const model = new ChatOpenAI({ apiKey, model: 'gpt-4o-mini', temperature: 0.5, maxTokens: 900 });
    const chain = ChatPromptTemplate.fromMessages([
      ['system', SYSTEM_PROMPT],
      ['human', 'Create effects for: "{prompt}"'],
    ]).pipe(model).pipe(new JsonOutputParser());
    const result = await chain.invoke({ prompt });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
