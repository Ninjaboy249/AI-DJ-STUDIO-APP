// /api/ai/crowd — POST
// OpenAI GPT-4o-mini chain for crowd mood detection.

import { NextRequest, NextResponse } from 'next/server';
import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { JsonOutputParser } from '@langchain/core/output_parsers';
import { z } from 'zod';
import { getOpenAIApiKey } from '@/lib/env';

const SYSTEM_PROMPT = `You are an expert crowd-mood analyst for a live DJ set.
You receive simulated sensor readings representing what a camera and microphone detect from the dance floor.

Mood categories: "happy", "excited", "low_energy", "tense", "neutral"

Respond with raw JSON only:
{
  "mood": "happy"|"excited"|"low_energy"|"tense"|"neutral",
  "emoji": "<single emoji>",
  "label": "<one or two words>",
  "confidence": <0.0–1.0>,
  "summary": "<one sentence crowd read>",
  "recommendations": [
    { "action": "<short verb phrase>", "reason": "<one sentence why>", "djAction": null }
  ]
}
Provide exactly 3 recommendations. No markdown, no code fences.`;

const RequestSchema = z.object({
  motionLevel:    z.number(),
  noiseLevel:     z.number(),
  density:        z.number(),
  faceBrightness: z.number(),
  faceCount:      z.number(),
});

export async function POST(req: NextRequest) {
  try {
    const reading = RequestSchema.parse(await req.json());
    const apiKey  = getOpenAIApiKey();
    if (!apiKey) {
      return NextResponse.json({ error: 'OPENAI_API_KEY is not configured. Add it to .env.local.' }, { status: 200 });
    }
    const userContent = `Analyse this crowd sensor reading:
motionLevel: ${reading.motionLevel}
noiseLevel: ${reading.noiseLevel}
density: ${reading.density}%
faceBrightness: ${reading.faceBrightness}
faceCount: ${reading.faceCount} people`;

    const model = new ChatOpenAI({ apiKey, model: 'gpt-4o-mini', temperature: 0.4, maxTokens: 700 });
    const chain = ChatPromptTemplate.fromMessages([['system', SYSTEM_PROMPT], ['human', '{input}']]).pipe(model).pipe(new JsonOutputParser());
    const result = await chain.invoke({ input: userContent });
    return NextResponse.json({ ...(result as Record<string, unknown>), sensorSnapshot: reading });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
