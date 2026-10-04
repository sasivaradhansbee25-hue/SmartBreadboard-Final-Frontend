/**
 * SmartBreadboard 3D — Electrical Behaviour Model (Phase 25)
 *
 * Deterministic electrical models calculating theoretical circuit parameters,
 * time-domain waveform series, and transient metrics for verified circuits.
 *
 * SCIENTIFIC INTEGRITY RULES:
 * 1. Every parameter explicitly designates source ('theoretical_model' | 'mna_simulation').
 * 2. Theoretical values are NEVER labeled as 'measured'.
 * 3. Handles metric prefixes (kΩ, µF, nF, mA, mW) transparently.
 */

import { parseComponentValue } from '../utils/valueParser.js';

/**
 * Extracts numerical value from component record.
 */
function extractNumericValue(comp, defaultVal = 1000.0) {
  if (!comp) return defaultVal;
  if (typeof comp.value === 'number' && !isNaN(comp.value)) return comp.value;

  const raw = comp.user_override_value || comp.detected_value || comp.value || comp.formatted_value;
  if (!raw) return defaultVal;

  const parsed = parseComponentValue(String(raw));
  if (parsed && typeof parsed.siValue === 'number' && !isNaN(parsed.siValue)) {
    return parsed.siValue;
  }
  if (parsed && typeof parsed.numericValue === 'number' && !isNaN(parsed.numericValue)) {
    return parsed.numericValue;
  }
  const num = parseFloat(String(raw).replace(/[^0-9.]/g, ''));
  return !isNaN(num) && num > 0 ? num : defaultVal;
}

/**
 * Extracts voltage supply value from circuit or simulation.
 */
function extractSupplyVoltage(netlist, simulationResult) {
  if (simulationResult && typeof simulationResult.source_voltage === 'number') {
    return simulationResult.source_voltage;
  }
  const ps = netlist?.power_sources?.[0] || netlist?.power_supply;
  if (ps && typeof ps.voltage === 'number') return ps.voltage;
  if (ps && typeof ps.nominal_voltage_v === 'number') return ps.nominal_voltage_v;
  return 5.0; // Default nominal 5.0V test bench rail
}

/**
 * Calculates theoretical electrical behaviour for a classified circuit.
 */
export function calculateCircuitBehaviour(classification, netlist, simulationResult = null) {
  if (!classification || classification.verificationState === 'NOT_VERIFIED' || classification.verificationState === 'UNSUPPORTED') {
    return {
      status: classification?.verificationState || 'UNAVAILABLE',
      circuitType: classification?.circuitType || 'UNKNOWN',
      parameters: {},
      waveforms: [],
      notes: classification?.warnings || []
    };
  }

  const { circuitType, matchedComponents } = classification;
  const vSupply = extractSupplyVoltage(netlist, simulationResult);

  switch (circuitType) {
    // -----------------------------------------------------------------------
    // 1. VOLTAGE DIVIDER
    // -----------------------------------------------------------------------
    case 'VOLTAGE_DIVIDER': {
      const rTopComp = matchedComponents?.r_top;
      const rBotComp = matchedComponents?.r_bot;
      const r1 = extractNumericValue(rTopComp, 1000.0);
      const r2 = extractNumericValue(rBotComp, 2200.0);

      const rTotal = r1 + r2;
      const dividerRatio = r2 / rTotal;
      const vOutTheoretical = vSupply * dividerRatio;
      const currentA = vSupply / rTotal;
      const currentMa = currentA * 1000.0;
      const pR1Mw = Math.pow(currentA, 2) * r1 * 1000.0;
      const pR2Mw = Math.pow(currentA, 2) * r2 * 1000.0;
      const pTotalMw = vSupply * currentA * 1000.0;

      // Extract MNA simulation comparison if available
      const mnaVout = simulationResult?.node_voltages?.[classification.parameters?.node_vout] ?? null;

      return {
        status: 'SOLVED_THEORETICAL',
        circuitType,
        sourceVoltage: { value: vSupply, unit: 'V', label: 'Supply Voltage (Vin)', source: 'nominal_supply', is_measured: false },
        parameters: {
          r1: { value: r1, unit: 'Ω', formatted: `${r1.toFixed(1)} Ω`, label: 'Upper Resistor (R1)', source: 'component_value', is_measured: false },
          r2: { value: r2, unit: 'Ω', formatted: `${r2.toFixed(1)} Ω`, label: 'Lower Resistor (R2)', source: 'component_value', is_measured: false },
          rTotal: { value: rTotal, unit: 'Ω', formatted: `${rTotal.toFixed(1)} Ω`, label: 'Total Resistance (Req)', source: 'theoretical_model', is_measured: false },
          dividerRatio: { value: dividerRatio, unit: '', formatted: `${(dividerRatio * 100).toFixed(2)} %`, label: 'Divider Ratio (R2 / Rtotal)', source: 'theoretical_model', is_measured: false },
          vOutTheoretical: { value: vOutTheoretical, unit: 'V', formatted: `${vOutTheoretical.toFixed(3)} V`, label: 'Theoretical Output (Vout)', source: 'theoretical_model', is_measured: false },
          vOutMna: mnaVout !== null ? { value: mnaVout, unit: 'V', formatted: `${mnaVout.toFixed(3)} V`, label: 'MNA Simulated (Vout)', source: 'mna_simulation', is_measured: false } : null,
          branchCurrent: { value: currentMa, unit: 'mA', formatted: `${currentMa.toFixed(2)} mA`, label: 'Divider Loop Current', source: 'theoretical_model', is_measured: false },
          powerR1: { value: pR1Mw, unit: 'mW', formatted: `${pR1Mw.toFixed(2)} mW`, label: 'R1 Power Dissipation', source: 'theoretical_model', is_measured: false },
          powerR2: { value: pR2Mw, unit: 'mW', formatted: `${pR2Mw.toFixed(2)} mW`, label: 'R2 Power Dissipation', source: 'theoretical_model', is_measured: false },
          powerTotal: { value: pTotalMw, unit: 'mW', formatted: `${pTotalMw.toFixed(2)} mW`, label: 'Total Circuit Power', source: 'theoretical_model', is_measured: false }
        },
        waveforms: [
          {
            name: 'Voltage Distribution Profile',
            type: 'bar',
            xAxis: 'Node',
            yAxis: 'Potential (V)',
            points: [
              { label: 'Vin (VCC)', value: vSupply },
              { label: 'Vout (Midpoint)', value: vOutTheoretical },
              { label: 'GND (0V)', value: 0.0 }
            ]
          }
        ],
        governingEquation: 'Vout = Vin × [ R2 / (R1 + R2) ]'
      };
    }

    // -----------------------------------------------------------------------
    // 2. LED CURRENT LIMITER
    // -----------------------------------------------------------------------
    case 'LED_CURRENT_LIMITER': {
      const rComp = matchedComponents?.r_limit;
      const ledComp = matchedComponents?.led;
      const rLimit = extractNumericValue(rComp, 220.0);
      const vForwardNominal = 2.0; // Standard 2.0V forward drop for Red/Green/Yellow LEDs

      const vResistor = Math.max(0, vSupply - vForwardNominal);
      const currentA = vSupply > vForwardNominal ? vResistor / rLimit : 0.0;
      const currentMa = currentA * 1000.0;
      const pResistorMw = Math.pow(currentA, 2) * rLimit * 1000.0;
      const pLedMw = vForwardNominal * currentA * 1000.0;
      const isSafe = currentMa <= 25.0; // Standard 20mA nominal, 25mA max safe continuous limit

      return {
        status: 'SOLVED_THEORETICAL',
        circuitType,
        sourceVoltage: { value: vSupply, unit: 'V', label: 'Supply Voltage (Vin)', source: 'nominal_supply', is_measured: false },
        parameters: {
          rLimit: { value: rLimit, unit: 'Ω', formatted: `${rLimit.toFixed(1)} Ω`, label: 'Ballast Resistor (R_limit)', source: 'component_value', is_measured: false },
          vForward: { value: vForwardNominal, unit: 'V', formatted: `${vForwardNominal.toFixed(2)} V`, label: 'LED Forward Voltage (Vf)', source: 'theoretical_model', is_measured: false },
          vResistor: { value: vResistor, unit: 'V', formatted: `${vResistor.toFixed(2)} V`, label: 'Voltage Across Resistor (Vin - Vf)', source: 'theoretical_model', is_measured: false },
          forwardCurrent: { value: currentMa, unit: 'mA', formatted: `${currentMa.toFixed(2)} mA`, label: 'LED Operating Current (If)', source: 'theoretical_model', is_measured: false },
          powerResistor: { value: pResistorMw, unit: 'mW', formatted: `${pResistorMw.toFixed(2)} mW`, label: 'Resistor Power Loss', source: 'theoretical_model', is_measured: false },
          powerLed: { value: pLedMw, unit: 'mW', formatted: `${pLedMw.toFixed(2)} mW`, label: 'LED Optical & Thermal Power', source: 'theoretical_model', is_measured: false },
          safetyStatus: { value: isSafe ? 'SAFE' : 'OVERCURRENT_WARNING', unit: '', formatted: isSafe ? 'SAFE (≤ 25 mA)' : 'DANGER (> 25 mA OVERCURRENT)', label: 'Operating Safety State', source: 'theoretical_model', is_measured: false }
        },
        waveforms: [],
        governingEquation: 'I_LED = (Vin - Vf) / R_limit'
      };
    }

    // -----------------------------------------------------------------------
    // 3. RC CHARGING (LOW-PASS FILTER)
    // -----------------------------------------------------------------------
    case 'RC_CHARGING': {
      const rComp = matchedComponents?.r;
      const cComp = matchedComponents?.c;
      const r = extractNumericValue(rComp, 4700.0);
      let c = extractNumericValue(cComp, 100e-9); // default 100 nF
      // Guard against raw nF or µF values read as integer
      if (c > 1.0) {
        c = c * 1e-6; // assume microfarads if > 1
      }

      const tauSeconds = r * c;
      const tauMs = tauSeconds * 1000.0;
      const cutoffFreqHz = 1.0 / (2.0 * Math.PI * r * c);
      const maxEnergyUj = 0.5 * c * Math.pow(vSupply, 2) * 1e6;

      // Generate 50-point exponential step response waveform over 0 to 5 tau
      const numPoints = 60;
      const tMax = 5.0 * tauSeconds;
      const timePoints = [];

      for (let i = 0; i <= numPoints; i++) {
        const t = (i / numPoints) * tMax;
        const v = vSupply * (1.0 - Math.exp(-t / tauSeconds));
        const tauRatio = t / tauSeconds;
        timePoints.push({
          timeS: t,
          timeMs: Number((t * 1000.0).toFixed(3)),
          voltageV: Number(v.toFixed(3)),
          percentCharge: Number(((v / vSupply) * 100).toFixed(1)),
          tauMultiple: Number(tauRatio.toFixed(2))
        });
      }

      return {
        status: 'SOLVED_THEORETICAL',
        circuitType,
        sourceVoltage: { value: vSupply, unit: 'V', label: 'Step Input Voltage (Vin)', source: 'nominal_supply', is_measured: false },
        parameters: {
          r: { value: r, unit: 'Ω', formatted: `${r >= 1000 ? (r / 1000).toFixed(2) + ' kΩ' : r.toFixed(1) + ' Ω'}`, label: 'Timing Resistor (R)', source: 'component_value', is_measured: false },
          c: { value: c, unit: 'F', formatted: `${c < 1e-6 ? (c * 1e9).toFixed(1) + ' nF' : (c * 1e6).toFixed(2) + ' µF'}`, label: 'Timing Capacitor (C)', source: 'component_value', is_measured: false },
          tau: { value: tauMs, unit: 'ms', formatted: `${tauMs < 1 ? (tauMs * 1000).toFixed(1) + ' µs' : tauMs.toFixed(3) + ' ms'}`, label: 'Time Constant (τ = RC)', source: 'theoretical_model', is_measured: false },
          cutoffFrequency: { value: cutoffFreqHz, unit: 'Hz', formatted: `${cutoffFreqHz >= 1000 ? (cutoffFreqFreq => (cutoffFreqFreq / 1000).toFixed(2) + ' kHz')(cutoffFreqHz) : cutoffFreqHz.toFixed(1) + ' Hz'}`, label: 'Cutoff Frequency (-3dB fc)', source: 'theoretical_model', is_measured: false },
          voltage1Tau: { value: vSupply * 0.632, unit: 'V', formatted: `${(vSupply * 0.632).toFixed(3)} V (63.2%)`, label: 'Voltage at 1τ (63.2%)', source: 'theoretical_model', is_measured: false },
          voltage3Tau: { value: vSupply * 0.950, unit: 'V', formatted: `${(vSupply * 0.950).toFixed(3)} V (95.0%)`, label: 'Voltage at 3τ (95.0%)', source: 'theoretical_model', is_measured: false },
          voltage5Tau: { value: vSupply * 0.993, unit: 'V', formatted: `${(vSupply * 0.993).toFixed(3)} V (99.3% Steady State)`, label: 'Voltage at 5τ (Steady State)', source: 'theoretical_model', is_measured: false },
          storedEnergy: { value: maxEnergyUj, unit: 'µJ', formatted: `${maxEnergyUj.toFixed(3)} µJ`, label: 'Max Stored Energy (½ C Vin²)', source: 'theoretical_model', is_measured: false }
        },
        waveforms: [
          {
            name: 'Capacitor Voltage Step Charging Curve v_C(t)',
            type: 'time_series',
            xAxis: 'Time (ms)',
            yAxis: 'Capacitor Voltage (V)',
            tauMs: Number(tauMs.toFixed(3)),
            points: timePoints
          }
        ],
        governingEquation: 'v_C(t) = Vin × [ 1 - e^(-t / RC) ]'
      };
    }

    // -----------------------------------------------------------------------
    // 4. RC DISCHARGING
    // -----------------------------------------------------------------------
    case 'RC_DISCHARGING': {
      const rComp = matchedComponents?.r;
      const cComp = matchedComponents?.c;
      const r = extractNumericValue(rComp, 4700.0);
      let c = extractNumericValue(cComp, 100e-9);
      if (c > 1.0) c = c * 1e-6;

      const vInitial = vSupply || 5.0;
      const tauSeconds = r * c;
      const tauMs = tauSeconds * 1000.0;
      const halfLifeMs = tauMs * Math.LN2;

      const numPoints = 60;
      const tMax = 5.0 * tauSeconds;
      const timePoints = [];

      for (let i = 0; i <= numPoints; i++) {
        const t = (i / numPoints) * tMax;
        const v = vInitial * Math.exp(-t / tauSeconds);
        timePoints.push({
          timeS: t,
          timeMs: Number((t * 1000.0).toFixed(3)),
          voltageV: Number(v.toFixed(3)),
          percentRemaining: Number(((v / vInitial) * 100).toFixed(1)),
          tauMultiple: Number((t / tauSeconds).toFixed(2))
        });
      }

      return {
        status: 'SOLVED_THEORETICAL',
        circuitType,
        sourceVoltage: { value: vInitial, unit: 'V', label: 'Initial Capacitor Voltage (V0)', source: 'nominal_supply', is_measured: false },
        parameters: {
          r: { value: r, unit: 'Ω', formatted: `${r >= 1000 ? (r / 1000).toFixed(2) + ' kΩ' : r.toFixed(1) + ' Ω'}`, label: 'Discharge Resistor (R)', source: 'component_value', is_measured: false },
          c: { value: c, unit: 'F', formatted: `${c < 1e-6 ? (c * 1e9).toFixed(1) + ' nF' : (c * 1e6).toFixed(2) + ' µF'}`, label: 'Discharge Capacitor (C)', source: 'component_value', is_measured: false },
          tau: { value: tauMs, unit: 'ms', formatted: `${tauMs.toFixed(3)} ms`, label: 'Decay Constant (τ = RC)', source: 'theoretical_model', is_measured: false },
          halfLife: { value: halfLifeMs, unit: 'ms', formatted: `${halfLifeMs.toFixed(3)} ms`, label: 'Voltage Half-Life (t½ = τ ln 2)', source: 'theoretical_model', is_measured: false },
          voltage1Tau: { value: vInitial * 0.368, unit: 'V', formatted: `${(vInitial * 0.368).toFixed(3)} V (36.8%)`, label: 'Voltage at 1τ (36.8%)', source: 'theoretical_model', is_measured: false },
          voltage5Tau: { value: vInitial * 0.007, unit: 'V', formatted: `${(vInitial * 0.007).toFixed(3)} V (0.7% Fully Discharged)`, label: 'Voltage at 5τ (Full Discharge)', source: 'theoretical_model', is_measured: false }
        },
        waveforms: [
          {
            name: 'Capacitor Voltage Exponential Decay Curve v_C(t)',
            type: 'time_series',
            xAxis: 'Time (ms)',
            yAxis: 'Capacitor Voltage (V)',
            tauMs: Number(tauMs.toFixed(3)),
            points: timePoints
          }
        ],
        governingEquation: 'v_C(t) = V0 × e^(-t / RC)'
      };
    }

    // -----------------------------------------------------------------------
    // 5. PARALLEL RESISTORS
    // -----------------------------------------------------------------------
    case 'PARALLEL_RESISTOR_NETWORK': {
      const r1 = extractNumericValue(matchedComponents?.r1, 10000.0);
      const r2 = extractNumericValue(matchedComponents?.r2, 10000.0);
      const rEq = (r1 * r2) / (r1 + r2);
      const iTotalA = vSupply / rEq;
      const i1A = vSupply / r1;
      const i2A = vSupply / r2;

      return {
        status: 'SOLVED_THEORETICAL',
        circuitType,
        sourceVoltage: { value: vSupply, unit: 'V', label: 'Parallel Voltage (Vin)', source: 'nominal_supply', is_measured: false },
        parameters: {
          r1: { value: r1, unit: 'Ω', formatted: `${r1 >= 1000 ? (r1 / 1000).toFixed(2) + ' kΩ' : r1.toFixed(1) + ' Ω'}`, label: 'Branch 1 Resistor (R1)', source: 'component_value', is_measured: false },
          r2: { value: r2, unit: 'Ω', formatted: `${r2 >= 1000 ? (r2 / 1000).toFixed(2) + ' kΩ' : r2.toFixed(1) + ' Ω'}`, label: 'Branch 2 Resistor (R2)', source: 'component_value', is_measured: false },
          rEq: { value: rEq, unit: 'Ω', formatted: `${rEq >= 1000 ? (rEq / 1000).toFixed(2) + ' kΩ' : rEq.toFixed(1) + ' Ω'}`, label: 'Equivalent Resistance (Req = R1 ∥ R2)', source: 'theoretical_model', is_measured: false },
          iTotal: { value: iTotalA * 1000.0, unit: 'mA', formatted: `${(iTotalA * 1000.0).toFixed(2)} mA`, label: 'Total Source Current', source: 'theoretical_model', is_measured: false },
          i1: { value: i1A * 1000.0, unit: 'mA', formatted: `${(i1A * 1000.0).toFixed(2)} mA`, label: 'Branch 1 Current (I1)', source: 'theoretical_model', is_measured: false },
          i2: { value: i2A * 1000.0, unit: 'mA', formatted: `${(i2A * 1000.0).toFixed(2)} mA`, label: 'Branch 2 Current (I2)', source: 'theoretical_model', is_measured: false }
        },
        waveforms: [],
        governingEquation: '1/Req = 1/R1 + 1/R2,  I_total = I1 + I2'
      };
    }

    // -----------------------------------------------------------------------
    // 7. SERIES RLC RESONANCE
    // -----------------------------------------------------------------------
    case 'RLC_SERIES_RESONANCE': {
      const rComp = matchedComponents?.resistor;
      const lComp = matchedComponents?.inductor;
      const cComp = matchedComponents?.capacitor;

      const r = extractNumericValue(rComp, 100.0);
      let l = extractNumericValue(lComp, 0.010); // default 10 mH
      let c = extractNumericValue(cComp, 100e-6); // default 100 µF
      if (l > 10.0) l = l * 1e-3; // assume mH if large
      if (c > 1.0) c = c * 1e-6; // assume µF if large

      const lcProd = Math.max(l * c, 1e-18);
      const omega0 = 1.0 / Math.sqrt(lcProd);
      const f0Hz = omega0 / (2.0 * Math.PI);
      const xl0 = omega0 * l;
      const xc0 = 1.0 / (omega0 * c);

      // Q and Bandwidth
      const qFactor = (omega0 * l) / Math.max(r, 1e-6);
      const bwHz = f0Hz / Math.max(qFactor, 1e-4);
      const fLowHz = Math.max(0.1, f0Hz - bwHz / 2.0);
      const fHighHz = f0Hz + bwHz / 2.0;

      const currentAtResonanceA = vSupply / Math.max(r, 1e-6);
      const currentAtResonanceMa = currentAtResonanceA * 1000.0;

      // Generate 60-point frequency response sweep from 0.1*f0 to 10*f0
      const numPoints = 60;
      const fMin = Math.max(0.5, f0Hz * 0.1);
      const fMax = f0Hz * 10.0;
      const logMin = Math.log10(fMin);
      const logMax = Math.log10(fMax);
      const sweepPoints = [];

      for (let i = 0; i <= numPoints; i++) {
        const f = Math.pow(10, logMin + (i / numPoints) * (logMax - logMin));
        const w = 2.0 * Math.PI * f;
        const xl = w * l;
        const xc = 1.0 / (w * c);
        const reactance = xl - xc;
        const zMag = Math.sqrt(r * r + reactance * reactance);
        const phaseDeg = (Math.atan2(reactance, r) * 180.0) / Math.PI;
        const iMag = (vSupply / zMag) * 1000.0; // mA
        const magDb = 20.0 * Math.log10(Math.max(iMag / Math.max(currentAtResonanceMa, 1e-6), 1e-4));

        sweepPoints.push({
          frequencyHz: Number(f.toFixed(2)),
          omegaRadS: Number(w.toFixed(2)),
          magnitudeDb: Number(magDb.toFixed(2)),
          phaseDeg: Number(phaseDeg.toFixed(2)),
          impedanceMagnitudeOhms: Number(zMag.toFixed(2)),
          currentMagnitudeMa: Number(iMag.toFixed(3)),
          reactanceOhms: Number(reactance.toFixed(2))
        });
      }

      return {
        status: 'SOLVED_THEORETICAL',
        circuitType,
        sourceVoltage: { value: vSupply, unit: 'V', label: 'AC Test Signal (Vin)', source: 'nominal_supply', is_measured: false },
        parameters: {
          r: { value: r, unit: 'Ω', formatted: `${r >= 1000 ? (r / 1000).toFixed(2) + ' kΩ' : r.toFixed(1) + ' Ω'}`, label: 'Series Resistance (R)', source: 'component_value', is_measured: false },
          l: { value: l, unit: 'H', formatted: `${l < 1 ? (l * 1000).toFixed(2) + ' mH' : l.toFixed(3) + ' H'}`, label: 'Resonant Inductor (L)', source: 'component_value', is_measured: false },
          c: { value: c, unit: 'F', formatted: `${c < 1e-6 ? (c * 1e9).toFixed(1) + ' nF' : (c * 1e6).toFixed(2) + ' µF'}`, label: 'Tuning Capacitor (C)', source: 'component_value', is_measured: false },
          f0: { value: f0Hz, unit: 'Hz', formatted: `${f0Hz >= 1000 ? (f0Hz / 1000).toFixed(3) + ' kHz' : f0Hz.toFixed(2) + ' Hz'}`, label: 'Resonant Frequency (f₀)', source: 'theoretical_model', is_measured: false },
          qFactor: { value: qFactor, unit: '', formatted: `${qFactor.toFixed(2)}`, label: 'Quality Factor (Q)', source: 'theoretical_model', is_measured: false },
          bandwidth: { value: bwHz, unit: 'Hz', formatted: `${bwHz >= 1000 ? (bwHz / 1000).toFixed(2) + ' kHz' : bwHz.toFixed(2) + ' Hz'}`, label: 'Bandwidth (BW = f₀/Q)', source: 'theoretical_model', is_measured: false },
          fLow: { value: fLowHz, unit: 'Hz', formatted: `${fLowHz >= 1000 ? (fLowHz / 1000).toFixed(2) + ' kHz' : fLowHz.toFixed(2) + ' Hz'}`, label: 'Lower Half-Power Cutoff (f_low)', source: 'theoretical_model', is_measured: false },
          fHigh: { value: fHighHz, unit: 'Hz', formatted: `${fHighHz >= 1000 ? (fHighHz / 1000).toFixed(2) + ' kHz' : fHighHz.toFixed(2) + ' Hz'}`, label: 'Upper Half-Power Cutoff (f_high)', source: 'theoretical_model', is_measured: false },
          zAtResonance: { value: r, unit: 'Ω', formatted: `${r.toFixed(1)} Ω (Pure Real)`, label: 'Resonance Impedance (|Z₀| = R)', source: 'theoretical_model', is_measured: false },
          iAtResonance: { value: currentAtResonanceMa, unit: 'mA', formatted: `${currentAtResonanceMa.toFixed(2)} mA (Peak)`, label: 'Peak Resonant Current (I_max)', source: 'theoretical_model', is_measured: false }
        },
        waveforms: [
          {
            name: 'Series RLC Current Magnitude & Resonance Spectrum |I(f)|',
            type: 'frequency_response',
            xAxis: 'Frequency (Hz)',
            yAxis: 'Response Magnitude (dB)',
            f0Hz: Number(f0Hz.toFixed(2)),
            fLowHz: Number(fLowHz.toFixed(2)),
            fHighHz: Number(fHighHz.toFixed(2)),
            points: sweepPoints
          }
        ],
        governingEquation: 'f₀ = 1 / [ 2π√(L × C) ],  Q = (ω₀ × L) / R,  BW = f₀ / Q'
      };
    }

    // -----------------------------------------------------------------------
    // 8. PARALLEL RLC RESONANCE
    // -----------------------------------------------------------------------
    case 'RLC_PARALLEL_RESONANCE': {
      const rComp = matchedComponents?.resistor;
      const lComp = matchedComponents?.inductor;
      const cComp = matchedComponents?.capacitor;

      const r = extractNumericValue(rComp, 1000.0);
      let l = extractNumericValue(lComp, 0.010);
      let c = extractNumericValue(cComp, 100e-6);
      if (l > 10.0) l = l * 1e-3;
      if (c > 1.0) c = c * 1e-6;

      const lcProd = Math.max(l * c, 1e-18);
      const omega0 = 1.0 / Math.sqrt(lcProd);
      const f0Hz = omega0 / (2.0 * Math.PI);
      const qFactor = r * Math.sqrt(c / Math.max(l, 1e-12));
      const bwHz = f0Hz / Math.max(qFactor, 1e-4);

      return {
        status: 'SOLVED_THEORETICAL',
        circuitType,
        sourceVoltage: { value: vSupply, unit: 'V', label: 'AC Source Voltage', source: 'nominal_supply', is_measured: false },
        parameters: {
          r: { value: r, unit: 'Ω', formatted: `${r >= 1000 ? (r / 1000).toFixed(2) + ' kΩ' : r.toFixed(1) + ' Ω'}`, label: 'Tank Resistance (R)', source: 'component_value', is_measured: false },
          l: { value: l, unit: 'H', formatted: `${l < 1 ? (l * 1000).toFixed(2) + ' mH' : l.toFixed(3) + ' H'}`, label: 'Tank Inductor (L)', source: 'component_value', is_measured: false },
          c: { value: c, unit: 'F', formatted: `${c < 1e-6 ? (c * 1e9).toFixed(1) + ' nF' : (c * 1e6).toFixed(2) + ' µF'}`, label: 'Tank Capacitor (C)', source: 'component_value', is_measured: false },
          f0: { value: f0Hz, unit: 'Hz', formatted: `${f0Hz >= 1000 ? (f0Hz / 1000).toFixed(3) + ' kHz' : f0Hz.toFixed(2) + ' Hz'}`, label: 'Resonant Frequency (f₀)', source: 'theoretical_model', is_measured: false },
          qFactor: { value: qFactor, unit: '', formatted: `${qFactor.toFixed(2)}`, label: 'Quality Factor (Q = R√(C/L))', source: 'theoretical_model', is_measured: false },
          bandwidth: { value: bwHz, unit: 'Hz', formatted: `${bwHz.toFixed(2)} Hz`, label: 'Bandwidth (BW)', source: 'theoretical_model', is_measured: false },
          zAtResonance: { value: r, unit: 'Ω', formatted: `${r >= 1000 ? (r / 1000).toFixed(2) + ' kΩ' : r.toFixed(1) + ' Ω'} (Maximum |Z|)`, label: 'Peak Resonance Impedance', source: 'theoretical_model', is_measured: false }
        },
        waveforms: [],
        governingEquation: 'f₀ = 1 / [ 2π√(L × C) ],  Q = R × √(C / L),  BW = f₀ / Q'
      };
    }

    // -----------------------------------------------------------------------
    // 9. RC LOW-PASS FILTER (Phase 27)
    // -----------------------------------------------------------------------
    case 'RC_LOW_PASS': {
      const rComp = matchedComponents?.resistor || matchedComponents?.r;
      const cComp = matchedComponents?.capacitor || matchedComponents?.c;
      const r = extractNumericValue(rComp, 1000.0);
      let c = extractNumericValue(cComp, 100e-9);
      if (c > 1.0) c = c * 1e-6;

      const tau = r * c;
      const fcHz = 1.0 / (2.0 * Math.PI * Math.max(tau, 1e-15));

      // Generate 60-point frequency response sweep from 0.05*fc to 50*fc
      const numPoints = 60;
      const fMin = Math.max(0.5, fcHz * 0.05);
      const fMax = fcHz * 50.0;
      const logMin = Math.log10(fMin);
      const logMax = Math.log10(fMax);
      const sweepPoints = [];

      for (let i = 0; i <= numPoints; i++) {
        const f = Math.pow(10, logMin + (i / numPoints) * (logMax - logMin));
        const w = 2.0 * Math.PI * f;
        const xc = 1.0 / (w * c);
        const gainMag = xc / Math.sqrt(r * r + xc * xc); // 1 / sqrt(1 + (wRC)^2)
        const magDb = 20.0 * Math.log10(Math.max(gainMag, 1e-6));
        const phaseDeg = -Math.atan2(w * tau, 1.0) * (180.0 / Math.PI);

        sweepPoints.push({
          frequencyHz: Number(f.toFixed(2)),
          omegaRadS: Number(w.toFixed(2)),
          gainMagnitude: Number(gainMag.toFixed(4)),
          magnitudeDb: Number(magDb.toFixed(2)),
          phaseDeg: Number(phaseDeg.toFixed(2)),
          currentMagnitudeMa: Number(((vSupply / Math.sqrt(r * r + xc * xc)) * 1000.0).toFixed(3))
        });
      }

      return {
        status: 'SOLVED_THEORETICAL',
        circuitType,
        sourceVoltage: { value: vSupply, unit: 'V', label: 'AC Excitation (Vin)', source: 'nominal_supply', is_measured: false },
        parameters: {
          r: { value: r, unit: 'Ω', formatted: `${r >= 1000 ? (r / 1000).toFixed(2) + ' kΩ' : r.toFixed(1) + ' Ω'}`, label: 'Series Resistance (R)', source: 'component_value', is_measured: false },
          c: { value: c, unit: 'F', formatted: `${c < 1e-6 ? (c * 1e9).toFixed(1) + ' nF' : (c * 1e6).toFixed(2) + ' µF'}`, label: 'Shunt Capacitance (C)', source: 'component_value', is_measured: false },
          tau: { value: tau * 1000.0, unit: 'ms', formatted: `${(tau * 1000.0).toFixed(3)} ms`, label: 'Time Constant (τ = RC)', source: 'theoretical_model', is_measured: false },
          cutoffFrequency: { value: fcHz, unit: 'Hz', formatted: `${fcHz >= 1000 ? (fcHz / 1000).toFixed(3) + ' kHz' : fcHz.toFixed(2) + ' Hz'}`, label: 'Cutoff Frequency (-3dB fc)', source: 'theoretical_model', is_measured: false },
          gainAtDc: { value: 1.0, unit: '', formatted: '1.00 (0 dB)', label: 'DC Passband Gain', source: 'theoretical_model', is_measured: false },
          phaseAtCutoff: { value: -45.0, unit: '°', formatted: '-45.0°', label: 'Phase at Cutoff ∠H(fc)', source: 'theoretical_model', is_measured: false }
        },
        waveforms: [
          {
            name: 'RC Low-Pass Frequency Response |H(f)| & Phase',
            type: 'frequency_response',
            xAxis: 'Frequency (Hz)',
            yAxis: 'Gain (dB)',
            fcHz: Number(fcHz.toFixed(2)),
            points: sweepPoints
          }
        ],
        governingEquation: 'fc = 1 / (2πRC),  |H(jω)| = 1 / √(1 + (ωRC)²),  ∠H(jω) = -arctan(ωRC)'
      };
    }

    // -----------------------------------------------------------------------
    // 10. RC HIGH-PASS FILTER (Phase 27)
    // -----------------------------------------------------------------------
    case 'RC_HIGH_PASS': {
      const rComp = matchedComponents?.resistor || matchedComponents?.r;
      const cComp = matchedComponents?.capacitor || matchedComponents?.c;
      const r = extractNumericValue(rComp, 1000.0);
      let c = extractNumericValue(cComp, 100e-9);
      if (c > 1.0) c = c * 1e-6;

      const tau = r * c;
      const fcHz = 1.0 / (2.0 * Math.PI * Math.max(tau, 1e-15));

      const numPoints = 60;
      const fMin = Math.max(0.5, fcHz * 0.05);
      const fMax = fcHz * 50.0;
      const logMin = Math.log10(fMin);
      const logMax = Math.log10(fMax);
      const sweepPoints = [];

      for (let i = 0; i <= numPoints; i++) {
        const f = Math.pow(10, logMin + (i / numPoints) * (logMax - logMin));
        const w = 2.0 * Math.PI * f;
        const xc = 1.0 / (w * c);
        const gainMag = (w * tau) / Math.sqrt(1 + Math.pow(w * tau, 2));
        const magDb = 20.0 * Math.log10(Math.max(gainMag, 1e-6));
        const phaseDeg = 90.0 - Math.atan2(w * tau, 1.0) * (180.0 / Math.PI);

        sweepPoints.push({
          frequencyHz: Number(f.toFixed(2)),
          omegaRadS: Number(w.toFixed(2)),
          gainMagnitude: Number(gainMag.toFixed(4)),
          magnitudeDb: Number(magDb.toFixed(2)),
          phaseDeg: Number(phaseDeg.toFixed(2)),
          currentMagnitudeMa: Number(((vSupply / Math.sqrt(r * r + xc * xc)) * 1000.0).toFixed(3))
        });
      }

      return {
        status: 'SOLVED_THEORETICAL',
        circuitType,
        sourceVoltage: { value: vSupply, unit: 'V', label: 'AC Excitation (Vin)', source: 'nominal_supply', is_measured: false },
        parameters: {
          r: { value: r, unit: 'Ω', formatted: `${r >= 1000 ? (r / 1000).toFixed(2) + ' kΩ' : r.toFixed(1) + ' Ω'}`, label: 'Shunt Resistance (R)', source: 'component_value', is_measured: false },
          c: { value: c, unit: 'F', formatted: `${c < 1e-6 ? (c * 1e9).toFixed(1) + ' nF' : (c * 1e6).toFixed(2) + ' µF'}`, label: 'Series Capacitance (C)', source: 'component_value', is_measured: false },
          tau: { value: tau * 1000.0, unit: 'ms', formatted: `${(tau * 1000.0).toFixed(3)} ms`, label: 'Time Constant (τ = RC)', source: 'theoretical_model', is_measured: false },
          cutoffFrequency: { value: fcHz, unit: 'Hz', formatted: `${fcHz >= 1000 ? (fcHz / 1000).toFixed(3) + ' kHz' : fcHz.toFixed(2) + ' Hz'}`, label: 'Cutoff Frequency (-3dB fc)', source: 'theoretical_model', is_measured: false },
          gainAtHighF: { value: 1.0, unit: '', formatted: '1.00 (0 dB)', label: 'High-Frequency Passband Gain', source: 'theoretical_model', is_measured: false },
          phaseAtCutoff: { value: 45.0, unit: '°', formatted: '+45.0°', label: 'Phase at Cutoff ∠H(fc)', source: 'theoretical_model', is_measured: false }
        },
        waveforms: [
          {
            name: 'RC High-Pass Frequency Response |H(f)| & Phase',
            type: 'frequency_response',
            xAxis: 'Frequency (Hz)',
            yAxis: 'Gain (dB)',
            fcHz: Number(fcHz.toFixed(2)),
            points: sweepPoints
          }
        ],
        governingEquation: 'fc = 1 / (2πRC),  |H(jω)| = (ωRC) / √(1 + (ωRC)²),  ∠H(jω) = 90° - arctan(ωRC)'
      };
    }

    // -----------------------------------------------------------------------
    // 11. RL LOW-PASS FILTER (Phase 27)
    // -----------------------------------------------------------------------
    case 'RL_LOW_PASS': {
      const rComp = matchedComponents?.resistor || matchedComponents?.r;
      const lComp = matchedComponents?.inductor || matchedComponents?.l;
      const r = extractNumericValue(rComp, 1000.0);
      let l = extractNumericValue(lComp, 0.1);
      if (l > 10.0) l = l * 1e-3;

      const fcHz = r / (2.0 * Math.PI * Math.max(l, 1e-12));
      const tau = l / Math.max(r, 1e-6);

      const numPoints = 60;
      const fMin = Math.max(0.5, fcHz * 0.05);
      const fMax = fcHz * 50.0;
      const logMin = Math.log10(fMin);
      const logMax = Math.log10(fMax);
      const sweepPoints = [];

      for (let i = 0; i <= numPoints; i++) {
        const f = Math.pow(10, logMin + (i / numPoints) * (logMax - logMin));
        const w = 2.0 * Math.PI * f;
        const xl = w * l;
        const gainMag = r / Math.sqrt(r * r + xl * xl);
        const magDb = 20.0 * Math.log10(Math.max(gainMag, 1e-6));
        const phaseDeg = -Math.atan2(xl, r) * (180.0 / Math.PI);

        sweepPoints.push({
          frequencyHz: Number(f.toFixed(2)),
          omegaRadS: Number(w.toFixed(2)),
          gainMagnitude: Number(gainMag.toFixed(4)),
          magnitudeDb: Number(magDb.toFixed(2)),
          phaseDeg: Number(phaseDeg.toFixed(2)),
          currentMagnitudeMa: Number(((vSupply / Math.sqrt(r * r + xl * xl)) * 1000.0).toFixed(3))
        });
      }

      return {
        status: 'SOLVED_THEORETICAL',
        circuitType,
        sourceVoltage: { value: vSupply, unit: 'V', label: 'AC Excitation (Vin)', source: 'nominal_supply', is_measured: false },
        parameters: {
          r: { value: r, unit: 'Ω', formatted: `${r >= 1000 ? (r / 1000).toFixed(2) + ' kΩ' : r.toFixed(1) + ' Ω'}`, label: 'Shunt Resistance (R)', source: 'component_value', is_measured: false },
          l: { value: l, unit: 'H', formatted: `${l < 1 ? (l * 1000).toFixed(2) + ' mH' : l.toFixed(3) + ' H'}`, label: 'Series Inductance (L)', source: 'component_value', is_measured: false },
          tau: { value: tau * 1000.0, unit: 'ms', formatted: `${(tau * 1000.0).toFixed(3)} ms`, label: 'Time Constant (τ = L/R)', source: 'theoretical_model', is_measured: false },
          cutoffFrequency: { value: fcHz, unit: 'Hz', formatted: `${fcHz >= 1000 ? (fcHz / 1000).toFixed(3) + ' kHz' : fcHz.toFixed(2) + ' Hz'}`, label: 'Cutoff Frequency (-3dB fc)', source: 'theoretical_model', is_measured: false },
          phaseAtCutoff: { value: -45.0, unit: '°', formatted: '-45.0°', label: 'Phase at Cutoff ∠H(fc)', source: 'theoretical_model', is_measured: false }
        },
        waveforms: [
          {
            name: 'RL Low-Pass Frequency Response |H(f)| & Phase',
            type: 'frequency_response',
            xAxis: 'Frequency (Hz)',
            yAxis: 'Gain (dB)',
            fcHz: Number(fcHz.toFixed(2)),
            points: sweepPoints
          }
        ],
        governingEquation: 'fc = R / (2πL),  |H(jω)| = R / √(R² + (ωL)²),  ∠H(jω) = -arctan(ωL / R)'
      };
    }

    // -----------------------------------------------------------------------
    // 12. RL HIGH-PASS FILTER (Phase 27)
    // -----------------------------------------------------------------------
    case 'RL_HIGH_PASS': {
      const rComp = matchedComponents?.resistor || matchedComponents?.r;
      const lComp = matchedComponents?.inductor || matchedComponents?.l;
      const r = extractNumericValue(rComp, 1000.0);
      let l = extractNumericValue(lComp, 0.1);
      if (l > 10.0) l = l * 1e-3;

      const fcHz = r / (2.0 * Math.PI * Math.max(l, 1e-12));
      const tau = l / Math.max(r, 1e-6);

      const numPoints = 60;
      const fMin = Math.max(0.5, fcHz * 0.05);
      const fMax = fcHz * 50.0;
      const logMin = Math.log10(fMin);
      const logMax = Math.log10(fMax);
      const sweepPoints = [];

      for (let i = 0; i <= numPoints; i++) {
        const f = Math.pow(10, logMin + (i / numPoints) * (logMax - logMin));
        const w = 2.0 * Math.PI * f;
        const xl = w * l;
        const gainMag = xl / Math.sqrt(r * r + xl * xl);
        const magDb = 20.0 * Math.log10(Math.max(gainMag, 1e-6));
        const phaseDeg = 90.0 - Math.atan2(xl, r) * (180.0 / Math.PI);

        sweepPoints.push({
          frequencyHz: Number(f.toFixed(2)),
          omegaRadS: Number(w.toFixed(2)),
          gainMagnitude: Number(gainMag.toFixed(4)),
          magnitudeDb: Number(magDb.toFixed(2)),
          phaseDeg: Number(phaseDeg.toFixed(2)),
          currentMagnitudeMa: Number(((vSupply / Math.sqrt(r * r + xl * xl)) * 1000.0).toFixed(3))
        });
      }

      return {
        status: 'SOLVED_THEORETICAL',
        circuitType,
        sourceVoltage: { value: vSupply, unit: 'V', label: 'AC Excitation (Vin)', source: 'nominal_supply', is_measured: false },
        parameters: {
          r: { value: r, unit: 'Ω', formatted: `${r >= 1000 ? (r / 1000).toFixed(2) + ' kΩ' : r.toFixed(1) + ' Ω'}`, label: 'Series Resistance (R)', source: 'component_value', is_measured: false },
          l: { value: l, unit: 'H', formatted: `${l < 1 ? (l * 1000).toFixed(2) + ' mH' : l.toFixed(3) + ' H'}`, label: 'Shunt Inductance (L)', source: 'component_value', is_measured: false },
          tau: { value: tau * 1000.0, unit: 'ms', formatted: `${(tau * 1000.0).toFixed(3)} ms`, label: 'Time Constant (τ = L/R)', source: 'theoretical_model', is_measured: false },
          cutoffFrequency: { value: fcHz, unit: 'Hz', formatted: `${fcHz >= 1000 ? (fcHz / 1000).toFixed(3) + ' kHz' : fcHz.toFixed(2) + ' Hz'}`, label: 'Cutoff Frequency (-3dB fc)', source: 'theoretical_model', is_measured: false },
          phaseAtCutoff: { value: 45.0, unit: '°', formatted: '+45.0°', label: 'Phase at Cutoff ∠H(fc)', source: 'theoretical_model', is_measured: false }
        },
        waveforms: [
          {
            name: 'RL High-Pass Frequency Response |H(f)| & Phase',
            type: 'frequency_response',
            xAxis: 'Frequency (Hz)',
            yAxis: 'Gain (dB)',
            fcHz: Number(fcHz.toFixed(2)),
            points: sweepPoints
          }
        ],
        governingEquation: 'fc = R / (2πL),  |H(jω)| = (ωL) / √(R² + (ωL)²),  ∠H(jω) = 90° - arctan(ωL / R)'
      };
    }

    // -----------------------------------------------------------------------
    // 13. RLC BAND-PASS FILTER (Phase 27)
    // -----------------------------------------------------------------------
    case 'RLC_BAND_PASS': {
      const rComp = matchedComponents?.resistor;
      const lComp = matchedComponents?.inductor;
      const cComp = matchedComponents?.capacitor;
      const r = extractNumericValue(rComp, 100.0);
      let l = extractNumericValue(lComp, 0.010);
      let c = extractNumericValue(cComp, 100e-6);
      if (l > 10.0) l = l * 1e-3;
      if (c > 1.0) c = c * 1e-6;

      const omega0 = 1.0 / Math.sqrt(Math.max(l * c, 1e-18));
      const f0Hz = omega0 / (2.0 * Math.PI);
      const qFactor = (omega0 * l) / Math.max(r, 1e-6);
      const bwHz = f0Hz / Math.max(qFactor, 1e-4);

      return {
        status: 'SOLVED_THEORETICAL',
        circuitType,
        sourceVoltage: { value: vSupply, unit: 'V', label: 'AC Source (Vin)', source: 'nominal_supply', is_measured: false },
        parameters: {
          r: { value: r, unit: 'Ω', formatted: `${r.toFixed(1)} Ω`, label: 'Load Resistor (R)', source: 'component_value', is_measured: false },
          l: { value: l, unit: 'H', formatted: `${(l * 1000).toFixed(2)} mH`, label: 'Tuning Inductor (L)', source: 'component_value', is_measured: false },
          c: { value: c, unit: 'F', formatted: `${(c * 1e6).toFixed(2)} µF`, label: 'Tuning Capacitor (C)', source: 'component_value', is_measured: false },
          f0: { value: f0Hz, unit: 'Hz', formatted: `${f0Hz >= 1000 ? (f0Hz / 1000).toFixed(3) + ' kHz' : f0Hz.toFixed(2) + ' Hz'}`, label: 'Center Frequency (f₀)', source: 'theoretical_model', is_measured: false },
          qFactor: { value: qFactor, unit: '', formatted: `${qFactor.toFixed(2)}`, label: 'Quality Factor (Q)', source: 'theoretical_model', is_measured: false },
          bandwidth: { value: bwHz, unit: 'Hz', formatted: `${bwHz.toFixed(2)} Hz`, label: 'Bandwidth (BW = f₀/Q)', source: 'theoretical_model', is_measured: false }
        },
        waveforms: [],
        governingEquation: 'f₀ = 1 / [ 2π√(LC) ],  BW = R / (2πL),  Q = f₀ / BW'
      };
    }

    // -----------------------------------------------------------------------
    // 14. NON-INVERTING OP-AMP AMPLIFIER (Phase 28)
    // -----------------------------------------------------------------------
    case 'OPAMP_NON_INVERTING': {
      const rfComp = matchedComponents?.rf;
      const rgComp = matchedComponents?.rg;
      const rf = extractNumericValue(rfComp, 10000.0);
      const rg = extractNumericValue(rgComp, 10000.0);

      const gain = 1.0 + (rf / Math.max(rg, 1e-6));
      const gainDb = 20.0 * Math.log10(Math.max(gain, 1e-6));
      const vOutTheoretical = vSupply * gain;

      // Operating state check
      const maxSwing = 15.0 - 1.5; // ±13.5V typical swing
      const isSaturated = Math.abs(vOutTheoretical) > maxSwing;
      const operatingState = isSaturated ? 'SATURATED' : 'LINEAR';

      // Generate time-domain sine waveforms (Vin vs Vout in phase)
      const numPoints = 80;
      const timePoints = [];
      for (let i = 0; i < numPoints; i++) {
        const t = (i / (numPoints - 1)) * 2 * Math.PI;
        const vinInstant = vSupply * Math.sin(t);
        const voutInstant = isSaturated
          ? Math.max(Math.min(vOutTheoretical * Math.sin(t), maxSwing), -maxSwing)
          : vOutTheoretical * Math.sin(t);
        timePoints.push({
          timeNormalized: Number((t / (2 * Math.PI)).toFixed(3)),
          vin: Number(vinInstant.toFixed(3)),
          vout: Number(voutInstant.toFixed(3))
        });
      }

      return {
        status: 'SOLVED_THEORETICAL',
        circuitType,
        sourceVoltage: { value: vSupply, unit: 'V', label: 'Input Signal (Vin)', source: 'nominal_supply', is_measured: false },
        parameters: {
          rf: { value: rf, unit: 'Ω', formatted: `${rf >= 1000 ? (rf / 1000).toFixed(2) + ' kΩ' : rf.toFixed(1) + ' Ω'}`, label: 'Feedback Resistor (Rf)', source: 'component_value', is_measured: false },
          rg: { value: rg, unit: 'Ω', formatted: `${rg >= 1000 ? (rg / 1000).toFixed(2) + ' kΩ' : rg.toFixed(1) + ' Ω'}`, label: 'Gain Resistor (Rg)', source: 'component_value', is_measured: false },
          gain: { value: gain, unit: '', formatted: `+${gain.toFixed(2)}`, label: 'Voltage Gain (Av = 1 + Rf/Rg)', source: 'theoretical_model', is_measured: false },
          gainDb: { value: gainDb, unit: 'dB', formatted: `${gainDb.toFixed(2)} dB`, label: 'Voltage Gain (dB)', source: 'theoretical_model', is_measured: false },
          vOut: { value: vOutTheoretical, unit: 'V', formatted: `${vOutTheoretical.toFixed(2)} V`, label: 'Output Voltage (Vout)', source: 'theoretical_model', is_measured: false },
          phase: { value: 0.0, unit: '°', formatted: '0.0°', label: 'Phase Angle (In-Phase)', source: 'theoretical_model', is_measured: false },
          operatingState
        },
        waveforms: [
          {
            name: 'Input vs Non-Inverting Output Waveform',
            type: 'time_domain_sine',
            points: timePoints,
            inPhase: true
          }
        ],
        governingEquation: 'Av = 1 + (Rf / Rg),  Vout = Vin × (1 + Rf / Rg),  Phase = 0°'
      };
    }

    // -----------------------------------------------------------------------
    // 15. INVERTING OP-AMP AMPLIFIER (Phase 28)
    // -----------------------------------------------------------------------
    case 'OPAMP_INVERTING': {
      const rfComp = matchedComponents?.rf;
      const rinComp = matchedComponents?.rin;
      const rf = extractNumericValue(rfComp, 10000.0);
      const rin = extractNumericValue(rinComp, 10000.0);

      const gainMag = rf / Math.max(rin, 1e-6);
      const gainDb = 20.0 * Math.log10(Math.max(gainMag, 1e-6));
      const vOutTheoretical = -vSupply * gainMag;

      const maxSwing = 15.0 - 1.5;
      const isSaturated = Math.abs(vOutTheoretical) > maxSwing;
      const operatingState = isSaturated ? 'SATURATED' : 'LINEAR';

      const numPoints = 80;
      const timePoints = [];
      for (let i = 0; i < numPoints; i++) {
        const t = (i / (numPoints - 1)) * 2 * Math.PI;
        const vinInstant = vSupply * Math.sin(t);
        const voutInstant = isSaturated
          ? Math.max(Math.min(vOutTheoretical * Math.sin(t), maxSwing), -maxSwing)
          : vOutTheoretical * Math.sin(t);
        timePoints.push({
          timeNormalized: Number((t / (2 * Math.PI)).toFixed(3)),
          vin: Number(vinInstant.toFixed(3)),
          vout: Number(voutInstant.toFixed(3))
        });
      }

      return {
        status: 'SOLVED_THEORETICAL',
        circuitType,
        sourceVoltage: { value: vSupply, unit: 'V', label: 'Input Signal (Vin)', source: 'nominal_supply', is_measured: false },
        parameters: {
          rf: { value: rf, unit: 'Ω', formatted: `${rf >= 1000 ? (rf / 1000).toFixed(2) + ' kΩ' : rf.toFixed(1) + ' Ω'}`, label: 'Feedback Resistor (Rf)', source: 'component_value', is_measured: false },
          rin: { value: rin, unit: 'Ω', formatted: `${rin >= 1000 ? (rin / 1000).toFixed(2) + ' kΩ' : rin.toFixed(1) + ' Ω'}`, label: 'Input Resistor (Rin)', source: 'component_value', is_measured: false },
          gainMagnitude: { value: gainMag, unit: '', formatted: `${gainMag.toFixed(2)}`, label: '|Av| = Rf / Rin', source: 'theoretical_model', is_measured: false },
          gain: { value: -gainMag, unit: '', formatted: `-${gainMag.toFixed(2)}`, label: 'Voltage Gain (Av = -Rf/Rin)', source: 'theoretical_model', is_measured: false },
          gainDb: { value: gainDb, unit: 'dB', formatted: `${gainDb.toFixed(2)} dB`, label: 'Voltage Gain (dB)', source: 'theoretical_model', is_measured: false },
          vOut: { value: vOutTheoretical, unit: 'V', formatted: `${vOutTheoretical.toFixed(2)} V`, label: 'Output Voltage (Vout)', source: 'theoretical_model', is_measured: false },
          phase: { value: 180.0, unit: '°', formatted: '180.0°', label: 'Phase Angle (Inverted)', source: 'theoretical_model', is_measured: false },
          operatingState
        },
        waveforms: [
          {
            name: 'Input vs Inverted Output Waveform (180° Phase Shift)',
            type: 'time_domain_sine',
            points: timePoints,
            inPhase: false
          }
        ],
        governingEquation: 'Av = - (Rf / Rin),  Vout = -Vin × (Rf / Rin),  Phase = 180°'
      };
    }

    // -----------------------------------------------------------------------
    // 16. VOLTAGE FOLLOWER / BUFFER (Phase 28)
    // -----------------------------------------------------------------------
    case 'OPAMP_VOLTAGE_FOLLOWER': {
      const vOutTheoretical = vSupply;
      const numPoints = 80;
      const timePoints = [];
      for (let i = 0; i < numPoints; i++) {
        const t = (i / (numPoints - 1)) * 2 * Math.PI;
        const vinInstant = vSupply * Math.sin(t);
        timePoints.push({
          timeNormalized: Number((t / (2 * Math.PI)).toFixed(3)),
          vin: Number(vinInstant.toFixed(3)),
          vout: Number(vinInstant.toFixed(3))
        });
      }

      return {
        status: 'SOLVED_THEORETICAL',
        circuitType,
        sourceVoltage: { value: vSupply, unit: 'V', label: 'Input Signal (Vin)', source: 'nominal_supply', is_measured: false },
        parameters: {
          gain: { value: 1.0, unit: '', formatted: '1.000', label: 'Voltage Gain (Av ≈ 1.0)', source: 'theoretical_model', is_measured: false },
          gainDb: { value: 0.0, unit: 'dB', formatted: '0.00 dB', label: 'Voltage Gain (dB)', source: 'theoretical_model', is_measured: false },
          vOut: { value: vOutTheoretical, unit: 'V', formatted: `${vOutTheoretical.toFixed(2)} V`, label: 'Output Voltage (Vout)', source: 'theoretical_model', is_measured: false },
          phase: { value: 0.0, unit: '°', formatted: '0.0°', label: 'Phase Angle (In-Phase)', source: 'theoretical_model', is_measured: false },
          operatingState: 'LINEAR'
        },
        waveforms: [
          {
            name: 'Voltage Follower Unity Tracking Waveform',
            type: 'time_domain_sine',
            points: timePoints,
            inPhase: true
          }
        ],
        governingEquation: 'Av ≈ 1.0,  Vout = Vin,  Zin ≈ ∞,  Zout ≈ 0'
      };
    }

    default:
      return {
        status: 'UNAVAILABLE',
        circuitType,
        parameters: {},
        waveforms: [],
        notes: ['No specific theoretical behavioural formula registered for this custom topology.']
      };
  }
}

export default calculateCircuitBehaviour;

