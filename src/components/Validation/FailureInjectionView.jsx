import React from 'react';
import { Bug, CheckCircle2, ShieldAlert, Zap, AlertTriangle, Cpu } from 'lucide-react';

export default function FailureInjectionView({ scenarios }) {
  const list = scenarios || [];

  return (
    <div style={{ padding: '1.5rem 2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Banner */}
      <div style={{
        background: 'linear-gradient(90deg, rgba(139, 92, 246, 0.1) 0%, rgba(99, 102, 241, 0.05) 100%)',
        border: '1px solid rgba(139, 92, 246, 0.3)',
        borderRadius: '10px',
        padding: '1rem 1.25rem'
      }}>
        <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Bug size={20} color="#a78bfa" />
          Controlled Failure Injection & Safety Recovery
        </h2>
        <p style={{ margin: '0.35rem 0 0', fontSize: '0.78rem', color: '#cbd5e1', lineHeight: 1.45 }}>
          Evaluating deterministic system resilience against open circuits, shifted terminals, disconnected power rails, unknown ICs, and visual ambiguities.
        </p>
      </div>

      {/* Scenarios Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
        gap: '1.25rem'
      }}>
        {list.map((sc) => (
          <div
            key={sc.scenario_id}
            style={{
              background: '#0c1322',
              border: '1px solid #1e293b',
              borderRadius: '10px',
              padding: '1.1rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '0.85rem',
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
              position: 'relative'
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
                <span style={{
                  background: 'rgba(167, 139, 250, 0.15)',
                  color: '#c4b5fd',
                  border: '1px solid rgba(167, 139, 250, 0.3)',
                  fontSize: '0.70rem',
                  fontWeight: 800,
                  padding: '0.15rem 0.45rem',
                  borderRadius: '4px'
                }}>
                  {sc.scenario_id}
                </span>

                <span style={{
                  background: 'rgba(52, 211, 153, 0.15)',
                  color: '#34d399',
                  border: '1px solid rgba(52, 211, 153, 0.3)',
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  padding: '0.15rem 0.45rem',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem'
                }}>
                  <CheckCircle2 size={11} color="#34d399" /> {sc.safety_status || 'VERIFIED_SAFE'}
                </span>
              </div>

              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#f8fafc', marginBottom: '0.35rem' }}>
                {sc.name}
              </div>

              <div style={{ fontSize: '0.74rem', color: '#94a3b8', lineHeight: 1.4, marginBottom: '0.75rem' }}>
                {sc.description}
              </div>
            </div>

            <div style={{
              background: '#090d16',
              border: '1px solid #1e293b',
              borderRadius: '6px',
              padding: '0.65rem',
              fontSize: '0.72rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.45rem'
            }}>
              <div>
                <strong style={{ color: '#fbbf24' }}>Expected Behavior: </strong>
                <span style={{ color: '#cbd5e1' }}>{sc.expected_behavior}</span>
              </div>
              <div style={{ borderTop: '1px solid #1e293b', paddingTop: '0.35rem' }}>
                <strong style={{ color: '#38bdf8' }}>Actual Software Response: </strong>
                <span style={{ color: '#cbd5e1' }}>{sc.software_response}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
