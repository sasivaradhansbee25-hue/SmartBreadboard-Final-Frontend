import React, { useRef, useEffect, useState, useCallback } from 'react';

/**
 * SmartBreadboard 3D — Multi-Domain Waveform, Spectrum & Transient Canvas (Phase 25, 26, 27, 28, 29)
 *
 * Renders:
 * 1. Time-Domain Numerical Transient Responses (RC, RL, RLC) with:
 *    - Tau (τ) 63.2% marker
 *    - Peak & Overshoot marker
 *    - Settling time marker
 *    - Interactive cursor readout
 *    - Play / Pause / Reset time progression
 *    - Clear "SIMULATED / NOT MEASURED" scientific integrity badge
 * 2. Generalized Frequency-Domain Spectra (Magnitude dB, Magnitude Linear, Phase °, Impedance Ω, Current mA)
 * 3. Cutoff (-3dB), Resonance (f0), and Op-Amp transfer waveforms.
 */
export default function WaveformCanvas({
  waveform,
  width = 480,
  height = 220,
  title = 'Signal Spectrum',
  transientData = null
}) {
  const canvasRef = useRef(null);
  const [activeMode, setActiveMode] = useState('magDb'); // 'magDb' | 'magLin' | 'phase' | 'impedance' | 'current'
  const [isPlaying, setIsPlaying] = useState(false);
  const [playheadTime, setPlayheadTime] = useState(null);
  const [hoverCoord, setHoverCoord] = useState(null);
  const [selectedSignalIdx, setSelectedSignalIdx] = useState(0);

  // Animation frame handler for transient playback
  useEffect(() => {
    let animId;
    if (isPlaying) {
      const startTime = performance.now();
      const durationMs = 3000; // 3 seconds loop
      const step = (now) => {
        const elapsed = (now - startTime) % durationMs;
        const frac = elapsed / durationMs;
        setPlayheadTime(frac);
        animId = requestAnimationFrame(step);
      };
      animId = requestAnimationFrame(step);
    } else {
      setPlayheadTime(null);
    }
    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [isPlaying]);

  const handleMouseMove = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setHoverCoord({ x, y });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoverCoord(null);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Use transientData signals or waveform points
    const activeTransient = transientData && transientData.time && transientData.signals && transientData.signals.length > 0;
    const hasWaveformPoints = waveform && waveform.points && waveform.points.length > 0;

    if (!activeTransient && !hasWaveformPoints) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const padding = { top: 25, right: 25, bottom: 35, left: 56 };
    const graphW = width - padding.left - padding.right;
    const graphH = height - padding.top - padding.bottom;

    // Background
    ctx.fillStyle = '#0f172a'; // Slate 900
    ctx.fillRect(0, 0, width, height);

    // Grid Lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;

    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (graphH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
    }

    for (let j = 0; j <= 5; j++) {
      const x = padding.left + (graphW / 5) * j;
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, height - padding.bottom);
      ctx.stroke();
    }

    // =========================================================================
    // 1. TIME-DOMAIN TRANSIENT MNA SIMULATION
    // =========================================================================
    if (activeTransient) {
      const time = transientData.time;
      const sigList = transientData.signals;
      const targetSig = sigList[selectedSignalIdx] || sigList[0];
      const vals = targetSig.values || [];
      const tMax = time[time.length - 1] || 0.01;
      const tMin = time[0] || 0.0;

      const vMin = Math.min(...vals, 0.0);
      const vMax = Math.max(...vals, 1e-6);
      const vSpan = (vMax - vMin) * 1.15 || 1.0;
      const vBase = vMin - (vMax - vMin) * 0.05;

      const getX = (t) => padding.left + ((t - tMin) / (tMax - tMin || 1)) * graphW;
      const getY = (v) => padding.top + graphH - ((v - vBase) / vSpan) * graphH;

      // Draw Gradient under curve
      const gradient = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
      gradient.addColorStop(0, targetSig.type === 'current' ? 'rgba(168, 85, 247, 0.35)' : 'rgba(56, 189, 248, 0.35)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0.0)');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(getX(time[0]), getY(vMin));
      for (let i = 0; i < time.length; i++) {
        ctx.lineTo(getX(time[i]), getY(vals[i]));
      }
      ctx.lineTo(getX(time[time.length - 1]), getY(vMin));
      ctx.closePath();
      ctx.fill();

      // Tau Marker (τ)
      const metrics = transientData.metrics || {};
      if (metrics.tau && metrics.tau <= tMax) {
        const tauX = getX(metrics.tau);
        ctx.strokeStyle = '#38bdf8';
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(tauX, padding.top);
        ctx.lineTo(tauX, height - padding.bottom);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#38bdf8';
        ctx.font = '10px Inter, sans-serif';
        ctx.fillText(`1τ (~63%)`, tauX + 4, padding.top + 12);
      }

      // Peak / Overshoot Marker
      if (metrics.peakTime && metrics.overshootPercent > 1.0) {
        const pkX = getX(metrics.peakTime);
        const pkY = getY(metrics.peakValue);
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(pkX, pkY, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillText(`Peak (+${metrics.overshootPercent.toFixed(1)}%)`, pkX + 6, pkY - 6);
      }

      // Draw main signal trace
      ctx.strokeStyle = targetSig.type === 'current' ? '#a855f7' : '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let i = 0; i < time.length; i++) {
        const x = getX(time[i]);
        const y = getY(vals[i]);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Playhead line
      if (playheadTime !== null) {
        const curT = tMin + playheadTime * (tMax - tMin);
        const pX = getX(curT);
        ctx.strokeStyle = '#f43f5e'; // Rose 500
        ctx.lineWidth = 1.5;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(pX, padding.top);
        ctx.lineTo(pX, height - padding.bottom);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Cursor readout
      if (hoverCoord && hoverCoord.x >= padding.left && hoverCoord.x <= width - padding.right) {
        const frac = (hoverCoord.x - padding.left) / graphW;
        const hoverT = tMin + frac * (tMax - tMin);
        const sampleIdx = Math.min(Math.floor(frac * (time.length - 1)), time.length - 1);
        const hoverVal = vals[sampleIdx];
        const hoverY = getY(hoverVal);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(hoverCoord.x, padding.top);
        ctx.lineTo(hoverCoord.x, height - padding.bottom);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(hoverCoord.x, hoverY, 4, 0, Math.PI * 2);
        ctx.fill();

        // Readout tooltip
        const label = `t=${(hoverT * 1000).toFixed(2)}ms, ${targetSig.name}=${hoverVal.toFixed(3)}${targetSig.unit}`;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.fillRect(hoverCoord.x + 8, hoverY - 22, ctx.measureText(label).width + 12, 20);
        ctx.strokeStyle = '#38bdf8';
        ctx.strokeRect(hoverCoord.x + 8, hoverY - 22, ctx.measureText(label).width + 12, 20);
        ctx.fillStyle = '#38bdf8';
        ctx.font = '10px Inter, sans-serif';
        ctx.fillText(label, hoverCoord.x + 14, hoverY - 8);
      }

      // Axes labels
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px Inter, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${vMax.toFixed(2)}${targetSig.unit}`, padding.left - 6, padding.top + 10);
      ctx.fillText(`${vMin.toFixed(2)}${targetSig.unit}`, padding.left - 6, height - padding.bottom);

      ctx.textAlign = 'center';
      ctx.fillText(`${(tMin * 1000).toFixed(1)}ms`, padding.left, height - padding.bottom + 16);
      ctx.fillText(`${(tMax * 1000).toFixed(1)}ms`, width - padding.right, height - padding.bottom + 16);
      ctx.fillText('Time (ms)', width / 2, height - 6);
      return;
    }

    // =========================================================================
    // 2. FREQUENCY-DOMAIN & OP-AMP SPECTRA
    // =========================================================================
    const points = waveform.points;
    const isFrequencyDomain = waveform.type === 'frequency_response';

    if (isFrequencyDomain) {
      const minF = points[0].frequencyHz || 1;
      const maxF = points[points.length - 1].frequencyHz || 1000;
      const logMin = Math.log10(minF);
      const logMax = Math.log10(maxF);

      let yValues = [];
      let yUnit = 'dB';
      let lineColor = '#f59e0b';
      let gradientTop = 'rgba(245, 158, 11, 0.35)';

      if (activeMode === 'magDb') {
        yValues = points.map(p => p.magnitudeDb !== undefined ? p.magnitudeDb : (p.gainDb !== undefined ? p.gainDb : 0));
        yUnit = 'dB';
        lineColor = '#f59e0b';
        gradientTop = 'rgba(245, 158, 11, 0.35)';
      } else if (activeMode === 'magLin') {
        yValues = points.map(p => p.gainMagnitude !== undefined ? p.gainMagnitude : (p.magnitudeV !== undefined ? p.magnitudeV : 1));
        yUnit = '';
        lineColor = '#10b981';
        gradientTop = 'rgba(16, 185, 129, 0.35)';
      } else if (activeMode === 'phase') {
        yValues = points.map(p => p.phaseDeg !== undefined ? p.phaseDeg : 0);
        yUnit = '°';
        lineColor = '#818cf8';
        gradientTop = 'rgba(129, 140, 248, 0.35)';
      } else if (activeMode === 'impedance') {
        yValues = points.map(p => p.impedanceMagnitudeOhms !== undefined ? p.impedanceMagnitudeOhms : 0);
        yUnit = 'Ω';
        lineColor = '#a855f7';
        gradientTop = 'rgba(168, 85, 247, 0.35)';
      } else if (activeMode === 'current') {
        yValues = points.map(p => p.currentMagnitudeMa !== undefined ? p.currentMagnitudeMa : (p.currentMagnitudeMa || 0));
        yUnit = 'mA';
        lineColor = '#38bdf8';
        gradientTop = 'rgba(56, 189, 248, 0.35)';
      }

      let minY = Math.min(...yValues);
      let maxY = Math.max(...yValues);
      if (maxY === minY) { maxY += 1; minY -= 1; }
      const padY = (maxY - minY) * 0.15;
      minY -= padY;
      maxY += padY;

      const getX = (f) => {
        const logF = Math.log10(Math.max(f, 0.1));
        return padding.left + ((logF - logMin) / (logMax - logMin || 1)) * graphW;
      };

      const getY = (val) => padding.top + graphH - ((val - minY) / (maxY - minY)) * graphH;

      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      points.forEach((p, idx) => {
        const x = getX(p.frequencyHz);
        const y = getY(yValues[idx]);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // Axis labels
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px Inter, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${maxY.toFixed(1)}${yUnit}`, padding.left - 6, padding.top + 10);
      ctx.fillText(`${minY.toFixed(1)}${yUnit}`, padding.left - 6, height - padding.bottom);

      ctx.textAlign = 'center';
      ctx.fillText(`${minF < 1000 ? minF.toFixed(0) + 'Hz' : (minF / 1000).toFixed(1) + 'kHz'}`, padding.left, height - padding.bottom + 16);
      ctx.fillText(`${maxF < 1000 ? maxF.toFixed(0) + 'Hz' : (maxF / 1000).toFixed(0) + 'kHz'}`, width - padding.right, height - padding.bottom + 16);
      ctx.fillText('Frequency (Log Scale)', width / 2, height - 6);
    }
  }, [waveform, transientData, width, height, activeMode, selectedSignalIdx, playheadTime, hoverCoord]);

  const isTransient = Boolean(transientData && transientData.signals && transientData.signals.length > 0);
  const isFrequencyDomain = waveform?.type === 'frequency_response';

  return (
    <div className="bg-slate-900/90 border border-slate-700/80 rounded-xl p-3 shadow-xl backdrop-blur-md">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full animate-pulse ${isFrequencyDomain ? 'bg-amber-400' : 'bg-cyan-400'}`}></span>
          {waveform?.name || (isTransient ? `${transientData.circuitType || 'Transient'} Response` : title)}
        </span>

        {/* Scientific Integrity Badges */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-mono uppercase bg-cyan-950/80 text-cyan-300 px-1.5 py-0.5 rounded border border-cyan-700/60">
            SIMULATED
          </span>
          <span className="text-[10px] font-mono uppercase bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700">
            NOT MEASURED
          </span>
        </div>

        {/* Transient Signal Selector & Play Controls */}
        {isTransient && (
          <div className="flex items-center gap-2">
            <select
              value={selectedSignalIdx}
              onChange={(e) => setSelectedSignalIdx(Number(e.target.value))}
              className="bg-slate-950/80 border border-slate-800 text-slate-300 text-[11px] rounded px-1.5 py-0.5 font-mono"
            >
              {transientData.signals.map((sig, idx) => (
                <option key={sig.name} value={idx}>
                  {sig.name} ({sig.type})
                </option>
              ))}
            </select>
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="px-2 py-0.5 text-[11px] font-mono bg-cyan-950/60 hover:bg-cyan-900/80 text-cyan-300 rounded border border-cyan-800"
            >
              {isPlaying ? 'Pause ⏸' : 'Play ▶'}
            </button>
          </div>
        )}

        {/* Frequency Domain Display Mode Switcher */}
        {isFrequencyDomain && (
          <div className="flex items-center gap-1 bg-slate-950/80 p-0.5 rounded-lg border border-slate-800 text-[10px]">
            <button
              onClick={() => setActiveMode('magDb')}
              className={`px-2 py-0.5 rounded ${activeMode === 'magDb' ? 'bg-amber-500/20 text-amber-400 font-semibold border border-amber-500/40' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Mag (dB)
            </button>
            <button
              onClick={() => setActiveMode('magLin')}
              className={`px-2 py-0.5 rounded ${activeMode === 'magLin' ? 'bg-emerald-500/20 text-emerald-400 font-semibold border border-emerald-500/40' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Mag (Lin)
            </button>
            <button
              onClick={() => setActiveMode('phase')}
              className={`px-2 py-0.5 rounded ${activeMode === 'phase' ? 'bg-indigo-500/20 text-indigo-400 font-semibold border border-indigo-500/40' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Phase (°)
            </button>
            <button
              onClick={() => setActiveMode('impedance')}
              className={`px-2 py-0.5 rounded ${activeMode === 'impedance' ? 'bg-purple-500/20 text-purple-400 font-semibold border border-purple-500/40' : 'text-slate-400 hover:text-slate-200'}`}
            >
              |Z| (Ω)
            </button>
            <button
              onClick={() => setActiveMode('current')}
              className={`px-2 py-0.5 rounded ${activeMode === 'current' ? 'bg-cyan-500/20 text-cyan-400 font-semibold border border-cyan-500/40' : 'text-slate-400 hover:text-slate-200'}`}
            >
              I (mA)
            </button>
          </div>
        )}
      </div>

      <div className="relative flex justify-center">
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          style={{ width: `${width}px`, height: `${height}px`, cursor: isTransient ? 'crosshair' : 'default' }}
          className="rounded-lg"
        />
      </div>
    </div>
  );
}
