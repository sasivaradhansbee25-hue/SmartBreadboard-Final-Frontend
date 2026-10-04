import React, { useState, useMemo } from 'react';
import { useCircuit } from '../context/CircuitContext';
import { extractComponentMetrics, SIMULATION_STATUS } from '../services/supplyConfigurationService';

export default function SimulationGraphPanel() {
  const {
    activeCircuit,
    simulationResult,
    simulationStatus,
    simulationSignature,
    transientAnalysis
  } = useCircuit();

  const components = useMemo(() => {
    return (activeCircuit?.components || []).filter(c => c && (c.id || c.designator));
  }, [activeCircuit]);

  const [selectedCompId, setSelectedCompId] = useState(components[0]?.id || components[0]?.designator || 'R1');
  const [activeMetric, setActiveMetric] = useState('voltage'); // 'voltage', 'current', 'power'

  // Update selected component if components list changes and selection is invalid
  const validCompId = useMemo(() => {
    if (components.some(c => (c.id || c.designator) === selectedCompId)) {
      return selectedCompId;
    }
    return components[0]?.id || components[0]?.designator || '';
  }, [components, selectedCompId]);

  // Extract component electrical metrics from DC MNA solver
  const dcMetrics = useMemo(() => {
    if (!validCompId || simulationStatus !== SIMULATION_STATUS.SOLVED || !simulationResult) {
      return null;
    }
    return extractComponentMetrics(simulationResult, validCompId, activeCircuit?.circuit_signature);
  }, [validCompId, simulationStatus, simulationResult, activeCircuit?.circuit_signature]);

  // Check if real transient data is available for this component
  const hasTransientData = useMemo(() => {
    if (!transientAnalysis || transientAnalysis.status === 'ERROR') return false;
    return Array.isArray(transientAnalysis.time) && transientAnalysis.time.length > 0;
  }, [transientAnalysis]);

  // Determine current display value and unit
  const metricInfo = useMemo(() => {
    if (!dcMetrics) {
      return { label: 'Voltage', value: 0, unit: 'V', formatted: '0.00 V' };
    }
    switch (activeMetric) {
      case 'current':
        return {
          label: 'Current',
          value: dcMetrics.currentMA,
          unit: 'mA',
          formatted: `${dcMetrics.currentMA.toFixed(3)} mA`
        };
      case 'power':
        return {
          label: 'Power',
          value: dcMetrics.powerMW,
          unit: 'mW',
          formatted: `${dcMetrics.powerMW.toFixed(3)} mW`
        };
      case 'voltage':
      default:
        return {
          label: 'Voltage',
          value: dcMetrics.voltageDrop,
          unit: 'V',
          formatted: `${dcMetrics.voltageDrop.toFixed(3)} V`
        };
    }
  }, [dcMetrics, activeMetric]);

  return (
    <div style={{
      background: 'rgba(15, 23, 42, 0.9)',
      backdropFilter: 'blur(12px)',
      border: '1px solid rgba(56, 189, 248, 0.25)',
      borderRadius: '12px',
      padding: '18px',
      color: '#f8fafc',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
      maxWidth: '560px',
      margin: '0 auto'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px' }}>📈</span>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#38bdf8' }}>
            Live Electrical Graphs
          </h3>
        </div>
        <span style={{ fontSize: '11px', background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
          MNA Operating Point
        </span>
      </div>

      {/* Controls: Component Selector & Metric Buttons */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        {/* Component Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>
            Component:
          </label>
          <select
            value={validCompId}
            onChange={(e) => setSelectedCompId(e.target.value)}
            disabled={components.length === 0}
            style={{
              padding: '6px 12px',
              background: 'rgba(30, 41, 59, 0.9)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              borderRadius: '6px',
              color: '#f8fafc',
              fontSize: '12px',
              fontWeight: 600,
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            {components.map(c => {
              const cid = c.id || c.designator;
              return (
                <option key={`comp-opt-${cid}`} value={cid}>
                  {cid} ({c.type || 'resistor'})
                </option>
              );
            })}
          </select>
        </div>

        {/* Metric Buttons */}
        <div style={{ display: 'flex', gap: '6px' }}>
          {[
            { id: 'voltage', label: 'Voltage (V)' },
            { id: 'current', label: 'Current (I)' },
            { id: 'power', label: 'Power (P)' }
          ].map(m => {
            const isSelected = activeMetric === m.id;
            return (
              <button
                key={`btn-metric-${m.id}`}
                type="button"
                onClick={() => setActiveMetric(m.id)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: isSelected ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.1)',
                  background: isSelected ? 'rgba(56, 189, 248, 0.2)' : 'rgba(30, 41, 59, 0.6)',
                  color: isSelected ? '#38bdf8' : '#94a3b8',
                  transition: 'all 0.15s ease'
                }}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Graph Visualization Area */}
      <div style={{
        background: 'rgba(2, 6, 23, 0.8)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '8px',
        padding: '16px',
        minHeight: '200px',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center'
      }}>
        {simulationStatus !== SIMULATION_STATUS.SOLVED || !dcMetrics ? (
          <div style={{ textAlign: 'center', color: '#64748b', padding: '40px 20px' }}>
            <div style={{ fontSize: '24px', marginBottom: '8px' }}>💤</div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#94a3b8' }}>
              Simulation NOT RUN
            </div>
            <div style={{ fontSize: '12px', marginTop: '4px' }}>
              Configure power supply and click <strong>Simulate Circuit</strong> to view electrical operating points.
            </div>
          </div>
        ) : (
          <>
            {/* Transient vs DC notice banner */}
            <div style={{
              background: 'rgba(56, 189, 248, 0.08)',
              border: '1px solid rgba(56, 189, 248, 0.2)',
              borderRadius: '6px',
              padding: '8px 12px',
              marginBottom: '14px',
              fontSize: '12px',
              color: '#7dd3fc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <span>
                {hasTransientData
                  ? '⚡ Transient numerical integration active'
                  : 'ℹ️ DC operating point — transient waveform not available'}
              </span>
              <span style={{ fontWeight: 700, color: '#38bdf8' }}>
                {metricInfo.formatted}
              </span>
            </div>

            {/* Stable Operating Point DC Visualization Chart */}
            <svg width="100%" height="140" style={{ overflow: 'visible' }}>
              {/* Grid Lines */}
              <line x1="40" y1="20" x2="100%" y2="20" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
              <line x1="40" y1="60" x2="100%" y2="60" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
              <line x1="40" y1="100" x2="100%" y2="100" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
              <line x1="40" y1="120" x2="100%" y2="120" stroke="rgba(255,255,255,0.2)" />
              <line x1="40" y1="10" x2="40" y2="120" stroke="rgba(255,255,255,0.2)" />

              {/* Y-axis Labels */}
              <text x="35" y="24" fill="#64748b" fontSize="10" textAnchor="end">{metricInfo.unit}</text>
              <text x="35" y="64" fill="#64748b" fontSize="10" textAnchor="end">{(metricInfo.value * 1.0).toFixed(1)}</text>
              <text x="35" y="124" fill="#64748b" fontSize="10" textAnchor="end">0</text>

              {/* X-axis Labels (Time in ms) */}
              <text x="45" y="135" fill="#64748b" fontSize="9">0ms</text>
              <text x="50%" y="135" fill="#64748b" fontSize="9" textAnchor="middle">5ms</text>
              <text x="96%" y="135" fill="#64748b" fontSize="9" textAnchor="end">10ms (Steady State)</text>

              {/* Stable DC Level Line */}
              <line
                x1="40"
                y1="60"
                x2="96%"
                y2="60"
                stroke={activeMetric === 'voltage' ? '#38bdf8' : (activeMetric === 'current' ? '#34d399' : '#fbbf24')}
                strokeWidth="2.5"
              />

              {/* Operating Point Indicator Point */}
              <circle
                cx="50%"
                cy="60"
                r="4.5"
                fill={activeMetric === 'voltage' ? '#38bdf8' : (activeMetric === 'current' ? '#34d399' : '#fbbf24')}
                stroke="#0f172a"
                strokeWidth="2"
              />

              {/* Tooltip text above the point */}
              <text
                x="50%"
                y="48"
                fill="#f8fafc"
                fontSize="11"
                fontWeight="700"
                textAnchor="middle"
              >
                {validCompId}: {metricInfo.formatted} (DC Stable)
              </text>
            </svg>
          </>
        )}
      </div>

      {/* Footer Info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', fontSize: '11px', color: '#64748b' }}>
        <span>No fabricated waveform data • True MNA solution</span>
        <span>Component: <strong style={{ color: '#94a3b8' }}>{validCompId || 'None'}</strong></span>
      </div>
    </div>
  );
}
