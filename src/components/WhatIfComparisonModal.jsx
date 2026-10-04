import React from 'react';
import { formatVoltage, formatCurrent, formatPower } from '../utils/electricalFormatter';
import { Sparkles, Check, X, ArrowRight, Activity, Cpu, ShieldCheck } from 'lucide-react';

export default function WhatIfComparisonModal({
  isOpen,
  targetComponent,
  originalValue,
  candidateValue,
  originalSimulationResult,
  whatIfSimulationResult,
  onApply,
  onDiscard
}) {
  if (!isOpen || !targetComponent) return null;

  const des = targetComponent.designator || targetComponent.id || 'Component';
  const typeStr = (targetComponent.type || 'Component').toUpperCase();

  // Extract electrical measurements for target component
  const getElec = (res) => {
    if (!res) return null;
    const cid = (targetComponent.id || '').toUpperCase();
    const cdes = (targetComponent.designator || '').toUpperCase();

    if (res.components && Array.isArray(res.components)) {
      const match = res.components.find(c => {
        const sid = (c.id || '').toUpperCase();
        const sdes = (c.designator || '').toUpperCase();
        return (sid && (sid === cid || sid === cdes)) || (sdes && (sdes === cid || sdes === cdes));
      });
      if (match) return match;
    }

    if (res.digital_twin?.components) {
      const match = res.digital_twin.components.find(c => {
        const sid = (c.id || '').toUpperCase();
        const sdes = (c.designator || '').toUpperCase();
        return (sid && (sid === cid || sid === cdes)) || (sdes && (sdes === cid || sdes === cdes));
      });
      if (match?.electrical) return match.electrical;
    }

    const m = res.measurements?.[des] || res.measurements?.[targetComponent.id];
    if (m) {
      return {
        voltage: m.voltage !== undefined ? m.voltage : (m.voltageDrop !== undefined ? Math.abs(m.voltageDrop) : undefined),
        current: m.current,
        power: m.power,
        direction: m.direction,
        state: m.state,
        forward_voltage: m.forward_voltage
      };
    }
    return null;
  };

  const origElec = getElec(originalSimulationResult);
  const whatIfElec = getElec(whatIfSimulationResult);

  // Compute Delta values
  const vOrig = origElec?.voltage ?? origElec?.forward_voltage;
  const vNew = whatIfElec?.voltage ?? whatIfElec?.forward_voltage;
  const deltaV = (vOrig !== undefined && vNew !== undefined) ? (vNew - vOrig) : null;

  const iOrig = origElec?.current;
  const iNew = whatIfElec?.current;
  const deltaI = (iOrig !== undefined && iNew !== undefined) ? (iNew - iOrig) : null;

  const pOrig = origElec?.power;
  const pNew = whatIfElec?.power;
  const deltaP = (pOrig !== undefined && pNew !== undefined) ? (pNew - pOrig) : null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(2, 6, 23, 0.88)',
        backdropFilter: 'blur(5px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem'
      }}
    >
      <div
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
          border: '1px solid #818cf8',
          borderRadius: '16px',
          padding: '1.75rem',
          maxWidth: '620px',
          width: '100%',
          boxShadow: '0 20px 50px rgba(0,0,0,0.7), 0 0 30px rgba(129,140,248,0.25)',
          color: '#f8fafc',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', paddingBottom: '0.85rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{ background: 'rgba(129, 140, 248, 0.2)', padding: '0.5rem', borderRadius: '8px', color: '#a5b4fc' }}>
              <Sparkles size={24} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#c7d2fe' }}>
                WHAT-IF SIMULATION COMPARISON
              </h3>
              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                Analyzing hypothetical changes for <strong>{des}</strong> ({typeStr})
              </span>
            </div>
          </div>

          <span
            style={{
              background: 'rgba(129, 140, 248, 0.15)',
              color: '#818cf8',
              border: '1px solid rgba(129, 140, 248, 0.3)',
              padding: '0.3rem 0.65rem',
              borderRadius: '20px',
              fontSize: '0.75rem',
              fontWeight: 600
            }}
          >
            SANDBOX MODE
          </span>
        </div>

        {/* Side-by-Side Comparison Matrix */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'rgba(30, 41, 59, 0.8)', borderBottom: '1px solid #475569' }}>
                <th style={{ padding: '0.6rem 0.8rem', color: '#94a3b8' }}>PARAMETER</th>
                <th style={{ padding: '0.6rem 0.8rem', color: '#cbd5e1' }}>ORIGINAL CIRCUIT</th>
                <th style={{ padding: '0.6rem 0.8rem', color: '#a5b4fc' }}>WHAT-IF MODEL</th>
                <th style={{ padding: '0.6rem 0.8rem', color: '#38bdf8' }}>DELTA (Δ)</th>
              </tr>
            </thead>
            <tbody>
              {/* Component Value Row */}
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <td style={{ padding: '0.65rem 0.8rem', fontWeight: 600, color: '#94a3b8' }}>Component Value</td>
                <td style={{ padding: '0.65rem 0.8rem', fontWeight: 600, color: '#cbd5e1' }}>{originalValue}</td>
                <td style={{ padding: '0.65rem 0.8rem', fontWeight: 700, color: '#a5b4fc' }}>{candidateValue}</td>
                <td style={{ padding: '0.65rem 0.8rem', color: '#64748b' }}>—</td>
              </tr>

              {/* Voltage Drop Row */}
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <td style={{ padding: '0.65rem 0.8rem', fontWeight: 600, color: '#94a3b8' }}>Voltage Drop</td>
                <td style={{ padding: '0.65rem 0.8rem', color: '#10b981', fontWeight: 600 }}>{formatVoltage(vOrig)}</td>
                <td style={{ padding: '0.65rem 0.8rem', color: '#34d399', fontWeight: 700 }}>{formatVoltage(vNew)}</td>
                <td style={{ padding: '0.65rem 0.8rem', fontWeight: 600, color: deltaV === null ? '#64748b' : deltaV >= 0 ? '#38bdf8' : '#f87171' }}>
                  {deltaV !== null ? `${deltaV >= 0 ? '+' : ''}${formatVoltage(deltaV)}` : '—'}
                </td>
              </tr>

              {/* Current Row */}
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <td style={{ padding: '0.65rem 0.8rem', fontWeight: 600, color: '#94a3b8' }}>Branch Current</td>
                <td style={{ padding: '0.65rem 0.8rem', color: '#fbbf24', fontWeight: 600 }}>{formatCurrent(iOrig)}</td>
                <td style={{ padding: '0.65rem 0.8rem', color: '#fde047', fontWeight: 700 }}>{formatCurrent(iNew)}</td>
                <td style={{ padding: '0.65rem 0.8rem', fontWeight: 600, color: deltaI === null ? '#64748b' : deltaI >= 0 ? '#38bdf8' : '#f87171' }}>
                  {deltaI !== null ? `${deltaI >= 0 ? '+' : ''}${formatCurrent(deltaI)}` : '—'}
                </td>
              </tr>

              {/* Power Dissipation Row */}
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <td style={{ padding: '0.65rem 0.8rem', fontWeight: 600, color: '#94a3b8' }}>Power Dissipation</td>
                <td style={{ padding: '0.65rem 0.8rem', color: '#f43f5e', fontWeight: 600 }}>{formatPower(pOrig)}</td>
                <td style={{ padding: '0.65rem 0.8rem', color: '#fb7185', fontWeight: 700 }}>{formatPower(pNew)}</td>
                <td style={{ padding: '0.65rem 0.8rem', fontWeight: 600, color: deltaP === null ? '#64748b' : deltaP >= 0 ? '#38bdf8' : '#f87171' }}>
                  {deltaP !== null ? `${deltaP >= 0 ? '+' : ''}${formatPower(deltaP)}` : '—'}
                </td>
              </tr>

              {/* LED State Row if applicable */}
              {targetComponent.type === 'led' && (
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <td style={{ padding: '0.65rem 0.8rem', fontWeight: 600, color: '#94a3b8' }}>LED Operating State</td>
                  <td style={{ padding: '0.65rem 0.8rem', color: origElec?.state === 'ON' ? '#10b981' : '#f59e0b', fontWeight: 600 }}>
                    {origElec?.state || 'ON'}
                  </td>
                  <td style={{ padding: '0.65rem 0.8rem', color: whatIfElec?.state === 'ON' ? '#10b981' : '#f59e0b', fontWeight: 700 }}>
                    {whatIfElec?.state || 'ON'}
                  </td>
                  <td style={{ padding: '0.65rem 0.8rem', color: '#64748b' }}>—</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Simulation Result Disclaimer Banner */}
        <div
          style={{
            background: 'rgba(30, 41, 59, 0.6)',
            border: '1px solid #334155',
            borderRadius: '8px',
            padding: '0.65rem 0.85rem',
            fontSize: '0.75rem',
            color: '#94a3b8',
            textAlign: 'center'
          }}
        >
          ⚡ <strong>SIMULATION RESULT</strong> — Values generated by backend MNA numerical circuit solver. Not a direct physical sensor measurement.
        </div>

        {/* Footer Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.4rem' }}>
          <button
            onClick={onDiscard}
            style={{
              background: '#334155',
              color: '#cbd5e1',
              border: 'none',
              borderRadius: '8px',
              padding: '0.6rem 1.2rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
          >
            <X size={16} /> Discard What-If
          </button>

          <button
            onClick={onApply}
            style={{
              background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              padding: '0.6rem 1.4rem',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              boxShadow: '0 0 16px rgba(124, 58, 237, 0.4)'
            }}
          >
            <Check size={16} /> Apply To Digital Circuit
          </button>
        </div>
      </div>
    </div>
  );
}
