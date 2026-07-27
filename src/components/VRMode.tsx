'use client';

import { Canvas, useFrame, useThree, useLoader } from '@react-three/fiber';
import { Center, OrbitControls, useGLTF } from '@react-three/drei';
import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import { TextureLoader } from 'three';
import type { Group, Mesh, MeshStandardMaterial, SpotLight, PointLight, WebGLRenderer } from 'three';
import { getAnalyser } from '@/lib/audio';
import type { UseDeck } from '@/lib/useDeck';

/* ─── Types ──────────────────────────────────────────────────────────────── */
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
  deckA?: UseDeck;
  deckB?: UseDeck;
  ensureAudio?: () => Promise<void>;
  crossfader?: number;
  setCrossfader?: (v: number) => void;
  masterVolume?: number;
  setMasterVolume?: (v: number) => void;
}

/* ─── Sunset sky sphere ──────────────────────────────────────────────────── */
function SunsetSky() {
  const texture = useLoader(TextureLoader, '/vr-sunset.png');
  useMemo(() => {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.repeat.set(1, 1);
  }, [texture]);
  return (
    /* Large inverted sphere — renders the sunset panorama all around */
    <mesh scale={[-1, 1, 1]} renderOrder={-1}>
      <sphereGeometry args={[90, 64, 32]} />
      <meshBasicMaterial map={texture} side={THREE.BackSide} depthWrite={false} />
    </mesh>
  );
}

/* ─── Open-air grassy ground ─────────────────────────────────────────────── */
function OutdoorGround() {
  return (
    <group>
      {/* Main grass field */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.42, 0]}>
        <planeGeometry args={[200, 200, 1, 1]} />
        <meshStandardMaterial color="#2d4a1e" roughness={0.95} metalness={0} />
      </mesh>
      {/* Paved festival path / pit in front of stage */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.41, 6]}>
        <planeGeometry args={[22, 18]} />
        <meshStandardMaterial color="#1a1c22" roughness={0.88} metalness={0.1} />
      </mesh>
      {/* Horizon blend ring — gradient from grass to distant sunset */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.4, 0]}>
        <ringGeometry args={[30, 90, 64]} />
        <meshBasicMaterial color="#4a3010" transparent opacity={0.28} depthWrite={false} />
      </mesh>
    </group>
  );
}

/* ─── Pioneer deck GLB ───────────────────────────────────────────────────── */
function PioneerDeck() {
  const { scene } = useGLTF('/pioneer_DJ_console.glb');
  useEffect(() => {
    scene.traverse(o => {
      const m = o as Mesh;
      if (!m.isMesh) return;
      // Disable shadows to save shadow-map texture units
      m.castShadow = false;
      m.receiveShadow = false;
      // Downgrade MeshPhysicalMaterial → MeshStandardMaterial to avoid
      // clearcoat/transmission/sheen texture slots that push over the GPU limit
      const mat = m.material as THREE.Material & { type?: string };
      if (mat && mat.type === 'MeshPhysicalMaterial') {
        const phys = mat as THREE.MeshPhysicalMaterial;
        const std = new THREE.MeshStandardMaterial({
          color: phys.color,
          map: phys.map,
          normalMap: phys.normalMap,
          roughnessMap: phys.roughnessMap,
          metalnessMap: phys.metalnessMap,
          emissive: phys.emissive,
          emissiveMap: phys.emissiveMap,
          emissiveIntensity: phys.emissiveIntensity,
          metalness: phys.metalness,
          roughness: phys.roughness,
          envMapIntensity: 0.4,
          transparent: phys.transparent,
          opacity: phys.opacity,
          side: phys.side,
        });
        m.material = std;
        phys.dispose();
      }
    });
  }, [scene]);
  /*
   * Scale and position tuned for the outdoor booth:
   * – scale 0.28 fills the 5.6-wide booth table
   * – y offset puts it flush on the booth surface (table top at y=0.2)
   * – z offset pulls it slightly forward so it is centred over the table
   */
  return <primitive object={scene} scale={0.28} position={[0, 0.21, -0.08]} />;
}
useGLTF.preload('/pioneer_DJ_console.glb');

/* ─── Interactive wrapper ────────────────────────────────────────────────── */
function Interactive({ onSelect, children, position = [0, 0, 0] }: {
  onSelect: () => void; children: ReactNode; position?: [number, number, number];
}) {
  return (
    <group position={position}
      onClick={e => { e.stopPropagation(); onSelect(); }}
      onPointerDown={e => e.stopPropagation()}>
      {children}
    </group>
  );
}

/* ─── Jog wheel (sits on top of booth table) ────────────────────────────── */
function JogWheel({ x, isPlaying }: { x: number; isPlaying: boolean }) {
  const wheel = useRef<Group>(null);
  const vel = useRef(0.18);
  const scratching = useRef(false);
  useFrame((_, dt) => {
    if (!wheel.current) return;
    const target = scratching.current ? 9 : isPlaying ? 3.8 : 0.18;
    vel.current += (target - vel.current) * Math.min(1, dt * (scratching.current ? 14 : 3));
    wheel.current.rotation.y += vel.current * dt;
  });
  return (
    <group ref={wheel} position={[x, 1.12, 0.12]}
      onPointerDown={e => { e.stopPropagation(); scratching.current = true; }}
      onPointerUp={() => { scratching.current = false; }}
      onPointerLeave={() => { scratching.current = false; }}>
      <mesh castShadow>
        <cylinderGeometry args={[0.68, 0.68, 0.1, 64]} />
        <meshStandardMaterial color="#151b25" metalness={0.92} roughness={0.15} />
      </mesh>
      <mesh position={[0, 0.065, -0.45]} castShadow>
        <boxGeometry args={[0.07, 0.022, 0.22]} />
        <meshStandardMaterial color="#e8f7ff" emissive="#00e5ff" emissiveIntensity={2} />
      </mesh>
    </group>
  );
}

/* ─── Play button ────────────────────────────────────────────────────────── */
function TransportButton({ active }: { active: boolean }) {
  return (
    <group>
      <mesh castShadow>
        <cylinderGeometry args={[0.24, 0.24, 0.12, 32]} />
        <meshStandardMaterial color={active ? '#33ff99' : '#101820'}
          emissive={active ? '#19ff80' : '#00bcd4'} emissiveIntensity={active ? 2.5 : 0.6}
          metalness={0.45} roughness={0.25} />
      </mesh>
      <mesh position={[0, 0.075, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.085, 0.16, 3]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
    </group>
  );
}

/* ─── DJ Booth / stage platform (outdoor festival style) ────────────────── */
function FestivalStage() {
  return (
    <group>
      {/* ── Main elevated stage deck ── */}
      <mesh receiveShadow castShadow position={[0, -0.06, -0.5]}>
        <boxGeometry args={[14, 0.72, 10]} />
        <meshStandardMaterial color="#1c1408" metalness={0.35} roughness={0.78} />
      </mesh>

      {/* Stage front face */}
      <mesh position={[0, 0.04, 4.5]}>
        <boxGeometry args={[14, 0.72, 0.14]} />
        <meshStandardMaterial color="#160f04" metalness={0.3} roughness={0.8} />
      </mesh>

      {/* Neon edge strips along front */}
      <mesh position={[0, 0.38, 4.56]}>
        <boxGeometry args={[13.8, 0.04, 0.04]} />
        <meshBasicMaterial color="#ff6a00" />
      </mesh>
      <mesh position={[0, -0.36, 4.56]}>
        <boxGeometry args={[13.8, 0.04, 0.04]} />
        <meshBasicMaterial color="#e040fb" />
      </mesh>

      {/* Side neon strips */}
      {[-6.95, 6.95].map((x, i) => (
        <mesh key={i} position={[x, 0.38, 0]}>
          <boxGeometry args={[0.04, 0.04, 9.2]} />
          <meshBasicMaterial color={i === 0 ? '#00e5ff' : '#ff6a00'} />
        </mesh>
      ))}

      {/* ── DJ booth table on stage ── */}
      <mesh receiveShadow position={[0, 0.21, -0.18]}>
        <boxGeometry args={[5.8, 0.12, 2.4]} />
        <meshStandardMaterial color="#0d0e18" metalness={0.72} roughness={0.25} />
      </mesh>
      {/* booth fascia */}
      <mesh position={[0, -0.22, 0.98]}>
        <boxGeometry args={[5.8, 0.8, 0.14]} />
        <meshStandardMaterial color="#09090f" metalness={0.6} roughness={0.38} />
      </mesh>
      {/* booth neon strip */}
      <mesh position={[0, -0.18, 1.05]}>
        <boxGeometry args={[5.6, 0.05, 0.05]} />
        <meshBasicMaterial color="#e040fb" />
      </mesh>

      {/* ── Sub-stage access ramp steps ── */}
      {[0.18, 0.36, 0.54].map((y, i) => (
        <mesh key={i} receiveShadow position={[0, -0.42 + y / 2, 4.5 + i * 0.48]}>
          <boxGeometry args={[3.5, y, 0.48]} />
          <meshStandardMaterial color="#140f04" metalness={0.2} roughness={0.85} />
        </mesh>
      ))}

      {/* ── Crowd barrier / fence at stage front ── */}
      {Array.from({ length: 14 }, (_, i) => {
        const x = -6.3 + i * 0.98;
        return (
          <group key={i} position={[x, -0.42, 5.2]}>
            <mesh>
              <boxGeometry args={[0.06, 1.2, 0.06]} />
              <meshStandardMaterial color="#303040" metalness={0.85} roughness={0.3} />
            </mesh>
            <mesh position={[0, 0.6, 0]}>
              <boxGeometry args={[0.98, 0.04, 0.04]} />
              <meshStandardMaterial color="#404050" metalness={0.88} roughness={0.25} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/* ─── Truss rig (festival outdoor) ──────────────────────────────────────── */
function Truss({ y, z, width = 16 }: { y: number; z: number; width?: number }) {
  return (
    <group position={[0, y, z]}>
      <mesh>
        <boxGeometry args={[width, 0.2, 0.2]} />
        <meshStandardMaterial color="#1e1e28" metalness={0.92} roughness={0.22} />
      </mesh>
      {/* diagonal braces */}
      {Array.from({ length: Math.floor(width / 2), }, (_, i) => {
        const x = -width / 2 + 1 + i * 2;
        return (
          <mesh key={i} position={[x, -0.22, 0]} rotation={[0, 0, Math.PI / 4 + (i % 2) * (Math.PI / 2)]}>
            <boxGeometry args={[0.06, 0.55, 0.06]} />
            <meshStandardMaterial color="#252535" metalness={0.88} roughness={0.28} />
          </mesh>
        );
      })}
      {/* vertical legs */}
      {[-width / 2 + 0.5, width / 2 - 0.5].map((x, i) => (
        <mesh key={`leg-${i}`} position={[x, -y * 0.42, 0]}>
          <boxGeometry args={[0.16, y * 0.85, 0.16]} />
          <meshStandardMaterial color="#161620" metalness={0.9} roughness={0.25} />
        </mesh>
      ))}
    </group>
  );
}

/* ─── Moving head fixture ────────────────────────────────────────────────── */
function MovingHead({ position, color, phase }: {
  position: [number, number, number]; color: string; phase: number;
}) {
  const bodyRef = useRef<Mesh>(null);
  const lightRef = useRef<SpotLight>(null);
  const headRef = useRef<Group>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (headRef.current) {
      headRef.current.rotation.y = Math.sin(t * 0.5 + phase) * 0.9;
      headRef.current.rotation.x = -0.5 + Math.sin(t * 0.35 + phase * 1.3) * 0.35;
    }
    if (lightRef.current) {
      lightRef.current.color.setHSL((t * 0.055 + phase * 0.16) % 1, 1, 0.55);
      lightRef.current.intensity = 180 + Math.sin(t * 2.1 + phase) * 65;
    }
    if (bodyRef.current) {
      (bodyRef.current.material as MeshStandardMaterial).emissive.setHSL((t * 0.055 + phase * 0.16) % 1, 1, 0.42);
    }
  });

  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[0.22, 0.2, 0.22]} />
        <meshStandardMaterial color="#111118" metalness={0.9} roughness={0.2} />
      </mesh>
      <group ref={headRef} position={[0, -0.22, 0]}>
        <mesh ref={bodyRef}>
          <cylinderGeometry args={[0.14, 0.1, 0.38, 16]} />
          <meshStandardMaterial color="#0d0d14" metalness={0.8} roughness={0.22}
            emissive="#ff6a00" emissiveIntensity={0.5} />
        </mesh>
        <mesh position={[0, -0.21, 0]}>
          <circleGeometry args={[0.09, 16]} />
          <meshBasicMaterial color={color} />
        </mesh>
        <spotLight ref={lightRef} position={[0, -0.3, 0]} target-position={[0, -8, 0]}
          color={color} intensity={180} angle={0.06} penumbra={0.2} distance={26} />
      </group>
    </group>
  );
}

/* ─── Cyberpunk city screen (canvas-texture, beat-synced) ───────────────── */

/** Stable building data — created once, never changes */
const BUILDINGS = Array.from({ length: 32 }, (_, i) => ({
  x:  (i / 32) * 1024,
  w:  18 + (i * 37 % 24),
  h:  80 + (i * 53 % 200),
  hue: (i * 47) % 360,
  windows: Array.from({ length: 12 }, (_, wi) => ({
    wx: 4 + (wi % 3) * 6,
    wy: wi * 14 + 8,
    on: Math.random() > 0.38,
  })),
}));

function drawCyberpunkCity(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  t: number,
  bass: number,
  mid: number,
  freqBins: Uint8Array | null,
) {
  /* ── sky gradient — deep purple-blue ── */
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0,   `hsl(260,80%,4%)`);
  sky.addColorStop(0.5, `hsl(240,70%,7%)`);
  sky.addColorStop(1,   `hsl(210,60%,10%)`);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  /* ── perspective grid floor (bottom third) ── */
  const GRID_Y = H * 0.58;
  const beatPulse = 1 + bass * 0.45;
  ctx.save();
  // horizontal lines
  for (let i = 0; i < 12; i++) {
    const frac = i / 11;
    const y = GRID_Y + frac * (H - GRID_Y);
    const alpha = 0.12 + frac * 0.32 + mid * 0.18;
    ctx.strokeStyle = `rgba(0,229,255,${alpha})`;
    ctx.lineWidth = 0.6 + frac * 1.2;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  // vanishing-point vertical lines
  const vp = { x: W / 2, y: GRID_Y };
  for (let i = -14; i <= 14; i++) {
    const bx = W / 2 + i * 38;
    const alpha = 0.1 + Math.abs(i / 14) * 0.22 + bass * 0.14;
    ctx.strokeStyle = `rgba(224,64,251,${alpha})`;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(vp.x, vp.y);
    ctx.lineTo(bx, H);
    ctx.stroke();
  }
  ctx.restore();

  /* ── city buildings (silhouettes + neon windows) ── */
  const skylineY = GRID_Y;
  BUILDINGS.forEach((b, i) => {
    const bx = (b.x + t * 6) % (W + b.w) - b.w / 2;
    const bh = b.h * beatPulse * (1 + (i % 3 === 0 ? bass : 0) * 0.12);
    const by = skylineY - bh;

    // building silhouette
    const bGrad = ctx.createLinearGradient(bx, by, bx, skylineY);
    bGrad.addColorStop(0, `hsla(${b.hue},60%,9%,0.96)`);
    bGrad.addColorStop(1, `hsla(${b.hue},40%,5%,0.99)`);
    ctx.fillStyle = bGrad;
    ctx.fillRect(bx, by, b.w, bh);

    // neon rooftop edge
    const edgeColor = i % 2 === 0 ? `rgba(0,229,255,0.8)` : `rgba(224,64,251,0.7)`;
    ctx.strokeStyle = edgeColor;
    ctx.lineWidth = 1.2;
    ctx.strokeRect(bx, by, b.w, bh);

    // windows
  b.windows.forEach(win => {
    const flicker = Math.sin(t * 3.5 + i * 7 + win.wy) > 0.82;
    if (!win.on && !flicker) return;
    const wx = bx + win.wx;
    const wy = by + win.wy;
    /* window colours as rgba strings so glow reuse is easy */
    const wcRgb  = i % 3 === 0 ? '255,224,144' : i % 3 === 1 ? '144,232,255' : '255,144,255';
    ctx.fillStyle = `rgb(${wcRgb})`;
    ctx.globalAlpha = 0.7 + Math.sin(t * 2 + i * win.wy) * 0.15;
    ctx.fillRect(wx, wy, 3.5, 5);
    /* window glow halo */
    const wGlow = ctx.createRadialGradient(wx + 1.75, wy + 2.5, 0, wx + 1.75, wy + 2.5, 10);
    wGlow.addColorStop(0, `rgba(${wcRgb},0.22)`);
    wGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = wGlow;
    ctx.fillRect(wx - 8, wy - 6, 20, 16);
    ctx.globalAlpha = 1;
  });
  });

  /* ── horizon glow ── */
  const hGlow = ctx.createLinearGradient(0, skylineY - 60, 0, skylineY + 30);
  hGlow.addColorStop(0, 'transparent');
  hGlow.addColorStop(0.4, `rgba(224,64,251,${0.08 + mid * 0.18})`);
  hGlow.addColorStop(0.7, `rgba(0,229,255,${0.06 + bass * 0.2})`);
  hGlow.addColorStop(1, 'transparent');
  ctx.fillStyle = hGlow;
  ctx.fillRect(0, skylineY - 60, W, 90);

  /* ── beat-synced waveform bars ── */
  const BARS = 96;
  const barW = W / BARS;
  const waveMaxH = H * 0.28;
  const waveBaseY = GRID_Y;
  for (let i = 0; i < BARS; i++) {
    let amp = 0.08 + Math.sin(t * 4 + i * 0.22) * 0.06;
    if (freqBins) {
      const idx = Math.floor((i / BARS) * freqBins.length * 0.8);
      amp = freqBins[idx] / 255;
    }
    const bH = Math.max(4, amp * waveMaxH * beatPulse);
    const hue = (240 + i * 1.5 + t * 30) % 360;
    const alpha = 0.55 + amp * 0.45;

    // mirrored bar (up + down from waveBaseY)
    const grad = ctx.createLinearGradient(0, waveBaseY - bH, 0, waveBaseY + bH * 0.35);
    grad.addColorStop(0, `hsla(${hue},100%,65%,${alpha})`);
    grad.addColorStop(0.5, `hsla(${(hue + 40) % 360},100%,55%,${alpha * 0.7})`);
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.fillRect(i * barW + 0.5, waveBaseY - bH, barW - 1, bH + bH * 0.35);
  }

  /* ── scan lines overlay ── */
  ctx.save();
  for (let y = 0; y < H; y += 3) {
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(0, y, W, 1);
  }
  ctx.restore();

  /* ── vignette ── */
  const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75);
  vig.addColorStop(0, 'transparent');
  vig.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);

  /* ── corner UI labels ── */
  ctx.save();
  ctx.font = `bold ${Math.round(W * 0.018)}px monospace`;
  ctx.fillStyle = `rgba(0,229,255,${0.55 + bass * 0.45})`;
  ctx.fillText('CYBERPUNK CITY', 12, 22);
  ctx.fillStyle = `rgba(224,64,251,${0.45 + mid * 0.35})`;
  ctx.textAlign = 'right';
  ctx.fillText(`BPM SYNC`, W - 12, 22);
  ctx.restore();
}

function CyberpunkScreen({ bass, mid, treble }: { bass: number; mid: number; treble: number }) {
  const W = 1024, H = 512;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const texRef    = useRef<THREE.CanvasTexture | null>(null);
  const meshRef   = useRef<Mesh>(null);
  const analyserDataRef = useRef<Uint8Array | null>(null);
  const tc = useRef(0);

  /* create the offscreen canvas + texture once */
  useMemo(() => {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    canvasRef.current = c;
    texRef.current = new THREE.CanvasTexture(c);
    texRef.current.colorSpace = THREE.SRGBColorSpace;
  }, []);

  useFrame((_, dt) => {
    tc.current += dt;
    const canvas = canvasRef.current;
    const tex    = texRef.current;
    if (!canvas || !tex) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    /* pull live frequency data if available */
    const analyser = getAnalyser();
    if (analyser) {
      if (!analyserDataRef.current || analyserDataRef.current.length !== analyser.frequencyBinCount)
        analyserDataRef.current = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(analyserDataRef.current);
    }

    drawCyberpunkCity(ctx, W, H, tc.current, bass, mid, analyserDataRef.current);
    tex.needsUpdate = true;

  });

  /* Cleanup on unmount */
  useEffect(() => () => { texRef.current?.dispose(); }, []);

  return (
    <group position={[0, 5.8, -7.85]}>
      {/* Frame / bezel */}
      <mesh>
        <boxGeometry args={[14.6, 7.1, 0.28]} />
        <meshStandardMaterial color="#0a0a12" metalness={0.88} roughness={0.22} />
      </mesh>
      {/* Screen surface — only map, no emissiveMap (saves a texture unit) */}
      <mesh ref={meshRef} position={[0, 0, 0.16]}>
        <planeGeometry args={[13.8, 6.5]} />
        <meshBasicMaterial
          map={texRef.current ?? undefined}
          toneMapped={false}
        />
      </mesh>
      {/* Screen glow light */}
      <pointLight position={[0, 0, 1.2]} color="#8844ff" intensity={60 + bass * 120} distance={14} />
    </group>
  );
}

/* ─── Speaker stacks ─────────────────────────────────────────────────────── */
function SpeakerStack({ x, color, bass }: { x: number; color: string; bass: number }) {
  const wooferRef = useRef<Mesh>(null);
  useFrame(() => {
    if (!wooferRef.current) return;
    const p = 1 + bass * 0.07;
    wooferRef.current.scale.set(p, p, p);
  });
  return (
    <group position={[x, 1.6, -0.5]}>
      <mesh castShadow>
        <boxGeometry args={[1.4, 4.2, 1.4]} />
        <meshStandardMaterial color="#07090d" metalness={0.52} roughness={0.32} />
      </mesh>
      {[1.1, -0.2, -1.4].map((y, i) => (
        <mesh key={i} ref={i === 0 ? wooferRef : undefined} position={[0, y, 0.72]}>
          <cylinderGeometry args={[0.44, 0.44, 0.15, 40]} />
          <meshStandardMaterial color="#101820" emissive={color} emissiveIntensity={0.65 + bass * 1.4} />
        </mesh>
      ))}
      {/* horn tweeter */}
      <mesh position={[0, 1.55, 0.72]}>
        <boxGeometry args={[0.5, 0.28, 0.14]} />
        <meshStandardMaterial color="#0d1018" emissive={color} emissiveIntensity={0.4} />
      </mesh>
    </group>
  );
}

/* ─── Laser beams ────────────────────────────────────────────────────────── */
function LaserBeams({ treble }: { treble: number }) {
  const beamRefs = useRef<Mesh[]>([]);
  const configs = useMemo(() => [
    { x: -7,   color: '#ff00ff', phase: 0 },
    { x: -3.5, color: '#00e5ff', phase: 1.1 },
    { x:  0,   color: '#ff6a00', phase: 2.2 },
    { x:  3.5, color: '#7aff00', phase: 3.3 },
    { x:  7,   color: '#ff2fd1', phase: 4.4 },
  ], []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    beamRefs.current.forEach((b, i) => {
      if (!b) return;
      const cfg = configs[i];
      b.rotation.z = Math.sin(t * 0.75 + cfg.phase) * 0.42;
      b.rotation.x = -0.38 + Math.sin(t * 0.52 + cfg.phase * 1.4) * 0.24;
      (b.material as MeshStandardMaterial).opacity =
        (treble > 0.12 ? 0.52 : 0.2) + Math.sin(t * 3 + cfg.phase) * 0.12;
    });
  });

  return (
    <group position={[0, 9.5, -1]}>
      {configs.map((cfg, i) => (
        <mesh key={i} ref={node => { if (node) beamRefs.current[i] = node; }}
          position={[cfg.x, 0, 0]}>
          <cylinderGeometry args={[0.022, 0.25, 16, 8, 1, true]} />
          <meshBasicMaterial color={cfg.color} transparent opacity={0.42}
            side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

/* ─── Strobe bar ─────────────────────────────────────────────────────────── */
function StrobeBar({ bass }: { bass: number }) {
  const lights = useRef<PointLight[]>([]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    lights.current.forEach((l, i) => {
      if (!l) return;
      l.intensity = (Math.sin(t * 18 + i * 1.2) > 0.72 && bass > 0.28) ? 160 : 0;
    });
  });
  return (
    <group position={[0, 9.8, -1.5]}>
      {[-5, -2.5, 0, 2.5, 5].map((x, i) => (
        <group key={i} position={[x, 0, 0]}>
          <mesh>
            <boxGeometry args={[0.32, 0.22, 0.26]} />
            <meshStandardMaterial color="#0d0d18" metalness={0.8} roughness={0.3} />
          </mesh>
          <mesh position={[0, -0.13, 0]}>
            <circleGeometry args={[0.09, 12]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          <pointLight ref={node => { if (node) lights.current[i] = node; }}
            position={[0, -0.2, 0]} color="#fff8e8" intensity={0} distance={22} />
        </group>
      ))}
    </group>
  );
}

/* ─── Fog machines / smoke ───────────────────────────────────────────────── */
function FogMachines() {
  return (
    <>
      {[-4.5, -1.8, 1.8, 4.5].map((x, i) => (
        <group key={i} position={[x, 0.08, 1.8]}>
          <mesh>
            <boxGeometry args={[0.42, 0.24, 0.3]} />
            <meshStandardMaterial color="#0d0d16" metalness={0.8} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.35, 0]}>
            <sphereGeometry args={[0.5 + (i % 3) * 0.14, 14, 10]} />
            <meshBasicMaterial color={i % 2 ? '#d0ddf2' : '#e0d4f8'}
              transparent opacity={0.04} depthWrite={false} />
          </mesh>
        </group>
      ))}
      {/* atmospheric haze */}
      {[-5, -2.5, 0, 2.5, 5].map((x, i) => (
        <mesh key={`h-${i}`} position={[x, 0.6, -0.5]} scale={[4, 0.7, 2]}>
          <sphereGeometry args={[1, 14, 10]} />
          <meshBasicMaterial color={i % 2 ? '#c0cce8' : '#d0c0e8'}
            transparent opacity={0.018} depthWrite={false} />
        </mesh>
      ))}
    </>
  );
}

/* ─── Festival crowd (outdoor, backlit by sunset) ────────────────────────── */
function Crowd({ bass }: { bass: number }) {
  const TOTAL = 80;
  const refs = useRef<(Group | null)[]>([]);
  const offsets = useMemo(() =>
    Array.from({ length: TOTAL }, (_, i) => ({
      x: -10 + (i % 20) * 1.06 + (Math.random() - 0.5) * 0.55,
      z: 6.5 + Math.floor(i / 20) * 1.55 + Math.random() * 0.6,
      phase:    Math.random() * Math.PI * 2,
      speed:    2.0 + Math.random() * 1.0,
      armPhase: Math.random() * Math.PI * 2,
      /* warm sunset silhouette tones */
      skin:  `hsl(${22 + Math.floor(Math.random() * 45)},${30 + Math.floor(Math.random() * 38)}%,${22 + Math.floor(Math.random() * 32)}%)`,
      shirt: `hsl(${Math.floor(Math.random() * 360)},55%,${10 + Math.floor(Math.random() * 14)}%)`,
    })), []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    refs.current.forEach((g, i) => {
      if (!g) return;
      const o = offsets[i];
      g.position.y = Math.abs(Math.sin(t * (o.speed + bass * 5.5) + o.phase)) * (0.1 + bass * 0.35);
    });
  });

  return (
    <>
      {offsets.map((o, i) => (
        <group key={i} ref={node => { refs.current[i] = node; }} position={[o.x, -0.1, o.z]}>
          <mesh position={[0, 1.64, 0]}>
            <sphereGeometry args={[0.14, 10, 10]} />
            <meshStandardMaterial color={o.skin} roughness={0.85} />
          </mesh>
          <mesh position={[0, 1.1, 0]}>
            <capsuleGeometry args={[0.14, 0.56, 4, 8]} />
            <meshStandardMaterial color={o.shirt} roughness={0.9} />
          </mesh>
          {/* raised arms */}
          <mesh position={[-0.22, 1.48, 0]} rotation={[0, 0, -0.5 + Math.sin(o.armPhase) * 0.22]}>
            <capsuleGeometry args={[0.055, 0.46, 3, 6]} />
            <meshStandardMaterial color={o.skin} roughness={0.88} />
          </mesh>
          <mesh position={[0.22, 1.5, 0]} rotation={[0, 0, 0.5 + Math.sin(o.armPhase + 1) * 0.22]}>
            <capsuleGeometry args={[0.055, 0.48, 3, 6]} />
            <meshStandardMaterial color={o.skin} roughness={0.88} />
          </mesh>
          <mesh position={[-0.1, 0.58, 0]}>
            <capsuleGeometry args={[0.075, 0.52, 3, 6]} />
            <meshStandardMaterial color={o.shirt} />
          </mesh>
          <mesh position={[0.1, 0.58, 0]}>
            <capsuleGeometry args={[0.075, 0.52, 3, 6]} />
            <meshStandardMaterial color={o.shirt} />
          </mesh>
        </group>
      ))}
    </>
  );
}

/* ─── Full outdoor stage scene ───────────────────────────────────────────── */
function OutdoorStage({ isPlaying, onPlay }: { isPlaying: boolean; onPlay: () => void }) {
  const root = useRef<Group>(null);
  const analyserData = useRef<Uint8Array | null>(null);
  const shake = useRef({ x: 0, y: 0 });
  const audio = useRef({ bass: 0.05, mid: 0.04, treble: 0.04 });

  useFrame(({ clock, camera }, dt) => {
    const t = clock.elapsedTime;
    let bass = isPlaying ? 0.34 + Math.sin(t * 7.2) * 0.18 : 0.05;
    let mid  = isPlaying ? 0.28 + Math.sin(t * 4.5) * 0.14 : 0.04;
    let treble = isPlaying ? 0.22 + Math.sin(t * 13) * 0.14 : 0.03;
    const analyser = getAnalyser();
    if (analyser) {
      if (!analyserData.current || analyserData.current.length !== analyser.frequencyBinCount)
        analyserData.current = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(analyserData.current);
      const avg = (a: number, b: number) => {
        let s = 0;
        for (let i = a; i < Math.min(b, analyserData.current!.length); i++) s += analyserData.current![i];
        return s / Math.max(1, b - a) / 255;
      };
      bass = avg(0, 12); mid = avg(12, 80); treble = avg(80, 220);
    }
    audio.current.bass   += (bass   - audio.current.bass)   * Math.min(1, dt * 14);
    audio.current.mid    += (mid    - audio.current.mid)    * Math.min(1, dt * 10);
    audio.current.treble += (treble - audio.current.treble) * Math.min(1, dt * 8);
    const { bass: b } = audio.current;

    if (root.current) root.current.position.y = Math.sin(t * 32) * b * 0.01;
    camera.position.x -= shake.current.x;
    camera.position.y -= shake.current.y;
    shake.current.x = b > 0.12 ? (Math.random() - 0.5) * b * 0.005 : 0;
    shake.current.y = b > 0.12 ? (Math.random() - 0.5) * b * 0.003 : 0;
    camera.position.x += shake.current.x;
    camera.position.y += shake.current.y;
  });

  const { bass, mid, treble } = audio.current;

  return (
    <group ref={root}>
      {/* ── Outdoor backdrop ── */}
      <SunsetSky />
      <OutdoorGround />

      {/* ── Stage ── */}
      <FestivalStage />

      {/* ── Pioneer DJ console (centred on booth table) ── */}
      <Suspense fallback={null}>
        <Center disableX disableZ>
          <PioneerDeck />
        </Center>
      </Suspense>

      {/* Jog wheels overlaid on the Pioneer console */}
      <JogWheel x={-1.22} isPlaying={isPlaying} />
      <JogWheel x={ 1.22} isPlaying={isPlaying} />

      {/* Play button */}
      <Interactive position={[0, 1.18, 1.1]} onSelect={onPlay}>
        <TransportButton active={isPlaying} />
      </Interactive>

      {/* ── Speaker stacks ── */}
      <SpeakerStack x={-6.4} color="#e040fb" bass={bass} />
      <SpeakerStack x={ 6.4} color="#ff6a00" bass={bass} />

      {/* ── Cyberpunk city screen ── */}
      <CyberpunkScreen bass={bass} mid={mid} treble={treble} />

      {/* ── Truss rigs ── */}
      <Truss y={10.5} z={-2}   width={18} />
      <Truss y={10.5} z={1.5}  width={18} />
      <Truss y={10.5} z={5.5}  width={18} />

      {/* ── Moving heads ── */}
      {([
        [-7, 10.3, -1.8, '#ff00ff', 0],    [-3.5, 10.3, -1.8, '#00e5ff', 1.4],
        [ 0,  10.3, -1.8, '#ff6a00', 2.8], [ 3.5, 10.3, -1.8, '#20ffcc', 4.2],
        [ 7,  10.3, -1.8, '#e040fb', 5.6], [-5,   10.3,  1.5, '#00bfff', 0.7],
        [ 0,  10.3,  1.5, '#ff2fd1', 2.1], [ 5,   10.3,  1.5, '#ffe066', 3.5],
        [-7,  10.3,  5.5, '#ff6a00', 1.0], [ 0,   10.3,  5.5, '#00e5ff', 2.5],
        [ 7,  10.3,  5.5, '#ff0040', 4.0],
      ] as [number,number,number,string,number][]).map(([x,y,z,col,ph], i) => (
        <MovingHead key={i} position={[x, y, z]} color={col} phase={ph} />
      ))}

      {/* ── Effects ── */}
      <LaserBeams treble={treble} />
      <StrobeBar bass={bass} />
      <FogMachines />

      {/* ── Crowd ── */}
      <Crowd bass={bass} />

      {/* ── Warm sunset fill lights (match outdoor golden hour) ── */}
      {/* Key light from low sun angle — no shadow cast (saves texture units) */}
      <directionalLight position={[12, 4, 15]} color="#ffb347" intensity={3.5} />
      {/* Sky fill */}
      <hemisphereLight args={['#87ceeb', '#3d2a0a', 1.4]} />
      {/* Stage wash warm — no castShadow (saves 2 texture units) */}
      <spotLight position={[-5, 9, 1]} color="#ffe0a0" intensity={280} angle={0.35} penumbra={0.7} />
      <spotLight position={[ 5, 9, 1]} color="#ffe0a0" intensity={280} angle={0.35} penumbra={0.7} />
      {/* Colour side fills — orange/cyan contrast */}
      <spotLight position={[-10, 6, 4]} color="#ff6a00" intensity={200} angle={0.6} penumbra={1} />
      <spotLight position={[ 10, 6, 4]} color="#00e5ff" intensity={200} angle={0.6} penumbra={1} />
      {/* LED wall glow */}
      <pointLight position={[0, 5, -7]} color="#aa3300" intensity={110} distance={18} />
      {/* Under-stage warm glow */}
      <pointLight position={[0, -0.2, 2]} color="#ff7722" intensity={55} distance={12} />

      {/* Simple shadow disc — replaces ContactShadows (avoids extra render target texture unit) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.34, 0]} receiveShadow>
        <circleGeometry args={[10, 48]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.38} depthWrite={false} />
      </mesh>
    </group>
  );
}

/* ─── XR bridge ──────────────────────────────────────────────────────────── */
function XRBridge({ onRenderer }: { onRenderer: (r: WebGLRenderer) => void }) {
  const { gl } = useThree();
  useEffect(() => { gl.xr.enabled = true; onRenderer(gl); }, [gl, onRenderer]);
  return null;
}

/* ─── VR DJ deck panel helpers ───────────────────────────────────────────── */
const FX_LIST = ['ECHO', 'REVERB', 'FILTER', 'LOOP'] as const;

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function VRDeckStrip({
  deck, label, deckKey, ensureAudio,
}: {
  deck: UseDeck; label: string; deckKey: 'A' | 'B'; ensureAudio: () => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  const [loopBeats, setLoopBeats] = useState(4);
  const fileRef = useRef<HTMLInputElement>(null);
  const isA = deckKey === 'A';
  const { track, playing, hotCues, looping, echo, reverb, filterCutoff, tempo } = deck.state;

  const loadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try { await ensureAudio(); await deck.load(file); }
    catch { /* ignore */ }
    finally { setLoading(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const triggerFx = async (fx: typeof FX_LIST[number]) => {
    if (!track) return;
    await ensureAudio();
    if (fx === 'ECHO')   { deck.setEcho(!echo); return; }
    if (fx === 'REVERB') { deck.setReverb(!reverb); return; }
    if (fx === 'FILTER') { deck.setFilter(Math.abs(filterCutoff) > 0.02 ? 0 : isA ? -0.55 : 0.55); return; }
    if (fx === 'LOOP')   { looping ? deck.toggleLoop() : deck.setBeatLoop(loopBeats); }
  };

  const fxActive = (fx: typeof FX_LIST[number]) => {
    if (fx === 'ECHO')   return echo;
    if (fx === 'REVERB') return reverb;
    if (fx === 'FILTER') return Math.abs(filterCutoff) > 0.02;
    if (fx === 'LOOP')   return looping;
    return false;
  };

  const elapsed   = track ? fmt(deck.position * (track.duration ?? 0)) : '0:00';
  const remaining = track ? fmt((1 - deck.position) * (track.duration ?? 0)) : '0:00';
  const bpm       = Math.round(tempo * 128);
  const pctLabel  = (v: number) => { const p = Math.round((v - 1) * 100); return p === 0 ? '0%' : p > 0 ? `+${p}%` : `${p}%`; };

  return (
    <div className={`vr-deck-strip vr-deck-${deckKey.toLowerCase()}`}>
      {/* ── Header row ── */}
      <div className="vr-deck-header">
        <span className="vr-deck-label">DECK {label}</span>
        <span className="vr-deck-track" title={track?.name ?? 'No track'}>
          {loading ? 'Loading…' : track ? track.name.substring(0, 22) : 'No track loaded'}
        </span>
        <span className="vr-deck-time">{elapsed} / {remaining}</span>
        <span className="vr-deck-bpm">{bpm} BPM</span>
      </div>

      {/* ── Progress bar ── */}
      <div className="vr-progress-bar">
        <div className="vr-progress-fill" style={{ width: `${(deck.position * 100).toFixed(1)}%` }} />
      </div>

      {/* ── Transport controls ── */}
      <div className="vr-transport">
        <button className="vr-btn vr-btn-load" onClick={() => fileRef.current?.click()} title="Load track from file">
          📂 LOAD
        </button>
        <input ref={fileRef} type="file" accept="audio/*,.wav,.mp3,.flac,.aiff,.aif" onChange={loadFile} hidden />

        <button className="vr-btn vr-btn-cue" disabled={!track}
          onClick={() => { if (!playing) deck.setCue(deck.position); else deck.jumpCue(); }}>
          CUE
        </button>

        <button
          className={`vr-btn vr-btn-play${playing ? ' active' : ''}`}
          disabled={!track || loading}
          onClick={deck.togglePlay}
          title={playing ? 'Pause' : 'Play'}
        >
          {playing ? '⏸ PAUSE' : '▶ PLAY'}
        </button>

        <button className={`vr-btn vr-btn-sync${isA ? '' : ' b'}`} disabled={!track}>
          SYNC
        </button>

        <button className="vr-btn vr-btn-stop" disabled={!track}
          onClick={() => { if (playing) deck.togglePlay(); deck.seek(0); }}>
          ■ STOP
        </button>
      </div>

      {/* ── Seek bar (click to seek) ── */}
      <input className="vr-seek-slider" type="range" min={0} max={1} step={0.001}
        value={deck.position}
        disabled={!track}
        onChange={e => { void ensureAudio(); deck.seek(parseFloat(e.target.value)); }}
      />

      {/* ── FX + EQ row ── */}
      <div className="vr-fx-row">
        <span className="vr-section-label">FX</span>
        {FX_LIST.map(fx => (
          <button key={fx}
            className={`vr-btn vr-btn-fx${fxActive(fx) ? ' active' : ''}`}
            disabled={!track}
            onClick={() => void triggerFx(fx)}>
            {fx}
          </button>
        ))}
        <span className="vr-section-label" style={{ marginLeft: 8 }}>EQ</span>
        {(['eqHigh', 'eqMid', 'eqLow'] as const).map(band => (
          <label key={band} className="vr-eq-label">
            {band.replace('eq', '')}
            <input type="range" className="vr-knob-range"
              min={-12} max={12} step={0.5}
              value={deck.state[band]}
              disabled={!track}
              onChange={e => deck.setEq(band, parseFloat(e.target.value))} />
            <span>{deck.state[band] > 0 ? '+' : ''}{deck.state[band].toFixed(0)}</span>
          </label>
        ))}
      </div>

      {/* ── Loop controls ── */}
      <div className="vr-loop-row">
        <span className="vr-section-label">LOOP</span>
        <button className="vr-btn" disabled={!track} onClick={() => { deck.setLoopIn(deck.position); }}>IN</button>
        <button className="vr-btn" disabled={!track} onClick={() => deck.setLoopOut(Math.max(deck.state.loopIn + 0.001, deck.position))}>OUT</button>
        <select className="vr-btn vr-select" value={loopBeats} disabled={!track}
          onChange={e => { const n = Number(e.target.value); setLoopBeats(n); if (looping) deck.setBeatLoop(n); }}>
          <option value={1}>1 BEAT</option>
          <option value={2}>2 BEAT</option>
          <option value={4}>4 BEAT</option>
          <option value={8}>8 BEAT</option>
          <option value={16}>16 BEAT</option>
        </select>
        <button className={`vr-btn${looping ? ' active' : ''}`} disabled={!track}
          onClick={() => { looping ? deck.toggleLoop() : deck.setBeatLoop(loopBeats); }}>
          {looping ? '↺ ON' : '↺ LOOP'}
        </button>
        {/* Pitch slider */}
        <span className="vr-section-label" style={{ marginLeft: 10 }}>PITCH</span>
        <input type="range" className="vr-pitch-range" min={0.5} max={2.0} step={0.01}
          value={tempo} disabled={!track}
          onDoubleClick={() => deck.setTempo(1.0)}
          onChange={e => deck.setTempo(parseFloat(e.target.value))} />
        <span className="vr-pitch-val">{pctLabel(tempo)}</span>
      </div>

      {/* ── Hot cue pads ── */}
      <div className="vr-hotcue-row">
        <span className="vr-section-label">HOT CUES</span>
        {[1,2,3,4,5,6,7,8].map(n => (
          <button key={n}
            className={`vr-btn vr-btn-hotcue${hotCues[n-1] !== null ? ' active' : ''}`}
            disabled={!track}
            title={hotCues[n-1] === null ? `Set hot cue ${n}` : `Jump to cue ${n}`}
            onClick={async () => {
              if (!track) return;
              await ensureAudio();
              if (hotCues[n-1] === null) deck.setHotCue(n-1, deck.position);
              else deck.jumpHotCue(n-1);
            }}>
            {n}
          </button>
        ))}
        {/* Volume fader */}
        <span className="vr-section-label" style={{ marginLeft: 10 }}>VOL</span>
        <input type="range" className="vr-vol-range" min={0} max={1} step={0.01}
          value={deck.state.volume}
          onChange={e => deck.setVolume(parseFloat(e.target.value))} />
        <span className="vr-pitch-val">{Math.round(deck.state.volume * 100)}%</span>
      </div>
    </div>
  );
}

/* ─── VR Mixer strip (crossfader + master) ───────────────────────────────── */
function VRMixerStrip({
  crossfader, setCrossfader, masterVolume, setMasterVolume,
}: {
  crossfader: number;
  setCrossfader: (v: number) => void;
  masterVolume: number;
  setMasterVolume: (v: number) => void;
}) {
  return (
    <div className="vr-mixer-strip">
      <span className="vr-mixer-title">MIXER</span>

      <label className="vr-mixer-row">
        <span>CROSSFADER</span>
        <span className="vr-cf-labels"><b className="a">A</b><b className="b">B</b></span>
        <input type="range" className="vr-cf-range" min={-1} max={1} step={0.01}
          value={crossfader}
          onDoubleClick={() => setCrossfader(0)}
          onChange={e => setCrossfader(parseFloat(e.target.value))}
          title="Double-click to centre" />
        <span className="vr-pitch-val">{crossfader > 0 ? `B +${Math.round(crossfader*100)}%` : crossfader < 0 ? `A +${Math.round(-crossfader*100)}%` : 'CTR'}</span>
      </label>

      <label className="vr-mixer-row">
        <span>MASTER VOL</span>
        <input type="range" className="vr-vol-range" min={0} max={1} step={0.01}
          value={masterVolume}
          onChange={e => setMasterVolume(parseFloat(e.target.value))} />
        <span className="vr-pitch-val">{Math.round(masterVolume * 100)}%</span>
      </label>
    </div>
  );
}

/* ─── Exported component ─────────────────────────────────────────────────── */
export default function VRMode({
  isPlaying = false,
  onPlay = () => undefined,
  deckA,
  deckB,
  ensureAudio = async () => undefined,
  crossfader = 0,
  setCrossfader = () => undefined,
  masterVolume = 0.8,
  setMasterVolume = () => undefined,
}: VRModeProps) {
  const [open, setOpen] = useState(false);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [active, setActive] = useState(false);
  const [message, setMessage] = useState('Connect a headset, then enter immersive VR.');
  const rendererRef = useRef<WebGLRenderer | null>(null);
  const sessionRef  = useRef<XRSessionLike | null>(null);

  useEffect(() => {
    const xr = (navigator as Navigator & { xr?: XRSystemLike }).xr;
    if (!xr) { setSupported(false); return; }
    void xr.isSessionSupported('immersive-vr').then(setSupported).catch(() => setSupported(false));
  }, []);

  const enterVR = async () => {
    const xr = (navigator as Navigator & { xr?: XRSystemLike }).xr;
    const renderer = rendererRef.current;
    if (!xr || !renderer || !supported) {
      setMessage('Immersive WebXR is unavailable in this browser or no compatible headset is connected.');
      return;
    }
    try {
      const session = await xr.requestSession('immersive-vr', {
        optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'],
      });
      sessionRef.current = session;
      session.addEventListener('end', () => {
        sessionRef.current = null; setActive(false); setMessage('VR session ended.');
      }, { once: true });
      await renderer.xr.setSession(session as Parameters<typeof renderer.xr.setSession>[0]);
      setActive(true);
      setMessage('Immersive VR session active.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'The VR session could not be started.');
    }
  };

  const close = async () => {
    if (sessionRef.current) await sessionRef.current.end().catch(() => undefined);
    setOpen(false);
  };

  return (
    <>
      <button className="vr-floating-launcher" onClick={() => setOpen(true)}
        aria-label="Open VR Stage" title="Open outdoor sunset DJ Stage in VR">
        <svg viewBox="0 0 64 40" aria-hidden="true">
          <path d="M7 7h50c3 0 5 2 5 5v15c0 4-3 6-6 6H43l-7-8h-8l-7 8H8c-4 0-6-2-6-6V12c0-3 2-5 5-5Z" />
          <circle cx="17" cy="20" r="6" /><circle cx="47" cy="20" r="6" />
        </svg>
        <span>VR</span>
      </button>

      {open && (
        <section className="vr-immersive-overlay" role="dialog" aria-modal="true"
          aria-label="Outdoor Sunset DJ Stage">

          {/* ── Top toolbar ── */}
          <div className="vr-immersive-toolbar">
            <div>
              <b>OUTDOOR SUNSET STAGE — WEBXR DJ DECK</b>
              <span>{message}</span>
            </div>
            <button className="vr-enter-button" onClick={() => void enterVR()}
              disabled={!supported || active}>
              {active ? 'VR ACTIVE' : supported === null ? 'CHECKING…'
                : supported ? 'ENTER VR' : 'VR NOT SUPPORTED'}
            </button>
            <button className="vr-close-button" onClick={() => void close()} aria-label="Close">×</button>
          </div>

          {/* ── 3D Canvas ── */}
          <Canvas
            shadows
            gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
            camera={{ position: [0, 3.8, 11], fov: 55, near: 0.1, far: 300 }}
          >
            <XRBridge onRenderer={r => { rendererRef.current = r; }} />
            <fog attach="fog" args={['#c06020', 38, 120]} />
            <ambientLight intensity={0.22} color="#ffcf8a" />
            <OrbitControls makeDefault enableZoom enablePan={false}
              minPolarAngle={0.15} maxPolarAngle={1.52}
              minDistance={4} maxDistance={22} target={[0, 2, 0]} />
            <Suspense fallback={null}>
              <OutdoorStage isPlaying={isPlaying} onPlay={onPlay} />
            </Suspense>
          </Canvas>

          <div className="vr-desktop-hint">
            Drag to look · scroll to zoom · use controls below to DJ
          </div>

          {/* ── Full DJ control panel ── */}
          <div className="vr-dj-panel">
            {/* Deck A */}
            {deckA ? (
              <VRDeckStrip deck={deckA} label="A" deckKey="A" ensureAudio={ensureAudio} />
            ) : (
              <div className="vr-deck-strip vr-deck-placeholder">
                <span>Deck A — not connected</span>
              </div>
            )}

            {/* Mixer centre column */}
            <VRMixerStrip
              crossfader={crossfader}
              setCrossfader={setCrossfader}
              masterVolume={masterVolume}
              setMasterVolume={setMasterVolume}
            />

            {/* Deck B */}
            {deckB ? (
              <VRDeckStrip deck={deckB} label="B" deckKey="B" ensureAudio={ensureAudio} />
            ) : (
              <div className="vr-deck-strip vr-deck-placeholder">
                <span>Deck B — not connected</span>
              </div>
            )}
          </div>
        </section>
      )}
    </>
  );
}
