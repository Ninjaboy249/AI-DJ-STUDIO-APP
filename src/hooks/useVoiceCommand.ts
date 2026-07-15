// useVoiceCommand.ts — Web Speech API recognition hook.
//
// Wraps the browser's SpeechRecognition API with a clean React interface.
// Manages the listening lifecycle (start / stop / interim / final transcript)
// and exposes whether the browser supports speech recognition at all.
//
// Usage:
//   const { supported, listening, transcript, interimTranscript,
//           start, stop, error } = useVoiceCommand({ onFinal });

import { useCallback, useEffect, useRef, useState } from 'react';

// ── Browser type shim ─────────────────────────────────────────────────────────
// SpeechRecognition is not yet in the standard TS lib — declare the minimal
// surface we use so we don't need a separate @types package.

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult:  ((e: SpeechRecognitionEvent) => void) | null;
  onerror:   ((e: Event & { error: string }) => void) | null;
  onend:     (() => void) | null;
  onstart:   (() => void) | null;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  return (
    (window as unknown as { SpeechRecognition?: SpeechRecognitionCtor }).SpeechRecognition ??
    (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionCtor }).webkitSpeechRecognition ??
    null
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface UseVoiceCommandOptions {
  /** Called with the final recognised transcript string */
  onFinal: (transcript: string) => void;
  /** BCP 47 language tag, defaults to 'en-US' */
  lang?: string;
}

export interface UseVoiceCommandReturn {
  supported: boolean;
  listening: boolean;
  transcript: string;        // confirmed final transcript
  interimTranscript: string; // live interim text while speaking
  error: string | null;
  start: () => void;
  stop: () => void;
}

export function useVoiceCommand({
  onFinal,
  lang = 'en-US',
}: UseVoiceCommandOptions): UseVoiceCommandReturn {
  const SpeechRecognition = getSpeechRecognition();
  const supported = SpeechRecognition !== null;

  const [listening, setListening]             = useState(false);
  const [transcript, setTranscript]           = useState('');
  const [interimTranscript, setInterimText]   = useState('');
  const [error, setError]                     = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const onFinalRef     = useRef(onFinal);
  onFinalRef.current   = onFinal;

  // Lazily create (or re-create) the recognition instance
  const getRecognition = useCallback((): SpeechRecognitionInstance | null => {
    if (!SpeechRecognition) return null;
    if (recognitionRef.current) return recognitionRef.current;

    const rec = new SpeechRecognition();
    rec.continuous      = false; // single utterance per button press
    rec.interimResults  = true;
    rec.lang            = lang;
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      setListening(true);
      setError(null);
      setInterimText('');
    };

    rec.onresult = (e: SpeechRecognitionEvent) => {
      let interim = '';
      let final   = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) {
          final += r[0].transcript;
        } else {
          interim += r[0].transcript;
        }
      }
      setInterimText(interim);
      if (final) {
        const trimmed = final.trim();
        setTranscript(trimmed);
        setInterimText('');
        onFinalRef.current(trimmed);
      }
    };

    rec.onerror = (e) => {
      // 'no-speech' is benign — user just didn't say anything
      if (e.error !== 'no-speech') setError(`Voice error: ${e.error}`);
      setListening(false);
    };

    rec.onend = () => {
      setListening(false);
      setInterimText('');
      // Nullify so the next press re-creates a fresh instance (avoids
      // InvalidStateError on some browsers when calling start() on an ended instance)
      recognitionRef.current = null;
    };

    recognitionRef.current = rec;
    return rec;
  }, [SpeechRecognition, lang]);

  const start = useCallback(() => {
    if (!supported || listening) return;
    const rec = getRecognition();
    if (!rec) return;
    try {
      rec.start();
    } catch {
      // Might already be started; ignore
    }
  }, [supported, listening, getRecognition]);

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }
    setListening(false);
  }, []);

  // Abort on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  return { supported, listening, transcript, interimTranscript, error, start, stop };
}
