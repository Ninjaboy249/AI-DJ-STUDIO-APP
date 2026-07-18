import MoodSuggestions from './MoodSuggestions';
import MusicRecommendation from './MusicRecommendation';
import { MOOD_PROFILES, type EmotionReading } from './emotion';

export default function EmotionHUD({ reading, status }: { reading: EmotionReading; status: string }) {
  const profile = MOOD_PROFILES[reading.emotion];
  return (
    <>
      <div className="emotion-result">
        <span className="emotion-emoji">{reading.faceDetected ? profile.emoji : '◌'}</span>
        <div><b>{reading.faceDetected ? profile.label : 'Finding face'}</b><small>{reading.faceDetected ? `${reading.confidence}% expression match` : status}</small></div>
      </div>
      <div className="emotion-energy"><span>ENERGY</span><div><i style={{ width: `${reading.energy}%` }} /></div><b>{reading.energy}%</b></div>
      <MoodSuggestions profile={profile} />
      <MusicRecommendation profile={profile} />
    </>
  );
}

