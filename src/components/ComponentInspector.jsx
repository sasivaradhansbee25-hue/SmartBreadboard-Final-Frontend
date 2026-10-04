import React, { useState } from 'react';
import {
  Cpu,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  ShieldAlert,
  Zap,
  Activity,
  Layers,
  ArrowRight,
  MessageSquare,
  Sparkles,
  X,
  ExternalLink
} from 'lucide-react';
import { formatVoltage, formatCurrent, formatPower } from '../utils/electricalFormatter';

/**
 * ComponentInspector (Phase 22.3)
 *
 * Interactive component inspector providing verified component metadata,
 * terminal pin tracing, node exploration, provenance display, and MNA simulation telemetry.
 *
 * Read-only interface — never modifies circuit context.
 */
export default function ComponentInspector({
  component,
  visualGroundingState = null,
  onSelectTerminal = null,
  onShowConnections = null,
  onAskAI = null,
  onClose = null,
  isMobile = false
}) {
  if (!component) return null;

  const cid = component.id || component.designator || 'UNKNOWN';
  const ctype = (component.componentType || component.type || 'Component').toUpperCase();
  const cval = component.sublabel || component.display_value || (component.value ? `${component.value} ${component.unit || 'Ω'}` : 'Unknown');
  const status = component.status || 'UNKNOWN';
  const source = component.source || 'ai';

  const tA = component.terminals?.terminal_a || {};
  const tB = component.terminals?.terminal_b || {};

  const sim = component.electrical || null;
  const isStale = visualGroundingState?.is_stale || false;
  const simStatus = visualGroundingState?.simulation?.status || 'NOT_RUN';

  const getStatusBadge = (s) => {
    switch (s) {
      case 'VERIFIED':
        return { color: '#34d399', bg: 'rgba(16, 185, 129, 0.15)', border: '#059669', icon: <CheckCircle2 size={13} />, label: '✓ VERIFIED' };
      case 'USER_CONFIRMED':
        return { color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.15)', border: '#0284c7', icon: <CheckCircle2 size={13} />, label: '● USER CONFIRMED' };
      case 'AMBIGUOUS':
        return { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', border: '#d97706', icon: <AlertTriangle size={13} />, label: '⚠ AMBIGUOUS' };
      case 'BLOCKED':
        return { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', border: '#dc2626', icon: <ShieldAlert size={13} />, label: '⛔ BLOCKED' };
      case 'UNKNOWN':
      default:
        return { color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.15)', border: '#64748b', icon: <HelpCircle size={13} />, label: '? UNKNOWN' };
    }
  };

  const badge = getStatusBadge(status);

  return (
    <div
      style={{
        background: 'rgba(15, 23, 42, 0.98)',
        border: '1.5px solid #38bdf8',
        borderRadius: isMobile ? '16px 16px 0 0' : '12px',
        padding: '1rem',
        color: '#f8fafc',
        boxShadow: '0 12px 35px rgba(0,0,0,0.85)',
        width: isMobile ? '100%' : '310px',
        maxHeight: isMobile ? '70vh' : '560px',
        overflowY: 'auto',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        zIndex: 50,
        pointerEvents: 'auto'
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', paddingBottom: '0.6rem', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <div style={{ background: 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)', padding: '0.35rem', borderRadius: '6px' }}>
            <Cpu size={16} color="#ffffff" />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#38bdf8' }}>{cid}</div>
            <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>{ctype}</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
            fontSize: '0.65rem',
            fontWeight: 700,
            color: badge.color,
            background: badge.bg,
            border: `1px solid ${badge.border}`,
            padding: '2px 6px',
            borderRadius: '4px'
          }}>
            {badge.icon}
            <span>{badge.label}</span>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0.2rem' }}
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Component Details */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', fontSize: '0.78rem', marginBottom: '0.85rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(30, 41, 59, 0.5)', padding: '0.35rem 0.6rem', borderRadius: '6px' }}>
          <span style={{ color: '#94a3b8' }}>Value:</span>
          <strong style={{ color: '#f8fafc' }}>{cval}</strong>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(30, 41, 59, 0.5)', padding: '0.35rem 0.6rem', borderRadius: '6px' }}>
          <span style={{ color: '#94a3b8' }}>Provenance / Source:</span>
          <span style={{ color: '#cbd5e1', fontWeight: 600 }}>{source.toUpperCase()}</span>
        </div>
      </div>

      {/* Terminals Section (Clickable) */}
      <div style={{ marginBottom: '0.85rem' }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Verified Terminals
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
          {/* Terminal A */}
          <div
            onClick={() => onSelectTerminal && onSelectTerminal(cid, 'terminal_a', tA)}
            style={{
              background: 'rgba(15, 23, 42, 0.85)',
              border: '1px solid #334155',
              borderRadius: '8px',
              padding: '0.5rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = '#38bdf8'}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = '#334155'}
          >
            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#38bdf8', marginBottom: '0.2rem' }}>● Terminal A</div>
            <div style={{ fontSize: '0.72rem', color: '#f8fafc' }}>Hole: <strong>{tA.hole || 'Unmapped'}</strong></div>
            <div style={{ fontSize: '0.65rem', color: '#c084fc', marginTop: '2px' }}>Node: {tA.electrical_node || 'None'}</div>
          </div>

          {/* Terminal B */}
          <div
            onClick={() => onSelectTerminal && onSelectTerminal(cid, 'terminal_b', tB)}
            style={{
              background: 'rgba(15, 23, 42, 0.85)',
              border: '1px solid #334155',
              borderRadius: '8px',
              padding: '0.5rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = '#38bdf8'}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = '#334155'}
          >
            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#38bdf8', marginBottom: '0.2rem' }}>● Terminal B</div>
            <div style={{ fontSize: '0.72rem', color: '#f8fafc' }}>Hole: <strong>{tB.hole || 'Unmapped'}</strong></div>
            <div style={{ fontSize: '0.65rem', color: '#c084fc', marginTop: '2px' }}>Node: {tB.electrical_node || 'None'}</div>
          </div>
        </div>
      </div>

      {/* Simulation Telemetry (Section 2 & 12) */}
      <div style={{ marginBottom: '0.85rem', background: 'rgba(15, 23, 42, 0.9)', border: '1px solid #1e293b', borderRadius: '8px', padding: '0.6rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.72rem', fontWeight: 700, color: '#34d399', marginBottom: '0.35rem' }}>
          <Zap size={13} />
          <span>MNA Simulation Telemetry</span>
        </div>

        {isStale ? (
          <div style={{ fontSize: '0.72rem', color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)', padding: '0.35rem', borderRadius: '4px', border: '1px solid #f59e0b' }}>
            Stale — simulate the updated circuit.
          </div>
        ) : simStatus !== 'SOLVED' || !sim ? (
          <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
            Not available — circuit has not been simulated.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.3rem', fontSize: '0.72rem', fontFamily: 'monospace' }}>
            <div style={{ background: '#090d16', padding: '0.3rem', borderRadius: '4px', textAlign: 'center' }}>
              <div style={{ color: '#64748b', fontSize: '0.6rem' }}>Voltage</div>
              <div style={{ color: '#38bdf8', fontWeight: 700 }}>{sim.voltage !== undefined ? formatVoltage(sim.voltage) : '—'}</div>
            </div>
            <div style={{ background: '#090d16', padding: '0.3rem', borderRadius: '4px', textAlign: 'center' }}>
              <div style={{ color: '#64748b', fontSize: '0.6rem' }}>Current</div>
              <div style={{ color: '#34d399', fontWeight: 700 }}>{sim.current !== undefined ? formatCurrent(sim.current) : '—'}</div>
            </div>
            <div style={{ background: '#090d16', padding: '0.3rem', borderRadius: '4px', textAlign: 'center' }}>
              <div style={{ color: '#64748b', fontSize: '0.6rem' }}>Power</div>
              <div style={{ color: '#f43f5e', fontWeight: 700 }}>{sim.power !== undefined ? formatPower(sim.power) : '—'}</div>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {onShowConnections && (
          <button
            onClick={() => onShowConnections(cid)}
            style={{
              background: '#0284c7',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              padding: '0.45rem',
              fontSize: '0.76rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              transition: 'background 0.15s ease'
            }}
          >
            <Layers size={14} />
            <span>Show Connections</span>
          </button>
        )}

        {onAskAI && (
          <button
            onClick={() => onAskAI(cid)}
            style={{
              background: 'rgba(124, 58, 237, 0.25)',
              color: '#c084fc',
              border: '1px solid #7c3aed',
              borderRadius: '6px',
              padding: '0.45rem',
              fontSize: '0.76rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              transition: 'all 0.15s ease'
            }}
          >
            <Sparkles size={14} />
            <span>Ask AI about this component</span>
          </button>
        )}
      </div>
    </div>
  );
}
