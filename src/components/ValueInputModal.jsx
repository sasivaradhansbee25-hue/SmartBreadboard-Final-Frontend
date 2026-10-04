import React, { useState } from 'react';
import { useCircuit } from '../context/CircuitContext';
import { parseComponentValue } from '../utils/valueParser';

export default function ValueInputModal({ component, onClose, onConfirmOverride }) {
  const { applyDigitalComponentValue } = useCircuit();
  const rawCandidates = component?.rawCandidates || [];
  
  const [selectedCandidate, setSelectedCandidate] = useState(
    rawCandidates.length > 0 ? 0 : null
  );
  const [val, setVal] = useState(component?.user_override_value || component?.displayValue || component?.value || (rawCandidates[0]?.value || '1000'));
  const [unit, setUnit] = useState(component?.unit || (rawCandidates[0]?.unit || 'Ω'));
  const [errorMsg, setErrorMsg] = useState(null);

  if (!component) return null;

  const handleCandidateSelect = (idx) => {
    setSelectedCandidate(idx);
    const cand = rawCandidates[idx];
    if (cand) {
      setVal(cand.value);
      setUnit(cand.unit || 'Ω');
      setErrorMsg(null);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!component) return;

    const parsed = parseComponentValue(val, component.type || 'resistor');
    if (!parsed.isValid) {
      setErrorMsg(parsed.error || 'Invalid component value');
      return;
    }

    if (onConfirmOverride) {
      onConfirmOverride(component, val, unit, parsed.formatted);
    } else {
      applyDigitalComponentValue(component.id || component.designator, val, unit);
      onClose();
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.8)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{
        background: '#0f172a',
        border: '1px solid #f59e0b',
        borderRadius: '14px',
        padding: '1.75rem',
        maxWidth: '460px',
        width: '92%',
        boxShadow: '0 12px 30px rgba(0,0,0,0.7)',
        color: '#f8fafc'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
          <span style={{ fontSize: '1.4rem' }}>⚠️</span>
          <h3 style={{ margin: 0, color: '#fbbf24', fontSize: '1.2rem', fontWeight: 600 }}>
            CONFIRM COMPONENT VALUE
          </h3>
        </div>

        <div style={{ background: '#1e293b', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '1.05rem', fontWeight: 'bold', color: '#38bdf8' }}>
            {component.designator || component.id} — {(component.type || 'Component').toUpperCase()}
          </div>
          <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.2rem' }}>
            {component.needsConfirmation 
              ? 'Detection confidence is below threshold or detection sources disagree. Please select or confirm value.'
              : 'Specify or edit electrical value to update CircuitContext and re-solve circuit.'}
          </div>
        </div>

        {/* Candidates Section */}
        {rawCandidates.length > 0 && (
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 600, marginBottom: '0.5rem' }}>
              AI detected possible values:
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {rawCandidates.map((cand, idx) => (
                <div
                  key={idx}
                  onClick={() => handleCandidateSelect(idx)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: selectedCandidate === idx ? '#1e3a8a' : '#1e293b',
                    border: `1px solid ${selectedCandidate === idx ? '#3b82f6' : '#334155'}`,
                    borderRadius: '6px',
                    padding: '0.6rem 0.8rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <input
                      type="radio"
                      name="candidate"
                      checked={selectedCandidate === idx}
                      onChange={() => handleCandidateSelect(idx)}
                      style={{ cursor: 'pointer' }}
                    />
                    <span style={{ fontWeight: 600, color: '#f8fafc' }}>
                      {cand.displayValue}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'capitalize' }}>
                      ({cand.source})
                    </span>
                  </div>
                  <span style={{
                    fontSize: '0.8rem',
                    fontWeight: 'bold',
                    color: cand.confidence >= 0.85 ? '#4ade80' : '#facc15'
                  }}>
                    {Math.round((cand.confidence || 0.8) * 100)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Manual Input Form */}
        <form onSubmit={handleSubmit}>
          <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 600, marginBottom: '0.4rem' }}>
            {rawCandidates.length > 0 ? 'Or enter value (e.g. 2.2k, 470, 10uF):' : 'Enter value (e.g. 2.2k, 470, 10uF):'}
          </label>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <input
              type="text"
              value={val}
              onChange={(e) => {
                setSelectedCandidate(null);
                setVal(e.target.value);
                setErrorMsg(null);
              }}
              placeholder="e.g. 2.2k, 1000, 10uF"
              required
              style={{
                flex: 1,
                background: '#0f172a',
                border: errorMsg ? '1px solid #ef4444' : '1px solid #334155',
                color: '#fff',
                borderRadius: '6px',
                padding: '0.6rem 0.8rem',
                fontSize: '1rem'
              }}
            />
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              style={{
                background: '#0f172a',
                border: '1px solid #334155',
                color: '#fff',
                borderRadius: '6px',
                padding: '0.6rem 0.8rem',
                fontSize: '1rem'
              }}
            >
              <option value="Ω">Ω (Ohm)</option>
              <option value="kΩ">kΩ</option>
              <option value="MΩ">MΩ</option>
              <option value="µF">µF</option>
              <option value="nF">nF</option>
              <option value="mH">mH</option>
              <option value="V">V</option>
            </select>
          </div>

          {errorMsg && (
            <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', borderRadius: '6px', padding: '0.45rem 0.75rem', color: '#fca5a5', fontSize: '0.8rem', marginBottom: '1rem' }}>
              ⚠️ {errorMsg}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: '#334155',
                color: '#cbd5e1',
                border: 'none',
                borderRadius: '6px',
                padding: '0.6rem 1.1rem',
                fontSize: '0.9rem',
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
                padding: '0.6rem 1.3rem',
                fontWeight: '600',
                fontSize: '0.9rem',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(37,99,235,0.4)'
              }}
            >
              ⚡ CONFIRM VALUE
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

