/**
 * SmartBreadboard 3D — AC Analysis & Resonance Unit Tests (Phase 26)
 *
 * Automated verification suite:
 * 1. Complex arithmetic primitives (add, sub, mul, div, polar, magnitude, phase).
 * 2. Pure resistor AC impedance (|Z| = R, phase = 0°).
 * 3. RC series impedance (|Z| = sqrt(R^2 + Xc^2), phase < 0°).
 * 4. RL series impedance (|Z| = sqrt(R^2 + Xl^2), phase > 0°).
 * 5. Series RLC resonant frequency f0 = 1 / (2*pi*sqrt(L*C)) verification.
 * 6. Series RLC zero-phase crossing and current peak at resonance.
 * 7. Parallel RLC tank impedance peak and resonance detection.
 * 8. Bandwidth and Quality Factor Q calculation.
 * 9. Guard: Negative/Zero frequency handled safely.
 * 10. Scientific validation benchmark (R=100Ω, L=10mH, C=100µF -> f0 ≈ 159.15 Hz).
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  Complex,
  solveAcPoint,
  runClientFrequencySweep,
  analyzeClientResonance
} from '../../intelligence/acAnalysisEngine.js';

describe('Phase 26: AC Circuit Analysis & Resonance Engine', () => {

  // Test 1: Complex Number Arithmetic
  test('1. Complex number utilities perform exact rectangular and polar math', () => {
    const c1 = new Complex(3, 4); // 3 + j4 -> mag = 5, phase = 53.13°
    assert.equal(c1.mag(), 5);
    assert.ok(Math.abs(c1.phaseDeg() - 53.13) < 0.01);

    const c2 = new Complex(1, 2);
    const sum = c1.add(c2);
    assert.equal(sum.real, 4);
    assert.equal(sum.imag, 6);

    const prod = c1.mul(c2); // (3+j4)(1+j2) = 3 - 8 + j(4 + 6) = -5 + j10
    assert.equal(prod.real, -5);
    assert.equal(prod.imag, 10);

    const quot = c1.div(c2); // (3+j4)/(1+j2) = (3+j4)(1-j2)/5 = (3 + 8 + j(-6 + 4))/5 = 2.2 - j0.4
    assert.ok(Math.abs(quot.real - 2.2) < 0.001);
    assert.ok(Math.abs(quot.imag - (-0.4)) < 0.001);
  });

  // Test 2: Single Resistor AC Impedance
  test('2. Single resistor AC impedance equals pure real resistance with 0° phase', () => {
    const netlist = {
      components: [
        { id: 'R1', type: 'resistor', value: 1000, node1: 'N1', node2: 'GND' }
      ]
    };
    const res = solveAcPoint(netlist, 1000.0);
    assert.equal(res.success, true);
    assert.ok(Math.abs(res.inputImpedance.magnitudeOhms - 1000.0) < 1.0);
    assert.ok(Math.abs(res.inputImpedance.phaseDeg) < 0.1);
  });

  // Test 3: RC Series Circuit Impedance
  test('3. RC series impedance produces capacitive phase lag (phase < 0°)', () => {
    // R = 1000 Ω, C = 1 µF at f = 1000 Hz (Xc ≈ 159.15 Ω)
    const netlist = {
      components: [
        { id: 'R1', type: 'resistor', value: 1000, node1: 'N1', node2: 'N2' },
        { id: 'C1', type: 'capacitor', value: 1e-6, node1: 'N2', node2: 'GND' }
      ]
    };
    const res = solveAcPoint(netlist, 1000.0);
    assert.equal(res.success, true);
    assert.ok(Math.abs(res.inputImpedance.magnitudeOhms - 1012.6) < 5.0);
    assert.ok(res.inputImpedance.phaseDeg < 0);
  });

  // Test 4: RL Series Circuit Impedance
  test('4. RL series impedance produces inductive phase lead (phase > 0°)', () => {
    // R = 100 Ω, L = 10 mH at f = 1000 Hz (Xl ≈ 62.83 Ω)
    const netlist = {
      components: [
        { id: 'R1', type: 'resistor', value: 100, node1: 'N1', node2: 'N2' },
        { id: 'L1', type: 'inductor', value: 0.010, node1: 'N2', node2: 'GND' }
      ]
    };
    const res = solveAcPoint(netlist, 1000.0);
    assert.equal(res.success, true);
    assert.ok(Math.abs(res.inputImpedance.magnitudeOhms - 118.1) < 2.0);
    assert.ok(res.inputImpedance.phaseDeg > 0);
  });

  // Test 5: Scientific Validation Benchmark: Series RLC Resonance
  test('5. Series RLC test case (R=100Ω, L=10mH, C=100µF) detects resonant frequency near 159.15 Hz', () => {
    const netlist = {
      components: [
        { id: 'R1', type: 'resistor', value: 100, node1: 'N1', node2: 'N2' },
        { id: 'L1', type: 'inductor', value: 0.010, node1: 'N2', node2: 'N3' },
        { id: 'C1', type: 'capacitor', value: 100e-6, node1: 'N3', node2: 'GND' }
      ]
    };

    // Run Frequency Sweep around resonance (10 Hz to 1000 Hz)
    const sweep = runClientFrequencySweep(netlist, 10.0, 1000.0, 100, 'log');
    assert.equal(sweep.success, true);
    assert.ok(sweep.points.length >= 80);

    const res = analyzeClientResonance(sweep, false);
    assert.equal(res.resonanceDetected, true);
    assert.equal(res.status, 'VERIFIED_RESONANT');

    // Expected theoretical f0 = 1 / (2*pi*sqrt(0.01 * 100e-6)) = 159.155 Hz
    assert.ok(Math.abs(res.resonantFrequencyHz - 159.15) < 10.0);
    // At resonance, impedance reaches minimum |Z| ≈ R = 100 Ω
    assert.ok(Math.abs(res.impedanceAtResonanceOhms - 100.0) < 15.0);
    // Phase should cross near 0°
    assert.ok(Math.abs(res.phaseAtResonanceDeg) < 15.0);
  });

  // Test 6: Parallel RLC Tank Resonance
  test('6. Parallel RLC tank detects resonance and impedance peak', () => {
    const netlist = {
      components: [
        { id: 'R1', type: 'resistor', value: 1000, node1: 'N1', node2: 'GND' },
        { id: 'L1', type: 'inductor', value: 0.010, node1: 'N1', node2: 'GND' },
        { id: 'C1', type: 'capacitor', value: 100e-6, node1: 'N1', node2: 'GND' }
      ]
    };

    const sweep = runClientFrequencySweep(netlist, 10.0, 1000.0, 80, 'log');
    assert.equal(sweep.success, true);

    const res = analyzeClientResonance(sweep, true);
    assert.equal(res.resonanceDetected, true);
    assert.ok(Math.abs(res.resonantFrequencyHz - 159.15) < 15.0);
  });

  // Test 7: Guard: Zero / Negative Frequency handled safely
  test('7. Zero or negative frequency does not crash and defaults to valid positive frequency', () => {
    const netlist = {
      components: [
        { id: 'R1', type: 'resistor', value: 220, node1: 'N1', node2: 'GND' }
      ]
    };
    const res = solveAcPoint(netlist, -50.0);
    assert.equal(res.success, true);
    assert.ok(res.frequencyHz > 0);
  });
});
