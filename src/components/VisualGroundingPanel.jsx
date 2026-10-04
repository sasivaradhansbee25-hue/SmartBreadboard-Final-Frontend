import React, { useState } from 'react';
import { Eye, Layers, Activity, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Cpu, Sparkles, Shield, X } from 'lucide-react';

export default function VisualGroundingPanel({ visualGrounding, onClose }) {
  const [expandedSections, setExpandedSections] = useState({
    components: true,
    connections: false,
    nodes: false,
    diagnostics: true,
    simulation: false,
    ar: false
  });

  const toggleSection = (sec) => {
    setExpandedSections(prev => ({ ...prev, [sec]: !prev[sec] }));
  };

  if (!visualGrounding) {
    return (
      <div style={{
        background: '#090d16',
        border: '1px solid #1e293b',
        borderRadius: '10px',
        padding: '1rem',
        color: '#94a3b8',
        fontSize: '0.78rem'
      }}>
        No visual grounding telemetry available.
      </div>
    );
  }

  const status = visualGrounding.overall_status || 'UNKNOWN';
  const summary = visualGrounding.summary || {};
  const components = visualGrounding.components || [];
  const connections = visualGrounding.connections || [];
  const nodes = visualGrounding.nodes || [];
  const diagnostics = visualGrounding.diagnostics || [];
  const rejected = visualGrounding.rejected_detections || [];
  const simulation = visualGrounding.simulation || {};
  const ar = visualGrounding.ar || {};
  const humanDesc = visualGrounding.human_description || '';

  const getStatusColor = (s) => {
    switch (s) {
      case 'VERIFIED': return '#34d399';
      case 'USER_CONFIRMED': return '#38bdf8';
      case 'PARTIALLY_VERIFIED': return '#fbbf24';
      case 'AMBIGUOUS': return '#f59e0b';
      case 'BLOCKED': return '#ef4444';
      default: return '#94a3b8';
    }
  };

  return (
    <div style={{
      background: '#090d16',
      border: '1px solid #1e293b',
      borderRadius: '12px',
      padding: '0.85rem',
      color: '#f8fafc',
      fontFamily: 'Inter, system-ui, sans-serif',
      boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
      maxHeight: '600px',
      overflowY: 'auto'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid #1e293b',
        paddingBottom: '0.6rem',
        marginBottom: '0.75rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <div style={{
            background: 'linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%)',
            padding: '0.35rem',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Eye size={15} color="#ffffff" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              Visual Grounding State
              <span style={{
                fontSize: '0.62rem',
                padding: '0.1rem 0.35rem',
                borderRadius: '4px',
                background: `${getStatusColor(status)}20`,
                color: getStatusColor(status),
                border: `1px solid ${getStatusColor(status)}40`,
                fontWeight: 700
              }}>
                {status}
              </span>
            </div>
            <div style={{ fontSize: '0.68rem', color: '#64748b' }}>
              Schema v{visualGrounding.schema_version || '22.1'} • Deterministic Observer
            </div>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '0.2rem'
            }}
          >
            <X size={15} />
          </button>
        )}
      </div>

      {/* Summary KPI Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '0.4rem',
        marginBottom: '0.85rem'
      }}>
        <div style={{ background: '#0f172a', padding: '0.4rem', borderRadius: '6px', border: '1px solid #1e293b', textAlign: 'center' }}>
          <div style={{ fontSize: '0.62rem', color: '#64748b' }}>Verified Comps</div>
          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#34d399' }}>{summary.verified_components || 0}</div>
        </div>
        <div style={{ background: '#0f172a', padding: '0.4rem', borderRadius: '6px', border: '1px solid #1e293b', textAlign: 'center' }}>
          <div style={{ fontSize: '0.62rem', color: '#64748b' }}>Connections</div>
          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#38bdf8' }}>{summary.verified_connections || 0}</div>
        </div>
        <div style={{ background: '#0f172a', padding: '0.4rem', borderRadius: '6px', border: '1px solid #1e293b', textAlign: 'center' }}>
          <div style={{ fontSize: '0.62rem', color: '#64748b' }}>Nodes</div>
          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#c084fc' }}>{summary.verified_nodes || 0}</div>
        </div>
        <div style={{ background: '#0f172a', padding: '0.4rem', borderRadius: '6px', border: '1px solid #1e293b', textAlign: 'center' }}>
          <div style={{ fontSize: '0.62rem', color: '#64748b' }}>MNA Solver</div>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: summary.simulation_status === 'SOLVED' ? '#34d399' : '#fbbf24', marginTop: '0.15rem' }}>
            {summary.simulation_status || 'NOT_RUN'}
          </div>
        </div>
      </div>

      {/* Human Description Block */}
      {humanDesc && (
        <div style={{
          background: '#0c1322',
          border: '1px solid #1e293b',
          borderRadius: '6px',
          padding: '0.5rem 0.65rem',
          fontSize: '0.72rem',
          color: '#cbd5e1',
          lineHeight: 1.4,
          marginBottom: '0.75rem',
          whiteSpace: 'pre-wrap'
        }}>
          {humanDesc}
        </div>
      )}

      {/* Accordion Sections */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
        
        {/* 1. Grounded Components */}
        <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '6px', overflow: 'hidden' }}>
          <button
            onClick={() => toggleSection('components')}
            style={{
              width: '100%',
              background: 'none',
              border: 'none',
              padding: '0.45rem 0.65rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: '#cbd5e1',
              fontSize: '0.74rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <span>Components ({components.length})</span>
            {expandedSections.components ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          {expandedSections.components && (
            <div style={{ padding: '0.45rem 0.65rem', borderTop: '1px solid #1e293b', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {components.map((c) => (
                <div key={c.id} style={{
                  background: '#090d16',
                  padding: '0.4rem',
                  borderRadius: '4px',
                  border: '1px solid #1e293b',
                  fontSize: '0.70rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, color: '#f8fafc' }}>{c.id} ({c.type})</span>
                    <span style={{ fontSize: '0.62rem', color: getStatusColor(c.status), fontWeight: 600 }}>{c.status}</span>
                  </div>
                  <div style={{ color: '#94a3b8', marginTop: '0.15rem' }}>
                    Value: {c.display_value} • Terminals: {c.terminals?.terminal_a?.hole || 'None'} → {c.terminals?.terminal_b?.hole || 'None'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 2. Physical-to-Electrical Connections */}
        <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '6px', overflow: 'hidden' }}>
          <button
            onClick={() => toggleSection('connections')}
            style={{
              width: '100%',
              background: 'none',
              border: 'none',
              padding: '0.45rem 0.65rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: '#cbd5e1',
              fontSize: '0.74rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <span>Connections ({connections.length})</span>
            {expandedSections.connections ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          {expandedSections.connections && (
            <div style={{ padding: '0.45rem 0.65rem', borderTop: '1px solid #1e293b', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              {connections.map((conn) => (
                <div key={conn.connection_id} style={{
                  background: '#090d16',
                  padding: '0.35rem 0.5rem',
                  borderRadius: '4px',
                  fontSize: '0.68rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span>{conn.from.component}.{conn.from.terminal} (Hole {conn.from.physical_hole})</span>
                  <span style={{ color: '#38bdf8' }}>→ {conn.to.node}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 3. Electrical Nodes */}
        <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '6px', overflow: 'hidden' }}>
          <button
            onClick={() => toggleSection('nodes')}
            style={{
              width: '100%',
              background: 'none',
              border: 'none',
              padding: '0.45rem 0.65rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: '#cbd5e1',
              fontSize: '0.74rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <span>Nodes ({nodes.length})</span>
            {expandedSections.nodes ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          {expandedSections.nodes && (
            <div style={{ padding: '0.45rem 0.65rem', borderTop: '1px solid #1e293b', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              {nodes.map((n) => (
                <div key={n.id} style={{
                  background: '#090d16',
                  padding: '0.35rem 0.5rem',
                  borderRadius: '4px',
                  fontSize: '0.68rem'
                }}>
                  <div style={{ fontWeight: 600, color: '#c084fc' }}>{n.id} {n.voltage_v !== undefined && `(${n.voltage_v?.toFixed(2)} V)`}</div>
                  <div style={{ color: '#64748b', fontSize: '0.65rem' }}>Members: {n.members?.join(', ') || 'None'}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 4. Diagnostics & Rejected */}
        {(diagnostics.length > 0 || rejected.length > 0) && (
          <div style={{ background: '#0f172a', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '6px', overflow: 'hidden' }}>
            <button
              onClick={() => toggleSection('diagnostics')}
              style={{
                width: '100%',
                background: 'none',
                border: 'none',
                padding: '0.45rem 0.65rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                color: '#f87171',
                fontSize: '0.74rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <span>Diagnostics & Rejected ({diagnostics.length + rejected.length})</span>
              {expandedSections.diagnostics ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
            {expandedSections.diagnostics && (
              <div style={{ padding: '0.45rem 0.65rem', borderTop: '1px solid #1e293b', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                {diagnostics.map((d) => (
                  <div key={d.diagnostic_id} style={{ background: '#090d16', padding: '0.35rem 0.5rem', borderRadius: '4px', fontSize: '0.68rem', color: '#fbbf24' }}>
                    ⚠️ {d.issue}: {d.description}
                  </div>
                ))}
                {rejected.map((r) => (
                  <div key={r.id} style={{ background: '#090d16', padding: '0.35rem 0.5rem', borderRadius: '4px', fontSize: '0.68rem', color: '#64748b' }}>
                    ⛔ Rejected ({r.label}): {r.reason}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
