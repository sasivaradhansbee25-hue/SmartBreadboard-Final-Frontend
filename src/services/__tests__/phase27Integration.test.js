/**
 * SmartBreadboard 3D — Generalized AC Circuit Intelligence Unit Tests (Phase 27)
 *
 * Automated verification suite:
 * 1. Transfer function extraction H(jω) = Vout / Vin, magnitude, dB, phase.
 * 2. RC Low-Pass Filter (R=1kΩ, C=100nF -> theoretical fc ≈ 1.5915 kHz).
 * 3. RC High-Pass Filter (C=100nF, R=1kΩ -> theoretical fc ≈ 1.5915 kHz).
 * 4. RL Low-Pass Filter (L=100mH, R=1kΩ -> theoretical fc ≈ 1.5915 kHz).
 * 5. RL High-Pass Filter (R=1kΩ, L=100mH -> theoretical fc ≈ 1.5915 kHz).
 * 6. RLC Band-Pass Filter (L=10mH, C=100µF, R=100Ω -> f0 ≈ 159.15 Hz).
 * 7. Frequency-Independent Resistive divider (flat -6.02 dB, 0° phase).
 * 8. Cutoff frequency detection (-3dB threshold) & response shape analysis.
 * 9. CircuitKnowledgeRegistry contains RC/RL/RLC filter definitions.
 * 10. TopologyClassifier accurately classifies filter architectures.
 * 11. Educational explanations are generated accurately.
 * 12. VisualizationStateEngine configures AC filter overlay modes.
 * 13. Scientific integrity guards: source = 'mna_simulation', is_measured = false.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  extractClientTransferResponse,
  analyzeClientResponseShape,
  detectClientCutoffFrequencies,
  analyzeClientGeneralizedAcCircuit,
  runClientFrequencySweep
} from '../../intelligence/acAnalysisEngine.js';

import { circuitRegistry, VISUALIZATION_TYPES } from '../../intelligence/circuitKnowledgeRegistry.js';
import { classifyCircuitTopology } from '../../intelligence/topologyClassifier.js';
import { calculateCircuitBehaviour } from '../../intelligence/electricalBehaviourModel.js';
import { generateEducationalExplanation } from '../../intelligence/educationalExplanationGenerator.js';
import { generateVisualizationState } from '../../intelligence/visualizationStateEngine.js';
import { requestAcAnalysis } from '../acAnalysisService.js';


describe('Phase 27: Generalized AC Circuit Intelligence & Filter Analysis', () => {

  // Test 1: RC Low-Pass Filter Benchmark
  test('1. RC Low-Pass benchmark (R=1kΩ, C=100nF) detects Low-Pass behavior and cutoff near 1.5915 kHz', async () => {
    const netlist = {
      components: [
        { id: 'R1', type: 'resistor', value: 1000, node1: 'VIN', node2: 'VOUT' },
        { id: 'C1', type: 'capacitor', value: 100e-9, node1: 'VOUT', node2: 'GND' }
      ]
    };

    const res = await requestAcAnalysis(netlist, {
      startFrequency: 10.0,
      stopFrequency: 100000.0,
      points: 80,
      inputNode: 'VIN',
      outputNode: 'VOUT'
    });

    assert.equal(res.status, 'success');
    assert.equal(res.behavior, 'LOW_PASS');
    assert.equal(res.cutoff.status, 'DETERMINED');
    assert.equal(res.cutoff.filterMode, 'LOW_PASS');

    // Expected theoretical fc = 1 / (2*pi*1000*100e-9) ≈ 1591.55 Hz
    assert.ok(Math.abs(res.cutoff.fcHz - 1591.55) < 200.0);
    assert.equal(res.source, 'mna_simulation');
    assert.equal(res.is_measured, false);
  });

  // Test 2: RC High-Pass Filter Benchmark
  test('2. RC High-Pass benchmark (C=100nF, R=1kΩ) detects High-Pass behavior and cutoff near 1.5915 kHz', async () => {
    const netlist = {
      components: [
        { id: 'C1', type: 'capacitor', value: 100e-9, node1: 'VIN', node2: 'VOUT' },
        { id: 'R1', type: 'resistor', value: 1000, node1: 'VOUT', node2: 'GND' }
      ]
    };

    const res = await requestAcAnalysis(netlist, {
      startFrequency: 10.0,
      stopFrequency: 100000.0,
      points: 80,
      inputNode: 'VIN',
      outputNode: 'VOUT'
    });

    assert.equal(res.status, 'success');
    assert.equal(res.behavior, 'HIGH_PASS');
    assert.equal(res.cutoff.status, 'DETERMINED');
    assert.equal(res.cutoff.filterMode, 'HIGH_PASS');
    assert.ok(Math.abs(res.cutoff.fcHz - 1591.55) < 200.0);
  });

  // Test 3: RL Low-Pass Filter Benchmark
  test('3. RL Low-Pass benchmark (L=100mH, R=1kΩ) detects Low-Pass behavior and cutoff near 1.5915 kHz', async () => {
    const netlist = {
      components: [
        { id: 'L1', type: 'inductor', value: 0.1, node1: 'VIN', node2: 'VOUT' },
        { id: 'R1', type: 'resistor', value: 1000, node1: 'VOUT', node2: 'GND' }
      ]
    };

    const res = await requestAcAnalysis(netlist, {
      startFrequency: 10.0,
      stopFrequency: 100000.0,
      points: 80,
      inputNode: 'VIN',
      outputNode: 'VOUT'
    });

    assert.equal(res.status, 'success');
    assert.equal(res.behavior, 'LOW_PASS');
    assert.equal(res.cutoff.status, 'DETERMINED');
    assert.ok(Math.abs(res.cutoff.fcHz - 1591.55) < 200.0);
  });

  // Test 4: RL High-Pass Filter Benchmark
  test('4. RL High-Pass benchmark (R=1kΩ, L=100mH) detects High-Pass behavior and cutoff near 1.5915 kHz', async () => {
    const netlist = {
      components: [
        { id: 'R1', type: 'resistor', value: 1000, node1: 'VIN', node2: 'VOUT' },
        { id: 'L1', type: 'inductor', value: 0.1, node1: 'VOUT', node2: 'GND' }
      ]
    };

    const res = await requestAcAnalysis(netlist, {
      startFrequency: 10.0,
      stopFrequency: 100000.0,
      points: 80,
      inputNode: 'VIN',
      outputNode: 'VOUT'
    });

    assert.equal(res.status, 'success');
    assert.equal(res.behavior, 'HIGH_PASS');
    assert.equal(res.cutoff.status, 'DETERMINED');
    assert.ok(Math.abs(res.cutoff.fcHz - 1591.55) < 200.0);
  });

  // Test 5: RLC Band-Pass Filter
  test('5. RLC Band-Pass filter detects peaked band-pass behavior near 159.15 Hz', async () => {
    const netlist = {
      components: [
        { id: 'L1', type: 'inductor', value: 0.010, node1: 'VIN', node2: 'N2' },
        { id: 'C1', type: 'capacitor', value: 100e-6, node1: 'N2', node2: 'VOUT' },
        { id: 'R1', type: 'resistor', value: 100, node1: 'VOUT', node2: 'GND' }
      ]
    };

    const res = await requestAcAnalysis(netlist, {
      startFrequency: 10.0,
      stopFrequency: 1000.0,
      points: 80,
      inputNode: 'VIN',
      outputNode: 'VOUT'
    });

    assert.equal(res.status, 'success');
    assert.equal(res.behavior, 'BAND_PASS');
    assert.equal(res.resonance.resonanceDetected, true);
    assert.ok(Math.abs(res.resonance.resonantFrequencyHz - 159.15) < 15.0);
  });

  // Test 6: Frequency-Independent Pure Resistive Divider
  test('6. Pure resistive divider exhibits flat frequency-independent gain and 0° phase', () => {
    const netlist = {
      components: [
        { id: 'R1', type: 'resistor', value: 1000, node1: 'VIN', node2: 'VOUT' },
        { id: 'R2', type: 'resistor', value: 1000, node1: 'VOUT', node2: 'GND' }
      ]
    };

    const sweep = runClientFrequencySweep(netlist, 100, 10000, 20);
    const transfer = extractClientTransferResponse(netlist, sweep, 'VIN', 'VOUT');
    const shape = analyzeClientResponseShape(transfer.transferPoints);

    assert.equal(shape.isFlatShape, true);
    for (const pt of transfer.transferPoints) {
      assert.ok(Math.abs(pt.gainMagnitude - 0.5) < 0.01);
      assert.ok(Math.abs(pt.gainDb - (-6.02)) < 0.1);
      assert.ok(Math.abs(pt.phaseDeg) < 0.1);
    }
  });

  // Test 7: Knowledge Registry Holds Filter Models
  test('7. CircuitKnowledgeRegistry contains definitions for all canonical filter models', () => {
    const types = circuitRegistry.getSupportedTypes();
    assert.ok(types.includes('RC_LOW_PASS'));
    assert.ok(types.includes('RC_HIGH_PASS'));
    assert.ok(types.includes('RL_LOW_PASS'));
    assert.ok(types.includes('RL_HIGH_PASS'));
    assert.ok(types.includes('RLC_BAND_PASS'));
    assert.ok(types.includes('RLC_BAND_STOP'));
    assert.ok(types.includes('RLC_SERIES_RESONANCE'));
    assert.ok(types.includes('RLC_PARALLEL_RESONANCE'));

    const rcLpDef = circuitRegistry.get('RC_LOW_PASS');
    assert.equal(rcLpDef.displayName, 'RC Low-Pass Filter');
    assert.equal(rcLpDef.visualizationType, VISUALIZATION_TYPES.AC_LOW_PASS);
  });

  // Test 8: Topology Classification & Behavioral Model for RC High-Pass
  test('8. Topology classifier and electrical behavior model accurately resolve RC High-Pass', () => {
    const netlist = {
      components: [
        { id: 'C1', type: 'capacitor', value: '100nF', node1: 'VIN', node2: 'VOUT' },
        { id: 'R1', type: 'resistor', value: '1k', node1: 'VOUT', node2: 'GND' }
      ]
    };

    const classification = classifyCircuitTopology(netlist);
    assert.equal(classification.circuitType, 'RC_HIGH_PASS');
    assert.equal(classification.verificationState, 'VERIFIED');

    const behaviour = calculateCircuitBehaviour(classification, netlist);
    assert.equal(behaviour.status, 'SOLVED_THEORETICAL');
    assert.ok(Math.abs(behaviour.parameters.cutoffFrequency.value - 1591.55) < 5.0);

    const explanation = generateEducationalExplanation(classification, behaviour);
    assert.equal(explanation.isVerified, true);
    assert.ok(explanation.governingEquations.length >= 2);

    const viz = generateVisualizationState(classification, behaviour, netlist);
    assert.equal(viz.status, 'VERIFIED');
    assert.equal(viz.visualizationType, VISUALIZATION_TYPES.AC_HIGH_PASS);
    assert.equal(viz.signalFlow.type, 'AC_FILTER');
  });

  // Test 9: Topology Classification for RL Low-Pass
  test('9. Topology classifier accurately identifies RL Low-Pass architecture', () => {
    const netlist = {
      components: [
        { id: 'L1', type: 'inductor', value: '100mH', node1: 'VIN', node2: 'VOUT' },
        { id: 'R1', type: 'resistor', value: '1k', node1: 'VOUT', node2: 'GND' }
      ]
    };

    const classification = classifyCircuitTopology(netlist);
    assert.equal(classification.circuitType, 'RL_LOW_PASS');
    assert.equal(classification.verificationState, 'VERIFIED');

    const behaviour = calculateCircuitBehaviour(classification, netlist);
    assert.equal(behaviour.status, 'SOLVED_THEORETICAL');
    assert.ok(Math.abs(behaviour.parameters.cutoffFrequency.value - 1591.55) < 5.0);
  });

  // Test 10: Scientific Integrity & Safety Guards
  test('10. Scientific integrity guards: simulated AC results strictly declare is_measured: false and source: mna_simulation', async () => {
    const netlist = {
      components: [
        { id: 'R1', type: 'resistor', value: 1000, node1: 'VIN', node2: 'VOUT' },
        { id: 'C1', type: 'capacitor', value: 100e-9, node1: 'VOUT', node2: 'GND' }
      ]
    };

    const res = await requestAcAnalysis(netlist);
    assert.equal(res.source, 'mna_simulation');
    assert.equal(res.is_measured, false);
    assert.equal(res.frequency_response.source, 'mna_simulation');
    assert.equal(res.frequency_response.isMeasured, false);
  });
});
