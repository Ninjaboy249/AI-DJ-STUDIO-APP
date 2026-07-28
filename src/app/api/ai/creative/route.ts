import { NextRequest, NextResponse } from 'next/server';
import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';
import { getOpenAIApiKey } from '@/lib/env';

const ModuleSchema = z.enum(['studio','partner','mood','story','coach','visual','planner','artwork','inspiration','insights']);
const RequestSchema = z.object({
  module: ModuleSchema,
  input: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
});

const instructions: Record<z.infer<typeof ModuleSchema>, string> = {
  studio: `You are a DJ creative director. Generate a named set concept with theme, genre blend, BPM progression, Camelot-key path, transition vocabulary, event-specific moments, and performance staging. Make every recommendation executable.`,
  partner: `You are a collaborative senior DJ, not a generic chatbot. Solve the user's specific creative problem. Recommend concrete tracks by musical role rather than inventing unavailable catalog titles; include BPM/key constraints, phrase counts, EQ moves, FX timing, and why each move works.`,
  mood: `Translate a mood or event into a playlist concept. Return: concept name, BPM range, 3-5 genres, energy curve, transition style, visual palette, lighting cues, and DJ performance behavior.`,
  story: `Create a seven-act DJ story: Introduction, Warm Up, Energy Build, Peak Time, Emotional Moment, Final Drop, Outro. For every act give duration, BPM, compatible Camelot keys, musical role, transition in/out, and performance cue.`,
  coach: `Act as a rigorous DJ learning coach. Analyze only the supplied deck/mix evidence. Score beat matching, transition timing, EQ, crossfader, creativity, energy progression, and compatibility. Clearly mark metrics that cannot be measured from the supplied evidence. Give strengths, improvements, and one practice drill.`,
  visual: `Design a technically actionable audio-reactive visual system. Map bass, mids, treble, beat/onset and energy to geometry, particles, color, camera and lighting. Include palette hex codes, scene progression, drop behavior, and accessibility/safety limits for strobing.`,
  planner: `Build a complete DJ set plan from event, duration, audience, genres and energy. Divide it into timed chapters. For each chapter specify BPM, Camelot keys, track role, transition, FX and audience objective. End with contingency branches for low or high crowd energy.`,
  artwork: `Act as an art director. Produce an original production brief for the requested asset format, including composition, exact aspect ratio, typography, palette hex codes, subject, texture, negative space, export sizes and a clean image-generation prompt. Do not claim that an image file was generated.`,
  inspiration: `Create a fresh DJ inspiration board for the stated genres/event. Include emerging-style directions without claiming live trend data, transition experiments, remix exercises, festival staging ideas, creative prompts, practical tips and one measurable daily challenge.`,
  insights: `Act as a post-performance analyst. Use only supplied deck and session evidence. Discuss audience energy only as an inference and label it. Evaluate transition quality, smoothness, BPM consistency, energy curve and creativity; state data limitations and give prioritized recommendations.`,
};

export async function POST(req: NextRequest) {
  try {
    const apiKey = getOpenAIApiKey();
    if (!apiKey) return NextResponse.json({ error: 'IBM Granite is not configured. Add the AI API key to .env.local.' }, { status: 503 });
    const body = RequestSchema.parse(await req.json());
    const model = new ChatOpenAI({ apiKey, model: 'gpt-4o-mini', temperature: 0.55, maxTokens: 1100 });
    const response = await model.invoke([
      ['system', `${instructions[body.module]} Use concise headings and plain text. Never fabricate sensor readings, completed renders, track analysis, or live trend data.`],
      ['human', JSON.stringify(body.input, null, 2)],
    ]);
    const result = typeof response.content === 'string'
      ? response.content
      : response.content.map(part => typeof part === 'string' ? part : JSON.stringify(part)).join('\n');
    return NextResponse.json({ result });
  } catch (error) {
    const message = error instanceof z.ZodError ? 'Invalid creative module input.' : error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
