import React, { useState, useMemo } from 'react';
import {
  generateVisualAnnotations,
  DEFAULT_VISIBILITY
} from '../services/visualAnnotationService';
import {
  computeHighlightGraph
} from '../services/circuitHighlightService';
import {
  cameraPixelToScreenCoord
} from '../services/arCoordinateTransform';
import ComponentInspector from './ComponentInspector';
import NodeExplorer from './NodeExplorer';
import ConnectionExplorer from './ConnectionExplorer';
import {
  Eye,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  ShieldAlert,
  Zap,
  Layers,
  Cpu,
  X,
  Info,
  ChevronRight,
  Activity
} from 'lucide-react';

/**
 * VisualCircuitAnnotations (Phase 22.2 & 22.3)
 *
 * Deterministic visual overlay and interactive circuit exploration layer.
 * Supports:
 * - Component inspection and provenance display
 * - Interactive clickable terminal pins and node tracking
 * - Equipotential node exploration and MNA voltage measurements
 * - Deterministic connection pathway tracing
 * - Highlighting modes: COMPONENT, TERMINAL, NODE, CONNECTION
 * - Visual state distinction: SELECTED, HIGHLIGHTED, NORMAL
 *
 * READ-ONLY — NEVER modifies CircuitContext.
 */
export default function VisualCircuitAnnotations({
  visualGroundingState,
  displayRect = null,
  containerWidth = 800,
  containerHeight = 520,
  selectedComponentId = null,
  highlightedComponentId = null,
  onSelectComponent = null,
  onAskAI = null,
  currentCircuitSignature = null,
  initialDebugMode = false,
  showControls = true
}) {
  const [debugMode, setDebugMode] = useState(initialDebugMode);
  const [visibility, setVisibility] = useState(DEFAULT_VISIBILITY);
  const [isControlsOpen, setIsControlsOpen] = useState(false);

  // Phase 22.3 Interactive Exploration State (Explicit IDs only per Rule 19)
  const [activeCompId, setActiveCompId] = useState(selectedComponentId);
  const [activeTerminal, setActiveTerminal] = useState(null); // { componentId, terminalKey }
  const [activeNodeId, setActiveNodeId] = useState(null);
  const [activeExplorer, setActiveExplorer] = useState(null); // 'COMPONENT' | 'NODE' | 'CONNECTION' | null
  const [highlightMode, setHighlightMode] = useState('COMPONENT');

  // Toggle layer visibility
  const toggleVisibility = (layer) => {
    setVisibility(prev => ({ ...prev, [layer]: !prev[layer] }));
  };

  const effectiveCompId = activeCompId || selectedComponentId;
  const effectiveHighlightedCompId = highlightedComponentId;

  // Compute deterministic highlight graph (Phase 22.3 Rule 7)
  const highlightGraph = useMemo(() => {
    if (!visualGroundingState) return { components: [], terminals: [], holes: [], wires: [], nodes: [] };

    let targetId = effectiveCompId;
    let termKey = null;

    if (highlightMode === 'NODE' && activeNodeId) {
      targetId = activeNodeId;
    } else if (highlightMode === 'TERMINAL' && activeTerminal) {
      targetId = activeTerminal.componentId;
      termKey = activeTerminal.terminalKey;
    }

    return computeHighlightGraph(visualGroundingState, {
      mode: highlightMode,
      targetId,
      terminalKey: termKey,
      currentCircuitSignature
    });
  }, [
    visualGroundingState,
    highlightMode,
    effectiveCompId,
    activeTerminal,
    activeNodeId,
    currentCircuitSignature
  ]);

  // Generate deterministic visual annotations
  const annotations = useMemo(() => {
    return generateVisualAnnotations(visualGroundingState, {
      debugMode,
      currentCircuitSignature,
      selectedComponentId: effectiveCompId,
      highlightedComponentId: effectiveHighlightedCompId,
      visibility
    });
  }, [
    visualGroundingState,
    debugMode,
    currentCircuitSignature,
    effectiveCompId,
    effectiveHighlightedCompId,
    visibility
  ]);

  // Coordinate helper: maps pixel {x, y} to screen coordinates
  const toScreen = (pos) => {
    if (!pos || typeof pos.x !== 'number' || typeof pos.y !== 'number') return null;
    if (displayRect) {
      return cameraPixelToScreenCoord(pos.x, pos.y, displayRect);
    }
    return { x: pos.x, y: pos.y };
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'VERIFIED':
        return { color: '#34d399', bg: 'rgba(16, 185, 129, 0.15)', border: '#059669', icon: <CheckCircle2 size={12} /> };
      case 'USER_CONFIRMED':
        return { color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.15)', border: '#0284c7', icon: <CheckCircle2 size={12} /> };
      case 'AMBIGUOUS':
        return { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', border: '#d97706', icon: <AlertTriangle size={12} /> };
      case 'BLOCKED':
        return { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', border: '#dc2626', icon: <ShieldAlert size={12} /> };
      case 'UNKNOWN':
      default:
        return { color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.15)', border: '#64748b', icon: <HelpCircle size={12} /> };
    }
  };

  const selectedCompObj = annotations.components.find(c => c.id === effectiveCompId) || null;

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        overflow: 'hidden',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
      }}
    >
      {/* 1. SVG Layer for Wires, Lead Lines, and Terminal Connectors */}
      <svg
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none'
        }}
      >
        <defs>
          <linearGradient id="wireGradientVerified" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#818cf8" />
          </linearGradient>
          <linearGradient id="wireGradientHighlighted" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#00ffff" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
          <filter id="glowVerified" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="glowHighlighted" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Jumper Wires */}
        {visibility.wires && annotations.wires.map((wire) => {
          if (!wire.isResolved || !wire.startPosition || !wire.endPosition) return null;
          const s = toScreen(wire.startPosition);
          const e = toScreen(wire.endPosition);
          if (!s || !e) return null;

          const isWireHighlighted = highlightGraph.wires.includes(wire.id);

          return (
            <g key={`wire_${wire.id}`}>
              <line
                x1={s.x}
                y1={s.y}
                x2={e.x}
                y2={e.y}
                stroke={isWireHighlighted ? "url(#wireGradientHighlighted)" : "url(#wireGradientVerified)"}
                strokeWidth={isWireHighlighted ? "5.5" : "3.5"}
                strokeLinecap="round"
                filter={isWireHighlighted ? "url(#glowHighlighted)" : "url(#glowVerified)"}
              />
              <circle cx={s.x} cy={s.y} r={isWireHighlighted ? 6 : 4} fill={isWireHighlighted ? "#00ffff" : "#38bdf8"} />
              <circle cx={e.x} cy={e.y} r={isWireHighlighted ? 6 : 4} fill={isWireHighlighted ? "#a855f7" : "#818cf8"} />
              <text
                x={(s.x + e.x) / 2}
                y={(s.y + e.y) / 2 - 8}
                fill={isWireHighlighted ? "#00ffff" : "#e0e7ff"}
                fontSize={isWireHighlighted ? "12" : "11"}
                fontWeight="800"
                textAnchor="middle"
                style={{ textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}
              >
                {wire.id}
              </text>
            </g>
          );
        })}

        {/* Lead Connection Lines to Terminal Markers */}
        {visibility.terminals && annotations.components.map((comp) => {
          const compPos = toScreen(comp.position);
          if (!compPos) return null;

          const tA = comp.terminals?.terminal_a?.pixel ? toScreen({ x: comp.terminals.terminal_a.pixel[0], y: comp.terminals.terminal_a.pixel[1] }) : null;
          const tB = comp.terminals?.terminal_b?.pixel ? toScreen({ x: comp.terminals.terminal_b.pixel[0], y: comp.terminals.terminal_b.pixel[1] }) : null;

          const isSelected = (comp.id === effectiveCompId);
          const isHighlighted = highlightGraph.components.includes(comp.id);

          return (
            <g key={`comp_leads_${comp.id}`}>
              {tA && (
                <line
                  x1={compPos.x}
                  y1={compPos.y}
                  x2={tA.x}
                  y2={tA.y}
                  stroke={isSelected ? "#00ffff" : isHighlighted ? "#a855f7" : "rgba(56, 189, 248, 0.5)"}
                  strokeWidth={isSelected ? "2.5" : isHighlighted ? "2.0" : "1.5"}
                  strokeDasharray={isSelected ? "none" : "3,3"}
                />
              )}
              {tB && (
                <line
                  x1={compPos.x}
                  y1={compPos.y}
                  x2={tB.x}
                  y2={tB.y}
                  stroke={isSelected ? "#00ffff" : isHighlighted ? "#a855f7" : "rgba(56, 189, 248, 0.5)"}
                  strokeWidth={isSelected ? "2.5" : isHighlighted ? "2.0" : "1.5"}
                  strokeDasharray={isSelected ? "none" : "3,3"}
                />
              )}
            </g>
          );
        })}
      </svg>

      {/* 2. Interactive Terminal Pin Markers (Phase 22.3 Terminal Explorer) */}
      {visibility.terminals && annotations.terminals.map((term) => {
        const s = toScreen(term.position);
        if (!s) return null;

        const badge = getStatusBadge(term.status);
        const isTermSelected = activeTerminal && activeTerminal.componentId === term.componentId && activeTerminal.terminalKey === term.terminalKey;
        const isTermHighlighted = highlightGraph.terminals.includes(term.id);

        return (
          <div
            key={term.id}
            onClick={(e) => {
              e.stopPropagation();
              setActiveTerminal({ componentId: term.componentId, terminalKey: term.terminalKey });
              setActiveCompId(term.componentId);
              setHighlightMode('TERMINAL');
              setActiveExplorer('COMPONENT');
              if (onSelectComponent) {
                const compMatch = annotations.components.find(c => c.id === term.componentId);
                if (compMatch) onSelectComponent(compMatch);
              }
            }}
            style={{
              position: 'absolute',
              left: `${s.x}px`,
              top: `${s.y}px`,
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'auto',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              zIndex: isTermSelected ? 35 : isTermHighlighted ? 25 : 15,
              transition: 'transform 0.15s ease'
            }}
          >
            <div
              style={{
                width: isTermSelected ? '14px' : isTermHighlighted ? '12px' : '10px',
                height: isTermSelected ? '14px' : isTermHighlighted ? '12px' : '10px',
                borderRadius: '50%',
                background: isTermSelected ? '#00ffff' : isTermHighlighted ? '#c084fc' : badge.color,
                border: '2px solid #ffffff',
                boxShadow: isTermSelected ? '0 0 12px #00ffff' : isTermHighlighted ? '0 0 10px #c084fc' : `0 0 8px ${badge.color}`
              }}
            />
            <div
              style={{
                background: isTermSelected ? 'rgba(8, 24, 48, 0.96)' : 'rgba(15, 23, 42, 0.92)',
                color: isTermSelected ? '#00ffff' : '#f8fafc',
                border: `1px solid ${isTermSelected ? '#00ffff' : isTermHighlighted ? '#c084fc' : badge.border}`,
                borderRadius: '4px',
                padding: '1px 5px',
                fontSize: '0.65rem',
                fontWeight: 700,
                marginTop: '2px',
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                gap: '3px'
              }}
            >
              <span>● {term.name}</span>
              {term.hole && <span style={{ color: '#38bdf8' }}>{term.hole}</span>}
              {visibility.nodes && term.electrical_node && (
                <span
                  onClick={(ev) => {
                    ev.stopPropagation();
                    setActiveNodeId(term.electrical_node);
                    setHighlightMode('NODE');
                    setActiveExplorer('NODE');
                  }}
                  style={{
                    color: '#c084fc',
                    marginLeft: '2px',
                    cursor: 'pointer',
                    textDecoration: 'underline'
                  }}
                  title="Explore Node"
                >
                  {term.electrical_node}
                </span>
              )}
            </div>
          </div>
        );
      })}

      {/* 3. Hole Labels (Visibility Strategy: Relevant in normal, all in debug) */}
      {visibility.holes && annotations.holes.map((hole) => {
        const s = toScreen(hole.position);
        if (!s) return null;

        const isHoleHighlighted = highlightGraph.holes.includes(hole.id);

        return (
          <div
            key={`hole_${hole.id}`}
            style={{
              position: 'absolute',
              left: `${s.x}px`,
              top: `${s.y}px`,
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'none',
              background: isHoleHighlighted ? 'rgba(14, 165, 233, 0.95)' : (hole.isRelevant ? 'rgba(30, 41, 59, 0.95)' : 'rgba(15, 23, 42, 0.75)'),
              color: isHoleHighlighted ? '#ffffff' : (hole.isRelevant ? '#38bdf8' : '#94a3b8'),
              border: `1px solid ${isHoleHighlighted ? '#38bdf8' : (hole.isRelevant ? '#0284c7' : '#334155')}`,
              borderRadius: '3px',
              padding: '1px 3px',
              fontSize: '0.62rem',
              fontWeight: 700,
              zIndex: isHoleHighlighted ? 20 : 10,
              boxShadow: isHoleHighlighted ? '0 0 8px rgba(56, 189, 248, 0.6)' : 'none'
            }}
          >
            {hole.id}
          </div>
        );
      })}

      {/* 4. Component Badges & Electrical Annotations (Phase 22.3 Interaction) */}
      {visibility.components && annotations.components.map((comp) => {
        const s = toScreen(comp.position);
        if (!s) return null;

        const badge = getStatusBadge(comp.status);
        const isSelected = (comp.id === effectiveCompId);
        const isHighlighted = highlightGraph.components.includes(comp.id) || (comp.id === effectiveHighlightedCompId);

        return (
          <div
            key={`badge_${comp.id}`}
            onClick={(e) => {
              e.stopPropagation();
              setActiveCompId(comp.id);
              setActiveTerminal(null);
              setHighlightMode('COMPONENT');
              setActiveExplorer('COMPONENT');
              if (onSelectComponent) onSelectComponent(comp);
            }}
            style={{
              position: 'absolute',
              left: `${s.x}px`,
              top: `${s.y - 35}px`,
              transform: 'translate(-50%, -100%)',
              pointerEvents: 'auto',
              cursor: 'pointer',
              background: isSelected ? 'rgba(10, 24, 48, 0.96)' : isHighlighted ? 'rgba(26, 16, 48, 0.94)' : 'rgba(15, 23, 42, 0.92)',
              border: `1.5px solid ${isSelected ? '#00ffff' : isHighlighted ? '#c084fc' : badge.border}`,
              borderRadius: '8px',
              padding: '0.35rem 0.6rem',
              color: '#f8fafc',
              boxShadow: isSelected ? '0 0 16px rgba(0, 255, 255, 0.6)' : isHighlighted ? '0 0 12px rgba(192, 132, 252, 0.5)' : '0 4px 15px rgba(0,0,0,0.6)',
              minWidth: '100px',
              transition: 'all 0.15s ease',
              zIndex: isSelected ? 30 : isHighlighted ? 25 : 20
            }}
          >
            {/* Header: ID + Status */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.2rem', marginBottom: '0.2rem' }}>
              <div style={{ fontWeight: 800, fontSize: '0.82rem', color: isSelected ? '#00ffff' : isHighlighted ? '#c084fc' : '#f8fafc' }}>
                {comp.label}
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '2px',
                fontSize: '0.62rem',
                fontWeight: 700,
                color: badge.color,
                background: badge.bg,
                padding: '1px 4px',
                borderRadius: '4px'
              }}>
                {badge.icon}
                <span>{comp.status}</span>
              </div>
            </div>

            {/* Sublabel / Value */}
            <div style={{ fontSize: '0.72rem', color: '#cbd5e1', fontWeight: 600 }}>
              {comp.sublabel}
            </div>

            {/* Electrical Simulation Measurements (SOLVED only) */}
            {visibility.electrical && comp.electrical_formatted && (
              <div style={{
                marginTop: '0.3rem',
                paddingTop: '0.25rem',
                borderTop: '1px dashed rgba(56, 189, 248, 0.3)',
                fontSize: '0.68rem',
                color: '#34d399',
                fontWeight: 700,
                fontFamily: 'monospace'
              }}>
                {comp.electrical_formatted.lines.map((line, idx) => (
                  <div key={idx}>{line}</div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* 5. Diagnostic Markers & Alerts */}
      {visibility.diagnostics && annotations.diagnostics.map((diag) => {
        if (!diag.description) return null;
        const s = diag.position ? toScreen(diag.position) : null;

        if (s) {
          return (
            <div
              key={diag.id}
              style={{
                position: 'absolute',
                left: `${s.x + 40}px`,
                top: `${s.y - 20}px`,
                background: 'rgba(239, 68, 68, 0.95)',
                color: '#fff',
                border: '1px solid #fca5a5',
                borderRadius: '6px',
                padding: '0.25rem 0.5rem',
                fontSize: '0.68rem',
                fontWeight: 700,
                boxShadow: '0 2px 10px rgba(0,0,0,0.6)',
                zIndex: 25,
                pointerEvents: 'auto',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <AlertTriangle size={12} />
              <span>{diag.description}</span>
            </div>
          );
        }

        return null;
      })}

      {/* Top Banner for Global Blocked or Stale Grounding Diagnostic */}
      {annotations.diagnostics.some(d => d.issue === 'CIRCUIT_BLOCKED' || d.issue === 'STALE_GROUNDING') && (
        <div
          style={{
            position: 'absolute',
            top: '8px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(239, 68, 68, 0.95)',
            color: '#ffffff',
            border: '1px solid #fca5a5',
            borderRadius: '20px',
            padding: '0.35rem 1rem',
            fontSize: '0.78rem',
            fontWeight: 800,
            boxShadow: '0 4px 15px rgba(0,0,0,0.6)',
            zIndex: 40,
            pointerEvents: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <ShieldAlert size={16} />
          <span>
            {annotations.diagnostics.find(d => d.issue === 'CIRCUIT_BLOCKED' || d.issue === 'STALE_GROUNDING')?.description}
          </span>
        </div>
      )}

      {/* 6. Interactive Explorers & Inspectors (Phase 22.3) */}
      {activeExplorer === 'COMPONENT' && selectedCompObj && (
        <div style={{ position: 'absolute', bottom: '12px', right: '12px', zIndex: 45 }}>
          <ComponentInspector
            component={selectedCompObj}
            visualGroundingState={visualGroundingState}
            onSelectTerminal={(cid, tKey) => {
              setActiveTerminal({ componentId: cid, terminalKey: tKey });
              setHighlightMode('TERMINAL');
            }}
            onShowConnections={(cid) => {
              setActiveExplorer('CONNECTION');
              setHighlightMode('COMPONENT');
            }}
            onAskAI={(cid) => {
              if (onAskAI) onAskAI(cid, 'component');
            }}
            onClose={() => {
              setActiveExplorer(null);
              setActiveCompId(null);
              setActiveTerminal(null);
            }}
          />
        </div>
      )}

      {activeExplorer === 'NODE' && activeNodeId && (
        <div style={{ position: 'absolute', bottom: '12px', right: '12px', zIndex: 45 }}>
          <NodeExplorer
            nodeId={activeNodeId}
            visualGroundingState={visualGroundingState}
            onSelectComponent={(cid) => {
              setActiveCompId(cid);
              setActiveExplorer('COMPONENT');
              setHighlightMode('COMPONENT');
            }}
            onHighlightNode={(nid) => {
              setActiveNodeId(nid);
              setHighlightMode('NODE');
            }}
            onAskAI={(nid) => {
              if (onAskAI) onAskAI(nid, 'node');
            }}
            onClose={() => {
              setActiveExplorer(null);
              setActiveNodeId(null);
            }}
          />
        </div>
      )}

      {activeExplorer === 'CONNECTION' && effectiveCompId && (
        <div style={{ position: 'absolute', bottom: '12px', right: '12px', zIndex: 45 }}>
          <ConnectionExplorer
            componentId={effectiveCompId}
            visualGroundingState={visualGroundingState}
            onSelectComponent={(cid) => {
              setActiveCompId(cid);
              setActiveExplorer('COMPONENT');
            }}
            onSelectNode={(nid) => {
              setActiveNodeId(nid);
              setActiveExplorer('NODE');
              setHighlightMode('NODE');
            }}
            onClose={() => {
              setActiveExplorer('COMPONENT');
            }}
          />
        </div>
      )}

      {/* 7. Compact Annotation Control Panel */}
      {showControls && (
        <div
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            zIndex: 50,
            pointerEvents: 'auto'
          }}
        >
          {/* Toggle Button */}
          <button
            onClick={() => setIsControlsOpen(!isControlsOpen)}
            style={{
              background: 'rgba(15, 23, 42, 0.9)',
              border: '1px solid #334155',
              borderRadius: '8px',
              padding: '0.35rem 0.65rem',
              color: '#38bdf8',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
            }}
          >
            <Sliders size={13} />
            <span>Overlay ({debugMode ? 'DEBUG' : 'NORMAL'})</span>
          </button>

          {/* Expanded Controls Drawer */}
          {isControlsOpen && (
            <div
              style={{
                position: 'absolute',
                top: '36px',
                right: 0,
                background: 'rgba(15, 23, 42, 0.97)',
                border: '1px solid #334155',
                borderRadius: '10px',
                padding: '0.75rem',
                color: '#f8fafc',
                width: '200px',
                boxShadow: '0 8px 30px rgba(0,0,0,0.8)'
              }}
            >
              {/* Header & Mode Switcher */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem', borderBottom: '1px solid #334155', paddingBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8' }}>ANNOTATIONS</span>
                <button
                  onClick={() => setDebugMode(!debugMode)}
                  style={{
                    background: debugMode ? '#7c3aed' : '#334155',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '2px 6px',
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {debugMode ? 'DEBUG' : 'NORMAL'}
                </button>
              </div>

              {/* Layer Toggles */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.72rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={visibility.components}
                    onChange={() => toggleVisibility('components')}
                  />
                  <span>Components</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={visibility.terminals}
                    onChange={() => toggleVisibility('terminals')}
                  />
                  <span>Terminals</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={visibility.holes}
                    onChange={() => toggleVisibility('holes')}
                  />
                  <span>Hole IDs</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={visibility.nodes}
                    onChange={() => toggleVisibility('nodes')}
                  />
                  <span>Nodes</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={visibility.wires}
                    onChange={() => toggleVisibility('wires')}
                  />
                  <span>Wires</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={visibility.diagnostics}
                    onChange={() => toggleVisibility('diagnostics')}
                  />
                  <span>Diagnostics</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={visibility.electrical}
                    onChange={() => toggleVisibility('electrical')}
                  />
                  <span>Electrical Values</span>
                </label>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
