'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';

interface Cell { x: number; y: number; char: string; litUntil: number }
interface Props {
  headingLines?: string[];
  leftImage?: string;
  rightImage?: string;
  columns?: number;
  cellSize?: number;
  asciiChars?: string;
  parallaxStrength?: number;
  revealOnScroll?: boolean;
  className?: string;
}

function sampleImage(image: HTMLImageElement, columns: number, chars: string) {
  const rows = Math.max(1, Math.round(columns * image.naturalHeight / image.naturalWidth));
  const sampler = document.createElement('canvas');
  sampler.width = columns;
  sampler.height = rows;
  const context = sampler.getContext('2d', { willReadFrequently: true });
  if (!context) return { rows, cells: [] as Cell[] };
  context.drawImage(image, 0, 0, columns, rows);
  const pixels = context.getImageData(0, 0, columns, rows).data;
  const cells: Cell[] = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
    const offset = (y * columns + x) * 4;
    const alpha = pixels[offset + 3] / 255;
    const light = (pixels[offset] * .299 + pixels[offset + 1] * .587 + pixels[offset + 2] * .114) / 255;
    if (alpha < .12 || light < .11) continue;
    cells.push({ x, y, char: chars[Math.min(chars.length - 1, Math.floor(light * chars.length))], litUntil: 0 });
  }
  return { rows, cells };
}

function AsciiImage({ src, side, columns, cellSize, chars, parallaxStrength }: { src: string; side: 'left' | 'right'; columns: number; cellSize: number; chars: string; parallaxStrength: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    let frame = 0;
    let cells: Cell[] = [];
    let rows = 1;
    let pointerX = 0;
    let pointerY = 0;
    let driftX = 0;
    let driftY = 0;
    const image = new Image();
    image.src = src;
    image.onload = () => {
      const sampled = sampleImage(image, columns, chars);
      cells = sampled.cells;
      rows = sampled.rows;
      const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = columns * cellSize * dpr;
      canvas.height = rows * cellSize * dpr;
      canvas.style.aspectRatio = `${columns}/${rows}`;
    };
    const move = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointerX = ((event.clientX / innerWidth) - .5) * parallaxStrength * 2;
      pointerY = ((event.clientY / innerHeight) - .5) * parallaxStrength * 2;
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) return;
      const cx = ((event.clientX - rect.left) / rect.width) * columns;
      const cy = ((event.clientY - rect.top) / rect.height) * rows;
      cells.filter(cell => Math.hypot(cell.x - cx, cell.y - cy) < 4.5).slice(0, 14).forEach(cell => { cell.litUntil = performance.now() + 260; });
    };
    window.addEventListener('pointermove', move);
    const draw = (now: number) => {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      const context = canvas.getContext('2d');
      if (context) {
        context.setTransform(dpr, 0, 0, dpr, 0, 0);
        context.clearRect(0, 0, columns * cellSize, rows * cellSize);
        context.font = `${Math.max(10, cellSize - 2)}px monospace`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        for (const cell of cells) {
          const lit = cell.litUntil > now;
          if (lit) { context.fillStyle = '#ff6a00'; context.fillRect(cell.x * cellSize, cell.y * cellSize, cellSize, cellSize); }
          context.fillStyle = lit ? '#08090d' : resolvedTheme === 'light' ? '#a94200' : '#a94b16';
          context.fillText(cell.char, cell.x * cellSize + cellSize / 2, cell.y * cellSize + cellSize / 2);
        }
      }
      driftX += (pointerX - driftX) * .05;
      driftY += (pointerY - driftY) * .05;
      const direction = side === 'left' ? 1 : -1;
      wrap.style.transform = `translate(${driftX * direction}px, ${-driftY}px) scale(1.04)`;
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('pointermove', move); };
  }, [cellSize, chars, columns, parallaxStrength, resolvedTheme, side, src]);

  return <div ref={wrapRef} className={`animated-footer-art ${side}`}><canvas ref={canvasRef} /></div>;
}

export default function AnimatedFooter({
  headingLines = ['BUILT BY', 'SHIVAM'], leftImage = '/animated-footer/image1.png', rightImage = '/animated-footer/image1.png',
  columns = 72, cellSize = 15, asciiChars = ' .:-=+*#%@', parallaxStrength = 18,
  revealOnScroll = true, className,
}: Props) {
  const rootRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const targets = root.querySelectorAll('[data-footer-reveal]');
    gsap.set(targets, { yPercent: 120, opacity: 0 });
    const reveal = () => gsap.to(targets, { yPercent: 0, opacity: 1, duration: .9, ease: 'power3.out', stagger: .025 });
    if (!revealOnScroll) { reveal(); return () => gsap.killTweensOf(targets); }
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { reveal(); observer.disconnect(); } }, { threshold: .25 });
    observer.observe(root);
    return () => { observer.disconnect(); gsap.killTweensOf(targets); };
  }, [revealOnScroll]);

  return (
    <footer ref={rootRef} className={cn('animated-footer', className)}>
      <AsciiImage src={leftImage} side="left" columns={columns} cellSize={cellSize} chars={asciiChars} parallaxStrength={parallaxStrength} />
      <AsciiImage src={rightImage} side="right" columns={columns} cellSize={cellSize} chars={asciiChars} parallaxStrength={parallaxStrength} />
      <div className="animated-footer-copy"><span data-footer-reveal>AI DJ STUDIO</span><p data-footer-reveal>Mix. Learn. Create. Repeat.</p></div>
      <div className="animated-footer-heading">
        {headingLines.map((line, index) => <h2 key={index} aria-label={line}>{Array.from(line).map((char, charIndex) => <span data-footer-reveal aria-hidden="true" key={charIndex}>{char === ' ' ? '\u00a0' : char}</span>)}</h2>)}
        <div className="animated-footer-links" data-footer-reveal>
          <a href="https://myportfolio-eight-xi-18.vercel.app/" target="_blank" rel="noreferrer">Visit Shivam’s portfolio</a>
          <a href="https://github.com/Ninjaboy249/AI-DJ-STUDIO-APP" target="_blank" rel="noreferrer">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 .7a11.3 11.3 0 0 0-3.57 22c.57.1.77-.25.77-.55v-2.17c-3.15.68-3.81-1.34-3.81-1.34-.51-1.31-1.26-1.66-1.26-1.66-1.03-.7.08-.69.08-.69 1.14.08 1.74 1.17 1.74 1.17 1.01 1.74 2.66 1.24 3.31.95.1-.74.4-1.24.72-1.52-2.51-.29-5.15-1.26-5.15-5.59 0-1.24.44-2.25 1.17-3.04-.12-.29-.51-1.44.11-3 0 0 .95-.31 3.11 1.16a10.7 10.7 0 0 1 5.66 0c2.16-1.47 3.11-1.16 3.11-1.16.62 1.56.23 2.71.11 3 .73.79 1.17 1.8 1.17 3.04 0 4.34-2.65 5.3-5.17 5.58.41.35.77 1.04.77 2.1v3.17c0 .3.21.66.78.55A11.3 11.3 0 0 0 12 .7Z" /></svg>
            Ninjaboy249/AI-DJ-STUDIO-APP
          </a>
        </div>
      </div>
    </footer>
  );
}
