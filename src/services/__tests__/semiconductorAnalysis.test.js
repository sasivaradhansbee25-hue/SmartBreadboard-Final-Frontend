/**
 * SmartBreadboard 3D — Semiconductor Analysis Unit Tests (Phase 30)
 * Verifies semiconductor registry, response normalization, metrics handling,
 * and scientific metadata integrity.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';

import {
  SEMICONDUCTOR_REGISTRY,
  getSemiconductorDefinition
} from '../../intelligence/semiconductorRegistry.js';

import {
  normalizeSemiconductorResponse
} from '../../intelligence/semiconductorAnalysisEngine.js';

describe('Phase 30 — Semiconductor Unit Tests', () => {
  test('1. Semiconductor Registry contains canonical models', () => {
    assert.ok(SEMICONDUCTOR_REGISTRY['1N4148']);
    assert.ok(SEMICONDUCTOR_REGISTRY['1N4007']);
    assert.ok(SEMICONDUCTOR_REGISTRY['LED_RED']);
    assert.ok(SEMICONDUCTOR_REGISTRY['LED_GREEN']);
    assert.ok(SEMICONDUCTOR_REGISTRY['GENERIC_DIODE']);

    const d1n4148 = getSemiconductorDefinition('1N4148');
    assert.strictEqual(d1n4148.family, 'PN_DIODE');
    assert.strictEqual(d1n4148.parameters.n, 1.752);

    const fallback = getSemiconductorDefinition('UNKNOWN_CHIP');
    assert.strictEqual(fallback.model, 'GENERIC_DIODE');
  });

  test('2. Response Normalizer preserves scientific metadata', () => {
    const raw = {
      status: 'VERIFIED',
      circuit_type: 'DIODE_FORWARD_BIAS',
      display_name: 'Diode Forward-Bias Circuit',
      signals: [
        { name: 'V_D1', type: 'voltage', values: [0.0, 0.65] },
        { name: 'I_D1', type: 'current', values: [0.0, 0.004] }
      ],
      time: [0.0, 0.001],
      metrics: {
        operating_state: 'FORWARD_CONDUCTING',
        peak_forward_voltage: 0.65,
        peak_forward_current: 0.004,
        conduction_duty_cycle_percent: 100.0
      },
      solver: {
        method: 'backward_euler',
        converged: true,
        max_iterations_used: 4
      },
      source: 'nonlinear_transient_mna_simulation',
      is_measured: false,
      physical_validation_status: 'NOT_PERFORMED'
    };

    const norm = normalizeSemiconductorResponse(raw);
    assert.strictEqual(norm.status, 'VERIFIED');
    assert.strictEqual(norm.circuitType, 'DIODE_FORWARD_BIAS');
    assert.strictEqual(norm.metrics.operatingState, 'FORWARD_CONDUCTING');
    assert.strictEqual(norm.metrics.peakForwardVoltage, 0.65);
    assert.strictEqual(norm.visualizationState, 'DIODE_FORWARD_CONDUCTION');
    assert.strictEqual(norm.isMeasured, false);
    assert.strictEqual(norm.physicalValidationStatus, 'NOT_PERFORMED');
    assert.strictEqual(norm.source, 'nonlinear_transient_mna_simulation');
  });

  test('3. LED Current Limiter sets LED_CONDUCTION visual state', () => {
    const raw = {
      status: 'VERIFIED',
      circuit_type: 'LED_CURRENT_LIMITER',
      metrics: {
        operating_state: 'FORWARD_CONDUCTING',
        peak_forward_voltage: 1.95,
        peak_forward_current: 0.012
      }
    };

    const norm = normalizeSemiconductorResponse(raw);
    assert.strictEqual(norm.visualizationState, 'LED_CONDUCTION');
  });

  test('4. Reverse Biased Diode sets DIODE_REVERSE_BIAS visual state', () => {
    const raw = {
      status: 'VERIFIED',
      circuit_type: 'DIODE_REVERSE_BIAS',
      metrics: {
        operating_state: 'REVERSE_BIASED',
        peak_forward_voltage: -5.0,
        peak_forward_current: -1e-9
      }
    };

    const norm = normalizeSemiconductorResponse(raw);
    assert.strictEqual(norm.visualizationState, 'DIODE_REVERSE_BIAS');
  });

  test('5. Rectifier Conduction sets RECTIFIER_CONDUCTION visual state', () => {
    const raw = {
      status: 'VERIFIED',
      circuit_type: 'HALF_WAVE_RECTIFIER',
      metrics: {
        operating_state: 'FORWARD_CONDUCTING',
        conduction_duty_cycle_percent: 50.0
      }
    };

    const norm = normalizeSemiconductorResponse(raw);
    assert.strictEqual(norm.visualizationState, 'RECTIFIER_CONDUCTION');
  });
});
