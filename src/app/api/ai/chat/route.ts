// /api/ai/chat — POST
// LangChain ChatGroq chain for the AI DJ chat feature.
// Accepts { messages: [{role, content}] } from the client and returns
// { reply, actions } (or { message, actions } for legacy callers).
// The GROQ_API_KEY stays server-side; never exposed to the browser.

import { NextRequest, NextResponse } from 'next/server';
import { ChatGroq } from '@langchain/groq';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { JsonOutputParser } from '@langchain/core/output_parsers';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { getGroqApiKey } from '@/lib/env';

const SYSTEM_PROMPT = `You are an AI DJ assistant controlling DeckFlow Web, a two-deck browser DJ mixer.

The mixer has:
- Deck A and Deck B, each with: play/pause, tempo (0.5–2.0, where 1.0 is normal speed), volume (0–1),
  3-band EQ (eqLow/eqMid/eqHigh, -12 to +12 dB), a DJ filter (-1 = LPF, 0 = off, 1 = HPF),
  a cue point (jumpCue), loop in/out points, and seek (normalized 0–1 position).
- A crossfader (-1 = full Deck A, 0 = center, +1 = full Deck B).
- A master volume (0–1).

When the user gives a mixing instruction, respond with valid JSON:
{
  "reply": "<short conversational reply>",
  "actions": ["action description 1", "action description 2"]
}

Keep the reply concise and friendly. List the actions you performed as short human-readable strings.
Only output raw JSON — no markdown, no code fences.`;

// Accept both { messages: [{role,content}] } and legacy { message, history }
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
    const apiKey = getGroqApiKey();
    if (!apiKey) {
      return NextResponse.json(
        { reply: 'GROQ_API_KEY is not configured. Add it to .env.local.', actions: [] },
        { status: 200 }, // return 200 so the UI shows the message, not an error
      );
    }

    const body = RequestSchema.parse(await req.json());

    // Normalize both request shapes into { userText, history }
    let userText: string;
    let history: Array<{ role: string; content: string }>;

    if ('messages' in body) {
      const all = body.messages;
      const last = all[all.length - 1];
      userText = last.content;
      history = all.slice(0, -1);
    } else {
      userText = body.message;
      history = body.history ?? [];
    }

    const model = new ChatGroq({
      apiKey,
      model: 'llama-3.3-70b-versatile',
      temperature: 0.3,
      maxTokens: 512,
    });

    const prompt = ChatPromptTemplate.fromMessages([
      ['system', SYSTEM_PROMPT],
      new MessagesPlaceholder('history'),
      ['human', '{message}'],
    ]);

    const chain = prompt.pipe(model).pipe(new JsonOutputParser());

    const lcHistory = history.map((m) =>
      (m.role === 'user' || m.role === 'human')
        ? new HumanMessage(m.content)
        : new AIMessage(m.content),
    );

    const result = await chain.invoke({ message: userText, history: lcHistory }) as Record<string, unknown>;

    // Normalise: support both `reply` and legacy `message` keys from the model
    const reply = (result.reply ?? result.message ?? 'Done.') as string;
    const actions = (result.actions ?? []) as string[];

    return NextResponse.json({ reply, actions });
  } catch (err) {
    console.error('[/api/ai/chat]', err);
    return NextResponse.json(
      { reply: `Error: ${String(err)}`, actions: [] },
      { status: 500 },
    );
  }
}
