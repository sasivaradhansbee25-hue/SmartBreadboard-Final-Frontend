import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Activity, Zap, Sliders, ShieldCheck, HelpCircle, ArrowRight } from 'lucide-react';
import '../styles/ClipperClamperLab.css';

// Component constants
const BAND = { 0: '#111', 1: '#7a3d12', 2: '#d0201a', 3: '#f07a12', 4: '#f3d21a', 5: '#2e9e3a', 6: '#2357c4', 7: '#7f3fbf', 8: '#888', 9: '#f4f4f4', gold: '#c9a227' };
const CAPS = [1, 4.7, 10, 47, 100];
const RLS = [1e3, 10e3, 47e3, 100e3, 1e6];
const VDIVS = [0.5, 1, 2, 2.5, 5, 10];
const N = 1200;

function resBands(ohms) {
  let exp = 0, v = ohms;
  while (v >= 100) { v /= 10; exp++; }
  v = Math.round(v);
  const d1 = Math.floor(v / 10), d2 = v % 10;
  return [BAND[d1], BAND[d2], BAND[exp], BAND.gold];
}

function fmtOhm(o) {
  return o >= 1e6 ? (o / 1e6) + ' MΩ' : o >= 1e3 ? (o / 1e3) + ' kΩ' : o + ' Ω';
}

function fmtF(f) {
  return f >= 1000 ? (f / 1000).toFixed(f >= 10000 ? 0 : 2) + ' kHz' : f.toFixed(0) + ' Hz';
}

function freqFromSlider(v) {
  return Math.round(Math.pow(10, 1.7 + v * 1.0) / 10) * 10;
}

function wave(type, ph) {
  const p = ph - Math.floor(ph);
  if (type === 'sine') return Math.sin(2 * Math.PI * p);
  if (type === 'tri') return p < 0.25 ? 4 * p : p < 0.75 ? 2 - 4 * p : 4 * p - 4;
  return p < 0.5 ? 1 : -1;
}

// Pure physics simulations
function simClip(s, neg) {
  const cycles = 3, vin = [], vout = [], on = [], lvl = neg ? -(s.vb + s.vg) : s.vb + s.vg;
  for (let i = 0; i < N; i++) {
    const v = s.vm * wave(s.wave, i / (N - 1) * cycles);
    vin.push(v);
    const c = neg ? v <= lvl : v >= lvl;
    vout.push(c ? lvl : v);
    on.push(c);
  }
  return { vin, vout, on, tTotal: cycles / s.f, lvl };
}

function simClamp(s, neg) {
  const cycles = 5, T = 1 / s.f, sub = 8, dt = T * cycles / (N - 1) / sub, RC = s.rl * s.c * 1e-6, ref = neg ? (-s.vb + s.vg) : (s.vb - s.vg);
  let vc = 0;
  const vin = [], vout = [], on = [];
  for (let i = 0; i < N; i++) {
    let conducting = false, vo = 0, v = 0;
    for (let k = 0; k < sub; k++) {
      const t = (i * sub + k) * dt;
      v = s.vm * wave(s.wave, t / T);
      vo = v - vc;
      if (neg ? vo > ref : vo < ref) {
        vo = ref;
        vc = v - ref;
        conducting = true;
      } else {
        vc = v + (vc - v) * Math.exp(-dt / RC);
        vo = v - vc;
      }
    }
    vin.push(v);
    vout.push(vo);
    on.push(conducting);
  }
  return { vin, vout, on, tTotal: cycles * T, RC, T };
}

export default function ClipperClamperLab() {
  const [activeTab, setActiveTab] = useState('clipper'); // 'clipper' | 'nclipper' | 'clamper' | 'nclamper'

  // Experiment States
  const [clipState, setClipState] = useState({ wave: 'sine', vm: 8, vb: 3, fSlider: 1, vg: 0.7 });
  const [nclipState, setNclipState] = useState({ wave: 'sine', vm: 8, vb: 3, fSlider: 1, vg: 0.7 });
  const [clampState, setClampState] = useState({ wave: 'sine', vm: 5, vb: 0, fSlider: 1, vg: 0.7, cIdx: 2, rIdx: 3 });
  const [nclampState, setNclampState] = useState({ wave: 'sine', vm: 5, vb: 0, fSlider: 1, vg: 0.7, cIdx: 2, rIdx: 3 });

  // Canvas Refs
  const clipCanvasRef = useRef(null);
  const nclipCanvasRef = useRef(null);
  const clampCanvasRef = useRef(null);
  const nclampCanvasRef = useRef(null);

  // Status Badge Refs (direct DOM updates during animation loop to prevent 60fps React re-renders)
  const clipStatusRef = useRef(null);
  const nclipStatusRef = useRef(null);
  const clampStatusRef = useRef(null);
  const nclampStatusRef = useRef(null);

  const clipVdivRef = useRef(null);
  const nclipVdivRef = useRef(null);

  // Status tracking refs
  const lastClipOnRef = useRef(null);
  const lastNclipOnRef = useRef(null);
  const lastClampOnRef = useRef(null);
  const lastNclampOnRef = useRef(null);

  // Computed simulation data
  const clipData = useMemo(() => simClip({
    wave: clipState.wave,
    vm: clipState.vm,
    vb: clipState.vb,
    f: freqFromSlider(clipState.fSlider),
    vg: clipState.vg
  }, false), [clipState]);

  const nclipData = useMemo(() => simClip({
    wave: nclipState.wave,
    vm: nclipState.vm,
    vb: nclipState.vb,
    f: freqFromSlider(nclipState.fSlider),
    vg: nclipState.vg
  }, true), [nclipState]);

  const clampData = useMemo(() => simClamp({
    wave: clampState.wave,
    vm: clampState.vm,
    vb: clampState.vb,
    f: freqFromSlider(clampState.fSlider),
    vg: clampState.vg,
    c: CAPS[clampState.cIdx],
    rl: RLS[clampState.rIdx]
  }, false), [clampState]);

  const nclampData = useMemo(() => simClamp({
    wave: nclampState.wave,
    vm: nclampState.vm,
    vb: nclampState.vb,
    f: freqFromSlider(nclampState.fSlider),
    vg: nclampState.vg,
    c: CAPS[nclampState.cIdx],
    rl: RLS[nclampState.rIdx]
  }, true), [nclampState]);

  // Canvas Scope Renderer
  const renderCanvasScope = useCallback((canvas, data, opts) => {
    if (!canvas) return { vdiv: 2, ci: 0, conducting: false };
    const r = canvas.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return { vdiv: 2, ci: 0, conducting: false };

    const dpr = window.devicePixelRatio || 1;
    const targetW = Math.round(r.width * dpr);
    const targetH = Math.round(r.height * dpr);

    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const w = r.width, h = r.height;
    const padL = 46, padB = 26, padT = 10, padR = 12, W = w - padL - padR, H = h - padT - padB;
    ctx.fillStyle = '#0b1413';
    ctx.fillRect(0, 0, w, h);

    const maxAbs = Math.max(...data.vin.map(Math.abs), ...data.vout.map(Math.abs), 0.5);
    const vdiv = VDIVS.find(d => d * 4 >= maxAbs * 1.02) || 10;
    const vmin = -4 * vdiv, vmax = 4 * vdiv;
    const X = i => padL + i / (data.vin.length - 1) * W;
    const Y = v => padT + (vmax - v) / (vmax - vmin) * H;

    // Scope Grid
    ctx.strokeStyle = '#1d2f2c';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
      const x = padL + i * W / 10;
      ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, padT + H); ctx.stroke();
    }
    for (let j = 0; j <= 8; j++) {
      const y = padT + j * H / 8;
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + W, y); ctx.stroke();
    }

    // Zero Axis
    ctx.strokeStyle = '#355651';
    ctx.beginPath(); ctx.moveTo(padL, Y(0)); ctx.lineTo(padL + W, Y(0)); ctx.stroke();

    // Axis Labels
    ctx.fillStyle = '#6f8a85';
    ctx.font = '11px IBM Plex Mono, monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let j = 0; j <= 8; j += 2) {
      const v = vmax - j * vdiv;
      ctx.fillText((v > 0 ? '+' : '') + v + 'V', padL - 6, padT + j * H / 8);
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let i = 0; i <= 10; i += 2) {
      ctx.fillText((data.tTotal * i / 10 * 1000).toFixed(data.tTotal * 1000 < 10 ? 1 : 0) + 'ms', padL + i * W / 10, padT + H + 7);
    }

    // Reference dashed lines
    (opts.refs || []).forEach(refLine => {
      ctx.save();
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = refLine.color;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(padL, Y(refLine.v));
      ctx.lineTo(padL + W, Y(refLine.v));
      ctx.stroke();
      ctx.restore();
    });

    // Traces: CH1 (Vin) yellow, CH2 (Vout) green
    const drawTrace = (arr, col, wid, dash) => {
      ctx.save();
      ctx.strokeStyle = col;
      ctx.lineWidth = wid;
      if (dash) ctx.setLineDash(dash);
      ctx.shadowColor = col;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      arr.forEach((v, i) => i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v)));
      ctx.stroke();
      ctx.restore();
    };

    drawTrace(data.vin, '#f2c94c', 1.6, [6, 4]);
    drawTrace(data.vout, '#33e1a6', 2.4);

    // Reference labels
    (opts.refs || []).forEach(refLine => {
      ctx.font = '11px IBM Plex Mono, monospace';
      const tw = ctx.measureText(refLine.text).width;
      const ly = Math.max(padT + 2, Y(refLine.v) - 22);
      ctx.fillStyle = 'rgba(11,20,19,.88)';
      ctx.fillRect(padL + 6, ly, tw + 12, 18);
      ctx.strokeStyle = refLine.color;
      ctx.lineWidth = 1;
      ctx.strokeRect(padL + 6.5, ly + .5, tw + 11, 17);
      ctx.fillStyle = refLine.color;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(refLine.text, padL + 12, ly + 9.5);
    });

    // Animated time cursor & dots
    const ci = Math.round(opts.cursor * (data.vin.length - 1));
    ctx.strokeStyle = 'rgba(255,255,255,.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(X(ci), padT);
    ctx.lineTo(X(ci), padT + H);
    ctx.stroke();

    ctx.fillStyle = '#f2c94c';
    ctx.beginPath();
    ctx.arc(X(ci), Y(data.vin[ci]), 4, 0, 7);
    ctx.fill();

    ctx.fillStyle = '#33e1a6';
    ctx.beginPath();
    ctx.arc(X(ci), Y(data.vout[ci]), 4.5, 0, 7);
    ctx.fill();

    const conducting = !!data.on[ci];
    return { vdiv, ci, conducting };
  }, []);

  // Reset status refs on tab change
  useEffect(() => {
    lastClipOnRef.current = null;
    lastNclipOnRef.current = null;
    lastClampOnRef.current = null;
    lastNclampOnRef.current = null;
  }, [activeTab]);

  // Animation Loop Effect
  useEffect(() => {
    let animId;
    let t0 = performance.now();
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const frame = (now) => {
      const cur = prefersReducedMotion ? 0.3 : ((now - t0) / 6000) % 1;

      if (activeTab === 'clipper' && clipCanvasRef.current) {
        const r = renderCanvasScope(clipCanvasRef.current, clipData, {
          cursor: cur,
          refs: [{ v: clipData.lvl, color: '#ff9f5a', text: `clip level V_B+Vγ = ${clipData.lvl.toFixed(1)} V` }]
        });
        if (r.conducting !== lastClipOnRef.current) {
          lastClipOnRef.current = r.conducting;
          if (clipStatusRef.current) {
            clipStatusRef.current.textContent = r.conducting ? 'D1 ON · clipping' : 'D1 OFF';
            clipStatusRef.current.className = `ccl-status ${r.conducting ? 'on' : ''}`;
          }
        }
        if (clipVdivRef.current) {
          clipVdivRef.current.textContent = `${r.vdiv} V/div`;
        }
      } else if (activeTab === 'nclipper' && nclipCanvasRef.current) {
        const r = renderCanvasScope(nclipCanvasRef.current, nclipData, {
          cursor: cur,
          refs: [{ v: nclipData.lvl, color: '#ff9f5a', text: `clip level −(V_B+Vγ) = ${nclipData.lvl.toFixed(1)} V` }]
        });
        if (r.conducting !== lastNclipOnRef.current) {
          lastNclipOnRef.current = r.conducting;
          if (nclipStatusRef.current) {
            nclipStatusRef.current.textContent = r.conducting ? 'D1 ON · clipping' : 'D1 OFF';
            nclipStatusRef.current.className = `ccl-status ${r.conducting ? 'on' : ''}`;
          }
        }
        if (nclipVdivRef.current) {
          nclipVdivRef.current.textContent = `${r.vdiv} V/div`;
        }
      } else if (activeTab === 'clamper' && clampCanvasRef.current) {
        const refV = clampState.vb - clampState.vg;
        const r = renderCanvasScope(clampCanvasRef.current, clampData, {
          cursor: cur,
          refs: [{ v: refV, color: '#ff9f5a', text: `clamp level V_B−Vγ = ${refV.toFixed(1)} V` }]
        });
        if (r.conducting !== lastClampOnRef.current) {
          lastClampOnRef.current = r.conducting;
          if (clampStatusRef.current) {
            clampStatusRef.current.textContent = r.conducting ? 'D1 ON · charging C' : 'D1 OFF';
            clampStatusRef.current.className = `ccl-status ${r.conducting ? 'on' : ''}`;
          }
        }
      } else if (activeTab === 'nclamper' && nclampCanvasRef.current) {
        const refN = -nclampState.vb + nclampState.vg;
        const r = renderCanvasScope(nclampCanvasRef.current, nclampData, {
          cursor: cur,
          refs: [{ v: refN, color: '#ff9f5a', text: `clamp level −V_B+Vγ = ${refN.toFixed(1)} V` }]
        });
        if (r.conducting !== lastNclampOnRef.current) {
          lastNclampOnRef.current = r.conducting;
          if (nclampStatusRef.current) {
            nclampStatusRef.current.textContent = r.conducting ? 'D1 ON · charging C' : 'D1 OFF';
            nclampStatusRef.current.className = `ccl-status ${r.conducting ? 'on' : ''}`;
          }
        }
      }

      animId = requestAnimationFrame(frame);
    };

    animId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(animId);
  }, [activeTab, clipData, nclipData, clampData, nclampData, clampState, nclampState, renderCanvasScope]);

  // Derived readout calculations for Clipper
  const clipMax = Math.max(...clipData.vout);
  const clipMin = Math.min(...clipData.vout);
  const clipImax = Math.max(0, (clipState.vm - clipState.vb - clipState.vg));

  const nclipMax = Math.max(...nclipData.vout);
  const nclipMin = Math.min(...nclipData.vout);
  const nclipImax = Math.max(0, (nclipState.vm - nclipState.vb - nclipState.vg));

  // Derived readout calculations for Clamper (Steady State from last cycle)
  const clampTail = Math.floor(N * 0.8);
  const clampSv = clampData.vout.slice(clampTail);
  const clampSi = clampData.vin.slice(clampTail);
  const clampMax = Math.max(...clampSv);
  const clampMin = Math.min(...clampSv);
  const clampShift = clampSv.reduce((a, b) => a + b, 0) / clampSv.length - clampSi.reduce((a, b) => a + b, 0) / clampSi.length;
  const clampRatio = clampData.RC / clampData.T;

  const nclampTail = Math.floor(N * 0.8);
  const nclampSv = nclampData.vout.slice(nclampTail);
  const nclampSi = nclampData.vin.slice(nclampTail);
  const nclampMax = Math.max(...nclampSv);
  const nclampMin = Math.min(...nclampSv);
  const nclampShift = nclampSv.reduce((a, b) => a + b, 0) / nclampSv.length - nclampSi.reduce((a, b) => a + b, 0) / nclampSi.length;
  const nclampRatio = nclampData.RC / nclampData.T;

  // SVG Component Renderers
  const renderResistorSVG = (cx, cy, rot, ohms) => {
    const b = resBands(ohms);
    return (
      <g transform={`translate(${cx},${cy}) rotate(${rot})`}>
        <line className="ccl-lead" x1="-50" y1="0" x2="-30" y2="0" />
        <line className="ccl-lead" x1="30" y1="0" x2="50" y2="0" />
        <path d="M-32 -10 Q-32 -13 -27 -13 L-19 -13 Q-16 -10 -13 -10 L13 -10 Q16 -10 19 -13 L27 -13 Q32 -13 32 -10 L32 10 Q32 13 27 13 L19 13 Q16 10 13 10 L-13 10 Q-16 10 -19 13 L-27 13 Q-32 13 -32 10 Z" fill="#dcbf88" stroke="#9c7c48" strokeWidth="1" />
        <rect x="-24" y="-13" width="5" height="26" fill={b[0]} />
        <rect x="-11" y="-10" width="5" height="20" fill={b[1]} />
        <rect x="-1" y="-10" width="5" height="20" fill={b[2]} />
        <rect x="20" y="-13" width="5" height="26" fill={b[3]} />
        <rect x="-30" y="-9" width="60" height="4" rx="2" fill="#fff" opacity=".35" />
      </g>
    );
  };

  const renderDiodeSVG = (cx, cy, rot, on) => (
    <g className={`ccl-diode ${on ? 'on' : ''}`} transform={`translate(${cx},${cy}) rotate(${rot})`}>
      <rect className="ccl-diode-glow" x="-34" y="-20" width="68" height="40" rx="20" fill="#ffb627" opacity=".0" style={{ filter: 'blur(8px)' }} />
      <line className="ccl-lead" x1="-52" y1="0" x2="-22" y2="0" />
      <line className="ccl-lead" x1="22" y1="0" x2="52" y2="0" />
      <rect x="-23" y="-10" width="46" height="20" rx="5" fill="#1b1d1e" />
      <rect x="-23" y="-10" width="46" height="6" rx="3" fill="#fff" opacity=".12" />
      <rect x="12" y="-10" width="6" height="20" fill="#cfd3d6" />
    </g>
  );

  const renderBatterySVG = (cx, cy, flip) => (
    <g transform={`translate(${cx},${cy}) rotate(${flip ? 180 : 0})`}>
      <rect x="-6" y="-40" width="12" height="7" rx="2" fill="#b9bec1" />
      <rect x="-17" y="-34" width="34" height="68" rx="4" fill="#3b3b3b" />
      <rect x="-17" y="-34" width="34" height="22" rx="4" fill="#e3a052" />
      <text x="0" y="-18" textAnchor="middle" fontFamily="IBM Plex Mono, monospace" fontSize="13" fontWeight="600" fill="#2a1606" transform={`rotate(${flip ? 180 : 0} 0 -22)`}>+</text>
      <text x="0" y="22" textAnchor="middle" fontFamily="IBM Plex Mono, monospace" fontSize="13" fill="#bbb" transform={`rotate(${flip ? 180 : 0} 0 18)`}>−</text>
    </g>
  );

  const renderCapacitorSVG = (cx, cy, rot) => (
    <g transform={`translate(${cx},${cy}) rotate(${rot})`}>
      <line className="ccl-lead" x1="-55" y1="0" x2="-30" y2="0" />
      <line className="ccl-lead" x1="30" y1="0" x2="55" y2="0" />
      <rect x="-30" y="-17" width="60" height="34" rx="6" fill="#2a54a0" />
      <rect x="-30" y="-17" width="15" height="34" rx="5" fill="#b8c8e2" />
      <text x="-22.5" y="-3" textAnchor="middle" fontSize="10" fontFamily="IBM Plex Mono, monospace" fill="#1d3c74">−</text>
      <text x="-22.5" y="10" textAnchor="middle" fontSize="10" fontFamily="IBM Plex Mono, monospace" fill="#1d3c74">−</text>
      <rect x="-12" y="-17" width="2" height="34" fill="#0f2146" opacity=".5" />
      <rect x="-30" y="-14" width="60" height="6" rx="3" fill="#fff" opacity=".18" />
      <text x="10" y="4" textAnchor="middle" fontSize="9" fontFamily="IBM Plex Mono, monospace" fill="#dce6f6" transform={`rotate(${rot === 180 ? 180 : 0} 10 1)`}>105°C</text>
    </g>
  );

  const renderGeneratorSVG = (x, y, waveType, vm, f) => {
    const icon = waveType === 'sine' ? 'M0 10 Q7 -6 14 10 T28 10' : waveType === 'tri' ? 'M0 14 L7 2 L14 14 L21 2 L28 14' : 'M0 14 L0 2 L7 2 L7 14 L14 14 L14 2 L21 2 L21 14 L28 14';
    return (
      <g transform={`translate(${x},${y})`}>
        <rect x="0" y="0" width="150" height="250" rx="12" fill="#d7dbd8" stroke="#a7aeab" />
        <rect x="0" y="0" width="150" height="30" rx="12" fill="#2a3533" />
        <rect x="0" y="18" width="150" height="12" fill="#2a3533" />
        <text x="12" y="20" fontFamily="IBM Plex Mono, monospace" fontSize="11" fill="#cfe" letterSpacing="1">FUNC GEN</text>
        <rect x="12" y="42" width="126" height="58" rx="5" fill="#0c1a17" stroke="#33463f" />
        <path d={icon} transform="translate(20,52)" stroke="#33e1a6" strokeWidth="2" fill="none" />
        <text x="58" y="64" fontFamily="IBM Plex Mono, monospace" fontSize="11" fill="#33e1a6">{vm.toFixed(1)} Vp</text>
        <text x="20" y="90" fontFamily="IBM Plex Mono, monospace" fontSize="11" fill="#33e1a6">{fmtF(f)}</text>
        <circle cx="40" cy="135" r="17" fill="#3a4442" /><circle cx="40" cy="135" r="12" fill="#56605e" /><line x1="40" y1="135" x2="48" y2="126" stroke="#eee" strokeWidth="2" />
        <circle cx="105" cy="135" r="17" fill="#3a4442" /><circle cx="105" cy="135" r="12" fill="#56605e" /><line x1="105" y1="135" x2="96" y2="126" stroke="#eee" strokeWidth="2" />
        <text x="40" y="168" textAnchor="middle" fontFamily="IBM Plex Mono, monospace" fontSize="9" fill="#4d5755">AMPL</text>
        <text x="105" y="168" textAnchor="middle" fontFamily="IBM Plex Mono, monospace" fontSize="9" fill="#4d5755">FREQ</text>
      </g>
    );
  };

  const renderTerminal = (x, y, color) => (
    <g>
      <circle cx={x} cy={y} r="10" fill={color} stroke="#0005" />
      <circle cx={x} cy={y} r="4" fill="#d9d9d9" />
    </g>
  );

  const renderGround = (x, y) => (
    <g stroke="var(--wire)" strokeWidth="2.5">
      <line x1={x} y1={y} x2={x} y2={y + 12} />
      <line x1={x - 16} y1={y + 12} x2={x + 16} y2={y + 12} />
      <line x1={x - 10} y1={y + 18} x2={x + 10} y2={y + 18} />
      <line x1={x - 4} y1={y + 24} x2={x + 4} y2={y + 24} />
    </g>
  );

  const renderSymDiode = (x, y, down) => {
    const t = down ? `M${x - 8} ${y - 6} L${x + 8} ${y - 6} L${x} ${y + 6} Z` : `M${x - 8} ${y + 6} L${x + 8} ${y + 6} L${x} ${y - 6} Z`;
    const bar = down ? `M${x - 8} ${y + 6} L${x + 8} ${y + 6}` : `M${x - 8} ${y - 6} L${x + 8} ${y - 6}`;
    return (
      <g>
        <path d={t} fill="var(--ink)" />
        <path d={bar} stroke="var(--ink)" strokeWidth="2" />
      </g>
    );
  };

  return (
    <div className="ccl-container">
      {/* Hero Header */}
      <section className="ccl-hero">
        <div className="ccl-eyebrow">Diode Wave-Shaping Circuits · Interactive Virtual Bench</div>
        <h1>Positive &amp; Negative Clippers and Clampers</h1>
        <p>
          Explore diode clipping and clamping circuits rendered with realistic components — function generator, color-coded resistors, 1N4007 diodes, DC bias cells, and electrolytic capacitors. 
          Inspect real-time dual-trace oscilloscope signals (CH1 Input V_in yellow, CH2 Output V_out green) with active conduction visual indicators.
        </p>
      </section>

      {/* Tabs Navigation */}
      <div className="ccl-tabs" role="tablist">
        <button className={activeTab === 'clipper' ? 'on' : ''} onClick={() => setActiveTab('clipper')}>Positive Clipper</button>
        <button className={activeTab === 'nclipper' ? 'on' : ''} onClick={() => setActiveTab('nclipper')}>Negative Clipper</button>
        <button className={activeTab === 'clamper' ? 'on' : ''} onClick={() => setActiveTab('clamper')}>Positive Clamper</button>
        <button className={activeTab === 'nclamper' ? 'on' : ''} onClick={() => setActiveTab('nclamper')}>Negative Clamper</button>
      </div>

      {/* ================= EXPERIMENT 1: POSITIVE CLIPPER ================= */}
      <div style={{ display: activeTab === 'clipper' ? 'block' : 'none' }}>
        <section className="ccl-lab">
          <div className="ccl-lab-head">
            <h2>Positive Clipper</h2>
            <span className="ccl-tag">shunt · biased</span>
            <p>
              The diode sits across the output with its anode on the output node. When the input rises above V_B + V_γ, the diode turns on and holds the output at that level — clipping the top of the wave. Below that level, the diode is off and the output follows the input.
            </p>
          </div>

          <div className="ccl-card ccl-bench">
            <svg viewBox="0 0 900 380" role="img" aria-label="Positive clipper circuit">
              {renderGeneratorSVG(20, 60, clipState.wave, clipState.vm, freqFromSlider(clipState.fSlider))}
              {renderTerminal(170, 110, '#c8302b')}
              {renderTerminal(170, 290, '#222')}
              <text x="190" y="96" className="ccl-lbl-s">+</text>
              <text x="190" y="318" className="ccl-lbl-s">COM</text>
              <path className="ccl-wire" d="M170 110 L250 110" />
              {renderResistorSVG(300, 110, 0, 1000)}
              <text x="300" y="82" textAnchor="middle" className="ccl-lbl-b">R = 1 kΩ</text>
              <text x="300" y="142" textAnchor="middle" className="ccl-lbl-s">brown·black·red·gold</text>
              <path className="ccl-wire" d="M350 110 L720 110" />
              <circle cx="500" cy="110" r="5" fill="#8d9592" stroke="#5d6563" />
              <path className="ccl-wire" d="M500 110 L500 125" />
              {renderDiodeSVG(500, 165, 90, lastClipOnRef.current)}
              <path className="ccl-wire" d="M500 217 L500 223" />
              {renderBatterySVG(500, 262, clipState.vb < 0)}
              <path className="ccl-wire" d="M500 302 L500 290" />
              <path className="ccl-wire" d="M170 290 L720 290" />
              <circle cx="500" cy="290" r="5" fill="#8d9592" stroke="#5d6563" />
              <path className={`ccl-flow ${lastClipOnRef.current ? 'on' : ''}`} d="M260 110 L500 110 L500 290 L180 290" />
              <text x="530" y="160" className="ccl-lbl-b">D1 · 1N4007</text>
              <text x="530" y="178" className="ccl-lbl-s">anode ↑ · band (cathode) ↓</text>
              <text x="530" y="200" className="ccl-lbl-s" style={{ fill: lastClipOnRef.current ? '#b4541a' : 'var(--muted)' }}>
                {lastClipOnRef.current ? 'CONDUCTING' : 'reverse biased'}
              </text>
              <text x="530" y="256" className="ccl-lbl-b">V<tspan fontSize="10" dy="3">B</tspan><tspan dy="-3"> = {Math.abs(clipState.vb).toFixed(1)} V</tspan></text>
              <text x="530" y="274" className="ccl-lbl-s">
                {clipState.vb === 0 ? '0 V (unbiased)' : clipState.vb < 0 ? 'cell reversed (−V_B)' : '+ terminal up'}
              </text>
              {renderTerminal(720, 110, '#c8302b')}
              {renderTerminal(720, 290, '#222')}
              <text x="745" y="115" className="ccl-lbl">V<tspan fontSize="10" dy="3">out</tspan></text>
              <text x="745" y="295" className="ccl-lbl-s">GND</text>
              {renderGround(720, 302)}
              {/* Schematic Inset */}
              <g transform="translate(790,40)">
                <rect x="0" y="0" width="94" height="128" rx="10" fill="var(--surface-2)" />
                <text x="47" y="18" textAnchor="middle" className="ccl-lbl-s">schematic</text>
                <path d="M14 34 L80 34 M60 34 L60 52 M60 76 L60 96 M14 114 L80 114 M60 104 L60 114" stroke="var(--ink)" strokeWidth="1.6" fill="none" />
                <rect x="22" y="29" width="22" height="10" fill="var(--surface-2)" stroke="var(--ink)" strokeWidth="1.4" />
                {renderSymDiode(60, 64, false)}
                <path d={clipState.vb < 0 ? "M54 96 L66 96 M50 104 L70 104" : "M50 96 L70 96 M54 104 L66 104"} stroke="var(--ink)" strokeWidth="2" />
                <text x="30" y="58" textAnchor="middle" className="ccl-lbl-s">R</text>
              </g>
            </svg>
          </div>

          <div className="ccl-grid2">
            {/* Controls Card */}
            <div className="ccl-card ccl-controls">
              <h3><Sliders size={15} /> Controls</h3>
              <div className="ccl-ctl wide">
                <label>Input Waveform</label>
                <div className="ccl-seg">
                  <button className={clipState.wave === 'sine' ? 'on' : ''} onClick={() => setClipState(s => ({ ...s, wave: 'sine' }))}>Sine</button>
                  <button className={clipState.wave === 'tri' ? 'on' : ''} onClick={() => setClipState(s => ({ ...s, wave: 'tri' }))}>Triangle</button>
                  <button className={clipState.wave === 'sq' ? 'on' : ''} onClick={() => setClipState(s => ({ ...s, wave: 'sq' }))}>Square</button>
                </div>
              </div>

              <div className="ccl-ctl">
                <label htmlFor="cVm">Peak Input V_m</label>
                <input id="cVm" type="range" min="1" max="12" step="0.5" value={clipState.vm} onChange={e => setClipState(s => ({ ...s, vm: +e.target.value }))} />
                <output>{clipState.vm.toFixed(1)} V</output>
              </div>

              <div className="ccl-ctl">
                <label htmlFor="cVb">Bias Battery V_B</label>
                <input id="cVb" type="range" min="-6" max="6" step="0.5" value={clipState.vb} onChange={e => setClipState(s => ({ ...s, vb: +e.target.value }))} />
                <output>{(clipState.vb > 0 ? '+' : '') + clipState.vb.toFixed(1)} V</output>
              </div>

              <div className="ccl-ctl">
                <label htmlFor="cF">Frequency</label>
                <input id="cF" type="range" min="0" max="3" step="0.01" value={clipState.fSlider} onChange={e => setClipState(s => ({ ...s, fSlider: +e.target.value }))} />
                <output>{fmtF(freqFromSlider(clipState.fSlider))}</output>
              </div>

              <div className="ccl-ctl wide">
                <label>Diode Model</label>
                <div className="ccl-seg">
                  <button className={clipState.vg === 0.7 ? 'on' : ''} onClick={() => setClipState(s => ({ ...s, vg: 0.7 }))}>Si 0.7 V</button>
                  <button className={clipState.vg === 0.3 ? 'on' : ''} onClick={() => setClipState(s => ({ ...s, vg: 0.3 }))}>Ge 0.3 V</button>
                  <button className={clipState.vg === 0 ? 'on' : ''} onClick={() => setClipState(s => ({ ...s, vg: 0 }))}>Ideal</button>
                </div>
              </div>

              <div className="ccl-parts">
                <span>Function generator</span><span>R 1 kΩ ¼ W</span><span>D1 1N4007</span><span>DC cell V_B</span><span>Dual-trace scope</span>
              </div>
            </div>

            {/* Scope Card */}
            <div className="ccl-card ccl-scope-card">
              <div className="ccl-scope-top">
                <h3 style={{ margin: 0 }}><Activity size={15} /> Oscilloscope</h3>
                <div className="ccl-legend">
                  <span><i style={{ background: 'var(--ch1)' }} />CH1 Vin</span>
                  <span><i style={{ background: 'var(--ch2)' }} />CH2 Vout</span>
                </div>
                <span className="ccl-status" ref={clipStatusRef}>D1 OFF</span>
              </div>
              <canvas className="ccl-scope" ref={clipCanvasRef} />
              <div className="ccl-readouts">
                <div><small>Clip Level</small><b>{(clipData.lvl >= 0 ? '+' : '') + clipData.lvl.toFixed(2)} V</b></div>
                <div><small>Vout Max</small><b>{clipMax.toFixed(2)} V</b></div>
                <div><small>Vout Min</small><b>{clipMin.toFixed(2)} V</b></div>
                <div><small>Scale</small><b ref={clipVdivRef}>2 V/div</b></div>
              </div>
            </div>
          </div>

          <div className="ccl-grid2">
            <div className="ccl-card ccl-theory">
              <h3>How it works</h3>
              <ol>
                <li>While V_in &lt; V_B + V_γ, D1 is reverse-biased (off). No current flows through it, so V_out = V_in.</li>
                <li>When V_in ≥ V_B + V_γ, D1 turns on. Excess voltage drops across R, and the output is held at the clip level.</li>
                <li>The negative half cycle passes through unchanged — only the positive peak is clipped.</li>
              </ol>
              <div className="ccl-eq">
                V_out = V_in &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; (V_in &lt; V_B + Vγ)<br />
                V_out = V_B + Vγ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;(V_in ≥ V_B + Vγ)
              </div>
            </div>

            <div className="ccl-card ccl-theory">
              <h3>Bench notes</h3>
              <ol>
                <li>Unbiased clipper: set V_B = 0. The output is clipped at about +0.7 V (silicon).</li>
                <li>Negative V_B (cell reversed) moves the clip level below zero, clipping part of the negative half as well.</li>
                <li>Ensure peak current stays safe: I_max = (V_m - V_B - V_γ) / R.</li>
              </ol>
              <div className="ccl-eq">
                I_max = ({clipState.vm} − {clipState.vb} − {clipState.vg}) / 1 kΩ = {clipImax.toFixed(2)} mA
                {clipState.vm <= clipData.lvl && (
                  <><br /><span style={{ color: 'var(--warn)' }}>Peak is below clip level → no clipping</span></>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* ================= EXPERIMENT 2: NEGATIVE CLIPPER ================= */}
      <div style={{ display: activeTab === 'nclipper' ? 'block' : 'none' }}>
        <section className="ccl-lab">
          <div className="ccl-lab-head">
            <h2>Negative Clipper</h2>
            <span className="ccl-tag">shunt · biased</span>
            <p>
              Same circuit components as the positive clipper, but the diode is reversed (cathode on output node) and bias cell is flipped. When input falls below -(V_B + V_γ), the diode conducts and clips the bottom of the wave.
            </p>
          </div>

          <div className="ccl-card ccl-bench">
            <svg viewBox="0 0 900 380" role="img" aria-label="Negative clipper circuit">
              {renderGeneratorSVG(20, 60, nclipState.wave, nclipState.vm, freqFromSlider(nclipState.fSlider))}
              {renderTerminal(170, 110, '#c8302b')}
              {renderTerminal(170, 290, '#222')}
              <text x="190" y="96" className="ccl-lbl-s">+</text>
              <text x="190" y="318" className="ccl-lbl-s">COM</text>
              <path className="ccl-wire" d="M170 110 L250 110" />
              {renderResistorSVG(300, 110, 0, 1000)}
              <text x="300" y="82" textAnchor="middle" className="ccl-lbl-b">R = 1 kΩ</text>
              <text x="300" y="142" textAnchor="middle" className="ccl-lbl-s">brown·black·red·gold</text>
              <path className="ccl-wire" d="M350 110 L720 110" />
              <circle cx="500" cy="110" r="5" fill="#8d9592" stroke="#5d6563" />
              <path className="ccl-wire" d="M500 110 L500 125" />
              {renderDiodeSVG(500, 165, -90, lastNclipOnRef.current)}
              <path className="ccl-wire" d="M500 217 L500 223" />
              {renderBatterySVG(500, 262, nclipState.vb > 0)}
              <path className="ccl-wire" d="M500 302 L500 290" />
              <path className="ccl-wire" d="M170 290 L720 290" />
              <circle cx="500" cy="290" r="5" fill="#8d9592" stroke="#5d6563" />
              <path className={`ccl-flow ${lastNclipOnRef.current ? 'on' : ''}`} d="M180 290 L500 290 L500 110 L260 110" />
              <text x="530" y="160" className="ccl-lbl-b">D1 · 1N4007</text>
              <text x="530" y="178" className="ccl-lbl-s">band (cathode) ↑ · anode ↓</text>
              <text x="530" y="200" className="ccl-lbl-s" style={{ fill: lastNclipOnRef.current ? '#b4541a' : 'var(--muted)' }}>
                {lastNclipOnRef.current ? 'CONDUCTING' : 'reverse biased'}
              </text>
              <text x="530" y="256" className="ccl-lbl-b">V<tspan fontSize="10" dy="3">B</tspan><tspan dy="-3"> = {Math.abs(nclipState.vb).toFixed(1)} V</tspan></text>
              <text x="530" y="274" className="ccl-lbl-s">
                {nclipState.vb === 0 ? '0 V (unbiased)' : nclipState.vb > 0 ? '− terminal up' : 'cell reversed (+ up)'}
              </text>
              {renderTerminal(720, 110, '#c8302b')}
              {renderTerminal(720, 290, '#222')}
              <text x="745" y="115" className="ccl-lbl">V<tspan fontSize="10" dy="3">out</tspan></text>
              <text x="745" y="295" className="ccl-lbl-s">GND</text>
              {renderGround(720, 302)}
              {/* Schematic Inset */}
              <g transform="translate(790,40)">
                <rect x="0" y="0" width="94" height="128" rx="10" fill="var(--surface-2)" />
                <text x="47" y="18" textAnchor="middle" className="ccl-lbl-s">schematic</text>
                <path d="M14 34 L80 34 M60 34 L60 52 M60 76 L60 96 M14 114 L80 114 M60 104 L60 114" stroke="var(--ink)" strokeWidth="1.6" fill="none" />
                <rect x="22" y="29" width="22" height="10" fill="var(--surface-2)" stroke="var(--ink)" strokeWidth="1.4" />
                {renderSymDiode(60, 64, true)}
                <path d={nclipState.vb > 0 ? "M54 96 L66 96 M50 104 L70 104" : "M50 96 L70 96 M54 104 L66 104"} stroke="var(--ink)" strokeWidth="2" />
                <text x="30" y="58" textAnchor="middle" className="ccl-lbl-s">R</text>
              </g>
            </svg>
          </div>

          <div className="ccl-grid2">
            <div className="ccl-card ccl-controls">
              <h3><Sliders size={15} /> Controls</h3>
              <div className="ccl-ctl wide">
                <label>Input Waveform</label>
                <div className="ccl-seg">
                  <button className={nclipState.wave === 'sine' ? 'on' : ''} onClick={() => setNclipState(s => ({ ...s, wave: 'sine' }))}>Sine</button>
                  <button className={nclipState.wave === 'tri' ? 'on' : ''} onClick={() => setNclipState(s => ({ ...s, wave: 'tri' }))}>Triangle</button>
                  <button className={nclipState.wave === 'sq' ? 'on' : ''} onClick={() => setNclipState(s => ({ ...s, wave: 'sq' }))}>Square</button>
                </div>
              </div>

              <div className="ccl-ctl">
                <label htmlFor="nVm">Peak Input V_m</label>
                <input id="nVm" type="range" min="1" max="12" step="0.5" value={nclipState.vm} onChange={e => setNclipState(s => ({ ...s, vm: +e.target.value }))} />
                <output>{nclipState.vm.toFixed(1)} V</output>
              </div>

              <div className="ccl-ctl">
                <label htmlFor="nVb">Bias Battery V_B</label>
                <input id="nVb" type="range" min="-6" max="6" step="0.5" value={nclipState.vb} onChange={e => setNclipState(s => ({ ...s, vb: +e.target.value }))} />
                <output>{(nclipState.vb > 0 ? '+' : '') + nclipState.vb.toFixed(1)} V</output>
              </div>

              <div className="ccl-ctl">
                <label htmlFor="nF">Frequency</label>
                <input id="nF" type="range" min="0" max="3" step="0.01" value={nclipState.fSlider} onChange={e => setNclipState(s => ({ ...s, fSlider: +e.target.value }))} />
                <output>{fmtF(freqFromSlider(nclipState.fSlider))}</output>
              </div>

              <div className="ccl-ctl wide">
                <label>Diode Model</label>
                <div className="ccl-seg">
                  <button className={nclipState.vg === 0.7 ? 'on' : ''} onClick={() => setNclipState(s => ({ ...s, vg: 0.7 }))}>Si 0.7 V</button>
                  <button className={nclipState.vg === 0.3 ? 'on' : ''} onClick={() => setNclipState(s => ({ ...s, vg: 0.3 }))}>Ge 0.3 V</button>
                  <button className={nclipState.vg === 0 ? 'on' : ''} onClick={() => setNclipState(s => ({ ...s, vg: 0 }))}>Ideal</button>
                </div>
              </div>

              <div className="ccl-parts">
                <span>Function generator</span><span>R 1 kΩ ¼ W</span><span>D1 1N4007 (reversed)</span><span>DC cell V_B (− up)</span><span>Dual-trace scope</span>
              </div>
            </div>

            <div className="ccl-card ccl-scope-card">
              <div className="ccl-scope-top">
                <h3 style={{ margin: 0 }}><Activity size={15} /> Oscilloscope</h3>
                <div className="ccl-legend">
                  <span><i style={{ background: 'var(--ch1)' }} />CH1 Vin</span>
                  <span><i style={{ background: 'var(--ch2)' }} />CH2 Vout</span>
                </div>
                <span className="ccl-status" ref={nclipStatusRef}>D1 OFF</span>
              </div>
              <canvas className="ccl-scope" ref={nclipCanvasRef} />
              <div className="ccl-readouts">
                <div><small>Clip Level</small><b>{(nclipData.lvl >= 0 ? '+' : '') + nclipData.lvl.toFixed(2)} V</b></div>
                <div><small>Vout Max</small><b>{nclipMax.toFixed(2)} V</b></div>
                <div><small>Vout Min</small><b>{nclipMin.toFixed(2)} V</b></div>
                <div><small>Scale</small><b ref={nclipVdivRef}>2 V/div</b></div>
              </div>
            </div>
          </div>

          <div className="ccl-grid2">
            <div className="ccl-card ccl-theory">
              <h3>How it works</h3>
              <ol>
                <li>While V_in &gt; -(V_B + V_γ), D1 is reverse-biased (off). Output follows input.</li>
                <li>When V_in ≤ -(V_B + V_γ), D1 turns on, clamping lower output peak at -(V_B + V_γ).</li>
                <li>The positive half cycle passes through unchanged.</li>
              </ol>
              <div className="ccl-eq">
                V_out = V_in &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; (V_in &gt; −(V_B + Vγ))<br />
                V_out = −(V_B + Vγ) &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; (V_in ≤ −(V_B + Vγ))
              </div>
            </div>

            <div className="ccl-card ccl-theory">
              <h3>Bench notes</h3>
              <ol>
                <li>Unbiased clipper: set V_B = 0. Clips at about −0.7 V.</li>
                <li>Negative V_B shifts clip level above zero, clipping part of positive waveform.</li>
                <li>Peak diode current: I_max = (V_m - V_B - V_γ) / R.</li>
              </ol>
              <div className="ccl-eq">
                I_max = ({nclipState.vm} − {nclipState.vb} − {nclipState.vg}) / 1 kΩ = {nclipImax.toFixed(2)} mA
                {-nclipState.vm >= nclipData.lvl && (
                  <><br /><span style={{ color: 'var(--warn)' }}>Negative peak does not reach clip level → no clipping</span></>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* ================= EXPERIMENT 3: POSITIVE CLAMPER ================= */}
      <div style={{ display: activeTab === 'clamper' ? 'block' : 'none' }}>
        <section className="ccl-lab">
          <div className="ccl-lab-head">
            <h2>Positive Clamper</h2>
            <span className="ccl-tag">DC restorer</span>
            <p>
              A series capacitor and a shunt diode shift the entire waveform upward without altering shape. On the first negative cycle, diode conducts and charges C to V_m - V_γ. Afterward, C acts like a series DC source, swinging output from -V_γ up to 2V_m - V_γ.
            </p>
          </div>

          <div className="ccl-card ccl-bench">
            <svg viewBox="0 0 900 380" role="img" aria-label="Positive clamper circuit">
              {renderGeneratorSVG(20, 60, clampState.wave, clampState.vm, freqFromSlider(clampState.fSlider))}
              {renderTerminal(170, 110, '#c8302b')}
              {renderTerminal(170, 290, '#222')}
              <text x="190" y="318" className="ccl-lbl-s">COM</text>
              <path className="ccl-wire" d="M170 110 L245 110" />
              {renderCapacitorSVG(300, 110, 0)}
              <text x="300" y="78" textAnchor="middle" className="ccl-lbl-b">C = {CAPS[clampState.cIdx]} µF</text>
              <text x="300" y="146" textAnchor="middle" className="ccl-lbl-s">− input · + output</text>
              <path className="ccl-wire" d="M355 110 L740 110" />
              <circle cx="470" cy="110" r="5" fill="#8d9592" stroke="#5d6563" />
              <circle cx="620" cy="110" r="5" fill="#8d9592" stroke="#5d6563" />
              <path className="ccl-wire" d="M470 110 L470 125" />
              {renderDiodeSVG(470, 165, -90, lastClampOnRef.current)}
              <path className="ccl-wire" d="M470 217 L470 223" />
              {renderBatterySVG(470, 262, clampState.vb < 0)}
              <path className="ccl-wire" d="M470 302 L470 290" />
              <path className="ccl-wire" d="M620 110 L620 150" />
              {renderResistorSVG(620, 200, 90, RLS[clampState.rIdx])}
              <path className="ccl-wire" d="M620 250 L620 290" />
              <path className="ccl-wire" d="M170 290 L740 290" />
              <circle cx="470" cy="290" r="5" fill="#8d9592" stroke="#5d6563" />
              <circle cx="620" cy="290" r="5" fill="#8d9592" stroke="#5d6563" />
              <path className={`ccl-flow ${lastClampOnRef.current ? 'on' : ''}`} d="M180 290 L470 290 L470 110 L360 110" />
              <text x="372" y="172" className="ccl-lbl-b" textAnchor="end">D1</text>
              <text x="372" y="188" className="ccl-lbl-s" textAnchor="end">1N4007</text>
              <text x="372" y="204" className="ccl-lbl-s" textAnchor="end">band ↑ (cathode)</text>
              <text x="372" y="220" textAnchor="end" style={{ fill: lastClampOnRef.current ? '#b4541a' : 'var(--muted)' }} className="ccl-lbl-s">
                {lastClampOnRef.current ? 'CONDUCTING' : 'off'}
              </text>
              <text x="372" y="252" textAnchor="end" className="ccl-lbl-b">V<tspan fontSize="10" dy="3">B</tspan><tspan dy="-3"> = {Math.abs(clampState.vb).toFixed(1)} V</tspan></text>
              <text x="372" y="270" textAnchor="end" className="ccl-lbl-s">
                {clampState.vb === 0 ? '0 V (unbiased)' : clampState.vb < 0 ? 'cell reversed' : '+ up'}
              </text>
              <text x="645" y="195" className="ccl-lbl-b">R<tspan fontSize="10" dy="3">L</tspan><tspan dy="-3"> = {fmtOhm(RLS[clampState.rIdx])}</tspan></text>
              <text x="645" y="213" className="ccl-lbl-s">load</text>
              {renderTerminal(740, 110, '#c8302b')}
              {renderTerminal(740, 290, '#222')}
              <text x="762" y="115" className="ccl-lbl">V<tspan fontSize="10" dy="3">out</tspan></text>
              {renderGround(740, 302)}
              {/* Schematic Inset */}
              <g transform="translate(790,40)">
                <rect x="0" y="0" width="94" height="128" rx="10" fill="var(--surface-2)" />
                <text x="47" y="18" textAnchor="middle" className="ccl-lbl-s">schematic</text>
                <path d="M10 34 L26 34 M32 34 L84 34 M26 26 L26 42 M32 26 L32 42 M50 34 L50 52 M50 76 L50 96 M10 114 L84 114 M50 104 L50 114 M74 34 L74 56 M74 92 L74 114" stroke="var(--ink)" strokeWidth="1.6" fill="none" />
                {renderSymDiode(50, 64, false)}
                <path d={clampState.vb < 0 ? "M44 96 L56 96 M40 104 L60 104" : "M40 96 L60 96 M44 104 L56 104"} stroke="var(--ink)" strokeWidth="2" />
                <rect x="69" y="56" width="10" height="36" fill="var(--surface-2)" stroke="var(--ink)" strokeWidth="1.4" />
                <text x="29" y="56" textAnchor="middle" className="ccl-lbl-s">C</text>
              </g>
            </svg>
          </div>

          <div className="ccl-grid2">
            <div className="ccl-card ccl-controls">
              <h3><Sliders size={15} /> Controls</h3>
              <div className="ccl-ctl wide">
                <label>Input Waveform</label>
                <div className="ccl-seg">
                  <button className={clampState.wave === 'sine' ? 'on' : ''} onClick={() => setClampState(s => ({ ...s, wave: 'sine' }))}>Sine</button>
                  <button className={clampState.wave === 'tri' ? 'on' : ''} onClick={() => setClampState(s => ({ ...s, wave: 'tri' }))}>Triangle</button>
                  <button className={clampState.wave === 'sq' ? 'on' : ''} onClick={() => setClampState(s => ({ ...s, wave: 'sq' }))}>Square</button>
                </div>
              </div>

              <div className="ccl-ctl">
                <label htmlFor="kVm">Peak Input V_m</label>
                <input id="kVm" type="range" min="1" max="10" step="0.5" value={clampState.vm} onChange={e => setClampState(s => ({ ...s, vm: +e.target.value }))} />
                <output>{clampState.vm.toFixed(1)} V</output>
              </div>

              <div className="ccl-ctl">
                <label htmlFor="kVb">Bias Battery V_B</label>
                <input id="kVb" type="range" min="-4" max="4" step="0.5" value={clampState.vb} onChange={e => setClampState(s => ({ ...s, vb: +e.target.value }))} />
                <output>{(clampState.vb > 0 ? '+' : '') + clampState.vb.toFixed(1)} V</output>
              </div>

              <div className="ccl-ctl">
                <label htmlFor="kF">Frequency</label>
                <input id="kF" type="range" min="0" max="3" step="0.01" value={clampState.fSlider} onChange={e => setClampState(s => ({ ...s, fSlider: +e.target.value }))} />
                <output>{fmtF(freqFromSlider(clampState.fSlider))}</output>
              </div>

              <div className="ccl-ctl">
                <label htmlFor="kC">Capacitor C</label>
                <input id="kC" type="range" min="0" max="4" step="1" value={clampState.cIdx} onChange={e => setClampState(s => ({ ...s, cIdx: +e.target.value }))} />
                <output>{CAPS[clampState.cIdx]} µF</output>
              </div>

              <div className="ccl-ctl">
                <label htmlFor="kR">Load R_L</label>
                <input id="kR" type="range" min="0" max="4" step="1" value={clampState.rIdx} onChange={e => setClampState(s => ({ ...s, rIdx: +e.target.value }))} />
                <output>{fmtOhm(RLS[clampState.rIdx])}</output>
              </div>

              <div className="ccl-ctl wide">
                <label>Diode Model</label>
                <div className="ccl-seg">
                  <button className={clampState.vg === 0.7 ? 'on' : ''} onClick={() => setClampState(s => ({ ...s, vg: 0.7 }))}>Si 0.7 V</button>
                  <button className={clampState.vg === 0.3 ? 'on' : ''} onClick={() => setClampState(s => ({ ...s, vg: 0.3 }))}>Ge 0.3 V</button>
                  <button className={clampState.vg === 0 ? 'on' : ''} onClick={() => setClampState(s => ({ ...s, vg: 0 }))}>Ideal</button>
                </div>
              </div>

              <div className="ccl-note" style={{ color: clampRatio < 10 ? 'var(--warn)' : 'var(--accent)' }}>
                {clampRatio < 10 ? (
                  `RC = ${(clampData.RC * 1000).toFixed(2)} ms is not ≫ T = ${(clampData.T * 1000).toFixed(2)} ms — the capacitor discharges between peaks, causing waveform tilt.`
                ) : (
                  `RC = ${(clampData.RC * 1000).toFixed(1)} ms ≫ T = ${(clampData.T * 1000).toFixed(2)} ms — the shift remains steady.`
                )}
              </div>
            </div>

            <div className="ccl-card ccl-scope-card">
              <div className="ccl-scope-top">
                <h3 style={{ margin: 0 }}><Activity size={15} /> Oscilloscope · Startup Transient</h3>
                <div className="ccl-legend">
                  <span><i style={{ background: 'var(--ch1)' }} />CH1 Vin</span>
                  <span><i style={{ background: 'var(--ch2)' }} />CH2 Vout</span>
                </div>
                <span className="ccl-status" ref={clampStatusRef}>D1 OFF</span>
              </div>
              <canvas className="ccl-scope" ref={clampCanvasRef} />
              <div className="ccl-readouts">
                <div><small>DC Shift</small><b>{(clampShift >= 0 ? '+' : '') + clampShift.toFixed(2)} V</b></div>
                <div><small>Vout Max</small><b>{clampMax.toFixed(2)} V</b></div>
                <div><small>Vout Min</small><b>{clampMin.toFixed(2)} V</b></div>
                <div><small>RC / T</small><b>{clampRatio >= 100 ? clampRatio.toFixed(0) : clampRatio.toFixed(1)}</b></div>
              </div>
            </div>
          </div>

          <div className="ccl-grid2">
            <div className="ccl-card ccl-theory">
              <h3>How it works</h3>
              <ol>
                <li>First negative cycle: D1 conducts and charges C to V_m - V_γ, with + plate towards output.</li>
                <li>Positive cycle: D1 turns off. Capacitor voltage adds to source voltage, boosting output to 2V_m - V_γ.</li>
                <li>Ensure R_L C ≫ T (at least 10T) so the DC shift stays steady without sag.</li>
              </ol>
              <div className="ccl-eq">
                V_out(t) ≈ V_in(t) + (V_m − Vγ + V_B)<br />
                V_out,min ≈ V_B − Vγ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; V_out,max ≈ 2V_m − Vγ + V_B
              </div>
            </div>

            <div className="ccl-card ccl-theory">
              <h3>Bench notes</h3>
              <ol>
                <li>Observe the scope startup transient: waveform settles after first negative peak.</li>
                <li>Try C = 1 µF with R_L = 1 kΩ at 50 Hz. Since RC &lt; T, capacitor drains and sags (tilt).</li>
                <li>A biased clamper (V_B ≠ 0) shifts output minimum to V_B - V_γ.</li>
              </ol>
              <div className="ccl-parts">
                <span>Function generator</span><span>C {CAPS[clampState.cIdx]} µF electrolytic</span><span>D1 1N4007</span><span>R_L {fmtOhm(RLS[clampState.rIdx])}</span><span>DC cell V_B</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* ================= EXPERIMENT 4: NEGATIVE CLAMPER ================= */}
      <div style={{ display: activeTab === 'nclamper' ? 'block' : 'none' }}>
        <section className="ccl-lab">
          <div className="ccl-lab-head">
            <h2>Negative Clamper</h2>
            <span className="ccl-tag">DC restorer</span>
            <p>
              Diode is turned around (anode on output node) and capacitor's + lead faces input. On the first positive peak, the diode conducts and charges C to V_m - V_γ. Afterward, C shifts the whole wave downward to swing from +V_γ to -(2V_m - V_γ).
            </p>
          </div>

          <div className="ccl-card ccl-bench">
            <svg viewBox="0 0 900 380" role="img" aria-label="Negative clamper circuit">
              {renderGeneratorSVG(20, 60, nclampState.wave, nclampState.vm, freqFromSlider(nclampState.fSlider))}
              {renderTerminal(170, 110, '#c8302b')}
              {renderTerminal(170, 290, '#222')}
              <text x="190" y="318" className="ccl-lbl-s">COM</text>
              <path className="ccl-wire" d="M170 110 L245 110" />
              {renderCapacitorSVG(300, 110, 180)}
              <text x="300" y="78" textAnchor="middle" className="ccl-lbl-b">C = {CAPS[nclampState.cIdx]} µF</text>
              <text x="300" y="146" textAnchor="middle" className="ccl-lbl-s">+ input · − output</text>
              <path className="ccl-wire" d="M355 110 L740 110" />
              <circle cx="470" cy="110" r="5" fill="#8d9592" stroke="#5d6563" />
              <circle cx="620" cy="110" r="5" fill="#8d9592" stroke="#5d6563" />
              <path className="ccl-wire" d="M470 110 L470 125" />
              {renderDiodeSVG(470, 165, 90, lastNclampOnRef.current)}
              <path className="ccl-wire" d="M470 217 L470 223" />
              {renderBatterySVG(470, 262, nclampState.vb > 0)}
              <path className="ccl-wire" d="M470 302 L470 290" />
              <path className="ccl-wire" d="M620 110 L620 150" />
              {renderResistorSVG(620, 200, 90, RLS[nclampState.rIdx])}
              <path className="ccl-wire" d="M620 250 L620 290" />
              <path className="ccl-wire" d="M170 290 L740 290" />
              <circle cx="470" cy="290" r="5" fill="#8d9592" stroke="#5d6563" />
              <circle cx="620" cy="290" r="5" fill="#8d9592" stroke="#5d6563" />
              <path className={`ccl-flow ${lastNclampOnRef.current ? 'on' : ''}`} d="M360 110 L470 110 L470 290 L180 290" />
              <text x="372" y="172" className="ccl-lbl-b" textAnchor="end">D1</text>
              <text x="372" y="188" className="ccl-lbl-s" textAnchor="end">1N4007</text>
              <text x="372" y="204" className="ccl-lbl-s" textAnchor="end">anode ↑ · band ↓</text>
              <text x="372" y="220" textAnchor="end" style={{ fill: lastNclampOnRef.current ? '#b4541a' : 'var(--muted)' }} className="ccl-lbl-s">
                {lastNclampOnRef.current ? 'CONDUCTING' : 'off'}
              </text>
              <text x="372" y="252" textAnchor="end" className="ccl-lbl-b">V<tspan fontSize="10" dy="3">B</tspan><tspan dy="-3"> = {Math.abs(nclampState.vb).toFixed(1)} V</tspan></text>
              <text x="372" y="270" textAnchor="end" className="ccl-lbl-s">
                {nclampState.vb === 0 ? '0 V (unbiased)' : nclampState.vb > 0 ? '− up' : 'cell reversed'}
              </text>
              <text x="645" y="195" className="ccl-lbl-b">R<tspan fontSize="10" dy="3">L</tspan><tspan dy="-3"> = {fmtOhm(RLS[nclampState.rIdx])}</tspan></text>
              <text x="645" y="213" className="ccl-lbl-s">load</text>
              {renderTerminal(740, 110, '#c8302b')}
              {renderTerminal(740, 290, '#222')}
              <text x="762" y="115" className="ccl-lbl">V<tspan fontSize="10" dy="3">out</tspan></text>
              {renderGround(740, 302)}
              {/* Schematic Inset */}
              <g transform="translate(790,40)">
                <rect x="0" y="0" width="94" height="128" rx="10" fill="var(--surface-2)" />
                <text x="47" y="18" textAnchor="middle" className="ccl-lbl-s">schematic</text>
                <path d="M10 34 L26 34 M32 34 L84 34 M26 26 L26 42 M32 26 L32 42 M50 34 L50 52 M50 76 L50 96 M10 114 L84 114 M50 104 L50 114 M74 34 L74 56 M74 92 L74 114" stroke="var(--ink)" strokeWidth="1.6" fill="none" />
                {renderSymDiode(50, 64, true)}
                <path d={nclampState.vb > 0 ? "M44 96 L56 96 M40 104 L60 104" : "M40 96 L60 96 M44 104 L56 104"} stroke="var(--ink)" strokeWidth="2" />
                <rect x="69" y="56" width="10" height="36" fill="var(--surface-2)" stroke="var(--ink)" strokeWidth="1.4" />
                <text x="29" y="56" textAnchor="middle" className="ccl-lbl-s">C</text>
              </g>
            </svg>
          </div>

          <div className="ccl-grid2">
            <div className="ccl-card ccl-controls">
              <h3><Sliders size={15} /> Controls</h3>
              <div className="ccl-ctl wide">
                <label>Input Waveform</label>
                <div className="ccl-seg">
                  <button className={nclampState.wave === 'sine' ? 'on' : ''} onClick={() => setNclampState(s => ({ ...s, wave: 'sine' }))}>Sine</button>
                  <button className={nclampState.wave === 'tri' ? 'on' : ''} onClick={() => setNclampState(s => ({ ...s, wave: 'tri' }))}>Triangle</button>
                  <button className={nclampState.wave === 'sq' ? 'on' : ''} onClick={() => setNclampState(s => ({ ...s, wave: 'sq' }))}>Square</button>
                </div>
              </div>

              <div className="ccl-ctl">
                <label htmlFor="mVm">Peak Input V_m</label>
                <input id="mVm" type="range" min="1" max="10" step="0.5" value={nclampState.vm} onChange={e => setNclampState(s => ({ ...s, vm: +e.target.value }))} />
                <output>{nclampState.vm.toFixed(1)} V</output>
              </div>

              <div className="ccl-ctl">
                <label htmlFor="mVb">Bias Battery V_B</label>
                <input id="mVb" type="range" min="-4" max="4" step="0.5" value={nclampState.vb} onChange={e => setNclampState(s => ({ ...s, vb: +e.target.value }))} />
                <output>{(nclampState.vb > 0 ? '+' : '') + nclampState.vb.toFixed(1)} V</output>
              </div>

              <div className="ccl-ctl">
                <label htmlFor="mF">Frequency</label>
                <input id="mF" type="range" min="0" max="3" step="0.01" value={nclampState.fSlider} onChange={e => setNclampState(s => ({ ...s, fSlider: +e.target.value }))} />
                <output>{fmtF(freqFromSlider(nclampState.fSlider))}</output>
              </div>

              <div className="ccl-ctl">
                <label htmlFor="mC">Capacitor C</label>
                <input id="mC" type="range" min="0" max="4" step="1" value={nclampState.cIdx} onChange={e => setNclampState(s => ({ ...s, cIdx: +e.target.value }))} />
                <output>{CAPS[nclampState.cIdx]} µF</output>
              </div>

              <div className="ccl-ctl">
                <label htmlFor="mR">Load R_L</label>
                <input id="mR" type="range" min="0" max="4" step="1" value={nclampState.rIdx} onChange={e => setNclampState(s => ({ ...s, rIdx: +e.target.value }))} />
                <output>{fmtOhm(RLS[nclampState.rIdx])}</output>
              </div>

              <div className="ccl-ctl wide">
                <label>Diode Model</label>
                <div className="ccl-seg">
                  <button className={nclampState.vg === 0.7 ? 'on' : ''} onClick={() => setNclampState(s => ({ ...s, vg: 0.7 }))}>Si 0.7 V</button>
                  <button className={nclampState.vg === 0.3 ? 'on' : ''} onClick={() => setNclampState(s => ({ ...s, vg: 0.3 }))}>Ge 0.3 V</button>
                  <button className={nclampState.vg === 0 ? 'on' : ''} onClick={() => setNclampState(s => ({ ...s, vg: 0 }))}>Ideal</button>
                </div>
              </div>

              <div className="ccl-note" style={{ color: nclampRatio < 10 ? 'var(--warn)' : 'var(--accent)' }}>
                {nclampRatio < 10 ? (
                  `RC = ${(nclampData.RC * 1000).toFixed(2)} ms is not ≫ T = ${(nclampData.T * 1000).toFixed(2)} ms — the capacitor discharges between peaks, causing waveform tilt.`
                ) : (
                  `RC = ${(nclampData.RC * 1000).toFixed(1)} ms ≫ T = ${(nclampData.T * 1000).toFixed(2)} ms — the shift remains steady.`
                )}
              </div>
            </div>

            <div className="ccl-card ccl-scope-card">
              <div className="ccl-scope-top">
                <h3 style={{ margin: 0 }}><Activity size={15} /> Oscilloscope · Startup Transient</h3>
                <div className="ccl-legend">
                  <span><i style={{ background: 'var(--ch1)' }} />CH1 Vin</span>
                  <span><i style={{ background: 'var(--ch2)' }} />CH2 Vout</span>
                </div>
                <span className="ccl-status" ref={nclampStatusRef}>D1 OFF</span>
              </div>
              <canvas className="ccl-scope" ref={nclampCanvasRef} />
              <div className="ccl-readouts">
                <div><small>DC Shift</small><b>{(nclampShift >= 0 ? '+' : '') + nclampShift.toFixed(2)} V</b></div>
                <div><small>Vout Max</small><b>{nclampMax.toFixed(2)} V</b></div>
                <div><small>Vout Min</small><b>{nclampMin.toFixed(2)} V</b></div>
                <div><small>RC / T</small><b>{nclampRatio >= 100 ? nclampRatio.toFixed(0) : nclampRatio.toFixed(1)}</b></div>
              </div>
            </div>
          </div>

          <div className="ccl-grid2">
            <div className="ccl-card ccl-theory">
              <h3>How it works</h3>
              <ol>
                <li>First positive cycle: D1 conducts and charges C to V_m - V_γ, with + plate on input side.</li>
                <li>Negative cycle: D1 turns off. Capacitor voltage adds to negative source, taking output to -(2V_m - V_γ).</li>
                <li>Ensure R_L C ≫ T (at least 10T) so the downward shift stays steady.</li>
              </ol>
              <div className="ccl-eq">
                V_out(t) ≈ V_in(t) − (V_m − Vγ + V_B)<br />
                V_out,max ≈ −V_B + Vγ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; V_out,min ≈ −(2V_m − Vγ + V_B)
              </div>
            </div>

            <div className="ccl-card ccl-theory">
              <h3>Bench notes</h3>
              <ol>
                <li>Observe the scope startup transient: waveform settles after first positive peak.</li>
                <li>Try C = 1 µF with R_L = 1 kΩ at 50 Hz. Since RC &lt; T, output sags (tilt).</li>
                <li>A biased clamper (V_B ≠ 0) shifts output maximum to -V_B + V_γ.</li>
              </ol>
              <div className="ccl-parts">
                <span>Function generator</span><span>C {CAPS[nclampState.cIdx]} µF electrolytic</span><span>D1 1N4007</span><span>R_L {fmtOhm(RLS[nclampState.rIdx])}</span><span>DC cell V_B</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
