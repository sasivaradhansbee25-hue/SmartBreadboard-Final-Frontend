/**
 * SmartBreadboard 3D — AC & Active Circuit Analysis Service (Phase 26, 27 & 28)
 *
 * Consumes backend Complex MNA and Active Circuit Intelligence endpoints
 * with seamless client-side offline fallback.
 * Scientific Integrity: is_measured is strictly false, source is 'mna_simulation'.
 * Supports canonical active circuit statuses:
 * - VERIFIED
 * - UNKNOWN
 * - UNSUPPORTED
 * - INVALID_OPERATING_STATE
 * - SATURATED
 * - SOLVER_INVALID
 */

import { apiRequest } from './api.js';
import { analyzeClientGeneralizedAcCircuit } from '../intelligence/acAnalysisEngine.js';

export const ACTIVE_CIRCUIT_STATUSES = {
  VERIFIED: 'VERIFIED',
  UNKNOWN: 'UNKNOWN',
  UNSUPPORTED: 'UNSUPPORTED',
  INVALID_OPERATING_STATE: 'INVALID_OPERATING_STATE',
  SATURATED: 'SATURATED',
  SOLVER_INVALID: 'SOLVER_INVALID'
};

/**
 * Normalizes active circuit response per Section 23 specification.
 */
export function normalizeActiveCircuitResult(res) {
  if (!res) {
    return {
      status: ACTIVE_CIRCUIT_STATUSES.UNKNOWN,
      circuitType: 'UNKNOWN',
      error: 'Empty active circuit response',
      source: 'mna_simulation',
      is_measured: false,
      isMeasured: false
    };
  }

  const rawStatus = String(res.status || 'UNKNOWN').toUpperCase();
  const operatingState = String(res.operatingState || res.operating_state || 'UNKNOWN').toUpperCase();

  // Normalize Status
  let normalizedStatus = ACTIVE_CIRCUIT_STATUSES.UNKNOWN;
  if (rawStatus === 'VERIFIED' || rawStatus === 'SUCCESS') {
    normalizedStatus = (operatingState === 'SATURATED')
      ? ACTIVE_CIRCUIT_STATUSES.SATURATED
      : (operatingState === 'INVALID_OPERATING_STATE' ? ACTIVE_CIRCUIT_STATUSES.INVALID_OPERATING_STATE : ACTIVE_CIRCUIT_STATUSES.VERIFIED);
  } else if (Object.values(ACTIVE_CIRCUIT_STATUSES).includes(rawStatus)) {
    normalizedStatus = rawStatus;
  } else if (Object.values(ACTIVE_CIRCUIT_STATUSES).includes(operatingState)) {
    normalizedStatus = operatingState;
  }

  return {
    status: normalizedStatus,
    circuitType: res.circuitType || res.circuit_type || 'UNKNOWN',
    displayName: res.displayName || res.display_name || 'Active Operational Amplifier Circuit',
    icModel: res.icModel || res.ic_model || null,
    pinMapping: res.pinMapping || res.pin_mapping || null,
    operatingState: operatingState,
    isSaturated: operatingState === 'SATURATED',
    transferFunction: res.transferFunction || res.transfer_function || null,
    frequencyResponse: res.frequencyResponse || res.frequency_response || [],
    gain: res.gain || { magnitude: 0, db: 0 },
    phase: res.phase || { degrees: 0 },
    voltages: res.voltages || null,
    feedbackNetwork: res.feedbackNetwork || res.feedback_network || null,
    educationalExplanation: res.educationalExplanation || res.educational_explanation || null,
    visualizationState: res.visualizationState || res.visualization_state || null,
    limitations: res.limitations || null,
    evidence: res.evidence || {},
    error: res.error || null,
    source: 'mna_simulation',
    is_measured: false,
    isMeasured: false
  };
}

export async function requestAcAnalysis(netlist, analysisOptions = {}) {
  const payload = {
    netlist,
    analysis: {
      start_frequency_hz: analysisOptions.startFrequency || 10.0,
      stop_frequency_hz: analysisOptions.stopFrequency || 100000.0,
      points: analysisOptions.points || 80,
      sweep_type: analysisOptions.sweepType || 'log',
      topology_type: analysisOptions.topologyType || 'series'
    },
    response: {
      input_node: analysisOptions.inputNode || null,
      output_node: analysisOptions.outputNode || null
    }
  };

  try {
    const res = await apiRequest('/ac/analyze', 'POST', payload);
    if (res && res.status !== 'offline_mock_fallback') {
      if (res.analysis_type === 'ACTIVE_OPAMP_CIRCUIT' || (res.circuit_type && res.circuit_type.startsWith('OPAMP_'))) {
        return normalizeActiveCircuitResult(res);
      }

      if (res.status === 'success') {
        const normalizedCutoff = res.cutoff ? {
          ...res.cutoff,
          filterMode: res.cutoff.filterMode || res.cutoff.filter_mode,
          fcHz: res.cutoff.fcHz !== undefined ? res.cutoff.fcHz : res.cutoff.fc_hz,
          fLowHz: res.cutoff.fLowHz !== undefined ? res.cutoff.fLowHz : res.cutoff.f_low_hz,
          fHighHz: res.cutoff.fHighHz !== undefined ? res.cutoff.fHighHz : res.cutoff.f_high_hz,
          referenceGain: res.cutoff.referenceGain !== undefined ? res.cutoff.referenceGain : res.cutoff.reference_gain
        } : res.cutoff;

        const normalizedResonance = res.resonance ? {
          ...res.resonance,
          resonanceDetected: res.resonance.resonanceDetected !== undefined ? res.resonance.resonanceDetected : res.resonance.resonance_detected,
          resonantFrequencyHz: res.resonance.resonantFrequencyHz !== undefined ? res.resonance.resonantFrequencyHz : res.resonance.resonant_frequency_hz,
          impedanceAtResonanceOhms: res.resonance.impedanceAtResonanceOhms !== undefined ? res.resonance.impedanceAtResonanceOhms : res.resonance.impedance_at_resonance_ohms,
          currentAtResonanceMA: res.resonance.currentAtResonanceMA !== undefined ? res.resonance.currentAtResonanceMA : res.resonance.current_at_resonance_mA,
          phaseAtResonanceDeg: res.resonance.phaseAtResonanceDeg !== undefined ? res.resonance.phaseAtResonanceDeg : res.resonance.phase_at_resonance_deg
        } : res.resonance;

        const freqResp = res.frequency_response || res.frequencyResponse;
        if (freqResp) {
          freqResp.isMeasured = freqResp.isMeasured !== undefined ? freqResp.isMeasured : freqResp.is_measured;
        }

        return {
          ...res,
          cutoff: normalizedCutoff,
          resonance: normalizedResonance,
          circuitType: res.circuitType || res.circuit_type,
          icModel: res.icModel || res.ic_model,
          pinMapping: res.pinMapping || res.pin_mapping,
          operatingState: res.operatingState || res.operating_state,
          transferFunction: res.transferFunction || res.transfer_function,
          frequencyResponse: freqResp,
          frequency_response: freqResp,
          source: 'mna_simulation',
          is_measured: false,
          isMeasured: false
        };
      }
    }
  } catch (err) {
    // If backend returns an explicit error payload, do not hide solver errors
    if (err?.status && Object.values(ACTIVE_CIRCUIT_STATUSES).includes(err.status)) {
      return normalizeActiveCircuitResult(err);
    }
  }

  // Client-Side Deterministic Complex MNA Fallback
  const clientRes = analyzeClientGeneralizedAcCircuit(netlist, {
    startFrequency: payload.analysis.start_frequency_hz,
    stopFrequency: payload.analysis.stop_frequency_hz,
    points: payload.analysis.points,
    sweepType: payload.analysis.sweep_type,
    topologyType: payload.analysis.topology_type,
    inputNode: payload.response.input_node,
    outputNode: payload.response.output_node
  });

  return {
    status: 'success',
    analysis_type: 'AC_FREQUENCY_DOMAIN',
    circuit_type: clientRes.behavior || 'AC_GENERAL_NETWORK',
    circuitType: clientRes.behavior || 'AC_GENERAL_NETWORK',
    behavior: clientRes.behavior,
    primary_candidate: clientRes.primaryCandidate,
    frequency_response: clientRes.frequencyResponse,
    frequencyResponse: clientRes.frequencyResponse,
    shape_analysis: clientRes.shapeAnalysis,
    cutoff: clientRes.cutoff,
    resonance: clientRes.resonance,
    sweep: clientRes.sweep,
    source: 'mna_simulation',
    is_measured: false,
    isMeasured: false
  };
}

export default {
  ACTIVE_CIRCUIT_STATUSES,
  normalizeActiveCircuitResult,
  requestAcAnalysis
};
