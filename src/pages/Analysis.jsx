import React, { useState } from 'react';
import { Activity, GitCommit, Edit3, ShieldAlert, FileCode, Check, Eye, Cpu, Zap, ListChecks, Sparkles } from 'lucide-react';
import { mockCircuits } from '../data/mockCircuits';
import { useCircuit } from '../context/CircuitContext';
import Schematic2DRenderer from '../components/Schematic2DRenderer';
import { solveNodeToNodeResistance } from '../utils/circuitSolver';

export default function Analysis() {
  const { activeCircuit, setMockCircuitData } = useCircuit();
  const [showJson, setShowJson] = useState(false);

  const currentCircuit = activeCircuit;
  const isReal = currentCircuit.source === 'real';

  const [nodeA, setNodeA] = useState(currentCircuit.nodes?.[0]?.id || 'N1');
  const [nodeB, setNodeB] = useState(currentCircuit.nodes?.[1]?.id || 'N2');

  const solverOutput = solveNodeToNodeResistance(currentCircuit, nodeA, nodeB);

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 className="page-title">
              <Activity size={28} style={{ color: 'var(--accent-cyan)' }} />
              Schematic & Netlist Inspector
            </h1>
            <p className="page-subtitle">
              Review AI-recognized components, edit user values, and calculate node-to-node equivalent resistance.
            </p>
          </div>
          <div>
            {isReal ? (
              <span className="code-pill" style={{ background: 'rgba(34, 197, 94, 0.15)', color: 'var(--accent-emerald)', borderColor: 'var(--accent-emerald)' }}>
                <Sparkles size={14} /> Data Source: REAL AI
              </span>
            ) : (
              <span className="code-pill">
                <ShieldAlert size={14} /> Data Source: Reconstructed Circuit
              </span>
            )}

          </div>
        </div>
      </div>

      {/* Circuit Selector Toolbar */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem 1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-muted)' }}>Target Netlist:</span>
            {isReal ? (
              <span className="code-pill" style={{ color: 'var(--accent-emerald)', borderColor: 'var(--accent-emerald)' }}>
                Real Scanned Netlist ({currentCircuit.components?.length || 0} Comps)
              </span>
            ) : (
              <select
                value={currentCircuit.id}
                onChange={(e) => setMockCircuitData(mockCircuits.find(c => c.id === e.target.value) || mockCircuits[0])}
                className="input-field"
                style={{ width: 'auto', padding: '0.35rem 0.65rem', fontSize: '0.85rem' }}
              >
                {mockCircuits.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}
          </div>

          <button
            onClick={() => setShowJson(!showJson)}
            className="btn btn-secondary"
            style={{ fontSize: '0.8rem' }}
          >
            <FileCode size={14} /> {showJson ? 'Hide SPEC JSON' : 'View SPEC JSON Schema'}
          </button>
        </div>
      </div>

      {showJson && (
        <div className="card" style={{ marginBottom: '1.5rem', background: '#040711' }}>
          <h3 style={{ fontSize: '0.9rem', color: 'var(--accent-cyan)', marginBottom: '0.5rem' }}>Circuit Data Model JSON Schema (SPEC.md Section 9)</h3>
          <pre style={{ fontSize: '0.75rem', color: '#38bdf8', overflowX: 'auto', maxHeight: '250px' }}>
            {JSON.stringify(currentCircuit, null, 2)}
          </pre>
        </div>
      )}

      {/* Netlist Table & Solver */}
      <div className="card-grid" style={{ gridTemplateColumns: '2fr 1fr' }}>
        <div className="card">
          <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ListChecks size={18} style={{ color: 'var(--accent-cyan)' }} /> Netlist Component Table
          </h2>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                <th style={{ padding: '0.5rem' }}>Designator</th>
                <th style={{ padding: '0.5rem' }}>Type</th>
                <th style={{ padding: '0.5rem' }}>Detected Value</th>
                <th style={{ padding: '0.5rem' }}>Node 1 (Hole)</th>
                <th style={{ padding: '0.5rem' }}>Node 2 (Hole)</th>
              </tr>
            </thead>
            <tbody>
              {currentCircuit.components?.map((c) => (
                <tr key={c.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '0.6rem 0.5rem', fontWeight: '700', color: 'var(--accent-cyan)' }}>{c.id}</td>
                  <td style={{ padding: '0.6rem 0.5rem' }}>{c.type}</td>
                  <td style={{ padding: '0.6rem 0.5rem', fontFamily: 'var(--font-mono)' }}>{String(c.detected_value)}</td>
                  <td style={{ padding: '0.6rem 0.5rem' }}>{c.node1} ({c.hole1 || 'N/A'})</td>
                  <td style={{ padding: '0.6rem 0.5rem' }}>{c.node2} ({c.hole2 || 'N/A'})</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Node-to-Node Solver Panel */}
        <div className="card">
          <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Zap size={18} style={{ color: 'var(--accent-amber)' }} /> Node-to-Node Solver
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
            <div>
              <label style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Terminal A:</label>
              <select
                value={nodeA}
                onChange={(e) => setNodeA(e.target.value)}
                className="input-field"
                style={{ width: '100%', fontSize: '0.85rem' }}
              >
                {currentCircuit.nodes?.map(n => (
                  <option key={n.id} value={n.id}>{n.id} ({n.label})</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Terminal B:</label>
              <select
                value={nodeB}
                onChange={(e) => setNodeB(e.target.value)}
                className="input-field"
                style={{ width: '100%', fontSize: '0.85rem' }}
              >
                {currentCircuit.nodes?.map(n => (
                  <option key={n.id} value={n.id}>{n.id} ({n.label})</option>
                ))}
              </select>
            </div>

            <div style={{ marginTop: '0.5rem', padding: '0.85rem', background: 'rgba(8, 12, 20, 0.8)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Equivalent Resistance:</div>
              <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--accent-emerald)', fontFamily: 'var(--font-mono)' }}>
                {solverOutput.equivalent_resistance_formatted}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                Method: {solverOutput.method}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
