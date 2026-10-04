/**
 * SmartBreadboard 3D — Visualization State Engine (Phase 25)
 *
 * Decoupled visualization coordinator that converts verified circuit intelligence
 * and electrical behaviour into declarative visualization instructions for
 * AR Camera Overlay, 3D Digital Twin Canvas, and Interactive Learning Panels.
 *
 * GUARANTEE: AR renderers consume these pure visual states without embedding
 * circuit math or electrical solvers.
 */

import { VISUALIZATION_TYPES, VERIFICATION_STATES } from './circuitKnowledgeRegistry.js';

export function generateVisualizationState(classification, electricalBehaviour, netlist) {
  if (!classification || classification.verificationState === VERIFICATION_STATES.NOT_VERIFIED || classification.verificationState === VERIFICATION_STATES.UNSUPPORTED) {
    return {
      status: classification?.verificationState || 'NOT_VERIFIED',
      circuitType: classification?.circuitType || 'UNKNOWN',
      visualizationType: VISUALIZATION_TYPES.GENERIC_DC_FLOW,
      isEducationalAnimationActive: false,
      componentHighlights: {},
      currentFlow: { enabled: false, branches: [] },
      signalFlow: { type: 'DC', active: false },
      nodeVoltages: [],
      waveforms: [],
      transientState: null,
      educationalAnnotations: [],
      warningBanner: {
        type: classification?.verificationState === VERIFICATION_STATES.UNSUPPORTED ? 'UNSUPPORTED' : 'UNVERIFIED',
        title: classification?.displayName || 'Unverified Circuit',
        message: classification?.warnings?.[0] || 'Circuit topology has not been verified. Educational animations disabled.',
        missingRequirements: classification?.missingRequirements || []
      }
    };
  }

  const { circuitType, matchedComponents, parameters } = classification;
  const compHighlights = {};
  const nodeVoltages = [];
  const annotations = [];

  // =========================================================================
  // 1. VOLTAGE DIVIDER VISUALIZATION
  // =========================================================================
  if (circuitType === 'VOLTAGE_DIVIDER') {
    const rTop = matchedComponents?.r_top;
    const rBot = matchedComponents?.r_bot;
    const p = electricalBehaviour?.parameters;

    if (rTop) {
      const cid = rTop.id || rTop.designator;
      compHighlights[cid] = {
        role: 'PULL_UP',
        roleLabel: 'R1 (Upper Branch)',
        color: '#38bdf8', // Cyan
        haloIntensity: 0.8,
        pulseSpeed: 1.0,
        voltageDrop: p?.powerR1 ? `${(p.powerR1.value / 1000).toFixed(2)} mW` : null,
        tooltip: `R1: Drops ${((p?.sourceVoltage?.value || 5) - (p?.vOutTheoretical?.value || 2.5)).toFixed(2)}V across upper branch`
      };
    }

    if (rBot) {
      const cid = rBot.id || rBot.designator;
      compHighlights[cid] = {
        role: 'PULL_DOWN',
        roleLabel: 'R2 (Lower Branch)',
        color: '#818cf8', // Indigo
        haloIntensity: 0.8,
        pulseSpeed: 1.0,
        voltageDrop: p?.vOutTheoretical ? `${p.vOutTheoretical.formatted}` : null,
        tooltip: `R2: Establishes output voltage potential of ${p?.vOutTheoretical?.formatted || 'N/A'}`
      };
    }

    if (parameters?.node_vout) {
      nodeVoltages.push({
        nodeId: parameters.node_vout,
        label: 'Vout (Divided)',
        voltage: p?.vOutTheoretical?.value || 0,
        formatted: p?.vOutTheoretical?.formatted || '0.00 V',
        color: '#10b981', // Emerald
        badge: 'OUTPUT'
      });
    }

    annotations.push({
      id: 'anno-vdiv-1',
      target: parameters?.node_vout || 'Vout',
      title: 'Intermediate Output Node',
      text: `Vout = ${p?.vOutTheoretical?.formatted || '2.50V'} (${p?.dividerRatio?.formatted || '50%'} of Vin)`
    });

    return {
      status: 'VERIFIED',
      circuitType,
      visualizationType: VISUALIZATION_TYPES.VOLTAGE_DISTRIBUTION,
      isEducationalAnimationActive: true,
      componentHighlights: compHighlights,
      currentFlow: {
        enabled: true,
        branches: [
          {
            id: 'branch-vdiv',
            currentMa: p?.branchCurrent?.value || 5.0,
            formatted: p?.branchCurrent?.formatted || '5.00 mA',
            direction: 'FORWARD',
            speed: 1.2,
            color: '#38bdf8'
          }
        ]
      },
      signalFlow: { type: 'DC', active: true },
      nodeVoltages,
      waveforms: electricalBehaviour?.waveforms || [],
      transientState: null,
      educationalAnnotations: annotations,
      warningBanner: null
    };
  }

  // =========================================================================
  // 2. LED CURRENT LIMITER VISUALIZATION
  // =========================================================================
  if (circuitType === 'LED_CURRENT_LIMITER') {
    const rLimit = matchedComponents?.r_limit;
    const led = matchedComponents?.led;
    const p = electricalBehaviour?.parameters;

    if (rLimit) {
      const cid = rLimit.id || rLimit.designator;
      compHighlights[cid] = {
        role: 'CURRENT_BALLAST',
        roleLabel: 'Ballast Resistor',
        color: '#f59e0b', // Amber
        haloIntensity: 0.85,
        pulseSpeed: 1.0,
        tooltip: `R_limit: Restricts loop current to safe ${p?.forwardCurrent?.formatted || '15 mA'}`
      };
    }

    if (led) {
      const cid = led.id || led.designator;
      compHighlights[cid] = {
        role: 'ACTIVE_EMITTER',
        roleLabel: 'Light Emitting Diode',
        color: '#ef4444', // Red
        haloIntensity: 1.2,
        pulseSpeed: 1.5,
        tooltip: `LED: Emitting light at forward drop Vf = ${p?.vForward?.formatted || '2.00 V'}`
      };
    }

    if (parameters?.node_intermediate) {
      nodeVoltages.push({
        nodeId: parameters.node_intermediate,
        label: 'LED Anode',
        voltage: p?.vForward?.value || 2.0,
        formatted: p?.vForward?.formatted || '2.00 V',
        color: '#ef4444',
        badge: 'ANODE'
      });
    }

    return {
      status: 'VERIFIED',
      circuitType,
      visualizationType: VISUALIZATION_TYPES.CURRENT_LIMITING,
      isEducationalAnimationActive: true,
      componentHighlights: compHighlights,
      currentFlow: {
        enabled: true,
        branches: [
          {
            id: 'branch-led',
            currentMa: p?.forwardCurrent?.value || 13.6,
            formatted: p?.forwardCurrent?.formatted || '13.60 mA',
            direction: 'FORWARD',
            speed: 1.5,
            color: '#ef4444'
          }
        ]
      },
      signalFlow: { type: 'DC', active: true },
      nodeVoltages,
      waveforms: [],
      transientState: null,
      educationalAnnotations: [
        {
          id: 'anno-led-1',
          target: led?.id || 'LED1',
          title: 'Current-Limited LED',
          text: `Operating Current: ${p?.forwardCurrent?.formatted || '13.6 mA'} (${p?.safetyStatus?.formatted || 'SAFE'})`
        }
      ],
      warningBanner: null
    };
  }

  // =========================================================================
  // 3. RC CHARGING VISUALIZATION
  // =========================================================================
  if (circuitType === 'RC_CHARGING') {
    const r = matchedComponents?.r;
    const c = matchedComponents?.c;
    const p = electricalBehaviour?.parameters;

    if (r) {
      const cid = r.id || r.designator;
      compHighlights[cid] = {
        role: 'SERIES_TIMING_RESISTOR',
        roleLabel: 'Timing Resistor (R)',
        color: '#06b6d4', // Cyan
        haloIntensity: 0.8,
        pulseSpeed: 1.0,
        tooltip: `R: Sets charging rate τ = RC = ${p?.tau?.formatted || '1.0 ms'}`
      };
    }

    if (c) {
      const cid = c.id || c.designator;
      compHighlights[cid] = {
        role: 'TIMING_CAPACITOR',
        roleLabel: 'Storage Capacitor (C)',
        color: '#3b82f6', // Blue
        haloIntensity: 1.1,
        pulseSpeed: 1.8,
        tooltip: `C: Accumulating electrostatic charge Q = C × Vin`
      };
    }

    if (parameters?.node_out) {
      nodeVoltages.push({
        nodeId: parameters.node_out,
        label: 'Capacitor Potential v_C(t)',
        voltage: p?.voltage1Tau?.value || 3.16,
        formatted: `${p?.voltage1Tau?.formatted || '63.2% at 1τ'}`,
        color: '#3b82f6',
        badge: 'INTEGRATOR'
      });
    }

    return {
      status: 'VERIFIED',
      circuitType,
      visualizationType: VISUALIZATION_TYPES.RC_CHARGING_WAVEFORM,
      isEducationalAnimationActive: true,
      componentHighlights: compHighlights,
      currentFlow: {
        enabled: true,
        branches: [
          {
            id: 'branch-rc-charging',
            currentMa: 2.5,
            formatted: 'Transient Current i(t)',
            direction: 'FORWARD',
            speed: 1.4,
            color: '#3b82f6'
          }
        ]
      },
      signalFlow: { type: 'STEP_TRANSIENT', active: true },
      nodeVoltages,
      waveforms: electricalBehaviour?.waveforms || [],
      transientState: {
        mode: 'CHARGING',
        tauMs: p?.tau?.value || 1.0,
        tauFormatted: p?.tau?.formatted || '1.0 ms',
        cutoffFrequency: p?.cutoffFrequency?.formatted || '159 Hz'
      },
      educationalAnnotations: [
        {
          id: 'anno-rc-1',
          target: c?.id || 'C1',
          title: 'Exponential Charging Curve',
          text: `Reaches 63.2% at t = 1τ (${p?.tau?.formatted || '1ms'}) and 99.3% at 5τ`
        }
      ],
      warningBanner: null
    };
  }

  // =========================================================================
  // 4. RC DISCHARGING VISUALIZATION
  // =========================================================================
  if (circuitType === 'RC_DISCHARGING') {
    const r = matchedComponents?.r;
    const c = matchedComponents?.c;
    const p = electricalBehaviour?.parameters;

    if (r) {
      const cid = r.id || r.designator;
      compHighlights[cid] = {
        role: 'BLEED_RESISTOR',
        roleLabel: 'Discharge Resistor (R)',
        color: '#a855f7', // Purple
        haloIntensity: 0.8,
        pulseSpeed: 1.0,
        tooltip: `R: Dissipates stored energy as thermal heat`
      };
    }

    if (c) {
      const cid = c.id || c.designator;
      compHighlights[cid] = {
        role: 'ENERGY_SOURCE',
        roleLabel: 'Discharging Capacitor (C)',
        color: '#ec4899', // Pink
        haloIntensity: 1.1,
        pulseSpeed: 1.4,
        tooltip: `C: Discharging exponentially v(t) = V0 × e^(-t/RC)`
      };
    }

    return {
      status: 'VERIFIED',
      circuitType,
      visualizationType: VISUALIZATION_TYPES.RC_DISCHARGING_WAVEFORM,
      isEducationalAnimationActive: true,
      componentHighlights: compHighlights,
      currentFlow: {
        enabled: true,
        branches: [
          {
            id: 'branch-rc-discharge',
            currentMa: 1.5,
            formatted: 'Bleed Current i_decay(t)',
            direction: 'FORWARD',
            speed: 1.0,
            color: '#ec4899'
          }
        ]
      },
      signalFlow: { type: 'DECAY_TRANSIENT', active: true },
      nodeVoltages,
      waveforms: electricalBehaviour?.waveforms || [],
      transientState: {
        mode: 'DISCHARGING',
        tauMs: p?.tau?.value || 1.0,
        halfLife: p?.halfLife?.formatted || '0.693 ms'
      },
      educationalAnnotations: [
        {
          id: 'anno-rc-dis-1',
          target: c?.id || 'C1',
          title: 'Exponential Energy Decay',
          text: `Half-life t½ = ${p?.halfLife?.formatted || '0.693 ms'}`
        }
      ],
      warningBanner: null
    };
  }

  // =========================================================================
  // 5. PARALLEL & SERIES-PARALLEL VISUALIZATION
  // =========================================================================
  if (circuitType === 'PARALLEL_RESISTOR_NETWORK' || circuitType === 'SERIES_PARALLEL_RESISTOR_NETWORK') {
    const p = electricalBehaviour?.parameters;
    const comps = matchedComponents || {};

    for (const [k, comp] of Object.entries(comps)) {
      if (comp) {
        const cid = comp.id || comp.designator;
        compHighlights[cid] = {
          role: k.toUpperCase(),
          roleLabel: `${comp.designator || cid}`,
          color: '#14b8a6', // Teal
          haloIntensity: 0.8,
          pulseSpeed: 1.0,
          tooltip: `Branch: ${comp.detected_value || comp.value || 'Resistor'}`
        };
      }
    }

    return {
      status: 'VERIFIED',
      circuitType,
      visualizationType: circuitType === 'PARALLEL_RESISTOR_NETWORK' ? VISUALIZATION_TYPES.PARALLEL_BRANCH_FLOW : VISUALIZATION_TYPES.SERIES_PARALLEL_FLOW,
      isEducationalAnimationActive: true,
      componentHighlights: compHighlights,
      currentFlow: {
        enabled: true,
        branches: [
          {
            id: 'branch-par-main',
            currentMa: p?.iTotal?.value || 10.0,
            formatted: p?.iTotal?.formatted || '10.00 mA',
            direction: 'FORWARD',
            speed: 1.2,
            color: '#14b8a6'
          }
        ]
      },
      signalFlow: { type: 'DC', active: true },
      nodeVoltages,
      waveforms: [],
      transientState: null,
      educationalAnnotations: [
        {
          id: 'anno-par-1',
          target: 'PARALLEL_BANK',
          title: 'Current Division',
          text: `Total Req = ${p?.rEq?.formatted || p?.rTotal?.formatted || 'N/A'}`
        }
      ],
      warningBanner: null
    };
  }

  // =========================================================================
  // 6. RLC SERIES RESONANCE VISUALIZATION (Phase 26)
  // =========================================================================
  if (circuitType === 'RLC_SERIES_RESONANCE') {
    const r = matchedComponents?.resistor;
    const l = matchedComponents?.inductor;
    const c = matchedComponents?.capacitor;
    const p = electricalBehaviour?.parameters;

    if (r) {
      const cid = r.id || r.designator;
      compHighlights[cid] = {
        role: 'DAMPING_RESISTOR',
        roleLabel: 'Series Resistor (R)',
        color: '#38bdf8', // Cyan
        haloIntensity: 0.9,
        pulseSpeed: 1.2,
        tooltip: `R: Sets peak resonant current I_max = Vin/R (${p?.iAtResonance?.formatted || 'N/A'})`
      };
    }

    if (l) {
      const cid = l.id || l.designator;
      compHighlights[cid] = {
        role: 'INDUCTIVE_REACTOR',
        roleLabel: 'Inductor (L)',
        color: '#a855f7', // Purple
        haloIntensity: 1.1,
        pulseSpeed: 1.8,
        tooltip: `L: Generates inductive reactance XL = ωL (+90° phase lead)`
      };
    }

    if (c) {
      const cid = c.id || c.designator;
      compHighlights[cid] = {
        role: 'CAPACITIVE_REACTOR',
        roleLabel: 'Capacitor (C)',
        color: '#ec4899', // Pink
        haloIntensity: 1.1,
        pulseSpeed: 1.8,
        tooltip: `C: Generates capacitive reactance XC = 1/(ωC) (-90° phase lag)`
      };
    }

    return {
      status: 'VERIFIED',
      circuitType,
      visualizationType: VISUALIZATION_TYPES.RESONANCE_CURVE,
      isEducationalAnimationActive: true,
      componentHighlights: compHighlights,
      currentFlow: {
        enabled: true,
        branches: [
          {
            id: 'branch-rlc-series',
            currentMa: p?.iAtResonance?.value || 10.0,
            formatted: p?.iAtResonance?.formatted || 'Peak Resonant Current',
            direction: 'FORWARD',
            speed: 2.2,
            color: '#f59e0b' // Amber gold resonant current
          }
        ]
      },
      signalFlow: {
        type: 'AC_RESONANCE',
        active: true,
        phaseDeg: 0.0,
        f0Formatted: p?.f0?.formatted || 'Resonance'
      },
      nodeVoltages,
      waveforms: electricalBehaviour?.waveforms || [],
      resonanceState: {
        active: true,
        f0: p?.f0?.formatted || 'N/A',
        qFactor: p?.qFactor?.formatted || 'N/A',
        bandwidth: p?.bandwidth?.formatted || 'N/A',
        mode: 'SERIES'
      },
      transientState: null,
      educationalAnnotations: [
        {
          id: 'anno-rlc-res-1',
          target: l?.id || 'L1',
          title: 'Series Reactance Cancellation',
          text: `At f₀ = ${p?.f0?.formatted || 'Resonance'}: XL = XC, impedance reaches minimum |Z| = R (${p?.zAtResonance?.formatted || 'N/A'})`
        }
      ],
      warningBanner: null
    };
  }

  // =========================================================================
  // 8. RC LOW-PASS & HIGH-PASS VISUALIZATION (Phase 27)
  // =========================================================================
  if (circuitType === 'RC_LOW_PASS' || circuitType === 'RC_HIGH_PASS') {
    const isLowPass = circuitType === 'RC_LOW_PASS';
    const r = matchedComponents?.resistor || matchedComponents?.r;
    const c = matchedComponents?.capacitor || matchedComponents?.c;
    const p = electricalBehaviour?.parameters;

    if (r) compHighlights[r.id || r.designator] = { role: isLowPass ? 'SERIES_RESISTOR' : 'SHUNT_RESISTOR', roleLabel: isLowPass ? 'Series R' : 'Shunt R', color: '#38bdf8', haloIntensity: 0.9, pulseSpeed: 1.0 };
    if (c) compHighlights[c.id || c.designator] = { role: isLowPass ? 'SHUNT_CAPACITOR' : 'SERIES_CAPACITOR', roleLabel: isLowPass ? 'Shunt C' : 'Series C', color: '#ec4899', haloIntensity: 1.0, pulseSpeed: 1.5 };

    return {
      status: 'VERIFIED',
      circuitType,
      visualizationType: isLowPass ? VISUALIZATION_TYPES.AC_LOW_PASS : VISUALIZATION_TYPES.AC_HIGH_PASS,
      isEducationalAnimationActive: true,
      componentHighlights: compHighlights,
      currentFlow: { enabled: true, branches: [] },
      signalFlow: { type: 'AC_FILTER', active: true, mode: isLowPass ? 'LOW_PASS' : 'HIGH_PASS' },
      nodeVoltages,
      waveforms: electricalBehaviour?.waveforms || [],
      filterState: {
        cutoffFrequency: p?.cutoffFrequency?.formatted || 'N/A',
        mode: isLowPass ? 'LOW_PASS' : 'HIGH_PASS',
        rollOff: '-20 dB/dec'
      },
      transientState: null,
      educationalAnnotations: [
        {
          id: `anno-rc-${isLowPass ? 'lp' : 'hp'}-1`,
          target: parameters?.node_out || 'Vout',
          title: isLowPass ? 'RC Low-Pass Filter Output' : 'RC High-Pass Filter Output',
          text: `Cutoff fc (-3dB) = ${p?.cutoffFrequency?.formatted || '1.59 kHz'}`
        }
      ],
      warningBanner: null
    };
  }

  // =========================================================================
  // 9. RL LOW-PASS & HIGH-PASS VISUALIZATION (Phase 27)
  // =========================================================================
  if (circuitType === 'RL_LOW_PASS' || circuitType === 'RL_HIGH_PASS') {
    const isLowPass = circuitType === 'RL_LOW_PASS';
    const r = matchedComponents?.resistor || matchedComponents?.r;
    const l = matchedComponents?.inductor || matchedComponents?.l;
    const p = electricalBehaviour?.parameters;

    if (r) compHighlights[r.id || r.designator] = { role: isLowPass ? 'SHUNT_RESISTOR' : 'SERIES_RESISTOR', roleLabel: isLowPass ? 'Shunt R' : 'Series R', color: '#38bdf8', haloIntensity: 0.9, pulseSpeed: 1.0 };
    if (l) compHighlights[l.id || l.designator] = { role: isLowPass ? 'SERIES_INDUCTOR' : 'SHUNT_INDUCTOR', roleLabel: isLowPass ? 'Series L' : 'Shunt L', color: '#a855f7', haloIntensity: 1.0, pulseSpeed: 1.5 };

    return {
      status: 'VERIFIED',
      circuitType,
      visualizationType: isLowPass ? VISUALIZATION_TYPES.AC_LOW_PASS : VISUALIZATION_TYPES.AC_HIGH_PASS,
      isEducationalAnimationActive: true,
      componentHighlights: compHighlights,
      currentFlow: { enabled: true, branches: [] },
      signalFlow: { type: 'AC_FILTER', active: true, mode: isLowPass ? 'LOW_PASS' : 'HIGH_PASS' },
      nodeVoltages,
      waveforms: electricalBehaviour?.waveforms || [],
      filterState: {
        cutoffFrequency: p?.cutoffFrequency?.formatted || 'N/A',
        mode: isLowPass ? 'LOW_PASS' : 'HIGH_PASS',
        rollOff: '-20 dB/dec'
      },
      transientState: null,
      educationalAnnotations: [
        {
          id: `anno-rl-${isLowPass ? 'lp' : 'hp'}-1`,
          target: parameters?.node_out || 'Vout',
          title: isLowPass ? 'RL Low-Pass Output' : 'RL High-Pass Output',
          text: `Cutoff fc (-3dB) = ${p?.cutoffFrequency?.formatted || '1.59 kHz'}`
        }
      ],
      warningBanner: null
    };
  }

  // =========================================================================
  // 10. RLC BAND-PASS VISUALIZATION (Phase 27)
  // =========================================================================
  if (circuitType === 'RLC_BAND_PASS') {
    const r = matchedComponents?.resistor;
    const l = matchedComponents?.inductor;
    const c = matchedComponents?.capacitor;
    const p = electricalBehaviour?.parameters;

    if (r) compHighlights[r.id || r.designator] = { role: 'LOAD_RESISTOR', roleLabel: 'Load R', color: '#38bdf8', haloIntensity: 0.8, pulseSpeed: 1.0 };
    if (l) compHighlights[l.id || l.designator] = { role: 'TUNING_INDUCTOR', roleLabel: 'Tuning L', color: '#a855f7', haloIntensity: 1.1, pulseSpeed: 1.8 };
    if (c) compHighlights[c.id || c.designator] = { role: 'TUNING_CAPACITOR', roleLabel: 'Tuning C', color: '#ec4899', haloIntensity: 1.1, pulseSpeed: 1.8 };

    return {
      status: 'VERIFIED',
      circuitType,
      visualizationType: VISUALIZATION_TYPES.AC_BAND_PASS,
      isEducationalAnimationActive: true,
      componentHighlights: compHighlights,
      currentFlow: { enabled: true, branches: [] },
      signalFlow: { type: 'AC_BANDPASS', active: true },
      nodeVoltages,
      waveforms: electricalBehaviour?.waveforms || [],
      resonanceState: {
        active: true,
        f0: p?.f0?.formatted || 'N/A',
        bandwidth: p?.bandwidth?.formatted || 'N/A',
        qFactor: p?.qFactor?.formatted || 'N/A'
      },
      transientState: null,
      educationalAnnotations: [
        {
          id: 'anno-rlc-bp-1',
          target: 'Vout',
          title: 'RLC Band-Pass Center Peak',
          text: `Peak transmission at f₀ = ${p?.f0?.formatted || 'N/A'}`
        }
      ],
      warningBanner: null
    };
  }

  // =========================================================================
  // 11. ACTIVE OP-AMP AMPLIFIERS VISUALIZATION (Phase 28)
  // =========================================================================
  if (circuitType === 'OPAMP_NON_INVERTING' || circuitType === 'OPAMP_INVERTING' || circuitType === 'OPAMP_VOLTAGE_FOLLOWER') {
    const opamp = matchedComponents?.opamp;
    const rf = matchedComponents?.rf;
    const rg = matchedComponents?.rg;
    const rin = matchedComponents?.rin;
    const p = electricalBehaviour?.parameters;

    const isNonInv = circuitType === 'OPAMP_NON_INVERTING';
    const isInv = circuitType === 'OPAMP_INVERTING';
    const isFollower = circuitType === 'OPAMP_VOLTAGE_FOLLOWER';

    if (opamp) {
      compHighlights[opamp.id || opamp.designator || 'U1'] = {
        role: 'OPAMP_IC',
        roleLabel: isNonInv ? 'Non-Inv Op-Amp' : (isInv ? 'Inverting Op-Amp' : 'Voltage Buffer'),
        color: '#10b981', // Emerald
        haloIntensity: 1.2,
        pulseSpeed: 1.2,
        tooltip: `${parameters?.ic || 'Op-Amp'} Active Differential Core`
      };
    }

    if (rf) {
      compHighlights[rf.id || rf.designator] = {
        role: 'FEEDBACK_RESISTOR',
        roleLabel: 'Feedback Rf',
        color: '#38bdf8', // Cyan
        haloIntensity: 1.0,
        pulseSpeed: 1.5,
        tooltip: `Rf: Closes negative feedback loop to inverting (-) pin`
      };
    }

    if (rg) {
      compHighlights[rg.id || rg.designator] = {
        role: 'GAIN_RESISTOR',
        roleLabel: 'Gain Rg',
        color: '#f59e0b', // Amber
        haloIntensity: 0.9,
        pulseSpeed: 1.0,
        tooltip: `Rg: Sets non-inverting gain divisor to Ground`
      };
    }

    if (rin) {
      compHighlights[rin.id || rin.designator] = {
        role: 'INPUT_RESISTOR',
        roleLabel: 'Input Rin',
        color: '#ec4899', // Pink
        haloIntensity: 0.9,
        pulseSpeed: 1.0,
        tooltip: `Rin: Converts Vin into inverting input current`
      };
    }

    if (parameters?.node_out) {
      nodeVoltages.push({
        nodeId: parameters.node_out,
        label: 'Vout',
        voltage: p?.vOut?.value || 0,
        formatted: p?.vOut?.formatted || `${(parameters?.theoretical_gain || 1.0).toFixed(2)} V`,
        color: '#10b981',
        badge: 'AMPLIFIED_OUTPUT'
      });
    }

    const opState = p?.operatingState || 'LINEAR';

    return {
      status: 'VERIFIED',
      circuitType,
      visualizationType: isNonInv ? VISUALIZATION_TYPES.OPAMP_AMPLIFIER : (isInv ? VISUALIZATION_TYPES.OPAMP_INVERTING : VISUALIZATION_TYPES.OPAMP_FOLLOWER),
      isEducationalAnimationActive: opState === 'LINEAR',
      componentHighlights: compHighlights,
      overlays: {
        signalFlow: true,
        feedbackPath: true,
        inputOutputWaveform: true,
        gain: true,
        phase: true,
        operatingState: true
      },
      currentFlow: { enabled: true, branches: [] },
      signalFlow: {
        type: 'ACTIVE_AMPLIFIER',
        active: true,
        inPhase: isNonInv || isFollower,
        isInverted: isInv,
        gain: parameters?.theoretical_gain || 1.0
      },
      activeState: {
        mode: circuitType,
        icModel: parameters?.ic || 'IDEAL_OPAMP',
        gain: parameters?.theoretical_gain || 1.0,
        phaseDeg: isInv ? 180.0 : 0.0,
        operatingState: opState,
        feedbackPathActive: true
      },
      nodeVoltages,
      waveforms: electricalBehaviour?.waveforms || [],
      transientState: null,
      educationalAnnotations: [
        {
          id: 'anno-opamp-1',
          target: parameters?.node_out || 'Vout',
          title: isNonInv ? 'Non-Inverting Amplified Output' : (isInv ? 'Inverting Phase-Reversed Output' : 'Buffered Unity Output'),
          text: `Gain Av = ${isInv ? '-' : '+'}${Math.abs(parameters?.theoretical_gain || 1.0).toFixed(2)} (Phase = ${isInv ? '180°' : '0°'})`
        }
      ],
      warningBanner: opState === 'SATURATED' ? {
        type: 'WARNING',
        title: 'Amplifier Saturated',
        message: 'Output signal exceeds supply rails and is clipping.',
        missingRequirements: []
      } : null
    };
  }

  // =========================================================================
  // 9. RL STEP & TRANSIENT VISUALIZATION (Phase 29)
  // =========================================================================
  if (circuitType === 'RL_CURRENT_RISE' || circuitType === 'RL_CURRENT_DECAY') {

    const r = matchedComponents?.r;
    const l = matchedComponents?.l;
    const isRise = circuitType === 'RL_CURRENT_RISE';

    if (r) {
      compHighlights[r.id || r.designator] = {
        role: 'SERIES_RESISTOR',
        roleLabel: 'Current Limiter / Dissipator (R)',
        color: '#06b6d4',
        haloIntensity: 0.8,
        pulseSpeed: 1.0,
        tooltip: `R: Determines RL rate τ = L/R`
      };
    }
    if (l) {
      compHighlights[l.id || l.designator] = {
        role: 'INDUCTOR',
        roleLabel: 'Inductor (L)',
        color: '#8b5cf6',
        haloIntensity: 1.2,
        pulseSpeed: 1.6,
        tooltip: `L: Storing magnetic energy (1/2 L i²)`
      };
    }

    return {
      status: 'VERIFIED',
      circuitType,
      visualizationType: isRise ? 'RL_RISE_WAVEFORM' : 'RL_DECAY_WAVEFORM',
      isEducationalAnimationActive: true,
      componentHighlights: compHighlights,
      currentFlow: { enabled: true, branches: [] },
      signalFlow: { type: 'TRANSIENT', active: true },
      transientState: {
        mode: circuitType,
        visState: isRise ? 'TRANSIENT_CHARGING' : 'TRANSIENT_DISCHARGING'
      },
      nodeVoltages,
      waveforms: electricalBehaviour?.waveforms || [],
      educationalAnnotations: [
        {
          id: 'anno-rl-1',
          target: l?.id || 'L1',
          title: isRise ? 'Inductive Current Rise' : 'Inductive Energy Discharge',
          text: isRise ? 'Inductor opposes instantaneous current change via counter-EMF' : 'Stored magnetic field collapses and sustains decaying current'
        }
      ],
      warningBanner: null
    };
  }

  // =========================================================================
  // 10. RLC TRANSIENT VISUALIZATION (Phase 29)
  // =========================================================================
  if (circuitType === 'RLC_TRANSIENT') {
    const r = matchedComponents?.r;
    const l = matchedComponents?.l;
    const c = matchedComponents?.c;

    if (r) compHighlights[r.id || r.designator] = { role: 'DAMPING_RESISTOR', roleLabel: 'Damping R', color: '#f59e0b', haloIntensity: 0.8, pulseSpeed: 1.0 };
    if (l) compHighlights[l.id || l.designator] = { role: 'RESONANT_INDUCTOR', roleLabel: 'Inductor L', color: '#8b5cf6', haloIntensity: 1.2, pulseSpeed: 1.8 };
    if (c) compHighlights[c.id || c.designator] = { role: 'RESONANT_CAPACITOR', roleLabel: 'Capacitor C', color: '#3b82f6', haloIntensity: 1.2, pulseSpeed: 1.8 };

    return {
      status: 'VERIFIED',
      circuitType,
      visualizationType: 'RLC_TRANSIENT_WAVEFORM',
      isEducationalAnimationActive: true,
      componentHighlights: compHighlights,
      currentFlow: { enabled: true, branches: [] },
      signalFlow: { type: 'TRANSIENT_OSCILLATION', active: true },
      transientState: {
        mode: circuitType,
        visState: 'TRANSIENT_OSCILLATING'
      },
      nodeVoltages,
      waveforms: electricalBehaviour?.waveforms || [],
      educationalAnnotations: [
        {
          id: 'anno-rlc-1',
          target: c?.id || 'C1',
          title: '2nd-Order RLC Transient',
          text: 'Energy sloshes between magnetic (L) and electrostatic (C) storage while dissipating in R'
        }
      ],
      warningBanner: null
    };
  }


  // =========================================================================
  // 11. SEMICONDUCTOR VISUALIZATIONS (Phase 30)
  // =========================================================================
  if (circuitType === 'DIODE_FORWARD_BIAS' || circuitType === 'DIODE_REVERSE_BIAS') {
    const d = matchedComponents?.diode;
    const r = matchedComponents?.r_series;
    const isFwd = circuitType === 'DIODE_FORWARD_BIAS';

    if (d) {
      compHighlights[d.id || d.designator] = {
        role: isFwd ? 'FORWARD_CONDUCTING_DIODE' : 'REVERSE_BIASED_DIODE',
        roleLabel: isFwd ? 'Diode (ON)' : 'Diode (OFF/Blocking)',
        color: isFwd ? '#10b981' : '#ef4444',
        haloIntensity: isFwd ? 1.0 : 0.4,
        pulseSpeed: isFwd ? 1.5 : 0.0
      };
    }
    if (r) {
      compHighlights[r.id || r.designator] = {
        role: 'CURRENT_LIMITING_RESISTOR',
        roleLabel: 'Series R',
        color: '#f59e0b',
        haloIntensity: 0.7,
        pulseSpeed: 1.0
      };
    }

    return {
      status: 'VERIFIED',
      circuitType,
      visualizationType: isFwd ? VISUALIZATION_TYPES.DIODE_FORWARD_CONDUCTION : VISUALIZATION_TYPES.DIODE_REVERSE_BIAS,
      isEducationalAnimationActive: true,
      componentHighlights: compHighlights,
      currentFlow: { enabled: isFwd, branches: [] },
      signalFlow: { type: isFwd ? 'DC_FORWARD_FLOW' : 'BLOCKED', active: isFwd },
      transientState: {
        mode: circuitType,
        visState: isFwd ? 'DIODE_FORWARD_CONDUCTION' : 'DIODE_REVERSE_BIAS'
      },
      nodeVoltages,
      waveforms: electricalBehaviour?.waveforms || [],
      educationalAnnotations: [
        {
          id: 'anno-diode-1',
          target: d?.id || 'D1',
          title: isFwd ? 'Forward Conduction' : 'Reverse Bias Blocking',
          text: isFwd ? 'Diode forward drop overcome; exponential current allowed to pass.' : 'Depletion layer blocks reverse current; only tiny leakage flows.'
        }
      ],
      warningBanner: null
    };
  }

  if (circuitType === 'HALF_WAVE_RECTIFIER' || circuitType === 'FULL_WAVE_BRIDGE_RECTIFIER') {
    return {
      status: 'VERIFIED',
      circuitType,
      visualizationType: VISUALIZATION_TYPES.RECTIFIER_CONDUCTION,
      isEducationalAnimationActive: true,
      componentHighlights: compHighlights,
      currentFlow: { enabled: true, branches: [] },
      signalFlow: { type: 'PULSATING_DC', active: true },
      transientState: {
        mode: circuitType,
        visState: 'RECTIFIER_CONDUCTION'
      },
      nodeVoltages,
      waveforms: electricalBehaviour?.waveforms || [],
      educationalAnnotations: [
        {
          id: 'anno-rect-1',
          target: 'D1',
          title: 'AC Rectification',
          text: 'Converts alternating AC polarity into unidirectional pulsating DC across load.'
        }
      ],
      warningBanner: null
    };
  }

  // Fallback generic state
  return {
    status: 'VERIFIED',
    circuitType,
    visualizationType: VISUALIZATION_TYPES.GENERIC_DC_FLOW,

    isEducationalAnimationActive: true,
    componentHighlights: compHighlights,
    currentFlow: { enabled: true, branches: [] },
    signalFlow: { type: 'DC', active: true },
    nodeVoltages,
    waveforms: [],
    transientState: null,
    educationalAnnotations: [],
    warningBanner: null
  };
}


export default generateVisualizationState;
