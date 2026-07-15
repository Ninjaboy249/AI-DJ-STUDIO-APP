// /api/ai/beat — POST
// OpenAI GPT-4o-mini chain for AI beat generation.

import { NextRequest, NextResponse } from 'next/server';
import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { JsonOutputParser } from '@langchain/core/output_parsers';
import { z } from 'zod';
import { getOpenAIApiKey } from '@/lib/env';

const SYSTEM_PROMPT = `You are an expert electronic music composer and beat programmer.
The user will describe a beat. Output a complete 16-step beat pattern as JSON.

Rules:
- bpm: integer 60–180
- All pattern arrays must have exactly 16 elements
- Drum steps: { "on": true|false, "vel": 0.0-1.0 }
- Note arrays: MIDI note numbers (0 = rest, 36 = C2, 48 = C3, 60 = C4)
- synth.wave: "sawtooth", "square", or "sine"
- fx values: 0.0 to 1.0
- description: one sentence describing the beat feel
Raw JSON only — no markdown, no code fences.`;

const RequestSchema = z.object({ prompt: z.string() });

export async function POST(req: NextRequest) {
  try {
    const { prompt } = RequestSchema.parse(await req.json());
    const apiKey = getOpenAIApiKey();
    if (!apiKey) {
      return NextResponse.json({ error: 'OPENAI_API_KEY is not configured. Add it to .env.local.' }, { status: 200 });
    }
    const model = new ChatOpenAI({ apiKey, model: 'gpt-4o-mini', temperature: 0.7, maxTokens: 1200 });
    const chain = ChatPromptTemplate.fromMessages([
      ['system', SYSTEM_PROMPT],
      ['human', 'Generate a beat for: {prompt}'],
    ]).pipe(model).pipe(new JsonOutputParser());
    const result = await chain.invoke({ prompt });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
