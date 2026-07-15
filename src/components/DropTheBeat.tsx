'use client';
import { useEffect, useState } from 'react';

export default function DropTheBeat({ enabled, onDrop }: { enabled:boolean; onDrop:()=>Promise<void> }) {
  const [phase,setPhase]=useState<'idle'|'countdown'|'impact'|'live'>('idle');
  const [count,setCount]=useState(3);
  useEffect(()=>{ if(phase!=='countdown') return; if(count===0){ setPhase('impact'); void onDrop();
    if('speechSynthesis' in window){ speechSynthesis.cancel(); const voice=new SpeechSynthesisUtterance("Welcome to AI DJ Studio. Let's create something unforgettable."); voice.rate=.92; voice.pitch=.86; speechSynthesis.speak(voice); }
    const done=window.setTimeout(()=>setPhase('live'),1500); return()=>clearTimeout(done);
  } const timer=window.setTimeout(()=>setCount(v=>v-1),900); return()=>clearTimeout(timer); },[phase,count,onDrop]);
  const start=()=>{if(!enabled||phase==='countdown'||phase==='impact')return;setCount(3);setPhase('countdown');};
  return <>
    <button className={`drop-beat-btn ${phase}`} disabled={!enabled} onClick={start}>⚡ {phase==='live'?'BEAT LIVE':'DROP THE BEAT'}</button>
    {phase!=='idle'&&<div className={`drop-cinematic ${phase}`} aria-live="assertive">
      <div className="drop-blackout"/><div className="drop-smoke s1"/><div className="drop-smoke s2"/>
      <div className="drop-lightning l1"/><div className="drop-lightning l2"/><div className="drop-shockwave"/>
      <div className="drop-lasers">{Array.from({length:9},(_,i)=><i key={i} style={{transform:`rotate(${i*20-80}deg)`}}/>)}</div>
      {phase==='countdown'&&<div className="drop-count">{count||''}</div>}
      {(phase==='impact'||phase==='live')&&<div className="ai-drop-greeting"><span>◉</span><div><b>AI DJ ONLINE</b><p>Welcome to AI DJ Studio.<br/>Let&apos;s create something unforgettable.</p></div></div>}
      <button className="drop-close" onClick={()=>setPhase('idle')}>← BACK TO DJ DECK</button>
    </div>}
  </>;
}
