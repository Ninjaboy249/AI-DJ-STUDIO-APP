// /api/ai/voice — POST
// LangChain chain for voice command parsing.

import { NextRequest, NextResponse } from 'next/server';
import { ChatGroq } from '@langchain/groq';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { JsonOutputParser } from '@langchain/core/output_parsers';
import { z } from 'zod';
import { getGroqApiKey } from '@/lib/env';

const SYSTEM_PROMPT = `You are a DJ voice-command interpreter for DeckFlow Web.
The user speaks a short voice command. Parse it into mixer actions.

When a deck is not specified, default to Deck A.
Common mappings:
- "play" / "start" → play Deck A
- "pause" / "stop" → pause Deck A
- "drop bass" / "more bass" → setEq A eqLow +8
- "increase tempo" / "faster" → setTempo A 1.1
- "slower" → setTempo A 0.9
- "loop" / "loop 8 bars" → setLoopIn A + setLoopOut A + toggleLoop A
- "crossfade" / "fade to b" → setCrossfader 0.8
- "volume up" / "louder" → setMasterVolume 0.9
- "cue" → jumpCue A

Respond with raw JSON only:
{
  "transcript": "<exact words>",
  "confirmation": "<short friendly confirmation>",
  "recognised": true|false,
  "actions": [ <GraniteAction objects or empty array> ]
}
No markdown, no code fences.`;

const RequestSchema = z.object({ transcript: z.string() });

export async function POST(req: NextRequest) {
  try {
    const { transcript } = RequestSchema.parse(await req.json());
    const apiKey = getGroqApiKey();
    if (!apiKey) {
      return NextResponse.json({ error: 'Groq API key is not configured. Add GROQ_API_KEY or VITE_GROQ_API_KEY to your environment.' }, { status: 200 });
    }
    const model = new ChatGroq({ apiKey, model: 'llama-3.3-70b-versatile', temperature: 0.1, maxTokens: 300 });
    const chain = ChatPromptTemplate.fromMessages([['system', SYSTEM_PROMPT], ['human', 'Voice command: "{transcript}"']]).pipe(model).pipe(new JsonOutputParser());
    const result = await chain.invoke({ transcript });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
