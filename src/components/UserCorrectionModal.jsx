import React, { useState } from 'react';
import { useCircuit } from '../context/CircuitContext';

export default function UserCorrectionModal({ component, onClose }) {
  const { updateComponentTerminals } = useCircuit();
  const [hole1, setHole1] = useState(component?.hole1 || component?.start_hole || 'C25');
  const [hole2, setHole2] = useState(component?.hole2 || component?.end_hole || 'C29');

  if (!component) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    updateComponentTerminals(component.id || component.designator, hole1, hole2);
    onClose();
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.75)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{
        background: '#0f172a',
        border: '1px solid #38bdf8',
        borderRadius: '12px',
        padding: '1.5rem',
        maxWidth: '420px',
        width: '90%',
        boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
      }}>
        <h3 style={{ margin: '0 0 0.5rem 0', color: '#f8fafc' }}>
          Correct Terminal Mapping for <span style={{ color: '#38bdf8' }}>{component.id || component.designator}</span>
        </h3>
        <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '1.25rem' }}>
          If the automatic hole mapping is uncertain, specify exact breadboard hole coordinates to update netlist topology and re-run solver.
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '0.35rem' }}>Terminal A Hole</label>
            <input
              type="text"
              value={hole1}
              onChange={(e) => setHole1(e.target.value.toUpperCase())}
              placeholder="e.g. C25"
              required
              style={{
                width: '100%',
                background: '#1e293b',
                border: '1px solid #334155',
                color: '#fff',
                borderRadius: '6px',
                padding: '0.6rem 0.8rem',
                fontSize: '0.95rem'
              }}
            />
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '0.35rem' }}>Terminal B Hole</label>
            <input
              type="text"
              value={hole2}
              onChange={(e) => setHole2(e.target.value.toUpperCase())}
              placeholder="e.g. C29"
              required
              style={{
                width: '100%',
                background: '#1e293b',
                border: '1px solid #334155',
                color: '#fff',
                borderRadius: '6px',
                padding: '0.6rem 0.8rem',
                fontSize: '0.95rem'
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: '#334155',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                padding: '0.5rem 1rem',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                background: '#2563eb',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                padding: '0.5rem 1.25rem',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              APPLY CORRECTION
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
