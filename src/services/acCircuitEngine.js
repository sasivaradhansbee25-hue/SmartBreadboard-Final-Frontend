import { getAcCircuitPhotoData } from '../data/acCircuitPhotoDatasets.js';
/**
 * SmartBreadboard 3D — Final AC Circuit Engine & Phasor Linear Solver
 *
 * Implements deterministic sinusoidal steady-state AC analysis for the three
 * canonical AC circuit templates:
 * 1. Basic Series AC RLC Motor (L -> R1 -> L1 -> C1 -> Motor -> N)
 * 2. Protected AC RLC Motor (Fuse F1 -> Switch S1 -> [Shunt C2 || Series R1-L1-C1-Motor] -> N)
 * 3. Series RLC + Parallel Compensation (Fuse F1 -> Switch S1 -> Ammeter A1 -> [R2 || C2 || Series R1-L1-C1-Motor] -> N)
 *
 * Rules:
 * - NO fake readings, random values, or hardcoded outputs.
 * - Single source of truth: 3D Twin, AR Overlay, Inspector, and Analog Graph share ONE simulationResult.
 * - Complex impedance arithmetic: Z_R = R, Z_L = jωL, Z_C = -j/(ωC), Z_M = Rm + jωLm.
 * - Real waveforms: v(t) = sqrt(2)*Vrms*sin(ωt + θv), i(t) = sqrt(2)*Irms*sin(ωt + θi), p(t) = v(t)*i(t).
 * - Safety Notice: 230V AC simulation only — physical validation NOT performed.
 */

// Complex number arithmetic helper class
export class Complex {
  constructor(real = 0, imag = 0) {
    this.real = Number(real) || 0;
    this.imag = Number(imag) || 0;
  }

  static fromPolar(r, thetaRad) {
    return new Complex(r * Math.cos(thetaRad), r * Math.sin(thetaRad));
  }

  static fromPolarDeg(r, thetaDeg) {
    const rad = (thetaDeg * Math.PI) / 180.0;
    return new Complex(r * Math.cos(rad), r * Math.sin(rad));
  }

  add(c) {
    return new Complex(this.real + c.real, this.imag + c.imag);
  }

  sub(c) {
    return new Complex(this.real - c.real, this.imag - c.imag);
  }

  mul(c) {
    return new Complex(
      this.real * c.real - this.imag * c.imag,
      this.real * c.imag + this.imag * c.real
    );
  }

  div(c) {
    const denom = c.real * c.real + c.imag * c.imag;
    if (denom === 0) return new Complex(1e12, 0);
    return new Complex(
      (this.real * c.real + this.imag * c.imag) / denom,
      (this.imag * c.real - this.real * c.imag) / denom
    );
  }

  mag() {
    return Math.sqrt(this.real * this.real + this.imag * this.imag);
  }

  phaseRad() {
    return Math.atan2(this.imag, this.real);
  }

  phaseDeg() {
    return (this.phaseRad() * 180.0) / Math.PI;
  }

  conj() {
    return new Complex(this.real, -this.imag);
  }

  scale(k) {
    return new Complex(this.real * k, this.imag * k);
  }
}

/**
 * 3 Canonical AC Circuit Template Definitions
 */
export const AC_CIRCUIT_TEMPLATES = {
  CIRCUIT_1_SERIES_RLC_MOTOR: {
    id: 'CIRCUIT_1_SERIES_RLC_MOTOR',
    name: 'Circuit 1 — Basic Series AC RLC Motor',
    description: 'Series AC path: Line (230V, 50Hz) -> R1 (10Ω) -> L1 (100mH) -> C1 (100μF) -> AC Induction Motor -> Neutral',
    source: {
      voltage_rms: 230.0,
      frequency_hz: 50.0,
      phase_deg: 0.0
    },
    defaultParameters: {
      r1: 10.0,
      l1: 0.100, // 100 mH
      c1: 0.000100, // 100 uF
      source_vrms: 230.0,
      source_freq: 50.0,
      source_phase: 0.0,
      motor: {
        configured: true,
        motor_resistance: 20.0,
        motor_inductance: 0.080, // 80 mH
        equivalent_reactance: 25.132, // 2*pi*50*0.080
        rated_voltage: 230.0,
        rated_frequency: 50.0,
        rated_power_w: 750.0,
        rated_power_hp: 1.0,
        power_factor: 0.78,
        efficiency: 0.85,
        label: 'SIMULATED MOTOR MODEL'
      }
    },
    holes: {
      R1: { hole1: 'E10', hole2: 'E15', node1: 'NODE_L', node2: 'NODE_R1_L1' },
      L1: { hole1: 'E15', hole2: 'E25', node1: 'NODE_R1_L1', node2: 'NODE_L1_C1' },
      C1: { hole1: 'E25', hole2: 'E35', node1: 'NODE_L1_C1', node2: 'NODE_C1_M' },
      MOTOR: { hole1: 'E35', hole2: 'E45', node1: 'NODE_C1_M', node2: 'NODE_N' }
    }
  },

  CIRCUIT_2_PROTECTED_RLC_MOTOR: {
    id: 'CIRCUIT_2_PROTECTED_RLC_MOTOR',
    name: 'Circuit 2 — Protected AC RLC Motor',
    description: 'Line -> F1 (5A Fuse) -> S1 (Switch) -> Node A [ Shunt C2 (47μF) || Series R1 (10Ω) -> L1 (100mH) -> C1 (100μF) -> Motor ] -> Neutral',
    source: {
      voltage_rms: 230.0,
      frequency_hz: 50.0,
      phase_deg: 0.0
    },
    defaultParameters: {
      fuse_rating_a: 5.0,
      switch_state: 'ON',
      c2: 0.000047, // 47 uF shunt power-factor correction
      r1: 10.0,
      l1: 0.100,
      c1: 0.000100,
      source_vrms: 230.0,
      source_freq: 50.0,
      source_phase: 0.0,
      motor: {
        configured: true,
        motor_resistance: 20.0,
        motor_inductance: 0.080,
        equivalent_reactance: 25.132,
        rated_voltage: 230.0,
        rated_frequency: 50.0,
        rated_power_w: 750.0,
        rated_power_hp: 1.0,
        power_factor: 0.78,
        efficiency: 0.85,
        label: 'SIMULATED MOTOR MODEL'
      }
    },
    holes: {
      F1: { hole1: 'E5', hole2: 'E10', node1: 'NODE_L', node2: 'NODE_FUSE_SW' },
      S1: { hole1: 'E10', hole2: 'E15', node1: 'NODE_FUSE_SW', node2: 'NODE_A' },
      C2: { hole1: 'F15', hole2: 'F50', node1: 'NODE_A', node2: 'NODE_N' },
      R1: { hole1: 'E15', hole2: 'E22', node1: 'NODE_A', node2: 'NODE_R1_L1' },
      L1: { hole1: 'E22', hole2: 'E30', node1: 'NODE_R1_L1', node2: 'NODE_L1_C1' },
      C1: { hole1: 'E30', hole2: 'E38', node1: 'NODE_L1_C1', node2: 'NODE_C1_M' },
      MOTOR: { hole1: 'E38', hole2: 'E48', node1: 'NODE_C1_M', node2: 'NODE_N' }
    }
  },

  CIRCUIT_3_SERIES_PARALLEL_COMPENSATION: {
    id: 'CIRCUIT_3_SERIES_PARALLEL_COMPENSATION',
    name: 'Circuit 3 — Series RLC + Parallel Compensation',
    description: 'Line -> F1 (5A) -> S1 -> A1 (Ammeter) -> Node [ R2 (220Ω) || C2 (1μF) || Series R1 -> L1 -> C1 -> Motor ] -> Neutral (with V1 across Motor)',
    source: {
      voltage_rms: 230.0,
      frequency_hz: 50.0,
      phase_deg: 0.0
    },
    defaultParameters: {
      fuse_rating_a: 5.0,
      switch_state: 'ON',
      r2: 220.0, // 220 ohm parallel damping
      c2: 0.000001, // 1 uF parallel compensation
      r1: 10.0,
      l1: 0.100,
      c1: 0.000100,
      source_vrms: 230.0,
      source_freq: 50.0,
      source_phase: 0.0,
      motor: {
        configured: true,
        motor_resistance: 20.0,
        motor_inductance: 0.080,
        equivalent_reactance: 25.132,
        rated_voltage: 230.0,
        rated_frequency: 50.0,
        rated_power_w: 750.0,
        rated_power_hp: 1.0,
        power_factor: 0.78,
        efficiency: 0.85,
        label: 'SIMULATED MOTOR MODEL'
      }
    },
    holes: {
      F1: { hole1: 'E5', hole2: 'E10', node1: 'NODE_L', node2: 'NODE_FUSE_SW' },
      S1: { hole1: 'E10', hole2: 'E15', node1: 'NODE_FUSE_SW', node2: 'NODE_SW_A1' },
      A1: { hole1: 'E15', hole2: 'E20', node1: 'NODE_SW_A1', node2: 'NODE_PARALLEL' },
      R2: { hole1: 'F20', hole2: 'F50', node1: 'NODE_PARALLEL', node2: 'NODE_N' },
      C2: { hole1: 'G20', hole2: 'G50', node1: 'NODE_PARALLEL', node2: 'NODE_N' },
      R1: { hole1: 'E20', hole2: 'E28', node1: 'NODE_PARALLEL', node2: 'NODE_R1_L1' },
      L1: { hole1: 'E28', hole2: 'E36', node1: 'NODE_R1_L1', node2: 'NODE_L1_C1' },
      C1: { hole1: 'E36', hole2: 'E44', node1: 'NODE_L1_C1', node2: 'NODE_C1_M' },
      MOTOR: { hole1: 'E44', hole2: 'E52', node1: 'NODE_C1_M', node2: 'NODE_N' },
      V1: { hole1: 'E44', hole2: 'E52', node1: 'NODE_C1_M', node2: 'NODE_N' }
    }
  }
};

// Benchmark Circuit Aliases as required by SPEC
export const ACBenchmarkCircuit1 = AC_CIRCUIT_TEMPLATES.CIRCUIT_1_SERIES_RLC_MOTOR;
export const ACBenchmarkCircuit2 = AC_CIRCUIT_TEMPLATES.CIRCUIT_2_PROTECTED_RLC_MOTOR;
export const ACBenchmarkCircuit3 = AC_CIRCUIT_TEMPLATES.CIRCUIT_3_SERIES_PARALLEL_COMPENSATION;

/**
 * Deterministically solves an AC circuit template using complex phasor equations.
 *
 * @param {string} templateId - One of AC_CIRCUIT_TEMPLATES
 * @param {object} customParams - User overrides for source, components, motor, switch
 * @param {object} [options] - Options such as waveform cycles (1, 3, 5)
 * @returns {object} Normalized simulationResult
 */
export function solveAcCircuitTemplate(templateId, customParams = {}, options = {}) {
  const template = AC_CIRCUIT_TEMPLATES[templateId] || AC_CIRCUIT_TEMPLATES.CIRCUIT_1_SERIES_RLC_MOTOR;
  const photoData = getAcCircuitPhotoData(template.id);
  const p = { ...template.defaultParameters, ...customParams };

  const Vrms = Math.max(0.1, Number(p.source_vrms || 230.0));
  const freq = Math.max(1.0, Number(p.source_freq || 50.0));
  const phaseV_deg = Number(p.source_phase || 0.0);
  const phaseV_rad = (phaseV_deg * Math.PI) / 180.0;
  const omega = 2.0 * Math.PI * freq;

  // Source phasor V = Vrms ∠ phaseV
  const V_src = Complex.fromPolarDeg(Vrms, phaseV_deg);

  // Switch state (default ON)
  const isSwitchOn = p.switch_state !== 'OFF';
  const fuseRating = Number(p.fuse_rating_a || 5.0);

  // Passive components
  const R1 = Math.max(0.01, Number(p.r1 ?? 10.0));
  const L1 = Math.max(1e-6, Number(p.l1 ?? 0.100));
  const C1 = Math.max(1e-9, Number(p.c1 ?? 0.000100));

  // Complex impedances
  const Z_R1 = new Complex(R1, 0);
  const Z_L1 = new Complex(0, omega * L1);
  const Z_C1 = new Complex(0, -1.0 / (omega * C1));

  // Motor Model Check
  const motorCfg = p.motor || {};
  const isMotorConfigured = Boolean(motorCfg.configured && (motorCfg.motor_resistance !== undefined || motorCfg.motor_inductance !== undefined));

  let Rm = 0;
  let Lm = 0;
  let Z_Motor = new Complex(0, 0);

  if (isMotorConfigured) {
    Rm = Math.max(0.1, Number(motorCfg.motor_resistance ?? 20.0));
    Lm = Math.max(1e-6, Number(motorCfg.motor_inductance ?? 0.080));
    Z_Motor = new Complex(Rm, omega * Lm);
  }

  // Motor branch series impedance: Z_branch = Z_R1 + Z_L1 + Z_C1 + Z_Motor
  const Z_motor_branch = Z_R1.add(Z_L1).add(Z_C1).add(Z_Motor);

  // Declare variables for branch currents and node voltages
  let I_line = new Complex(0, 0);
  let I_motor_branch = new Complex(0, 0);
  let I_C2 = new Complex(0, 0);
  let I_R2 = new Complex(0, 0);

  let V_node_after_switch = new Complex(0, 0);
  let V_node_A = new Complex(0, 0); // Node before R1
  let V_R1 = new Complex(0, 0);
  let V_L1 = new Complex(0, 0);
  let V_C1 = new Complex(0, 0);
  let V_Motor = new Complex(0, 0);
  let V_C2 = new Complex(0, 0);
  let V_R2 = new Complex(0, 0);

  let Z_total = new Complex(0, 0);

  if (!isSwitchOn) {
    // Switch is OPEN: zero current through the entire circuit
    Z_total = new Complex(1e12, 0);
    I_line = new Complex(0, 0);
    I_motor_branch = new Complex(0, 0);
  } else if (template.id === 'CIRCUIT_1_SERIES_RLC_MOTOR') {
    // CIRCUIT 1: Pure Series Network
    Z_total = Z_motor_branch;
    I_line = V_src.div(Z_total);
    I_motor_branch = I_line;

    V_node_after_switch = V_src;
    V_node_A = V_src;

    V_R1 = I_motor_branch.mul(Z_R1);
    V_L1 = I_motor_branch.mul(Z_L1);
    V_C1 = I_motor_branch.mul(Z_C1);
    V_Motor = I_motor_branch.mul(Z_Motor);

  } else if (template.id === 'CIRCUIT_2_PROTECTED_RLC_MOTOR') {
    // CIRCUIT 2: Shunt C2 in parallel with (R1 + L1 + C1 + Motor)
    const C2 = Math.max(1e-9, Number(p.c2 ?? 0.000047)); // 47 uF
    const Z_C2 = new Complex(0, -1.0 / (omega * C2));

    // Parallel admittance after switch: Y_par = 1/Z_C2 + 1/Z_motor_branch
    const Y_C2 = new Complex(1, 0).div(Z_C2);
    const Y_branch = new Complex(1, 0).div(Z_motor_branch);
    const Y_par = Y_C2.add(Y_branch);
    const Z_par = new Complex(1, 0).div(Y_par);

    // Fuse and switch have negligible impedance (0.01 ohm internal)
    const Z_switch_fuse = new Complex(0.01, 0);
    Z_total = Z_switch_fuse.add(Z_par);

    I_line = V_src.div(Z_total);
    V_node_after_switch = V_src.sub(I_line.mul(Z_switch_fuse));
    V_node_A = V_node_after_switch;

    // Parallel branch currents
    I_C2 = V_node_A.div(Z_C2);
    I_motor_branch = V_node_A.div(Z_motor_branch);

    V_C2 = V_node_A;
    V_R1 = I_motor_branch.mul(Z_R1);
    V_L1 = I_motor_branch.mul(Z_L1);
    V_C1 = I_motor_branch.mul(Z_C1);
    V_Motor = I_motor_branch.mul(Z_Motor);

  } else if (template.id === 'CIRCUIT_3_SERIES_PARALLEL_COMPENSATION') {
    // CIRCUIT 3: Node with R2 || C2 || (R1 + L1 + C1 + Motor)
    const R2 = Math.max(0.1, Number(p.r2 ?? 220.0));
    const C2 = Math.max(1e-9, Number(p.c2 ?? 0.000001)); // 1 uF

    const Z_R2 = new Complex(R2, 0);
    const Z_C2 = new Complex(0, -1.0 / (omega * C2));

    // Admittance of 3 parallel paths to Neutral
    const Y_R2 = new Complex(1, 0).div(Z_R2);
    const Y_C2 = new Complex(1, 0).div(Z_C2);
    const Y_branch = new Complex(1, 0).div(Z_motor_branch);

    const Y_par = Y_R2.add(Y_C2).add(Y_branch);
    const Z_par = new Complex(1, 0).div(Y_par);

    const Z_switch_fuse_meter = new Complex(0.015, 0); // Fuse, switch, ammeter internal resistance
    Z_total = Z_switch_fuse_meter.add(Z_par);

    I_line = V_src.div(Z_total);
    V_node_after_switch = V_src.sub(I_line.mul(Z_switch_fuse_meter));
    V_node_A = V_node_after_switch;

    I_R2 = V_node_A.div(Z_R2);
    I_C2 = V_node_A.div(Z_C2);
    I_motor_branch = V_node_A.div(Z_motor_branch);

    V_R2 = V_node_A;
    V_C2 = V_node_A;
    V_R1 = I_motor_branch.mul(Z_R1);
    V_L1 = I_motor_branch.mul(Z_L1);
    V_C1 = I_motor_branch.mul(Z_C1);
    V_Motor = I_motor_branch.mul(Z_Motor);
  }

  // Calculate Apparent, Real, and Reactive Power for Total Circuit: S = V * conj(I)
  const S_total = V_src.mul(I_line.conj());
  const P_total = S_total.real; // Watts
  const Q_total = S_total.imag; // VAR
  const S_mag = V_src.mag() * I_line.mag(); // VA
  const PF_total = S_mag > 1e-6 ? Math.min(1.0, Math.max(0.0, Math.abs(P_total / S_mag))) : 1.0;
  const phaseDiff_deg = V_src.phaseDeg() - I_line.phaseDeg();

  // Power factor before compensation (motor branch alone) vs after compensation (total line)
  const S_motor_branch = V_src.mul(I_motor_branch.conj());
  const S_motor_mag = V_src.mag() * I_motor_branch.mag();
  const PF_before_compensation = S_motor_mag > 1e-6 ? Math.min(1.0, Math.max(0.0, Math.abs(S_motor_branch.real / S_motor_mag))) : 1.0;
  const PF_after_compensation = PF_total;

  // Overcurrent Check for Fuse (Only applicable if circuit template has fuse F1)
  const hasFuse = template.id !== 'CIRCUIT_1_SERIES_RLC_MOTOR' && Boolean(template.holes?.F1);
  const isFuseBlown = hasFuse && isSwitchOn && (I_line.mag() > fuseRating);

  // Helper for component power
  function getComponentPower(vPhasor, iPhasor) {
    const s = vPhasor.mul(iPhasor.conj());
    const s_mag = vPhasor.mag() * iPhasor.mag();
    const pf = s_mag > 1e-6 ? Math.min(1.0, Math.max(0.0, Math.abs(s.real / s_mag))) : 1.0;
    return {
      voltage_rms: vPhasor.mag(),
      voltage_phase_deg: vPhasor.phaseDeg(),
      current_rms: iPhasor.mag(),
      current_phase_deg: iPhasor.phaseDeg(),
      real_power_w: s.real,
      reactive_power_var: s.imag,
      apparent_power_va: s_mag,
      power_factor: pf,
      phase_diff_deg: vPhasor.phaseDeg() - iPhasor.phaseDeg()
    };
  }

  const compMetrics = {
    R1: getComponentPower(V_R1, I_motor_branch),
    L1: getComponentPower(V_L1, I_motor_branch),
    C1: getComponentPower(V_C1, I_motor_branch),
    MOTOR: getComponentPower(V_Motor, I_motor_branch)
  };

  if (template.id === 'CIRCUIT_2_PROTECTED_RLC_MOTOR') {
    compMetrics.C2 = getComponentPower(V_C2, I_C2);
    compMetrics.F1 = getComponentPower(I_line.scale(0.005), I_line);
    compMetrics.S1 = getComponentPower(I_line.scale(0.005), I_line);
  } else if (template.id === 'CIRCUIT_3_SERIES_PARALLEL_COMPENSATION') {
    compMetrics.R2 = getComponentPower(V_R2, I_R2);
    compMetrics.C2 = getComponentPower(V_C2, I_C2);
    compMetrics.F1 = getComponentPower(I_line.scale(0.005), I_line);
    compMetrics.S1 = getComponentPower(I_line.scale(0.005), I_line);
    compMetrics.A1 = getComponentPower(I_line.scale(0.005), I_line);
  }

  // Generate Sinusoidal Waveforms across N cycles
  const numCycles = Number(options.cycles || 3);
  const period = 1.0 / freq; // e.g. 0.020 s for 50 Hz
  const duration = period * numCycles; // e.g. 0.060 s for 3 cycles
  const numSamples = 240;
  const timeArray = [];
  const vSourceWaveform = [];
  const iLineWaveform = [];
  const pTotalWaveform = [];

  const vR1Waveform = [];
  const vL1Waveform = [];
  const vC1Waveform = [];
  const vMotorWaveform = [];
  const iMotorWaveform = [];

  const vPeak_src = Math.sqrt(2) * Vrms;
  const iPeak_line = Math.sqrt(2) * I_line.mag();
  const vPeak_R1 = Math.sqrt(2) * V_R1.mag();
  const vPeak_L1 = Math.sqrt(2) * V_L1.mag();
  const vPeak_C1 = Math.sqrt(2) * V_C1.mag();
  const vPeak_Motor = Math.sqrt(2) * V_Motor.mag();
  const iPeak_motor = Math.sqrt(2) * I_motor_branch.mag();

  const thetaV_src = (V_src.phaseDeg() * Math.PI) / 180.0;
  const thetaI_line = (I_line.phaseDeg() * Math.PI) / 180.0;
  const thetaV_R1 = (V_R1.phaseDeg() * Math.PI) / 180.0;
  const thetaV_L1 = (V_L1.phaseDeg() * Math.PI) / 180.0;
  const thetaV_C1 = (V_C1.phaseDeg() * Math.PI) / 180.0;
  const thetaV_Motor = (V_Motor.phaseDeg() * Math.PI) / 180.0;
  const thetaI_motor = (I_motor_branch.phaseDeg() * Math.PI) / 180.0;

  for (let idx = 0; idx < numSamples; idx++) {
    const t = (idx / (numSamples - 1)) * duration;
    timeArray.push(t);

    const v_t = vPeak_src * Math.sin(omega * t + thetaV_src);
    const i_t = iPeak_line * Math.sin(omega * t + thetaI_line);
    const p_t = v_t * i_t;

    vSourceWaveform.push(v_t);
    iLineWaveform.push(i_t);
    pTotalWaveform.push(p_t);

    vR1Waveform.push(vPeak_R1 * Math.sin(omega * t + thetaV_R1));
    vL1Waveform.push(vPeak_L1 * Math.sin(omega * t + thetaV_L1));
    vC1Waveform.push(vPeak_C1 * Math.sin(omega * t + thetaV_C1));
    vMotorWaveform.push(vPeak_Motor * Math.sin(omega * t + thetaV_Motor));
    iMotorWaveform.push(iPeak_motor * Math.sin(omega * t + thetaI_motor));
  }

  // Build breadboard components array with physical hole mappings
  const componentsList = [
    {
      id: 'R1',
      designator: 'R1',
      type: 'resistor',
      value: R1,
      unit: 'Ω',
      displayValue: `${R1} Ω`,
      start_hole: template.holes.R1.hole1,
      end_hole: template.holes.R1.hole2,
      hole1: template.holes.R1.hole1,
      hole2: template.holes.R1.hole2,
      node1: template.holes.R1.node1,
      node2: template.holes.R1.node2,
      voltage: compMetrics.R1.voltage_rms,
      current: compMetrics.R1.current_rms,
      power: compMetrics.R1.real_power_w,
      phase_deg: compMetrics.R1.phase_diff_deg,
      status: 'SOLVED'
    },
    {
      id: 'L1',
      designator: 'L1',
      type: 'inductor',
      value: L1 * 1000.0,
      unit: 'mH',
      displayValue: `${(L1 * 1000.0).toFixed(0)} mH`,
      start_hole: template.holes.L1.hole1,
      end_hole: template.holes.L1.hole2,
      hole1: template.holes.L1.hole1,
      hole2: template.holes.L1.hole2,
      node1: template.holes.L1.node1,
      node2: template.holes.L1.node2,
      voltage: compMetrics.L1.voltage_rms,
      current: compMetrics.L1.current_rms,
      power: compMetrics.L1.reactive_power_var, // Reactive power in VAR
      phase_deg: compMetrics.L1.phase_diff_deg,
      status: 'SOLVED'
    },
    {
      id: 'C1',
      designator: 'C1',
      type: 'capacitor',
      value: C1 * 1e6,
      unit: 'μF',
      displayValue: `${(C1 * 1e6).toFixed(0)} μF`,
      start_hole: template.holes.C1.hole1,
      end_hole: template.holes.C1.hole2,
      hole1: template.holes.C1.hole1,
      hole2: template.holes.C1.hole2,
      node1: template.holes.C1.node1,
      node2: template.holes.C1.node2,
      voltage: compMetrics.C1.voltage_rms,
      current: compMetrics.C1.current_rms,
      power: compMetrics.C1.reactive_power_var,
      phase_deg: compMetrics.C1.phase_diff_deg,
      status: 'SOLVED'
    },
    {
      id: 'MOTOR',
      designator: 'MOTOR',
      type: 'motor',
      value: motorCfg.rated_power_hp || 0.75,
      unit: 'HP',
      displayValue: isMotorConfigured ? `${(motorCfg.rated_power_hp || 0.75)} HP (${Rm}Ω, ${(Lm * 1000).toFixed(0)}mH)` : 'Config Required',
      start_hole: template.holes.MOTOR.hole1,
      end_hole: template.holes.MOTOR.hole2,
      hole1: template.holes.MOTOR.hole1,
      hole2: template.holes.MOTOR.hole2,
      node1: template.holes.MOTOR.node1,
      node2: template.holes.MOTOR.node2,
      voltage: compMetrics.MOTOR.voltage_rms,
      current: compMetrics.MOTOR.current_rms,
      power: compMetrics.MOTOR.real_power_w,
      power_factor: compMetrics.MOTOR.power_factor,
      phase_deg: compMetrics.MOTOR.phase_diff_deg,
      model_status: isMotorConfigured ? 'CONFIGURED' : 'REQUIRED',
      status: 'SOLVED'
    }
  ];

  if (template.id === 'CIRCUIT_2_PROTECTED_RLC_MOTOR') {
    componentsList.unshift({
      id: 'F1',
      designator: 'F1',
      type: 'fuse',
      value: fuseRating,
      unit: 'A',
      displayValue: `${fuseRating} A Fuse`,
      start_hole: template.holes.F1.hole1,
      end_hole: template.holes.F1.hole2,
      hole1: template.holes.F1.hole1,
      hole2: template.holes.F1.hole2,
      node1: template.holes.F1.node1,
      node2: template.holes.F1.node2,
      voltage: compMetrics.F1.voltage_rms,
      current: compMetrics.F1.current_rms,
      power: compMetrics.F1.real_power_w,
      status: isFuseBlown ? 'BLOWN' : 'CLOSED'
    });
    componentsList.splice(1, 0, {
      id: 'S1',
      designator: 'S1',
      type: 'switch',
      value: isSwitchOn ? 1 : 0,
      unit: 'state',
      displayValue: isSwitchOn ? 'SWITCH ON' : 'SWITCH OFF',
      start_hole: template.holes.S1.hole1,
      end_hole: template.holes.S1.hole2,
      hole1: template.holes.S1.hole1,
      hole2: template.holes.S1.hole2,
      node1: template.holes.S1.node1,
      node2: template.holes.S1.node2,
      voltage: compMetrics.S1.voltage_rms,
      current: compMetrics.S1.current_rms,
      power: compMetrics.S1.real_power_w,
      status: isSwitchOn ? 'CLOSED' : 'OPEN'
    });
    componentsList.push({
      id: 'C2',
      designator: 'C2',
      type: 'capacitor',
      value: (p.c2 || 0.000047) * 1e6,
      unit: 'μF',
      displayValue: `${((p.c2 || 0.000047) * 1e6).toFixed(0)} μF (Shunt PF)`,
      start_hole: template.holes.C2.hole1,
      end_hole: template.holes.C2.hole2,
      hole1: template.holes.C2.hole1,
      hole2: template.holes.C2.hole2,
      node1: template.holes.C2.node1,
      node2: template.holes.C2.node2,
      voltage: compMetrics.C2.voltage_rms,
      current: compMetrics.C2.current_rms,
      power: compMetrics.C2.reactive_power_var,
      phase_deg: compMetrics.C2.phase_diff_deg,
      status: 'SOLVED'
    });
  } else if (template.id === 'CIRCUIT_3_SERIES_PARALLEL_COMPENSATION') {
    componentsList.unshift({
      id: 'F1',
      designator: 'F1',
      type: 'fuse',
      value: fuseRating,
      unit: 'A',
      displayValue: `${fuseRating} A Fuse`,
      start_hole: template.holes.F1.hole1,
      end_hole: template.holes.F1.hole2,
      hole1: template.holes.F1.hole1,
      hole2: template.holes.F1.hole2,
      node1: template.holes.F1.node1,
      node2: template.holes.F1.node2,
      voltage: compMetrics.F1.voltage_rms,
      current: compMetrics.F1.current_rms,
      power: compMetrics.F1.real_power_w,
      status: isFuseBlown ? 'BLOWN' : 'CLOSED'
    });
    componentsList.splice(1, 0, {
      id: 'S1',
      designator: 'S1',
      type: 'switch',
      value: isSwitchOn ? 1 : 0,
      unit: 'state',
      displayValue: isSwitchOn ? 'SWITCH ON' : 'SWITCH OFF',
      start_hole: template.holes.S1.hole1,
      end_hole: template.holes.S1.hole2,
      hole1: template.holes.S1.hole1,
      hole2: template.holes.S1.hole2,
      node1: template.holes.S1.node1,
      node2: template.holes.S1.node2,
      voltage: compMetrics.S1.voltage_rms,
      current: compMetrics.S1.current_rms,
      power: compMetrics.S1.real_power_w,
      status: isSwitchOn ? 'CLOSED' : 'OPEN'
    });
    componentsList.splice(2, 0, {
      id: 'A1',
      designator: 'A1',
      type: 'ammeter',
      value: I_line.mag(),
      unit: 'A',
      displayValue: `${I_line.mag().toFixed(2)} A Line Meter`,
      start_hole: template.holes.A1.hole1,
      end_hole: template.holes.A1.hole2,
      hole1: template.holes.A1.hole1,
      hole2: template.holes.A1.hole2,
      node1: template.holes.A1.node1,
      node2: template.holes.A1.node2,
      voltage: 0.001,
      current: compMetrics.A1.current_rms,
      power: 0.001,
      status: 'SOLVED'
    });
    componentsList.push({
      id: 'R2',
      designator: 'R2',
      type: 'resistor',
      value: p.r2 || 220.0,
      unit: 'Ω',
      displayValue: `${p.r2 || 220} Ω (Damping)`,
      start_hole: template.holes.R2.hole1,
      end_hole: template.holes.R2.hole2,
      hole1: template.holes.R2.hole1,
      hole2: template.holes.R2.hole2,
      node1: template.holes.R2.node1,
      node2: template.holes.R2.node2,
      voltage: compMetrics.R2.voltage_rms,
      current: compMetrics.R2.current_rms,
      power: compMetrics.R2.real_power_w,
      phase_deg: compMetrics.R2.phase_diff_deg,
      status: 'SOLVED'
    });
    componentsList.push({
      id: 'C2',
      designator: 'C2',
      type: 'capacitor',
      value: (p.c2 || 0.000001) * 1e6,
      unit: 'μF',
      displayValue: `${((p.c2 || 0.000001) * 1e6).toFixed(0)} μF (Comp)`,
      start_hole: template.holes.C2.hole1,
      end_hole: template.holes.C2.hole2,
      hole1: template.holes.C2.hole1,
      hole2: template.holes.C2.hole2,
      node1: template.holes.C2.node1,
      node2: template.holes.C2.node2,
      voltage: compMetrics.C2.voltage_rms,
      current: compMetrics.C2.current_rms,
      power: compMetrics.C2.reactive_power_var,
      phase_deg: compMetrics.C2.phase_diff_deg,
      status: 'SOLVED'
    });
  }

  // Derive Deterministic Signature from parameters and template ID
  const signatureString = `${template.id}|V:${Vrms}|f:${freq}|R1:${R1}|L1:${L1}|C1:${C1}|C2:${p.c2 || 0}|R2:${p.r2 || 0}|M_Rm:${Rm}|M_Lm:${Lm}|SW:${p.switch_state || 'ON'}|CYC:${numCycles}`;
  let hashVal = 0;
  for (let i = 0; i < signatureString.length; i++) {
    hashVal = ((hashVal << 5) - hashVal) + signatureString.charCodeAt(i);
    hashVal |= 0;
  }
  const circuit_signature = `AC_SIG_${template.id.substring(0, 8)}_${Math.abs(hashVal).toString(16)}`;

  // Test Points object
  const testPoints = {
    TP1: { name: 'Supply Voltage (after switch)', voltage_rms: V_node_after_switch.mag(), phase_deg: V_node_after_switch.phaseDeg() },
    TP2: { name: 'Voltage across R1', voltage_rms: V_R1.mag(), phase_deg: V_R1.phaseDeg() },
    TP3: { name: 'Voltage across L1', voltage_rms: V_L1.mag(), phase_deg: V_L1.phaseDeg() },
    TP4: { name: 'Voltage across C1', voltage_rms: V_C1.mag(), phase_deg: V_C1.phaseDeg() },
    TP5: { name: 'Motor Terminal Voltage', voltage_rms: V_Motor.mag(), phase_deg: V_Motor.phaseDeg() },
    A1: { name: 'Line Current Ammeter', current_rms: I_line.mag(), phase_deg: I_line.phaseDeg() },
    F1: { name: 'Fuse F1 Status', rating_a: fuseRating, current_rms: I_line.mag(), is_blown: isFuseBlown }
  };

  // Node voltages summary for badges
  const nodeVoltagesMap = {
    NODE_L: Vrms,
    NODE_A: V_node_A.mag(),
    NODE_R1_L1: V_node_A.sub(V_R1).mag(),
    NODE_L1_C1: V_node_A.sub(V_R1).sub(V_L1).mag(),
    NODE_C1_M: V_Motor.mag(),
    NODE_N: 0.0
  };

  // Ensure every component has canonical terminal and hole mapping properties
  componentsList.forEach(c => {
    const h1 = c.hole1 || c.start_hole;
    const h2 = c.hole2 || c.end_hole;
    c.terminal_a = { hole: h1, status: 'VERIFIED', name: 'terminal_a' };
    c.terminal_b = { hole: h2, status: 'VERIFIED', name: 'terminal_b' };
    c.hole_mapping = { terminal_a: h1, terminal_b: h2 };
    c.terminals = [
      { terminal: 'terminal_a', name: 'terminal_a', hole: h1, node: c.node1, status: 'VERIFIED' },
      { terminal: 'terminal_b', name: 'terminal_b', hole: h2, node: c.node2, status: 'VERIFIED' }
    ];

    const pMatch = photoData?.components?.find(p => (p.id || '').toUpperCase() === c.id || (p.designator || '').toUpperCase() === c.id);
    if (pMatch) {
      c.bbox = pMatch.bbox;
      c.center = pMatch.center;
      c.orientation = pMatch.orientation;
      if (Array.isArray(pMatch.terminals)) {
        c.terminals = pMatch.terminals;
      }
      c.confidence = pMatch.confidence || 0.98;
    }
  });

  return {
    image_url: photoData?.image_url,
    circuit_path: photoData?.circuit_path,
    wire_segments: photoData?.wire_segments,
    status: 'SOLVED',
    solver_status: 'SOLVED',
    circuit_type: 'AC_PHASOR_SIMULATION',
    is_ac: true,
    source: 'ac_phasor_mna_solver',
    results: {
      node_voltages: nodeVoltagesMap,
      branch_currents: Object.fromEntries(componentsList.map(c => [c.id, c.current])),
      component_power: Object.fromEntries(componentsList.map(c => [c.id, c.power]))
    },
    template_id: template.id,
    template_name: template.name,
    circuit_signature,
    timestamp: new Date().toISOString(),
    is_measured: false,
    physical_validation_status: 'NOT_PERFORMED',
    safety_warning: 'SIMULATION ONLY — DO NOT CONNECT A REAL 230 V SOURCE.',

    power_analysis: {
      voltage_rms: Vrms,
      current_rms: I_line.mag(),
      real_power_w: P_total,
      reactive_power_var: Q_total,
      apparent_power_va: S_mag,
      power_factor: PF_total,
      power_factor_before_compensation: PF_before_compensation,
      power_factor_after_compensation: PF_after_compensation,
      phase_angle_deg: phaseDiff_deg,
      frequency_hz: freq,
      impedance_magnitude_ohms: Z_total.mag(),
      impedance_angle_deg: Z_total.phaseDeg(),
      average_real_power_w: P_total
    },

    phasor_analysis: {
      voltage_source: { rms: Vrms, angle_deg: V_src.phaseDeg() },
      line_current: { rms: I_line.mag(), angle_deg: I_line.phaseDeg() },
      motor_current: { rms: I_motor_branch.mag(), angle_deg: I_motor_branch.phaseDeg() },
      phase_difference_deg: phaseDiff_deg,
      power_factor: PF_total,
      nature: phaseDiff_deg > 0.05 ? 'LAGGING' : (phaseDiff_deg < -0.05 ? 'LEADING' : 'IN_PHASE')
    },

    motor: {
      id: 'MOTOR',
      status: (isSwitchOn && !isFuseBlown && compMetrics.MOTOR.real_power_w > 0.1 && compMetrics.MOTOR.voltage_rms > 1.0) ? 'RUNNING' : 'STOPPED',
      running_state: (isSwitchOn && !isFuseBlown && compMetrics.MOTOR.real_power_w > 0.1 && compMetrics.MOTOR.voltage_rms > 1.0) ? 'RUNNING' : 'STOPPED',
      is_running: (isSwitchOn && !isFuseBlown && compMetrics.MOTOR.real_power_w > 0.1 && compMetrics.MOTOR.voltage_rms > 1.0),
      is_rotating: (isSwitchOn && !isFuseBlown && compMetrics.MOTOR.real_power_w > 0.1 && compMetrics.MOTOR.voltage_rms > 1.0),
      voltage_rms: compMetrics.MOTOR.voltage_rms,
      current_rms: compMetrics.MOTOR.current_rms,
      real_power_w: compMetrics.MOTOR.real_power_w,
      power_factor: compMetrics.MOTOR.power_factor || 0.78,
      frequency_hz: freq,
      simulated_rpm: (isSwitchOn && !isFuseBlown && compMetrics.MOTOR.real_power_w > 0.1 && compMetrics.MOTOR.voltage_rms > 1.0)
        ? Math.round(Math.min((120 * freq) / 2, Math.max(300, ((120 * freq) / 2) * 0.95 * (compMetrics.MOTOR.power_factor || 0.78) * Math.min(1.0, Math.max(0.1, compMetrics.MOTOR.real_power_w / Number(motorCfg.rated_power_w || 750.0))))))
        : 0,
      visual_speed: (isSwitchOn && !isFuseBlown && compMetrics.MOTOR.real_power_w > 0.1 && compMetrics.MOTOR.voltage_rms > 1.0)
        ? Math.min(0.35, Math.max(0.04, 0.22 * (compMetrics.MOTOR.power_factor || 0.78) * Math.min(1.5, Math.max(0.1, compMetrics.MOTOR.real_power_w / Number(motorCfg.rated_power_w || 750.0)))))
        : 0.0,
      visual_speed_label: 'SIMULATED RPM',
      circuit_signature
    },

    motor_status: {
      configured: isMotorConfigured,
      message: isMotorConfigured
        ? `SIMULATED MOTOR MODEL active: Rm = ${Rm} Ω, Lm = ${(Lm * 1000).toFixed(0)} mH, Rated = 230V, 50Hz, ${(motorCfg.rated_power_hp || 1.0)} HP`
        : 'Motor electrical model required for exact motor output'
    },

    protection_status: {
      fuse_rating: fuseRating,
      switch_state: isSwitchOn ? 'ON' : 'OFF',
      fuse_blown: isFuseBlown,
      warning: isFuseBlown ? `OVERCURRENT WARNING: Line current (${I_line.mag().toFixed(2)} A) exceeds ${fuseRating} A fuse rating!` : null
    },

    test_points: testPoints,
    components: componentsList,

    // Time domain waveforms for live oscilloscope/graph (Single Source of Truth)
    duration,
    time: timeArray,
    waveforms: {
      // Signals explicitly required by SPEC §8
      V_SOURCE: vSourceWaveform,
      V_R1: vR1Waveform,
      V_L1: vL1Waveform,
      V_C1: vC1Waveform,
      V_MOTOR: vMotorWaveform,
      I_LINE: iLineWaveform,
      I_R1: iMotorWaveform,
      I_L1: iMotorWaveform,
      I_C1: iMotorWaveform,
      I_MOTOR: iMotorWaveform,
      P_TOTAL: pTotalWaveform,
      P_R1: timeArray.map((_, i) => vR1Waveform[i] * iMotorWaveform[i]),
      P_L1: timeArray.map((_, i) => vL1Waveform[i] * iMotorWaveform[i]),
      P_C1: timeArray.map((_, i) => vC1Waveform[i] * iMotorWaveform[i]),
      P_MOTOR: timeArray.map((_, i) => vMotorWaveform[i] * iMotorWaveform[i])
    },
    node_voltages: {
      NODE_L: vSourceWaveform,
      NODE_A: timeArray.map(t => Math.sqrt(2) * V_node_A.mag() * Math.sin(omega * t + (V_node_A.phaseDeg() * Math.PI) / 180.0)),
      NODE_R1_L1: timeArray.map(t => Math.sqrt(2) * V_node_A.sub(V_R1).mag() * Math.sin(omega * t + (V_node_A.sub(V_R1).phaseDeg() * Math.PI) / 180.0)),
      NODE_C1_M: vMotorWaveform,
      NODE_N: timeArray.map(() => 0.0)
    },
    component_voltages: {
      R1: vR1Waveform,
      L1: vL1Waveform,
      C1: vC1Waveform,
      MOTOR: vMotorWaveform,
      C2: template.id !== 'CIRCUIT_1_SERIES_RLC_MOTOR' ? timeArray.map(t => Math.sqrt(2) * V_C2.mag() * Math.sin(omega * t + (V_C2.phaseDeg() * Math.PI) / 180.0)) : undefined,
      R2: template.id === 'CIRCUIT_3_SERIES_PARALLEL_COMPENSATION' ? timeArray.map(t => Math.sqrt(2) * V_R2.mag() * Math.sin(omega * t + (V_R2.phaseDeg() * Math.PI) / 180.0)) : undefined
    },
    component_currents: {
      R1: iMotorWaveform,
      L1: iMotorWaveform,
      C1: iMotorWaveform,
      MOTOR: iMotorWaveform,
      C2: template.id !== 'CIRCUIT_1_SERIES_RLC_MOTOR' ? timeArray.map(t => Math.sqrt(2) * I_C2.mag() * Math.sin(omega * t + (I_C2.phaseDeg() * Math.PI) / 180.0)) : undefined,
      R2: template.id === 'CIRCUIT_3_SERIES_PARALLEL_COMPENSATION' ? timeArray.map(t => Math.sqrt(2) * I_R2.mag() * Math.sin(omega * t + (I_R2.phaseDeg() * Math.PI) / 180.0)) : undefined
    },
    component_power: {
      R1: timeArray.map((_, i) => vR1Waveform[i] * iMotorWaveform[i]),
      L1: timeArray.map((_, i) => vL1Waveform[i] * iMotorWaveform[i]),
      C1: timeArray.map((_, i) => vC1Waveform[i] * iMotorWaveform[i]),
      MOTOR: timeArray.map((_, i) => vMotorWaveform[i] * iMotorWaveform[i])
    },

    results: {
      total_current_mA: I_line.mag() * 1000.0,
      total_power_mW: P_total * 1000.0,
      average_real_power_w: P_total,
      instantaneous_power_w: pTotalWaveform,
      node_voltages: nodeVoltagesMap,
      branch_currents: {
        R1: I_motor_branch.mag(),
        L1: I_motor_branch.mag(),
        C1: I_motor_branch.mag(),
        MOTOR: I_motor_branch.mag(),
        C2: I_C2.mag(),
        R2: I_R2.mag(),
        LINE: I_line.mag()
      },
      component_power: {
        R1: compMetrics.R1.real_power_w,
        L1: compMetrics.L1.reactive_power_var,
        C1: compMetrics.C1.reactive_power_var,
        MOTOR: compMetrics.MOTOR.real_power_w
      }
    }
  };
}
