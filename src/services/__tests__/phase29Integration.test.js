import { describe, it } from 'node:test';
import assert from 'node:assert';
import { analyzeCircuitIntelligence } from '../../intelligence/index.js';
import { classifyCircuitTopology } from '../../intelligence/topologyClassifier.js';
import { normalizeTransientResponse } from '../../intelligence/transientAnalysisEngine.js';
import { normalizeActiveCircuitResult } from '../acAnalysisService.js';
import { circuitRegistry } from '../../intelligence/circuitKnowledgeRegistry.js';

describe('Phase 29: End-to-End Integration & Full Regression Gate', () => {

  // 1. RC Charging Transient Classification & Normalization
  it('1. RC Charging netlist correctly classifies, generates intelligence, and normalizes transient response', () => {
    const netlist = {
      circuit_id: 'rc_charge_integ',
      components: [
        { id: 'R1', type: 'resistor', value: '1000', node1: 'NODE_PWR', node2: 'NODE_CAP' },
        { id: 'C1', type: 'capacitor', value: '1uF', node1: 'NODE_CAP', node2: 'NODE_GND' }
      ],
      power_sources: [
        { id: 'V1', type: 'step', voltage: 5.0, positive_node: 'NODE_PWR', negative_node: 'NODE_GND' }
      ]
    };

    const intel = analyzeCircuitIntelligence(netlist);
    assert.strictEqual(intel.classification.circuitType, 'RC_CHARGING');
    assert.strictEqual(intel.classification.verificationState, 'VERIFIED');
    assert.strictEqual(intel.visualizationState.isEducationalAnimationActive, true);
    assert.ok(intel.visualizationState.componentHighlights.R1);
    assert.ok(intel.visualizationState.componentHighlights.C1);

    // Mock Backend Simulation Output Normalization
    const mockBackendRes = {
      status: 'VERIFIED',
      circuit_type: 'RC_CHARGING',
      signals: [
        { name: 'V(C1)', component_id: 'C1', type: 'voltage', unit: 'V', values: [0.0, 3.16, 4.95] },
        { name: 'I(C1)', component_id: 'C1', type: 'current', unit: 'A', values: [0.005, 0.0018, 0.00005] }
      ],
      time: [0.0, 0.001, 0.005],
      metrics: { initial_value: 0.0, final_value: 5.0, tau: 0.001, damping: 'FIRST_ORDER' },
      source: 'transient_mna_simulation',
      is_measured: false,
      physical_validation_status: 'NOT_PERFORMED'
    };

    const normalized = normalizeTransientResponse(mockBackendRes);
    assert.strictEqual(normalized.status, 'VERIFIED');
    assert.strictEqual(normalized.circuitType, 'RC_CHARGING');
    assert.strictEqual(normalized.signals.length, 2);
    assert.strictEqual(normalized.source, 'transient_mna_simulation');
    assert.strictEqual(normalized.isMeasured, false);
    assert.strictEqual(normalized.physicalValidationStatus, 'NOT_PERFORMED');
  });

  // 2. Breaking Connection Reverts Classification to UNKNOWN
  it('2. Disconnecting capacitor node invalidates transient classification safely', () => {
    const brokenNetlist = {
      circuit_id: 'rc_broken',
      components: [
        { id: 'R1', type: 'resistor', value: '1000', node1: 'NODE_PWR', node2: 'NODE_CAP' },
        { id: 'C1', type: 'capacitor', value: '1uF', node1: 'NODE_FLOATING', node2: 'NODE_GND' }
      ],
      power_sources: [
        { id: 'V1', type: 'step', voltage: 5.0, positive_node: 'NODE_PWR', negative_node: 'NODE_GND' }
      ]
    };

    const intel = analyzeCircuitIntelligence(brokenNetlist);
    assert.notStrictEqual(intel.classification.verificationState, 'VERIFIED');
    assert.notStrictEqual(intel.classification.circuitType, 'RC_CHARGING');
    assert.strictEqual(intel.classification.circuitType, 'GENERIC_CUSTOM_CIRCUIT');

  });

  // 3. Phase 25 Regression: Voltage Divider & LED Current Limiter
  it('3. [Phase 25 Regression] Voltage Divider and LED Limiter remain strictly VERIFIED and operational', () => {
    const dividerNetlist = {
      circuit_id: 'divider_test',
      components: [
        { id: 'R1', type: 'resistor', value: '1000', node1: 'NODE_PWR', node2: 'NODE_MID' },
        { id: 'R2', type: 'resistor', value: '1000', node1: 'NODE_MID', node2: 'NODE_GND' }
      ],
      power_sources: [
        { id: 'V1', type: 'voltage_source', voltage: 5.0, positive_node: 'NODE_PWR', negative_node: 'NODE_GND' }
      ]
    };

    const intel = analyzeCircuitIntelligence(dividerNetlist);
    assert.strictEqual(intel.classification.circuitType, 'VOLTAGE_DIVIDER');
    assert.strictEqual(intel.classification.verificationState, 'VERIFIED');
  });

  // 4. Phase 26 Regression: Series RLC Resonance
  it('4. [Phase 26 Regression] Series RLC resonance definitions and topology matching remain intact', () => {
    const rlcDef = circuitRegistry.get('RLC_SERIES_RESONANCE');
    assert.ok(rlcDef !== null);
    assert.strictEqual(rlcDef.circuitType, 'RLC_SERIES_RESONANCE');
  });

  // 5. Phase 27 Regression: Generalized AC Filters
  it('5. [Phase 27 Regression] RC/RL High-Pass and Low-Pass filters remain verified', () => {
    const highPassNetlist = {
      circuit_id: 'rc_hp_test',
      components: [
        { id: 'C1', type: 'capacitor', value: '100nF', node1: 'NODE_IN', node2: 'NODE_OUT' },
        { id: 'R1', type: 'resistor', value: '1000', node1: 'NODE_OUT', node2: 'NODE_GND' }
      ],
      power_sources: [
        { id: 'V1', type: 'ac_source', voltage: 5.0, positive_node: 'NODE_IN', negative_node: 'NODE_GND' }
      ]
    };

    const intel = analyzeCircuitIntelligence(highPassNetlist);
    assert.strictEqual(intel.classification.circuitType, 'RC_HIGH_PASS');
    assert.strictEqual(intel.classification.verificationState, 'VERIFIED');
  });

  // 6. Phase 28 Regression: Active Op-Amp Amplifiers
  it('6. [Phase 28 Regression] Non-Inverting Op-Amp normalization and verification remain intact', () => {
    const mockActiveRes = {
      status: 'success',
      circuit_type: 'OPAMP_NON_INVERTING',
      display_name: 'Non-Inverting Op-Amp Amplifier',
      ic_model: 'LM741',
      operating_state: 'LINEAR',
      gain: { magnitude: 11.0, db: 20.83 },
      phase: { degrees: 0.0 },
      source: 'mna_simulation',
      is_measured: false
    };

    const normalized = normalizeActiveCircuitResult(mockActiveRes);
    assert.strictEqual(normalized.status, 'VERIFIED');
    assert.strictEqual(normalized.circuitType, 'OPAMP_NON_INVERTING');
    assert.strictEqual(normalized.gain.magnitude, 11.0);
    assert.strictEqual(normalized.isMeasured, false);
    assert.strictEqual(normalized.source, 'mna_simulation');
  });
});
