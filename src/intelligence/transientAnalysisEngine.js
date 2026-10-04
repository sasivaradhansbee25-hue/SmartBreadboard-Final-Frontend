/**
 * SmartBreadboard 3D — Transient Circuit Intelligence Engine (Phase 29)
 *
 * Provides time-domain numerical transient analysis orchestration,
 * companion model data normalization, transient waveform metric extraction,
 * damping classification, educational insights, and AR visualization mapping.
 *
 * Scientific Integrity:
 * - source: "transient_mna_simulation"
 * - isMeasured: false
 * - PHYSICAL_VALIDATION_STATUS: "NOT_PERFORMED"
 */

import { VERIFICATION_STATES } from './circuitKnowledgeRegistry.js';

export const TRANSIENT_CIRCUIT_TYPES = {
  RC_CHARGING: 'RC_CHARGING',
  RC_DISCHARGING: 'RC_DISCHARGING',
  RL_CURRENT_RISE: 'RL_CURRENT_RISE',
  RL_CURRENT_DECAY: 'RL_CURRENT_DECAY',
  RLC_TRANSIENT: 'RLC_TRANSIENT',
  GENERIC_TRANSIENT: 'GENERIC_TRANSIENT',
  UNSUPPORTED: 'UNSUPPORTED'
};

export const DAMPING_TYPES = {
  UNDERDAMPED: 'UNDERDAMPED',
  CRITICALLY_DAMPED: 'CRITICALLY_DAMPED',
  OVERDAMPED: 'OVERDAMPED',
  FIRST_ORDER: 'FIRST_ORDER'
};

/**
 * Normalizes backend transient API response into frontend state shape.
 */
export function normalizeTransientResponse(rawResponse) {
  if (!rawResponse) {
    return {
      status: 'UNSUPPORTED',
      circuitType: 'UNSUPPORTED',
      signals: [],
      time: [],
      metrics: null,
      source: 'transient_mna_simulation',
      isMeasured: false,
      physicalValidationStatus: 'NOT_PERFORMED'
    };
  }

  const status = rawResponse.status || (rawResponse.success ? 'VERIFIED' : 'ERROR');
  const circuitType = rawResponse.circuit_type || rawResponse.circuitType || 'GENERIC_TRANSIENT';
  const signals = rawResponse.signals || [];
  const time = rawResponse.time || [];
  const nodeVoltages = rawResponse.node_voltages || rawResponse.nodeVoltages || {};
  const metrics = rawResponse.metrics || {};
  const theoreticalModel = rawResponse.theoretical_model || rawResponse.theoreticalModel || null;
  const solver = rawResponse.solver || {};

  return {
    status,
    circuitType,
    displayName: rawResponse.display_name || rawResponse.displayName || circuitType,
    verificationStatus: rawResponse.verification_status || status,
    primarySignal: rawResponse.primary_signal || (signals.length > 0 ? signals[0].name : null),
    governingEquation: rawResponse.governing_equation || rawResponse.governingEquation || '',
    theoreticalModel,
    solver: {
      method: solver.method || 'backward_euler',
      timeStep: solver.dt || solver.timeStep || 0.0001,
      tStart: solver.t_start || 0.0,
      tStop: solver.t_stop || 0.01,
      numPoints: solver.num_points || time.length,
      convergence: solver.convergence || 'CONVERGED'
    },
    time,
    signals: signals.map(s => ({
      name: s.name,
      componentId: s.component_id || s.componentId || s.name,
      type: s.type || 'voltage',
      unit: s.unit || (s.type === 'current' ? 'A' : 'V'),
      values: Array.isArray(s.values) ? s.values : []
    })),
    nodeVoltages,
    metrics: {
      initialValue: metrics.initial_value !== undefined ? metrics.initial_value : metrics.initialValue,
      finalValue: metrics.final_value !== undefined ? metrics.final_value : metrics.finalValue,
      peakValue: metrics.peak_value !== undefined ? metrics.peak_value : metrics.peakValue,
      minValue: metrics.min_value !== undefined ? metrics.min_value : metrics.minValue,
      peakTime: metrics.peak_time !== undefined ? metrics.peak_time : metrics.peakTime,
      riseTime: metrics.rise_time !== undefined ? metrics.rise_time : metrics.riseTime,
      fallTime: metrics.fall_time !== undefined ? metrics.fall_time : metrics.fallTime,
      tau: metrics.tau !== undefined ? metrics.tau : null,
      settlingTime: metrics.settling_time !== undefined ? metrics.settling_time : metrics.settlingTime,
      overshootPercent: metrics.overshoot_percent !== undefined ? metrics.overshoot_percent : (metrics.overshootPercent || 0.0),
      undershootPercent: metrics.undershoot_percent !== undefined ? metrics.undershoot_percent : (metrics.undershootPercent || 0.0),
      oscillationFreqHz: metrics.oscillation_freq_hz !== undefined ? metrics.oscillation_freq_hz : metrics.oscillationFreqHz,
      damping: metrics.damping || DAMPING_TYPES.FIRST_ORDER
    },
    educationalExplanation: rawResponse.educational_explanation || rawResponse.educationalExplanation || {
      summary: 'Simulation shows dynamic transient time-domain response.',
      scientificNote: 'Values derived from numerical transient MNA integration. Physical validation not performed.'
    },
    visualizationState: rawResponse.visualization_state || rawResponse.visualizationState || 'TRANSIENT_ANALYSIS',
    source: 'transient_mna_simulation',
    isMeasured: false,
    physicalValidationStatus: 'NOT_PERFORMED'
  };
}

/**
 * Extracts frontend transient metrics from raw numerical time series if needed.
 */
export function extractClientTransientMetrics(time, values, signalName = 'Signal') {
  if (!time || !values || time.length < 2 || values.length < 2) {
    return {
      initialValue: 0,
      finalValue: 0,
      peakValue: 0,
      minValue: 0,
      riseTime: null,
      fallTime: null,
      tau: null,
      settlingTime: null,
      overshootPercent: 0,
      damping: DAMPING_TYPES.FIRST_ORDER
    };
  }

  const yInit = values[0];
  const yFinal = values[values.length - 1];
  let yPeak = values[0];
  let yMin = values[0];
  let peakIdx = 0;

  for (let i = 0; i < values.length; i++) {
    if (values[i] > yPeak) {
      yPeak = values[i];
      peakIdx = i;
    }
    if (values[i] < yMin) {
      yMin = values[i];
    }
  }

  const deltaY = yFinal - yInit;
  let riseTime = null;
  let fallTime = null;
  let tau = null;

  if (Math.abs(deltaY) > 1e-6) {
    if (yFinal > yInit) {
      const val10 = yInit + 0.10 * deltaY;
      const val90 = yInit + 0.90 * deltaY;
      const idx10 = values.findIndex(v => v >= val10);
      const idx90 = values.findIndex(v => v >= val90);
      if (idx10 >= 0 && idx90 >= 0 && idx90 >= idx10) {
        riseTime = time[idx90] - time[idx10];
      }
      const target63 = yInit + (1.0 - Math.exp(-1.0)) * deltaY;
      const crossIdx = values.findIndex(v => v >= target63);
      if (crossIdx >= 0) tau = time[crossIdx] - time[0];
    } else {
      const val90 = yInit + 0.10 * deltaY;
      const val10 = yInit + 0.90 * deltaY;
      const idx90 = values.findIndex(v => v <= val90);
      const idx10 = values.findIndex(v => v <= val10);
      if (idx90 >= 0 && idx10 >= 0 && idx10 >= idx90) {
        fallTime = time[idx10] - time[idx90];
      }
      const target63 = yInit + (1.0 - Math.exp(-1.0)) * deltaY;
      const crossIdx = values.findIndex(v => v <= target63);
      if (crossIdx >= 0) tau = time[crossIdx] - time[0];
    }
  }

  let overshootPercent = 0;
  if (Math.abs(deltaY) > 1e-6 && yFinal > yInit && yPeak > yFinal) {
    overshootPercent = (100.0 * (yPeak - yFinal)) / Math.abs(deltaY);
  }

  const damping = overshootPercent > 1.0 ? DAMPING_TYPES.UNDERDAMPED : DAMPING_TYPES.FIRST_ORDER;

  return {
    signalName,
    initialValue: yInit,
    finalValue: yFinal,
    peakValue: yPeak,
    minValue: yMin,
    peakTime: time[peakIdx],
    riseTime,
    fallTime,
    tau,
    overshootPercent,
    damping
  };
}
