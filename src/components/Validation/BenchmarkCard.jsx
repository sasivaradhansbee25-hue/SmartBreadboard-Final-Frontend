import React from 'react';
import { Layers, Camera, Zap, Eye, AlertCircle, CheckCircle, Clock } from 'lucide-react';

export default function BenchmarkCard({ benchmark, onInspect }) {
  const isTested = benchmark.status !== 'NOT_TESTED';
  const isPass = benchmark.status === 'PASS';
  const isFail = benchmark.status === 'FAIL';

  // Status Badge formatting
  const getStatusBadge = () => {
    if (isPass) {
      return (
        <span style={{
          background: 'rgba(52, 211, 153, 0.15)',
          color: '#34d399',
          border: '1px solid rgba(52, 211, 153, 0.3)',
          padding: '0.15rem 0.45rem',
          borderRadius: '4px',
          fontSize: '0.65rem',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem'
        }}>
          <CheckCircle size={10} /> PASS
        </span>
      );
    }
    if (isFail) {
      return (
        <span style={{
          background: 'rgba(239, 68, 68, 0.15)',
          color: '#f87171',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          padding: '0.15rem 0.45rem',
          borderRadius: '4px',
          fontSize: '0.65rem',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem'
        }}>
          <AlertCircle size={10} /> FAIL
        </span>
      );
    }
    return (
      <span style={{
        background: 'rgba(245, 158, 11, 0.15)',
        color: '#fbbf24',
        border: '1px solid rgba(245, 158, 11, 0.3)',
        padding: '0.15rem 0.45rem',
        borderRadius: '4px',
        fontSize: '0.65rem',
        fontWeight: 700,
        display: 'flex',
        alignItems: 'center',
        gap: '0.25rem'
      }}>
        <Clock size={10} /> NOT_TESTED
      </span>
    );
  };

  const comps = benchmark.components || [];
  const compNames = comps.map(c => `${c.id} (${c.nominal_value ? `${c.nominal_value} ${c.unit || 'Ω'}` : c.type})`).join(', ');

  return (
    <div style={{
      background: '#0c1322',
      border: '1px solid #1e293b',
      borderRadius: '10px',
      padding: '1rem',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      gap: '0.85rem',
      transition: 'all 0.2s ease',
      boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      position: 'relative',
      overflow: 'hidden'
    }}
    onMouseOver={(e) => { e.currentTarget.style.borderColor = '#38bdf8'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
    onMouseOut={(e) => { e.currentTarget.style.borderColor = '#1e293b'; e.currentTarget.style.transform = 'translateY(0)'; }}
    >
      {/* Top Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{
              fontSize: '0.72rem',
              fontWeight: 800,
              color: '#38bdf8',
              background: 'rgba(56, 189, 248, 0.1)',
              padding: '0.15rem 0.45rem',
              borderRadius: '4px',
              border: '1px solid rgba(56, 189, 248, 0.25)'
            }}>
              {benchmark.case_id}
            </span>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f8fafc' }}>
              {benchmark.circuit_name.replace(/_/g, ' ')}
            </span>
          </div>
          {getStatusBadge()}
        </div>

        <p style={{
          margin: '0.35rem 0 0.65rem',
          fontSize: '0.74rem',
          color: '#cbd5e1',
          lineHeight: 1.4,
          minHeight: '2.5rem'
        }}>
          {benchmark.description}
        </p>

        {/* Component Tags */}
        <div style={{ fontSize: '0.70rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
          <strong style={{ color: '#cbd5e1' }}>Components: </strong>
          <span>{compNames || 'None'}</span>
        </div>

        {/* Camera Setup */}
        <div style={{
          display: 'flex',
          gap: '0.65rem',
          fontSize: '0.68rem',
          color: '#64748b',
          background: '#090d16',
          padding: '0.35rem 0.55rem',
          borderRadius: '6px',
          marginBottom: '0.65rem'
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <Camera size={11} color="#818cf8" /> {benchmark.camera?.viewing_angle || 'front'}
          </span>
          <span>•</span>
          <span>Light: {benchmark.camera?.lighting_condition || 'standard'}</span>
        </div>
      </div>

      {/* Metrics & Measurement Snapshot */}
      <div>
        <div style={{
          borderTop: '1px solid #1e293b',
          paddingTop: '0.65rem',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '0.45rem',
          fontSize: '0.70rem'
        }}>
          <div>
            <span style={{ color: '#64748b' }}>Multimeter V: </span>
            <span style={{ fontWeight: 600, color: benchmark.physical_measurements?.v_supply_measured_v != null ? '#34d399' : '#94a3b8' }}>
              {benchmark.physical_measurements?.v_supply_measured_v != null 
                ? `${benchmark.physical_measurements.v_supply_measured_v.toFixed(2)} V` 
                : 'N/A (Not recorded)'}
            </span>
          </div>
          <div>
            <span style={{ color: '#64748b' }}>Multimeter I: </span>
            <span style={{ fontWeight: 600, color: benchmark.physical_measurements?.i_circuit_measured_ma != null ? '#34d399' : '#94a3b8' }}>
              {benchmark.physical_measurements?.i_circuit_measured_ma != null 
                ? `${benchmark.physical_measurements.i_circuit_measured_ma.toFixed(2)} mA` 
                : 'N/A (Not recorded)'}
            </span>
          </div>
        </div>

        {/* Inspect Button */}
        <button
          onClick={() => onInspect(benchmark)}
          style={{
            marginTop: '0.75rem',
            width: '100%',
            background: 'rgba(56, 189, 248, 0.1)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            color: '#38bdf8',
            borderRadius: '6px',
            padding: '0.4rem',
            fontSize: '0.72rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.35rem',
            transition: 'all 0.15s'
          }}
          onMouseOver={(e) => { e.currentTarget.style.background = '#0284c7'; e.currentTarget.style.color = '#ffffff'; }}
          onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(56, 189, 248, 0.1)'; e.currentTarget.style.color = '#38bdf8'; }}
        >
          <Eye size={13} /> Inspect Case & Evidence
        </button>
      </div>
    </div>
  );
}
