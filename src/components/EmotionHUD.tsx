import MoodSuggestions from './MoodSuggestions';
import MusicRecommendation from './MusicRecommendation';
import { MOOD_PROFILES, type EmotionReading } from './emotion';
import type { UseDeck } from '@/lib/useDeck';

export default function EmotionHUD({ reading, status, deckA, deckB, ensureAudio }: { reading: EmotionReading; status: string; deckA: UseDeck; deckB: UseDeck; ensureAudio: () => Promise<void> }) {
  const profile = MOOD_PROFILES[reading.emotion];
  return (
    <>
      <div className="emotion-result">
        <span className="emotion-emoji">{reading.faceDetected ? profile.emoji : '◌'}</span>
        <div><b>{reading.faceDetected ? profile.label : 'Finding face'}</b><small>{reading.faceDetected ? `${reading.confidence}% expression match` : status}</small></div>
      </div>
      <div className="emotion-energy"><span>ENERGY</span><div><i style={{ width: `${reading.energy}%` }} /></div><b>{reading.energy}%</b></div>
      <MoodSuggestions profile={profile} />
      <MusicRecommendation profile={profile} active={reading.faceDetected} deckA={deckA} deckB={deckB} ensureAudio={ensureAudio} />
    </>
  );
}
