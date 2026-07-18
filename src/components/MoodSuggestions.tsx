import type { MoodProfile } from './emotion';

export default function MoodSuggestions({ profile }: { profile: MoodProfile }) {
  return (
    <section className="emotion-suggestions">
      <span className="emotion-label">SUGGESTED GENRES</span>
      <div>{profile.genres.map(genre => <b key={genre}>{genre}</b>)}</div>
    </section>
  );
}

