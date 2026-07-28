'use client';

import { useMemo, useState } from 'react';
import type { UseDeck } from '@/lib/useDeck';

type ModuleId = 'studio'|'partner'|'mood'|'story'|'coach'|'visual'|'planner'|'artwork'|'inspiration'|'insights';
type InputValue = string | number | boolean | null;

const MODULES: Array<{ id:ModuleId; icon:string; label:string; hint:string }> = [
  {id:'studio',icon:'✦',label:'Creative Studio',hint:'Concepts, themes and harmonic journeys'},
  {id:'partner',icon:'◉',label:'Creative Partner',hint:'A context-aware DJ collaborator'},
  {id:'mood',icon:'◒',label:'Mood Generator',hint:'Turn a feeling into a complete direction'},
  {id:'story',icon:'⌁',label:'Story Mix',hint:'Build a set with a narrative arc'},
  {id:'coach',icon:'◇',label:'Learning Coach',hint:'Evidence-based feedback from loaded decks'},
  {id:'visual',icon:'◈',label:'Visual Studio',hint:'Audio-reactive stage directions'},
  {id:'planner',icon:'▦',label:'Set Planner',hint:'Plan BPM, keys, transitions and FX'},
  {id:'artwork',icon:'▣',label:'Album & Poster',hint:'Generate and export branded artwork'},
  {id:'inspiration',icon:'⚡',label:'Inspiration Board',hint:'Fresh prompts and practical challenges'},
  {id:'insights',icon:'⌁',label:'Performance Insights',hint:'Analyze available performance evidence'},
];
const STORY = ['Introduction','Warm Up','Energy Build','Peak Time','Emotional Moment','Final Drop','Outro'];
const ART_TYPES: Record<string,{ratio:string;width:number;height:number}> = {
  'Album Cover':{ratio:'1:1',width:1200,height:1200}, 'Event Poster':{ratio:'4:5',width:1080,height:1350},
  'Social Banner':{ratio:'1.91:1',width:1200,height:628}, 'YouTube Thumbnail':{ratio:'16:9',width:1280,height:720},
  'Playlist Artwork':{ratio:'1:1',width:1000,height:1000},
};

function deckEvidence(deck: UseDeck, name: string): Record<string,InputValue> {
  const track = deck.state.track;
  return {
    deck:name, loaded:Boolean(track), track:track?.name ?? 'none', playing:deck.state.playing,
    bpm:track?.analysis.tempoBpm ?? Math.round(deck.state.tempo * 128), position:Number(deck.position.toFixed(3)),
    volume:deck.state.volume, lowEq:deck.state.eqLow, midEq:deck.state.eqMid, highEq:deck.state.eqHigh,
    filter:deck.state.filterCutoff, echo:deck.state.echo, reverb:deck.state.reverb, looping:deck.state.looping,
  };
}

async function generateCreative(module:ModuleId,input:Record<string,InputValue>) {
  const response = await fetch('/api/ai/creative',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({module,input})});
  const data = await response.json() as {result?:string;error?:string};
  if(!response.ok || !data.result) throw new Error(data.error || 'Creative generation failed.');
  return data.result;
}

function Field({label,value,onChange,placeholder}:{label:string;value:string;onChange:(v:string)=>void;placeholder?:string}) {
  return <label className="creative-field"><span>{label}</span><input value={value} placeholder={placeholder} onChange={e=>onChange(e.target.value)}/></label>;
}
function Result({loading,error,text}:{loading:boolean;error:string;text:string}) {
  return <div className={`creative-result${loading?' loading':''}`} aria-live="polite">
    <div className="creative-result-head"><span className="granite-dot"/> IBM GRANITE <em>{loading?'ANALYZING':text?'RESULT READY':'AWAITING INPUT'}</em></div>
    {loading?<div className="creative-loader"><i/><i/><i/></div>:error?<p className="creative-error">{error}</p>:<p>{text||'Complete the inputs above, then generate a result.'}</p>}
  </div>;
}
function Analytics({values}:{values:number[]}) {
  return <div className="creative-chart" aria-label="Deck evidence chart">{values.map((v,i)=><i key={i} style={{height:`${Math.max(5,Math.min(100,v))}%`}}><span>{v}</span></i>)}</div>;
}

export default function CreativeSuite({onBack,deckA,deckB}:{onBack:()=>void;deckA:UseDeck;deckB:UseDeck}) {
  const [active,setActive]=useState<ModuleId>('studio');
  const [prompt,setPrompt]=useState('A futuristic rooftop set at sunset');
  const [event,setEvent]=useState('Festival'); const [duration,setDuration]=useState('90 minutes');
  const [audience,setAudience]=useState('Mixed, energetic crowd'); const [genres,setGenres]=useState('House, techno, melodic');
  const [energy,setEnergy]=useState('Build from 4 to 10'); const [style,setStyle]=useState('Cyberpunk');
  const [artType,setArtType]=useState('Album Cover'); const [output,setOutput]=useState('');
  const [loading,setLoading]=useState(false); const [error,setError]=useState('');
  const selected=useMemo(()=>MODULES.find(x=>x.id===active)!,[active]);
  const evidence=useMemo(()=>({deckA:deckEvidence(deckA,'A'),deckB:deckEvidence(deckB,'B')}),[deckA,deckB]);
  const hasTrack=Boolean(deckA.state.track||deckB.state.track);
  const bpms=[deckA.state.track?.analysis.tempoBpm,deckB.state.track?.analysis.tempoBpm].filter((x):x is number=>Boolean(x));
  const evidenceBars=[deckA.state.volume*100,deckB.state.volume*100,(deckA.state.eqLow+12)/24*100,(deckB.state.eqLow+12)/24*100,deckA.position*100,deckB.position*100];

  const run=async(extra:Record<string,InputValue>={})=>{
    setLoading(true); setError(''); setOutput('');
    try { setOutput(await generateCreative(active,{brief:prompt,event,duration,audience,genres,energy,visualStyle:style,...extra})); }
    catch(e){setError(e instanceof Error?e.message:'Generation failed.');} finally{setLoading(false);}
  };
  const analyze=async()=>{
    if(!hasTrack){setError('Load at least one track before running deck-based analysis.');setOutput('');return;}
    await run({deckEvidence:JSON.stringify(evidence),crossDeckBpmDifference:bpms.length===2?Math.abs(bpms[0]-bpms[1]):null,limitation:'No audience sensor or recorded transition history is available; label all such conclusions as unavailable or inferred.'});
  };
  const switchModule=(id:ModuleId)=>{setActive(id);setOutput('');setError('');};

  const artwork=ART_TYPES[artType];
  const downloadArtwork=()=>{
    const title=(prompt.trim()||'AI DJ STUDIO').split(' ').slice(0,5).join(' ').toUpperCase();
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${artwork.width}" height="${artwork.height}" viewBox="0 0 ${artwork.width} ${artwork.height}"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#07111f"/><stop offset=".48" stop-color="#5b21b6"/><stop offset="1" stop-color="#00e5ff"/></linearGradient><filter id="b"><feGaussianBlur stdDeviation="24"/></filter></defs><rect width="100%" height="100%" fill="url(#g)"/><circle cx="72%" cy="35%" r="22%" fill="none" stroke="#e040fb" stroke-width="18" opacity=".75"/><circle cx="72%" cy="35%" r="8%" fill="#00e5ff" filter="url(#b)"/><path d="M0 ${artwork.height*.72} Q ${artwork.width*.25} ${artwork.height*.55} ${artwork.width*.5} ${artwork.height*.72} T ${artwork.width} ${artwork.height*.65}" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="8"/><text x="7%" y="12%" fill="#00e5ff" font-family="Arial" font-size="${Math.round(artwork.width*.025)}" letter-spacing="8">AI DJ STUDIO</text><text x="7%" y="72%" fill="white" font-family="Arial" font-weight="900" font-size="${Math.round(artwork.width*.072)}">${title.replace(/[&<>]/g,'')}</text><text x="7%" y="79%" fill="#d8c9ff" font-family="Arial" font-size="${Math.round(artwork.width*.022)}" letter-spacing="5">${style.toUpperCase()} · ${artType.toUpperCase()}</text></svg>`;
    const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'})); const a=document.createElement('a');a.href=url;a.download=`ai-dj-${artType.toLowerCase().replaceAll(' ','-')}.svg`;a.click();URL.revokeObjectURL(url);
  };

  return <section className="creative-suite">
    <header className="creative-hero"><button onClick={onBack}>← DJ DECK</button><div><span className="creative-eyebrow">AI CREATIVE INDUSTRIES · POWERED BY IBM GRANITE</span><h2>Turn imagination into a performance.</h2><p>Every Granite module uses its own domain instructions and real inputs.</p></div><div className="creative-orb" aria-hidden="true"><i/><b>IBM</b></div></header>
    <div className="creative-layout">
      <nav className="creative-module-nav" aria-label="Creative modules">{MODULES.map(x=><button key={x.id} className={active===x.id?'active':''} onClick={()=>switchModule(x.id)}><span>{x.icon}</span><div><b>{x.label}</b><small>{x.hint}</small></div></button>)}</nav>
      <main className="creative-workspace">
        <div className="creative-title"><span>{selected.icon}</span><div><h3>AI {selected.label}</h3><p>{selected.hint}</p></div><b>GRANITE READY</b></div>

        {(active==='studio'||active==='partner'||active==='mood')&&<><div className="creative-prompt-wrap"><textarea value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder={active==='partner'?'Ask for a transition, next-song role, intro or energy change…':'Describe the mood, event or concept…'}/><button onClick={()=>void run({task:active==='studio'?'Develop a full creative concept':active==='mood'?'Translate this mood into a performance':'Collaborate on this specific DJ problem'})} disabled={loading||!prompt.trim()}>{loading?'WORKING…':active==='partner'?'COLLABORATE':'GENERATE'} ✦</button></div><div className="creative-chips">{['Beach Party','Night Drive','Cyberpunk Festival','Sunset Playlist','Club Intro','Make my mix more energetic'].map(x=><button key={x} onClick={()=>setPrompt(x)}>{x}</button>)}</div></>}

        {active==='story'&&<><div className="creative-prompt-wrap"><textarea value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="Describe the story, emotion and audience…"/><button onClick={()=>void run({requiredActs:STORY.join(', ')})} disabled={loading||!prompt.trim()}>BUILD STORY ✦</button></div><div className="story-timeline">{STORY.map((x,i)=><div key={x}><i>{String(i+1).padStart(2,'0')}</i><span><b>{x}</b><small>AI supplies timing, BPM, key, role and transitions</small></span></div>)}</div></>}

        {active==='planner'&&<div className="creative-form-grid"><Field label="Event type" value={event} onChange={setEvent}/><Field label="Duration" value={duration} onChange={setDuration}/><Field label="Audience" value={audience} onChange={setAudience}/><Field label="Preferred genres" value={genres} onChange={setGenres}/><Field label="Energy progression" value={energy} onChange={setEnergy}/><button className="creative-primary" onClick={()=>void run({task:'Produce a timed, complete set plan'})} disabled={loading||![event,duration,audience,genres,energy].every(x=>x.trim())}>BUILD COMPLETE SET ✦</button></div>}

        {active==='visual'&&<><div className="visual-presets">{['Neon','Galaxy','Cyberpunk','Abstract','Liquid','Space','Futuristic','Festival Lights'].map(x=><button key={x} className={style===x?'active':''} onClick={()=>setStyle(x)}><i className={`visual-swatch swatch-${x.toLowerCase().replace(' ','-')}`}/><b>{x}</b><small>Select visual system</small></button>)}</div><div className="visual-stage"><i/><i/><i/><div><span>SELECTED REACTIVE SYSTEM</span><b>{style.toUpperCase()}</b></div></div><button className="creative-primary" onClick={()=>void run({task:'Design mappings for bass, mids, treble, beats and energy'})} disabled={loading}>GENERATE WORKING VISUAL SPEC ✦</button></>}

        {active==='artwork'&&<><div className="artwork-types">{Object.keys(ART_TYPES).map(x=><button key={x} className={artType===x?'active':''} onClick={()=>setArtType(x)}>{x} · {ART_TYPES[x].ratio}</button>)}</div><div className="creative-prompt-wrap"><textarea value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="Artwork title and creative direction…"/><button onClick={()=>void run({assetType:artType,aspectRatio:artwork.ratio,exportSize:`${artwork.width}x${artwork.height}`,task:'Create an art-direction and image-generation brief'})} disabled={loading||!prompt.trim()}>GENERATE BRIEF ✦</button></div><div className="artwork-preview" style={{aspectRatio:artwork.ratio.replace(':',' / ')}}><div><span>AI DJ STUDIO</span><strong>{prompt.split(' ').slice(0,4).join(' ')||'UNTITLED'}</strong><small>{artType} · {artwork.width}×{artwork.height} · {style}</small></div></div><button className="creative-primary" onClick={downloadArtwork}>DOWNLOAD EDITABLE SVG</button></>}

        {(active==='coach'||active==='insights')&&<><div className="insight-head"><div><b>{hasTrack?bpms[0]??'—':'—'}</b><span>DECK A BPM</span></div><div><b>{hasTrack?bpms[1]??'—':'—'}</b><span>DECK B BPM</span></div><div><b>{bpms.length===2?Math.abs(bpms[0]-bpms[1]).toFixed(1):'—'}</b><span>BPM DIFFERENCE</span></div></div><Analytics values={evidenceBars}/><div className="chart-labels"><span>A VOLUME</span><span>B VOLUME</span><span>A LOW EQ</span><span>B LOW EQ</span><span>A POSITION</span><span>B POSITION</span></div><button className="creative-primary" onClick={()=>void analyze()} disabled={loading||!hasTrack}>{hasTrack?(active==='coach'?'ANALYZE LOADED DECKS ✦':'GENERATE EVIDENCE REPORT ✦'):'LOAD A TRACK TO ANALYZE'}</button></>}

        {active==='inspiration'&&<><div className="creative-form-grid"><Field label="Genres" value={genres} onChange={setGenres}/><Field label="Event or context" value={event} onChange={setEvent}/></div><div className="inspiration-grid">{[['STYLE DIRECTIONS','Explore genre-adjacent ideas'],['TRANSITION LAB','Create practical experiments'],['REMIX EXERCISES','Build production prompts'],['STAGE CONCEPTS','Connect sound and performance'],['DJ PRACTICE','Improve one measurable skill'],['DAILY CHALLENGE','Set a constrained creative task']].map(([title,desc])=><article key={title}><i>GENERATED ON REQUEST</i><b>{title}</b><p>{desc}</p><button onClick={()=>void run({boardSection:title,task:`Generate only the ${title} section`})}>GENERATE →</button></article>)}</div><button className="creative-primary" onClick={()=>void run({task:'Generate the complete inspiration board; do not claim live trend access'})} disabled={loading||!genres.trim()}>GENERATE COMPLETE BOARD ✦</button></>}

        <Result loading={loading} error={error} text={output}/>
      </main>
    </div>
  </section>;
}
