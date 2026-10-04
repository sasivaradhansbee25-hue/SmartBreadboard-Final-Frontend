import React from 'react';
import { useCircuit } from '../context/CircuitContext';

export default function ComponentMeasurementCard({ onOpenValueModal, onOpenCorrectionModal, onOpenManualModal }) {
  const { selectedComponent, measurements, activeCircuit, simulationSource, simulationResult, solverStatus, solverError } = useCircuit();

  if (!selectedComponent) {
    return (
      <div style={{
        background: 'var(--surface-color, #0f172a)',
        border: '1px dashed var(--border-color, #334155)',
        borderRadius: '10px',
        padding: '1.25rem',
        textAlign: 'center',
        color: '#94a3b8'
      }}>
        <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🔍</div>
        <p style={{ margin: 0, fontSize: '0.9rem' }}>Click any component in the 3D Breadboard or list to measure voltage, current & power.</p>
        {onOpenManualModal && (
          <div style={{ marginTop: '0.75rem' }}>
            <button
              onClick={() => onOpenManualModal(null)}
              style={{
                background: '#4f46e5',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                padding: '0.35rem 0.8rem',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              + Add Manual Resistor
            </button>
          </div>
        )}
      </div>
    );
  }

  const compId = selectedComponent.name || selectedComponent.designator || selectedComponent.id || 'C1';
  const cType = (selectedComponent.type || selectedComponent.class || 'Component').toUpperCase();

  // Retrieve solver measurement if available
  const m = measurements[compId] || measurements[selectedComponent.id] || {};
  const compObj = activeCircuit?.components?.find(c => (c.id === compId || c.designator === compId)) || selectedComponent;
  const elec = selectedComponent.electrical || null;

  const isSolved = (solverStatus === 'SOLVED' || simulationResult?.solver_status === 'SOLVED');

  const valDisplay = compObj?.displayValue || compObj?.user_override_value || compObj?.formatted_value || compObj?.detected_value || selectedComponent.value || '1 kΩ';
  const valueSource = compObj?.valueSource || selectedComponent.valueSource || 'detected';
  const needsConf = compObj?.needsConfirmation || false;
  const isUnknown = compObj?.source === 'unknown' || compObj?.type === 'unknown' || compObj?.confidence < 0.5;
  const isManual = compObj?.source === 'manual';

  const rawV = (elec && elec.voltage !== undefined) ? elec.voltage : (m.voltage !== undefined ? m.voltage : (m.voltageDrop !== undefined ? Math.abs(m.voltageDrop) : undefined));
  const rawI = (elec && elec.current !== undefined) ? elec.current : m.current;
  const rawP = (elec && elec.power !== undefined) ? elec.power : m.power;

  const voltageDrop = isSolved && rawV !== undefined ? `${rawV.toFixed(2)} V` : (isSolved ? 'N/A' : '—');
  const currentDisplay = isSolved && rawI !== undefined ? `${(rawI * 1000).toFixed(2)} mA` : (isSolved ? 'N/A' : '—');
  const powerMw = isSolved && rawP !== undefined ? rawP * 1000 : 0;
  const powerDisplay = isSolved && rawP !== undefined ? `${powerMw.toFixed(2)} mW` : (isSolved ? 'N/A' : '—');

  const termA = m.terminalVoltages?.A !== undefined ? `${m.terminalVoltages.A.toFixed(2)} V` : (m.voltage_a !== undefined ? `${m.voltage_a.toFixed(2)} V` : '0.00 V');
  const termB = m.terminalVoltages?.B !== undefined ? `${m.terminalVoltages.B.toFixed(2)} V` : (m.voltage_b !== undefined ? `${m.voltage_b.toFixed(2)} V` : '0.00 V');

  const sourceOrigin = simulationSource ? "User Simulated" : (activeCircuit?.source === 'real' ? "Reconstructed from uploaded image" : "Built-in demonstration circuit");

  // Source attribution label formatting
  const sourceLabelMap = {
    'ocr': 'Multi-Pass OCR',
    'ocr_consensus': 'OCR Consensus',
    'color_code': 'Color Code',
    'ocr_color_fusion': 'OCR + Color Code Fusion',
    'user_confirmed': 'User Confirmed',
    'user_required': 'Uncertain AI Value',
    'detected': 'Detected'
  };

  const isHighPower = powerMw > 1000; // >1W power warning per Req 14

  return (
    <div style={{
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      border: `1px solid ${isUnknown ? '#ef4444' : isManual ? '#6366f1' : needsConf ? '#f59e0b' : '#3b82f6'}`,
      borderRadius: '10px',
      padding: '1.25rem',
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', borderBottom: '1px solid #334155', paddingBottom: '0.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h4 style={{ margin: 0, color: '#f8fafc', fontSize: '1.1rem' }}>{compId} — {cType}</h4>
            {/* Phase 17 Provenance Badges */}
            {isUnknown ? (
              <span style={{ fontSize: '0.7rem', background: 'rgba(239, 68, 68, 0.25)', color: '#fca5a5', padding: '0.15rem 0.45rem', borderRadius: '4px', fontWeight: 700, border: '1px solid #ef4444' }}>
                ❓ UNKNOWN
              </span>
            ) : isManual ? (
              <span style={{ fontSize: '0.7rem', background: 'rgba(99, 102, 241, 0.25)', color: '#c7d2fe', padding: '0.15rem 0.45rem', borderRadius: '4px', fontWeight: 700, border: '1px solid #6366f1' }}>
                ✍ MANUAL
              </span>
            ) : needsConf ? (
              <span style={{ fontSize: '0.7rem', background: '#78350f', color: '#fef08a', padding: '0.15rem 0.4rem', borderRadius: '4px', fontWeight: 600 }}>
                ⚠️ CONFIRM VALUE
              </span>
            ) : (
              <span style={{ fontSize: '0.7rem', background: '#064e3b', color: '#6ee7b7', padding: '0.15rem 0.4rem', borderRadius: '4px', fontWeight: 600 }}>
                ● AI VERIFIED
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.2rem' }}>
            Provenance: <strong style={{ color: '#cbd5e1' }}>{isManual ? 'Manual User Entry' : isUnknown ? 'Unknown Detection (Recovery Required)' : (sourceLabelMap[valueSource] || valueSource)}</strong>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          {isUnknown && onOpenManualModal ? (
            <button
              onClick={() => onOpenManualModal(compObj)}
              style={{
                background: '#4f46e5',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                padding: '0.35rem 0.75rem',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 0 10px rgba(79, 70, 229, 0.5)'
              }}
            >
              ✍ Add Manually
            </button>
          ) : (
            <>
              {onOpenManualModal && (
                <button
                  onClick={() => onOpenManualModal(compObj)}
                  style={{
                    background: '#334155',
                    color: '#c7d2fe',
                    border: '1px solid #4f46e5',
                    borderRadius: '4px',
                    padding: '0.3rem 0.6rem',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                  title="Edit as manual component"
                >
                  ✍ Define
                </button>
              )}
              <button
                onClick={() => onOpenValueModal && onOpenValueModal(compObj)}
                style={{
                  background: needsConf ? '#f59e0b' : '#334155',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '0.3rem 0.7rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: needsConf ? '0 0 8px rgba(245,158,11,0.5)' : 'none'
                }}
              >
                {needsConf ? '⚠️ Set Value' : '✏ Value'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Solver Status Banner when NOT_RUN or ERROR */}
      {!isSolved && (
        <div style={{
          background: solverStatus === 'NOT_RUN' || simulationResult?.solver_status === 'NOT_RUN' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)',
          border: `1px solid ${solverStatus === 'NOT_RUN' || simulationResult?.solver_status === 'NOT_RUN' ? '#f59e0b' : '#ef4444'}`,
          borderRadius: '6px',
          padding: '0.5rem 0.75rem',
          marginBottom: '0.75rem',
          fontSize: '0.8rem',
          color: solverStatus === 'NOT_RUN' || simulationResult?.solver_status === 'NOT_RUN' ? '#fef08a' : '#fca5a5'
        }}>
          {solverStatus === 'NOT_RUN' || simulationResult?.solver_status === 'NOT_RUN' ? (
            <span>⏸ <strong>Simulation: NOT RUN</strong> — {simulationResult?.reason || solverError?.message || 'No power source detected in photograph. Add simulated power source for electrical analysis.'}</span>
          ) : (
            <span>⚠️ <strong>Simulation: ERROR</strong> — {solverError?.message || simulationResult?.reason || 'Circuit solver error.'}</span>
          )}
        </div>
      )}

      {/* Grid: 3-Metric Real Electrical Display */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '0.75rem' }}>
        {/* Voltage Drop */}
        <div style={{ background: '#0b1120', padding: '0.6rem 0.8rem', borderRadius: '6px', border: '1px solid #1e293b' }}>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Voltage Drop</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#38bdf8', marginTop: '0.2rem' }}>
            {voltageDrop}
          </div>
        </div>

        {/* Current */}
        <div style={{ background: '#0b1120', padding: '0.6rem 0.8rem', borderRadius: '6px', border: '1px solid #1e293b' }}>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Current</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#fbbf24', marginTop: '0.2rem' }}>
            {currentDisplay}
          </div>
        </div>

        {/* Power */}
        <div style={{ background: '#0b1120', padding: '0.6rem 0.8rem', borderRadius: '6px', border: `1px solid ${isHighPower ? '#ef4444' : '#1e293b'}` }}>
          <div style={{ fontSize: '0.75rem', color: isHighPower ? '#f87171' : '#94a3b8' }}>
            {isHighPower ? '⚠️ High Power' : 'Power'}
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: isHighPower ? '#ef4444' : '#f43f5e', marginTop: '0.2rem' }}>
            {powerDisplay}
          </div>
        </div>
      </div>

      {/* Terminals & Simulation Disclaimer */}
      <div style={{ borderTop: '1px solid #334155', paddingTop: '0.5rem', fontSize: '0.75rem', color: '#94a3b8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          Terminals: <strong style={{ color: '#cbd5e1' }}>{compObj?.hole1 || compObj?.start_hole || '—'} ({termA})</strong> ↔ <strong style={{ color: '#cbd5e1' }}>{compObj?.hole2 || compObj?.end_hole || '—'} ({termB})</strong>
        </div>
        <div>
          Value: <strong style={{ color: '#cbd5e1' }}>{valDisplay}</strong>
        </div>
      </div>
      
      {/* Simulation Engine Attribution */}
      <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.4rem', textAlign: 'right' }}>
        Source: {sourceOrigin} (MNA Engine)
      </div>
    </div>
  );
}
