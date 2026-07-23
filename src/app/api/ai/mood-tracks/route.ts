import { NextRequest, NextResponse } from 'next/server';
import { ChatOpenAI } from '@langchain/openai';
import { getOpenAIApiKey } from '@/lib/env';

interface CatalogTrack {
  trackId: number;
  trackName: string;
  artistName: string;
  artworkUrl100: string;
  previewUrl: string;
  primaryGenreName: string;
  releaseDate: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { emotion?: string; genres?: string[]; targetBpm?: number; shuffle?: number };
    const genre = body.genres?.[Math.abs(body.shuffle ?? 0) % Math.max(1, body.genres?.length ?? 1)] ?? 'dance';
    const url = new URL('https://itunes.apple.com/search');
    url.searchParams.set('term', genre);
    url.searchParams.set('media', 'music');
    url.searchParams.set('entity', 'song');
    url.searchParams.set('country', 'IN');
    url.searchParams.set('limit', '25');
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Music catalog returned ${response.status}`);
    const data = await response.json() as { results?: CatalogTrack[] };
    const candidates = (data.results ?? [])
      .filter(track => track.previewUrl && track.artworkUrl100)
      .sort((a, b) => Date.parse(b.releaseDate) - Date.parse(a.releaseDate))
      .slice(0, 12);
    candidates.sort(() => Math.random() - .5);
    let selected = candidates.slice(0, 3);
    let reasons = selected.map(() => `Matches a ${body.emotion ?? 'current'} mood`);

    const apiKey = getOpenAIApiKey();
    if (apiKey && candidates.length) {
      const shortlist = candidates.slice(0, 10);
      const model = new ChatOpenAI({ apiKey, model: 'gpt-4o-mini', temperature: .8, maxTokens: 350 });
      const reply = await model.invoke(`Choose exactly 3 tracks for a DJ set with mood "${body.emotion}", genres ${body.genres?.join(', ')}, and target ${body.targetBpm} BPM. Use only these candidates and return JSON {"picks":[{"id":number,"reason":"short reason"}]}: ${JSON.stringify(shortlist.map(track => ({ id: track.trackId, title: track.trackName, artist: track.artistName, genre: track.primaryGenreName, released: track.releaseDate })))}`);
      try {
        const raw = typeof reply.content === 'string' ? reply.content : '';
        const parsed = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, '')) as { picks?: Array<{ id: number; reason: string }> };
        const picks = (parsed.picks ?? []).map(pick => ({ track: shortlist.find(item => item.trackId === pick.id), reason: pick.reason })).filter(item => item.track);
        if (picks.length) { selected = picks.map(item => item.track!); reasons = picks.map(item => item.reason); }
      } catch {}
    }

    return NextResponse.json({ tracks: selected.map((track, index) => ({
      id: String(track.trackId), title: track.trackName, artist: track.artistName,
      artwork: track.artworkUrl100.replace('100x100bb', '300x300bb'), previewUrl: track.previewUrl,
      source: 'Web', reason: reasons[index] ?? `Suggested for ${body.emotion ?? 'this mood'}`,
    })) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error), tracks: [] }, { status: 502 });
  }
}
