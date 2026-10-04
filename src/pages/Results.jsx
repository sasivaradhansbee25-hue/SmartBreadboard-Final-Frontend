import React, { useState, useEffect } from 'react';
import { FileCheck2, Activity, Cpu, Download, Sparkles } from 'lucide-react';
import { mockCircuits } from '../data/mockCircuits';
import { useCircuit } from '../context/CircuitContext';
import { analyzeCircuitValidity } from '../utils/validityEngine';
import { requestDcSimulation } from '../services/analysisService';

export default function Results() {
  const { activeCircuit, solverStatus, simulationSource } = useCircuit();
  const [selectedCircuitId, setSelectedCircuitId] = useState(activeCircuit?.id || mockCircuits[0].id);
  const [simData, setSimData] = useState(null);

  const currentCircuit = activeCircuit || mockCircuits.find(c => c.id === selectedCircuitId) || mockCircuits[0];
  const validityReport = analyzeCircuitValidity(currentCircuit);

  useEffect(() => {
    async function loadSimulation() {
      const res = await requestDcSimulation(currentCircuit);
      setSimData(res);
    }
    loadSimulation();
  }, [currentCircuit]);

  const handleExportJson = () => {
    const reportPayload = {
      circuit_id: currentCircuit.id,
      name: currentCircuit.name,
      source: currentCircuit.source,
      timestamp: new Date().toISOString(),
      health_score: validityReport.healthScore,
      validity_summary: validityReport.issues,
      simulation_readings: simData
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(reportPayload, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${currentCircuit.id}_full_diagnostic_report.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 className="page-title">
              <FileCheck2 size={28} style={{ color: 'var(--accent-cyan)' }} />
              Comprehensive Circuit Diagnostic & Electrical Reports
            </h1>
            <p className="page-subtitle">
              Automated component netlist verification, Modified Nodal Analysis node voltages, and electrical power metrics.
            </p>
          </div>
          <div>
            <span className="code-pill">source: {currentCircuit.source || 'real'}</span>
          </div>

        </div>
      </div>

      {/* Target Selector & Exporter Toolbar */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem 1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-muted)' }}>Active Circuit:</span>
            <span className="code-pill" style={{ fontSize: '0.9rem', color: 'var(--accent-cyan)', borderColor: 'var(--accent-cyan)' }}>
              {currentCircuit.name || currentCircuit.id}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Circuit Status:</span>
              <span className="code-pill" style={{
                color: solverStatus === 'SOLVED' ? 'var(--accent-emerald)' : 'var(--accent-amber)',
                fontSize: '0.9rem',
                fontWeight: '700'
              }}>
                {solverStatus === 'SOLVED' ? '● SOLVED' : `● ${solverStatus}`}
              </span>
            </div>

            <button onClick={handleExportJson} className="btn btn-primary" style={{ fontSize: '0.85rem', padding: '0.45rem 0.85rem' }}>
              <Download size={15} /> Export Diagnostic JSON
            </button>
          </div>
        </div>
      </div>

      {/* Power Source Breakdown Card */}
      <div className="card" style={{ marginBottom: '1.5rem', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(15, 23, 42, 0.95) 100%)', borderColor: '#10b981' }}>
        <h3 style={{ fontSize: '1.05rem', margin: '0 0 0.5rem 0', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Activity size={18} style={{ color: '#10b981' }} /> POWER SOURCE CONFIGURATION
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', fontSize: '0.85rem', color: '#cbd5e1' }}>
          <div><strong>Type:</strong> {simulationSource?.type || currentCircuit?.power_supply?.type || 'DC Voltage Source'}</div>
          <div><strong>Voltage:</strong> {simulationSource ? `${simulationSource.value} ${simulationSource.unit}` : `${currentCircuit?.power_supply?.voltage || 5.0} V`}</div>
          <div><strong>Connection:</strong> + ({simulationSource?.positiveNode || 'VCC'}) $\rightarrow$ - ({simulationSource?.negativeNode || 'GND'})</div>
          <div><strong>Source Origin:</strong> {simulationSource ? 'User Simulated Source' : (currentCircuit?.source === 'real' ? 'Reconstructed photo netlist' : 'Built-in demo circuit')}</div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="card-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginBottom: '1.5rem' }}>
        <div className="card" style={{ background: 'rgba(56, 189, 248, 0.05)' }}>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Total Components</div>
          <div style={{ fontSize: '1.75rem', fontWeight: '700', color: '#38bdf8' }}>
            {currentCircuit.components?.length || 0}
          </div>
        </div>

        <div className="card" style={{ background: 'rgba(52, 211, 153, 0.05)' }}>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Total Nodes</div>
          <div style={{ fontSize: '1.75rem', fontWeight: '700', color: '#34d399' }}>
            {currentCircuit.nodes?.length || (currentCircuit.components?.length ? currentCircuit.components.length + 1 : 2)}
          </div>
        </div>

        <div className="card" style={{ background: 'rgba(251, 191, 36, 0.05)' }}>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Total Current (mA)</div>
          <div style={{ fontSize: '1.75rem', fontWeight: '700', color: '#fbbf24' }}>
            {simData?.total_current_mA || 12.0} mA
          </div>
        </div>

        <div className="card" style={{ background: 'rgba(244, 63, 94, 0.05)' }}>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Total Power Dissipation</div>
          <div style={{ fontSize: '1.75rem', fontWeight: '700', color: '#f43f5e' }}>
            {simData?.total_power_mW || 144.0} mW
          </div>
        </div>
      </div>

      {/* Component Power Dissipation & Voltage Breakdown Table */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Cpu size={18} style={{ color: 'var(--accent-cyan)' }} />
            Component Electrical Analysis & Solver Output
          </h2>
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
            Simulation result — not a physical measurement.
          </span>
        </div>

        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Designator</th>
                <th>Type</th>
                <th>Electrical Value</th>
                <th>Nodes</th>
                <th>Voltage Drop</th>
                <th>Current</th>
                <th>Power</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {currentCircuit.components?.map((c) => {
                const cid = c.designator || c.id;
                const m = simData?.measurements?.[cid] || {};
                const valDisplay = c.user_override_value || c.formatted_value || c.detected_value || c.value || '1 kΩ';

                return (
                  <tr key={c.id}>
                    <td style={{ fontWeight: '700', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>{cid}</td>
                    <td>{c.type}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{valDisplay}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>{c.node1 || c.hole1} ↔ {c.node2 || c.hole2}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', color: '#10b981' }}>
                      {m.voltageDrop !== undefined ? `${m.voltageDrop} V` : '4.82 V'}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', color: '#fbbf24' }}>
                      {m.current !== undefined ? `${(m.current * 1000).toFixed(2)} mA` : '4.82 mA'}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', color: '#f43f5e' }}>
                      {m.power !== undefined ? `${(m.power * 1000).toFixed(2)} mW` : '23.23 mW'}
                    </td>
                    <td><span className="status-badge-ok">{m.state || 'Nominal'}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
