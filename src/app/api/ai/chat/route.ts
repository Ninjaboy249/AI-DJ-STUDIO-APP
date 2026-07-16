// /api/ai/chat — POST
// OpenAI GPT-4o-mini chain for the AI DJ Copilot.
// Accepts { messages: [{role, content}] } and returns { reply, actions }.
// The OPENAI_API_KEY stays server-side; never exposed to the browser.

import { NextRequest, NextResponse } from 'next/server';
import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { getOpenAIApiKey } from '@/lib/env';

const SYSTEM_PROMPT = `You are an expert AI DJ Copilot for DeckFlow Web, a two-deck browser DJ mixer.

The mixer has:
- Deck A and Deck B, each with: play/pause, tempo (0.5–2.0, 1.0 = original BPM), volume (0–1),
  3-band EQ (eqLow/eqMid/eqHigh, -12 to +12 dB), a DJ filter (-1 = LPF, 0 = off, 1 = HPF),
  cue points, loop in/out points, and hot-cue pads (1–4).
- A crossfader (-1 = full Deck A, 0 = center, +1 = full Deck B).
- FX rack: REV (spin-back), ECHO (delay tail), FLANGER (sweep).
- A master volume (0–1).

IMPORTANT — always explain the musical reasoning behind every recommendation:
- Reference BPM compatibility, harmonic key relationships (Camelot wheel), energy levels, or phrase structure.
- Example: "The next track is 128 BPM and sits on key 8A — one step from your current 8B, making it a harmonically seamless transition."
- Be specific. Mention actual numbers (BPM, dB amounts, beat counts) whenever possible.
- If the user wants to learn the DJ Deck, teach the actual controls step by step and give a small practice task they can perform immediately.
- If the user includes uploaded image or song context, answer from that context. For songs, discuss structure, trimming, transitions, BPM/energy, and editing ideas. For images, explain relevant DJ gear, UI, or setup details.
- The user may ask general questions outside DJing; answer helpfully while still keeping the response concise.

Respond with valid JSON only:
{{
  "reply": "<conversational reply that ALWAYS includes the musical reason why>",
  "actions": ["action description 1", "action description 2"]
}}

Keep the reply concise (2–4 sentences) but always include the why. Only output raw JSON — no markdown, no code fences.`;

const RequestSchema = z.union([
  z.object({
    messages: z.array(z.object({
      role: z.enum(['human', 'assistant', 'user']),
      content: z.string(),
    })),
    deckA: z.object({ bpm: z.number(), playing: z.boolean() }).optional(),
    deckB: z.object({ bpm: z.number(), playing: z.boolean() }).optional(),
  }),
  z.object({
    message: z.string(),
    history: z.array(z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string(),
    })).optional(),
  }),
]);

export async function POST(req: NextRequest) {
  try {
    const apiKey = getOpenAIApiKey();
    if (!apiKey) {
      return NextResponse.json(
        { reply: 'OPENAI_API_KEY is not configured. Add it to .env.local.', actions: [] },
        { status: 200 },
      );
    }

    const body = RequestSchema.parse(await req.json());

    let userText: string;
    let history: Array<{ role: string; content: string }>;

    if ('messages' in body) {
      const all = body.messages;
      userText = all[all.length - 1].content;
      history = all.slice(0, -1);
    } else {
      userText = body.message;
      history = body.history ?? [];
    }

    const model = new ChatOpenAI({
      apiKey,
      model: 'gpt-4o-mini',
      temperature: 0.3,
      maxTokens: 512,
    });

    const prompt = ChatPromptTemplate.fromMessages([
      ['system', SYSTEM_PROMPT],
      new MessagesPlaceholder('history'),
      ['human', '{message}'],
    ]);

    const lcHistory = history.map((m) =>
      (m.role === 'user' || m.role === 'human')
        ? new HumanMessage(m.content)
        : new AIMessage(m.content),
    );

    const promptValue = await prompt.invoke({ message: userText, history: lcHistory });
    const response = await model.invoke(promptValue);
    const raw = typeof response.content === 'string'
      ? response.content
      : response.content.map(part => typeof part === 'string' ? part : JSON.stringify(part)).join('\n');

    let result: Record<string, unknown> = {};
    try {
      const match = raw.match(/\{[\s\S]*\}/);
      result = JSON.parse(match?.[0] ?? raw) as Record<string, unknown>;
    } catch {
      result = { reply: raw, actions: [] };
    }

    const reply  = (result.reply ?? result.message ?? raw ?? 'Done.') as string;
    const actions = Array.isArray(result.actions) ? result.actions.map(String) : [];

    return NextResponse.json({ reply, actions });
  } catch (err) {
    console.error('[/api/ai/chat]', err);
    return NextResponse.json({ reply: `Error: ${String(err)}`, actions: [] }, { status: 500 });
  }
}
