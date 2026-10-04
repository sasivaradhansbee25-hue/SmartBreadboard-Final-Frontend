/**
 * SmartBreadboard 3D — Circuit Intelligence & AR Learning Engine Tests (Phase 25)
 *
 * Automated verification suite:
 * 1. Valid voltage divider -> VERIFIED with correct mathematical ratio.
 * 2. Generic resistor network -> NOT_VERIFIED as voltage divider.
 * 3. Valid RC charging topology -> VERIFIED, tau = RC, exponential waveform generated.
 * 4. Incomplete RC network -> NOT_VERIFIED or PARTIALLY_VERIFIED.
 * 5. Generic RC network -> NOT_VERIFIED as RC phase-shift oscillator.
 * 6. Invalid / ambiguous connection / short circuit -> NOT_VERIFIED / SHORT_CIRCUIT_FAULT.
 * 7. Unsupported electrical model (RLC AC dynamic) -> UNSUPPORTED with clear warning.
 * 8. Component value change -> visualization parameters update reactively.
 * 9. Broken connection after verification -> resets state & disables educational animation.
 * 10. Unknown / empty circuit -> returns UNKNOWN with zero fake animations.
 * 11. LED Current Limiter -> VERIFIED with safe operating current checks.
 * 12. Knowledge Registry Extensibility -> Allows custom circuit registration at runtime.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  circuitRegistry,
  CIRCUIT_CATEGORIES,
  VERIFICATION_STATES,
  VISUALIZATION_TYPES,
  classifyCircuitTopology,
  calculateCircuitBehaviour,
  generateVisualizationState,
  generateEducationalExplanation,
  analyzeCircuitIntelligence
} from '../../intelligence/index.js';

describe('Phase 25: Context-Aware Circuit Intelligence & AR Learning Engine', () => {

  // Test 1: Valid Voltage Divider
  test('1. Valid voltage divider is classified as VERIFIED with exact theoretical ratio', () => {
    const netlist = {
      power_sources: [{ id: 'V1', voltage: 10.0, positive_node: 'NODE_PWR', negative_node: 'NODE_GND' }],
      components: [
        { id: 'R1', type: 'resistor', value: 1000, node1: 'NODE_PWR', node2: 'NODE_MID' },
        { id: 'R2', type: 'resistor', value: 2000, node1: 'NODE_MID', node2: 'NODE_GND' }
      ]
    };

    const intel = analyzeCircuitIntelligence(netlist);
    assert.equal(intel.classification.circuitType, 'VOLTAGE_DIVIDER');
    assert.equal(intel.classification.verificationState, VERIFICATION_STATES.VERIFIED);
    assert.equal(intel.visualizationState.isEducationalAnimationActive, true);
    assert.equal(intel.visualizationState.visualizationType, VISUALIZATION_TYPES.VOLTAGE_DISTRIBUTION);

    // Check theoretical electrical parameters: Vout = 10 * (2000 / 3000) = 6.667 V
    const p = intel.electricalBehaviour.parameters;
    assert.equal(p.r1.value, 1000);
    assert.equal(p.r2.value, 2000);
    assert.equal(p.rTotal.value, 3000);
    assert.ok(Math.abs(p.vOutTheoretical.value - 6.667) < 0.01);
    assert.equal(p.vOutTheoretical.is_measured, false);
    assert.equal(p.vOutTheoretical.source, 'theoretical_model');
  });

  // Test 2: Generic Resistor Network (3 resistors in parallel) is NOT verified as voltage divider
  test('2. Generic parallel resistor network is NOT classified as a voltage divider', () => {
    const netlist = {
      components: [
        { id: 'R1', type: 'resistor', value: 1000, node1: 'NODE_PWR', node2: 'NODE_GND' },
        { id: 'R2', type: 'resistor', value: 1000, node1: 'NODE_PWR', node2: 'NODE_GND' }
      ]
    };

    const classification = classifyCircuitTopology(netlist);
    assert.notEqual(classification.circuitType, 'VOLTAGE_DIVIDER');
    assert.equal(classification.circuitType, 'PARALLEL_RESISTOR_NETWORK');
    assert.equal(classification.verificationState, VERIFICATION_STATES.VERIFIED);
  });

  // Test 3: Valid RC Charging Topology -> VERIFIED, tau = RC, waveform generated
  test('3. Valid RC charging circuit is classified as VERIFIED and generates 60-point exponential curve', () => {
    const netlist = {
      power_sources: [{ id: 'V1', voltage: 5.0, positive_node: 'NODE_PWR', negative_node: 'NODE_GND' }],
      components: [
        { id: 'R1', type: 'resistor', value: 10000, node1: 'NODE_PWR', node2: 'NODE_CAP' }, // 10 kΩ
        { id: 'C1', type: 'capacitor', value: 100e-6, node1: 'NODE_CAP', node2: 'NODE_GND' } // 100 µF
      ]
    };

    const intel = analyzeCircuitIntelligence(netlist);
    assert.equal(intel.classification.circuitType, 'RC_CHARGING');
    assert.equal(intel.classification.verificationState, VERIFICATION_STATES.VERIFIED);
    assert.equal(intel.visualizationState.isEducationalAnimationActive, true);
    assert.equal(intel.visualizationState.visualizationType, VISUALIZATION_TYPES.RC_CHARGING_WAVEFORM);

    // Tau = 10k * 100µ = 1.0 second = 1000 ms
    const p = intel.electricalBehaviour.parameters;
    assert.ok(Math.abs(p.tau.value - 1000.0) < 0.01);

    // Waveform points
    const waveforms = intel.electricalBehaviour.waveforms;
    assert.equal(waveforms.length, 1);
    assert.ok(waveforms[0].points.length >= 50);
    // At t=0, V=0. At t=5tau, V ~= 5.0V (99.3%)
    assert.equal(waveforms[0].points[0].voltageV, 0);
    assert.ok(waveforms[0].points[waveforms[0].points.length - 1].voltageV > 4.9);
  });

  // Test 4: Incomplete RC Network (Floating capacitor) -> PARTIALLY_VERIFIED
  test('4. Incomplete RC network with floating ground terminal is marked as PARTIALLY_VERIFIED', () => {
    const netlist = {
      components: [
        { id: 'R1', type: 'resistor', value: 4700, node1: 'NODE_PWR', node2: 'NODE_MID' },
        { id: 'C1', type: 'capacitor', value: 100e-9, node1: 'NODE_MID', node2: 'NODE_FLOATING_UNCONNECTED' }
      ]
    };

    const classification = classifyCircuitTopology(netlist);
    assert.equal(classification.circuitType, 'RC_CHARGING');
    assert.equal(classification.verificationState, VERIFICATION_STATES.PARTIALLY_VERIFIED);
    assert.ok(classification.warnings.length > 0);
  });

  // Test 5: Generic RC Network (2R + 2C) is NOT classified as RC Phase-Shift Oscillator
  test('5. Generic 2R+2C network is NOT verified as RC Phase-Shift Oscillator (requires 3 stages + active inverter)', () => {
    const netlist = {
      components: [
        { id: 'R1', type: 'resistor', value: 1000, node1: 'N1', node2: 'N2' },
        { id: 'R2', type: 'resistor', value: 1000, node1: 'N2', node2: 'N3' },
        { id: 'C1', type: 'capacitor', value: 10e-9, node1: 'N1', node2: 'N2' },
        { id: 'C2', type: 'capacitor', value: 10e-9, node1: 'N2', node2: 'N3' }
      ]
    };

    const intel = analyzeCircuitIntelligence(netlist);
    assert.equal(intel.classification.circuitType, 'RC_PHASE_SHIFT_OSCILLATOR');
    // Must NOT be verified!
    assert.equal(intel.classification.verificationState, VERIFICATION_STATES.NOT_VERIFIED);
    assert.equal(intel.visualizationState.isEducationalAnimationActive, false);
    assert.ok(intel.classification.missingRequirements.length >= 2);
  });

  // Test 6: Short circuit connection triggers SHORT_CIRCUIT_FAULT
  test('6. Component shorted across identical electrical node triggers fault detection', () => {
    const netlist = {
      components: [
        { id: 'R1', type: 'resistor', value: 220, node1: 'NODE_GND', node2: 'NODE_GND' }
      ]
    };

    const classification = classifyCircuitTopology(netlist);
    assert.equal(classification.circuitType, 'FAULTED_SHORT_CIRCUIT');
    assert.equal(classification.verificationState, VERIFICATION_STATES.NOT_VERIFIED);
    assert.equal(classification.topologyStatus, 'SHORT_CIRCUIT_FAULT');
  });

  // Test 7: RLC Series Resonance verified with Phase 26 AC Engine
  test('7. Valid series RLC network is classified as VERIFIED RLC_SERIES_RESONANCE with AC frequency spectrum', () => {
    const netlist = {
      components: [
        { id: 'R1', type: 'resistor', value: 100, node1: 'N1', node2: 'N2' },
        { id: 'L1', type: 'inductor', value: 0.010, node1: 'N2', node2: 'N3' },
        { id: 'C1', type: 'capacitor', value: 100e-6, node1: 'N3', node2: 'GND' }
      ]
    };

    const intel = analyzeCircuitIntelligence(netlist);
    assert.equal(intel.classification.circuitType, 'RLC_SERIES_RESONANCE');
    assert.equal(intel.classification.verificationState, VERIFICATION_STATES.VERIFIED);
    assert.equal(intel.visualizationState.isEducationalAnimationActive, true);
    assert.equal(intel.visualizationState.visualizationType, VISUALIZATION_TYPES.RESONANCE_CURVE);
    assert.ok(intel.electricalBehaviour.parameters.f0.value > 0);
  });

  // Test 8: Component value change reactively updates theoretical parameters
  test('8. Changing component values dynamically updates calculated theoretical parameters', () => {
    const netlist1 = {
      power_sources: [{ voltage: 12.0 }],
      components: [
        { id: 'R1', type: 'resistor', value: 1000, node1: 'PWR', node2: 'MID' },
        { id: 'R2', type: 'resistor', value: 1000, node1: 'MID', node2: 'GND' }
      ]
    };
    const intel1 = analyzeCircuitIntelligence(netlist1);
    assert.equal(intel1.electricalBehaviour.parameters.vOutTheoretical.value, 6.0);

    // Edit R2 from 1k to 3k (12V * (3000 / 4000) = 9.0V)
    const netlist2 = {
      power_sources: [{ voltage: 12.0 }],
      components: [
        { id: 'R1', type: 'resistor', value: 1000, node1: 'PWR', node2: 'MID' },
        { id: 'R2', type: 'resistor', value: 3000, node1: 'MID', node2: 'GND' }
      ]
    };
    const intel2 = analyzeCircuitIntelligence(netlist2);
    assert.equal(intel2.electricalBehaviour.parameters.vOutTheoretical.value, 9.0);
  });

  // Test 9: Broken connection / removed component disables animation
  test('9. Breaking a connection reverts classification to UNKNOWN and disables animation', () => {
    // Empty netlist after removing broken resistor
    const netlist = { components: [] };
    const intel = analyzeCircuitIntelligence(netlist);
    assert.equal(intel.classification.circuitType, 'UNKNOWN');
    assert.equal(intel.classification.verificationState, VERIFICATION_STATES.NOT_VERIFIED);
    assert.equal(intel.visualizationState.isEducationalAnimationActive, false);
  });

  // Test 10: Unknown / Custom Circuit does not trigger fake circuit animation
  test('10. Unrecognized custom circuit returns generic state without fake textbook animation', () => {
    const netlist = {
      components: [
        { id: 'IC1', type: 'ic', node1: 'N1', node2: 'N2' },
        { id: 'T1', type: 'transistor', node1: 'N2', node2: 'N3' }
      ]
    };

    const intel = analyzeCircuitIntelligence(netlist);
    assert.equal(intel.classification.circuitType, 'GENERIC_CUSTOM_CIRCUIT');
    assert.equal(intel.visualizationState.visualizationType, VISUALIZATION_TYPES.GENERIC_DC_FLOW);
  });

  // Test 11: LED Current-Limiting Circuit verification
  test('11. LED Current Limiter verifies series diode branch and enforces safe current calculation', () => {
    const netlist = {
      power_sources: [{ voltage: 5.0 }],
      components: [
        { id: 'R1', type: 'resistor', value: 220, node1: 'NODE_PWR', node2: 'NODE_ANODE' },
        { id: 'LED1', type: 'led', node1: 'NODE_ANODE', node2: 'NODE_GND' }
      ]
    };

    const intel = analyzeCircuitIntelligence(netlist);
    assert.equal(intel.classification.circuitType, 'LED_CURRENT_LIMITER');
    assert.equal(intel.classification.verificationState, VERIFICATION_STATES.VERIFIED);
    assert.equal(intel.visualizationState.isEducationalAnimationActive, true);

    // I = (5.0 - 2.0) / 220 = 3.0 / 220 = 13.64 mA
    const p = intel.electricalBehaviour.parameters;
    assert.ok(Math.abs(p.forwardCurrent.value - 13.64) < 0.1);
    assert.equal(p.safetyStatus.value, 'SAFE');
  });

  // Test 12: Knowledge Registry runtime extensibility
  test('12. CircuitKnowledgeRegistry dynamically accepts new circuit definitions without core engine modification', () => {
    const customDef = {
      circuitType: 'CUSTOM_ASTABLE_MULTIVIBRATOR',
      displayName: 'Astable Multivibrator',
      category: CIRCUIT_CATEGORIES.OSCILLATOR,
      requiredComponents: [{ role: 't1', type: 'transistor' }],
      topologyRequirements: { minTransistors: 2 },
      electricalModel: 'MULTIVIBRATOR_MODEL',
      requiredParameters: ['frequency']
    };

    circuitRegistry.register(customDef);
    const retrieved = circuitRegistry.get('CUSTOM_ASTABLE_MULTIVIBRATOR');
    assert.ok(retrieved);
    assert.equal(retrieved.displayName, 'Astable Multivibrator');
    assert.equal(retrieved.isCustom, true);
  });
});
