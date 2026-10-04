import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  normalizeTransientResponse,
  extractClientTransientMetrics,
  TRANSIENT_CIRCUIT_TYPES,
  DAMPING_TYPES
} from '../../intelligence/transientAnalysisEngine.js';
import { requestTransientAnalysis, TRANSIENT_STATUSES } from '../transientAnalysisService.js';
import { generateVisualizationState } from '../../intelligence/visualizationStateEngine.js';

describe('Phase 29: Transient Circuit Intelligence & Waveform Normalization', () => {

  // 1. API Response Normalization & Scientific Integrity
  it('1. normalizeTransientResponse preserves strict scientific integrity flags and structure', () => {
    const rawApiPayload = {
      status: 'VERIFIED',
      circuit_type: 'RC_CHARGING',
      display_name: 'RC Charging Circuit',
      signals: [
        { name: 'V(C1)', component_id: 'C1', type: 'voltage', unit: 'V', values: [0.0, 1.5, 3.16, 4.5, 4.95] }
      ],
      time: [0.0, 0.0005, 0.001, 0.002, 0.005],
      node_voltages: { node_mid: [0.0, 1.5, 3.16, 4.5, 4.95] },
      metrics: {
        initial_value: 0.0,
        final_value: 5.0,
        peak_value: 4.95,
        tau: 0.001,
        rise_time: 0.0022,
        overshoot_percent: 0.0,
        damping: 'FIRST_ORDER'
      },
      solver: { method: 'backward_euler', dt: 0.0001, num_points: 5 },
      source: 'transient_mna_simulation',
      is_measured: false,
      physical_validation_status: 'NOT_PERFORMED'
    };

    const norm = normalizeTransientResponse(rawApiPayload);
    assert.strictEqual(norm.status, 'VERIFIED');
    assert.strictEqual(norm.circuitType, 'RC_CHARGING');
    assert.strictEqual(norm.source, 'transient_mna_simulation');
    assert.strictEqual(norm.isMeasured, false);
    assert.strictEqual(norm.physicalValidationStatus, 'NOT_PERFORMED');
    assert.strictEqual(norm.signals.length, 1);
    assert.strictEqual(norm.metrics.tau, 0.001);
    assert.strictEqual(norm.metrics.initialValue, 0.0);
    assert.strictEqual(norm.metrics.finalValue, 5.0);
  });

  // 2. Client Waveform Metric Extraction
  it('2. extractClientTransientMetrics extracts accurate initial, final, peak, tau, and rise time', () => {
    // Simulated RC charging curve from 0V to 10V with tau = 1 ms (0.001 s)
    const time = [];
    const values = [];
    const tauTheor = 0.001;
    const vFinal = 10.0;
    for (let t = 0; t <= 0.005; t += 0.0001) {
      time.push(Number(t.toFixed(5)));
      values.push(vFinal * (1 - Math.exp(-t / tauTheor)));
    }

    const metrics = extractClientTransientMetrics(time, values, 'V(C1)');
    assert.strictEqual(metrics.initialValue, 0.0);
    assert.ok(metrics.finalValue > 9.9);
    assert.ok(metrics.tau !== null);
    // Tau should be close to 0.001s
    assert.ok(Math.abs(metrics.tau - 0.001) < 0.0002);
    assert.strictEqual(metrics.damping, DAMPING_TYPES.FIRST_ORDER);
  });

  // 3. 2nd-Order Underdamped Classification & Overshoot Extraction
  it('3. extractClientTransientMetrics detects underdamped oscillation and overshoot', () => {
    // Underdamped step response with 30% overshoot
    const time = [];
    const values = [];
    for (let t = 0; t <= 0.01; t += 0.0001) {
      time.push(t);
      // y(t) = 5 * [ 1 - exp(-500*t) * cos(2000*t) ]
      const v = 5.0 * (1.0 - Math.exp(-500 * t) * Math.cos(2000 * t));
      values.push(v);
    }

    const metrics = extractClientTransientMetrics(time, values, 'V(C1)');
    assert.strictEqual(metrics.damping, DAMPING_TYPES.UNDERDAMPED);
    assert.ok(metrics.overshootPercent > 10.0);
    assert.ok(metrics.peakValue > 5.0);
  });

  // 4. Visualization State Mapping for Transient Modes
  it('4. generateVisualizationState maps verified transient circuits to active transient visualization states', () => {
    const classification = {
      circuitType: 'RC_CHARGING',
      verificationState: 'VERIFIED',
      matchedComponents: {
        r: { id: 'R1', designator: 'R1' },
        c: { id: 'C1', designator: 'C1' }
      },
      parameters: { node_out: 'node_cap' }
    };
    const visState = generateVisualizationState(classification, { parameters: { tau: { formatted: '1.0 ms' } } });
    assert.strictEqual(visState.status, 'VERIFIED');
    assert.strictEqual(visState.isEducationalAnimationActive, true);
    assert.ok(visState.componentHighlights.R1);
    assert.ok(visState.componentHighlights.C1);
    assert.strictEqual(visState.componentHighlights.C1.role, 'TIMING_CAPACITOR');
  });

  // 5. Unverified / Broken Topology Invalidation
  it('5. Unverified circuit safely suppresses animations and declares UNVERIFIED status', () => {
    const classification = {
      circuitType: 'UNKNOWN',
      verificationState: 'NOT_VERIFIED',
      warnings: ['Disconnected capacitor node.']
    };
    const visState = generateVisualizationState(classification, null);
    assert.strictEqual(visState.status, 'NOT_VERIFIED');
    assert.strictEqual(visState.isEducationalAnimationActive, false);
    assert.ok(visState.warningBanner);
  });
});
