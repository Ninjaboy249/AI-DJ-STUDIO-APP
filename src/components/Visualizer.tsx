'use client';
// Visualizer.tsx — Full-canvas live audio visualizer.
//
// Renders 8 layered effects on a single <canvas> that fills the .app background:
//
//   0. Background gradient (dark → deep purple wash on beat)
//   1. Audio spectrum bars  — EQ-style bars along the bottom, orange glow
//   2. Electric waves       — sine waves whose amplitude tracks sub-bass energy
//   3. Lasers               — radiating lines from center, colour-keyed to mids
//   4. Neon particles       — 120 particles that accelerate on bass hits
//   5. Equalizer rings      — concentric rings that pulse with each band
//   6. Shockwaves           — expanding circles triggered on loud transients
//   7. Smoke                — rising alpha blobs driven by low-frequency energy
//   8. Holograms            — rotating grid projected on kick transients
//
// The AnalyserNode is polled every animation frame (requestAnimationFrame).
// All state lives in refs — no React re-renders inside the loop.

import { useEffect, useRef } from 'react';
import { getAnalyser } from '../lib/audio';

// ── Constants ────────────────────────────────────────────────────────────────

const ORANGE      = '#ff8c00';
const ORANGE_DIM  = '#b85e00';
const CYAN        = '#00e5ff';
const MAGENTA     = '#ff00cc';
const LIME        = '#aaff00';
const BINS        = 1024; // analyser.frequencyBinCount at fftSize=2048

// ── Helpers ───────────────────────────────────────────────────────────────────

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

/** Average a slice of the frequency byte array (0–255) and normalise to 0–1. */
function bandEnergy(data: Uint8Array, lo: number, hi: number): number {
  let sum = 0;
  const n = hi - lo;
  for (let i = lo; i < hi; i++) sum += data[i];
  return sum / (n * 255);
}

// ── Particle type ─────────────────────────────────────────────────────────────

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number;       // 0–1
  maxLife: number;    // frames
  size: number;
  hue: number;        // 0–360
}

// ── Shockwave type ────────────────────────────────────────────────────────────

interface Shockwave {
  x: number; y: number;
  r: number;          // current radius
  maxR: number;
  alpha: number;
  color: string;
}

// ── Smoke blob type ───────────────────────────────────────────────────────────

interface Smoke {
  x: number; y: number;
  vx: number; vy: number;
  r: number;
  alpha: number;
  life: number;
}

// ── Hologram type ─────────────────────────────────────────────────────────────

interface Hologram {
  cx: number; cy: number;
  angle: number;
  size: number;
  alpha: number;
  color: string;
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  active: boolean;
}

export default function Visualizer({ active }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);

  // Persistent per-frame state in refs (avoids re-renders)
  const particlesRef  = useRef<Particle[]>([]);
  const shockwavesRef = useRef<Shockwave[]>([]);
  const smokeRef      = useRef<Smoke[]>([]);
  const hologramsRef  = useRef<Hologram[]>([]);

  // Beat-detection state
  const prevBassRef     = useRef(0);
  const shockCoolRef    = useRef(0); // frames until next shockwave allowed
  const holoCoolRef     = useRef(0);
  const frameRef        = useRef(0);

  // Smoothed band energies for inter-frame continuity
  const smoothBassRef  = useRef(0);
  const smoothMidRef   = useRef(0);
  const smoothHighRef  = useRef(0);
  const smoothVolumeRef = useRef(0);

  useEffect(() => {
    if (!active) {
      cancelAnimationFrame(rafRef.current);
      const cv = canvasRef.current;
      if (cv) {
        const ctx2d = cv.getContext('2d');
        if (ctx2d) ctx2d.clearRect(0, 0, cv.width, cv.height);
      }
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    // Narrowed, non-null alias used throughout the frame closure
    const cv  = canvas as HTMLCanvasElement;
    const ctx = cv.getContext('2d') as CanvasRenderingContext2D;
    let isVisible = true;
    let lastDrawAt = 0;

    // ── Resize handler ──────────────────────────────────────────────────────
    const resize = () => {
      // High-DPI canvases get expensive quickly. 1.5x stays sharp while keeping
      // the visualizer light enough to run alongside the audio engine.
      const scale = Math.min(window.devicePixelRatio || 1, 1.5);
      cv.width  = Math.max(1, Math.floor(cv.offsetWidth * scale));
      cv.height = Math.max(1, Math.floor(cv.offsetHeight * scale));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(cv);
    const io = new IntersectionObserver(([entry]) => {
      isVisible = entry.isIntersecting;
    }, { threshold: 0.01 });
    io.observe(cv);

    // Frequency data buffer
    const freqData = new Uint8Array(BINS);

    // ── Frame loop ──────────────────────────────────────────────────────────
    function frame(now: number) {
      rafRef.current = requestAnimationFrame(frame);
      // Pause expensive drawing when scrolled off-screen and cap at 30 FPS.
      if (!isVisible || document.hidden || now - lastDrawAt < 33) return;
      lastDrawAt = now;
      frameRef.current++;

      const W = cv.width;
      const H = cv.height;
      const cx = W / 2;
      const cy = H / 2;

      // Pull frequency data (returns silence if analyser not ready yet)
      const analyser = getAnalyser();
      if (analyser) {
        analyser.getByteFrequencyData(freqData);
      } else {
        freqData.fill(0);
      }

      // ── Band energies ────────────────────────────────────────────────────
      // Bin mapping for 44.1 kHz, fftSize 2048, 1024 bins:
      //   bin 0 = 0 Hz, bin k ≈ k * 21.5 Hz
      const subBass  = bandEnergy(freqData,   0,   4);  //  0 – 86 Hz
      const bass     = bandEnergy(freqData,   4,  20);  // 86 – 430 Hz
      const mids     = bandEnergy(freqData,  20,  80);  // 430 – 1.7 kHz
      const highmids = bandEnergy(freqData,  80, 200);  // 1.7 – 4.3 kHz
      const highs    = bandEnergy(freqData, 200, 512);  // 4.3 – 11 kHz
      const volume   = bandEnergy(freqData,   0, 512);

      // Smooth energies (IIR low-pass)
      smoothBassRef.current   = lerp(smoothBassRef.current,   bass,     0.15);
      smoothMidRef.current    = lerp(smoothMidRef.current,    mids,     0.12);
      smoothHighRef.current   = lerp(smoothHighRef.current,   highs,    0.1);
      smoothVolumeRef.current = lerp(smoothVolumeRef.current, volume,   0.1);

      const sB = smoothBassRef.current;
      const sM = smoothMidRef.current;
      const sV = smoothVolumeRef.current;

      // Beat detection: transient in bass band
      const bassDelta = bass - prevBassRef.current;
      const isBeat    = bassDelta > 0.08 && bass > 0.15;
      prevBassRef.current = bass;

      // ── 0. Background ────────────────────────────────────────────────────
      // Fade previous frame — creates motion trails
      ctx.globalAlpha       = 0.18 + sV * 0.12;
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#090a0e';
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;

      // Subtle beat flash
      if (isBeat) {
        ctx.globalAlpha = Math.min(0.12, bassDelta * 0.4);
        const beatGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.7);
        beatGrad.addColorStop(0, '#ff8c0044');
        beatGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = beatGrad;
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;
      }

      // ── 1. Spectrum bars ─────────────────────────────────────────────────
      const quality = W > 1400 ? 2 : W > 900 ? 1 : 0;
      const BAR_COUNT = quality >= 2 ? 48 : quality === 1 ? 36 : 24;
      const barW      = W / BAR_COUNT;
      const binStep   = Math.floor(BINS * 0.6 / BAR_COUNT); // use bottom 60% of spectrum
      ctx.globalCompositeOperation = 'screen';

      for (let i = 0; i < BAR_COUNT; i++) {
        const binIdx   = Math.floor(i * binStep);
        const energy   = freqData[binIdx] / 255;
        const barH     = energy * H * 0.45;
        const x        = i * barW;
        const hue      = 24 + i * 1.5; // orange → yellow sweep
        const alpha    = 0.55 + energy * 0.45;

        const barGrad = ctx.createLinearGradient(x, H, x, H - barH);
        barGrad.addColorStop(0, `hsla(${hue},100%,50%,${alpha})`);
        barGrad.addColorStop(0.6, `hsla(${hue + 20},90%,65%,${alpha * 0.6})`);
        barGrad.addColorStop(1, `hsla(${hue + 40},80%,80%,0)`);

        ctx.fillStyle = barGrad;
        ctx.fillRect(x, H - barH, barW - 1, barH);
      }
      ctx.globalCompositeOperation = 'source-over';

      // ── 2. Electric waves ────────────────────────────────────────────────
      ctx.globalCompositeOperation = 'screen';
      const WAVE_LINES = 3;
      for (let w = 0; w < WAVE_LINES; w++) {
        const wPhase  = frameRef.current * 0.018 + w * Math.PI * 0.66;
        const wAmp    = H * 0.08 * (subBass * 6 + 0.3) * (1 - w * 0.25);
        const wColor  = [ORANGE, CYAN, MAGENTA][w];
        const wAlpha  = 0.5 + sB * 0.5;

        ctx.beginPath();
        for (let px = 0; px <= W; px += 3) {
          const t      = px / W;
          const binIdx = Math.floor(t * 180);
          const fEnergy = freqData[binIdx] / 255;
          const py = cy
            + Math.sin(t * 12 + wPhase) * wAmp
            + Math.sin(t * 7  + wPhase * 1.3) * wAmp * 0.4
            + (fEnergy - 0.5) * H * 0.06;
          px === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.strokeStyle = wColor;
        ctx.lineWidth   = 1.5 + sB * 3;
        ctx.globalAlpha = wAlpha;
        ctx.shadowColor = wColor;
        ctx.shadowBlur  = 18 + sB * 30;
        ctx.stroke();
      }
      ctx.shadowBlur  = 0;
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';

      // ── 3. Lasers ────────────────────────────────────────────────────────
      ctx.globalCompositeOperation = 'screen';
      const LASER_COUNT = quality >= 2 ? 6 : quality === 1 ? 4 : 3;
      for (let l = 0; l < LASER_COUNT; l++) {
        const baseAngle = (l / LASER_COUNT) * Math.PI * 2
          + frameRef.current * 0.004 * (l % 2 === 0 ? 1 : -1);
        const binIdx  = Math.floor((l / LASER_COUNT) * 200) + 20;
        const energy  = freqData[binIdx] / 255;
        if (energy < 0.1) continue;

        const len   = (0.4 + energy * 0.6) * Math.max(W, H) * 0.7;
        const hue   = 30 + l * 40 + sM * 60;
        const alpha = 0.15 + energy * 0.55;

        const ex = cx + Math.cos(baseAngle) * len;
        const ey = cy + Math.sin(baseAngle) * len;

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(ex, ey);
        ctx.strokeStyle = `hsl(${hue},100%,65%)`;
        ctx.lineWidth   = 1 + energy * 3;
        ctx.globalAlpha = alpha;
        ctx.shadowColor = `hsl(${hue},100%,65%)`;
        ctx.shadowBlur  = 20 + energy * 40;
        ctx.stroke();
      }
      ctx.shadowBlur  = 0;
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';

      // ── 4. Neon particles ────────────────────────────────────────────────
      // Spawn new particles on beats
      if (isBeat || (frameRef.current % 3 === 0 && sB > 0.1)) {
        const count = isBeat ? 8 : 2;
        for (let i = 0; i < count; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = (1 + Math.random() * 3) * (1 + bass * 4);
          particlesRef.current.push({
            x: cx + (Math.random() - 0.5) * W * 0.3,
            y: cy + (Math.random() - 0.5) * H * 0.3,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 1,
            maxLife: 40 + Math.random() * 60,
            size: 1.5 + Math.random() * 3,
            hue: Math.random() * 60 + 10, // 10–70 (orange/yellow)
          });
        }
      }

      // Update + draw particles
      ctx.globalCompositeOperation = 'screen';
      particlesRef.current = particlesRef.current.filter((p) => p.life > 0);
      for (const p of particlesRef.current) {
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.97;
        p.vy *= 0.97;
        p.life -= 1 / p.maxLife;

        const alpha = p.life * 0.9;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.01, p.size * p.life), 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue},100%,65%,${alpha})`;
        ctx.shadowColor = `hsl(${p.hue},100%,65%)`;
        ctx.shadowBlur  = 8;
        ctx.fill();
      }
      // Cap particle count
      const particleLimit = quality >= 2 ? 180 : quality === 1 ? 120 : 80;
      if (particlesRef.current.length > particleLimit) {
        particlesRef.current = particlesRef.current.slice(-particleLimit);
      }
      ctx.shadowBlur  = 0;
      ctx.globalCompositeOperation = 'source-over';

      // ── 5. Equalizer rings ───────────────────────────────────────────────
      ctx.globalCompositeOperation = 'screen';
      const bands = [subBass, bass, mids, highmids, highs];
      const ringColors = [ORANGE, ORANGE_DIM, CYAN, MAGENTA, LIME];
      for (let r = 0; r < 5; r++) {
        const radius = (60 + r * 55) * (W / 1200) + bands[r] * 80 * (W / 1200);
        const alpha  = 0.15 + bands[r] * 0.65;
        if (alpha < 0.05) continue;

        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.strokeStyle = ringColors[r];
        ctx.lineWidth   = 1 + bands[r] * 4;
        ctx.globalAlpha = alpha;
        ctx.shadowColor = ringColors[r];
        ctx.shadowBlur  = 16 + bands[r] * 40;
        ctx.stroke();
      }
      ctx.shadowBlur  = 0;
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';

      // ── 6. Shockwaves ────────────────────────────────────────────────────
      // Spawn on loud transients
      if (isBeat && shockCoolRef.current <= 0 && bass > 0.25) {
        shockwavesRef.current.push({
          x: cx + (Math.random() - 0.5) * W * 0.4,
          y: cy + (Math.random() - 0.5) * H * 0.4,
          r: 20,
          maxR: 180 + bass * 300,
          alpha: 0.7 + bass * 0.3,
          color: Math.random() > 0.5 ? ORANGE : CYAN,
        });
        shockCoolRef.current = 12;
      }
      if (shockCoolRef.current > 0) shockCoolRef.current--;

      ctx.globalCompositeOperation = 'screen';
      shockwavesRef.current = shockwavesRef.current.filter((s) => s.alpha > 0.01);
      for (const s of shockwavesRef.current) {
        const progress = s.r / s.maxR;
        s.r     += (s.maxR - s.r) * 0.08 + 4;
        s.alpha *= 0.91;

        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.strokeStyle = s.color;
        ctx.lineWidth   = (1 - progress) * 6 + 0.5;
        ctx.globalAlpha = s.alpha;
        ctx.shadowColor = s.color;
        ctx.shadowBlur  = 24;
        ctx.stroke();
      }
      ctx.shadowBlur  = 0;
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';

      // ── 7. Smoke ─────────────────────────────────────────────────────────
      // Spawn rising smoke blobs from bottom driven by sub-bass
      if (frameRef.current % 4 === 0 && subBass > 0.05) {
        const count = Math.floor(subBass * 5) + 1;
        for (let i = 0; i < count; i++) {
          smokeRef.current.push({
            x: Math.random() * W,
            y: H * (0.85 + Math.random() * 0.15),
            vx: (Math.random() - 0.5) * 1.2,
            vy: -(0.4 + Math.random() * 1.2 + subBass * 3),
            r: 20 + Math.random() * 40 + subBass * 80,
            alpha: 0.04 + subBass * 0.08,
            life: 1,
          });
        }
      }

      ctx.globalCompositeOperation = 'screen';
      smokeRef.current = smokeRef.current.filter((s) => s.life > 0.01);
      for (const s of smokeRef.current) {
        s.x    += s.vx;
        s.y    += s.vy;
        s.r    += 0.6;
        s.life *= 0.985;
        s.alpha = s.life * 0.07;

        const sg = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r);
        sg.addColorStop(0, `rgba(180,100,60,${s.alpha})`);
        sg.addColorStop(0.5, `rgba(100,50,30,${s.alpha * 0.4})`);
        sg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle  = sg;
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      const smokeLimit = quality >= 2 ? 100 : quality === 1 ? 70 : 50;
      if (smokeRef.current.length > smokeLimit) smokeRef.current = smokeRef.current.slice(-smokeLimit);
      ctx.globalCompositeOperation = 'source-over';

      // ── 8. Holograms ─────────────────────────────────────────────────────
      // Spawn on kick transients
      if (isBeat && holoCoolRef.current <= 0 && bass > 0.3) {
        hologramsRef.current.push({
          cx: cx + (Math.random() - 0.5) * W * 0.5,
          cy: cy + (Math.random() - 0.5) * H * 0.5,
          angle: 0,
          size: 60 + Math.random() * 120,
          alpha: 0.45 + bass * 0.4,
          color: [CYAN, MAGENTA, ORANGE][Math.floor(Math.random() * 3)],
        });
        holoCoolRef.current = 20;
      }
      if (holoCoolRef.current > 0) holoCoolRef.current--;

      ctx.globalCompositeOperation = 'screen';
      hologramsRef.current = hologramsRef.current.filter((h) => h.alpha > 0.01);
      for (const h of hologramsRef.current) {
        h.angle += 0.025;
        h.alpha *= 0.96;
        h.size  += 0.8;

        ctx.save();
        ctx.translate(h.cx, h.cy);
        ctx.rotate(h.angle);
        ctx.globalAlpha = h.alpha;
        ctx.strokeStyle = h.color;
        ctx.shadowColor = h.color;
        ctx.shadowBlur  = 20;

        // Draw a grid-projected diamond (hologram projection aesthetic)
        const S = h.size;
        const GRID = 4;
        ctx.lineWidth = 0.8;
        for (let gi = -GRID; gi <= GRID; gi++) {
          const t = gi / GRID;
          // horizontal grid lines (foreshortened)
          const yOff  = t * S * 0.6;
          const xSpan = S * Math.sqrt(1 - t * t + 0.01);
          ctx.beginPath();
          ctx.moveTo(-xSpan, yOff);
          ctx.lineTo(xSpan,  yOff);
          ctx.stroke();
          // vertical grid lines
          const xOff  = t * S;
          const ySpan = S * 0.6;
          ctx.beginPath();
          ctx.moveTo(xOff, -ySpan);
          ctx.lineTo(xOff,  ySpan);
          ctx.stroke();
        }
        // Outer ellipse frame
        ctx.beginPath();
        ctx.ellipse(0, 0, S, S * 0.6, 0, 0, Math.PI * 2);
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.restore();
      }
      ctx.shadowBlur  = 0;
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    rafRef.current = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      io.disconnect();
    };
  }, [active]);

  return (
    <canvas
      ref={canvasRef}
      className="visualizer-canvas"
      aria-hidden="true"
    />
  );
}
