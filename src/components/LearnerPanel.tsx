'use client';
// LearnerPanel — DJ tutorial with YouTube videos, deck anatomy, and lessons beginner→pro.

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';

const ReactPlayer = dynamic(() => import('react-player'), { ssr: false });

/* ─── YouTube video data ──────────────────────────────────────────────── */
interface Video {
  id: string;       // YouTube video ID
  title: string;
  channel: string;
  duration: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  tags: string[];
  description: string;
}

function youtubeEmbedUrl(id: string) {
  return `https://www.youtube.com/embed/${id}`;
}


const VIDEOS: Video[] = [

  {
    id: '0g8w3WE-nfk',
    title: 'How To DJ For Beginners 2026 (Free Course)',
    channel: 'Club Ready DJ School',
    duration: 'Course',
    level: 'Beginner',
    tags: ['Overview', 'Beatmatching', 'EQ'],
    description: 'A broad beginner course covering beatmatching, EQ blending, phrasing and first transitions.',
  },
  {
    id: 'briGVH_JTQA',
    title: 'How to Beatmatch in 2026 (Complete Guide)',
    channel: 'Club Ready DJ School',
    duration: 'Guide',
    level: 'Beginner',
    tags: ['Beatmatching', 'Timing', 'Pitch'],
    description: 'Practical beatmatching drills for lining up two tracks confidently.',
  },
  {
    id: 'EQeEyyipaDE',
    title: 'How To Start DJing in 15 Minutes',
    channel: 'Crossfader',
    duration: '15:00',
    level: 'Beginner',
    tags: ['First Mix', 'Practice', 'Controller'],
    description: 'A fast first-session walkthrough for getting from zero to a simple mix.',
  },
  {
    id: '25JAaIdJwnM',
    title: 'How to Beatmatch on Pioneer DDJ-FLX4',
    channel: 'Crossfader',
    duration: 'Tutorial',
    level: 'Beginner',
    tags: ['Controller', 'Beatmatching', 'Beginner'],
    description: 'A controller-focused beatmatch tutorial that maps well to the studio deck controls.',
  },
  {
    id: '9oCnVJFpXhQ',
    title: 'Phrasing Tutorial & Basic Mixing',
    channel: 'Crossfader',
    duration: 'Lesson',
    level: 'Intermediate',
    tags: ['Phrasing', 'Structure', 'Mixing'],
    description: 'Learn to place transitions on musical phrases instead of random beat counts.',
  },
  {
    id: 'ua53Sn3nPZ8',
    title: 'How To Use the Echo Effect to Transition Between Tracks',
    channel: 'Crossfader',
    duration: 'Tutorial',
    level: 'Intermediate',
    tags: ['Echo', 'Transition', 'FX'],
    description: 'A practical effects lesson for echo-out transitions and phrase endings.',
  },
  {
    id: 'mvYMZc6jgvg',
    title: 'Emergency Exit Transitions: Echo and Reverb Out',
    channel: 'DJ TechTools',
    duration: 'Tutorial',
    level: 'Intermediate',
    tags: ['Reverb', 'Echo', 'Recovery'],
    description: 'Learn a recovery transition that helps when a mix needs a clean exit.',
  },
  {
    id: 'DPyYioZE1FA',
    title: 'How to Use Beat FX',
    channel: 'Crossfader',
    duration: 'Course Part',
    level: 'Intermediate',
    tags: ['Beat FX', 'Filter', 'Performance'],
    description: 'A focused lesson on using beat effects in a controlled, musical way.',
  },
  {
    id: '9IhXVBktMqY',
    title: 'I Went From Basic to Pro With These DJ Transitions',
    channel: 'Crossfader',
    duration: 'Tutorial',
    level: 'Advanced',
    tags: ['Transitions', 'Advanced', 'Flow'],
    description: 'Transition ideas for moving beyond basic blends into more expressive set flow.',
  },
  {
    id: '-DOYZcBwS08',
    title: '5 DJ Tutorials to Make You a Better DJ',
    channel: 'Crossfader',
    duration: 'Guide',
    level: 'Advanced',
    tags: ['Practice', 'Workflow', 'Pro'],
    description: 'A learning path style video for turning practice sessions into a repeatable workflow.',
  },
];

/* ─── DJ Deck anatomy ─────────────────────────────────────────────────── */
interface DeckButton {
  icon: string;
  name: string;
  category: string;
  details: string[];
}

const DECK_BUTTONS: DeckButton[] = [
  {
    icon: '◉', name: 'JOG WHEELS / PLATTERS', category: 'Vinyl',
    details: [
      'Jog wheels serve two main purposes. The first is track-position control: use the jog wheel to position a track conveniently for mixing, setting up a loop, or creating a Hot Cue.',
      'Moving the jog wheel while touching its top surface controls the track position much like moving a vinyl record on a turntable. This is useful for scratching and for moving quickly around the track.',
      'Moving only the jog wheel’s edge makes a much smaller adjustment. You may need to turn it several times to move the track by a second. This is useful for beatmatching: when two tracks share the same tempo, nudging the platter edge momentarily speeds up or slows down playback so you can fine-tune their alignment.',
      'Some controllers include a VINYL MODE button. With Vinyl Mode deactivated, the whole jog-wheel surface behaves like the edge: you cannot scratch or move quickly through the track with the top surface, but you can use it to fine-tune tempo alignment.',
      'Some modern DJ controllers use motorized platters for a more vinyl-like experience. These typically provide extra controls for platter torque and feel. The RANE ONE is a notable example.',
    ],
  },
  {
    icon: 'S', name: 'SLIP MODE', category: 'Performance',
    details: [
      'If you’re performing a technique—scratching, looping, reversing, hot cueing, etc.—the track continues playing behind the scenes. When you stop the technique, the track reappears as if nothing had happened.',
      'To scratch just before a drop, activate VINYL mode so the jog wheel behaves like a vinyl platter, then press SLIP so it lights red. While you scratch, the track keeps moving silently on the touch display. Release the platter and you hear where the track has reached—for example, the drop.',
      'This keeps the performance musically coherent: scratching “in place” would throw off the audience’s internal rhythmic clock and lose momentum. Don’t forget to turn SLIP off when you’re finished.',
    ],
  },
  {
    icon: '↶', name: 'SLIP REVERSE', category: 'Performance',
    details: [
      'When you push the SLIP REV lever up and hear the track reversing, the track simultaneously continues playing silently underneath. Let go and you rejoin the track as if you had never used SLIP REV.',
      'Use it before a drop to create tension or confusion, then release it when the drums return. Gauge the timing by watching the playhead on the touch screen, keeping count, and knowing your track well.',
      'It is also useful for skipping a curse word at weddings or family functions: trigger SLIP REV just before the word and you have effectively bleeped it out, returning without missing a beat.',
    ],
  },
  {
    icon: 'H', name: 'HOT CUE (CALL/DELETE, A to H)', category: 'Cue & Memory',
    details: [
      'This button calls up your Hot Cues in a track, displaying Hot Cues previously created in rekordbox if they were not automatically loaded with the track.',
      'To load them automatically, press and hold MENU / UTILITY or press SHORTCUT on the rotary selector. Set HOT CUE AUTO LOAD to ON, or to the rekordbox setting ON, which automatically loads Hot Cues for every track when it is loaded.',
    ],
  },
  {
    icon: 'Q', name: 'QUANTIZE', category: 'Timing',
    details: [
      'On older CDJs, you set a loop with LOOP IN and OUT, then corrected early or late timing with IN ADJUST and OUT ADJUST. QUANTIZE essentially makes those corrections for you.',
      'When tracks have been analysed in rekordbox, QUANTIZE snaps loops, hot cues, and cue points to the beat grid so they land perfectly in time. Turn it off and you must adjust loops and cues manually.',
    ],
  },
  {
    icon: '⇄', name: 'CUE/LOOP CALL', category: 'Cue & Memory',
    details: [
      'The two arrows “call”—navigate to—the cue points, saved loops, and memory points made on the player or in rekordbox, where you can add up to ten memory points per track. Press the arrows to move through the points.',
      'For a track with a beatless intro, use CUE and the jog wheel to cue the first drum beat, then press MEMORY to save it. You can now skip the intro and start blending from this new cue point.',
    ],
  },
  {
    icon: 'M', name: 'MEMORY', category: 'Cue & Memory',
    details: [
      'Memory points mark significant moments such as a vocal, percussion, or something unexpected—events that are not always obvious in the waveform. At the moment, hold MEMORY and a red triangle marks that point on the loaded track’s touch display.',
      'You can add notes to memory points in rekordbox (not on the player), such as “vocal” or “Amen break.” A note like “VOX” tells you a vocal begins there; “C skip second chorus” can remind you to press Hot Cue C at the next memory point and skip part of the song.',
      'The memory function works the same on CDJ-2000NXS2 and CDJ-3000 players.',
    ],
  },
  {
    icon: '×', name: 'DELETE', category: 'Cue & Memory',
    details: ['Use the CUE/LOOP CALL arrows to find and select the memory point you want to erase, then press DELETE. The red triangle disappears.'],
  },
  {
    icon: '8', name: 'BEAT LOOP (1/2X), 8 BEAT LOOP (2X)', category: 'Looping',
    details: [
      'These Auto Loop functions create a perfect 4- or 8-beat loop, with no manual correction through IN ADJUST or OUT ADJUST needed.',
      'You can halve or double the loop. After creating an 8-beat loop, 2X makes it 16 beats; 1/2X makes it 4, then 2, and so on down to 1/64 beat.',
      'At very short lengths the track stutters, which can build hype before a drop. Once you have built enough tension—without overdoing it—press RELOOP / EXIT to land in the drop.',
    ],
  },
  {
    icon: '⇥', name: 'BEAT JUMP', category: 'Navigation',
    details: [
      'BEAT JUMP moves forwards or backwards by a chosen number of beats. Press SHORTCUT beside the rotary selector to open the Beat Jump Value grid, then choose ½, 1, 2, 4, 8, 16, 32, or 64 beats.',
      'For a house track, choose 32 beats (8 bars), then leave the menu. If a beatless breakdown is approaching and you want the drums to keep rolling, press the forward BEAT JUMP button as the break arrives to skip it. Trance may require 64 beats for the same result.',
      'This keeps energy high and works like creating edits on the fly. The jump length only works musically when you know the track and the section length.',
    ],
  },
  {
    icon: 'K±', name: 'KEY SHIFT (touch display)', category: 'Key',
    details: [
      'KEY SHIFT helps DJs who do not have musical training or are unsure whether they are mixing harmonically. Tap it to display three buttons that raise, lower, or reset the track’s semitones so it matches the same—or a harmonically related—key as the Master deck.',
      'It can also change a track’s mood. During an extended breakdown, tap KEY SHIFT several times to make it sound stranger, then tap the middle RESET button just before the drop to restore the original key.',
    ],
  },
  {
    icon: 'KS', name: 'KEY SYNC', category: 'Key',
    details: [
      'Unlike KEY SHIFT, where you manually tap increase or decrease until the incoming track matches, KEY SYNC automatically harmonically matches it to the track playing on the Master deck.',
      'For example, when mixing tracks in C and E, KEY SYNC corrects the slight harmonic clash automatically.',
    ],
  },
  {
    icon: '◉', name: 'VINYL SPEED ADJ. TOUCH/BRAKE', category: 'Vinyl',
    details: [
      'This dial adjusts the jog wheel’s touch and brake speed when VINYL mode is active, replicating the lag of a turntable motor. Clockwise increases lag; counterclockwise decreases it.',
      'Use it to control vinyl-style slow-down and speed-up effects. When scratching a vocal Hot Cue, a brake that is too fast can lose the desired “chirp”; too slow can drag the vocal into the next syllable, so the dial position matters.',
    ],
  },
  {
    icon: 'TAG', name: 'TAG TRACK / REMOVE', category: 'Library',
    details: [
      'Press this button while a track is paused or playing to tag it and store it in the player’s TAG LIST. The feature first appeared on the CDJ-2000 in 2009 and remains useful on the CDJ-3000.',
      'If a track transforms the dance floor, press and hold TAG TRACK / REMOVE instead of relying on memory to add it to a rekordbox playlist later. The player adds it to TAG LIST.',
    ],
  },
  {
    icon: 'LIST', name: 'TAG LIST', category: 'Library',
    details: [
      'TAG LIST is the home of tracks tagged during your set: reliable dance-floor rescuers, a useful vocal, or oddball tunes for specific moments. It is like making a rekordbox playlist directly on the player.',
      'On the CDJ-3000, convert a TAG LIST into a playlist by tapping MENU and selecting CREATE PLAYLIST. To remove a track, highlight it with the rotary selector, then press and hold TAG TRACK / REMOVE until it disappears.',
    ],
  },
  {
    icon: '⌕', name: 'TRACK FILTER / EDIT', category: 'Library',
    details: [
      'This filters tracks using rekordbox tag information and conditions including BPM, Key, Rating, and Color. It only works with music analysed in rekordbox.',
      'To find harmonic matches for C, select C in the touch display’s key range. To find music near a 145 BPM Master track, enter 145 and select a percentage range such as 6%.',
      'After setting conditions, press MY TAG and choose labels from the rekordbox categories Genre, Components, Situation, and Maintenance—for example Techno, Cowbell, Peak Time, and Hot Cues. Exit with TRACK FILTER / EDIT. Matches appear green with a small filter symbol.',
    ],
  },
  {
    icon: '↯', name: 'SHORTCUT', category: 'Settings',
    details: [
      'SHORTCUT opens BROWSE mode and MY SETTINGS on the touch display. From there you can change the waveform phase meter; turn Hot Cue auto-load on or off; adjust screen and jog-wheel brightness; choose beat quantize and Beat Jump values; and change waveform colour and position.',
    ],
  },
];

const CATEGORY_COLOR: Record<string, string> = {
  Performance: '#ff9800',
  'Cue & Memory': '#00e5ff',
  Timing:      '#e040fb',
  Looping:     '#ff5722',
  Navigation:  '#4caf50',
  Key:         '#7c3aed',
  Vinyl:       '#f44336',
  Library:     '#03a9f4',
  Settings:    '#90a4ae',
};

/* ─── Lesson modules ──────────────────────────────────────────────────── */
interface Step { label: string; done: boolean; }
interface Module {
  id: number;
  title: string;
  duration: string;
  done?: boolean;
  level: 'Beginner' | 'Intermediate' | 'Pro';
  description: string;
  steps: Step[];
}

const MODULES: Module[] = [
  {
    id: 1, level: 'Beginner', title: 'Getting Started — DJ Fundamentals',
    duration: '15 min', done: true,
    description: 'The non-negotiable basics every DJ needs before touching the decks: BPM, musical keys, and how tracks are structured.',
    steps: [
      { label: 'What is BPM and why it determines everything', done: true },
      { label: 'How tracks are structured (intro, verse, chorus, outro)', done: true },
      { label: 'Understanding musical keys and the Camelot Wheel', done: true },
    ],
  },
  {
    id: 2, level: 'Beginner', title: 'Decks & Transport Controls',
    duration: '20 min', done: false,
    description: 'Master the core transport controls — Play, Pause, CUE, and the jog wheel — that every DJ uses in every set.',
    steps: [
      { label: 'Play / Pause, CUE, and the vinyl platter', done: true },
      { label: 'Setting hot cues for instant navigation', done: false },
      { label: 'Seeking with the waveform display', done: false },
    ],
  },
  {
    id: 3, level: 'Beginner', title: 'Your First Beatmatch',
    duration: '25 min', done: false,
    description: 'Learn to align two tracks so they play in perfect rhythmic sync — the cornerstone skill of all DJing.',
    steps: [
      { label: 'Using the pitch slider to nudge BPM', done: false },
      { label: 'Listening in headphones and matching phase', done: false },
      { label: 'Your first live beatmatch transition', done: false },
    ],
  },
  {
    id: 4, level: 'Beginner', title: 'Mixing with the Crossfader & Faders',
    duration: '20 min', done: false,
    description: 'Blend two tracks seamlessly using the crossfader and channel faders — smooth transitions that sound professional.',
    steps: [
      { label: 'Equal-power crossfade explained', done: false },
      { label: 'Up-fader technique for house and techno', done: false },
      { label: 'Gain staging — why both volumes matter', done: false },
    ],
  },
  {
    id: 5, level: 'Intermediate', title: 'EQ & Filter Mixing',
    duration: '20 min', done: false,
    description: 'Shape your sound with 3-band EQ and the DJ filter sweep — essential tools for professional-sounding mixes.',
    steps: [
      { label: 'Hi / Mid / Low shelf EQ — what each band does', done: false },
      { label: 'Classic DJ bass-swap technique', done: false },
      { label: 'Filter sweeps (LPF / HPF) for buildups and breakdowns', done: false },
    ],
  },
  {
    id: 6, level: 'Intermediate', title: 'Loops, Cue Points & Beat Jumps',
    duration: '15 min', done: false,
    description: 'Create loops, set in/out points, and use beatjumps to build tension, extend moments, and keep transitions tight.',
    steps: [
      { label: 'Setting loop in / out points on the phrase', done: false },
      { label: 'Beat-length loops (4 / 8 / 16 beat)', done: false },
      { label: 'Beatjumps to fix a late or early entry', done: false },
    ],
  },
  {
    id: 7, level: 'Intermediate', title: 'FX & Effects Rack',
    duration: '20 min', done: false,
    description: 'Use REV, ECHO and FLANGER to add drama, energy, and identity to your mix — without overdoing it.',
    steps: [
      { label: 'Spin-back (REV) technique for drops', done: false },
      { label: 'Echo throw on phrase endings', done: false },
      { label: 'Filter + flanger sweeps for energy buildups', done: false },
    ],
  },
  {
    id: 8, level: 'Intermediate', title: 'Harmonic Mixing in Key',
    duration: '15 min', done: false,
    description: 'Go beyond BPM matching — choose tracks that are musically compatible using the Camelot Wheel.',
    steps: [
      { label: 'Reading the Camelot Wheel for compatible keys', done: false },
      { label: 'Moving between energy keys (moving inward/outward)', done: false },
      { label: 'Using key shift to modulate the mood of a set', done: false },
    ],
  },
  {
    id: 9, level: 'Pro', title: 'Reading the Crowd & Energy Management',
    duration: '25 min', done: false,
    description: 'Build and release tension to keep the dance floor moving all night — the skill that separates great DJs from good ones.',
    steps: [
      { label: 'Energy curves: build, plateau, drop, recovery', done: false },
      { label: 'Reading crowd signals — body language & vibe', done: false },
      { label: 'Transitioning between genres or tempos smoothly', done: false },
    ],
  },
  {
    id: 10, level: 'Pro', title: 'Set Building & Track Selection',
    duration: '20 min', done: false,
    description: 'Curate a set that tells a story — from opening tracks to peak-time bombs to a cool-down finale.',
    steps: [
      { label: 'Programming peaks, valleys, and tension arcs', done: false },
      { label: 'Selecting openers, peak-time, and closing tracks', done: false },
      { label: 'Building a signature sound and style', done: false },
    ],
  },
  {
    id: 11, level: 'Pro', title: 'AI DJ Features',
    duration: '10 min', done: false,
    description: 'Let the AI suggest transitions, match BPM, generate beats, and analyze your mix in real time.',
    steps: [
      { label: 'Using AI suggestions for smooth transitions', done: false },
      { label: 'Beat generator, AI playlists & auto-mix', done: false },
      { label: 'Crowd mood detection and AI copilot', done: false },
    ],
  },
];

const LEVEL_COLOR: Record<string, string> = {
  Beginner:     '#4caf50',
  Intermediate: '#ff9800',
  Pro:          '#e040fb',
};

type Tab = 'lessons' | 'videos' | 'deck';
type VideoFilter = 'All' | 'Beginner' | 'Intermediate' | 'Advanced';
type ProgressState = Record<number, boolean[]>;
const PROGRESS_KEY = 'learn-dj-progress-v2';

function initialProgress(): ProgressState {
  return Object.fromEntries(MODULES.map(m => [m.id, m.steps.map(s => s.done)]));
}

interface Quiz {
  question: string;
  options: string[];
  correct: number;
  explanation: string;
}

function quizForStep(label: string): Quiz {
  const lower = label.toLowerCase();
  if (lower.includes('bpm')) return { question: 'What does BPM tell a DJ?', options: ['Track loudness', 'Beats per minute', 'File size'], correct: 1, explanation: 'BPM is beats per minute, the tempo used for beatmatching.' };
  if (lower.includes('key') || lower.includes('camelot')) return { question: 'Why does the Camelot Wheel help?', options: ['It sorts songs by file type', 'It finds compatible musical keys', 'It changes speaker volume'], correct: 1, explanation: 'Camelot numbers help choose harmonically compatible tracks.' };
  if (lower.includes('play') || lower.includes('cue')) return { question: 'What is the main purpose of Cue?', options: ['Jump/preview from a prepared point', 'Make a song louder', 'Export a mix'], correct: 0, explanation: 'Cue prepares a repeatable start point for timing entries.' };
  if (lower.includes('hot cue')) return { question: 'Where is a useful hot cue often placed?', options: ['Random silence only', 'A first strong beat or drop', 'Inside the settings menu'], correct: 1, explanation: 'Hot cues work best at musical landmarks.' };
  if (lower.includes('waveform')) return { question: 'What can waveform peaks help you see?', options: ['Strong beats/transients', 'Your account email', 'Internet speed'], correct: 0, explanation: 'Peaks often show kicks, snares, and phrase accents.' };
  if (lower.includes('pitch') || lower.includes('tempo')) return { question: 'What should tempo nudges be during beatmatching?', options: ['Small and controlled', 'Always maximum', 'Never reset'], correct: 0, explanation: 'Small nudges keep the mix natural.' };
  if (lower.includes('crossfader')) return { question: 'What does the crossfader blend?', options: ['Deck A and Deck B', 'Two browser tabs', 'Two login accounts'], correct: 0, explanation: 'The crossfader controls the balance between the decks.' };
  if (lower.includes('volume') || lower.includes('gain')) return { question: 'Why leave headroom in volume?', options: ['To avoid clipping/distortion', 'To hide the waveform', 'To disable sync'], correct: 0, explanation: 'Headroom prevents distortion when both tracks and FX combine.' };
  if (lower.includes('eq') || lower.includes('bass')) return { question: 'During a bass swap, what should you avoid?', options: ['Both lows full at once', 'Using headphones', 'Matching phrases'], correct: 0, explanation: 'Two full basslines can muddy or clip the mix.' };
  if (lower.includes('filter')) return { question: 'A high-pass filter mainly removes what?', options: ['Low frequencies', 'Track names', 'Cue points'], correct: 0, explanation: 'High-pass lets highs pass and cuts lows.' };
  if (lower.includes('loop')) return { question: 'Why use a loop?', options: ['Extend a phrase or build tension', 'Delete the track', 'Change account settings'], correct: 0, explanation: 'Loops buy time and create repeatable musical sections.' };
  if (lower.includes('fx') || lower.includes('echo') || lower.includes('flanger')) return { question: 'When is echo commonly used?', options: ['At phrase endings/transitions', 'Before loading any audio', 'To change email login'], correct: 0, explanation: 'Echo tails help exit or transition cleanly.' };
  if (lower.includes('crowd') || lower.includes('energy')) return { question: 'What should crowd reading guide?', options: ['Energy and track choice', 'Password length', 'Browser zoom'], correct: 0, explanation: 'Crowd response helps decide whether to raise, hold, or release energy.' };
  if (lower.includes('set') || lower.includes('track selection')) return { question: 'A good DJ set should usually have what?', options: ['Intentional energy flow', 'Only one track forever', 'No transitions'], correct: 0, explanation: 'Set building is about flow, contrast, and timing.' };
  if (lower.includes('ai')) return { question: 'How should AI DJ advice be used?', options: ['As guidance you verify by listening', 'As a replacement for hearing', 'Only for login'], correct: 0, explanation: 'AI can suggest, but your ears decide.' };
  return { question: 'What matters most when learning this step?', options: ['Timing and listening', 'Ignoring the deck', 'Changing unrelated settings'], correct: 0, explanation: 'DJing improves through listening, timing, and repeatable practice.' };
}

export default function LearnerPanel() {
  const [tab, setTab]               = useState<Tab>('lessons');
  const [openModule, setOpenModule] = useState<number | null>(2);
  const [videoFilter, setVideoFilter] = useState<VideoFilter>('All');
  const [playingVideo, setPlayingVideo] = useState<string | null>(null);
  const [openButton, setOpenButton] = useState<number | null>(null);
  const [progress, setProgress] = useState<ProgressState>(() => initialProgress());
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [embedOrigin, setEmbedOrigin] = useState('');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(PROGRESS_KEY);
      if (saved) setProgress({ ...initialProgress(), ...JSON.parse(saved) });
    } catch {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress)); } catch {}
  }, [progress]);

  useEffect(() => {
    setEmbedOrigin(window.location.origin);
  }, []);

  const filteredVideos = videoFilter === 'All'
    ? VIDEOS
    : VIDEOS.filter(v => v.level === videoFilter);

  const moduleComplete = (id: number) => {
    const module = MODULES.find(m => m.id === id);
    const steps = progress[id] ?? [];
    return Boolean(module && steps.length === module.steps.length && steps.every(Boolean));
  };
  const completedSteps = MODULES.reduce((sum, mod) => sum + (progress[mod.id] ?? []).filter(Boolean).length, 0);
  const totalSteps = MODULES.reduce((sum, mod) => sum + mod.steps.length, 0);
  const completedModules = MODULES.filter(m => moduleComplete(m.id)).length;
  const progressPct = Math.round((completedSteps / totalSteps) * 100);

  const answerStep = (moduleId: number, stepIndex: number, answer: number, correct: number) => {
    const key = `${moduleId}-${stepIndex}`;
    setAnswers(current => ({ ...current, [key]: answer }));
    if (answer !== correct) return;
    setProgress(current => {
      const next = { ...current, [moduleId]: [...(current[moduleId] ?? [])] };
      next[moduleId][stepIndex] = true;
      return next;
    });
  };

  const startLesson = (moduleId: number) => {
    setOpenModule(moduleId);
    if (!moduleComplete(moduleId)) return;
    setProgress(current => ({ ...current, [moduleId]: MODULES.find(m => m.id === moduleId)?.steps.map(() => false) ?? [] }));
    setAnswers(current => Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith(`${moduleId}-`))));
  };

  return (
    <div className="learner-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* ── Header ── */}
      <div className="learner-header">
        <span style={{ fontSize: '0.9rem' }}>🎓</span>
        <span className="learner-title">DJ LEARN</span>
        <span style={{ fontSize: '0.7rem', color: 'var(--muted)', marginLeft: 'auto' }}>
          {completedModules}/{MODULES.length} complete
        </span>
      </div>

      {/* ── Tab bar ── */}
      <div className="learner-tabs">
        {(['lessons', 'videos', 'deck'] as Tab[]).map(t => (
          <button
            key={t}
            className={`learner-tab${tab === t ? ' active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'lessons' ? '📚 Lessons' : t === 'videos' ? '▶ Videos' : '🎛 Deck Guide'}
          </button>
        ))}
      </div>

      {/* ══════ LESSONS TAB ══════ */}
      {tab === 'lessons' && (
        <div className="learner-content">
          {/* Progress bar */}
          <div className="learner-progress">
            <div className="learner-progress-label">
              <span>Your Progress</span>
              <span style={{ fontWeight: 700, color: 'var(--text)' }}>{progressPct}%</span>
            </div>
            <div className="learner-progress-bar">
              <div className="learner-progress-fill" style={{ width: `${progressPct}%` }} />
            </div>
          </div>

          {/* Pro tip */}
          <div className="learner-tip">
            <div className="learner-tip-head">💡 Pro Tip</div>
            Mix tracks within 2 semitones of each other on the Camelot wheel for a
            harmonically pleasing blend — even if the BPMs differ by a few.
          </div>

          {/* Modules grouped by level */}
          {(['Beginner', 'Intermediate', 'Pro'] as const).map(level => (
            <div key={level}>
              <div className="learner-level-badge" style={{ background: LEVEL_COLOR[level] }}>
                {level === 'Beginner' ? '🟢' : level === 'Intermediate' ? '🟠' : '🟣'} {level}
              </div>
              {MODULES.filter(m => m.level === level).map(mod => (
                <div
                  key={mod.id}
                  className={`learner-module${openModule === mod.id ? ' active' : ''}${moduleComplete(mod.id) ? ' done' : ''}`}
                  onClick={() => setOpenModule(v => v === mod.id ? null : mod.id)}
                  style={{ marginBottom: '0.4rem' }}
                >
                  <div className="learner-module-head">
                    <div className="learner-module-num">{moduleComplete(mod.id) ? '✓' : mod.id}</div>
                    <div className="learner-module-title">{mod.title}</div>
                    <div className="learner-module-dur">{mod.duration}</div>
                  </div>

                  {openModule === mod.id && (
                    <div className="learner-module-body">
                      <p style={{ margin: '0 0 0.4rem', fontSize: '0.72rem', color: 'var(--text2)' }}>
                        {mod.description}
                      </p>
                      <div className="learner-module-steps">
                        {mod.steps.map((step, i) => (
                          <div key={i} className={`learner-step learner-quiz-step${progress[mod.id]?.[i] ? ' done' : ''}`} onClick={e => e.stopPropagation()}>
                            {progress[mod.id]?.[i]
                              ? <span className="learner-step-check">✓</span>
                              : <span className="learner-step-num">{i + 1}</span>
                            }
                            <span className="learner-step-copy">
                              <b>{step.label}</b>
                              {(() => {
                                const quiz = quizForStep(step.label);
                                const key = `${mod.id}-${i}`;
                                const chosen = answers[key];
                                return (
                                  <>
                                    <small>{quiz.question}</small>
                                    <span className="learner-quiz-options">
                                      {quiz.options.map((option, optionIndex) => (
                                        <button
                                          key={option}
                                          className={`learner-quiz-option${chosen === optionIndex ? ' selected' : ''}${progress[mod.id]?.[i] && optionIndex === quiz.correct ? ' correct' : ''}`}
                                          onClick={() => answerStep(mod.id, i, optionIndex, quiz.correct)}
                                        >
                                          {option}
                                        </button>
                                      ))}
                                    </span>
                                    {chosen !== undefined && (
                                      <small className={chosen === quiz.correct ? 'learner-quiz-good' : 'learner-quiz-bad'}>
                                        {chosen === quiz.correct ? quiz.explanation : 'Not quite. Try again.'}
                                      </small>
                                    )}
                                  </>
                                );
                              })()}
                            </span>
                            <span className="learner-step-status">{progress[mod.id]?.[i] ? 'Solved' : 'Answer quiz'}</span>
                          </div>
                        ))}
                      </div>
                      <button className="btn-learner-start" style={{ marginTop: '0.6rem' }} onClick={(e) => { e.stopPropagation(); startLesson(mod.id); }}>
                        {moduleComplete(mod.id) ? '↺ Reset Quiz' : 'Answer all questions to solve'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* ══════ VIDEOS TAB ══════ */}
      {tab === 'videos' && (
        <div className="learner-content">
          {/* Filter */}
          <div className="learner-video-filter">
            {(['All', 'Beginner', 'Intermediate', 'Advanced'] as VideoFilter[]).map(f => (
              <button
                key={f}
                className={`learner-filter-btn${videoFilter === f ? ' active' : ''}`}
                onClick={() => { setVideoFilter(f); setPlayingVideo(null); }}
              >
                {f}
              </button>
            ))}
            <span style={{ marginLeft: 'auto', fontSize: '0.65rem', color: 'var(--muted)', alignSelf: 'center' }}>
              {filteredVideos.length} video{filteredVideos.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Video cards */}
          {filteredVideos.map(video => (
            <div key={video.id} className="learner-video-card" style={{ marginBottom: '0.55rem' }}>
              {playingVideo === video.id ? (
                /* ── Active: full iframe embed with close button ── */
                <div className="learner-video-embed-wrap">
                  <ReactPlayer
                    src={youtubeEmbedUrl(video.id)}
                    controls
                    playsInline
                    width="100%"
                    height="100%"
                    style={{ position: 'absolute', inset: 0 }}
                    config={{
                      youtube: {
                        rel: 0,
                        origin: embedOrigin || undefined,
                        referrerpolicy: 'origin-when-cross-origin',
                      },
                    }}
                  />
                  <button
                    className="learner-video-close-btn"
                    onClick={() => setPlayingVideo(null)}
                    title="Close video"
                    aria-label="Close video"
                  >✕</button>
                </div>
              ) : (
                /* ── Thumbnail with play overlay ── */
                <div
                  className="learner-video-thumb"
                  onClick={() => setPlayingVideo(video.id)}
                >
                  <img
                    src={`https://img.youtube.com/vi/${video.id}/hqdefault.jpg`}
                    alt={video.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '6px 6px 0 0' }}
                  />
                  <div className="learner-video-play-overlay">
                    <div className="learner-video-play-btn">▶</div>
                  </div>
                  {video.duration && (
                    <div className="learner-video-dur-badge">{video.duration}</div>
                  )}
                </div>
              )}

              {/* Video info */}
              <div className="learner-video-info">
                <div className="learner-video-title">{video.title}</div>
                <div className="learner-video-meta">
                  <span>{video.channel}</span>
                  <span
                    className="learner-video-level"
                    style={{ color: LEVEL_COLOR[video.level] }}
                  >
                    {video.level}
                  </span>
                </div>
                {video.description && (
                  <div style={{ fontSize: '0.67rem', color: 'var(--text2)', margin: '0.2rem 0 0.3rem', lineHeight: 1.45 }}>
                    {video.description}
                  </div>
                )}
                <div className="learner-video-tags">
                  {video.tags.map(tag => (
                    <span key={tag} className="learner-video-tag">{tag}</span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ══════ DECK GUIDE TAB ══════ */}
      {tab === 'deck' && (
        <div className="learner-content">
          <div className="learner-tip" style={{ marginBottom: '0.5rem' }}>
            <div className="learner-tip-head">🎛 DJ Deck Anatomy</div>
            Click any control below to learn exactly what it does, how it works, and a pro tip for using it in a live set.
          </div>

          {/* Category legend */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginBottom: '0.5rem' }}>
            {Object.entries(CATEGORY_COLOR).map(([cat, color]) => (
              <span key={cat} style={{
                fontSize: '0.6rem', fontWeight: 700, padding: '0.1rem 0.4rem',
                borderRadius: 3, background: color + '22', color, border: `1px solid ${color}55`,
              }}>
                {cat}
              </span>
            ))}
          </div>

          {DECK_BUTTONS.map((btn, i) => (
            <div
              key={i}
              className={`learner-deck-btn-card${openButton === i ? ' open' : ''}`}
              onClick={() => setOpenButton(v => v === i ? null : i)}
              style={{ marginBottom: '0.35rem' }}
            >
              <div className="learner-deck-btn-row">
                <span className="learner-deck-btn-icon">{btn.icon}</span>
                <span className="learner-deck-btn-name">{btn.name}</span>
                <span style={{
                  fontSize: '0.58rem', fontWeight: 700, padding: '0.1rem 0.35rem',
                  borderRadius: 3, background: (CATEGORY_COLOR[btn.category] ?? '#888') + '22',
                  color: CATEGORY_COLOR[btn.category] ?? '#888',
                  border: `1px solid ${(CATEGORY_COLOR[btn.category] ?? '#888')}44`,
                  marginLeft: 'auto',
                  marginRight: '0.4rem',
                }}>
                  {btn.category}
                </span>
                <span className="learner-deck-btn-chevron">{openButton === i ? '▲' : '▼'}</span>
              </div>
              {openButton === i && (
                <div className="learner-deck-btn-desc">
                  {btn.details.map((detail, detailIndex) => <p key={detailIndex}>{detail}</p>)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
