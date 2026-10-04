import React, { useState } from 'react';
import {
  GraduationCap,
  BookOpen,
  Sparkles,
  Cpu,
  CheckCircle2,
  X,
  Layers,
  Zap,
  HelpCircle,
  Award,
  ChevronRight,
  Info
} from 'lucide-react';

export default function Learn() {
  const [activeTab, setActiveTab] = useState('tutorials'); // 'tutorials' | 'exercises' | 'cheatsheets' | 'pinouts'
  const [activeLesson, setActiveLesson] = useState(null);

  // Guided Exercise State
  const [exercisePin1, setExercisePin1] = useState('A15');
  const [exercisePin2, setExercisePin2] = useState('F15');
  const [exerciseResult, setExerciseResult] = useState(null);

  // Cheat Sheet Modal State
  const [activeCheatSheet, setActiveCheatSheet] = useState(null);

  const modules = [
    {
      id: 'mod-1',
      title: 'Electronics 101: V, I, R Fundamentals',
      desc: 'Understanding Voltage (pressure), Current (flow), and Resistance (restriction).',
      lessons: 4,
      content: `
### Voltage, Current & Resistance Fundamentals

- **Voltage (V)**: The electrical potential difference between two points, measured in Volts. Think of it as water pressure pushing charges through a conductor.
- **Current (I)**: The rate of electrical charge flow, measured in Amperes (A) or Milliamperes (mA).
- **Resistance (R)**: The opposition to charge flow, measured in Ohms (Ω).

**Ohm's Law Equation**:
$$ V = I \\times R $$

**Example**: Connecting a 9V battery across a 1 kΩ resistor yields:
$$ I = \\frac{9\\text{V}}{1000\\,\\Omega} = 0.009\\text{A} = 9\\text{mA} $$
      `
    },
    {
      id: 'mod-2',
      title: 'Breadboard Anatomy & Tie-Point Pinouts',
      desc: 'Mastering power rails, terminal strips, DIP sockets, and tie-point connectivity.',
      lessons: 3,
      content: `
### Standard 830 Tie-Point Breadboard Layout

1. **Power Bus Rails (+ / -)**:
   - Run vertically along both outer edges.
   - All holes in a single red (+) or blue (-) rail are connected internally.
2. **Terminal Strips (Columns 1-63, Rows A-E & F-J)**:
   - Rows A, B, C, D, E in a column are connected together.
   - Rows F, G, H, I, J in a column are connected together.
3. **Center Divider Trough Channel**:
   - Isolates the top terminal strip (A-E) from the bottom terminal strip (F-J).
   - Designed specifically for straddling Dual-In-Line (DIP) IC chips.
      `
    },
    {
      id: 'mod-3',
      title: 'Resistor 4-Band & 5-Band Color Codes',
      desc: 'How to read color bands, calculate multipliers, and determine tolerances.',
      lessons: 5,
      content: `
### Reading Resistor Color Bands

- **4-Band Resistors**:
  - Band 1: First Significant Digit
  - Band 2: Second Significant Digit
  - Band 3: Multiplier ($10^n$)
  - Band 4: Tolerance (Gold = $\\pm 5\\%$, Silver = $\\pm 10\\%$)

**Mnemonics for Color Values**:
Black (0), Brown (1), Red (2), Orange (3), Yellow (4), Green (5), Blue (6), Violet (7), Grey (8), White (9).
      `
    },
    {
      id: 'mod-4',
      title: 'LEDs & Current-Limiting Resistors',
      desc: 'Protecting Light Emitting Diodes from overcurrent burnouts.',
      lessons: 4,
      content: `
### Protecting LEDs with Current-Limiting Resistors

LEDs have low internal resistance once turned on. Connecting an LED directly to a power source without a resistor will cause excessive current to destroy the LED.

**Limiting Resistor Formula**:
$$ R = \\frac{V_{\\text{supply}} - V_{\\text{LED}}}{I_{\\text{LED}}} $$

Standard Red LED ($V_{\\text{LED}} = 2.0\\text{V}$, $I_{\\text{LED}} = 20\\text{mA}$):
$$ R = \\frac{5\\text{V} - 2.0\\text{V}}{0.02\\text{A}} = 150\\,\\Omega $$
      `
    }
  ];

  const cheatSheets = [
    { id: 'cs-resistor', name: 'Resistor Cheat Sheet', type: 'Passive Component', details: 'Limits current flow. Color band calculation, SMD 3/4-digit codes, E24 standard values, power wattage ratings (1/8W, 1/4W, 1/2W, 1W).' },
    { id: 'cs-led', name: 'LED (Light Emitting Diode)', type: 'Optoelectronic', details: 'Polarized component. Anode (long leg, +), Cathode (short leg, flat edge, -). Typical forward drop: Red (2.0V), Green (2.2V), Blue (3.2V).' },
    { id: 'cs-capacitor', name: 'Capacitor Cheat Sheet', type: 'Energy Storage', details: 'Stores electrical charge. Ceramic (non-polarized, 104 = 100nF) vs Electrolytic (polarized, long leg +, stripe -).' },
    { id: 'cs-diode', name: 'Rectifier Diode (1N4007)', type: 'Semiconductor', details: 'Allows current in one direction only. Silver band marks Cathode (-). Max reverse voltage 1000V, forward voltage drop 0.7V.' }
  ];

  const handleValidateExercise = () => {
    if (exercisePin1 === 'A15' && exercisePin2 === 'F15') {
      setExerciseResult({
        success: true,
        message: 'Correct! Resistor R1 successfully bridges the center trough between column 15 row A and row F.'
      });
    } else {
      setExerciseResult({
        success: false,
        message: 'Incorrect placement. To bridge across the center channel, connect one pin to Rows A-E and the other to Rows F-J.'
      });
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">
          <GraduationCap size={28} style={{ color: 'var(--accent-cyan)' }} />
          Electronics Learning Hub & Interactive Workstation
        </h1>
        <p className="page-subtitle">
          Interactive tutorials, component cheat sheets, breadboard pinout guides, and guided circuit building exercises.
        </p>
      </div>

      {/* Navigation Sub-Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {[
          { id: 'tutorials', name: 'Tutorial Modules', icon: BookOpen },
          { id: 'exercises', name: 'Guided Circuit Exercises', icon: Zap },
          { id: 'cheatsheets', name: 'Component Cheat Sheets', icon: Cpu },
          { id: 'pinouts', name: 'Breadboard Pinout Guide', icon: Layers }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="btn"
              style={{
                background: isActive ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255,255,255,0.03)',
                color: isActive ? 'var(--accent-cyan)' : 'var(--text-muted)',
                border: `1px solid ${isActive ? 'var(--accent-cyan)' : 'var(--border-color)'}`
              }}
            >
              <Icon size={16} /> {tab.name}
            </button>
          );
        })}
      </div>

      {/* TAB 1: TUTORIAL MODULES */}
      {activeTab === 'tutorials' && (
        <div className="card-grid">
          {modules.map((mod) => (
            <div key={mod.id} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <div className="logo-icon">
                    <BookOpen size={20} />
                  </div>
                  <span className="code-pill">{mod.lessons} Lessons</span>
                </div>
                <h3 style={{ fontSize: '1.15rem', marginBottom: '0.5rem' }}>{mod.title}</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
                  {mod.desc}
                </p>
              </div>

              <button
                onClick={() => setActiveLesson(mod)}
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                Read Tutorial &rarr;
              </button>
            </div>
          ))}
        </div>
      )}

      {/* TAB 2: GUIDED CIRCUIT BUILDING EXERCISES */}
      {activeTab === 'exercises' && (
        <div className="card-grid" style={{ gridTemplateColumns: '2fr 1fr' }}>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Zap size={18} style={{ color: 'var(--accent-cyan)' }} />
                Exercise 1: Bridge Resistor Across Breadboard Channel
              </h2>
              <span className="code-pill">Interactive Exercise</span>
            </div>

            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1.25rem', lineHeight: '1.6' }}>
              **Objective**: Connect a 1 kΩ current-limiting resistor across the center divider channel on column 15. Place Pin 1 in Row A-E and Pin 2 in Row F-J.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem', display: 'block' }}>Resistor Pin 1 Socket</label>
                <select value={exercisePin1} onChange={e => setExercisePin1(e.target.value)} className="input-field">
                  <option value="A15">A15 (Top Strip Col 15)</option>
                  <option value="B15">B15 (Top Strip Col 15)</option>
                  <option value="C15">C15 (Top Strip Col 15)</option>
                  <option value="F15">F15 (Bottom Strip Col 15)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem', display: 'block' }}>Resistor Pin 2 Socket</label>
                <select value={exercisePin2} onChange={e => setExercisePin2(e.target.value)} className="input-field">
                  <option value="F15">F15 (Bottom Strip Col 15)</option>
                  <option value="G15">G15 (Bottom Strip Col 15)</option>
                  <option value="H15">H15 (Bottom Strip Col 15)</option>
                  <option value="A15">A15 (Top Strip Col 15)</option>
                </select>
              </div>
            </div>

            <button onClick={handleValidateExercise} className="btn btn-primary">
              <CheckCircle2 size={16} /> Validate Placement
            </button>

            {exerciseResult && (
              <div style={{
                marginTop: '1.25rem',
                padding: '1rem',
                borderRadius: '8px',
                background: exerciseResult.success ? 'rgba(52, 211, 153, 0.1)' : 'rgba(248, 113, 113, 0.1)',
                border: `1px solid ${exerciseResult.success ? 'var(--accent-emerald)' : 'var(--accent-rose)'}`,
                color: exerciseResult.success ? 'var(--accent-emerald)' : 'var(--accent-rose)',
                fontSize: '0.9rem'
              }}>
                {exerciseResult.success ? '✓ ' : '❌ '}{exerciseResult.message}
              </div>
            )}
          </div>

          <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'center' }}>
            <Award size={48} style={{ color: 'var(--accent-cyan)', margin: '0 auto 1rem' }} />
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Exercise Status</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              {exerciseResult?.success ? 'Completed Successfully!' : 'Pending Validation'}
            </p>
          </div>
        </div>
      )}

      {/* TAB 3: COMPONENT CHEAT SHEETS */}
      {activeTab === 'cheatsheets' && (
        <div className="card-grid">
          {cheatSheets.map(cs => (
            <div key={cs.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                <div className="logo-icon">
                  <Cpu size={18} />
                </div>
                <span className="code-pill">{cs.type}</span>
              </div>
              <h3 style={{ fontSize: '1.15rem', marginBottom: '0.5rem' }}>{cs.name}</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem', lineHeight: '1.6' }}>
                {cs.details}
              </p>
              <button
                onClick={() => setActiveCheatSheet(cs)}
                className="btn btn-secondary"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                Inspect Specs &rarr;
              </button>
            </div>
          ))}
        </div>
      )}

      {/* TAB 4: BREADBOARD PINOUT GUIDE */}
      {activeTab === 'pinouts' && (
        <div className="card">
          <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Layers size={20} style={{ color: 'var(--accent-cyan)' }} />
            Standard 830 Tie-Point Breadboard Pinout Reference
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '1rem', borderRadius: '8px' }}>
              <h4 style={{ color: '#f87171', fontSize: '0.95rem', marginBottom: '0.35rem' }}>Red Rail (+ VCC)</h4>
              <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
                Positive DC supply rail. All holes along the red line are connected vertically.
              </p>
            </div>

            <div style={{ background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '1rem', borderRadius: '8px' }}>
              <h4 style={{ color: '#60a5fa', fontSize: '0.95rem', marginBottom: '0.35rem' }}>Blue Rail (- GND)</h4>
              <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
                Ground reference rail (0V). Connected vertically along the blue line.
              </p>
            </div>

            <div style={{ background: 'rgba(56, 189, 248, 0.08)', border: '1px solid var(--border-color)', padding: '1rem', borderRadius: '8px' }}>
              <h4 style={{ color: 'var(--accent-cyan)', fontSize: '0.95rem', marginBottom: '0.35rem' }}>Terminal Strips A-E & F-J</h4>
              <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
                Holes in the same column (1-63) are connected horizontally across 5 tie-points.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tutorial Modal Viewer */}
      {activeLesson && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(8px)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}>
          <div className="card" style={{ maxWidth: '650px', width: '100%', maxHeight: '85vh', overflowY: 'auto', border: '1px solid var(--accent-cyan)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <h2 style={{ fontSize: '1.25rem', color: 'var(--accent-cyan)' }}>{activeLesson.title}</h2>
              <button onClick={() => setActiveLesson(null)} className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ fontSize: '0.925rem', lineHeight: '1.7', color: 'var(--text-main)', whiteSpace: 'pre-line' }}>
              {activeLesson.content}
            </div>

            <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)', textAlign: 'right' }}>
              <button onClick={() => setActiveLesson(null)} className="btn btn-primary">
                Close Lesson
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cheat Sheet Modal */}
      {activeCheatSheet && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(8px)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}>
          <div className="card" style={{ maxWidth: '550px', width: '100%', border: '1px solid var(--accent-cyan)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <h2 style={{ fontSize: '1.2rem', color: 'var(--accent-cyan)' }}>{activeCheatSheet.name}</h2>
              <button onClick={() => setActiveCheatSheet(null)} className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem' }}>
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '0.9rem', lineHeight: '1.6', color: 'var(--text-main)', marginBottom: '1.25rem' }}>
              {activeCheatSheet.details}
            </p>

            <div style={{ textAlign: 'right' }}>
              <button onClick={() => setActiveCheatSheet(null)} className="btn btn-primary">
                Close Specs
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
