/**
 * SmartBreadboard 3D — Semiconductor & Diode Analysis Service (Phase 30)
 *
 * Consumes backend Non-Linear Transient MNA and Semiconductor Intelligence endpoints.
 * Scientific Integrity:
 * - is_measured is strictly false
 * - source is 'nonlinear_transient_mna_simulation'
 * - physical_validation_status is 'NOT_PERFORMED'
 */

import { apiRequest } from './api.js';
import { normalizeSemiconductorResponse } from '../intelligence/semiconductorAnalysisEngine.js';

export const SEMICONDUCTOR_STATUSES = {
  VERIFIED: 'VERIFIED',
  UNKNOWN: 'UNKNOWN',
  UNSUPPORTED: 'UNSUPPORTED',
  ERROR: 'ERROR'
};

/**
 * Dispatches non-linear semiconductor simulation request to FastAPI backend.
 */
export async function requestSemiconductorAnalysis(netlist, options = {}) {
  const payload = {
    netlist,
    source: options.source || options.sourceConfig || options.powerSource || null,
    simulation: {
      t_start: options.tStart !== undefined ? options.tStart : (options.t_start !== undefined ? options.t_start : 0.0),
      t_stop: options.tStop !== undefined ? options.tStop : (options.t_stop !== undefined ? options.t_stop : 0.01),
      dt: options.dt !== undefined ? options.dt : (options.timeStep !== undefined ? options.timeStep : 0.00005),
      method: options.method || 'backward_euler'
    },
    initialConditions: options.initialConditions || options.initial_conditions || {},
    nonlinear: {
      max_iterations: options.maxIterations || 50,
      voltage_tolerance: options.voltageTolerance || 1e-6,
      current_tolerance: options.currentTolerance || 1e-9,
      damping_factor: options.dampingFactor || 1.0
    }
  };

  try {
    const res = await apiRequest('/nonlinear/transient/analyze', 'POST', payload);
    return normalizeSemiconductorResponse(res);
  } catch (err) {
    console.warn('[SemiconductorAnalysisService] API call failed:', err.message);
    return {
      status: SEMICONDUCTOR_STATUSES.ERROR,
      circuitType: 'UNKNOWN',
      displayName: 'Semiconductor Analysis Failed',
      signals: [],
      time: [],
      metrics: {},
      error: err.message,
      source: 'nonlinear_transient_mna_simulation',
      is_measured: false,
      isMeasured: false,
      physical_validation_status: 'NOT_PERFORMED'
    };
  }
}

export default {
  requestSemiconductorAnalysis,
  normalizeSemiconductorResponse,
  SEMICONDUCTOR_STATUSES
};
