export type Emotion = 'happy' | 'sad' | 'angry' | 'tired' | 'excited' | 'relaxed' | 'surprised';

export interface MoodProfile {
  emotion: Emotion;
  emoji: string;
  label: string;
  genres: string[];
  bpm: string;
  targetBpm: number;
  key: string;
  lighting: string;
  fog: string;
  effects: string[];
  visualizer: string;
  voice: string;
}

export interface EmotionReading {
  emotion: Emotion;
  confidence: number;
  energy: number;
  faceDetected: boolean;
}

export const MOOD_PROFILES: Record<Emotion, MoodProfile> = {
  happy: { emotion: 'happy', emoji: '😊', label: 'Happy', genres: ['Future Bass', 'House', 'EDM'], bpm: '120–128', targetBpm: 126, key: '8A', lighting: 'Yellow + Cyan', fog: 'Medium', effects: ['Bright lasers', 'Confetti on drop'], visualizer: 'Rainbow spectrum', voice: "You look happy today. I've prepared an uplifting Future Bass mix." },
  sad: { emotion: 'sad', emoji: '😢', label: 'Sad', genres: ['Lo-Fi', 'Chill', 'Piano'], bpm: '70–95', targetBpm: 84, key: '6A', lighting: 'Deep Blue', fog: 'Soft', effects: ['Rain particles', 'Ambient glow'], visualizer: 'Slow wave', voice: "I'm sensing a quieter mood. Switching to a gentle Lo-Fi selection." },
  angry: { emotion: 'angry', emoji: '😡', label: 'Angry', genres: ['Dubstep', 'Trap', 'Hardstyle'], bpm: '145–170', targetBpm: 154, key: '2A', lighting: 'Red + White', fog: 'Heavy', effects: ['Electric sparks', 'Fast strobe'], visualizer: 'Heavy bass', voice: "High intensity detected. Loading a powerful Dubstep set." },
  tired: { emotion: 'tired', emoji: '😴', label: 'Tired', genres: ['Ambient', 'Chillstep'], bpm: '60–80', targetBpm: 72, key: '5A', lighting: 'Indigo', fog: 'Light', effects: ['Soft glow', 'Slow beams'], visualizer: 'Ambient drift', voice: "You seem tired. I'll slow things down with an ambient mix." },
  excited: { emotion: 'excited', emoji: '🤩', label: 'Excited', genres: ['Big Room', 'Festival EDM', 'Electro House'], bpm: '128–150', targetBpm: 138, key: '9A', lighting: 'White + Neon', fog: 'Intense', effects: ['Fireworks', 'Intense lasers'], visualizer: 'Festival burst', voice: "You look excited today. I've prepared an energetic House playlist." },
  relaxed: { emotion: 'relaxed', emoji: '😌', label: 'Relaxed', genres: ['Deep House', 'Tropical House'], bpm: '105–118', targetBpm: 112, key: '7A', lighting: 'Aqua + Purple', fog: 'Soft', effects: ['Gentle beams', 'Warm glow'], visualizer: 'Ocean wave', voice: "You seem relaxed. Switching to a Deep House mix." },
  surprised: { emotion: 'surprised', emoji: '😲', label: 'Surprised', genres: ['Progressive House'], bpm: '124–128', targetBpm: 126, key: '10A', lighting: 'Violet + Cyan', fog: 'Medium', effects: ['Laser flash', 'Neon flicker'], visualizer: 'Progressive tunnel', voice: "That surprised energy calls for a Progressive House journey." },
};

