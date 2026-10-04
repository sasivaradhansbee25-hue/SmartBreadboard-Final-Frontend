import React from 'react';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Sparkles,
  X,
  Layers,
  Cpu
} from 'lucide-react';
import { formatVoltage } from '../utils/electricalFormatter';

/**
 * NodeExplorer (Phase 22.3)
 *
 * Interactive electrical equipotential node inspector.
 * Displays all verified terminal pins, bridging wires, connected components,
 * and node voltage levels from MNA.
 *
 * Read-only interface — never modifies circuit context.
 */
export default function NodeExplorer({
  nodeId,
  visualGroundingState = null,
  onSelectComponent = null,
  onHighlightNode = null,
  onAskAI = null,
  onClose = null,
  isMobile = false
}) {
  if (!nodeId || !visualGroundingState) return null;

  const rawNodes = Array.isArray(visualGroundingState.nodes) ? visualGroundingState.nodes : [];
  const rawComps = Array.isArray(visualGroundingState.components) ? visualGroundingState.components : [];
  const rawWires = Array.isArray(visualGroundingState.wires) ? visualGroundingState.wires : [];
  const simState = visualGroundingState.simulation || {};
  const isSimSolved = (simState.status === 'SOLVED' && !visualGroundingState.is_stale);
  const simVoltages = isSimSolved ? (simState.voltages || {}) : {};

  const nodeMatch = rawNodes.find(n => n.id === nodeId) || { id: nodeId, status: 'VERIFIED' };

  // Find connected terminals
  const connectedTerminals = [];
  const connectedCompIds = new Set();
  const nodeHoles = new Set(nodeMatch.holes || []);

  rawComps.forEach(c => {
    ['terminal_a', 'terminal_b'].forEach(tk => {
      const t = c.terminals?.[tk];
      if (t && (t.electrical_node === nodeId || t.node === nodeId)) {
        connectedTerminals.push({
          componentId: c.id,
          terminalKey: tk,
          name: tk === 'terminal_a' ? 'A' : 'B',
          hole: t.hole || 'Unmapped'
        });
        connectedCompIds.add(c.id);
        if (t.hole && t.hole !== 'UNKNOWN' && t.hole !== 'AMBIGUOUS') {
          nodeHoles.add(t.hole);
        }
      }
    });
  });

  // Find connected wires
  const connectedWires = [];
  rawWires.forEach(w => {
    if (w.start_hole && nodeHoles.has(w.start_hole) || w.end_hole && nodeHoles.has(w.end_hole)) {
      connectedWires.push(w.id);
    }
  });

  const nodeVoltage = isSimSolved ? (simVoltages[nodeId] ?? nodeMatch.voltage_v ?? null) : null;

  return (
    <div
      style={{
        background: 'rgba(15, 23, 42, 0.98)',
        border: '1.5px solid #c084fc',
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
          <div style={{ background: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)', padding: '0.35rem', borderRadius: '6px' }}>
            <Activity size={16} color="#ffffff" />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#c084fc' }}>{nodeId}</div>
            <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Electrical Equipotential Node</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{
            fontSize: '0.65rem',
            fontWeight: 700,
            color: '#34d399',
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid #059669',
            padding: '2px 6px',
            borderRadius: '4px'
          }}>
            ✓ {nodeMatch.status || 'VERIFIED'}
          </span>

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

      {/* Voltage Section */}
      <div style={{ marginBottom: '0.85rem', background: 'rgba(30, 41, 59, 0.6)', border: '1px solid #1e293b', borderRadius: '8px', padding: '0.55rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#38bdf8', fontSize: '0.75rem', fontWeight: 600 }}>
          <Zap size={14} />
          <span>Node Voltage:</span>
        </div>
        <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.82rem', color: nodeVoltage !== null ? '#34d399' : '#94a3b8' }}>
          {nodeVoltage !== null ? formatVoltage(nodeVoltage) : 'Not simulated'}
        </div>
      </div>

      {/* Connected Terminals */}
      <div style={{ marginBottom: '0.85rem' }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Connected Terminals ({connectedTerminals.length})
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          {connectedTerminals.map((t, idx) => (
            <div
              key={idx}
              onClick={() => onSelectComponent && onSelectComponent(t.componentId)}
              style={{
                background: 'rgba(15, 23, 42, 0.85)',
                border: '1px solid #334155',
                borderRadius: '6px',
                padding: '0.4rem 0.6rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '0.74rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = '#c084fc'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = '#334155'}
            >
              <div style={{ color: '#f8fafc', fontWeight: 600 }}>
                {t.componentId}.{t.name}
              </div>
              <div style={{ color: '#38bdf8', fontFamily: 'monospace' }}>
                → {t.hole}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Connected Wires & Components */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', marginBottom: '0.85rem' }}>
        <div style={{ background: 'rgba(15, 23, 42, 0.85)', padding: '0.45rem', borderRadius: '6px', border: '1px solid #334155' }}>
          <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginBottom: '2px' }}>Wires</div>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#818cf8' }}>
            {connectedWires.length > 0 ? connectedWires.join(', ') : 'None'}
          </div>
        </div>

        <div style={{ background: 'rgba(15, 23, 42, 0.85)', padding: '0.45rem', borderRadius: '6px', border: '1px solid #334155' }}>
          <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginBottom: '2px' }}>Components</div>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#38bdf8' }}>
            {Array.from(connectedCompIds).join(', ') || 'None'}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {onHighlightNode && (
          <button
            onClick={() => onHighlightNode(nodeId)}
            style={{
              background: '#7c3aed',
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
              gap: '0.4rem'
            }}
          >
            <Activity size={14} />
            <span>Highlight Node in AR</span>
          </button>
        )}

        {onAskAI && (
          <button
            onClick={() => onAskAI(nodeId, 'node')}
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
              gap: '0.4rem'
            }}
          >
            <Sparkles size={14} />
            <span>Ask AI about this node</span>
          </button>
        )}
      </div>
    </div>
  );
}
