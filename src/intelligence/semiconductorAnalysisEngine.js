/**
 * SmartBreadboard 3D — Semiconductor Analysis Engine (Phase 30)
 * Normalizes semiconductor transient response, validates topology state,
 * extracts waveform metrics, and prepares AR / 3D state representations.
 * 
 * Scientific Integrity:
 * - source: "nonlinear_transient_mna_simulation"
 * - isMeasured: false
 * - physicalValidationStatus: "NOT_PERFORMED"
 */

import { getSemiconductorDefinition } from "./semiconductorRegistry.js";

export function normalizeSemiconductorResponse(apiResponse) {
  if (!apiResponse) {
    return {
      status: "ERROR",
      circuitType: "UNSUPPORTED",
      operatingState: "OFF",
      signals: [],
      deviceStates: [],
      metrics: {},
      solver: { converged: false, maxIterationsUsed: 0 },
      isMeasured: false,
      physicalValidationStatus: "NOT_PERFORMED",
      source: "nonlinear_transient_mna_simulation"
    };
  }

  const status = apiResponse.status || "UNKNOWN";
  const circuitType = apiResponse.circuit_type || apiResponse.circuitType || "GENERIC_NONLINEAR_CIRCUIT";
  const time = apiResponse.time || [];
  const signals = apiResponse.signals || [];
  const deviceStates = apiResponse.device_states || apiResponse.deviceStates || [];
  const metrics = apiResponse.metrics || {};
  const solver = apiResponse.solver || {
    method: "backward_euler",
    converged: status === "VERIFIED",
    max_iterations_used: 1
  };

  const operatingState = metrics.operating_state || "OFF";
  const peakForwardVoltage = metrics.peak_forward_voltage || 0.0;
  const peakForwardCurrent = metrics.peak_forward_current || 0.0;
  const conductionDutyCycle = metrics.conduction_duty_cycle_percent || 0.0;

  // Determine visualization state
  let visualizationState = "DIODE_OFF";
  if (circuitType === "LED_CURRENT_LIMITER") {
    visualizationState = operatingState === "FORWARD_CONDUCTING" ? "LED_CONDUCTION" : "DIODE_OFF";
  } else if (circuitType.includes("RECTIFIER")) {
    visualizationState = operatingState === "FORWARD_CONDUCTING" ? "RECTIFIER_CONDUCTION" : "RECTIFIER_BLOCKING";
  } else if (operatingState === "FORWARD_CONDUCTING") {
    visualizationState = "DIODE_FORWARD_CONDUCTION";
  } else if (operatingState === "REVERSE_BIASED") {
    visualizationState = "DIODE_REVERSE_BIAS";
  }

  return {
    status,
    circuitType,
    displayName: apiResponse.display_name || "Semiconductor Circuit",
    verificationStatus: apiResponse.verification_status || status,
    primaryDevice: apiResponse.primary_device || "D1",
    governingEquation: apiResponse.governing_equation || "I_D = Is * [ exp(V_D / (n * V_T)) - 1 ]",
    time,
    signals,
    deviceStates,
    metrics: {
      operatingState,
      peakForwardVoltage,
      peakForwardCurrent,
      conductionDutyCycle,
      turnOnTime: metrics.turn_on_time || null,
      turnOffTime: metrics.turn_off_time || null,
      averageCurrent: metrics.average_current || 0.0
    },
    solver: {
      method: solver.method || "backward_euler",
      converged: Boolean(solver.converged),
      maxIterationsUsed: solver.max_iterations_used || solver.maxIterationsUsed || 0
    },
    visualizationState,
    educationalExplanation: apiResponse.educational_explanation || {
      summary: `Semiconductor analysis solved via Newton-Raphson non-linear transient MNA. Operating state: ${operatingState}.`,
      scientificNote: "Simulated numerical result. Physical validation not performed."
    },
    isMeasured: false,
    physicalValidationStatus: "NOT_PERFORMED",
    source: apiResponse.source || "nonlinear_transient_mna_simulation"
  };
}
