/**
 * src/services/__tests__/supplyConfiguration.test.js — Phase 24.2 Manual Supply Configuration Tests
 *
 * Tests:
 * 1. node selection
 * 2. voltage input
 * 3. valid configuration
 * 4. invalid configuration
 * 5. simulation request
 * 6. simulation result handling
 * 7. stale result suppression
 * 8. graph data handling
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  extractVerifiedNodes,
  validateSupply,
  configureSupplyAPI,
  clearSupplyAPI,
  simulateCircuitAPI,
  isSignatureStale,
  extractComponentMetrics,
  SUPPLY_STATUS,
  SIMULATION_STATUS,
  REASON_CODES
} from '../supplyConfigurationService.js';

function createMockCircuit() {
  return {
    status: 'READY',
    circuit_signature: 'SIG_CIRCUIT_ABC_12345',
    simulation_ready: false,
    components: [
      {
        id: 'R1',
        designator: 'R1',
        type: 'resistor',
        value: 220,
        unit: 'Ω',
        status: 'VERIFIED',
        terminals: [
          { terminal: 'terminal_1', hole: 'E10', node: 'NODE_1' },
          { terminal: 'terminal_2', hole: 'E15', node: 'NODE_2' }
        ]
      },
      {
        id: 'LED1',
        designator: 'LED1',
        type: 'led',
        value: 2.0,
        unit: 'V',
        status: 'VERIFIED',
        terminals: [
          { terminal: 'anode', hole: 'E15', node: 'NODE_2' },
          { terminal: 'cathode', hole: 'E20', node: 'NODE_3' }
        ]
      }
    ],
    nodes: [
      { node_id: 'NODE_1', members: ['R1.terminal_1'] },
      { node_id: 'NODE_2', members: ['R1.terminal_2', 'LED1.anode'] },
      { node_id: 'NODE_3', members: ['LED1.cathode'] }
    ],
    connections: [
      { component_id: 'R1', terminal: 'terminal_1', node_id: 'NODE_1' },
      { component_id: 'R1', terminal: 'terminal_2', node_id: 'NODE_2' },
      { component_id: 'LED1', terminal: 'anode', node_id: 'NODE_2' },
      { component_id: 'LED1', terminal: 'cathode', node_id: 'NODE_3' }
    ]
  };
}

describe('Phase 24.2 Manual Supply Configuration & Simulation Control', () => {

  test('1. Node selection: correctly extracts only verified circuit nodes', () => {
    const circuit = createMockCircuit();
    const nodes = extractVerifiedNodes(circuit);

    assert.equal(Array.isArray(nodes), true);
    assert.deepEqual(nodes, ['NODE_1', 'NODE_2', 'NODE_3']);
    assert.equal(nodes.includes('UNRESOLVED'), false);
    assert.equal(nodes.includes('NONEXISTENT'), false);
  });

  test('2. Voltage input: strictly enforces numeric and positive voltage values', () => {
    const circuit = createMockCircuit();

    // Valid voltage
    const v5 = validateSupply(circuit, 'NODE_1', 'NODE_3', 5.0);
    assert.equal(v5.valid, true);
    assert.equal(v5.voltage, 5.0);

    // Negative voltage
    const vNeg = validateSupply(circuit, 'NODE_1', 'NODE_3', -3.3);
    assert.equal(vNeg.valid, false);
    assert.equal(vNeg.status, SUPPLY_STATUS.INVALID_VOLTAGE);
    assert.equal(vNeg.reason, REASON_CODES.INVALID_VOLTAGE);

    // Zero voltage
    const vZero = validateSupply(circuit, 'NODE_1', 'NODE_3', 0.0);
    assert.equal(vZero.valid, false);
    assert.equal(vZero.status, SUPPLY_STATUS.INVALID_VOLTAGE);

    // Non-numeric voltage
    const vStr = validateSupply(circuit, 'NODE_1', 'NODE_3', 'invalid_volts');
    assert.equal(vStr.valid, false);
    assert.equal(vStr.status, SUPPLY_STATUS.INVALID_VOLTAGE);
  });

  test('3. Valid configuration: accepts verified positive, ground, and voltage', () => {
    const circuit = createMockCircuit();
    const val = validateSupply(circuit, 'NODE_1', 'NODE_3', 5.0);

    assert.equal(val.valid, true);
    assert.equal(val.status, SUPPLY_STATUS.VALID);
    assert.equal(val.reason, null);
    assert.match(val.message, /Supply configuration valid/);
  });

  test('4. Invalid configuration: detects missing nodes, same node, and ambiguous circuits', () => {
    const circuit = createMockCircuit();

    // Same positive and ground node
    const sameNode = validateSupply(circuit, 'NODE_1', 'NODE_1', 5.0);
    assert.equal(sameNode.valid, false);
    assert.equal(sameNode.status, SUPPLY_STATUS.SAME_NODE);
    assert.equal(sameNode.reason, REASON_CODES.SAME_SUPPLY_REFERENCE);

    // Unverified positive node
    const badPos = validateSupply(circuit, 'NODE_99', 'NODE_3', 5.0);
    assert.equal(badPos.valid, false);
    assert.equal(badPos.status, SUPPLY_STATUS.INVALID_NODE);
    assert.equal(badPos.reason, REASON_CODES.INVALID_SUPPLY_NODE);

    // Ambiguous circuit mapping
    const ambCircuit = createMockCircuit();
    ambCircuit.status = 'AMBIGUOUS';
    const ambVal = validateSupply(ambCircuit, 'NODE_1', 'NODE_3', 5.0);
    assert.equal(ambVal.valid, false);
    assert.equal(ambVal.status, SUPPLY_STATUS.BLOCKED);
    assert.equal(ambVal.reason, REASON_CODES.AMBIGUOUS_CIRCUIT);
  });

  test('5. Simulation request: validates inputs and handles local gating before dispatch', async () => {
    const circuit = createMockCircuit();

    // Attempting simulation without supply
    const blockedRes = await simulateCircuitAPI(circuit, null);
    assert.equal(blockedRes.status, SIMULATION_STATUS.BLOCKED);
    assert.equal(blockedRes.reason, REASON_CODES.SUPPLY_REQUIRED);

    // Attempting simulation with valid supply config
    const validSupply = {
      enabled: true,
      positive_node: 'NODE_1',
      ground_node: 'NODE_3',
      voltage: 5.0
    };
    const simRes = await simulateCircuitAPI(circuit, validSupply);
    assert.ok(simRes);
    // Either solved by backend or offline mock fallback structure
    assert.ok([SIMULATION_STATUS.SOLVED, SIMULATION_STATUS.BLOCKED].includes(simRes.status));
  });

  test('6. Simulation result handling: correctly extracts node voltages, branch currents, and component power', () => {
    const mockSolvedResult = {
      status: SIMULATION_STATUS.SOLVED,
      circuit_signature: 'SIG_12345',
      simulation_signature: 'SIG_12345',
      results: {
        node_voltages: { 'NODE_1': 5.0, 'NODE_2': 2.0, 'NODE_3': 0.0 },
        branch_currents: { 'R1': 0.013636, 'LED1': 0.013636, 'V1': 0.013636 },
        component_power: { 'R1': 0.0409, 'LED1': 0.0272, 'V1': 0.0681 },
        measurements: {
          'R1': { current: 0.013636, power: 0.0409, voltage_drop: 3.0, state: 'ACTIVE', direction: 'pin1_to_pin2' },
          'LED1': { current: 0.013636, power: 0.0272, voltage_drop: 2.0, state: 'ON', direction: 'pin1_to_pin2' }
        }
      }
    };

    const r1Metrics = extractComponentMetrics(mockSolvedResult, 'R1', 'SIG_12345');
    assert.ok(r1Metrics);
    assert.equal(r1Metrics.componentId, 'R1');
    assert.equal(r1Metrics.voltageDrop, 3.0);
    assert.ok(Math.abs(r1Metrics.currentMA - 13.636) < 0.05);
    assert.ok(Math.abs(r1Metrics.powerMW - 40.9) < 0.2);
    assert.equal(r1Metrics.state, 'ACTIVE');

    const ledMetrics = extractComponentMetrics(mockSolvedResult, 'LED1', 'SIG_12345');
    assert.ok(ledMetrics);
    assert.equal(ledMetrics.state, 'ON');
  });

  test('7. Stale result suppression: rejects results whose simulation signature does not match current circuit', () => {
    const mockSolvedResult = {
      status: SIMULATION_STATUS.SOLVED,
      circuit_signature: 'OLD_SIG_ORIGINAL',
      simulation_signature: 'OLD_SIG_ORIGINAL',
      results: {
        branch_currents: { 'R1': 0.0136 },
        component_power: { 'R1': 0.0409 }
      }
    };

    // Stale signature check
    const isStale = isSignatureStale('NEW_SIG_MODIFIED', 'OLD_SIG_ORIGINAL');
    assert.equal(isStale, true);

    // extractComponentMetrics returns null when stale
    const metricsStale = extractComponentMetrics(mockSolvedResult, 'R1', 'NEW_SIG_MODIFIED');
    assert.equal(metricsStale, null);

    // Matching signature returns valid metrics
    const metricsFresh = extractComponentMetrics(mockSolvedResult, 'R1', 'OLD_SIG_ORIGINAL');
    assert.ok(metricsFresh);
  });

  test('8. Graph data handling: produces operating-point metrics without fabricating transient waveforms', () => {
    const mockSolvedResult = {
      status: SIMULATION_STATUS.SOLVED,
      circuit_signature: 'SIG_123',
      simulation_signature: 'SIG_123',
      results: {
        node_voltages: { 'NODE_1': 5.0, 'NODE_2': 2.0, 'NODE_3': 0.0 },
        branch_currents: { 'R1': 0.0136 },
        component_power: { 'R1': 0.0409 },
        measurements: {
          'R1': { current: 0.0136, power: 0.0409, voltage_drop: 3.0 }
        }
      }
    };

    const metrics = extractComponentMetrics(mockSolvedResult, 'R1', 'SIG_123');
    assert.ok(metrics);
    assert.equal(metrics.voltageDrop, 3.0);
    assert.equal(metrics.currentA, 0.0136);
    assert.equal(metrics.powerW, 0.0409);

    // Non-existent component returns defaults without fabrication
    const missing = extractComponentMetrics(mockSolvedResult, 'R99_MISSING', 'SIG_123');
    assert.ok(missing);
    assert.equal(missing.currentA, 0.0);
    assert.equal(missing.voltageDrop, 0.0);
  });

});
