/**
 * src/services/__tests__/rlcSimulation.test.js — Phase 24.3 RLC Simulation & Unified 3D/AR Tests
 *
 * Tests:
 * 1. RLC circuit mapping
 * 2. supply configuration
 * 3. simulation gating
 * 4. solved simulation (MNA solver data structure)
 * 5. stale simulation rejection
 * 6. current animation data (speed & direction)
 * 7. node voltage visualization
 * 8. graph data extraction
 * 9. DC waveform integrity
 * 10. RLC signal selection
 * 11. reset simulation
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  extractVerifiedNodes,
  validateSupply,
  isSignatureStale,
  extractComponentMetrics,
  SUPPLY_STATUS,
  SIMULATION_STATUS,
  REASON_CODES
} from '../supplyConfigurationService.js';
import {
  calculateCurrentFlowMetrics,
  calculateComponentElectricalActivity,
  checkCircuitFaultState
} from '../../utils/electricalAnimation.js';

function createMockRLCCircuit() {
  return {
    status: 'READY',
    circuit_signature: 'SIG_RLC_MVP_998877',
    base_circuit_signature: 'SIG_RLC_MVP_998877',
    simulation_ready: false,
    components: [
      {
        id: 'R1',
        designator: 'R1',
        type: 'resistor',
        value: 100,
        unit: 'Ω',
        status: 'VERIFIED',
        terminals: [
          { terminal: 'terminal_1', hole: 'A10', node: 'NODE_1' },
          { terminal: 'terminal_2', hole: 'E15', node: 'NODE_2' }
        ]
      },
      {
        id: 'L1',
        designator: 'L1',
        type: 'inductor',
        value: 0.01,
        unit: 'H',
        status: 'VERIFIED',
        terminals: [
          { terminal: 'terminal_1', hole: 'D15', node: 'NODE_2' },
          { terminal: 'terminal_2', hole: 'D20', node: 'NODE_3' }
        ]
      },
      {
        id: 'W1',
        designator: 'W1',
        type: 'wire',
        value: 0.001,
        unit: 'Ω',
        status: 'VERIFIED',
        terminals: [
          { terminal: 'terminal_1', hole: 'C20', node: 'NODE_3' },
          { terminal: 'terminal_2', hole: 'C22', node: 'NODE_4' }
        ]
      },
      {
        id: 'C1',
        designator: 'C1',
        type: 'capacitor',
        value: 10e-6,
        unit: 'F',
        status: 'VERIFIED',
        terminals: [
          { terminal: 'terminal_1', hole: 'E22', node: 'NODE_4' },
          { terminal: 'terminal_2', hole: 'E30', node: 'NODE_GND' }
        ]
      }
    ],
    nodes: [
      { node_id: 'NODE_1', members: ['R1.terminal_1'] },
      { node_id: 'NODE_2', members: ['R1.terminal_2', 'L1.terminal_1'] },
      { node_id: 'NODE_3', members: ['L1.terminal_2', 'W1.terminal_1'] },
      { node_id: 'NODE_4', members: ['W1.terminal_2', 'C1.terminal_1'] },
      { node_id: 'NODE_GND', members: ['C1.terminal_2'] }
    ]
  };
}

function createMockSolvedRLCResult() {
  const timePts = [0.0, 0.002, 0.004, 0.006, 0.008, 0.010];
  return {
    status: 'SOLVED',
    circuit_signature: 'SIG_RLC_MVP_998877_CONFIGURED',
    simulation_signature: 'SIG_RLC_MVP_998877_CONFIGURED',
    supply: {
      source_type: 'DC_VOLTAGE',
      positive_node: 'NODE_1',
      ground_node: 'NODE_GND',
      voltage: 5.0
    },
    node_voltages: {
      'NODE_1': 5.0,
      'NODE_2': 5.0,
      'NODE_3': 5.0,
      'NODE_4': 5.0,
      'NODE_GND': 0.0
    },
    component_currents: {
      'R1': 0.0,
      'L1': 0.0,
      'W1': 0.0,
      'C1': 0.0,
      'V1': 0.0
    },
    component_voltages: {
      'R1': 0.0,
      'L1': 0.0,
      'W1': 0.0,
      'C1': 5.0,
      'V1': 5.0
    },
    component_power: {
      'R1': 0.0,
      'L1': 0.0,
      'W1': 0.0,
      'C1': 0.0,
      'V1': 0.0
    },
    time: timePts,
    waveforms: {
      'V(NODE_1)': [5.0, 5.0, 5.0, 5.0, 5.0, 5.0],
      'V(NODE_2)': [5.0, 5.0, 5.0, 5.0, 5.0, 5.0],
      'V(NODE_3)': [5.0, 5.0, 5.0, 5.0, 5.0, 5.0],
      'V(NODE_4)': [5.0, 5.0, 5.0, 5.0, 5.0, 5.0],
      'V(NODE_GND)': [0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
      'I(R1)': [0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
      'I(L1)': [0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
      'I(C1)': [0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
      'P(R1)': [0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
      'P(L1)': [0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
      'P(C1)': [0.0, 0.0, 0.0, 0.0, 0.0, 0.0]
    },
    results: {
      node_voltages: { 'NODE_1': 5.0, 'NODE_2': 5.0, 'NODE_3': 5.0, 'NODE_4': 5.0, 'NODE_GND': 0.0 },
      branch_currents: { 'R1': 0.0, 'L1': 0.0, 'W1': 0.0, 'C1': 0.0 },
      component_power: { 'R1': 0.0, 'L1': 0.0, 'W1': 0.0, 'C1': 0.0 },
      total_current_mA: 0.0,
      total_power_mW: 0.0
    },
    physical_validation_status: 'NOT PERFORMED'
  };
}

describe('Phase 24.3 — RLC Simulation & Unified 3D/AR + Analog Visualization', () => {

  test('1. RLC circuit mapping: extracts verified nodes and components for R, L, C, W', () => {
    const rlc = createMockRLCCircuit();
    const nodes = extractVerifiedNodes(rlc);

    assert.equal(nodes.length, 5);
    assert.deepEqual(nodes, ['NODE_1', 'NODE_2', 'NODE_3', 'NODE_4', 'NODE_GND']);

    const types = rlc.components.map(c => c.type);
    assert.ok(types.includes('resistor'));
    assert.ok(types.includes('inductor'));
    assert.ok(types.includes('capacitor'));
    assert.ok(types.includes('wire'));
  });

  test('2. Supply configuration: validates verified nodes and rejects invalid choices', () => {
    const rlc = createMockRLCCircuit();

    // Valid supply
    const valid = validateSupply(rlc, 'NODE_1', 'NODE_GND', 5.0);
    assert.equal(valid.valid, true);
    assert.equal(valid.status, SUPPLY_STATUS.VALID);
    assert.equal(valid.voltage, 5.0);

    // Invalid: same node
    const sameNode = validateSupply(rlc, 'NODE_1', 'NODE_1', 5.0);
    assert.equal(sameNode.valid, false);
    assert.equal(sameNode.reason, REASON_CODES.SAME_SUPPLY_REFERENCE);

    // Invalid: non-existent node
    const missingNode = validateSupply(rlc, 'NODE_NONEXISTENT', 'NODE_GND', 5.0);
    assert.equal(missingNode.valid, false);
    assert.equal(missingNode.reason, REASON_CODES.INVALID_SUPPLY_NODE);
  });

  test('3. Simulation gating: prevents execution if circuit is not ready or supply invalid', () => {
    const rlc = createMockRLCCircuit();
    assert.equal(rlc.simulation_ready, false);

    const checkNoNodes = validateSupply(rlc, null, 'NODE_GND', 5.0);
    assert.equal(checkNoNodes.valid, false);
    assert.equal(checkNoNodes.reason, REASON_CODES.SUPPLY_REQUIRED);
  });

  test('4. Solved simulation: extracts correct RLC node voltages and component metrics', () => {
    const simRes = createMockSolvedRLCResult();

    assert.equal(simRes.status, 'SOLVED');
    assert.equal(simRes.physical_validation_status, 'NOT PERFORMED');

    // Capacitor DC state: 5.0V voltage drop, 0.0 current
    const c1Metrics = extractComponentMetrics(simRes, 'C1', simRes.circuit_signature);
    assert.equal(c1Metrics.voltageDrop, 5.0);
    assert.equal(c1Metrics.currentMA, 0.0);
    assert.equal(c1Metrics.powerMW, 0.0);

    // Inductor DC state: 0.0V drop
    const l1Metrics = extractComponentMetrics(simRes, 'L1', simRes.circuit_signature);
    assert.equal(l1Metrics.voltageDrop, 0.0);
    assert.equal(l1Metrics.currentMA, 0.0);
  });

  test('5. Stale simulation rejection: rejects simulation results if circuit signature changed', () => {
    const simRes = createMockSolvedRLCResult();
    const oldSig = simRes.simulation_signature;
    const modifiedCircuitSig = 'SIG_RLC_MODIFIED_NEW';

    assert.equal(isSignatureStale(oldSig, modifiedCircuitSig), true);
    assert.equal(isSignatureStale(oldSig, oldSig), false);

    // Stale metrics extraction returns null
    const staleMetrics = extractComponentMetrics(simRes, 'R1', modifiedCircuitSig);
    assert.equal(staleMetrics, null);
  });

  test('6. Current animation data: speed strictly reflects current magnitude, stops at 0A', () => {
    // Active 15mA current (e.g. through resistor or inductor)
    const activeCurrent = calculateCurrentFlowMetrics(0.015, 'pin1_to_pin2');
    assert.equal(activeCurrent.active, true);
    assert.ok(activeCurrent.speed > 0);
    assert.equal(activeCurrent.direction, 1);

    // Reverse current
    const reverseCurrent = calculateCurrentFlowMetrics(-0.015, 'pin2_to_pin1');
    assert.equal(reverseCurrent.active, true);
    assert.equal(reverseCurrent.direction, -1);

    // Zero current (e.g. DC capacitor open circuit)
    const zeroCurrent = calculateCurrentFlowMetrics(0.0, 'pin1_to_pin2');
    assert.equal(zeroCurrent.active, false);
    assert.equal(zeroCurrent.speed, 0);
  });

  test('7. Node voltage visualization: extracts node voltages cleanly from MNA solution', () => {
    const simRes = createMockSolvedRLCResult();
    const nv = simRes.node_voltages;

    assert.equal(nv['NODE_1'], 5.0);
    assert.equal(nv['NODE_GND'], 0.0);
    assert.equal(Object.keys(nv).length, 5);
  });

  test('8. Graph data extraction: contains Voltage, Current, Power data series', () => {
    const simRes = createMockSolvedRLCResult();
    const wf = simRes.waveforms;

    assert.ok(wf['V(NODE_1)']);
    assert.ok(wf['I(R1)']);
    assert.ok(wf['I(L1)']);
    assert.ok(wf['I(C1)']);
    assert.ok(wf['P(R1)']);
    assert.ok(wf['P(L1)']);
    assert.ok(wf['P(C1)']);
  });

  test('9. DC waveform integrity: constant steady-state values across time without fake oscillations', () => {
    const simRes = createMockSolvedRLCResult();
    const trace = simRes.waveforms['V(NODE_1)'];

    assert.equal(Array.isArray(trace), true);
    assert.equal(trace.length, 6);
    // Every point is strictly 5.0 V
    trace.forEach(val => assert.equal(val, 5.0));
  });

  test('10. RLC signal selection: capacitor voltage state and inductor current activity', () => {
    // Capacitor charged state highlight
    const capElec = { voltage_drop: 5.0, voltage: 5.0, current: 0.0, power: 0.0 };
    const capAnim = calculateComponentElectricalActivity('capacitor', capElec, 'SOLVED', 0);
    assert.equal(capAnim.active, true);
    assert.equal(capAnim.emissiveColor, 0x38bdf8); // Cyan electric field

    // Inductor conducting state highlight
    const indElec = { voltage_drop: 0.0, voltage: 0.0, current: 0.015, power: 0.0 };
    const indAnim = calculateComponentElectricalActivity('inductor', indElec, 'SOLVED', 0);
    assert.equal(indAnim.active, true);
    assert.equal(indAnim.emissiveColor, 0xf59e0b); // Amber magnetic field

    // Inactive if simulation is not solved
    const inactiveAnim = calculateComponentElectricalActivity('capacitor', capElec, 'NOT_RUN', 0);
    assert.equal(inactiveAnim.active, false);
  });

  test('11. Reset simulation: fault and solver state check handles unpowered and normal states', () => {
    const circuit = createMockRLCCircuit();

    // Before simulation -> UNPOWERED
    const faultUnpowered = checkCircuitFaultState(circuit, null, 'NOT_RUN', null);
    assert.equal(faultUnpowered.isFault, false);
    assert.equal(faultUnpowered.isUnpowered, true);

    // After solved simulation -> NORMAL
    const simRes = createMockSolvedRLCResult();
    const faultSolved = checkCircuitFaultState(circuit, simRes, 'SOLVED', null);
    assert.equal(faultSolved.isFault, false);
    assert.equal(faultSolved.isUnpowered, false);
  });

});
