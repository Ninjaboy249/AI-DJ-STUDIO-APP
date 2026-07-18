import type { MoodProfile } from './emotion';

export default function MusicRecommendation({ profile }: { profile: MoodProfile }) {
  const rows = [
    ['Tempo', `${profile.targetBpm} BPM`], ['Key Match', profile.key], ['Lighting', profile.lighting],
    ['Fog', profile.fog], ['FX', profile.effects.join(' · ')], ['Visualizer', profile.visualizer],
  ];
  return <div className="emotion-recommendation">{rows.map(([label, value]) => <div key={label}><span>{label}</span><b>{value}</b></div>)}</div>;
}

