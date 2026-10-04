import React, { useState, useEffect } from 'react';
import { useCircuit } from '../context/CircuitContext';
import { parseComponentValue } from '../utils/valueParser';
import { X, Wrench, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';

export default function ManualComponentModal({
  isOpen = true,
  component = null,
  onClose,
  onSuccess
}) {
  const { addManualResistor } = useCircuit();

  const isRecoveringUnknown = component && (component.source === 'unknown' || component.type === 'unknown' || component.confidence < 0.5);

  const [compId, setCompId] = useState('');
  const [val, setVal] = useState('1000');
  const [unit, setUnit] = useState('Ω');
  const [hole1, setHole1] = useState('A1');
  const [hole2, setHole2] = useState('A5');
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    if (component) {
      setCompId(component.id || component.designator || '');
      setVal(component.value || component.user_override_value || '1000');
      setUnit(component.unit || 'Ω');
      setHole1(component.hole1 || component.start_hole || 'A1');
      setHole2(component.hole2 || component.end_hole || 'A5');
    } else {
      setCompId(`R_MANUAL_${Date.now().toString().slice(-4)}`);
      setVal('1000');
      setUnit('Ω');
      setHole1('A1');
      setHole2('A5');
    }
    setErrorMsg(null);
  }, [component, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorMsg(null);

    const parsed = parseComponentValue(val, 'resistor');
    if (!parsed.isValid) {
      setErrorMsg(parsed.error || 'Invalid resistance value');
      return;
    }

    const cleanH1 = hole1.trim().toUpperCase();
    const cleanH2 = hole2.trim().toUpperCase();

    if (!cleanH1 || !cleanH2) {
      setErrorMsg('Both terminal holes (A & B) must be specified');
      return;
    }

    if (cleanH1 === cleanH2) {
      setErrorMsg('Terminal A and Terminal B cannot be the same hole (short circuit)');
      return;
    }

    const result = addManualResistor({
      id: compId || `R_MANUAL_${Date.now().toString().slice(-4)}`,
      value: val,
      unit: unit,
      hole1: cleanH1,
      hole2: cleanH2,
      replacingId: component ? (component.id || component.designator) : null
    });

    if (result && result.success) {
      if (onSuccess) onSuccess(result.component);
      onClose();
    } else {
      setErrorMsg(result?.error || 'Failed to add manual component');
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.85)',
      zIndex: 10000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem'
    }}>
      <div style={{
        background: '#0f172a',
        border: '1px solid #6366f1',
        borderRadius: '12px',
        maxWidth: '480px',
        width: '100%',
        boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
        overflow: 'hidden',
        color: '#f8fafc',
        animation: 'fadeIn 0.2s ease-out'
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
          padding: '1rem 1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid #4338ca'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Wrench size={20} style={{ color: '#818cf8' }} />
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: '#f8fafc' }}>
              {isRecoveringUnknown ? 'MANUAL COMPONENT RECOVERY' : 'ADD MANUAL COMPONENT'}
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              display: 'flex',
              padding: '0.2rem'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} style={{ padding: '1.25rem' }}>
          {isRecoveringUnknown && (
            <div style={{
              background: 'rgba(245, 158, 11, 0.12)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: '8px',
              padding: '0.75rem',
              marginBottom: '1rem',
              fontSize: '0.82rem',
              color: '#fde68a'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
                <AlertTriangle size={15} style={{ color: '#f59e0b' }} />
                <span>UNKNOWN COMPONENT RECOVERY ({component.id || 'Unknown'})</span>
              </div>
              <p style={{ margin: '0.35rem 0 0 0', color: '#cbd5e1' }}>
                The vision pipeline could not confidently identify this physical component. Define its electrical parameters manually to integrate into the MNA simulation.
              </p>
            </div>
          )}

          {/* Component Type (Fixed to Resistor for Phase 17) */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem', fontWeight: 600 }}>
              COMPONENT TYPE
            </label>
            <div style={{
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '6px',
              padding: '0.6rem 0.8rem',
              fontSize: '0.88rem',
              color: '#f8fafc',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span>Resistor (Fixed 2-Terminal Passive)</span>
              <span style={{ fontSize: '0.72rem', background: '#312e81', color: '#c7d2fe', padding: '0.15rem 0.45rem', borderRadius: '4px', fontWeight: 600 }}>
                PHASE 17
              </span>
            </div>
          </div>

          {/* Resistance Value Input */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem', fontWeight: 600 }}>
              RESISTANCE VALUE
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                value={val}
                onChange={(e) => setVal(e.target.value)}
                placeholder="e.g. 1000, 4.7k, 220"
                style={{
                  flex: 1,
                  background: '#1e293b',
                  border: '1px solid #475569',
                  borderRadius: '6px',
                  padding: '0.6rem 0.8rem',
                  color: '#fff',
                  fontSize: '0.95rem',
                  fontWeight: 600
                }}
                required
                autoFocus
              />
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                style={{
                  background: '#1e293b',
                  border: '1px solid #475569',
                  borderRadius: '6px',
                  padding: '0.6rem 0.8rem',
                  color: '#fff',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <option value="Ω">Ω (Ohms)</option>
                <option value="kΩ">kΩ (Kilo-ohms)</option>
                <option value="MΩ">MΩ (Mega-ohms)</option>
              </select>
            </div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.25rem' }}>
              Accepts plain numbers or engineering suffixes (e.g. <code>220</code>, <code>4.7k</code>, <code>10k</code>).
            </div>
          </div>

          {/* Breadboard Terminals */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem', fontWeight: 600 }}>
                TERMINAL A HOLE
              </label>
              <input
                type="text"
                value={hole1}
                onChange={(e) => setHole1(e.target.value.toUpperCase())}
                placeholder="e.g. A10"
                maxLength={10}
                style={{
                  width: '100%',
                  background: '#1e293b',
                  border: '1px solid #475569',
                  borderRadius: '6px',
                  padding: '0.55rem 0.75rem',
                  color: '#38bdf8',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  fontFamily: 'monospace',
                  boxSizing: 'border-box'
                }}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem', fontWeight: 600 }}>
                TERMINAL B HOLE
              </label>
              <input
                type="text"
                value={hole2}
                onChange={(e) => setHole2(e.target.value.toUpperCase())}
                placeholder="e.g. E10"
                maxLength={10}
                style={{
                  width: '100%',
                  background: '#1e293b',
                  border: '1px solid #475569',
                  borderRadius: '6px',
                  padding: '0.55rem 0.75rem',
                  color: '#38bdf8',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  fontFamily: 'monospace',
                  boxSizing: 'border-box'
                }}
                required
              />
            </div>
          </div>

          {/* Provenance Notice */}
          <div style={{
            background: 'rgba(99, 102, 241, 0.1)',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            borderRadius: '6px',
            padding: '0.55rem 0.75rem',
            marginBottom: '1rem',
            fontSize: '0.75rem',
            color: '#c7d2fe',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}>
            <ShieldCheck size={16} style={{ color: '#818cf8', flexShrink: 0 }} />
            <span>Provenance will be recorded as <strong>source: "manual"</strong> (verified = true).</span>
          </div>

          {/* Error Banner */}
          {errorMsg && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid #ef4444',
              borderRadius: '6px',
              padding: '0.6rem',
              color: '#fca5a5',
              fontSize: '0.82rem',
              marginBottom: '1rem'
            }}>
              ⚠️ {errorMsg}
            </div>
          )}

          {/* Footer Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '1rem' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: '#334155',
                color: '#cbd5e1',
                border: 'none',
                borderRadius: '6px',
                padding: '0.55rem 1rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                background: '#4f46e5',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                padding: '0.55rem 1.25rem',
                fontSize: '0.85rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                boxShadow: '0 2px 8px rgba(79, 70, 229, 0.4)'
              }}
            >
              <CheckCircle2 size={16} />
              {isRecoveringUnknown ? 'Recover Component' : 'Add Resistor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
