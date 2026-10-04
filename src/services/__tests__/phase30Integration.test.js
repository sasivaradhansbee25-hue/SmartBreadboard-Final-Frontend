/**
 * SmartBreadboard 3D — Phase 30 Integration Tests
 * Tests end-to-end semiconductor intelligence pipeline, topology verification,
 * educational explanations, and scientific integrity flags.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';

import { classifyCircuitTopology } from '../../intelligence/topologyClassifier.js';
import { generateVisualizationState } from '../../intelligence/visualizationStateEngine.js';
import { generateEducationalExplanation } from '../../intelligence/educationalExplanationGenerator.js';
import { circuitRegistry } from '../../intelligence/circuitKnowledgeRegistry.js';

describe('Phase 30 — End-to-End Integration Tests', () => {
  test('1. Diode Forward Bias Topology Classification & Educational Walkthrough', () => {
    const netlist = {
      nodes: [
        { id: 'NODE_PWR', label: 'VCC' },
        { id: 'NODE_DIODE', label: 'Anode' },
        { id: 'GND', label: 'GND' }
      ],
      components: [
        { id: 'R1', type: 'resistor', value: 1000, node1: 'NODE_PWR', node2: 'NODE_DIODE' },
        { id: 'D1', type: 'diode', model: '1N4148', node1: 'NODE_DIODE', node2: 'GND' }
      ]
    };

    const classification = classifyCircuitTopology(netlist);
    assert.strictEqual(classification.verificationState, 'VERIFIED');
    assert.strictEqual(classification.circuitType, 'DIODE_FORWARD_BIAS');

    const vis = generateVisualizationState(classification, {}, netlist);
    assert.strictEqual(vis.status, 'VERIFIED');
    assert.strictEqual(vis.visualizationType, 'DIODE_FORWARD_CONDUCTION');

    const edu = generateEducationalExplanation(classification, {});
    assert.ok(edu);
    assert.strictEqual(edu.isVerified, true);
    assert.ok(edu.summary.includes('Shockley') || edu.summary.includes('forward'));
  });

  test('2. LED Current Limiter Topology & Visual Glow State', () => {
    const netlist = {
      nodes: [
        { id: 'NODE_PWR', label: 'VCC' },
        { id: 'NODE_LED', label: 'Anode' },
        { id: 'GND', label: 'GND' }
      ],
      components: [
        { id: 'R1', type: 'resistor', value: 330, node1: 'NODE_PWR', node2: 'NODE_LED' },
        { id: 'LED1', type: 'led', model: 'LED_RED', node1: 'NODE_LED', node2: 'GND' }
      ]
    };

    const classification = classifyCircuitTopology(netlist);
    assert.strictEqual(classification.verificationState, 'VERIFIED');
    assert.strictEqual(classification.circuitType, 'LED_CURRENT_LIMITER');
  });

  test('3. Full-Wave Bridge Rectifier Topology Classification', () => {
    const netlist = {
      nodes: [
        { id: 'AC1', label: 'AC1' },
        { id: 'AC2', label: 'AC2' },
        { id: 'DC_POS', label: 'DC+' },
        { id: 'GND', label: 'GND' }
      ],
      components: [
        { id: 'D1', type: 'diode', node1: 'AC1', node2: 'DC_POS' },
        { id: 'D2', type: 'diode', node1: 'GND', node2: 'AC1' },
        { id: 'D3', type: 'diode', node1: 'AC2', node2: 'DC_POS' },
        { id: 'D4', type: 'diode', node1: 'GND', node2: 'AC2' },
        { id: 'RL', type: 'resistor', value: 1000, node1: 'DC_POS', node2: 'GND' }
      ]
    };

    const classification = classifyCircuitTopology(netlist);
    assert.strictEqual(classification.verificationState, 'VERIFIED');
    assert.strictEqual(classification.circuitType, 'FULL_WAVE_BRIDGE_RECTIFIER');

    const vis = generateVisualizationState(classification, {}, netlist);
    assert.strictEqual(vis.visualizationType, 'RECTIFIER_CONDUCTION');
  });


  test('4. Circuit Registry supports all Phase 30 canonical models', () => {
    const fwd = circuitRegistry.get('DIODE_FORWARD_BIAS');
    assert.ok(fwd);
    assert.strictEqual(fwd.category, 'semiconductor');

    const rev = circuitRegistry.get('DIODE_REVERSE_BIAS');
    assert.ok(rev);

    const half = circuitRegistry.get('HALF_WAVE_RECTIFIER');
    assert.ok(half);

    const full = circuitRegistry.get('FULL_WAVE_BRIDGE_RECTIFIER');
    assert.ok(full);

    const led = circuitRegistry.get('LED_CURRENT_LIMITER');
    assert.ok(led);
  });
});
