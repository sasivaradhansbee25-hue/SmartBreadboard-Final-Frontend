import React from 'react';
import { formatVoltage, formatCurrent, formatPower } from '../utils/electricalFormatter';
import { Cpu, Zap, Activity, Edit3, Sparkles, Layers, X, ShieldAlert, CheckCircle2 } from 'lucide-react';

export default function ARInteractiveInspector({
  component,
  electrical,
  solverStatus,
  onEditValue,
  onStartWhatIf,
  onHighlightNet,
  onClose
}) {
  if (!component) return null;

  const des = component.designator || component.id || 'Component';
  const typeStr = (component.type || 'Component').toUpperCase();
  const hole1 = component.hole1 || component.start_hole || '—';
  const hole2 = component.hole2 || component.end_hole || '—';
  const trackingState = (component.tracking_state || 'TRACKED').toUpperCase();
  const confidence = Math.round((component.val_confidence || component.confidence || 0.94) * 100);
  const digitalVal = component.user_override_value || component.displayValue || component.formatted_value || component.detected_value || '1 kΩ';

  const isSolved = solverStatus === 'SOLVED' && !!electrical;

  return (
    <div
      style={{
        position: 'absolute',
        top: '16px',
        right: '16px',
        width: '320px',
        maxWidth: 'calc(100% - 32px)',
        zIndex: 50,
        background: 'rgba(8, 14, 26, 0.92)',
        backdropFilter: 'blur(10px)',
        border: '1px solid #38bdf8',
        borderRadius: '12px',
        padding: '1rem',
        boxShadow: '0 12px 30px rgba(0,0,0,0.6), 0 0 20px rgba(56,189,248,0.25)',
        color: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        pointerEvents: 'auto',
        animation: 'fadeIn 0.2s ease-out'
      }}
    >
      {/* Header with Title & Close Button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', paddingBottom: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <div style={{ background: 'rgba(56, 189, 248, 0.2)', padding: '0.35rem', borderRadius: '6px', color: '#38bdf8' }}>
            <Cpu size={18} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#38bdf8', letterSpacing: '0.5px' }}>
              {des}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase' }}>
              {typeStr}
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            padding: '0.2rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '4px'
          }}
          title="Close Inspector"
        >
          <X size={18} />
        </button>
      </div>

      {/* 1. Physical Tracking Section */}
      <div style={{ background: 'rgba(15, 23, 42, 0.7)', borderRadius: '6px', padding: '0.5rem 0.65rem', fontSize: '0.78rem' }}>
        <div style={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.25rem' }}>
          Physical Mapping
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Holes: <strong style={{ color: '#cbd5e1' }}>{hole1} ↔ {hole2}</strong></span>
          <span style={{
            background: trackingState === 'TRACKED' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
            color: trackingState === 'TRACKED' ? '#10b981' : '#f59e0b',
            padding: '0.15rem 0.4rem',
            borderRadius: '4px',
            fontSize: '0.68rem',
            fontWeight: 700
          }}>
            {trackingState} ({confidence}%)
          </span>
        </div>
      </div>

      {/* 2. Digital Model Section */}
      <div style={{ background: 'rgba(15, 23, 42, 0.7)', borderRadius: '6px', padding: '0.5rem 0.65rem', fontSize: '0.78rem' }}>
        <div style={{ color: '#38bdf8', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.25rem' }}>
          Digital Model
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Active Value:</span>
          <strong style={{ color: '#f8fafc', fontSize: '0.9rem' }}>{digitalVal}</strong>
        </div>
        {component.user_override_value && (
          <div style={{ fontSize: '0.68rem', color: '#60a5fa', marginTop: '2px' }}>
            ● Digital Override Active
          </div>
        )}
      </div>

      {/* 3. Live Simulation Result Section */}
      <div style={{ background: 'rgba(15, 23, 42, 0.7)', borderRadius: '6px', padding: '0.5rem 0.65rem', fontSize: '0.78rem' }}>
        <div style={{ color: '#10b981', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <Zap size={12} />
          Simulation Result
        </div>

        {isSolved ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#94a3b8' }}>Voltage Drop (V):</span>
              <strong style={{ color: '#10b981' }}>{formatVoltage(electrical.voltage ?? electrical.forward_voltage)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#94a3b8' }}>Current (I):</span>
              <strong style={{ color: '#fbbf24' }}>{formatCurrent(electrical.current)}</strong>
            </div>
            {electrical.power !== undefined && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>Power Dissipation:</span>
                <strong style={{ color: '#f43f5e' }}>{formatPower(electrical.power)}</strong>
              </div>
            )}
            {component.type === 'led' && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>LED State:</span>
                <strong style={{ color: electrical.state === 'ON' ? '#10b981' : (electrical.state === 'REVERSE' ? '#f59e0b' : '#94a3b8') }}>
                  {electrical.state || 'ON'}
                </strong>
              </div>
            )}
            {electrical.direction && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>Flow Direction:</span>
                <span style={{ color: '#38bdf8', fontSize: '0.72rem', fontFamily: 'monospace' }}>
                  {electrical.direction}
                </span>
              </div>
            )}
          </div>
        ) : solverStatus === 'NOT_RUN' ? (
          <div style={{ color: '#f59e0b', fontSize: '0.75rem', fontStyle: 'italic' }}>
            ⏸ Simulation: NOT RUN (Awaiting power source)
          </div>
        ) : (
          <div style={{ color: '#ef4444', fontSize: '0.75rem', fontStyle: 'italic' }}>
            ⚠️ Simulation: ERROR
          </div>
        )}
      </div>

      {/* 4. Interactive Action Buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', marginTop: '0.2rem' }}>
        <button
          onClick={() => onEditValue && onEditValue(component)}
          style={{
            background: '#0284c7',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            padding: '0.45rem 0.6rem',
            fontSize: '0.75rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.35rem',
            transition: 'background 0.15s ease'
          }}
        >
          <Edit3 size={13} /> Edit Value
        </button>

        <button
          onClick={() => onStartWhatIf && onStartWhatIf(component)}
          style={{
            background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            padding: '0.45rem 0.6rem',
            fontSize: '0.75rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.35rem'
          }}
        >
          <Sparkles size={13} /> What-If
        </button>

        <button
          onClick={() => onHighlightNet && onHighlightNet(component.node1 || component.net)}
          style={{
            gridColumn: 'span 2',
            background: '#1e293b',
            color: '#818cf8',
            border: '1px solid #334155',
            borderRadius: '6px',
            padding: '0.4rem 0.6rem',
            fontSize: '0.74rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.35rem'
          }}
        >
          <Layers size={13} /> Highlight Electrical Net
        </button>
      </div>

      {/* Strict Separation Notice */}
      <div style={{ fontSize: '0.68rem', color: '#64748b', textAlign: 'center', marginTop: '2px' }}>
        Modifications alter the digital simulation model only.
      </div>
    </div>
  );
}
