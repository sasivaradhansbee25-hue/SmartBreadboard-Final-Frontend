/**
 * SmartBreadboard 3D — Electrical Behaviour Animation Engine (SPEC.md & Antigravity Rules)
 * Purely simulation-driven animation math and visual state resolver.
 * NO random electrical values. NO fake currents. NO fake power.
 */

import * as THREE from 'three';

/**
 * Calculates current flow particle velocity, direction multiplier, and color.
 * Particle speed is strictly proportional to actual simulated current magnitude.
 *
 * @param {number|undefined} current - Current in Amperes
 * @param {string|undefined} directionStr - 'pin1_to_pin2' or 'pin2_to_pin1'
 * @returns {{ active: boolean, speed: number, direction: number, color: number }}
 */
export function calculateCurrentFlowMetrics(current, directionStr) {
  if (current === undefined || current === null || isNaN(current)) {
    return { active: false, speed: 0, direction: 1, color: 0x38bdf8 };
  }

  const absCurrent = Math.abs(current);

  // Less than 1 uA is considered zero current
  if (absCurrent < 1e-6) {
    return { active: false, speed: 0, direction: 1, color: 0x38bdf8 };
  }

  // Direction determination
  let direction = 1;
  if (directionStr === 'pin2_to_pin1') {
    direction = -1;
  } else if (directionStr === 'pin1_to_pin2') {
    direction = 1;
  } else {
    direction = current >= 0 ? 1 : -1;
  }

  // Reference nominal current: 10mA (0.01A)
  // Scaling: smooth sub-linear speed curve clamped between 0.15x and 3.5x
  const refCurrent = 0.01;
  const speed = Math.min(Math.max(Math.pow(absCurrent / refCurrent, 0.75), 0.15), 3.5);

  // Electrical particle color coding based on current density
  let color = 0x38bdf8; // Nominal Cyan
  if (absCurrent > 0.025) {
    color = 0xf59e0b; // High current Amber (>25mA)
  } else if (absCurrent > 0.050) {
    color = 0xf43f5e; // Critical current Rose (>50mA)
  }

  return {
    active: true,
    speed,
    direction,
    color
  };
}

/**
 * Resolves realistic LED glow and emissive properties based on electrical state.
 *
 * @param {Object|null} electrical - Component electrical data { state, current, forward_voltage }
 * @param {string} solverStatus - 'SOLVED', 'NOT_RUN', 'ERROR', etc.
 * @param {number} baseColor - Hex base color of LED (e.g. 0xef4444)
 * @param {number} time - Current elapsed time in seconds
 * @returns {{ isLit: boolean, glowIntensity: number, emissiveIntensity: number, emissiveColor: number, isFault: boolean }}
 */
export function calculateLEDElectricalAnimation(electrical, solverStatus, baseColor, time = 0) {
  const isSolved = (solverStatus === 'SOLVED');

  if (!isSolved || !electrical) {
    return {
      isLit: false,
      glowIntensity: 0.0,
      emissiveIntensity: 0.0,
      emissiveColor: 0x000000,
      isFault: false
    };
  }

  const state = String(electrical.state || '').toUpperCase();
  const current = electrical.current || 0;
  const absCurrent = Math.abs(current);

  // Check for Overcurrent condition (> 35mA)
  if (absCurrent > 0.035) {
    const flashState = Math.sin(time * 14.0) > 0;
    return {
      isLit: true,
      glowIntensity: flashState ? 4.0 : 0.5,
      emissiveIntensity: flashState ? 0.95 : 0.2,
      emissiveColor: 0xef4444, // Red overcurrent warning
      isFault: true
    };
  }

  // Normal LED ON with positive forward current
  if (state === 'ON' && absCurrent >= 0.0005) {
    // Current-proportional brightness: nominal 15mA gives ~2.8 intensity
    const norm = Math.min(absCurrent / 0.015, 2.0);
    const pulse = 1.0 + 0.05 * Math.sin(time * 3.5); // Subtle 0.55 Hz breathing pulse

    const targetGlow = (1.2 + norm * 1.6) * pulse;
    const targetEmissive = Math.min(0.35 + norm * 0.45, 0.95);

    return {
      isLit: true,
      glowIntensity: targetGlow,
      emissiveIntensity: targetEmissive,
      emissiveColor: baseColor,
      isFault: false
    };
  }

  // Reverse biased LED
  if (state === 'REVERSE') {
    return {
      isLit: false,
      glowIntensity: 0.2,
      emissiveIntensity: 0.25,
      emissiveColor: 0xf59e0b, // Amber reverse warning
      isFault: false
    };
  }

  // Normal OFF
  return {
    isLit: false,
    glowIntensity: 0.0,
    emissiveIntensity: 0.0,
    emissiveColor: 0x000000,
    isFault: false
  };
}

/**
 * Calculates subtle localized electrical activity highlight for passive components (Resistors, Diodes).
 *
 * @param {string} compType - Component type
 * @param {Object|null} electrical - Component electrical data
 * @param {string} solverStatus - 'SOLVED', 'NOT_RUN', etc.
 * @param {number} time - Elapsed time in seconds
 * @returns {{ active: boolean, emissiveColor: number, emissiveIntensity: number }}
 */
export function calculateComponentElectricalActivity(compType, electrical, solverStatus, time = 0) {
  if (solverStatus !== 'SOLVED' || !electrical) {
    return { active: false, emissiveColor: 0x000000, emissiveIntensity: 0.0 };
  }

  const type = String(compType || '').toLowerCase();
  const power = electrical.power ?? (electrical.voltage && electrical.current ? Math.abs(electrical.voltage * electrical.current) : 0);

  // Resistor heat/power dissipation highlight
  if (type.includes('resistor')) {
    if (power > 0.001) { // > 1mW
      const intensity = Math.min((power / 0.05) * 0.4, 0.7);
      const color = power > 0.02 ? 0xf43f5e : 0xf59e0b;
      return {
        active: true,
        emissiveColor: color,
        emissiveIntensity: intensity
      };
    }
  }

  // Capacitor electric charge / voltage state highlight
  if (type.includes('capacitor') || type.includes('cap')) {
    const vDrop = Math.abs(electrical.voltage_drop ?? electrical.voltage ?? 0);
    if (vDrop > 0.05) { // Charged above 50mV
      const norm = Math.min(vDrop / 5.0, 1.0);
      const pulse = 1.0 + 0.06 * Math.sin(time * 2.0); // Subtle 0.3Hz charge pulse
      return {
        active: true,
        emissiveColor: 0x38bdf8, // Electric Cyan
        emissiveIntensity: Math.min((0.15 + norm * 0.45) * pulse, 0.75)
      };
    }
  }

  // Inductor magnetic flux / current state highlight
  if (type.includes('inductor') || type.includes('ind')) {
    const current = Math.abs(electrical.current ?? 0);
    if (current > 1e-5) { // Conducting above 10uA
      const norm = Math.min(current / 0.02, 1.0);
      const pulse = 1.0 + 0.08 * Math.sin(time * 4.0); // Inductive flux pulse
      return {
        active: true,
        emissiveColor: 0xf59e0b, // Magnetic Amber
        emissiveIntensity: Math.min((0.2 + norm * 0.5) * pulse, 0.8)
      };
    }
  }

  // Diode / Rectifier conducting state highlight
  if (type.includes('diode')) {
    const state = String(electrical.state || '').toUpperCase();
    if (state === 'CONDUCTING' || state === 'ON') {
      return {
        active: true,
        emissiveColor: 0x10b981,
        emissiveIntensity: 0.35
      };
    }
  }

  return { active: false, emissiveColor: 0x000000, emissiveIntensity: 0.0 };
}

/**
 * Evaluates whether circuit is currently in a verified fault condition.
 *
 * @param {Object} circuit - Current circuit object
 * @param {Object|null} simulationResult - Normalized simulation result
 * @param {string} solverStatus - Current solver status
 * @param {Object|null} solverError - Error details if any
 * @returns {{ isFault: boolean, isUnpowered: boolean, faultType: string, faultMessage: string, faultedComponentIds: string[] }}
 */
export function checkCircuitFaultState(circuit, simulationResult, solverStatus, solverError) {
  const isUnpowered = (solverStatus === 'NOT_RUN' || solverStatus === 'POWER_REQUIRED' || simulationResult?.solver_status === 'NOT_RUN');

  const valStatus = circuit?.validity?.status;
  const isInvalid = valStatus === 'INVALID';
  const isSolverError = solverStatus === 'ERROR' || simulationResult?.solver_status === 'ERROR';

  if (isInvalid || isSolverError) {
    const errors = circuit?.validity?.errors || [];
    const reason = solverError?.message || simulationResult?.reason || (errors.length > 0 ? errors[0] : 'Circuit electrical fault');

    // Extract any component IDs directly named in error message
    const faultedComponentIds = [];
    if (circuit?.components && Array.isArray(circuit.components)) {
      circuit.components.forEach(c => {
        const id = c.id || c.designator;
        if (id && reason.toUpperCase().includes(id.toUpperCase())) {
          faultedComponentIds.push(id);
        }
      });
    }

    return {
      isFault: true,
      isUnpowered: false,
      faultType: isInvalid ? 'VALIDATION_FAULT' : 'SOLVER_FAULT',
      faultMessage: reason,
      faultedComponentIds
    };
  }

  return {
    isFault: false,
    isUnpowered,
    faultType: isUnpowered ? 'UNPOWERED' : 'NORMAL',
    faultMessage: isUnpowered ? 'No active power source' : '',
    faultedComponentIds: []
  };
}
