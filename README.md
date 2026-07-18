# AI DJ Studio

AI DJ Studio is a browser-based DJ deck for learning, practicing, and performing simple two-deck mixes without installing desktop DJ software.

## The Problem

Beginner DJs usually face three blockers at once: they need expensive software, they need to understand deck controls before they can practice, and they need feedback on musical choices such as BPM, key, phrasing, and transition timing.

This app brings the core practice workflow into one web page:

- Load tracks into Deck A or Deck B.
- Practice cueing, hot cues, loops, pitch, EQ, filters, and FX.
- Learn with DJ-focused quizzes and playable tutorial videos.
- Use AI assistance to understand deck controls and transition choices.
- Search Freesound, connect Spotify playlists, and use pre-loaded practice songs.
- Edit audio clips with the Beat Maker / Music Editor.

## Why It Helps Beginners

AI DJ Studio explains the musical reason behind recommendations instead of only showing buttons. A beginner can see how tempo changes affect pitch, why BPM/key matching matters, where to start a transition, and how loops/hot cues support phrase-based mixing.

## What Makes It Different

Most DJ deck webpages are either visual toys or static demos. This project combines a working deck, learning flow, AI guidance, cloud login, playlist/search integrations, visualizers, and browser audio editing in one app.

## Features

- Two-deck DJ workflow with play, cue, hot cues, pitch, loop, EQ, filter, echo, reverb, and crossfader.
- 4, 8, and 16 beat loop selector.
- BPM / pitch calculator using semitone and cents math.
- Smart transition and tempo/key matching suggestions.
- Experimental browser stem preview exports for vocals, drums, and bass.
- Drag-and-drop audio loading into the browser.
- Record the live mixed output from the home DJ deck and download it locally.
- Optional keyboard shortcuts for deck control.
- Live visualizers: Cyberpunk City, Spectrum, Waveform, and 3D Rings.
- Learn DJ panel with quizzes and playable YouTube lessons.
- Google/email Supabase authentication.
- Spotify playlist browser and Freesound search.
- Support and bug report flow using server-side email configuration.

## Tech Stack

- Next.js App Router
- React
- TypeScript
- Web Audio API
- Elementary Audio (`@elemaudio/core`, `@elemaudio/web-renderer`)
- Supabase Auth
- OpenAI / LangChain for AI DJ chat
- Spotify Web API OAuth integration
- Freesound API server proxy
- Gmail SMTP support endpoint
- Three.js-style CSS/DOM visual layers and canvas visualizers
- Browser `MediaRecorder`, `MediaStreamAudioDestinationNode`, IndexedDB, and localStorage

## API / Integration Notes

- Spotify uses OAuth Authorization Code flow. The client secret stays server-side.
- Supabase handles Google OAuth and email/password accounts.
- OpenAI API keys stay server-side through environment variables.
- Freesound requests are proxied through the app API so the client does not expose the API key.
- Gmail SMTP credentials are read from env vars for support and bug reports.
- Mix recording is local only: Web Audio is routed into a browser `MediaRecorder`, then downloaded without uploading to a server.
- Signed-in custom pre-loaded songs are stored locally in IndexedDB with per-user metadata in localStorage.
- IBM Bob task artifacts may exist locally during development, but they are not required at runtime.

## App API Routes

- `POST /api/ai/chat`: AI DJ assistant replies and suggested actions.
- `POST /api/ai/beat`: AI beat generation support.
- `POST /api/ai/crowd`: crowd mood and energy recommendations.
- `POST /api/ai/fx`: AI-assisted FX generation.
- `POST /api/ai/recommend`: track recommendation support.
- `POST /api/ai/voice`: voice command parsing.
- `GET /api/auth/callback`: Supabase OAuth callback handler.
- `GET /api/auth/spotify/callback`: Spotify Authorization Code callback and token exchange.
- `GET /api/freesound/search`: server-side Freesound search proxy.
- `POST /api/support`: support and bug-report email submission.

## Keyboard Shortcuts

Enable shortcuts in Studio Settings first.

- `Space`: Deck A play/pause
- `Shift + Space`: Deck B play/pause
- `1` to `8`: Deck A hot cues
- `Shift + 1` to `Shift + 8`: Deck B hot cues
- `Q`, `W`, `E`: Deck A 4, 8, 16 beat loops
- `A`, `S`, `D`: Deck B 4, 8, 16 beat loops

## Environment Variables

```env
OPENAI_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
FREESOUND_API_KEY=
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SUPPORT_TO_EMAIL=
```

## Future Roadmap

- Immersive VR 3D mode with interactive Pioneer-style DJ decks, mixer controls, spatial navigation, and headset support.
- Full pad implementation for cue, loop, sample, and FX modes.
- Real-world lesson scenarios and mini games for learning DJ timing.
- SoundCloud integration.
- More complete Spotify playlist loading.
- DJ community chat for sharing beats and playlists.
- DJ leaderboard and practice streaks.
- Mood-based beat generation.
- Stronger login/account flow with profile persistence.
- Beat Maker upgrades for crop, cut, merge, beat making, and arrangement.
- Neural stem separation using WebNN or a lightweight TensorFlow.js model.
