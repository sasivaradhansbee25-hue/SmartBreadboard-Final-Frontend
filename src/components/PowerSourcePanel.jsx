import React, { useState } from 'react';
import { useCircuit } from '../context/CircuitContext';
import { Zap, CheckCircle2, Sliders, ShieldAlert } from 'lucide-react';

export default function PowerSourcePanel() {
  const { activeCircuit, simulationSource, applySimulationPower, resetSimulationPower, solverStatus, solverError } = useCircuit();

  // Extract available nodes/holes from active circuit
  const availableNodes = [];
  if (activeCircuit?.components) {
    activeCircuit.components.forEach(c => {
      if (c.node1 || c.hole1) availableNodes.push({ id: c.node1 || c.hole1, label: `${c.designator || c.id} Pin A (${c.hole1 || c.node1})` });
      if (c.node2 || c.hole2) availableNodes.push({ id: c.node2 || c.hole2, label: `${c.designator || c.id} Pin B (${c.hole2 || c.node2})` });
    });
  }

  // Automatic suggestions (Section 6)
  const suggestedPos = availableNodes.find(n => n.id.includes('PWR') || n.id.includes('VCC') || n.id.includes('25'))?.id || availableNodes[0]?.id || 'NODE_COL_25_TOP';
  const suggestedNeg = availableNodes.find(n => n.id.includes('GND') || n.id.includes('29'))?.id || availableNodes[1]?.id || 'NODE_COL_29_TOP';

  const [voltage, setVoltage] = useState('12.0');
  const [unit, setUnit] = useState('V');
  const [srcType, setSrcType] = useState('dc_voltage');
  const [posNode, setPosNode] = useState(suggestedPos);
  const [negNode, setNegNode] = useState(suggestedNeg);
  const [isEditing, setIsEditing] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    applySimulationPower({
      type: srcType,
      voltage: parseFloat(voltage),
      unit,
      positiveNode: posNode,
      negativeNode: negNode
    });
    setIsEditing(false);
  };

  // Render compact summary if power is applied and not editing
  if (simulationSource && !isEditing) {
    return (
      <div style={{
        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(15, 23, 42, 0.95) 100%)',
        border: '1px solid #10b981',
        borderRadius: '10px',
        padding: '0.85rem 1.25rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        margin: '1rem 0'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Zap size={20} style={{ color: '#10b981' }} />
          <div>
            <div style={{ fontSize: '0.95rem', fontWeight: '700', color: '#f8fafc' }}>
              ⚡ {simulationSource.value} {simulationSource.unit} SIMULATED POWER SOURCE ACTIVE
            </div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              Connections: <span style={{ color: '#ef4444', fontWeight: '600' }}>+ ({simulationSource.positiveNode})</span> $\rightarrow$ <span style={{ color: '#3b82f6', fontWeight: '600' }}>- ({simulationSource.negativeNode})</span> | Source condition: User-supplied simulated source
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => setIsEditing(true)}
            className="btn btn-secondary"
            style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
          >
            ✏ EDIT SOURCE
          </button>
          <button
            onClick={resetSimulationPower}
            style={{
              background: '#334155',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              padding: '0.35rem 0.75rem',
              fontSize: '0.8rem',
              cursor: 'pointer'
            }}
          >
            REMOVE SOURCE
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      border: '1px solid #38bdf8',
      borderRadius: '12px',
      padding: '1.25rem 1.5rem',
      margin: '1rem 0',
      boxShadow: '0 8px 20px rgba(0,0,0,0.4)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #334155', pb: '0.75rem' }}>
        <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Zap size={20} style={{ color: '#38bdf8' }} />
          ⚡ SIMULATION POWER SOURCE CONFIGURATION
        </h3>
        <span className="code-pill" style={{ color: '#38bdf8', borderColor: '#38bdf8' }}>
          Source: User Simulated
        </span>
      </div>

      <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: 0, marginBottom: '1rem' }}>
        No active power source was detected in this photograph. Add a simulated voltage source for electrical analysis.
      </p>

      {/* Suggested Connection Banner */}
      <div style={{
        background: 'rgba(56, 189, 248, 0.1)',
        border: '1px solid rgba(56, 189, 248, 0.3)',
        borderRadius: '6px',
        padding: '0.6rem 0.85rem',
        fontSize: '0.8rem',
        color: '#cbd5e1',
        marginBottom: '1rem',
        display: 'flex',
        justify: 'space-between',
        alignItems: 'center'
      }}>
        <span>
          <strong>Suggested Connection:</strong> <span style={{ color: '#ef4444' }}>+ $\rightarrow$ {suggestedPos}</span> | <span style={{ color: '#3b82f6' }}>- $\rightarrow$ {suggestedNeg}</span>
        </span>
        <button
          type="button"
          onClick={() => { setPosNode(suggestedPos); setNegNode(suggestedNeg); }}
          style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', padding: '0.25rem 0.5rem', cursor: 'pointer', fontSize: '0.75rem' }}
        >
          [ ACCEPT ]
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          {/* Voltage & Unit */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '0.35rem' }}>Voltage</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="number"
                step="any"
                value={voltage}
                onChange={(e) => setVoltage(e.target.value)}
                required
                style={{ flex: 1, background: '#0f172a', border: '1px solid #334155', color: '#fff', padding: '0.5rem', borderRadius: '6px', fontSize: '0.95rem' }}
              />
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                style={{ background: '#0f172a', border: '1px solid #334155', color: '#fff', padding: '0.5rem', borderRadius: '6px', fontSize: '0.95rem' }}
              >
                <option value="V">V</option>
                <option value="mV">mV</option>
              </select>
            </div>
          </div>

          {/* Source Type */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '0.35rem' }}>Source Type</label>
            <div style={{ display: 'flex', gap: '1rem', paddingTop: '0.4rem', fontSize: '0.85rem', color: '#f8fafc' }}>
              <label style={{ cursor: 'pointer' }}>
                <input type="radio" name="srcType" value="dc_voltage" checked={srcType === 'dc_voltage'} onChange={() => setSrcType('dc_voltage')} /> DC Voltage Source
              </label>
              <label style={{ cursor: 'pointer' }}>
                <input type="radio" name="srcType" value="battery" checked={srcType === 'battery'} onChange={() => setSrcType('battery')} /> Battery
              </label>
            </div>
          </div>

          {/* Positive Node */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#ef4444', fontWeight: '600', marginBottom: '0.35rem' }}>🔴 Positive Terminal (+)</label>
            <select
              value={posNode}
              onChange={(e) => setPosNode(e.target.value)}
              style={{ width: '100%', background: '#0f172a', border: '1px solid #ef4444', color: '#fff', padding: '0.5rem', borderRadius: '6px', fontSize: '0.9rem' }}
            >
              {availableNodes.map((n, idx) => (
                <option key={`pos-${idx}`} value={n.id}>{n.label}</option>
              ))}
              <option value="NODE_PWR">VCC (+5V Power Rail)</option>
              <option value="NODE_COL_25_TOP">Node C25 (Pin A)</option>
            </select>
          </div>

          {/* Negative Node / Ground */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#3b82f6', fontWeight: '600', marginBottom: '0.35rem' }}>⚫ Negative / Ground (−)</label>
            <select
              value={negNode}
              onChange={(e) => setNegNode(e.target.value)}
              style={{ width: '100%', background: '#0f172a', border: '1px solid #3b82f6', color: '#fff', padding: '0.5rem', borderRadius: '6px', fontSize: '0.9rem' }}
            >
              {availableNodes.map((n, idx) => (
                <option key={`neg-${idx}`} value={n.id}>{n.label}</option>
              ))}
              <option value="NODE_GND">GND (0V Ground Rail)</option>
              <option value="NODE_COL_29_TOP">Node C29 (Pin B)</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
            Simulated power source — user supplied. Simulation result — not a physical measurement.
          </span>
          <button
            type="submit"
            style={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              padding: '0.6rem 1.5rem',
              fontWeight: '700',
              cursor: 'pointer',
              fontSize: '0.9rem',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
            }}
          >
            ⚡ APPLY POWER & SOLVE
          </button>
        </div>
      </form>
    </div>
  );
}
