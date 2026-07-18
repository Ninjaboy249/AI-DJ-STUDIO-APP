'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useEffect, useRef, useState } from 'react';
import type { Mesh, WebGLRenderer } from 'three';

interface XRSessionLike {
  end(): Promise<void>;
  addEventListener(type: 'end', listener: () => void, options?: { once?: boolean }): void;
}

interface XRSystemLike {
  isSessionSupported(mode: 'immersive-vr'): Promise<boolean>;
  requestSession(mode: 'immersive-vr', options?: { optionalFeatures?: string[] }): Promise<XRSessionLike>;
}

function CDJ({ x, accent }: { x: number; accent: string }) {
  const platter = useRef<Mesh>(null);
  useFrame((_, delta) => { if (platter.current) platter.current.rotation.y += delta * .32; });
  return (
    <group position={[x, .8, -1.4]}>
      <mesh castShadow><boxGeometry args={[2.7, .42, 3.7]} /><meshStandardMaterial color="#11151b" metalness={.75} roughness={.25} /></mesh>
      <mesh position={[0, .28, -.95]}><boxGeometry args={[2.15, .08, .72]} /><meshStandardMaterial color="#102c38" emissive={accent} emissiveIntensity={.22} /></mesh>
      <mesh ref={platter} position={[0, .32, .55]} castShadow><cylinderGeometry args={[1.05, 1.05, .15, 64]} /><meshStandardMaterial color="#262d36" metalness={.85} roughness={.2} /></mesh>
      <mesh position={[0, .42, .55]}><cylinderGeometry args={[.38, .38, .04, 48]} /><meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={.45} /></mesh>
      {Array.from({ length: 8 }, (_, i) => <mesh key={i} position={[-.92 + (i % 4) * .61, .27, -1.48 + Math.floor(i / 4) * .34]}><boxGeometry args={[.43, .09, .21]} /><meshStandardMaterial color={i % 2 ? '#ff3ca6' : accent} emissive={i % 2 ? '#ff3ca6' : accent} emissiveIntensity={.35} /></mesh>)}
      <mesh position={[-.78, .31, 1.48]}><cylinderGeometry args={[.22, .22, .1, 24]} /><meshStandardMaterial color="#ffb300" emissive="#ff8f00" emissiveIntensity={.5} /></mesh>
      <mesh position={[-.18, .31, 1.48]}><cylinderGeometry args={[.27, .27, .1, 24]} /><meshStandardMaterial color="#35f27b" emissive="#18cf5b" emissiveIntensity={.5} /></mesh>
    </group>
  );
}

function Mixer() {
  return (
    <group position={[0, .81, -1.4]}>
      <mesh castShadow><boxGeometry args={[2, .46, 3.7]} /><meshStandardMaterial color="#0b0e13" metalness={.78} roughness={.24} /></mesh>
      {Array.from({ length: 4 }, (_, channel) => <group key={channel} position={[-.66 + channel * .44, .31, 0]}>
        {[-1.22, -.76, -.3].map((z, i) => <mesh key={z} position={[0, 0, z]}><cylinderGeometry args={[.12, .12, .1, 24]} /><meshStandardMaterial color={i === 2 ? '#ff6a00' : '#e7edf4'} /></mesh>)}
        <mesh position={[0, 0, .78]}><boxGeometry args={[.08, .06, 1.05]} /><meshStandardMaterial color="#47515e" /></mesh>
        <mesh position={[0, .08, .72]}><boxGeometry args={[.18, .12, .3]} /><meshStandardMaterial color="#eef2f7" /></mesh>
      </group>)}
      <mesh position={[0, .3, 1.46]}><boxGeometry args={[1.35, .07, .08]} /><meshStandardMaterial color="#47515e" /></mesh>
      <mesh position={[0, .39, 1.46]}><boxGeometry args={[.28, .12, .18]} /><meshStandardMaterial color="#eef2f7" /></mesh>
    </group>
  );
}

function XRBridge({ onRenderer }: { onRenderer: (renderer: WebGLRenderer) => void }) {
  const { gl } = useThree();
  useEffect(() => { gl.xr.enabled = true; onRenderer(gl); }, [gl, onRenderer]);
  return null;
}

export default function VRMode() {
  const [open, setOpen] = useState(false);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [active, setActive] = useState(false);
  const [message, setMessage] = useState('Connect a headset, then enter immersive VR.');
  const rendererRef = useRef<WebGLRenderer | null>(null);
  const sessionRef = useRef<XRSessionLike | null>(null);

  useEffect(() => {
    const xr = (navigator as Navigator & { xr?: XRSystemLike }).xr;
    if (!xr) { setSupported(false); return; }
    void xr.isSessionSupported('immersive-vr').then(setSupported).catch(() => setSupported(false));
  }, []);

  const enterVR = async () => {
    const xr = (navigator as Navigator & { xr?: XRSystemLike }).xr;
    const renderer = rendererRef.current;
    if (!xr || !renderer || !supported) { setMessage('Immersive WebXR is unavailable in this browser or no compatible headset is connected.'); return; }
    try {
      const session = await xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'] });
      sessionRef.current = session;
      session.addEventListener('end', () => { sessionRef.current = null; setActive(false); setMessage('VR session ended.'); }, { once: true });
      await renderer.xr.setSession(session as Parameters<typeof renderer.xr.setSession>[0]);
      setActive(true);
      setMessage('Immersive VR session active.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The VR session could not be started.');
    }
  };

  const close = async () => {
    if (sessionRef.current) await sessionRef.current.end().catch(() => undefined);
    setOpen(false);
  };

  return (
    <>
      <button className="vr-floating-launcher" onClick={() => setOpen(true)} aria-label="Open VR Mode" title="Open real WebXR DJ Deck">
        <svg viewBox="0 0 64 40" aria-hidden="true"><path d="M7 7h50c3 0 5 2 5 5v15c0 4-3 6-6 6H43l-7-8h-8l-7 8H8c-4 0-6-2-6-6V12c0-3 2-5 5-5Z" /><circle cx="17" cy="20" r="6" /><circle cx="47" cy="20" r="6" /></svg>
        <span>VR</span>
      </button>
      {open && <section className="vr-immersive-overlay" role="dialog" aria-modal="true" aria-label="WebXR DJ Deck">
        <div className="vr-immersive-toolbar">
          <div><b>WEBXR DJ DECK</b><span>{message}</span></div>
          <button className="vr-enter-button" onClick={() => void enterVR()} disabled={!supported || active}>{active ? 'VR ACTIVE' : supported === null ? 'CHECKING…' : supported ? 'ENTER VR' : 'VR NOT SUPPORTED'}</button>
          <button className="vr-close-button" onClick={() => void close()} aria-label="Close VR Mode">×</button>
        </div>
        <Canvas shadows camera={{ position: [0, 5.5, 8.8], fov: 48 }}>
          <XRBridge onRenderer={(renderer) => { rendererRef.current = renderer; }} />
          <color attach="background" args={['#02040a']} />
          <fog attach="fog" args={['#02040a', 10, 24]} />
          <ambientLight intensity={.75} />
          <spotLight position={[0, 9, 3]} intensity={100} angle={.7} penumbra={.8} castShadow />
          <pointLight position={[-5, 3, -2]} color="#e040fb" intensity={28} />
          <pointLight position={[5, 3, -2]} color="#00e5ff" intensity={28} />
          <CDJ x={-2.65} accent="#e040fb" /><Mixer /><CDJ x={2.65} accent="#00e5ff" />
          <mesh position={[0, .48, -1.4]} receiveShadow><boxGeometry args={[9.4, .22, 5.6]} /><meshStandardMaterial color="#080c13" metalness={.45} roughness={.38} /></mesh>
          <gridHelper args={[30, 30, '#26304a', '#101725']} position={[0, .34, 0]} />
          <OrbitControls makeDefault target={[0, 1, -1.4]} minDistance={6} maxDistance={15} maxPolarAngle={1.48} />
        </Canvas>
        <div className="vr-desktop-hint">Desktop preview: drag to look · scroll to move</div>
      </section>}
    </>
  );
}
