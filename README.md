<p align="center">
  <img src="docs/assets/ai-dj-studio-logo.png" width="260" alt="AI DJ Studio logo" />
</p>

<p align="center">
  <img src="docs/assets/ai-dj-studio-wave.svg" width="100%" alt="AI DJ Studio animated equalizer" />
</p>

<p align="center">
  <strong>A browser-based, AI-assisted DJ workspace for learning, creating, mixing, visualizing, and performing.</strong>
</p>

<p align="center">
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs" />
  <img alt="React" src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=111" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" />
  <img alt="Web Audio" src="https://img.shields.io/badge/Web_Audio-Live-00E5FF" />
  <img alt="AI" src="https://img.shields.io/badge/AI-IBM_Granite_UI-E040FB" />
</p>

<p align="center">Created and maintained by <a href="https://github.com/Ninjaboy249">Shivam Roy · @Ninjaboy249</a></p>

## Challenge Context

### Selected Challenge Theme — July Creative Industries

AI DJ Studio was built for the **July Creative Industries** challenge theme. The creative industries — music, performance, visual art, and live events — are often the last to benefit from AI tooling because the workflows are personal, the standards are subjective, and the tools require real-time feedback. This project targets that gap by embedding AI assistance directly inside a working DJ environment rather than treating it as a separate, disconnected service.

### Problem Statement

Learning to DJ and building complete performances involves skills that are spread across hardware, software, music theory, and creative taste. Today's path looks like this:

- Buy or rent professional software (Serato, Rekordbox, Traktor) with steep learning curves and hardware lock-in.
- Accumulate a personal music library before being able to practice transitions.
- Learn BPM counting, harmonic mixing, phrase timing, EQ management, and FX chains separately from each other.
- Bridge the gap between a creative concept ("a dark techno set with an acid breakdown at 30 min") and the practical decisions needed to execute it.
- Find real-time feedback without a mentor, coach, or collaborator available.

There is no accessible, browser-native environment that combines hands-on practice, guided learning, and AI creative collaboration in one place.

### Solution Description

AI DJ Studio is a zero-install, browser-based DJ workspace that collapses those barriers into a single tab:

1. **Two working decks** with waveform analysis, EQ, FX, hot cues, loops, and a crossfader — a real practice environment, not a simulation.
2. **Guided learning layer** with interactive tutorials and quizzes tied directly to the live controls — users read, then immediately do.
3. **AI Creative Suite** with ten purpose-built workflows that translate creative intent (mood, story arc, event type, visual concept) into structured, actionable DJ plans.
4. **Visual and VR performance stage** so creators can prototype visuals and staging alongside their music.
5. **Local-first privacy** — tracks stay in the browser, recordings export locally, and no files are uploaded without user action.

### AI Approach and Architecture

The AI layer is designed around *contextual specialization* rather than a single general-purpose chat interface.

**Inference model**
All AI routes use OpenAI (GPT-4o class) via LangChain on server-side Next.js API routes. The interface is branded as **IBM Granite** to reflect the challenge partnership; the underlying inference can be swapped to any OpenAI-compatible endpoint.

**Prompt architecture**
Each of the ten AI Creative workflows uses a dedicated system prompt engineered for its specific domain:

| Workflow | What the prompt specializes in |
| --- | --- |
| Creative Studio | Set concept, genre blends, BPM journeys, harmonic paths |
| Creative Partner | Real-time next-track decisions, energy changes, FX timing |
| Mood Generator | Translating event/feeling descriptions into music + visual direction |
| Story Mix | Seven-act narrative arc construction |
| Learning Coach | Evidence-based skill gap analysis from deck state |
| Visual Studio | Mapping audio frequency bands to reactive visual behavior |
| Set Planner | Timed chapters with BPM/key paths, transitions, contingencies |
| Album & Poster | Art direction and exportable branded SVG output |
| Inspiration Board | Daily challenges, transition experiments, remix exercises |
| Performance Insights | Post-mix analysis without hallucinating unavailable audience data |

**Deck-state grounding**
When a user invokes a workflow, the current deck state (loaded tracks, BPM, key, position, active FX, detected mood) is serialized and injected into the prompt context. This grounds the AI output in real playback evidence rather than generic advice.

**Safety and honesty constraints**
Every workflow prompt explicitly instructs the model not to fabricate unavailable data (crowd size, real-time audio analysis it cannot hear). The Learning Coach prompt, for example, is instructed to base gaps only on evidence the application can actually measure.

**Server-side isolation**
API keys and LangChain orchestration live on Next.js server routes (`/api/ai/*`). The client never holds credentials; it sends serialized context objects and receives structured markdown responses.

```mermaid
flowchart TD
    DeckState[Live Deck State\nBPM · Key · FX · Position] --> ContextBuilder[Context Serializer]
    UserIntent[User Creative Intent\nMood · Story · Event · Goal] --> ContextBuilder
    ContextBuilder --> APIRoute[Next.js API Route\n/api/ai/creative]
    APIRoute --> LangChain[LangChain\nPrompt Template + Chain]
    LangChain --> OpenAI[OpenAI GPT-4o\nlabeled IBM Granite]
    OpenAI --> StructuredResponse[Structured Markdown Response]
    StructuredResponse --> CreativeSuite[AI Creative Suite UI]
    CreativeSuite --> DJ[DJ / Creator]
```

### How IBM Bob Was Used

**IBM Bob** (the AI coding assistant inside this development environment) was used throughout the build as a hands-on engineering collaborator:

- **Component scaffolding** — Bob generated the initial structure for the ten AI Creative workflow components, the VR stage, the waveform visualizer, and the Beat Maker.
- **Prompt engineering** — System prompt templates for each AI workflow were drafted and refined with Bob, iterating on specificity, tone, and constraint language until outputs matched the desired quality.
- **Architecture decisions** — Conversations with Bob shaped the server-side API isolation strategy, the deck-state serialization format, and the IndexedDB persistence approach.
- **Bug diagnosis** — Bob traced several hard-to-reproduce audio graph lifecycle issues in the Web Audio API integration, including the OfflineAudioContext race condition in the BPM detector.
- **README and documentation** — This README was written and structured with Bob's assistance, including this section.
- **Code review** — Bob reviewed TypeScript types, API route request validation, and React hook dependency arrays across the codebase.

Bob was used as a peer engineer, not a code generator. Every suggestion was reviewed, tested, and integrated deliberately. No generated output was committed without human review.

---

## What Is AI DJ Studio?

AI DJ Studio turns a web browser into an approachable two-deck DJ environment. It combines real browser audio controls, guided learning, AI-assisted creative planning, reactive visuals, performance feedback, music discovery, recording, and an immersive VR stage in one application.

It is designed to shorten the distance between *wanting to DJ* and *actually practicing*. New DJs can learn what each control does, creators can develop complete set ideas, and performers can test transitions without installing traditional desktop DJ software.

> The AI Creative experience is branded as **IBM Granite** in the interface and currently uses the configured OpenAI service as its underlying inference provider.

## The Problem It Solves

Learning to DJ often requires expensive software, unfamiliar hardware terminology, a personal music library, and enough theory to understand BPM, phrasing, EQ, keys, and energy. Static tutorials explain these ideas separately, but they rarely let a learner practice them immediately.

AI DJ Studio brings those pieces together:

- Learn a concept and try it on the decks immediately.
- Receive explanations for BPM, harmonic compatibility, phrase timing, and transitions.
- Develop a performance concept before selecting tracks.
- Load local audio, practice a mix, record it, and review the result.
- Explore visual, VR, streaming, and creative workflows from the same interface.

## Who Uses It?

| User | How AI DJ Studio helps |
| --- | --- |
| Beginner DJs | Guided onboarding, lessons, cue/loop practice, and understandable AI recommendations. |
| Bedroom DJs | A portable practice deck for local tracks, transitions, FX, hot cues, and recordings. |
| Music creators | Beat editing, remix prompts, mood boards, artwork briefs, and set-story development. |
| Event and club DJs | Event-aware set planning, energy progression, BPM/key paths, and transition strategies. |
| Students and educators | A visual teaching environment for rhythm, EQ, harmonic mixing, and performance structure. |
| Visual performers | Audio-reactive visual concepts, cyberpunk scenes, 3D visualization, and VR staging. |

## How It Helps

### Learn by doing

The interactive tutorial introduces real controls rather than showing a disconnected slideshow. The Learn DJ area combines explanations, quizzes, and playable lessons, while the AI assistant explains the musical reason behind its advice.

### Build better mixes

Deck A and Deck B support play/pause, cueing, seeking, hot cues, tempo, EQ, filtering, echo, reverb, loops, volume, and crossfading. Smart suggestions help users reason about BPM differences, harmonic movement, bass swaps, and phrase-aligned transitions.

### Turn ideas into complete performances

The AI Creative suite includes purpose-built workflows for creative direction, collaboration, mood generation, story mixes, learning feedback, visual planning, complete set planning, artwork, inspiration, and performance insights.

### Practice without surrendering your files

Local tracks are decoded and played in the browser. Mix recording uses the browser audio graph and downloads the result locally; it does not require uploading the recording to a remote server.

## Core Experiences

### DJ Deck and Mixer

- Two working decks with waveform seeking and track analysis.
- Cue points, hot cues, pitch/tempo, 4/8/16-beat loops, EQ, filters, echo, and reverb.
- Channel volume, master volume, and crossfader controls.
- Drag-and-drop track loading, local recording, and keyboard control.
- BPM/pitch calculations and smart transition guidance.

### IBM Granite AI Creative Suite

- **Creative Studio:** set concepts, genre blends, BPM journeys, harmonic paths, and performance direction.
- **Creative Partner:** context-aware help with next-track roles, energy changes, intros, FX, and transitions.
- **Mood Generator:** converts an event or feeling into music, visual, lighting, and performance direction.
- **Story Mix:** creates a seven-act set from introduction through final drop and outro.
- **Learning Coach:** analyzes available deck evidence and identifies measurable limitations honestly.
- **Visual Studio:** maps bass, mids, treble, beats, and energy to visual behavior.
- **Set Planner:** builds timed chapters with BPM, keys, track roles, transitions, and contingencies.
- **Album & Poster:** generates art direction and exports editable branded SVG artwork.
- **Inspiration Board:** creates transition experiments, remix exercises, stage ideas, and daily challenges.
- **Performance Insights:** provides evidence-based analysis without inventing unavailable audience data.

### Learning and Onboarding

- Ten-step deck tutorial tied to the real interface.
- Learn DJ quizzes and playable lesson videos.
- Compact chroma-keyed presenter video after tutorial completion.
- Optional keyboard-shortcut manual and persistent learning preferences.

### Visuals and VR

- Cyberpunk City, spectrum, waveform, and 3D ring visualizers.
- Audio-reactive lighting and stage effects.
- Outdoor sunset VR stage with the Pioneer-style GLB console.
- In-world Deck A/B play controls and interactive jog-wheel seeking.
- Desktop orbit controls plus WebXR headset entry when supported.

### Library, Streaming, and Creation

- Local and preloaded music workflows.
- Spotify OAuth playlist browser.
- Freesound search, preview, sorting, and deck loading.
- Browser music editor for cutting and merging WAV output.
- Experimental filtered vocal, drum, and bass stem previews.

## How the Application Works

```mermaid
flowchart LR
    User[DJ / Creator] --> UI[Next.js + React Studio]
    UI --> Decks[Two-Deck Audio Engine]
    Decks --> WebAudio[Web Audio + Elementary Audio]
    Decks --> Recording[Local MediaRecorder Export]
    UI --> AI[IBM Granite-branded AI Workflows]
    AI --> OpenAI[Server-side OpenAI / LangChain]
    UI --> Visuals[Canvas + Three.js + WebXR]
    UI --> Services[Supabase · Spotify · Freesound]
```

## Technology Stack

- **Application:** Next.js App Router, React 19, TypeScript, Tailwind/PostCSS.
- **Audio:** Web Audio API, Elementary Audio, Tone.js, MediaRecorder, OfflineAudioContext.
- **AI:** server-side OpenAI through LangChain with specialized creative prompts.
- **3D and VR:** Three.js, React Three Fiber, Drei, WebXR, GLB assets.
- **Computer vision:** MediaPipe Tasks Vision for emotion/camera experiences.
- **Authentication:** Supabase email/password and Google/GitHub OAuth.
- **Music services:** Spotify OAuth and Freesound server proxy.
- **Persistence:** IndexedDB and localStorage for browser-owned state.

## Getting Started

### Prerequisites

- Node.js 20 or newer
- npm
- A modern Chromium, Firefox, or Safari browser

### Install and run

```bash
git clone https://github.com/Ninjaboy249/AI-DJ-STUDIO-APP.git
cd AI-DJ-STUDIO-APP
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Validation

```bash
npm run typecheck
npm run build
```

## Environment Variables

Create `.env.local` in the project root. Configure only the integrations you intend to use.

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

Secrets remain on server routes. Do not commit `.env.local`.

## API Routes

| Route | Purpose |
| --- | --- |
| `POST /api/ai/chat` | DJ copilot replies and suggestions. |
| `POST /api/ai/creative` | Specialized AI Creative module generation. |
| `POST /api/ai/beat` | AI-assisted beat specification. |
| `POST /api/ai/crowd` | Crowd-mood interpretation and recommendations. |
| `POST /api/ai/fx` | Timed DJ effect generation. |
| `POST /api/ai/mood-tracks` | Mood-aware track support. |
| `POST /api/ai/recommend` | Track recommendation support. |
| `POST /api/ai/voice` | Voice-command interpretation. |
| `GET /api/auth/callback` | Supabase OAuth callback. |
| `GET /api/auth/spotify/callback` | Spotify OAuth callback and token exchange. |
| `GET /api/freesound/search` | Server-side Freesound search proxy. |
| `POST /api/support` | Support and bug-report email submission. |

## Keyboard Shortcuts

Enable shortcuts in Studio Settings first.

| Shortcut | Action |
| --- | --- |
| `Space` | Deck A play/pause |
| `Shift + Space` | Deck B play/pause |
| `1`–`8` | Deck A hot cues |
| `Shift + 1`–`8` | Deck B hot cues |
| `Q` / `W` / `E` | Deck A 4 / 8 / 16-beat loops |
| `A` / `S` / `D` | Deck B 4 / 8 / 16-beat loops |

## Privacy and Integration Notes

- Local track playback and mix recording stay in the browser.
- OpenAI keys remain server-side and are never intentionally exposed to client components.
- Spotify client secrets and Freesound credentials are handled by server routes.
- Supabase manages authenticated sessions and configured OAuth providers.
- Browser and headset capabilities vary; WebXR controls degrade to the desktop 3D view when unavailable.
- AI guidance supports creative decisions but does not replace listening, licensing checks, or performer judgment.

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
