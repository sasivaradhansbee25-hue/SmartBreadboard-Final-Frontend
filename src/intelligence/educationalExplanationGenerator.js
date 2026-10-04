/**
 * SmartBreadboard 3D — Educational Explanation Generator (Phase 25)
 *
 * Pedagogically sound, deterministic explanation generator.
 * Produces structured lessons, governing equation walkthroughs,
 * what-if predictions, and visual guide explanations strictly based
 * on the verified circuit model.
 */

import { circuitRegistry } from './circuitKnowledgeRegistry.js';

export function generateEducationalExplanation(classification, electricalBehaviour) {
  if (!classification) return null;

  const { circuitType, verificationState, displayName, warnings, missingRequirements } = classification;
  const def = circuitRegistry.get(circuitType);
  const p = electricalBehaviour?.parameters || {};

  // Case 1: Unverified / Incomplete Circuit
  if (verificationState === 'NOT_VERIFIED' || verificationState === 'UNSUPPORTED') {
    return {
      title: displayName || 'Unverified Circuit Configuration',
      status: verificationState,
      isVerified: false,
      summary: `The system detected physical breadboard components, but the electrical topology could not be verified as a standard canonical textbook circuit.`,
      purpose: 'Verification is required before educational simulations and theoretical waveforms are activated.',
      missingRequirements: missingRequirements || [],
      warnings: warnings || [],
      keyComponents: [],
      governingEquations: [],
      visualGuide: 'Educational animations remain suspended to ensure zero fabrication of unverified electrical behaviour.',
      whatIfAnalysis: 'Ensure all terminal leads, tie-point rows, and supply rails are firmly placed and correctly connected.',
      measurementDisclaimer: 'All electrical statuses in SmartBreadboard 3D require verified topological grounding.'
    };
  }

  // Case 2: Verified Circuits
  const sections = {
    title: displayName,
    status: verificationState,
    isVerified: true,
    summary: def?.description || 'Verified electronic circuit topology.',
    purpose: def?.explanationTemplate?.purpose || 'Electronic signal and power processing.',
    application: def?.explanationTemplate?.application || 'Everyday consumer and industrial electronics.',
    governingLaw: def?.explanationTemplate?.governingLaw || "Fundamental Electronic Laws",
    formulaSummary: def?.explanationTemplate?.formulaSummary || electricalBehaviour?.governingEquation || '',
    keyComponents: [],
    governingEquations: [],
    visualGuide: '',
    whatIfAnalysis: '',
    measurementDisclaimer: 'Calculated parameters are derived from deterministic theoretical models and MNA simulation. Physical bench multimeter validation remains unrecorded (NOT_TESTED).'
  };

  if (circuitType === 'VOLTAGE_DIVIDER') {
    sections.keyComponents = [
      { name: 'Upper Resistor (R1 / Pull-Up)', role: `Drops ${((p?.sourceVoltage?.value || 5) - (p?.vOutTheoretical?.value || 2.5)).toFixed(2)}V across top branch, setting upper impedance.` },
      { name: 'Lower Resistor (R2 / Pull-Down)', role: `Develops the output potential Vout = ${p?.vOutTheoretical?.formatted || '2.50V'} relative to Ground.` }
    ];
    sections.governingEquations = [
      { equation: 'Vout = Vin × [ R2 / (R1 + R2) ]', substituted: `Vout = ${p?.sourceVoltage?.value || 5}V × [ ${p?.r2?.value || 2200}Ω / (${p?.r1?.value || 1000}Ω + ${p?.r2?.value || 2200}Ω) ] = ${p?.vOutTheoretical?.formatted || '2.50V'}` },
      { equation: 'I_loop = Vin / (R1 + R2)', substituted: `I_loop = ${p?.sourceVoltage?.value || 5}V / ${p?.rTotal?.formatted || '3.20 kΩ'} = ${p?.branchCurrent?.formatted || '1.56 mA'}` }
    ];
    sections.visualGuide = 'The cyan halo marks R1 (upper potential step), the indigo halo marks R2 (reference to GND), and the emerald marker on the intermediate tie-point row indicates the divided output potential.';
    sections.whatIfAnalysis = 'Increasing R2 increases Vout closer to Vin. Increasing R1 decreases Vout closer to 0V. Decreasing both resistors proportionally preserves the voltage ratio but increases loop current and power consumption.';
  } else if (circuitType === 'LED_CURRENT_LIMITER') {
    sections.keyComponents = [
      { name: 'Ballast Resistor (R_limit)', role: `Absorbs excess voltage (${p?.vResistor?.formatted || '3.00V'}) to limit forward current to ${p?.forwardCurrent?.formatted || '13.6 mA'}.` },
      { name: 'Light Emitting Diode (LED)', role: `Emits photons via electroluminescence with forward junction barrier Vf = ${p?.vForward?.formatted || '2.00V'}.` }
    ];
    sections.governingEquations = [
      { equation: 'I_LED = (Vin - Vf) / R_limit', substituted: `I_LED = (${p?.sourceVoltage?.value || 5}V - 2.00V) / ${p?.rLimit?.formatted || '220Ω'} = ${p?.forwardCurrent?.formatted || '13.6 mA'}` },
      { equation: 'P_resistor = I² × R', substituted: `P_R = (${p?.forwardCurrent?.value || 13.6}mA)² × ${p?.rLimit?.value || 220}Ω = ${p?.powerResistor?.formatted || '40.8 mW'}` }
    ];
    sections.visualGuide = 'The amber halo highlights the ballast resistor absorbing excess thermal power, while the pulsing red aura indicates the active photon emission from the forward-biased LED PN-junction.';
    sections.whatIfAnalysis = 'Decreasing R_limit below 150Ω will drive the LED beyond safe 25mA operating limits, leading to rapid overheating. Increasing R_limit dims the LED proportionally.';
  } else if (circuitType === 'RC_CHARGING') {
    sections.keyComponents = [
      { name: 'Timing Resistor (R)', role: `Restricts charging current flow, dictating charging velocity.` },
      { name: 'Storage Capacitor (C)', role: `Stores electrostatic potential across dielectric plates: Q = C × V.` }
    ];
    sections.governingEquations = [
      { equation: 'τ = R × C', substituted: `τ = ${p?.r?.formatted || '4.7 kΩ'} × ${p?.c?.formatted || '100 nF'} = ${p?.tau?.formatted || '0.47 ms'}` },
      { equation: 'v_C(t) = Vin × (1 - e^(-t/τ))', substituted: `At t = 1τ: v_C = 63.2% of Vin (${p?.voltage1Tau?.formatted || '3.16V'}); at 5τ: 99.3% (${p?.voltage5Tau?.formatted || '4.97V'})` },
      { equation: 'fc (-3dB) = 1 / (2π × R × C)', substituted: `fc = 1 / (2π × ${p?.tau?.value || 0.47}ms) = ${p?.cutoffFrequency?.formatted || '338.6 Hz'}` }
    ];
    sections.visualGuide = 'The live time-series graph plots instantaneous capacitor voltage v_C(t). The cyan glow indicates series resistive charging current, and the blue capacitor aura reflects electrostatic charge accumulation.';
    sections.whatIfAnalysis = 'Doubling capacitance C doubles the time constant τ, making the output voltage rise twice as slowly. Lowering R increases the cutoff frequency fc, passing higher frequency signals.';
  } else if (circuitType === 'RC_DISCHARGING') {
    sections.keyComponents = [
      { name: 'Discharge Resistor (R)', role: `Provides a safe dissipation path for stored electric charge.` },
      { name: 'Storage Capacitor (C)', role: `Acts as a transient DC energy source discharging through R.` }
    ];
    sections.governingEquations = [
      { equation: 'v_C(t) = V0 × e^(-t/τ)', substituted: `v_C(t) decays exponentially with decay constant τ = ${p?.tau?.formatted || '1.0 ms'}` },
      { equation: 't½ = τ × ln(2)', substituted: `t½ = ${p?.tau?.formatted || '1.0 ms'} × 0.693 = ${p?.halfLife?.formatted || '0.693 ms'}` }
    ];
    sections.visualGuide = 'The exponential decay curve illustrates transient energy discharge. The purple and pink halos mark the active bleed dissipation path.';
    sections.whatIfAnalysis = 'Increasing bleed resistance R prolongs charge retention. Decreasing R produces rapid discharge with higher peak transient current.';
  } else if (circuitType === 'RLC_SERIES_RESONANCE') {
    sections.keyComponents = [
      { name: 'Damping Resistor (R)', role: `Limits peak resonant current to I_max = Vin/R (${p?.iAtResonance?.formatted || 'N/A'}) and sets bandwidth.` },
      { name: 'Resonant Inductor (L)', role: `Stores magnetic energy, creating inductive reactance XL = ωL (+90° phase lead).` },
      { name: 'Tuning Capacitor (C)', role: `Stores electric energy, creating capacitive reactance XC = 1/(ωC) (-90° phase lag).` }
    ];
    sections.governingEquations = [
      { equation: 'f₀ = 1 / [ 2π√(L × C) ]', substituted: `f₀ = 1 / [ 2π × √(${p?.l?.formatted || '10mH'} × ${p?.c?.formatted || '100µF'}) ] = ${p?.f0?.formatted || '159.2 Hz'}` },
      { equation: 'Q = (ω₀ × L) / R', substituted: `Q = (2π × ${p?.f0?.value || 159}Hz × ${p?.l?.formatted || '10mH'}) / ${p?.r?.formatted || '100Ω'} = ${p?.qFactor?.formatted || '0.10'}` },
      { equation: 'BW = f₀ / Q = R / (2πL)', substituted: `BW = ${p?.f0?.formatted || '159Hz'} / ${p?.qFactor?.formatted || '0.1'} = ${p?.bandwidth?.formatted || 'N/A'}` }
    ];
    sections.visualGuide = 'The frequency spectrum chart displays the sharp resonance peak at f₀. At resonance, XL cancels XC exactly, causing total impedance to collapse to pure resistance |Z| = R.';
    sections.whatIfAnalysis = 'Decreasing series resistance R sharpens the resonance peak, increasing Quality factor Q and narrowing bandwidth BW. Increasing inductance L increases stored magnetic energy.';
  } else if (circuitType === 'RLC_PARALLEL_RESONANCE') {
    sections.keyComponents = [
      { name: 'Tank Resistor (R)', role: `Sets peak tank impedance |Z_max| = R and determines parallel damping.` },
      { name: 'Tank Inductor (L)', role: `Provides inductive branch susceptance BL = 1/(ωL).` },
      { name: 'Tank Capacitor (C)', role: `Provides capacitive branch susceptance BC = ωC.` }
    ];
    sections.governingEquations = [
      { equation: 'f₀ = 1 / [ 2π√(L × C) ]', substituted: `Resonance frequency f₀ = ${p?.f0?.formatted || 'N/A'}` },
      { equation: 'Q = R × √(C / L)', substituted: `Q = ${p?.r?.formatted || '1kΩ'} × √(${p?.c?.formatted || '100nF'} / ${p?.l?.formatted || '10mH'}) = ${p?.qFactor?.formatted || 'N/A'}` }
    ];
    sections.visualGuide = 'In a parallel tank, circulating reactive currents oscillate between L and C while external supply current reaches a minimum.';
    sections.whatIfAnalysis = 'Increasing parallel resistance R increases peak impedance and Quality factor Q, transforming the tank into a higher-selectivity filter.';
  } else if (circuitType === 'RC_LOW_PASS') {
    sections.keyComponents = [
      { name: 'Series Resistor (R)', role: `Establishes series impedance, dropping high-frequency potential in combination with capacitor reactance.` },
      { name: 'Shunt Capacitor (C)', role: `Reactance XC = 1/(2πfC) drops with increasing frequency, shunting high frequencies to ground.` }
    ];
    sections.governingEquations = [
      { equation: 'fc (-3dB) = 1 / (2πRC)', substituted: `fc = 1 / (2π × ${p?.r?.formatted || '1 kΩ'} × ${p?.c?.formatted || '100 nF'}) = ${p?.cutoffFrequency?.formatted || '1.59 kHz'}` },
      { equation: '|H(jω)| = 1 / √(1 + (ωRC)²)', substituted: `At f = fc: |H(fc)| = 1/√2 ≈ 0.7071 (-3.01 dB); as f → ∞, gain rolls off at -20 dB/decade` },
      { equation: '∠H(jω) = -arctan(ωRC)', substituted: `Phase at DC is 0°, phase at cutoff fc is -45°, asymptotic phase at high frequency is -90°` }
    ];
    sections.visualGuide = 'At low frequencies, capacitor reactance is huge (XC >> R), allowing signal to pass to Vout without attenuation. As frequency increases, XC collapses, shunting AC energy to ground.';
    sections.whatIfAnalysis = 'Increasing capacitance C or resistance R lowers cutoff frequency fc, attenuating lower frequency signals. Decreasing R or C raises fc into the ultrasonic band.';
  } else if (circuitType === 'RC_HIGH_PASS') {
    sections.keyComponents = [
      { name: 'Series Capacitor (C)', role: `Blocks steady-state DC potential while passing high-frequency AC displacement currents.` },
      { name: 'Shunt Resistor (R)', role: `Develops output voltage Vout = I × R relative to Ground reference.` }
    ];
    sections.governingEquations = [
      { equation: 'fc (-3dB) = 1 / (2πRC)', substituted: `fc = 1 / (2π × ${p?.r?.formatted || '1 kΩ'} × ${p?.c?.formatted || '100 nF'}) = ${p?.cutoffFrequency?.formatted || '1.59 kHz'}` },
      { equation: '|H(jω)| = (ωRC) / √(1 + (ωRC)²)', substituted: `At DC (f=0Hz): |H| = 0; at f = fc: |H(fc)| = 1/√2 (-3.01 dB); at f >> fc: |H| ≈ 1.0 (0 dB)` },
      { equation: '∠H(jω) = 90° - arctan(ωRC)', substituted: `Phase at DC is +90° (leading), phase at fc is +45°, asymptotic passband phase is 0°` }
    ];
    sections.visualGuide = 'The series capacitor acts as an open circuit to DC and low frequencies. Above fc, capacitive reactance becomes negligible compared to R, enabling full passband transmission.';
    sections.whatIfAnalysis = 'Decreasing C raises cutoff frequency fc, requiring higher frequency input signals to pass without attenuation. Lowering R increases the cutoff frequency proportionally.';
  } else if (circuitType === 'RL_LOW_PASS') {
    sections.keyComponents = [
      { name: 'Series Inductor (L)', role: `Inductive reactance XL = 2πfL opposes rapid changes in current at high frequencies.` },
      { name: 'Shunt Resistor (R)', role: `Develops output voltage across load to ground reference.` }
    ];
    sections.governingEquations = [
      { equation: 'fc (-3dB) = R / (2πL)', substituted: `fc = ${p?.r?.formatted || '1 kΩ'} / (2π × ${p?.l?.formatted || '100 mH'}) = ${p?.cutoffFrequency?.formatted || '1.59 kHz'}` },
      { equation: '|H(jω)| = R / √(R² + (ωL)²)', substituted: `At DC (f=0Hz): |H| = 1.0 (0 dB); at f = fc: |H(fc)| = 0.7071 (-3.01 dB)` },
      { equation: '∠H(jω) = -arctan(ωL / R)', substituted: `Phase at DC is 0°, phase at fc is -45°, asymptotic high-frequency phase is -90°` }
    ];
    sections.visualGuide = 'At DC, the inductor behaves as a short circuit (XL ≈ 0), passing full voltage to Vout. At higher frequencies, back-EMF opposes current flow, rolling off signal transmission.';
    sections.whatIfAnalysis = 'Increasing inductance L increases magnetic energy storage, decreasing cutoff frequency fc and filtering out lower frequencies.';
  } else if (circuitType === 'RL_HIGH_PASS') {
    sections.keyComponents = [
      { name: 'Series Resistor (R)', role: `Limits current and forms an L/R voltage divider with the shunt inductor.` },
      { name: 'Shunt Inductor (L)', role: `Shunts DC and low frequencies to ground with near-zero reactance.` }
    ];
    sections.governingEquations = [
      { equation: 'fc (-3dB) = R / (2πL)', substituted: `fc = ${p?.r?.formatted || '1 kΩ'} / (2π × ${p?.l?.formatted || '100 mH'}) = ${p?.cutoffFrequency?.formatted || '1.59 kHz'}` },
      { equation: '|H(jω)| = (ωL) / √(R² + (ωL)²)', substituted: `At DC (f=0Hz): |H| = 0; at f = fc: |H(fc)| = 0.7071 (-3.01 dB); at high f: |H| ≈ 1.0` },
      { equation: '∠H(jω) = 90° - arctan(ωL / R)', substituted: `Phase at DC is +90°, phase at cutoff fc is +45°, phase at high frequency approaches 0°` }
    ];
    sections.visualGuide = 'At low frequencies, the inductor easily diverts current directly to ground. Above cutoff frequency fc, inductive reactance builds up, forcing signal to develop across Vout.';
    sections.whatIfAnalysis = 'Decreasing inductance L raises cutoff frequency fc. Increasing R increases the cutoff frequency.';
  } else if (circuitType === 'RLC_BAND_PASS') {
    sections.keyComponents = [
      { name: 'Series LC Resonant Tank', role: `Impedance collapses to zero at resonance f0 = 1/(2π√(LC)), allowing maximum current through to load.` },
      { name: 'Load Resistor (R)', role: `Develops peak output voltage at resonance and determines bandwidth BW = R / (2πL).` }
    ];
    sections.governingEquations = [
      { equation: 'f₀ = 1 / [ 2π√(LC) ]', substituted: `Center frequency f₀ = ${p?.f0?.formatted || 'N/A'}` },
      { equation: 'BW = R / (2πL)', substituted: `Bandwidth BW = ${p?.bandwidth?.formatted || 'N/A'}` },
      { equation: 'Q = f₀ / BW', substituted: `Quality factor Q = ${p?.qFactor?.formatted || 'N/A'}` }
    ];
    sections.visualGuide = 'At center frequency f₀, inductive reactance XL exactly cancels capacitive reactance XC, creating a pure low-resistance bridge from input to output.';
    sections.whatIfAnalysis = 'Decreasing resistor R narrows the passband bandwidth BW and increases Quality factor Q, sharpening frequency selectivity.';
  } else if (circuitType === 'OPAMP_NON_INVERTING') {
    const rfVal = p?.rf?.value || 10000;
    const rgVal = p?.rg?.value || 10000;
    const gain = p?.gain?.value || (1 + rfVal / rgVal);
    sections.keyComponents = [
      { name: 'Operational Amplifier IC', role: `High open-loop gain difference amplifier (A_OL ≈ 100 dB) forcing virtual short between V+ and V-.` },
      { name: 'Feedback Resistor (Rf)', role: `Connects output Vout back to inverting terminal V-, establishing closed-loop negative feedback.` },
      { name: 'Gain-Setting Resistor (Rg)', role: `Forms a voltage divider with Rf from Vout to Ground to set non-inverting gain.` }
    ];
    sections.governingEquations = [
      { equation: 'Av = 1 + (Rf / Rg)', substituted: `Av = 1 + (${rfVal}Ω / ${rgVal}Ω) = +${gain.toFixed(2)} (${(20 * Math.log10(gain)).toFixed(2)} dB)` },
      { equation: 'Vout = Vin × Av', substituted: `Output signal is amplified in phase (0° phase shift) with Vin.` },
      { equation: 'V_diff = V+ - V- ≈ 0V', substituted: `Virtual short principle: negative feedback forces inverting terminal to track Vin.` }
    ];
    sections.visualGuide = 'Signal enters the non-inverting (+) terminal directly. The emerald glow shows in-phase output amplification, while the cyan feedback loop returns an attenuated signal to the inverting (-) pin.';
    sections.whatIfAnalysis = 'Increasing Rf increases closed-loop voltage gain. Decreasing Rg also increases gain. If Vin exceeds the supply rails / gain limit, the amplifier enters SATURATION.';
  } else if (circuitType === 'OPAMP_INVERTING') {
    const rfVal = p?.rf?.value || 10000;
    const rinVal = p?.rin?.value || 10000;
    const gainMag = p?.gainMagnitude?.value || (rfVal / rinVal);
    sections.keyComponents = [
      { name: 'Operational Amplifier IC', role: `Forces inverting node V- to virtual ground potential (0V) through high open-loop negative feedback.` },
      { name: 'Input Resistor (Rin)', role: `Converts input voltage Vin into input signal current I_in = Vin / Rin.` },
      { name: 'Feedback Resistor (Rf)', role: `Conducts entire input current to produce inverted output potential Vout = -I_in × Rf.` }
    ];
    sections.governingEquations = [
      { equation: 'Av = - (Rf / Rin)', substituted: `Av = - (${rfVal}Ω / ${rinVal}Ω) = -${gainMag.toFixed(2)} (Phase = 180°)` },
      { equation: 'Vout = -Vin × (Rf / Rin)', substituted: `Output signal is inverted by 180° relative to input Vin.` },
      { equation: 'V- ≈ 0V (Virtual Ground)', substituted: `Non-inverting pin is grounded; feedback maintains inverting pin at 0V virtual ground.` }
    ];
    sections.visualGuide = 'Signal enters through Rin into the inverting (-) node. The inverted magenta waveform highlights the 180° phase inversion relative to Vin.';
    sections.whatIfAnalysis = 'Increasing Rf increases inverting gain magnitude. Increasing Rin lowers input loading but decreases gain magnitude.';
  } else if (circuitType === 'OPAMP_VOLTAGE_FOLLOWER') {
    sections.keyComponents = [
      { name: 'Operational Amplifier IC', role: `Provides unity-gain buffer action with near-infinite input impedance and near-zero output impedance.` },
      { name: 'Direct Feedback Jumper', role: `Applies 100% negative feedback from Vout directly to the inverting (-) terminal.` }
    ];
    sections.governingEquations = [
      { equation: 'Av ≈ 1.0 (0 dB)', substituted: `Av = Vout / Vin = 1.000, Phase = 0°` },
      { equation: 'Vout = Vin', substituted: `Output voltage precisely mirrors input voltage without loading the signal source.` },
      { equation: 'Zin ≈ ∞,  Zout ≈ 0', substituted: `Impedance buffer protects sensitive high-impedance sensors from low-impedance load distortion.` }
    ];
    sections.visualGuide = 'The output voltage tracks input voltage with 1:1 unity gain. The green feedback line illustrates 100% negative feedback stabilization.';
    sections.whatIfAnalysis = 'The follower prevents signal voltage drop when driving low-resistance loads that would otherwise collapse a passive divider.';
  } else if (circuitType === 'DIODE_FORWARD_BIAS') {
    sections.keyComponents = [
      { name: 'PN Junction Diode', role: 'Enters exponential forward conduction once forward bias exceeds the built-in barrier potential.' },
      { name: 'Series Resistor', role: 'Limits exponential forward diode current to prevent thermal runaway and establish operating point.' }
    ];
    sections.governingEquations = [
      { equation: 'I_D = Is × [ exp(V_D / (n × V_T)) - 1 ]', substituted: 'Shockley non-linear equation solved iteratively via Newton-Raphson linearization.' },
      { equation: 'V_source = I_D × R_series + V_D', substituted: 'Kirchhoff Voltage Law loop balance.' }
    ];
    sections.visualGuide = 'When forward voltage rises above the barrier threshold (~0.6V - 0.7V), the depletion layer shrinks, allowing carriers to cross the junction.';
    sections.whatIfAnalysis = 'Increasing series resistance reduces diode current and moves the operating point down the exponential I-V curve.';
  } else if (circuitType === 'DIODE_REVERSE_BIAS') {
    sections.keyComponents = [
      { name: 'PN Junction Diode', role: 'Widened depletion zone blocks majority carrier drift, restricting flow to reverse saturation current.' },
      { name: 'Series Resistor', role: 'Pulls the cathode node to the applied potential under negligible leakage current.' }
    ];
    sections.governingEquations = [
      { equation: 'I_D ≈ -Is', substituted: 'Reverse saturation leakage current under negative bias.' }
    ];
    sections.visualGuide = 'The red blocking halo indicates reverse polarity blocking current flow through the branch.';
    sections.whatIfAnalysis = 'Unless the reverse breakdown threshold is exceeded, the branch acts as an open circuit.';
  } else if (circuitType === 'HALF_WAVE_RECTIFIER') {
    sections.keyComponents = [
      { name: 'Rectifier Diode', role: 'Conducts during positive half-cycles and blocks reverse current during negative half-cycles.' },
      { name: 'Load Resistor', role: 'Converts rectified forward current into pulsating unipolar DC output voltage.' }
    ];
    sections.governingEquations = [
      { equation: 'Vout(t) = max(0, Vin(t) - V_D)', substituted: 'Half-wave output voltage waveform.' },
      { equation: 'V_DC(avg) ≈ V_peak / π', substituted: 'Average DC output for ideal half-wave rectification.' }
    ];
    sections.visualGuide = 'Current pulses through the load only during the positive half of the AC cycle, creating pulsating DC.';
    sections.whatIfAnalysis = 'Adding a parallel smoothing capacitor filters the pulsation ripple into smooth DC.';
  } else if (circuitType === 'FULL_WAVE_BRIDGE_RECTIFIER') {
    sections.keyComponents = [
      { name: '4-Diode Bridge Network', role: 'Steers alternating current from both half-cycles into a unidirectional load path.' },
      { name: 'Load Resistor', role: 'Carries unipolar rectified DC current during both positive and negative AC input phases.' }
    ];
    sections.governingEquations = [
      { equation: 'Vout(t) = |Vin(t)| - 2 × V_D', substituted: 'Full-wave rectified voltage with two diode forward drops.' },
      { equation: 'V_DC(avg) ≈ 2 × V_peak / π', substituted: 'Average DC output for ideal full-wave rectification.' }
    ];
    sections.visualGuide = 'Diodes conduct in diagonal pairs (D1+D4 on positive half-cycle, D2+D3 on negative half-cycle), routing current continuously downward through the load.';
    sections.whatIfAnalysis = 'Full-wave rectification doubles ripple frequency (100 Hz / 120 Hz) compared to half-wave, greatly improving filtering efficiency.';
  }


  return sections;
}

export default generateEducationalExplanation;

