import React, { useState, useEffect, useMemo } from 'react';
import { useCircuit } from '../context/CircuitContext';
import {
  extractVerifiedNodes,
  validateSupply,
  SUPPLY_STATUS,
  SIMULATION_STATUS,
  REASON_CODES
} from '../services/supplyConfigurationService';

export default function SupplyConfigurationPanel() {
  const {
    activeCircuit,
    supplyConfiguration,
    configureSupply,
    clearSupply,
    simulateCircuit,
    simulationStatus,
    simulationError,
    simulationResult,
    simulationSignature
  } = useCircuit();

  // Extract verified electrical nodes only — strictly no arbitrary text
  const verifiedNodes = useMemo(() => {
    return extractVerifiedNodes(activeCircuit);
  }, [activeCircuit]);

  const [positiveNode, setPositiveNode] = useState(supplyConfiguration?.positive_node || '');
  const [groundNode, setGroundNode] = useState(supplyConfiguration?.ground_node || '');
  const [voltage, setVoltage] = useState(supplyConfiguration?.voltage !== undefined ? String(supplyConfiguration.voltage) : '5.0');
  const [localFeedback, setLocalFeedback] = useState(null);
  const [isApplying, setIsApplying] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);

  // Sync state if external supplyConfiguration updates
  useEffect(() => {
    if (supplyConfiguration?.positive_node) {
      setPositiveNode(supplyConfiguration.positive_node);
    }
    if (supplyConfiguration?.ground_node) {
      setGroundNode(supplyConfiguration.ground_node);
    }
    if (supplyConfiguration?.voltage !== undefined) {
      setVoltage(String(supplyConfiguration.voltage));
    }
  }, [supplyConfiguration]);

  // Client-side validation preview
  const validationPreview = useMemo(() => {
    if (!positiveNode || !groundNode) {
      return {
        valid: false,
        status: SUPPLY_STATUS.NOT_CONFIGURED,
        reason: REASON_CODES.SUPPLY_REQUIRED,
        message: 'Select positive and ground nodes to configure power supply.'
      };
    }
    return validateSupply(activeCircuit, positiveNode, groundNode, voltage);
  }, [activeCircuit, positiveNode, groundNode, voltage]);

  const currentStatus = supplyConfiguration?.status || validationPreview.status;
  const isSupplyValid = validationPreview.valid;

  const handleApplySupply = async () => {
    setLocalFeedback(null);
    setIsApplying(true);
    try {
      const res = await configureSupply(positiveNode, groundNode, parseFloat(voltage));
      if (res && res.supply && res.supply.status === SUPPLY_STATUS.VALID) {
        setLocalFeedback({ type: 'success', message: `Power supply set: ${parseFloat(voltage).toFixed(2)} V applied.` });
      } else {
        setLocalFeedback({
          type: 'error',
          message: res?.supply?.message || 'Configuration invalid: positive and ground nodes must be distinct verified nodes.'
        });
      }
    } catch (err) {
      setLocalFeedback({ type: 'error', message: err.message || 'Failed to apply power supply.' });
    } finally {
      setIsApplying(false);
    }
  };

  const handleClearSupply = async () => {
    setLocalFeedback(null);
    setPositiveNode('');
    setGroundNode('');
    setVoltage('5.0');
    await clearSupply();
    setLocalFeedback({ type: 'info', message: 'Power supply disconnected. Simulation invalidated.' });
  };

  const handleSimulate = async () => {
    setLocalFeedback(null);
    setIsSimulating(true);
    try {
      const res = await simulateCircuit();
      if (res && res.status === SIMULATION_STATUS.SOLVED) {
        setLocalFeedback({
          type: 'success',
          message: `Simulation solved! Total current: ${(res.results?.total_current_mA || 0).toFixed(2)} mA, Power: ${(res.results?.total_power_mW || 0).toFixed(2)} mW.`
        });
      } else {
        const reasonText = res?.reason || simulationError || 'Simulation blocked';
        setLocalFeedback({
          type: 'error',
          message: `Simulation Blocked: ${reasonText}`
        });
      }
    } catch (err) {
      setLocalFeedback({ type: 'error', message: err.message || 'Simulation execution failed.' });
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div style={{
      background: 'rgba(15, 23, 42, 0.85)',
      backdropFilter: 'blur(12px)',
      border: '1px solid rgba(56, 189, 248, 0.25)',
      borderRadius: '12px',
      padding: '20px',
      color: '#f8fafc',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      maxWidth: '460px',
      margin: '0 auto'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px' }}>⚡</span>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#38bdf8' }}>
            Power Configuration
          </h3>
        </div>
        <span style={{ fontSize: '11px', background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
          Phase 24.2
        </span>
      </div>

      {/* Node selection notice if no nodes available */}
      {verifiedNodes.length === 0 ? (
        <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', padding: '12px', marginBottom: '16px', fontSize: '13px', color: '#fca5a5' }}>
          ⚠️ No verified electrical nodes available. Map and verify a breadboard circuit photo first.
        </div>
      ) : null}

      {/* Positive Supply Node */}
      <div style={{ marginBottom: '14px' }}>
        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>
          Positive Supply (VCC)
        </label>
        <select
          value={positiveNode}
          onChange={(e) => setPositiveNode(e.target.value)}
          disabled={verifiedNodes.length === 0}
          style={{
            width: '100%',
            padding: '10px 12px',
            background: 'rgba(30, 41, 59, 0.9)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            borderRadius: '6px',
            color: '#f8fafc',
            fontSize: '13px',
            outline: 'none',
            cursor: verifiedNodes.length > 0 ? 'pointer' : 'not-allowed'
          }}
        >
          <option value="">-- Select Verified Node ▼ --</option>
          {verifiedNodes.map(nodeId => (
            <option key={`pos-${nodeId}`} value={nodeId}>
              {nodeId} {nodeId === groundNode ? '(Selected as GND)' : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Ground Reference Node */}
      <div style={{ marginBottom: '14px' }}>
        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>
          Ground / Reference (GND)
        </label>
        <select
          value={groundNode}
          onChange={(e) => setGroundNode(e.target.value)}
          disabled={verifiedNodes.length === 0}
          style={{
            width: '100%',
            padding: '10px 12px',
            background: 'rgba(30, 41, 59, 0.9)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            borderRadius: '6px',
            color: '#f8fafc',
            fontSize: '13px',
            outline: 'none',
            cursor: verifiedNodes.length > 0 ? 'pointer' : 'not-allowed'
          }}
        >
          <option value="">-- Select Verified Node ▼ --</option>
          {verifiedNodes.map(nodeId => (
            <option key={`gnd-${nodeId}`} value={nodeId}>
              {nodeId} {nodeId === positiveNode ? '(Selected as VCC)' : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Voltage Input & Presets */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8' }}>
            Supply Voltage
          </label>
          <div style={{ display: 'flex', gap: '4px' }}>
            {[3.3, 5.0, 9.0, 12.0].map(val => (
              <button
                key={`preset-${val}`}
                type="button"
                onClick={() => setVoltage(String(val))}
                style={{
                  background: parseFloat(voltage) === val ? 'rgba(56, 189, 248, 0.3)' : 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '4px',
                  color: parseFloat(voltage) === val ? '#38bdf8' : '#cbd5e1',
                  fontSize: '10px',
                  padding: '2px 6px',
                  cursor: 'pointer'
                }}
              >
                {val}V
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <input
            type="number"
            step="0.1"
            min="0.1"
            max="30.0"
            value={voltage}
            onChange={(e) => setVoltage(e.target.value)}
            style={{
              flex: 1,
              padding: '10px 12px',
              background: 'rgba(30, 41, 59, 0.9)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              borderRadius: '6px 0 0 6px',
              color: '#f8fafc',
              fontSize: '13px',
              outline: 'none'
            }}
          />
          <div style={{
            background: 'rgba(56, 189, 248, 0.15)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            borderLeft: 'none',
            padding: '10px 14px',
            borderRadius: '0 6px 6px 0',
            color: '#38bdf8',
            fontWeight: 700,
            fontSize: '13px'
          }}>
            V
          </div>
        </div>
      </div>

      {/* Action Buttons: Apply & Clear */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '18px' }}>
        <button
          type="button"
          onClick={handleApplySupply}
          disabled={!isSupplyValid || isApplying}
          style={{
            flex: 2,
            padding: '10px 16px',
            background: isSupplyValid ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' : 'rgba(71, 85, 105, 0.4)',
            border: '1px solid rgba(56, 189, 248, 0.4)',
            borderRadius: '6px',
            color: isSupplyValid ? '#ffffff' : '#94a3b8',
            fontSize: '13px',
            fontWeight: 600,
            cursor: isSupplyValid ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s ease',
            boxShadow: isSupplyValid ? '0 4px 12px rgba(2, 132, 199, 0.3)' : 'none'
          }}
        >
          {isApplying ? 'Applying...' : 'Apply Supply'}
        </button>

        <button
          type="button"
          onClick={handleClearSupply}
          style={{
            flex: 1,
            padding: '10px 12px',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '6px',
            color: '#fca5a5',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          Clear
        </button>
      </div>

      {/* Status Card */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.6)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '8px',
        padding: '12px 14px',
        marginBottom: '18px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Supply Status
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: currentStatus === SUPPLY_STATUS.VALID ? '#10b981' : (currentStatus === SUPPLY_STATUS.NOT_CONFIGURED ? '#f59e0b' : '#ef4444'),
              boxShadow: currentStatus === SUPPLY_STATUS.VALID ? '0 0 8px #10b981' : (currentStatus === SUPPLY_STATUS.NOT_CONFIGURED ? '0 0 6px #f59e0b' : '0 0 8px #ef4444')
            }} />
            <span style={{
              fontSize: '12px',
              fontWeight: 700,
              color: isSupplyValid && currentStatus === SUPPLY_STATUS.VALID ? '#10b981' : '#f59e0b'
            }}>
              {isSupplyValid && currentStatus === SUPPLY_STATUS.VALID ? '✓ READY TO SIMULATE' : '⚠ CONFIGURATION REQUIRED'}
            </span>
          </div>
        </div>

        <p style={{ margin: 0, fontSize: '12px', color: '#cbd5e1', lineHeight: '1.4' }}>
          {isSupplyValid && currentStatus === SUPPLY_STATUS.VALID ? `Supply configured: ${parseFloat(voltage || 5).toFixed(1)} V applied between ${positiveNode} and ${groundNode}.` : validationPreview.message}
        </p>
      </div>

      {/* Local Feedback Toast */}
      {localFeedback ? (
        <div style={{
          marginBottom: '16px',
          padding: '10px 12px',
          borderRadius: '6px',
          fontSize: '12px',
          background: localFeedback.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : (localFeedback.type === 'info' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(239, 68, 68, 0.15)'),
          border: `1px solid ${localFeedback.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : (localFeedback.type === 'info' ? 'rgba(56, 189, 248, 0.3)' : 'rgba(239, 68, 68, 0.3)')}`,
          color: localFeedback.type === 'success' ? '#6ee7b7' : (localFeedback.type === 'info' ? '#7dd3fc' : '#fca5a5')
        }}>
          {localFeedback.message}
        </div>
      ) : null}

      {/* Simulate Button */}
      <button
        type="button"
        onClick={handleSimulate}
        disabled={!isSupplyValid || isSimulating || currentStatus !== SUPPLY_STATUS.VALID}
        style={{
          width: '100%',
          padding: '14px',
          background: isSupplyValid && currentStatus === SUPPLY_STATUS.VALID
            ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
            : 'rgba(51, 65, 85, 0.5)',
          border: '1px solid rgba(16, 185, 129, 0.4)',
          borderRadius: '8px',
          color: isSupplyValid && currentStatus === SUPPLY_STATUS.VALID ? '#ffffff' : '#64748b',
          fontSize: '14px',
          fontWeight: 700,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          cursor: isSupplyValid && currentStatus === SUPPLY_STATUS.VALID ? 'pointer' : 'not-allowed',
          boxShadow: isSupplyValid && currentStatus === SUPPLY_STATUS.VALID ? '0 4px 16px rgba(16, 185, 129, 0.35)' : 'none',
          transition: 'all 0.2s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px'
        }}
      >
        {isSimulating ? (
          <>
            <span style={{ animation: 'spin 1s linear infinite' }}>⏳</span>
            <span>RUNNING SIMULATION...</span>
          </>
        ) : simulationStatus === 'SOLVED' ? (
          <>
            <span>✓</span>
            <span>SOLVED (RUN AGAIN)</span>
          </>
        ) : simulationStatus === 'BLOCKED' ? (
          <>
            <span>⚠</span>
            <span>SIMULATION BLOCKED</span>
          </>
        ) : simulationStatus === 'STALE' ? (
          <>
            <span>↻</span>
            <span>SIMULATION STALE (RUN AGAIN)</span>
          </>
        ) : (
          <>
            <span>⚡</span>
            <span>RUN SIMULATION</span>
          </>
        )}
      </button>

      {/* Solved Summary Badge */}
      {simulationStatus === SIMULATION_STATUS.SOLVED && simulationResult ? (
        <div style={{
          marginTop: '16px',
          background: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          borderRadius: '8px',
          padding: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#10b981' }}>
              ✓ SIMULATION SOLVED
            </span>
            <span style={{ fontSize: '10px', color: '#94a3b8' }}>
              Sig: {(simulationSignature || '').substring(0, 10)}...
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', fontSize: '11px', textAlign: 'center' }}>
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '6px', borderRadius: '4px' }}>
              <div style={{ color: '#94a3b8' }}>Voltage</div>
              <div style={{ fontWeight: 700, color: '#38bdf8' }}>{parseFloat(voltage).toFixed(2)} V</div>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '6px', borderRadius: '4px' }}>
              <div style={{ color: '#94a3b8' }}>Current</div>
              <div style={{ fontWeight: 700, color: '#34d399' }}>{(simulationResult.results?.total_current_mA || 0).toFixed(2)} mA</div>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '6px', borderRadius: '4px' }}>
              <div style={{ color: '#94a3b8' }}>Power</div>
              <div style={{ fontWeight: 700, color: '#fbbf24' }}>{(simulationResult.results?.total_power_mW || 0).toFixed(2)} mW</div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Scientific Validation Disclaimer */}
      <div style={{ marginTop: '14px', textAlign: 'center', fontSize: '10px', color: '#64748b' }}>
        Deterministic MNA Solver • Physical Hardware Validation: <strong style={{ color: '#94a3b8' }}>NOT PERFORMED</strong>
      </div>
    </div>
  );
}
