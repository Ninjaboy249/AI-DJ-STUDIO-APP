'use client';
// LearnerPanel — beginner DJ tutorial section.

import { useState } from 'react';

interface Step {
  label: string;
  done: boolean;
}

interface Module {
  id: number;
  title: string;
  duration: string;
  description: string;
  steps: Step[];
  done?: boolean;
}

const MODULES: Module[] = [
  {
    id: 1,
    title: 'Getting Started with DJ Basics',
    duration: '15 min',
    done: true,
    description: 'Learn the fundamentals: BPM, musical keys, and basic mixing concepts.',
    steps: [
      { label: 'What is BPM and why it matters', done: true },
      { label: 'Understanding musical keys (Camelot wheel)', done: true },
      { label: 'Loading your first track', done: true },
    ],
  },
  {
    id: 2,
    title: 'Using the Decks & Transport',
    duration: '20 min',
    done: false,
    description: 'Master play, pause, cue points, and the vinyl platter controls.',
    steps: [
      { label: 'Play / Pause and the CUE button', done: true },
      { label: 'Setting hot cues for quick navigation', done: false },
      { label: 'Using the waveform to seek', done: false },
    ],
  },
  {
    id: 3,
    title: 'Mixing with the Crossfader',
    duration: '25 min',
    done: false,
    description: 'Blend two tracks seamlessly using the crossfader and channel faders.',
    steps: [
      { label: 'Equal-power crossfade explained', done: false },
      { label: 'Gain staging and channel volume', done: false },
      { label: 'Your first beatmatch transition', done: false },
    ],
  },
  {
    id: 4,
    title: 'EQ & Filter Techniques',
    duration: '20 min',
    done: false,
    description: 'Shape your sound with 3-band EQ and the DJ filter.',
    steps: [
      { label: 'Low / Mid / High shelf EQ explained', done: false },
      { label: 'DJ filter sweep (LPF / HPF)', done: false },
      { label: 'Classic DJ EQ mixing technique', done: false },
    ],
  },
  {
    id: 5,
    title: 'Loop & Cue Points',
    duration: '15 min',
    done: false,
    description: 'Create loops, set in/out points, and build tension in your mix.',
    steps: [
      { label: 'Setting loop in / out points', done: false },
      { label: 'Beat-length loops (4/8/16 beat)', done: false },
      { label: 'Using cue to drop back on beat', done: false },
    ],
  },
  {
    id: 6,
    title: 'AI DJ Features',
    duration: '10 min',
    done: false,
    description: 'Let the AI suggest transitions, match BPM, and generate beats.',
    steps: [
      { label: 'Asking AI DJ to smooth transitions', done: false },
      { label: 'Beat generator & AI playlists', done: false },
      { label: 'Crowd mood detection basics', done: false },
    ],
  },
];

const COMPLETED = MODULES.filter(m => m.done).length;
const PROGRESS_PCT = Math.round((COMPLETED / MODULES.length) * 100);

export default function LearnerPanel() {
  const [openModule, setOpenModule] = useState<number | null>(2);

  return (
    <div className="learner-panel" style={{ padding: '0 0.5rem', overflowY: 'auto', height: '100%' }}>
      <div className="learner-header" style={{ padding: '0.7rem 0.4rem', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: '0.9rem' }}>🎓</span>
        <span className="learner-title">DJ LEARN</span>
        <span style={{ fontSize: '0.7rem', color: 'var(--muted)', marginLeft: 'auto' }}>
          {COMPLETED}/{MODULES.length} complete
        </span>
      </div>

      <div className="learner-content">
        {/* Progress bar */}
        <div className="learner-progress">
          <div className="learner-progress-label">
            <span>Your Progress</span>
            <span style={{ fontWeight: 700, color: 'var(--text)' }}>{PROGRESS_PCT}%</span>
          </div>
          <div className="learner-progress-bar">
            <div className="learner-progress-fill" style={{ width: `${PROGRESS_PCT}%` }} />
          </div>
        </div>

        {/* Pro tip */}
        <div className="learner-tip">
          <div className="learner-tip-head">💡 Pro Tip</div>
          Mix tracks that are within 2 semitones of each other on the Camelot wheel for a
          harmonically pleasing blend — even if the BPMs differ by a few.
        </div>

        {/* Modules */}
        {MODULES.map(mod => (
          <div
            key={mod.id}
            className={`learner-module${openModule === mod.id ? ' active' : ''}${mod.done ? ' done' : ''}`}
            onClick={() => setOpenModule(v => v === mod.id ? null : mod.id)}
          >
            <div className="learner-module-head">
              <div className="learner-module-num">
                {mod.done ? '✓' : mod.id}
              </div>
              <div className="learner-module-title">{mod.title}</div>
              <div className="learner-module-dur">{mod.duration}</div>
            </div>

            {openModule === mod.id && (
              <div className="learner-module-body">
                <p style={{ margin: '0 0 0.4rem', fontSize: '0.72rem', color: 'var(--text2)' }}>
                  {mod.description}
                </p>
                <div className="learner-module-steps">
                  {mod.steps.map((step, i) => (
                    <div key={i} className={`learner-step${step.done ? ' done' : ''}`}>
                      {step.done
                        ? <span className="learner-step-check">✓</span>
                        : <span className="learner-step-num">{i + 1}</span>
                      }
                      {step.label}
                    </div>
                  ))}
                </div>
                <button className="btn-learner-start" style={{ marginTop: '0.6rem' }}>
                  {mod.done ? '↺ Review' : '▶ Start Lesson'}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
