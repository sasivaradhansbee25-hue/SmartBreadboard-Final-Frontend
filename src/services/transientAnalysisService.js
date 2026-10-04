/**
 * SmartBreadboard 3D — Transient Circuit Analysis Service (Phase 29)
 *
 * Consumes backend Transient MNA and Time-Domain Intelligence endpoints.
 * Scientific Integrity:
 * - is_measured is strictly false
 * - source is 'transient_mna_simulation'
 * - physical_validation_status is 'NOT_PERFORMED'
 */

import { apiRequest } from './api.js';
import { normalizeTransientResponse } from '../intelligence/transientAnalysisEngine.js';

export const TRANSIENT_STATUSES = {
  VERIFIED: 'VERIFIED',
  UNKNOWN: 'UNKNOWN',
  UNSUPPORTED: 'UNSUPPORTED',
  ERROR: 'ERROR'
};

/**
 * Dispatches transient simulation request to FastAPI backend.
 */
export async function requestTransientAnalysis(netlist, options = {}) {
  const payload = {
    netlist,
    source: options.source || options.sourceConfig || options.powerSource || null,
    simulation: {
      t_start: options.tStart !== undefined ? options.tStart : (options.t_start !== undefined ? options.t_start : 0.0),
      t_stop: options.tStop !== undefined ? options.tStop : (options.t_stop !== undefined ? options.t_stop : 0.01),
      dt: options.dt !== undefined ? options.dt : (options.timeStep !== undefined ? options.timeStep : 0.0001),
      method: options.method || 'backward_euler'
    },
    initialConditions: options.initialConditions || options.initial_conditions || {}
  };

  try {
    const res = await apiRequest('/transient/analyze', 'POST', payload);
    return normalizeTransientResponse(res);
  } catch (err) {
    console.warn('[TransientAnalysisService] Backend API call failed, reporting error:', err.message);
    return {
      status: TRANSIENT_STATUSES.ERROR,
      circuitType: 'UNKNOWN',
      displayName: 'Transient Simulation Failed',
      signals: [],
      time: [],
      metrics: null,
      error: err.message,
      source: 'transient_mna_simulation',
      is_measured: false,
      isMeasured: false,
      physical_validation_status: 'NOT_PERFORMED'
    };
  }
}

export default {
  requestTransientAnalysis,
  normalizeTransientResponse,
  TRANSIENT_STATUSES
};
