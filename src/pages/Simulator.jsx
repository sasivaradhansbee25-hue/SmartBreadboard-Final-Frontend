import React, { useState } from 'react';
import { Box, ShieldAlert, Eye, FileCode, Sparkles, Wrench } from 'lucide-react';
import { mockCircuits } from '../data/mockCircuits';
import { useCircuit } from '../context/CircuitContext';
import Schematic2DRenderer from '../components/Schematic2DRenderer';
import Breadboard3DCanvas from '../components/Breadboard3DCanvas';
import SimulationControls from '../components/SimulationControls';
import PowerSourcePanel from '../components/PowerSourcePanel';
import ComponentMeasurementCard from '../components/ComponentMeasurementCard';
import LiveGraphInspector from '../components/LiveGraphInspector';
import ValueInputModal from '../components/ValueInputModal';
import UserCorrectionModal from '../components/UserCorrectionModal';
import CircuitIntelligencePanel from '../components/Intelligence/CircuitIntelligencePanel';
import SupplyConfigurationPanel from '../components/SupplyConfigurationPanel';
import SimulationGraphPanel from '../components/SimulationGraphPanel';
import SimulationWaveformPanel from '../components/SimulationWaveformPanel';

export default function Simulator() {
  const { activeCircuit, setMockCircuitData, loadDemoCircuit, solverStatus, solverError } = useCircuit();
  const [viewMode, setViewMode] = useState('3d');
  const [editingComp, setEditingComp] = useState(null);
  const [correctingComp, setCorrectingComp] = useState(null);

  const isReal = activeCircuit.source === 'real';
  const [powerMode, setPowerMode] = useState('manual_supply'); // 'manual_supply' | 'power_rails'

  return (
    <div>
      {/* Modals for value overrides & terminal corrections */}
      {editingComp && (
        <ValueInputModal
          component={editingComp}
          onClose={() => setEditingComp(null)}
        />
      )}

      {correctingComp && (
        <UserCorrectionModal
          component={correctingComp}
          onClose={() => setCorrectingComp(null)}
        />
      )}

      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 className="page-title">
              <Box size={28} style={{ color: 'var(--accent-cyan)' }} />
              2D / 3D Interactive Breadboard Simulator & Electrical Analyzer
            </h1>
            <p className="page-subtitle">
              Reconstruct physical breadboard circuits, solve node-to-node voltages and currents via MNA, and simulate transient waveforms in 3D.
            </p>
          </div>
          <div>
            {isReal ? (
              <span className="code-pill" style={{ background: 'rgba(34, 197, 94, 0.15)', color: 'var(--accent-emerald)', borderColor: 'var(--accent-emerald)' }}>
                <Sparkles size={14} /> Data Source: REAL AI
              </span>
            ) : (
              <span className="code-pill">
                <ShieldAlert size={14} /> Data Source: {activeCircuit.source?.toUpperCase() || 'RECONSTRUCTED'}
              </span>
            )}

          </div>
        </div>
      </div>

      {/* Solver Warning / Error Banner if applicable */}
      {solverStatus === 'ERROR' && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid #ef4444',
          borderRadius: '8px',
          padding: '1rem',
          color: '#fca5a5',
          marginBottom: '1rem'
        }}>
          <strong>⚠ Circuit cannot be solved</strong>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem' }}>
            Reason: {solverError?.message || "Invalid topology, missing ground reference, or singular matrix."}
          </p>
        </div>
      )}

      {/* Circuit Selection & Control Toolbar */}
      <div className="card" style={{ marginBottom: '1rem', padding: '0.85rem 1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>Target Circuit:</span>

            {isReal ? (
              <span className="code-pill" style={{ fontSize: '0.85rem', color: 'var(--accent-emerald)', borderColor: 'var(--accent-emerald)' }}>
                Real Scanned Netlist ({activeCircuit.components?.length || 0} Components)
              </span>
            ) : (
              <select
                value={activeCircuit.id}
                onChange={(e) => {
                  if (e.target.value.startsWith('demo_')) {
                    loadDemoCircuit(e.target.value === 'demo_rlc_transient' ? 1 : 0);
                  } else {
                    setMockCircuitData(mockCircuits.find(c => c.id === e.target.value) || mockCircuits[0]);
                  }
                }}
                className="input-field"
                style={{ width: 'auto', padding: '0.35rem 0.65rem', fontSize: '0.85rem' }}
              >
                {mockCircuits.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
                <option value="demo_dc_led">[DEMO] DC LED & Resistor Circuit</option>
                <option value="demo_rlc_transient">[DEMO] RLC Transient Circuit</option>
              </select>
            )}

            <button
              onClick={() => loadDemoCircuit(0)}
              className="btn btn-secondary"
              style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}
            >
              ⚡ LOAD DEMO CIRCUIT
            </button>
          </div>

          {/* View Mode Toolbar: 3D Viewport | 2D Schematic */}
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => setViewMode('3d')}
              className="btn btn-secondary"
              style={{
                fontSize: '0.8rem',
                padding: '0.4rem 0.75rem',
                borderColor: viewMode === '3d' ? 'var(--accent-cyan)' : 'var(--border-color)',
                background: viewMode === '3d' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255,255,255,0.03)',
                color: 'var(--accent-cyan)'
              }}
            >
              <Eye size={14} /> 3D Three.js Viewport
            </button>
            <button
              onClick={() => setViewMode('schematic')}
              className="btn btn-secondary"
              style={{
                fontSize: '0.8rem',
                padding: '0.4rem 0.75rem',
                borderColor: viewMode === 'schematic' ? 'var(--accent-cyan)' : 'var(--border-color)',
                background: viewMode === 'schematic' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255,255,255,0.03)'
              }}
            >
              <FileCode size={14} /> 2D Schematic
            </button>
          </div>
        </div>
      </div>

      {/* Power Supply Mode Selector */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', alignItems: 'center' }}>
        <button
          onClick={() => setPowerMode('manual_supply')}
          className="btn btn-secondary"
          style={{
            fontSize: '0.8rem',
            padding: '0.4rem 0.8rem',
            borderColor: powerMode === 'manual_supply' ? '#38bdf8' : 'var(--border-color)',
            background: powerMode === 'manual_supply' ? 'rgba(56, 189, 248, 0.18)' : 'rgba(255,255,255,0.03)',
            color: powerMode === 'manual_supply' ? '#38bdf8' : '#94a3b8',
            fontWeight: powerMode === 'manual_supply' ? '700' : '500'
          }}
        >
          ⚡ Manual Supply Configuration (Phase 24.2)
        </button>
        <button
          onClick={() => setPowerMode('power_rails')}
          className="btn btn-secondary"
          style={{
            fontSize: '0.8rem',
            padding: '0.4rem 0.8rem',
            borderColor: powerMode === 'power_rails' ? '#38bdf8' : 'var(--border-color)',
            background: powerMode === 'power_rails' ? 'rgba(56, 189, 248, 0.18)' : 'rgba(255,255,255,0.03)',
            color: powerMode === 'power_rails' ? '#38bdf8' : '#94a3b8',
            fontWeight: powerMode === 'power_rails' ? '700' : '500'
          }}
        >
          🔋 Legacy Rail Source Setup
        </button>
      </div>

      {/* Selected Power Setup Panel */}
      {powerMode === 'manual_supply' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.25rem', marginBottom: '1.25rem' }}>
          <SupplyConfigurationPanel />
          <SimulationWaveformPanel />
        </div>
      ) : (
        <PowerSourcePanel />
      )}

      {/* Simulation Controls Toolbar */}
      <SimulationControls />

      {/* Main 3D Canvas / 2D Viewport */}
      {viewMode === '3d' ? (
        <div style={{ marginBottom: '1.25rem' }}>
          <Breadboard3DCanvas circuit={activeCircuit} />
        </div>
      ) : (
        <div style={{ marginBottom: '1.25rem' }}>
          <Schematic2DRenderer circuit={activeCircuit} />
        </div>
      )}

      {/* Phase 25: Context-Aware Circuit Intelligence & AR Learning Panel */}
      <div style={{ marginBottom: '1.25rem' }}>
        <CircuitIntelligencePanel />
      </div>

      {/* Lower Dashboard: Component Measurement Card & Live Graph */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '1.25rem', flexWrap: 'wrap' }}>
        <ComponentMeasurementCard onOpenValueModal={(comp) => setEditingComp(comp)} />
        <LiveGraphInspector />
      </div>
    </div>
  );
}
