/**
 * SmartBreadboard 3D — Semiconductor Registry (Phase 30)
 * Defines canonical semiconductor devices (1N4148, 1N4007, Red/Green LEDs, Generic PN Diode)
 * with Shockley parameters, safe limits, terminal configurations, and educational descriptions.
 */

export const SEMICONDUCTOR_REGISTRY = {
  "1N4148": {
    model: "1N4148",
    family: "PN_DIODE",
    displayName: "1N4148 Fast-Switching Diode",
    category: "diode",
    anodeTerminal: "anode",
    cathodeTerminal: "cathode",
    parameters: {
      Is: 2.52e-9,
      n: 1.752,
      temperatureK: 300.0,
      Rs: 0.568,
      Cj0: 4.0e-12,
      V0: 0.75,
      M: 0.333,
      tau_t: 5.0e-9
    },
    nominalForwardVoltage: 0.70,
    maxForwardCurrent: 0.20,
    description: "Standard silicon fast-switching diode for logic and wave-shaping.",
    educationalLaw: "Shockley Diode Equation: I_D = Is * [ exp(V_D / (n * V_T)) - 1 ]"
  },
  "1N4007": {
    model: "1N4007",
    family: "RECTIFIER_DIODE",
    displayName: "1N4007 1A Power Rectifier",
    category: "rectifier",
    anodeTerminal: "anode",
    cathodeTerminal: "cathode",
    parameters: {
      Is: 7.06e-9,
      n: 1.95,
      temperatureK: 300.0,
      Rs: 0.042,
      Cj0: 18.0e-12,
      V0: 0.65,
      M: 0.38,
      tau_t: 5.0e-6
    },
    nominalForwardVoltage: 0.75,
    maxForwardCurrent: 1.0,
    description: "General-purpose 1A rectifier diode for AC-to-DC rectification.",
    educationalLaw: "Power Rectification Conduction & Blocking Transitions"
  },
  "LED_RED": {
    model: "LED_RED",
    family: "LED",
    displayName: "Red Light-Emitting Diode (AlGaAs)",
    category: "led",
    anodeTerminal: "anode",
    cathodeTerminal: "cathode",
    parameters: {
      Is: 1.0e-19,
      n: 1.90,
      temperatureK: 300.0,
      Rs: 5.0,
      Cj0: 15.0e-12,
      V0: 1.90,
      M: 0.33,
      tau_t: 10.0e-9
    },
    nominalForwardVoltage: 1.95,
    maxForwardCurrent: 0.025,
    description: "AlGaAs red LED with bandgap emission (~660nm). Requires series current limiter.",
    educationalLaw: "Radiative Recombination & Direct Bandgap Optoelectronics"
  },
  "LED_GREEN": {
    model: "LED_GREEN",
    family: "LED",
    displayName: "Green Light-Emitting Diode (GaP/InGaN)",
    category: "led",
    anodeTerminal: "anode",
    cathodeTerminal: "cathode",
    parameters: {
      Is: 1.0e-21,
      n: 2.10,
      temperatureK: 300.0,
      Rs: 8.0,
      Cj0: 12.0e-12,
      V0: 2.20,
      M: 0.33,
      tau_t: 10.0e-9
    },
    nominalForwardVoltage: 2.25,
    maxForwardCurrent: 0.025,
    description: "Gallium phosphide green LED with ~565nm emission.",
    educationalLaw: "Wide Bandgap Semiconductor Optoelectronics"
  },
  "GENERIC_DIODE": {
    model: "GENERIC_DIODE",
    family: "PN_DIODE",
    displayName: "Generic Silicon PN Diode",
    category: "diode",
    anodeTerminal: "anode",
    cathodeTerminal: "cathode",
    parameters: {
      Is: 1.0e-14,
      n: 1.0,
      temperatureK: 300.0,
      Rs: 0.1,
      Cj0: 2.0e-12,
      V0: 0.70,
      M: 0.5,
      tau_t: 1.0e-9
    },
    nominalForwardVoltage: 0.70,
    maxForwardCurrent: 0.5,
    description: "Idealized textbook Shockley PN diode model.",
    educationalLaw: "Shockley PN Junction Equation"
  }
};

export function getSemiconductorDefinition(modelName) {
  if (!modelName) return SEMICONDUCTOR_REGISTRY.GENERIC_DIODE;
  const key = String(modelName).toUpperCase().trim();
  return SEMICONDUCTOR_REGISTRY[key] || SEMICONDUCTOR_REGISTRY.GENERIC_DIODE;
}
