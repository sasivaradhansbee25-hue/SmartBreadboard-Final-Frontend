import React, { useState } from 'react';
import { useCircuit } from '../context/CircuitContext';

export default function LiveGraphInspector() {
  const { selectedComponent, timeSeriesData, simulation } = useCircuit();
  const [metric, setMetric] = useState('voltageDrop'); // 'voltageDrop', 'current', 'power'

  const compId = selectedComponent?.name || selectedComponent?.designator || selectedComponent?.id || 'R1';

  // Extract plot points
  const points = (timeSeriesData || []).map(step => {
    const m = step.measurements?.[compId] || {};
    const val = m[metric] !== undefined ? m[metric] : (metric === 'current' ? 0.005 : (metric === 'power' ? 0.025 : 5.0));
    return { t: step.t, v: val };
  });

  // Generate SVG polyline
  const width = 450;
  const height = 180;
  const padding = 30;

  const maxV = points.length ? Math.max(...points.map(p => p.v), 0.001) * 1.15 : 12;
  const minV = 0;

  const polylinePoints = points.map((p, idx) => {
    const x = padding + (idx / Math.max(points.length - 1, 1)) * (width - 2 * padding);
    const y = height - padding - ((p.v - minV) / (maxV - minV)) * (height - 2 * padding);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  const metricLabels = {
    voltageDrop: { name: 'Voltage (V)', color: '#38bdf8' },
    current: { name: 'Current (A)', color: '#fbbf24' },
    power: { name: 'Power (W)', color: '#f43f5e' }
  };

  return (
    <div style={{
      background: 'var(--surface-color, #0f172a)',
      borderRadius: '10px',
      border: '1px solid var(--border-color, #1e293b)',
      padding: '1rem',
      margin: '1rem 0'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <h4 style={{ margin: 0, color: '#f8fafc', fontSize: '1rem' }}>
          📈 Live Graph Inspector — <span style={{ color: '#38bdf8' }}>{compId}</span>
        </h4>

        <div style={{ display: 'flex', gap: '0.25rem' }}>
          {['voltageDrop', 'current', 'power'].map(mKey => (
            <button
              key={mKey}
              onClick={() => setMetric(mKey)}
              style={{
                background: metric === mKey ? metricLabels[mKey].color : '#1e293b',
                color: metric === mKey ? '#000' : '#cbd5e1',
                border: 'none',
                borderRadius: '4px',
                padding: '0.25rem 0.5rem',
                fontSize: '0.75rem',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              {mKey === 'voltageDrop' ? 'Voltage' : (mKey === 'current' ? 'Current' : 'Power')}
            </button>
          ))}
        </div>
      </div>

      {/* SVG Canvas Plot */}
      <div style={{ width: '100%', overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: '180px', background: '#040711', borderRadius: '6px' }}>
          {/* Axes */}
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#334155" strokeWidth="1" />
          <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#334155" strokeWidth="1" />

          {/* Grid lines */}
          <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="#1e293b" strokeDasharray="4 4" />

          {/* Y Axis labels */}
          <text x={padding - 5} y={padding + 5} fill="#94a3b8" fontSize="9" textAnchor="end">{maxV.toFixed(2)}</text>
          <text x={padding - 5} y={height - padding} fill="#94a3b8" fontSize="9" textAnchor="end">0</text>

          {/* Graph Curve */}
          {points.length > 1 && (
            <polyline
              fill="none"
              stroke={metricLabels[metric].color}
              strokeWidth="2.5"
              points={polylinePoints}
            />
          )}

          {/* X Axis Label */}
          <text x={width / 2} y={height - 8} fill="#94a3b8" fontSize="10" textAnchor="middle">Time (seconds)</text>
        </svg>
      </div>
    </div>
  );
}
