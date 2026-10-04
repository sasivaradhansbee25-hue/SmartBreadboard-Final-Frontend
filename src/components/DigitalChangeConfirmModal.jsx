import React from 'react';
import { AlertTriangle, Check, X, ShieldAlert, Cpu } from 'lucide-react';

export default function DigitalChangeConfirmModal({
  isOpen,
  component,
  oldValue,
  newValue,
  onConfirm,
  onCancel
}) {
  if (!isOpen || !component) return null;

  const des = component.designator || component.id || 'Component';
  const typeStr = (component.type || 'Component').toUpperCase();

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(2, 6, 23, 0.85)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem'
      }}
    >
      <div
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          border: '1px solid #38bdf8',
          borderRadius: '14px',
          padding: '1.5rem',
          maxWidth: '440px',
          width: '100%',
          boxShadow: '0 20px 40px rgba(0,0,0,0.6), 0 0 20px rgba(56,189,248,0.2)',
          color: '#f8fafc',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', borderBottom: '1px solid #334155', paddingBottom: '0.75rem' }}>
          <div style={{ background: 'rgba(56, 189, 248, 0.15)', padding: '0.5rem', borderRadius: '8px', color: '#38bdf8' }}>
            <Cpu size={22} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#38bdf8' }}>
              CONFIRM DIGITAL MODEL CHANGE
            </h3>
            <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
              Target: <strong>{des}</strong> ({typeStr})
            </span>
          </div>
        </div>

        {/* Change Diff Matrix */}
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.75)',
            border: '1px solid #334155',
            borderRadius: '10px',
            padding: '1rem',
            display: 'flex',
            justifyContent: 'space-around',
            alignItems: 'center'
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.2rem' }}>ORIGINAL MODEL</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#cbd5e1' }}>
              {oldValue || '1 kΩ'}
            </div>
          </div>

          <div style={{ fontSize: '1.4rem', color: '#38bdf8' }}>➔</div>

          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 600, marginBottom: '0.2rem' }}>NEW DIGITAL VALUE</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#34d399' }}>
              {newValue}
            </div>
          </div>
        </div>

        {/* Strict Hardware Separation Notice Banner */}
        <div
          style={{
            background: 'rgba(59, 130, 246, 0.12)',
            border: '1px solid rgba(59, 130, 246, 0.35)',
            borderRadius: '8px',
            padding: '0.75rem 0.9rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.6rem',
            fontSize: '0.8rem',
            color: '#bfdbfe',
            lineHeight: 1.4
          }}
        >
          <ShieldAlert size={18} style={{ color: '#60a5fa', flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong>Digital Simulation Modification Only:</strong>
            <br />
            This updates the mathematical simulation model and 3D digital twin. The physical breadboard hardware and detected optical coordinates remain completely unchanged.
          </div>
        </div>

        {/* Modal Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
          <button
            onClick={onCancel}
            style={{
              background: '#334155',
              color: '#cbd5e1',
              border: 'none',
              borderRadius: '8px',
              padding: '0.55rem 1.1rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              transition: 'background 0.15s ease'
            }}
          >
            <X size={16} /> Cancel
          </button>

          <button
            onClick={onConfirm}
            style={{
              background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              padding: '0.55rem 1.25rem',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              boxShadow: '0 0 15px rgba(37,99,235,0.4)',
              transition: 'transform 0.15s ease'
            }}
          >
            <Check size={16} /> Apply Digital Change
          </button>
        </div>
      </div>
    </div>
  );
}
