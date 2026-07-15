// /api/auth/spotify/callback — Authorization Code flow callback.
// Spotify redirects here with ?code=…  We exchange code + Client Secret
// for an access token server-side (never exposes the secret to the browser),
// then redirect home passing the token as a short-lived query param.

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { origin, searchParams } = new URL(request.url);

  const error = searchParams.get('error');
  if (error) {
    return NextResponse.redirect(`${origin}/?spotify_error=${encodeURIComponent(error)}`);
  }

  const code = searchParams.get('code');
  if (!code) {
    return NextResponse.redirect(`${origin}/?spotify_error=no_code`);
  }

  const clientId     = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID ?? '';
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET ?? '';
  const redirectUri  = `${origin}/api/auth/spotify/callback`;

  // Exchange the authorisation code for tokens
  const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type:   'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    return NextResponse.redirect(
      `${origin}/?spotify_error=${encodeURIComponent(`token_exchange_failed: ${tokenRes.status} ${text}`)}`
    );
  }

  const data = await tokenRes.json() as {
    access_token:  string;
    refresh_token: string;
    expires_in:    number;
  };

  // Pass the access token to the client via query string.
  // It is short-lived (1 h) and stored only in React state — never persisted.
  const dest = new URL('/', origin);
  dest.searchParams.set('spotify_token', data.access_token);
  dest.searchParams.set('spotify_expires_in', String(data.expires_in));

  return NextResponse.redirect(dest.toString(), 302);
}
