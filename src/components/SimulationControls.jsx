import React from 'react';
import { useCircuit } from '../context/CircuitContext';

export default function SimulationControls() {
  const { simulation, setSimulation, solverStatus, solverError } = useCircuit();

  const toggleRun = () => {
    setSimulation(prev => ({ ...prev, running: !prev.running }));
  };

  const resetSim = () => {
    setSimulation(prev => ({ ...prev, running: false, time: 0 }));
  };

  const setMode = (mode) => {
    setSimulation(prev => ({ ...prev, mode, time: 0 }));
  };

  return (
    <div style={{
      background: 'var(--surface-color, #0f172a)',
      borderRadius: '10px',
      border: '1px solid var(--border-color, #1e293b)',
      padding: '0.75rem 1.25rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: '1rem',
      margin: '1rem 0'
    }}>
      {/* Play/Pause/Reset Group */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <button
          onClick={toggleRun}
          disabled={solverStatus === 'ERROR' || solverStatus === 'INPUT_REQUIRED'}
          style={{
            background: simulation.running ? '#e11d48' : '#10b981',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            padding: '0.45rem 1rem',
            fontWeight: '600',
            cursor: solverStatus === 'ERROR' ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}
        >
          {simulation.running ? '⏸ PAUSE' : '▶ START'}
        </button>

        <button
          onClick={resetSim}
          style={{
            background: '#334155',
            color: '#f8fafc',
            border: 'none',
            borderRadius: '6px',
            padding: '0.45rem 0.85rem',
            fontWeight: '500',
            cursor: 'pointer'
          }}
        >
          ↻ RESET
        </button>

        <div style={{
          marginLeft: '0.75rem',
          fontFamily: 'monospace',
          fontSize: '0.95rem',
          color: '#38bdf8',
          background: 'rgba(56, 189, 248, 0.1)',
          padding: '0.35rem 0.75rem',
          borderRadius: '6px',
          border: '1px solid rgba(56, 189, 248, 0.3)'
        }}>
          t = {simulation.time.toFixed(4)} s
        </div>
      </div>

      {/* Mode Selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: '500' }}>Mode:</span>
        <button
          onClick={() => setMode('dc')}
          style={{
            background: simulation.mode === 'dc' ? '#2563eb' : '#1e293b',
            color: '#fff',
            border: '1px solid #334155',
            borderRadius: '6px 0 0 6px',
            padding: '0.4rem 0.85rem',
            cursor: 'pointer',
            fontWeight: simulation.mode === 'dc' ? '600' : '400'
          }}
        >
          DC
        </button>
        <button
          onClick={() => setMode('transient')}
          style={{
            background: simulation.mode === 'transient' ? '#2563eb' : '#1e293b',
            color: '#fff',
            border: '1px solid #334155',
            borderRadius: '0 6px 6px 0',
            padding: '0.4rem 0.85rem',
            cursor: 'pointer',
            fontWeight: simulation.mode === 'transient' ? '600' : '400'
          }}
        >
          TRANSIENT
        </button>
      </div>

      {/* Timestep & Speed Sliders */}
      {simulation.mode === 'transient' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', fontSize: '0.75rem', color: '#94a3b8' }}>
            <span>Time Step: {(simulation.timestep * 1000).toFixed(1)} ms</span>
            <input
              type="range"
              min="0.0001"
              max="0.005"
              step="0.0001"
              value={simulation.timestep}
              onChange={(e) => setSimulation(prev => ({ ...prev, timestep: parseFloat(e.target.value) }))}
              style={{ width: '90px' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', fontSize: '0.75rem', color: '#94a3b8' }}>
            <span>Speed: {simulation.speed}x</span>
            <input
              type="range"
              min="0.25"
              max="3.0"
              step="0.25"
              value={simulation.speed}
              onChange={(e) => setSimulation(prev => ({ ...prev, speed: parseFloat(e.target.value) }))}
              style={{ width: '80px' }}
            />
          </div>
        </div>
      )}

      {/* Solver Status Badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{
          display: 'inline-block',
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          background: solverStatus === 'SOLVED' ? '#10b981' : (solverStatus === 'INPUT_REQUIRED' ? '#f59e0b' : '#ef4444')
        }} />
        <span style={{ fontSize: '0.85rem', fontWeight: '600', color: solverStatus === 'SOLVED' ? '#10b981' : (solverStatus === 'INPUT_REQUIRED' ? '#f59e0b' : '#ef4444') }}>
          {solverStatus === 'SOLVED' ? '● CIRCUIT SOLVED' : (solverStatus === 'INPUT_REQUIRED' ? '⚠ VALUE REQUIRED' : '⚠ SOLVER ERROR')}
        </span>
      </div>
    </div>
  );
}
