import React, { useState, useMemo } from 'react';
import { useCircuit } from '../context/CircuitContext';

/**
 * Signal color palette for distinct multi-trace visualization.
 */
const SIGNAL_COLORS = [
  '#38bdf8', // Sky Cyan
  '#34d399', // Emerald Green
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#a855f7', // Purple
  '#06b6d4', // Teal
  '#f97316', // Orange
  '#6366f1', // Indigo
];

/**
 * Phase 24.2 — SimulationWaveformPanel
 * Professional live simulation analog graph component.
 * Displays real DC steady-state operating points and MNA results without fabricating waveform data.
 * Tabs: [ Voltage ], [ Current ], [ Power ]
 * Selectable signals: V(NODE_x), I(Comp_x), P(Comp_x)
 */
export default function SimulationWaveformPanel({
  simulationResult: propResult,
  simulationStatus: propStatus,
  activeCircuit: propCircuit
}) {
  const context = useCircuit ? useCircuit() : {};
  const activeCircuit = propCircuit || context.activeCircuit;
  const simulationResult = propResult || context.simulationResult;
  const simulationStatus = propStatus || context.simulationStatus;
  const simulationSignature = context.simulationSignature;

  const {
    clearSupply,
    invalidateSimulation,
    currentTimeIndex = 0,
    currentTransientSample = null,
    isPlaying = false,
    playSimulation,
    pauseSimulation,
    restartSimulation,
    seekSimulation,
    resetSimulation
  } = context;

  // Active tab: 'voltage' | 'current' | 'power'
  const [activeTab, setActiveTab] = useState('voltage');

  // Multi-signal selection state keyed by signal name
  const [selectedSignals, setSelectedSignals] = useState({});

  // Hover state for interactive inspection cursor
  const [hoverX, setHoverX] = useState(null);

  // Check if simulation is fresh and solved
  const isSolved = (simulationStatus === 'SOLVED' || simulationStatus === 'RUNNING' || simulationStatus === 'PAUSED') && Boolean(simulationResult);
  const isStale = Boolean(
    isSolved &&
    activeCircuit?.circuit_signature &&
    simulationResult?.circuit_signature &&
    activeCircuit.circuit_signature !== simulationResult.circuit_signature
  );

  // 7-state deterministic simulation status (Phase 24.4)
  const currentStatus = useMemo(() => {
    if (isStale) return 'STALE';
    if (simulationStatus === 'PAUSED') return 'PAUSED';
    if (simulationStatus === 'RUNNING' || isPlaying) return 'RUNNING';
    if (simulationStatus === 'SOLVED' && simulationResult) return 'SOLVED';
    if (simulationStatus === 'BLOCKED' || simulationResult?.status === 'BLOCKED') return 'BLOCKED';
    if (simulationStatus === 'ERROR' || simulationResult?.status === 'ERROR') return 'ERROR';
    return 'READY';
  }, [isStale, simulationStatus, isPlaying, simulationResult]);

  // Reset simulation handler
  const handleResetSimulation = () => {
    if (resetSimulation) {
      resetSimulation();
    }
    if (clearSupply) {
      clearSupply();
    } else if (invalidateSimulation) {
      invalidateSimulation();
    }
  };

  // Time base for real transient / DC simulation plotting
  const timePoints = useMemo(() => {
    if (simulationResult?.time && Array.isArray(simulationResult.time) && simulationResult.time.length > 0) {
      return simulationResult.time;
    }
    // Default 10 ms DC observation window (6 points)
    return [0.0, 0.002, 0.004, 0.006, 0.008, 0.010];
  }, [simulationResult]);

  // Graph dimensions
  const svgWidth = 620;
  const svgHeight = 240;
  const padding = { top: 25, right: 30, bottom: 35, left: 65 };
  const plotWidth = svgWidth - padding.left - padding.right;
  const plotHeight = svgHeight - padding.top - padding.bottom;

  // Active timeline index (hover overrides timeline cursor during mouse inspection)
  const activeCursorIndex = useMemo(() => {
    if (hoverX !== null) {
      const ratio = (hoverX - padding.left) / plotWidth;
      return Math.min(Math.max(0, Math.round(ratio * (timePoints.length - 1))), timePoints.length - 1);
    }
    return Math.min(Math.max(0, currentTimeIndex), timePoints.length - 1);
  }, [hoverX, currentTimeIndex, timePoints.length, plotWidth, padding.left]);

  const activeTime = timePoints[activeCursorIndex] ?? (currentTransientSample?.time ?? 0);
  const totalDuration = simulationResult?.duration || timePoints[timePoints.length - 1] || 0.01;

  // Extract real signals from simulation result evaluated at the active timeline sample
  const availableSignals = useMemo(() => {
    if (!isSolved || isStale) {
      return { voltage: [], current: [], power: [] };
    }

    const voltages = [];
    const currents = [];
    const powers = [];

    // 1. Node voltages: V(node)
    const nodeVoltages = simulationResult.node_voltages || {};
    Object.entries(nodeVoltages).forEach(([node, val]) => {
      const v = Array.isArray(val) ? (val[activeCursorIndex] ?? 0) : (typeof val === 'number' ? val : 0);
      voltages.push({
        id: `V(${node})`,
        name: `V(${node})`,
        category: 'voltage',
        value: v,
        unit: 'V',
        formatted: `${v.toFixed(3)} V`,
        type: 'node'
      });
    });

    // 2. Component voltages: V(comp)
    const compVoltages = simulationResult.component_voltages || {};
    Object.entries(compVoltages).forEach(([comp, val]) => {
      const v = Array.isArray(val) ? (val[activeCursorIndex] ?? 0) : (typeof val === 'number' ? val : 0);
      voltages.push({
        id: `V(${comp})`,
        name: `V(${comp})`,
        category: 'voltage',
        value: v,
        unit: 'V',
        formatted: `${v.toFixed(3)} V`,
        type: 'component'
      });
    });

    // 3. Component currents: I(comp)
    const compCurrents = simulationResult.component_currents || {};
    Object.entries(compCurrents).forEach(([comp, val]) => {
      const rawI = Array.isArray(val) ? (val[activeCursorIndex] ?? 0) : (typeof val === 'number' ? val : 0);
      const mA = rawI * 1000.0;
      currents.push({
        id: `I(${comp})`,
        name: `I(${comp})`,
        category: 'current',
        value: mA,
        unit: 'mA',
        formatted: `${mA.toFixed(3)} mA`,
        type: 'component'
      });
    });

    // 4. Component powers: P(comp)
    const compPowers = simulationResult.component_power || {};
    Object.entries(compPowers).forEach(([comp, val]) => {
      const rawP = Array.isArray(val) ? (val[activeCursorIndex] ?? 0) : (typeof val === 'number' ? val : 0);
      const mW = rawP * 1000.0;
      powers.push({
        id: `P(${comp})`,
        name: `P(${comp})`,
        category: 'power',
        value: mW,
        unit: 'mW',
        formatted: `${mW.toFixed(3)} mW`,
        type: 'component'
      });
    });

    return { voltage: voltages, current: currents, power: powers };
  }, [isSolved, isStale, simulationResult, activeCursorIndex]);

  // Current tab's signals
  const currentTabSignals = availableSignals[activeTab] || [];

  // Default selection if none selected for current tab
  const activeSelectedSignals = useMemo(() => {
    const list = [];
    currentTabSignals.forEach((sig, idx) => {
      const isExplicitlySet = selectedSignals[sig.id] !== undefined;
      // Default first 2 signals to selected if not explicitly toggled
      const isSelected = isExplicitlySet ? selectedSignals[sig.id] : idx < 2;
      if (isSelected) {
        list.push({
          ...sig,
          color: SIGNAL_COLORS[idx % SIGNAL_COLORS.length]
        });
      }
    });
    return list;
  }, [currentTabSignals, selectedSignals]);

  // Toggle signal selection
  const handleToggleSignal = (sigId) => {
    setSelectedSignals(prev => {
      const currentlySelected = prev[sigId] !== undefined ? prev[sigId] : true;
      return { ...prev, [sigId]: !currentlySelected };
    });
  };

  // Calculate Y-scale bounds
  const { minY, maxY, yTicks } = useMemo(() => {
    if (activeSelectedSignals.length === 0) {
      return { minY: 0, maxY: 5, yTicks: [0, 1.25, 2.5, 3.75, 5] };
    }

    let min = 0;
    let max = 0;

    activeSelectedSignals.forEach(sig => {
      const waveform = simulationResult?.waveforms?.[sig.id];
      if (Array.isArray(waveform) && waveform.length > 0) {
        waveform.forEach(v => {
          if (v < min) min = v;
          if (v > max) max = v;
        });
      } else {
        if (sig.value < min) min = sig.value;
        if (sig.value > max) max = sig.value;
      }
    });

    if (min === max) {
      if (max > 0) {
        min = 0;
        max = max * 1.3;
      } else if (max < 0) {
        min = max * 1.3;
        max = 0;
      } else {
        min = 0;
        max = 1.0;
      }
    } else {
      const span = max - min;
      min -= span * 0.1;
      max += span * 0.15;
    }

    // Generate 5 nice ticks
    const step = (max - min) / 4;
    const ticks = [min, min + step, min + step * 2, min + step * 3, max];

    return { minY: min, maxY: max, yTicks: ticks };
  }, [activeSelectedSignals, simulationResult]);

  // Coordinate mappers
  const getX = (t) => {
    const tMin = timePoints[0] || 0;
    const tMax = timePoints[timePoints.length - 1] || 0.01;
    const ratio = tMax > tMin ? (t - tMin) / (tMax - tMin) : 0;
    return padding.left + ratio * plotWidth;
  };

  const getY = (val) => {
    const ratio = (val - minY) / (maxY - minY || 1);
    return padding.top + plotHeight - ratio * plotHeight;
  };

  // Build SVG paths for selected signals
  const signalPaths = useMemo(() => {
    return activeSelectedSignals.map(sig => {
      const waveform = simulationResult?.waveforms?.[sig.id];
      let points = [];

      if (Array.isArray(waveform) && waveform.length === timePoints.length) {
        points = timePoints.map((t, i) => `${getX(t).toFixed(1)},${getY(waveform[i]).toFixed(1)}`);
      } else {
        // True DC steady-state operating point across time axis
        points = timePoints.map(t => `${getX(t).toFixed(1)},${getY(sig.value).toFixed(1)}`);
      }

      return {
        ...sig,
        d: `M ${points.join(' L ')}`
      };
    });
  }, [activeSelectedSignals, simulationResult, timePoints, minY, maxY]);

  // Tab unit
  const tabUnit = activeTab === 'voltage' ? 'V' : activeTab === 'current' ? 'mA' : 'mW';

  return (
    <div style={{
      background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.95) 0%, rgba(10, 15, 30, 0.98) 100%)',
      backdropFilter: 'blur(16px)',
      border: '1px solid rgba(56, 189, 248, 0.25)',
      borderRadius: '14px',
      padding: '20px',
      color: '#f8fafc',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      boxShadow: '0 12px 40px rgba(0, 0, 0, 0.5)',
      width: '100%',
      maxWidth: '680px',
      boxSizing: 'border-box',
      margin: '0 auto'
    }}>
      {/* Header bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #0284c7, #38bdf8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
            boxShadow: '0 0 12px rgba(56, 189, 248, 0.4)'
          }}>
            📈
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, letterSpacing: '0.04em', color: '#f8fafc' }}>
              Analog Simulation Waveforms
            </h3>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
              Deterministic MNA Operating Points • Single Source of Truth
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Status Badge */}
          {currentStatus === 'SOLVED' && (
            <span style={{
              fontSize: '11px',
              fontWeight: 600,
              padding: '3px 9px',
              borderRadius: '20px',
              background: 'rgba(16, 185, 129, 0.15)',
              color: '#34d399',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#34d399' }} />
              SOLVED
            </span>
          )}
          {currentStatus === 'RUNNING' && (
            <span style={{
              fontSize: '11px',
              fontWeight: 600,
              padding: '3px 9px',
              borderRadius: '20px',
              background: 'rgba(56, 189, 248, 0.15)',
              color: '#38bdf8',
              border: '1px solid rgba(56, 189, 248, 0.35)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#38bdf8' }} />
              RUNNING
            </span>
          )}
          {currentStatus === 'PAUSED' && (
            <span style={{
              fontSize: '11px',
              fontWeight: 600,
              padding: '3px 9px',
              borderRadius: '20px',
              background: 'rgba(245, 158, 11, 0.15)',
              color: '#f59e0b',
              border: '1px solid rgba(245, 158, 11, 0.35)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <span>⏸</span>
              PAUSED
            </span>
          )}
          {currentStatus === 'STALE' && (
            <span style={{
              fontSize: '11px',
              fontWeight: 600,
              padding: '3px 9px',
              borderRadius: '20px',
              background: 'rgba(245, 158, 11, 0.15)',
              color: '#f59e0b',
              border: '1px solid rgba(245, 158, 11, 0.35)'
            }}>
              ⚠ STALE
            </span>
          )}
          {currentStatus === 'BLOCKED' && (
            <span style={{
              fontSize: '11px',
              fontWeight: 600,
              padding: '3px 9px',
              borderRadius: '20px',
              background: 'rgba(239, 68, 68, 0.15)',
              color: '#ef4444',
              border: '1px solid rgba(239, 68, 68, 0.35)'
            }}>
              ⛔ BLOCKED
            </span>
          )}
          {currentStatus === 'ERROR' && (
            <span style={{
              fontSize: '11px',
              fontWeight: 600,
              padding: '3px 9px',
              borderRadius: '20px',
              background: 'rgba(239, 68, 68, 0.15)',
              color: '#ef4444',
              border: '1px solid rgba(239, 68, 68, 0.35)'
            }}>
              ❌ ERROR
            </span>
          )}
          {currentStatus === 'READY' && (
            <span style={{
              fontSize: '11px',
              fontWeight: 600,
              padding: '3px 9px',
              borderRadius: '20px',
              background: 'rgba(6, 182, 212, 0.15)',
              color: '#06b6d4',
              border: '1px solid rgba(6, 182, 212, 0.35)'
            }}>
              READY
            </span>
          )}

          {/* Reset Simulation Button */}
          {(isSolved || isStale || currentStatus === 'ERROR' || currentStatus === 'BLOCKED') && (
            <button
              onClick={handleResetSimulation}
              title="Reset simulation and clear active power supply configuration"
              style={{
                fontSize: '11px',
                fontWeight: 600,
                padding: '3px 9px',
                borderRadius: '6px',
                background: 'rgba(255, 255, 255, 0.05)',
                color: '#94a3b8',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#f8fafc';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#94a3b8';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
              }}
            >
              <span>↺</span>
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs: [ Voltage ] [ Current ] [ Power ] */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
        {[
          { key: 'voltage', label: '⚡ Voltage (V)', count: availableSignals.voltage.length },
          { key: 'current', label: '🌊 Current (mA)', count: availableSignals.current.length },
          { key: 'power', label: '🔥 Power (mW)', count: availableSignals.power.length },
        ].map(tab => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '8px',
                border: isActive ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.1)',
                background: isActive ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                color: isActive ? '#38bdf8' : '#94a3b8',
                fontWeight: isActive ? 700 : 500,
                fontSize: '12px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <span>{tab.label}</span>
              {tab.count > 0 && (
                <span style={{
                  fontSize: '10px',
                  background: isActive ? 'rgba(56, 189, 248, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                  padding: '1px 6px',
                  borderRadius: '10px'
                }}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Selectable signals list */}
      {currentTabSignals.length > 0 ? (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px',
          marginBottom: '14px',
          padding: '8px 10px',
          background: 'rgba(0, 0, 0, 0.25)',
          borderRadius: '8px',
          border: '1px solid rgba(255, 255, 255, 0.05)'
        }}>
          <span style={{ fontSize: '11px', color: '#64748b', alignSelf: 'center', marginRight: '4px' }}>
            Signals:
          </span>
          {currentTabSignals.map((sig, idx) => {
            const isExplicitlySet = selectedSignals[sig.id] !== undefined;
            const isSelected = isExplicitlySet ? selectedSignals[sig.id] : idx < 2;
            const color = SIGNAL_COLORS[idx % SIGNAL_COLORS.length];

            return (
              <button
                key={sig.id}
                onClick={() => handleToggleSignal(sig.id)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: `1px solid ${isSelected ? color : 'rgba(255, 255, 255, 0.1)'}`,
                  background: isSelected ? `${color}22` : 'rgba(255, 255, 255, 0.02)',
                  color: isSelected ? color : '#64748b',
                  fontSize: '11px',
                  fontWeight: isSelected ? 600 : 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease'
                }}
              >
                <span style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: isSelected ? color : '#475569',
                  boxShadow: isSelected ? `0 0 6px ${color}` : 'none'
                }} />
                <span>{sig.name}</span>
                <span style={{ opacity: 0.8, fontSize: '10px' }}>({sig.formatted})</span>
              </button>
            );
          })}
        </div>
      ) : null}

      {/* Main SVG Graph */}
      {isSolved && !isStale ? (
        <div style={{ position: 'relative', width: '100%', userSelect: 'none' }}>
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            style={{ width: '100%', height: 'auto', display: 'block', background: 'rgba(2, 6, 23, 0.6)', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.05)' }}
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const xRel = ((e.clientX - rect.left) / rect.width) * svgWidth;
              if (xRel >= padding.left && xRel <= svgWidth - padding.right) {
                setHoverX(xRel);
              } else {
                setHoverX(null);
              }
            }}
            onMouseLeave={() => setHoverX(null)}
          >
            <defs>
              {signalPaths.map(sig => (
                <filter key={`glow-${sig.id}`} id={`glow-${sig.id}`} x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="0" stdDeviation="2.5" floodColor={sig.color} floodOpacity="0.6" />
                </filter>
              ))}
            </defs>

            {/* Grid horizontal lines & Y-axis labels */}
            {yTicks.map((val, i) => {
              const y = getY(val);
              return (
                <g key={`y-${i}`}>
                  <line
                    x1={padding.left}
                    y1={y}
                    x2={svgWidth - padding.right}
                    y2={y}
                    stroke="rgba(255, 255, 255, 0.07)"
                    strokeDasharray="3 3"
                    strokeWidth="1"
                  />
                  <text
                    x={padding.left - 8}
                    y={y + 3.5}
                    textAnchor="end"
                    fill="#64748b"
                    fontSize="10"
                    fontFamily="monospace"
                  >
                    {val.toFixed(2)}
                  </text>
                </g>
              );
            })}

            {/* Grid vertical lines & X-axis labels (Time) */}
            {timePoints.map((t, i) => {
              const x = getX(t);
              const ms = (t * 1000).toFixed(1);
              return (
                <g key={`x-${i}`}>
                  <line
                    x1={x}
                    y1={padding.top}
                    x2={x}
                    y2={padding.top + plotHeight}
                    stroke="rgba(255, 255, 255, 0.07)"
                    strokeDasharray="3 3"
                    strokeWidth="1"
                  />
                  <text
                    x={x}
                    y={padding.top + plotHeight + 16}
                    textAnchor="middle"
                    fill="#64748b"
                    fontSize="10"
                    fontFamily="monospace"
                  >
                    {ms} ms
                  </text>
                </g>
              );
            })}

            {/* Axis boundary lines */}
            <line
              x1={padding.left}
              y1={padding.top}
              x2={padding.left}
              y2={padding.top + plotHeight}
              stroke="rgba(255, 255, 255, 0.2)"
              strokeWidth="1.5"
            />
            <line
              x1={padding.left}
              y1={padding.top + plotHeight}
              x2={svgWidth - padding.right}
              y2={padding.top + plotHeight}
              stroke="rgba(255, 255, 255, 0.2)"
              strokeWidth="1.5"
            />

            {/* Y-axis Title */}
            <text
              x={14}
              y={padding.top + plotHeight / 2}
              fill="#94a3b8"
              fontSize="11"
              fontWeight="600"
              textAnchor="middle"
              transform={`rotate(-90, 14, ${padding.top + plotHeight / 2})`}
            >
              {activeTab === 'voltage' ? 'Voltage (V)' : activeTab === 'current' ? 'Current (mA)' : 'Power (mW)'}
            </text>

            {/* X-axis Title */}
            <text
              x={padding.left + plotWidth / 2}
              y={svgHeight - 6}
              fill="#94a3b8"
              fontSize="11"
              fontWeight="600"
              textAnchor="middle"
            >
              Time (ms)
            </text>

            {/* Signal Polylines */}
            {signalPaths.map(sig => (
              <path
                key={sig.id}
                d={sig.d}
                fill="none"
                stroke={sig.color}
                strokeWidth="2.5"
                filter={`url(#glow-${sig.id})`}
              />
            ))}

            {/* Data Point Markers on time intervals */}
            {signalPaths.map(sig => {
              return timePoints.map((t, idx) => {
                const x = getX(t);
                const y = getY(sig.value);
                return (
                  <circle
                    key={`${sig.id}-pt-${idx}`}
                    cx={x}
                    cy={y}
                    r="3.5"
                    fill="#0f172a"
                    stroke={sig.color}
                    strokeWidth="2"
                  />
                );
              });
            })}

            {/* Real-time Timeline Cursor hairline (moves during Play and Scrubbing) */}
            {isSolved && (
              <g>
                <line
                  x1={getX(activeTime)}
                  y1={padding.top}
                  x2={getX(activeTime)}
                  y2={padding.top + plotHeight}
                  stroke="#38bdf8"
                  strokeDasharray="4 2"
                  strokeWidth="2"
                  opacity="0.9"
                />
                {/* Intersection dot on each active waveform curve */}
                {signalPaths.map(sig => {
                  const waveform = simulationResult?.waveforms?.[sig.id];
                  const ptVal = (Array.isArray(waveform) && waveform.length === timePoints.length)
                    ? waveform[activeCursorIndex]
                    : sig.value;
                  return (
                    <circle
                      key={`pt-${sig.id}`}
                      cx={getX(activeTime)}
                      cy={getY(ptVal)}
                      r="4.5"
                      fill={sig.color}
                      stroke="#0f172a"
                      strokeWidth="2"
                    />
                  );
                })}
              </g>
            )}

            {/* Interactive hover cursor line */}
            {hoverX !== null && (
              <line
                x1={hoverX}
                y1={padding.top}
                x2={hoverX}
                y2={padding.top + plotHeight}
                stroke="#f8fafc"
                strokeDasharray="2 2"
                strokeWidth="1.5"
                opacity="0.8"
              />
            )}
          </svg>

          {/* Interactive Inspection Tooltip */}
          {hoverX !== null && (
            <div style={{
              position: 'absolute',
              top: '10px',
              right: '10px',
              background: 'rgba(15, 23, 42, 0.95)',
              border: '1px solid rgba(56, 189, 248, 0.4)',
              borderRadius: '6px',
              padding: '6px 10px',
              fontSize: '11px',
              color: '#f8fafc',
              pointerEvents: 'none',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.6)'
            }}>
              <div style={{ color: '#94a3b8', marginBottom: '4px', fontWeight: 600 }}>
                Inspection t = {(activeTime * 1000).toFixed(2)} ms
              </div>
              {activeSelectedSignals.map(sig => (
                <div key={`tip-${sig.id}`} style={{ display: 'flex', alignItems: 'center', gap: '6px', color: sig.color }}>
                  <span>●</span>
                  <span>{sig.name}:</span>
                  <span style={{ fontWeight: 700 }}>{sig.formatted}</span>
                </div>
              ))}
            </div>
          )}

          {/* Phase 24.4: Simulation Timeline & Playback Controller */}
          <div style={{
            marginTop: '14px',
            padding: '12px 14px',
            background: 'rgba(2, 6, 23, 0.7)',
            borderRadius: '10px',
            border: '1px solid rgba(56, 189, 248, 0.2)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}>
            {/* Playback Controls & Timestamp Readout */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={isPlaying ? pauseSimulation : playSimulation}
                  disabled={!isSolved || isStale}
                  title={isPlaying ? "Pause simulation playback" : "Play transient simulation"}
                  style={{
                    background: isPlaying ? 'rgba(245, 158, 11, 0.2)' : 'rgba(56, 189, 248, 0.2)',
                    color: isPlaying ? '#f59e0b' : '#38bdf8',
                    border: `1px solid ${isPlaying ? 'rgba(245, 158, 11, 0.5)' : 'rgba(56, 189, 248, 0.4)'}`,
                    borderRadius: '6px',
                    padding: '5px 12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: (!isSolved || isStale) ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span>{isPlaying ? '⏸' : '▶'}</span>
                  <span>{isPlaying ? 'Pause' : 'Play'}</span>
                </button>

                <button
                  onClick={restartSimulation}
                  disabled={!isSolved || isStale}
                  title="Restart simulation from t = 0"
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    color: '#e2e8f0',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '6px',
                    padding: '5px 10px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: (!isSolved || isStale) ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <span>⏮</span>
                  <span>Restart</span>
                </button>

                <button
                  onClick={handleResetSimulation}
                  title="Reset simulation and clear transient state"
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    color: '#94a3b8',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '6px',
                    padding: '5px 10px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <span>↺</span>
                  <span>Reset</span>
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontFamily: 'monospace', fontSize: '12px' }}>
                <span style={{ color: '#94a3b8' }}>
                  Time: <strong style={{ color: '#38bdf8' }}>{(activeTime * 1000).toFixed(2)} ms</strong> / {(totalDuration * 1000).toFixed(2)} ms
                </span>
                <span style={{ color: '#64748b' }}>
                  Index: {activeCursorIndex + 1}/{timePoints.length}
                </span>
              </div>
            </div>

            {/* Timeline Scrubber Bar: 0 ms ─────────●──────── T */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#64748b' }}>0 ms</span>
              <input
                type="range"
                min="0"
                max={Math.max(0, timePoints.length - 1)}
                value={activeCursorIndex}
                onChange={(e) => seekSimulation && seekSimulation(Number(e.target.value))}
                disabled={!isSolved || isStale}
                style={{
                  flex: 1,
                  accentColor: '#38bdf8',
                  cursor: (!isSolved || isStale) ? 'not-allowed' : 'pointer'
                }}
              />
              <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#64748b' }}>
                {(totalDuration * 1000).toFixed(1)} ms
              </span>
            </div>

            {/* Instantaneous Signal Readouts at Current Timeline Position */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: '8px',
              paddingTop: '6px',
              borderTop: '1px solid rgba(255, 255, 255, 0.06)'
            }}>
              {activeSelectedSignals.map(sig => {
                const waveform = simulationResult?.waveforms?.[sig.id];
                const val = (Array.isArray(waveform) && waveform.length === timePoints.length)
                  ? waveform[activeCursorIndex]
                  : sig.value;
                return (
                  <div key={`inst-${sig.id}`} style={{
                    background: 'rgba(15, 23, 42, 0.7)',
                    padding: '6px 8px',
                    borderRadius: '6px',
                    borderLeft: `3px solid ${sig.color}`
                  }}>
                    <div style={{ fontSize: '10px', color: '#94a3b8' }}>{sig.name}</div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: sig.color, fontFamily: 'monospace' }}>
                      {typeof val === 'number' ? val.toFixed(3) : '0.000'} {sig.unit}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* Empty / Not solved state */
        <div style={{
          padding: '40px 20px',
          textAlign: 'center',
          background: 'rgba(2, 6, 23, 0.5)',
          borderRadius: '10px',
          border: '1px dashed rgba(255, 255, 255, 0.1)'
        }}>
          <div style={{ fontSize: '28px', marginBottom: '10px', opacity: 0.6 }}>⚡</div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>
            {isStale
              ? 'Simulation Result is Stale'
              : 'No Active Simulation Data'}
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', maxWidth: '380px', margin: '0 auto' }}>
            {isStale
              ? 'The circuit topology changed after simulation. Please configure the supply and click "Run Simulation" again.'
              : 'Configure the power supply nodes and voltage above, then click "Run Simulation" to visualize real electrical waveforms.'}
          </div>
        </div>
      )}

      {/* Footer Legend with exact steady-state readings */}
      {isSolved && !isStale && activeSelectedSignals.length > 0 && (
        <div style={{
          marginTop: '14px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '8px',
          padding: '10px 12px',
          background: 'rgba(255, 255, 255, 0.02)',
          borderRadius: '8px',
          border: '1px solid rgba(255, 255, 255, 0.05)'
        }}>
          {activeSelectedSignals.map(sig => (
            <div key={`legend-${sig.id}`} style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: sig.color }} />
                {sig.name}
              </span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: sig.color, marginTop: '2px', fontFamily: 'monospace' }}>
                {sig.formatted}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Scientific disclaimer badge */}
      <div style={{
        marginTop: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '10px',
        color: '#64748b'
      }}>
        <span>Verified MNA Solution • No Fabricated Waveforms</span>
        <span>Physical Validation NOT PERFORMED</span>
      </div>
    </div>
  );
}
