'use client';

import type { ActiveView } from './App';

const DATA: Record<string, { icon: string; title: string; sub: string; cards: Array<[string,string,string]> }> = {
  playlist: { icon:'♫', title:'Music Library', sub:'Curated for your next set', cards:[['My Library','128 tracks','Local and uploaded music'],['AI Playlists','6 mixes','Mood-matched by Granite'],['Favorites','24 tracks','Your highest-energy picks'],['Recent','12 tracks','Recently played']] },
  ai: { icon:'✦', title:'AI DJ Assistant', sub:'IBM Granite-powered performance intelligence', cards:[['Crowd Mood','🔥 Hype · 92%','Live energy analysis'],['Suggested Transition','Future Bass → EDM','Harmonic match · 8A → 9A'],['Recommended Effect','Electric Shockwave','Trigger on the next drop'],['Mix Quality','94 / 100','Excellent phrasing and balance']] },
  beatmaker: { icon:'⬡', title:'Beat Maker', sub:'Build a performance-ready rhythm', cards:[['Kick','4 on the floor','128 BPM'],['Clap','Beats 2 + 4','Velocity 84%'],['Hi-Hat','1/8 pattern','Swing 12%'],['Bassline','F minor','Sidechain enabled']] },
  settings: { icon:'⚙', title:'Studio Settings', sub:'Audio, visuals, voice and performance', cards:[['Audio Engine','Web Audio','48 kHz · Low latency'],['Voice Commands','Listening ready','“Hey BoB, party mode”'],['Visual Quality','Ultra Neon','Bloom + particles'],['Profile','DJ Nova','Personalize avatar']] },
  library: { icon:'◧', title:'Library', sub:'Your complete music collection', cards:[['Tracks','128','Analyzed and ready'],['Crates','8','House · Techno · D&B'],['Cloud Sync','Connected','Last sync just now'],['Storage','1.8 GB','Local audio cache']] },
  aiplists: { icon:'≋', title:'AI Playlists', sub:'Mood-aware selections from Granite', cards:[['Peak Hour','12 tracks','Energy 94%'],['Neon Drive','10 tracks','Synthwave journey'],['Golden Hour','14 tracks','Chill house'],['Auto Mix','Ready','Harmonic transitions']] },
  effects: { icon:'⚡', title:'Effects Lab', sub:'Shape every impact in real time', cards:[['Electric Shockwave','ARMED','Lightning + ripple'],['Echo','1/4 beat','Feedback 38%'],['Reverb','Nightclub','Size 72%'],['Bass Boost','+4 dB','Limiter protected']] },
  visuals: { icon:'◈', title:'Live Visuals', sub:'Audio-reactive environments', cards:[['Electric Mode','ACTIVE','Blue arcs + shockwaves'],['Galaxy Mode','READY','Nebula + starfield'],['Ice Mode','READY','Crystal shards + fog'],['Volcano Mode','READY','Embers + fire cannons']] },
  community: { icon:'◉', title:'Community', sub:'Perform, share and discover', cards:[['Live Rooms','42','1.2K DJs online'],['Your Followers','286','+18 this week'],['Mix Battles','3 open','Enter tonight'],['Trending','Neon Pulse','8.4K plays']] },
};

export default function FeatureDashboard({ view, onBack }: { view: ActiveView | string; onBack: () => void }) {
  const data = DATA[view] ?? DATA.playlist;
  return <section className="feature-dashboard">
    <div className="feature-hero"><button onClick={onBack}>← DJ DECK</button><span>{data.icon}</span><div><h2>{data.title}</h2><p>{data.sub}</p></div></div>
    <div className="feature-grid">{data.cards.map(([title,value,desc]) => <button className="feature-card" key={title}><i>{title}</i><strong>{value}</strong><small>{desc}</small><span>OPEN →</span></button>)}</div>
    <div className="analytics-strip"><div><b>128</b><span>BPM</span></div><div><b>92%</b><span>CROWD ENERGY</span></div><div><b>+4 dB</b><span>BASS</span></div><div><b>94</b><span>MIX QUALITY</span></div></div>
  </section>;
}
