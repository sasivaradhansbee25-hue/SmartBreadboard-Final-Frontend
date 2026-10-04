import React from 'react';
import {
  Layers,
  ArrowRight,
  Activity,
  Cpu,
  Zap,
  Sparkles,
  X
} from 'lucide-react';

/**
 * ConnectionExplorer (Phase 22.3)
 *
 * Deterministic connection and relationship visualizer.
 * Renders verified electrical path chains between components, nodes, and jumper wires.
 *
 * Read-only interface — never modifies circuit context.
 */
export default function ConnectionExplorer({
  componentId,
  visualGroundingState = null,
  onSelectComponent = null,
  onSelectNode = null,
  onClose = null,
  isMobile = false
}) {
  if (!componentId || !visualGroundingState) return null;

  const rawComps = Array.isArray(visualGroundingState.components) ? visualGroundingState.components : [];
  const rawWires = Array.isArray(visualGroundingState.wires) ? visualGroundingState.wires : [];
  const currentComp = rawComps.find(c => c.id === componentId);
  if (!currentComp) return null;

  const tA = currentComp.terminals?.terminal_a || {};
  const tB = currentComp.terminals?.terminal_b || {};

  // Build connected paths for both terminals
  const getConnectionsForTerminal = (tKey, tData) => {
    const tNode = tData.electrical_node;
    if (!tNode) return [];

    const connections = [];
    rawComps.forEach(otherComp => {
      if (otherComp.id === componentId) return;
      ['terminal_a', 'terminal_b'].forEach(otherTk => {
        const otherT = otherComp.terminals?.[otherTk];
        if (otherT && otherT.electrical_node === tNode) {
          connections.push({
            type: 'DIRECT_NODE',
            fromComp: componentId,
            fromTerminal: tKey === 'terminal_a' ? 'A' : 'B',
            fromHole: tData.hole,
            node: tNode,
            toComp: otherComp.id,
            toTerminal: otherTk === 'terminal_a' ? 'A' : 'B',
            toHole: otherT.hole
          });
        }
      });
    });

    return connections;
  };

  const connectionsA = getConnectionsForTerminal('terminal_a', tA);
  const connectionsB = getConnectionsForTerminal('terminal_b', tB);
  const allConnections = [...connectionsA, ...connectionsB];

  return (
    <div
      style={{
        background: 'rgba(15, 23, 42, 0.98)',
        border: '1.5px solid #38bdf8',
        borderRadius: isMobile ? '16px 16px 0 0' : '12px',
        padding: '1rem',
        color: '#f8fafc',
        boxShadow: '0 12px 35px rgba(0,0,0,0.85)',
        width: isMobile ? '100%' : '320px',
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
          <div style={{ background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', padding: '0.35rem', borderRadius: '6px' }}>
            <Layers size={16} color="#ffffff" />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#38bdf8' }}>{componentId} Connections</div>
            <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Verified Topology Trace</div>
          </div>
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

      {/* Terminal Connections List */}
      {allConnections.length === 0 ? (
        <div style={{ fontSize: '0.78rem', color: '#94a3b8', padding: '1rem', textAlign: 'center' }}>
          No connected components detected on {componentId} terminals.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {allConnections.map((conn, idx) => (
            <div
              key={idx}
              style={{
                background: 'rgba(30, 41, 59, 0.7)',
                border: '1px solid #334155',
                borderRadius: '8px',
                padding: '0.6rem',
                fontSize: '0.74rem'
              }}
            >
              {/* Path Diagram */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <div
                  onClick={() => onSelectComponent && onSelectComponent(conn.fromComp)}
                  style={{ fontWeight: 700, color: '#38bdf8', cursor: 'pointer' }}
                >
                  {conn.fromComp}.{conn.fromTerminal}
                </div>

                <div
                  onClick={() => onSelectNode && onSelectNode(conn.node)}
                  style={{
                    background: 'rgba(192, 132, 252, 0.15)',
                    color: '#c084fc',
                    border: '1px solid rgba(192, 132, 252, 0.3)',
                    padding: '1px 6px',
                    borderRadius: '4px',
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {conn.node}
                </div>

                <div
                  onClick={() => onSelectComponent && onSelectComponent(conn.toComp)}
                  style={{ fontWeight: 700, color: '#34d399', cursor: 'pointer' }}
                >
                  {conn.toComp}.{conn.toTerminal}
                </div>
              </div>

              {/* Physical Hole Mapping */}
              <div style={{ fontSize: '0.68rem', color: '#94a3b8', display: 'flex', justifyContent: 'space-between' }}>
                <span>Hole: <strong>{conn.fromHole || '—'}</strong></span>
                <span>Hole: <strong>{conn.toHole || '—'}</strong></span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
