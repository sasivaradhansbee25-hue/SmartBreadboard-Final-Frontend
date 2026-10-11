import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import '../styles/FullAdderSubtractorLab.css';

// 5 paths with 3 particles each
const PARTICLE_DEFS = [
  { id: 'wireA', color: 'green' },
  { id: 'wireB', color: 'red' },
  { id: 'wireC', color: 'yellow' },
  { id: 'wireS', color: 'green' },
  { id: 'wireCarry', color: 'green' }
];

export default function FullAdderSubtractorLab() {
  // Logic input states
  const [a, setA] = useState(1);
  const [b, setB] = useState(0);
  const [c, setC] = useState(1); // Cin or Bin

  // Configuration and View Modes
  const [mode, setMode] = useState('adder'); // 'adder' | 'subtractor'
  const [view, setView] = useState('3d'); // '3d' | 'schematic' | 'components'
  const [activeSection, setActiveSection] = useState('lab');

  // Animation & Visual Controls
  const [anim, setAnim] = useState(true);
  const [particles, setParticles] = useState(true);
  const [tilt, setTilt] = useState(true);
  const [glow, setGlow] = useState(true);
  const [camera, setCamera] = useState(false);

  // Toast Feedback
  const [toast, setToast] = useState({ message: '', visible: false });
  const toastTimerRef = useRef(null);

  // Media & Animation Refs
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const wireSvgRef = useRef(null);
  const animFrameRef = useRef(null);
  const startTimeRef = useRef(0);
  const isMountedRef = useRef(true);

  // Synchronized refs for 60fps animation loop
  const animRef = useRef(anim);
  const particlesRef = useRef(particles);
  useEffect(() => { animRef.current = anim; }, [anim]);
  useEffect(() => { particlesRef.current = particles; }, [particles]);

  // Section Refs for scrolling
  const stageRef = useRef(null);
  const truthRef = useRef(null);
  const logicRef = useRef(null);
  const componentsRef = useRef(null);
  const guideRef = useRef(null);

  // Breadboard holes static array (8 rows x 43 columns = 344 holes)
  const holes = useMemo(() => Array.from({ length: 8 * 43 }, (_, i) => i), []);

  // Toast Helper
  const showToast = useCallback((msg) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message: msg, visible: true });
    toastTimerRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        setToast({ message: '', visible: false });
      }
    }, 2400);
  }, []);

  // Core Boolean Calculation Logic
  // Adder: Sum = A XOR B XOR Cin, Cout = (A AND B) OR (Cin AND (A XOR B))
  // Subtractor: Diff = A XOR B XOR Bin, Bout = ((NOT A) AND B) OR (Bin AND NOT(A XOR B))
  const calculate = useCallback((inA, inB, inC, opMode) => {
    const p = inA ^ inB;
    if (opMode === 'adder') {
      return {
        x: p ^ inC,             // Sum
        y: (inA & inB) | (inC & p), // Cout
        p
      };
    }
    // Subtractor
    return {
      x: p ^ inC,                               // Difference
      y: ((1 - inA) & inB) | (inC & (1 - p)),   // Bout
      p
    };
  }, []);

  // Current calculated results
  const result = useMemo(() => calculate(a, b, c, mode), [a, b, c, mode, calculate]);
  const isAdder = mode === 'adder';

  // Toggle Inputs
  const toggleA = () => setA(prev => 1 - prev);
  const toggleB = () => setB(prev => 1 - prev);
  const toggleC = () => setC(prev => 1 - prev);

  // Reset Inputs
  const handleReset = () => {
    setA(1);
    setB(0);
    setC(1);
    setAnim(true);
    showToast('Inputs reset to A=1, B=0, third input=1.');
  };

  // Truth Table Rows
  const truthRows = useMemo(() => {
    const rows = [];
    for (let bitA = 0; bitA < 2; bitA++) {
      for (let bitB = 0; bitB < 2; bitB++) {
        for (let bitC = 0; bitC < 2; bitC++) {
          const res = calculate(bitA, bitB, bitC, mode);
          const isCurrent = bitA === a && bitB === b && bitC === c;
          rows.push({
            a: bitA,
            b: bitB,
            c: bitC,
            x: res.x,
            y: res.y,
            isCurrent
          });
        }
      }
    }
    return rows;
  }, [mode, a, b, c, calculate]);

  // Particle Animation Loop
  useEffect(() => {
    isMountedRef.current = true;
    startTimeRef.current = performance.now();

    const animate = (now) => {
      if (!isMountedRef.current) return;

      const elapsed = (now - startTimeRef.current) / 1000;
      const svg = wireSvgRef.current;

      if (svg) {
        const particleEls = svg.querySelectorAll('.particle');
        if (animRef.current && particlesRef.current) {
          particleEls.forEach((p) => {
            const pathId = p.dataset.path;
            const path = svg.querySelector('#' + pathId);
            if (path && typeof path.getTotalLength === 'function') {
              const len = path.getTotalLength();
              const offset = Number(p.dataset.offset || 0);
              const t = (elapsed * 0.22 + offset) % 1;
              const pt = path.getPointAtLength(t * len);
              p.setAttribute('cx', pt.x.toFixed(2));
              p.setAttribute('cy', pt.y.toFixed(2));
              p.style.display = 'block';
            }
          });
        } else {
          particleEls.forEach((p) => {
            p.style.display = 'none';
          });
        }
      }

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      isMountedRef.current = false;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  // Camera Management
  const toggleCamera = async () => {
    if (camera) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setCamera(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCamera(true);
      showToast('Camera started. Virtual overlay is illustrative, not physically anchored.');
    } catch {
      showToast('Camera unavailable or permission denied. Open via localhost/HTTPS and allow camera access.');
    }
  };

  // Stop camera on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  // Download Circuit Data JSON
  const handleDownload = () => {
    const data = {
      source: 'smart-breadboard-3d-lab',
      mode,
      circuitType: isAdder ? 'Full Adder' : 'Full Subtractor',
      inputs: {
        A: a,
        B: b,
        thirdInput: c,
        thirdInputLabel: isAdder ? 'Cin' : 'Bin'
      },
      outputs: {
        out1: result.x,
        out1Label: isAdder ? 'Sum' : 'Difference',
        out2: result.y,
        out2Label: isAdder ? 'Cout' : 'Borrow out',
        intermediateP: result.p
      },
      truthTable: truthRows.map(r => ({
        A: r.a,
        B: r.b,
        [isAdder ? 'Cin' : 'Bin']: r.c,
        [isAdder ? 'Sum' : 'Diff']: r.x,
        [isAdder ? 'Cout' : 'Bout']: r.y
      }))
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${mode}-logic-data.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    showToast(`Downloaded ${mode}-logic-data.json`);
  };

  // Side Nav Scroll Navigation
  const handleNavClick = (section) => {
    setActiveSection(section);
    if (section === 'lab') {
      stageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (section === 'truth') {
      truthRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (section === 'logic') {
      setView('3d');
      logicRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (section === 'parts') {
      setView('components');
      componentsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (section === 'guide') {
      guideRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      showToast('Build guide: use datasheets, defined inputs, decoupling capacitors and LED resistors.');
    }
  };

  // Wire opacity style helper
  const wireStyle = (isOn) => ({
    opacity: isOn ? 1 : 0.28,
    filter: glow ? 'drop-shadow(0 0 2px currentColor)' : 'none'
  });

  return (
    <div className="fas-lab-root">
      {/* Lab Header */}
      <header className="lab-header">
        <div className="brandIcon">▦</div>
        <div className="brand">
          <h1>Digital Logic Lab</h1>
          <p>Full Adder &amp; Full Subtractor · Real IC + AR-style visualization</p>
        </div>

        {/* Operating Mode Tabs */}
        <div className="modeTabs">
          <button
            className={mode === 'adder' ? 'active' : ''}
            onClick={() => setMode('adder')}
          >
            Full Adder
          </button>
          <button
            className={mode === 'subtractor' ? 'active' : ''}
            onClick={() => setMode('subtractor')}
          >
            Full Subtractor
          </button>
        </div>

        {/* View Selection Tabs */}
        <div className="viewTabs">
          <button
            className={view === '3d' ? 'active' : ''}
            onClick={() => {
              setView('3d');
            }}
          >
            ◇ 3D View
          </button>
          <button
            className={view === 'schematic' ? 'active' : ''}
            onClick={() => {
              setView('schematic');
              showToast('Schematic view selected — gate diagram and equations are shown below.');
            }}
          >
            ⌁ Schematic
          </button>
          <button
            className={view === 'components' ? 'active' : ''}
            onClick={() => {
              setView('components');
              showToast('Component inventory selected.');
            }}
          >
            ▦ Components
          </button>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="lab-main">
        {/* Left Side Navigation */}
        <nav className="panel sideNav">
          <button
            className={`navbtn ${activeSection === 'lab' ? 'active' : ''}`}
            onClick={() => handleNavClick('lab')}
          >
            <span>▶</span>Interactive Lab
          </button>
          <button
            className={`navbtn ${activeSection === 'truth' ? 'active' : ''}`}
            onClick={() => handleNavClick('truth')}
          >
            <span>▦</span>Truth Table
          </button>
          <button
            className={`navbtn ${activeSection === 'logic' ? 'active' : ''}`}
            onClick={() => handleNavClick('logic')}
          >
            <span>⌘</span>Logic Explanation
          </button>
          <button
            className={`navbtn ${activeSection === 'parts' ? 'active' : ''}`}
            onClick={() => handleNavClick('parts')}
          >
            <span>▣</span>Component Details
          </button>
          <button
            className={`navbtn ${activeSection === 'guide' ? 'active' : ''}`}
            onClick={() => handleNavClick('guide')}
          >
            <span>☷</span>Build Guide
          </button>
          <button className="navbtn" onClick={handleDownload}>
            <span>↓</span>Download Circuit Data
          </button>
        </nav>

        {/* Center Section: Stage, Schematic, & Explanations */}
        <section className="center">
          {/* Interactive AR Stage */}
          <div
            className={`panel stage ${camera ? 'cameraMode' : ''}`}
            id="stage"
            ref={stageRef}
          >
            {/* Camera Video Stream */}
            <video
              ref={videoRef}
              className="camera"
              autoPlay
              muted
              playsInline
            />

            {/* Stage Top Bar */}
            <div className="stageTop">
              <span className="status">
                {camera
                  ? '● LIVE CAMERA BACKGROUND · VIRTUAL OVERLAY'
                  : '● SIMULATED 3D · SIGNAL ANIMATION ON'}
              </span>
              <div className="stageTools">
                <button
                  className={`mini ${camera ? 'active' : ''}`}
                  onClick={toggleCamera}
                >
                  {camera ? '■ Stop Camera' : '◎ Start Camera AR'}
                </button>
                <button
                  className="mini"
                  onClick={() => setAnim(prev => !prev)}
                >
                  {anim ? 'Ⅱ Pause Animation' : '▶ Resume Animation'}
                </button>
                <button className="mini" onClick={handleReset}>
                  ↺ Reset
                </button>
              </div>
            </div>

            {/* 3D Scene Viewport */}
            <div className="scene">
              <div
                className={`boardWrap ${!tilt ? 'no-tilt' : ''}`}
                style={{
                  transform: (!tilt || camera) ? 'rotateX(0deg) rotateZ(0deg)' : 'rotateX(12deg) rotateZ(-1deg)'
                }}
              >
                <div className="board">
                  {/* Power Rails */}
                  <div className="rail red" />
                  <div className="rail blue" />
                  <div className="rail red bottom" />
                  <div className="rail blue bottom" />

                  {/* Hole Array */}
                  <div className="holes">
                    {holes.map((h) => (
                      <i key={h} className="hole" />
                    ))}
                  </div>

                  {/* Center Divider Gap */}
                  <div className="gap" />

                  {/* Board Input Labels & Clickable Switches */}
                  <div className="signalLabel la">A <span>{a}</span></div>
                  <div className="signalLabel lb">B <span>{b}</span></div>
                  <div className="signalLabel lc">
                    <span>{isAdder ? 'Cin' : 'Bin'}</span> <span>{c}</span>
                  </div>

                  <div
                    className={`switchUnit swA ${a ? 'on' : ''}`}
                    onClick={toggleA}
                    title="Click to toggle switch A"
                  >
                    <div className="lever" />
                  </div>
                  <div
                    className={`switchUnit swB ${b ? 'on' : ''}`}
                    onClick={toggleB}
                    title="Click to toggle switch B"
                  >
                    <div className="lever" />
                  </div>
                  <div
                    className={`switchUnit swC ${c ? 'on' : ''}`}
                    onClick={toggleC}
                    title={`Click to toggle ${isAdder ? 'Cin' : 'Bin'}`}
                  >
                    <div className="lever" />
                  </div>

                  {/* IC Packages */}
                  <div className="chip chip1">
                    <div className="pins top">
                      <i /><i /><i /><i /><i /><i />
                    </div>
                    74HC86<small>QUAD XOR</small>
                    <div className="pins bottom">
                      <i /><i /><i /><i /><i /><i />
                    </div>
                  </div>

                  <div className="chip chip2">
                    <div className="pins top">
                      <i /><i /><i /><i /><i /><i />
                    </div>
                    74HC08<small>QUAD AND</small>
                    <div className="pins bottom">
                      <i /><i /><i /><i /><i /><i />
                    </div>
                  </div>

                  <div className="chip chip3">
                    <div className="pins top">
                      <i /><i /><i /><i /><i /><i />
                    </div>
                    74HC32<small>QUAD OR</small>
                    <div className="pins bottom">
                      <i /><i /><i /><i /><i /><i />
                    </div>
                  </div>

                  <div
                    className="chip chip4"
                    style={{ display: mode === 'subtractor' ? 'flex' : 'none' }}
                  >
                    74HC04<small>INVERTER</small>
                  </div>

                  {/* Board Output Labels */}
                  <div className="outputLabel lo1">
                    <span>{isAdder ? 'Sum' : 'Diff'}</span><br />
                    <span>({result.x})</span>
                  </div>
                  <div className="outputLabel lo2">
                    <span>{isAdder ? 'Cout' : 'Bout'}</span><br />
                    <span>({result.y})</span>
                  </div>

                  {/* Output LED & Resistor Assemblies */}
                  <div className="ledAssembly one">
                    <div className={`ledBulb red ${result.x ? 'on' : ''}`} />
                    <div className="resistor" title="330 Ω Current Limiter" />
                  </div>
                  <div className="ledAssembly two">
                    <div className={`ledBulb green ${result.y ? 'on' : ''}`} />
                    <div className="resistor" title="330 Ω Current Limiter" />
                  </div>

                  {/* Animated Signal Wires & Particle Stream */}
                  <svg
                    ref={wireSvgRef}
                    className="wires"
                    viewBox="0 0 100 56"
                    preserveAspectRatio="none"
                    aria-label="Animated signal wires"
                  >
                    <path
                      id="wireA"
                      className="wire green"
                      d="M10 24 L10 42 L24 42 L24 29 L30 29"
                      style={wireStyle(a)}
                    />
                    <path
                      id="wireB"
                      className="wire red"
                      d="M32 24 L32 45 L41 45 L41 29"
                      style={wireStyle(b)}
                    />
                    <path
                      id="wireC"
                      className="wire yellow"
                      d="M54 24 L54 47 L49 47 L49 29"
                      style={wireStyle(c)}
                    />
                    <path
                      id="wireS"
                      className="wire green"
                      d="M33 32 L40 32 L40 37 L76 37 L76 26"
                      style={wireStyle(result.x)}
                    />
                    <path
                      id="wireCarry"
                      className="wire green"
                      d="M50 35 L62 35 L62 43 L88 43 L88 26"
                      style={wireStyle(result.y)}
                    />

                    {/* Dynamic Moving Particles */}
                    <g id="particles">
                      {PARTICLE_DEFS.map((pDef, idx) =>
                        [0, 1, 2].map((j) => (
                          <circle
                            key={`${pDef.id}-${j}`}
                            r="0.42"
                            className={`particle ${pDef.color}`}
                            data-path={pDef.id}
                            data-offset={(j / 3 + idx * 0.127) % 1}
                            style={{
                              display: anim && particles ? 'block' : 'none'
                            }}
                          />
                        ))
                      )}
                    </g>
                  </svg>
                </div>
              </div>
            </div>

            {/* Camera Disclaimer */}
            <div className="cameraHelp">
              Camera background is live. This demo overlays a virtual breadboard; it does not detect or calibrate a physical breadboard automatically.
            </div>

            {/* Board Footer Status */}
            <div className="boardCaption">
              <span>● Animated signal paths · illustrative breadboard</span>
              <span>{`A=${a} · B=${b} · ${isAdder ? 'Cin' : 'Bin'}=${c}`}</span>
            </div>

            {/* Floating Toast Notification */}
            {toast.visible && (
              <div className="toast">{toast.message}</div>
            )}
          </div>

          {/* Subpanels Row Below Stage */}
          <div className="below">
            {/* View Section 1: 3D Mode Logic Diagram */}
            {view === '3d' && (
              <div className="panel subpanel" ref={logicRef}>
                <h3>{`Logic circuit · ${isAdder ? 'Full Adder' : 'Full Subtractor'}`}</h3>
                <svg
                  className="schematic"
                  viewBox="0 0 480 190"
                  aria-label="Animated logic gate schematic"
                >
                  <path
                    className="schemwire"
                    d="M25 38 H100"
                    style={{ opacity: a ? 1 : 0.25 }}
                  />
                  <path
                    className="schemwire"
                    d="M25 73 H100"
                    style={{ opacity: b ? 1 : 0.25 }}
                  />
                  <path
                    className="schemwire"
                    d="M25 130 H100"
                    style={{ opacity: c ? 1 : 0.25 }}
                  />

                  {/* XOR Gate 1 */}
                  <rect className="gateRect" x="100" y="27" width="70" height="57" rx="9" />
                  <text x="135" y="59" textAnchor="middle">XOR</text>

                  {/* Intermediate P line */}
                  <path
                    className="schemwire"
                    d="M170 55 H225"
                    style={{ opacity: result.p ? 1 : 0.25 }}
                  />

                  {/* XOR Gate 2 */}
                  <rect className="gateRect" x="225" y="30" width="70" height="52" rx="9" />
                  <text x="260" y="60" textAnchor="middle">XOR</text>

                  {/* Sum / Diff output wire */}
                  <path
                    className="schemwire"
                    d="M295 55 H400"
                    style={{ opacity: result.x ? 1 : 0.25 }}
                  />
                  <circle
                    cx="410"
                    cy="55"
                    r="8"
                    fill={result.x ? '#ff4058' : '#34475a'}
                  />
                  <text x="425" y="59">{isAdder ? 'S' : 'D'}</text>

                  {/* Lower Gate Array (AND / OR) */}
                  <rect className="gateRect" x="100" y="105" width="70" height="42" rx="9" />
                  <text x="135" y="130" textAnchor="middle">{isAdder ? 'AND' : 'AND*'}</text>

                  <rect className="gateRect" x="225" y="105" width="70" height="42" rx="9" />
                  <text x="260" y="130" textAnchor="middle">AND</text>

                  <rect className="gateRect" x="330" y="105" width="65" height="42" rx="9" />
                  <text x="362" y="130" textAnchor="middle">OR</text>

                  {/* Carry / Borrow output line */}
                  <path
                    className="schemwire"
                    d="M170 126 H225 M295 126 H330 M395 126 H420"
                    style={{ opacity: result.y ? 1 : 0.25 }}
                  />
                  <circle
                    cx="430"
                    cy="126"
                    r="8"
                    fill={result.y ? '#1df4a1' : '#34475a'}
                  />
                  <text x="443" y="130">{isAdder ? 'C' : 'B'}</text>
                </svg>

                <div className="legend">
                  <span><i className="dot" style={{ background: '#1df4a1' }} />Logic HIGH</span>
                  <span><i className="dot" style={{ background: '#fa4c5f' }} />Logic LOW / alternate path</span>
                  <span><i className="dot" style={{ background: '#ffc857' }} />Carry / borrow path</span>
                </div>
              </div>
            )}

            {/* View Section 2: Gate-level Schematic Tab */}
            {view === 'schematic' && (
              <div className="panel subpanel" ref={logicRef}>
                <h3>Gate-level schematic</h3>
                <p className="muted">Signal highlighting follows the current input state. Logic equations update when switching modes.</p>
                <div className="equation">
                  {isAdder
                    ? 'S = A ⊕ B ⊕ Cin'
                    : 'Diff = A ⊕ B ⊕ Bin'}
                </div>
                <div className="equation">
                  {isAdder
                    ? 'Cout = (A · B) + (Cin · (A ⊕ B))'
                    : 'Bout = (¬A · B) + (Bin · ¬(A ⊕ B))'}
                </div>
                <p className="muted">XOR = exclusive OR · AND = series condition · OR = either condition.</p>
              </div>
            )}

            {/* View Section 3: Physical Components Inventory */}
            {view === 'components' && (
              <div className="panel subpanel" ref={componentsRef}>
                <h3>Physical component inventory</h3>
                <div className="components">
                  <div className="component"><b>74HC86</b>Quad XOR</div>
                  <div className="component"><b>74HC08</b>Quad AND</div>
                  <div className="component"><b>74HC32</b>Quad OR</div>
                  <div className="component"><b>74HC04</b>NOT gates*</div>
                  <div className="component"><b>LED × 2</b>Output lights</div>
                  <div className="component"><b>330 Ω × 2</b>LED resistors</div>
                  <div className="component"><b>Switch × 3</b>Binary inputs</div>
                  <div className="component"><b>100 nF</b>Decoupling</div>
                  <div className="component"><b>5 V DC</b>Regulated supply</div>
                </div>
                <p className="muted">*Subtractor implementation may use an inverter. Exact IC count depends on gate sharing and the final schematic.</p>
              </div>
            )}

            {/* Boolean Expressions Card */}
            <div className="panel subpanel">
              <h3>Boolean expressions</h3>
              <div className="equation">
                {isAdder
                  ? 'Sum = A ⊕ B ⊕ Cin'
                  : 'Difference = A ⊕ B ⊕ Bin'}
              </div>
              <div className="equation">
                {isAdder
                  ? 'Cout = (A · B) + (Cin · (A ⊕ B))'
                  : 'Bout = (¬A · B) + (Bin · ¬(A ⊕ B))'}
              </div>
              <div className="equation">
                {isAdder
                  ? `Current: ${a} + ${b} + ${c} = ${(a + b + c).toString(2).padStart(2, '0')}₂`
                  : `Current: ${a} − ${b} − ${c} = ${result.x} (borrow ${result.y})`}
              </div>
            </div>
          </div>

          {/* Bottom Grid: 3 Interactive Control & Info Cards */}
          <div className="bottomGrid">
            {/* Card 1: Animation Controls */}
            <div className="panel subpanel">
              <h3>Animation controls</h3>
              <p className="muted">Animated particles travel along active signal paths. Output LEDs glow when the result bit is 1.</p>
              <div className="controlrow">
                <span>Signal particles</span>
                <button
                  className={`toggle ${particles ? 'on' : ''}`}
                  onClick={() => setParticles(prev => !prev)}
                  aria-label="Toggle signal particles"
                />
              </div>
              <div className="controlrow">
                <span>3D tilt</span>
                <button
                  className={`toggle ${tilt ? 'on' : ''}`}
                  onClick={() => setTilt(prev => !prev)}
                  aria-label="Toggle 3D tilt"
                />
              </div>
              <div className="controlrow">
                <span>Glow effects</span>
                <button
                  className={`toggle ${glow ? 'on' : ''}`}
                  onClick={() => setGlow(prev => !prev)}
                  aria-label="Toggle glow effects"
                />
              </div>
            </div>

            {/* Card 2: Current Inputs & Outputs */}
            <div className="panel subpanel">
              <h3>Current inputs &amp; outputs</h3>
              <div className="equation">
                {`A=${a} · B=${b} · ${isAdder ? 'Cin' : 'Bin'}=${c}`}
                <br />
                {`${isAdder ? 'Sum' : 'Diff'}=${result.x} · ${isAdder ? 'Cout' : 'Bout'}=${result.y}`}
              </div>
              <p className="muted">Use the switches on the right to explore all 8 combinations.</p>
            </div>

            {/* Card 3: Hardware Build Reminder */}
            <div className="panel subpanel" ref={guideRef}>
              <h3>Hardware build reminder</h3>
              <p className="muted">
                This is an animated educational visualization, not an electrically validated simulator or a calibrated AR tracker. Verify each IC's datasheet and pinout before wiring hardware.
              </p>
            </div>
          </div>
        </section>

        {/* Right Sidebar: Controls & Truth Table */}
        <aside className="right">
          {/* Input Controls */}
          <div className="panel">
            <h2>Input controls</h2>
            <div className="controlrow">
              <span>A</span>
              <span className="bitvalue">{a}</span>
              <button
                className={`toggle ${a ? 'on' : ''}`}
                onClick={toggleA}
                aria-label="Toggle input A"
              />
            </div>
            <div className="controlrow">
              <span>B</span>
              <span className="bitvalue">{b}</span>
              <button
                className={`toggle ${b ? 'on' : ''}`}
                onClick={toggleB}
                aria-label="Toggle input B"
              />
            </div>
            <div className="controlrow">
              <span>{isAdder ? 'Cin' : 'Bin'}</span>
              <span className="bitvalue">{c}</span>
              <button
                className={`toggle ${c ? 'on' : ''}`}
                onClick={toggleC}
                aria-label={`Toggle input ${isAdder ? 'Cin' : 'Bin'}`}
              />
            </div>
          </div>

          {/* Output Indicators */}
          <div className="panel">
            <h2>Output indicators</h2>
            <div className="outrow">
              <span>{isAdder ? 'Sum' : 'Difference'}</span>
              <i className={`lamp red ${result.x ? 'on' : ''}`} />
              <strong>{result.x}</strong>
            </div>
            <div className="outrow">
              <span>{isAdder ? 'Carry out' : 'Borrow out'}</span>
              <i className={`lamp green ${result.y ? 'on' : ''}`} />
              <strong>{result.y}</strong>
            </div>
          </div>

          {/* Truth Table Panel */}
          <div className="panel truthPanel" ref={truthRef}>
            <h2>{`Truth table · ${isAdder ? 'Full Adder' : 'Full Subtractor'}`}</h2>
            <div className="tablewrap">
              <table>
                <thead>
                  <tr>
                    <th>A</th>
                    <th>B</th>
                    <th>{isAdder ? 'Cin' : 'Bin'}</th>
                    <th>{isAdder ? 'Sum' : 'Diff'}</th>
                    <th>{isAdder ? 'Cout' : 'Bout'}</th>
                  </tr>
                </thead>
                <tbody>
                  {truthRows.map((row) => (
                    <tr
                      key={`${row.a}-${row.b}-${row.c}`}
                      className={row.isCurrent ? 'current' : ''}
                    >
                      <td>{row.a}</td>
                      <td>{row.b}</td>
                      <td>{row.c}</td>
                      <td>{row.x}</td>
                      <td>{row.y}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted" style={{ marginTop: '8px' }}>Highlighted row = current inputs.</p>
          </div>

          {/* Live Status */}
          <div className="panel">
            <h2>Live status</h2>
            <div className="equation">
              {`A=${a}, B=${b}, ${isAdder ? 'Cin' : 'Bin'}=${c}`}
            </div>
            <p className="muted">
              {isAdder
                ? `${result.y ? 'Carry is HIGH. ' : 'Carry is LOW. '}${result.x ? 'Sum is HIGH.' : 'Sum is LOW.'}`
                : `${result.y ? 'Borrow is HIGH. ' : 'Borrow is LOW. '}${result.x ? 'Difference is HIGH.' : 'Difference is LOW.'}`}
            </p>
            <div className="status" style={{ marginTop: '4px' }}>
              ● Logic model active
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
