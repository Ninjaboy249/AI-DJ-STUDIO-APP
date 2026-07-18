'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Center, ContactShadows, Environment, OrbitControls, useGLTF } from '@react-three/drei';
import { Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Group, Mesh, MeshStandardMaterial, SpotLight, WebGLRenderer } from 'three';
import { getAnalyser } from '@/lib/audio';

interface XRSessionLike {
  end(): Promise<void>;
  addEventListener(type: 'end', listener: () => void, options?: { once?: boolean }): void;
}

interface XRSystemLike {
  isSessionSupported(mode: 'immersive-vr'): Promise<boolean>;
  requestSession(mode: 'immersive-vr', options?: { optionalFeatures?: string[] }): Promise<XRSessionLike>;
}

interface VRModeProps {
  isPlaying?: boolean;
  onPlay?: () => void;
}

function PioneerDeck() {
  const { scene } = useGLTF('/pioneer_DJ_console.glb');

  useEffect(() => {
    scene.traverse((object) => {
      if ('isMesh' in object && object.isMesh) {
        const mesh = object as Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
  }, [scene]);

  return <primitive object={scene} scale={0.24} position={[0, 0, 0]} />;
}

useGLTF.preload('/pioneer_DJ_console.glb');

function Interactive({ onSelect, children, position = [0, 0, 0] }: {
  onSelect: () => void;
  children: ReactNode;
  position?: [number, number, number];
}) {
  return (
    <group
      position={position}
      onClick={(event) => { event.stopPropagation(); onSelect(); }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {children}
    </group>
  );
}

function TransportButton({ active }: { active: boolean }) {
  return (
    <group>
      <mesh castShadow>
        <cylinderGeometry args={[.24, .24, .12, 32]} />
        <meshStandardMaterial color={active ? '#33ff99' : '#101820'} emissive={active ? '#19ff80' : '#00bcd4'} emissiveIntensity={active ? 2.5 : .6} metalness={.45} roughness={.25} />
      </mesh>
      <mesh position={[0, .075, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[.085, .16, 3]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
    </group>
  );
}

function JogWheel({ x, isPlaying }: { x: number; isPlaying: boolean }) {
  const wheel = useRef<Group>(null);
  const velocity = useRef(.22);
  const scratching = useRef(false);

  useFrame((_, delta) => {
    if (!wheel.current) return;
    const target = scratching.current ? 9 : isPlaying ? 3.8 : .22;
    velocity.current += (target - velocity.current) * Math.min(1, delta * (scratching.current ? 14 : 3));
    wheel.current.rotation.y += velocity.current * delta;
  });

  return (
    <group
      ref={wheel}
      position={[x, 1.05, .15]}
      onPointerDown={(event) => { event.stopPropagation(); scratching.current = true; }}
      onPointerUp={() => { scratching.current = false; }}
      onPointerLeave={() => { scratching.current = false; }}
    >
      <mesh castShadow>
        <cylinderGeometry args={[.72, .72, .12, 64]} />
        <meshStandardMaterial color="#151b25" metalness={.9} roughness={.18} />
      </mesh>
      <mesh position={[0, .075, -.48]} castShadow>
        <boxGeometry args={[.08, .025, .25]} />
        <meshStandardMaterial color="#e8f7ff" emissive="#00e5ff" emissiveIntensity={1.8} />
      </mesh>
    </group>
  );
}

function ClubExperience({ isPlaying, onPlay }: Required<VRModeProps>) {
  const club = useRef<Group>(null);
  const floor = useRef<Mesh>(null);
  const speakers = useRef<Mesh[]>([]);
  const bars = useRef<Mesh[]>([]);
  const crowd = useRef<Group[]>([]);
  const lasers = useRef<SpotLight[]>([]);
  const ledMaterial = useRef<MeshStandardMaterial>(null);
  const analyserData = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const cameraShake = useRef({ x: 0, y: 0 });

  useFrame(({ clock, camera }, delta) => {
    const t = clock.elapsedTime;
    let bass = isPlaying ? .36 + Math.sin(t * 7) * .16 : .08;
    let mid = isPlaying ? .32 + Math.sin(t * 4.3) * .13 : .06;
    let treble = isPlaying ? .25 + Math.sin(t * 13) * .14 : .04;
    const analyser = getAnalyser();
    if (analyser) {
      if (!analyserData.current || analyserData.current.length !== analyser.frequencyBinCount) analyserData.current = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(analyserData.current);
      const avg = (from: number, to: number) => {
        let sum = 0;
        for (let i = from; i < Math.min(to, analyserData.current!.length); i++) sum += analyserData.current![i];
        return sum / Math.max(1, to - from) / 255;
      };
      bass = avg(0, 14); mid = avg(14, 90); treble = avg(90, 240);
    }
    const energy = Math.max(bass, mid, treble);
    if (club.current) club.current.position.y = Math.sin(t * 32) * bass * .018;
    if (floor.current) floor.current.scale.y = 1 + bass * .08;
    speakers.current.forEach((speaker, i) => {
      const pulse = 1 + bass * (.18 + (i % 2) * .04);
      speaker.scale.set(pulse, pulse, pulse);
    });
    bars.current.forEach((bar, i) => {
      const height = .18 + mid * (1.4 + Math.sin(t * 5 + i) * .5);
      bar.scale.y += (height - bar.scale.y) * Math.min(1, delta * 12);
    });
    crowd.current.forEach((person, i) => {
      person.position.y = -.08 + Math.abs(Math.sin(t * (2.5 + bass * 8) + i)) * (.08 + bass * .28);
    });
    lasers.current.forEach((laser, i) => {
      laser.intensity = treble > .18 ? 80 + treble * 220 : 8;
      laser.position.x = Math.sin(t * 1.8 + i * 2) * 5;
    });
    if (ledMaterial.current) {
      ledMaterial.current.color.setHSL((t * .08 + mid) % 1, .9, .48);
      ledMaterial.current.emissive.copy(ledMaterial.current.color);
      ledMaterial.current.emissiveIntensity = .8 + mid * 3;
    }
    camera.position.x -= cameraShake.current.x;
    camera.position.y -= cameraShake.current.y;
    cameraShake.current.x = energy > .08 ? (Math.random() - .5) * bass * .008 : 0;
    cameraShake.current.y = energy > .08 ? (Math.random() - .5) * bass * .005 : 0;
    camera.position.x += cameraShake.current.x;
    camera.position.y += cameraShake.current.y;
  });

  return (
    <group ref={club}>
      <Suspense fallback={null}><Center><PioneerDeck /></Center></Suspense>
      <JogWheel x={-1.25} isPlaying={isPlaying} />
      <JogWheel x={1.25} isPlaying={isPlaying} />
      <Interactive position={[0, 1.15, 1.15]} onSelect={onPlay}><TransportButton active={isPlaying} /></Interactive>

      <mesh ref={floor} position={[0, -.42, 0]} receiveShadow>
        <boxGeometry args={[12, .16, 10]} />
        <meshStandardMaterial color="#050711" metalness={.55} roughness={.38} />
      </mesh>

      {[-4.6, 4.6].map((x, i) => (
        <group key={x} position={[x, 1.2, -.5]}>
          <mesh castShadow><boxGeometry args={[1.25, 3.6, 1.25]} /><meshStandardMaterial color="#07090e" metalness={.45} roughness={.3} /></mesh>
          {[.65, -.75].map(y => <mesh key={y} ref={node => { if (node) speakers.current[i * 2 + (y > 0 ? 0 : 1)] = node; }} position={[0, y, .66]}><cylinderGeometry args={[.43, .43, .16, 40]} /><meshStandardMaterial color="#171d29" emissive={i ? '#00e5ff' : '#e040fb'} emissiveIntensity={.55} /></mesh>)}
        </group>
      ))}

      <group position={[0, 2.8, -4.35]}>
        <mesh><boxGeometry args={[8.6, 3.3, .18]} /><meshStandardMaterial ref={ledMaterial} color="#5224a8" emissive="#5224a8" emissiveIntensity={1.2} /></mesh>
        {Array.from({ length: 18 }, (_, i) => <mesh key={i} ref={node => { if (node) bars.current[i] = node; }} position={[-3.9 + i * .46, 0, .13]}><boxGeometry args={[.26, 1, .08]} /><meshBasicMaterial color={i % 3 === 0 ? '#00e5ff' : i % 3 === 1 ? '#e040fb' : '#35f27b'} /></mesh>)}
      </group>

      {Array.from({ length: 28 }, (_, i) => {
        const x = -5.3 + (i % 14) * .82;
        const z = 2.5 + Math.floor(i / 14) * 1.05;
        return <group key={i} ref={node => { if (node) crowd.current[i] = node; }} position={[x, -.08, z]}><mesh position={[0, .78, 0]}><sphereGeometry args={[.16, 12, 12]} /><meshStandardMaterial color="#161424" /></mesh><mesh position={[0, .34, 0]}><capsuleGeometry args={[.18, .65, 4, 8]} /><meshStandardMaterial color={i % 2 ? '#20132e' : '#0e2030'} /></mesh></group>;
      })}

      {[-1, 1].map((side, i) => <spotLight key={side} ref={node => { if (node) lasers.current[i] = node; }} position={[side * 4, 5.5, 2]} target-position={[side * -2, 0, -2]} color={side > 0 ? '#00e5ff' : '#ff2fd1'} intensity={80} angle={.055} penumbra={.1} distance={18} />)}
      {Array.from({ length: 22 }, (_, i) => <mesh key={`p-${i}`} position={[-5 + (i * 1.73) % 10, .5 + (i * .71) % 4.8, -3 + (i * 1.13) % 7]}><sphereGeometry args={[.025 + (i % 3) * .012, 8, 8]} /><meshBasicMaterial color={i % 2 ? '#ffffff' : '#7eeeff'} /></mesh>)}
      {Array.from({ length: 14 }, (_, i) => <mesh key={`city-${i}`} position={[-7 + i * 1.08, .4 + (i % 4) * .35, -7]}><boxGeometry args={[.75, 2 + (i % 5) * .7, .8]} /><meshStandardMaterial color="#070b18" emissive={i % 2 ? '#101b40' : '#24102e'} emissiveIntensity={.6} /></mesh>)}
      {[[-3.4, 4.8, -1.8], [3.4, 4.8, -1.8]].map((position, i) => <spotLight key={i} position={position as [number, number, number]} color={i ? '#ffe7a8' : '#c8e7ff'} intensity={120} angle={.28} penumbra={.65} castShadow />)}
      {[-3, 0, 3].map((x, i) => <mesh key={`fog-${i}`} position={[x, .1, -1.7]} scale={[2.3, .55, 1.4]}><sphereGeometry args={[1, 20, 12]} /><meshBasicMaterial color={i % 2 ? '#b7d7ff' : '#d7b6ff'} transparent opacity={.035} depthWrite={false} /></mesh>)}
    </group>
  );
}

function XRBridge({ onRenderer }: { onRenderer: (renderer: WebGLRenderer) => void }) {
  const { gl } = useThree();
  useEffect(() => { gl.xr.enabled = true; onRenderer(gl); }, [gl, onRenderer]);
  return null;
}

export default function VRMode({ isPlaying = false, onPlay = () => undefined }: VRModeProps) {
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
        <Canvas shadows camera={{ position: [0, 5.5, 8.8], fov: 48, near: 0.1, far: 1000 }}>
          <XRBridge onRenderer={(renderer) => { rendererRef.current = renderer; }} />
          <color attach="background" args={['#02040a']} />
          <fog attach="fog" args={['#02040a', 10, 24]} />
          <Environment preset="night" />
          <ambientLight intensity={1.25} />
          <hemisphereLight args={['#d9edff', '#15101f', 1.8]} />
          <directionalLight position={[0, 8, 6]} intensity={4.5} color="#fff8ed" castShadow shadow-mapSize={[2048, 2048]} />
          <spotLight position={[0, 10, 4]} intensity={180} angle={.75} penumbra={.85} color="#ffffff" castShadow />
          <spotLight position={[-7, 5, 4]} intensity={95} angle={.8} penumbra={1} color="#e040fb" />
          <spotLight position={[7, 5, 4]} intensity={95} angle={.8} penumbra={1} color="#00e5ff" />
          <pointLight position={[0, 4, -6]} color="#788cff" intensity={65} />
          <OrbitControls makeDefault enableZoom={false} maxPolarAngle={1.48} />
          <ClubExperience isPlaying={isPlaying} onPlay={onPlay} />
          <ContactShadows position={[0, .6, 0]} opacity={.55} scale={12} blur={2.5} far={8} />
          <mesh position={[0, .48, -1.4]} receiveShadow><boxGeometry args={[9.4, .22, 5.6]} /><meshStandardMaterial color="#080c13" metalness={.45} roughness={.38} /></mesh>
          <gridHelper args={[30, 30, '#26304a', '#101725']} position={[0, .34, 0]} />
        </Canvas>
        <div className="vr-desktop-hint">Desktop preview: drag to look · scroll to move</div>
      </section>}
    </>
  );
}
