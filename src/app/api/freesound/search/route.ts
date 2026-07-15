// /api/freesound/search — server-side proxy for Freesound API v2.
// Uses API key authentication via Authorization header (key never exposed to client).
// No OAuth required — the API key covers all public search endpoints.
//
// Freesound app callback URL (set in your Freesound developer dashboard):
//   http://freesound.org/home/app_permissions/permission_granted/
// (Standard fallback for non-OAuth / non-web apps — we don't use OAuth at all)

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const apiKey = process.env.FREESOUND_API_KEY ?? '';
  if (!apiKey) {
    return NextResponse.json({ error: 'FREESOUND_API_KEY not configured' }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const q         = searchParams.get('q') ?? '';
  const filter    = searchParams.get('filter') ?? '';
  const sort      = searchParams.get('sort') ?? 'score';
  const page_size = searchParams.get('page_size') ?? '15';
  const page      = searchParams.get('page') ?? '1';

  // Fields we need in the UI
  const fields = 'id,name,username,duration,license,previews,images,tags,avg_rating,num_downloads';

  // Build query — only include `filter` if non-empty (empty filter param breaks the API)
  const params = new URLSearchParams({ q, sort, page_size, page, fields });
  if (filter.trim()) params.set('filter', filter);

  const url = `https://freesound.org/apiv2/search/text/?${params.toString()}`;

  try {
    const res = await fetch(url, {
      headers: {
        // Preferred auth method: Authorization header (keeps key out of server logs too)
        Authorization: `Token ${apiKey}`,
      },
      next: { revalidate: 30 },
    });

    const data = await res.json() as unknown;
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
