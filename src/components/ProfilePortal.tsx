'use client';
import { useRef, useState } from 'react';

export default function ProfilePortal({ open, onClose, image, setImage }: { open:boolean; onClose:()=>void; image:string|null; setImage:(v:string)=>void }) {
  const input = useRef<HTMLInputElement>(null); const [name,setName]=useState('DJ Nova');
  if (!open) return null;
  const pick=(e:React.ChangeEvent<HTMLInputElement>)=>{const file=e.target.files?.[0]; if(file) setImage(URL.createObjectURL(file));};
  return <div className="portal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><div className="login-portal">
    <div className="energy-grid"/><div className="portal-particles">{Array.from({length:18},(_,i)=><i key={i}/>)}</div>
    <button className="portal-close" onClick={onClose}>×</button><div className="portal-kicker">AI LOGIN PORTAL</div><h2>Welcome DJ.</h2><p>Initializing BeatVerse...</p>
    <button className="profile-avatar" onClick={()=>input.current?.click()}>{image?<img src={image} alt="DJ profile"/>:<span>DJ<small>ADD PHOTO</small></span>}</button>
    <input ref={input} type="file" accept="image/*" onChange={pick} hidden/><label>ARTIST ID<input value={name} onChange={e=>setName(e.target.value)}/></label>
    <div className="fingerprint"><span>◎</span><i>IDENTITY SCAN READY</i></div><button className="enter-studio" onClick={onClose}>ENTER THE STUDIO</button>
    <blockquote>“Where AI, Music, and Visual Effects become one experience.”</blockquote>
  </div></div>;
}
