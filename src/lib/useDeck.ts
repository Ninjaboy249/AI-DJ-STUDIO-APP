// useDeck — React state + transport for a single deck.
//
// Owns the reducer-backed DeckState (the serializable transport + mixer controls) plus
// two pieces of live, high-rate state that must NOT live in the reducer (they update
// ~30x/sec and would otherwise trigger graph re-renders): the playhead position and
// the meter level. Both arrive asynchronously from the audio graph's analysis events.

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { getRuntime, nativeDeckPosition, registerNativeDeck, seekNativeDeck, toggleNativeDeck, updateNativeDeck } from './audio';
import { loadTrackToVFS } from './track';
import {
  DeckState,
  initialDeckState,
  METER_EVENT_SUFFIX,
  POS_EVENT_SUFFIX,
} from './deck';

type EqBand = 'eqLow' | 'eqMid' | 'eqHigh';

type Action =
  | { type: 'LOAD'; track: DeckState['track'] }
  | { type: 'PLAY' }
  | { type: 'PAUSE' }
  | { type: 'SEEK'; norm: number }
  | { type: 'END' }
  | { type: 'SET_VOLUME'; value: number }
  | { type: 'SET_EQ'; band: EqBand; value: number }
  | { type: 'SET_FILTER'; value: number }
  | { type: 'SET_TEMPO'; value: number }
  | { type: 'SET_CUE'; norm: number }
  | { type: 'JUMP_CUE' }
  | { type: 'SET_LOOP_IN'; norm: number }
  | { type: 'SET_LOOP_OUT'; norm: number }
  | { type: 'TOGGLE_LOOP'; currentNorm: number };

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

function reducer(s: DeckState, a: Action): DeckState {
  switch (a.type) {
    case 'LOAD':
      // New track: stop, rewind, and bump seekGen so the transport accumulator resets.
      return { ...s, track: a.track, playing: false, baseNorm: 0, seekGen: s.seekGen + 1, tempo: 1, cueNorm: 0, loopIn: 0, loopOut: 1, looping: false };
    case 'PLAY':
      return s.track ? { ...s, playing: true } : s;
    case 'PAUSE':
      return { ...s, playing: false };
    case 'SEEK':
      return s.track ? { ...s, baseNorm: clamp01(a.norm), seekGen: s.seekGen + 1 } : s;
    case 'END':
      // Reached the end: stop and rewind to the start.
      return { ...s, playing: false, baseNorm: 0, seekGen: s.seekGen + 1 };
    case 'SET_VOLUME':
      return { ...s, volume: clamp01(a.value) };
    case 'SET_EQ':
      return { ...s, [a.band]: a.value };
    case 'SET_FILTER':
      return { ...s, filterCutoff: Math.max(-1, Math.min(1, a.value)) };
    case 'SET_TEMPO':
      return { ...s, tempo: Math.max(0.5, Math.min(2.0, a.value)) };
    case 'SET_CUE':
      return { ...s, cueNorm: clamp01(a.norm) };
    case 'JUMP_CUE':
      return s.track ? { ...s, baseNorm: s.cueNorm, seekGen: s.seekGen + 1 } : s;
    case 'SET_LOOP_IN':
      return { ...s, loopIn: clamp01(a.norm) };
    case 'SET_LOOP_OUT':
      return { ...s, loopOut: clamp01(a.norm) };
    case 'TOGGLE_LOOP':
      if (s.looping) {
        // Exit loop: re-base the transport at the current playhead so it continues forward.
        return { ...s, looping: false, baseNorm: clamp01(a.currentNorm), seekGen: s.seekGen + 1 };
      }
      return s.track ? { ...s, looping: true } : s;
    default:
      return s;
  }
}

export interface UseDeck {
  state: DeckState;
  position: number; // live normalized playhead 0..1
  level: number; // live meter level 0..1
  load: (file: File) => Promise<void>;
  togglePlay: () => void;
  seek: (norm: number) => void;
  setVolume: (value: number) => void;
  setEq: (band: EqBand, value: number) => void;
  setFilter: (value: number) => void;
  setTempo: (value: number) => void;
  setCue: (norm: number) => void;
  jumpCue: () => void;
  setLoopIn: (norm: number) => void;
  setLoopOut: (norm: number) => void;
  toggleLoop: () => void;
}

export function useDeck(id: string, audioReady: boolean): UseDeck {
  const [state, dispatch] = useReducer(reducer, id, initialDeckState);
  const [position, setPosition] = useState(0);
  const [level, setLevel] = useState(0);
  const pendingPositionRef = useRef<number | null>(null);
  const pendingLevelRef = useRef<number | null>(null);
  const lastPositionRef = useRef(0);
  const lastLevelRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  // Ref so the snapshot handler reads current `playing` without re-subscribing.
  const playingRef = useRef(state.playing);
  playingRef.current = state.playing;

  const flushUi = useCallback(() => {
    const nextPosition = pendingPositionRef.current;
    const nextLevel = pendingLevelRef.current;

    if (nextPosition !== null) {
      lastPositionRef.current = nextPosition;
      setPosition(nextPosition);
      pendingPositionRef.current = null;
    }

    if (nextLevel !== null) {
      lastLevelRef.current = nextLevel;
      setLevel(nextLevel);
      pendingLevelRef.current = null;
    }

    rafRef.current = null;
  }, []);

  // Route this deck's analysis events (playhead + meter) into local state.
  useEffect(() => {
    if (!audioReady) return;
    const rt = getRuntime();
    if (!rt) return;

    const posSource = `${id}${POS_EVENT_SUFFIX}`;
    const meterSource = `${id}${METER_EVENT_SUFFIX}`;

    const onSnapshot = (e: { source?: string; data: number }) => {
      if (e.source !== posSource) return;
      const p = clamp01(e.data);
      if (Math.abs(p - lastPositionRef.current) > 0.0015 || p >= 0.9999) {
        pendingPositionRef.current = p;
        if (rafRef.current === null) {
          rafRef.current = window.requestAnimationFrame(flushUi);
        }
      }
      if (p >= 0.9999 && playingRef.current) dispatch({ type: 'END' });
    };

    const onMeter = (e: { source?: string; min: number; max: number }) => {
      if (e.source !== meterSource) return;
      const nextLevel = clamp01(Math.max(Math.abs(e.min), Math.abs(e.max)));
      if (Math.abs(nextLevel - lastLevelRef.current) > 0.02) {
        pendingLevelRef.current = nextLevel;
        if (rafRef.current === null) {
          rafRef.current = window.requestAnimationFrame(flushUi);
        }
      }
    };

    rt.core.on('snapshot', onSnapshot);
    rt.core.on('meter', onMeter);
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      rt.core.off('snapshot', onSnapshot);
      rt.core.off('meter', onMeter);
    };
  }, [id, audioReady, flushUi]);

  const load = useCallback(
    async (file: File) => {
      const rt = getRuntime();
      if (!rt) throw new Error('Audio engine is not ready. Click Load Track again.');
      const track = await loadTrackToVFS(rt, id, file);
      registerNativeDeck(id, track.nativeBuffer);
      setPosition(0);
      dispatch({ type: 'LOAD', track });
    },
    [id],
  );

  const togglePlay = useCallback(() => {
    void toggleNativeDeck(id).then(playing => dispatch(playing ? { type: 'PLAY' } : { type: 'PAUSE' }));
  }, [id]);

  const seek = useCallback((norm: number) => {
    setPosition(clamp01(norm));
    seekNativeDeck(id, norm);
    dispatch({ type: 'SEEK', norm });
  }, [id]);

  const setVolume = useCallback((value: number) => { updateNativeDeck(id, value, state.tempo); dispatch({ type: 'SET_VOLUME', value }); }, [id, state.tempo]);
  const setEq = useCallback((band: EqBand, value: number) => dispatch({ type: 'SET_EQ', band, value }), []);
  const setFilter = useCallback((value: number) => dispatch({ type: 'SET_FILTER', value }), []);
  const setTempo = useCallback((value: number) => { updateNativeDeck(id, state.volume, value); dispatch({ type: 'SET_TEMPO', value }); }, [id, state.volume]);

  useEffect(() => {
    if (!state.playing) return;
    let frame = 0;
    const poll = () => {
      const p = nativeDeckPosition(id); setPosition(p);
      if (p >= 0.999) dispatch({ type: 'END' }); else frame = requestAnimationFrame(poll);
    };
    frame = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(frame);
  }, [id, state.playing]);
  const setCue = useCallback((norm: number) => dispatch({ type: 'SET_CUE', norm }), []);
  const jumpCue = useCallback(() => dispatch({ type: 'JUMP_CUE' }), []);

  // positionRef lets toggleLoop capture the live playhead without a stale closure.
  const positionRef = useRef(0);
  positionRef.current = position;

  const setLoopIn = useCallback((norm: number) => dispatch({ type: 'SET_LOOP_IN', norm }), []);
  const setLoopOut = useCallback((norm: number) => dispatch({ type: 'SET_LOOP_OUT', norm }), []);
  const toggleLoop = useCallback(
    () => dispatch({ type: 'TOGGLE_LOOP', currentNorm: positionRef.current }),
    [],
  );

  return useMemo(() => ({
    state,
    position,
    level,
    load,
    togglePlay,
    seek,
    setVolume,
    setEq,
    setFilter,
    setTempo,
    setCue,
    jumpCue,
    setLoopIn,
    setLoopOut,
    toggleLoop,
  }), [state, position, level, load, togglePlay, seek, setVolume, setEq, setFilter, setTempo, setCue, jumpCue, setLoopIn, setLoopOut, toggleLoop]);
}
