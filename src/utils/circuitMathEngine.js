// Standalone Circuit Math & Power Engine
// Independent module per AGENTS.md Rule 3

import { findNearestE24Resistor, formatResistance } from './resistanceEngine';

/**
 * Solve Ohm's Law and Power Wheel given any 2 non-zero parameters (V, I, R, P)
 */
export function solveOhmsLaw({ v, i, r, p }) {
  let valV = parseFloat(v) || 0;
  let valI = parseFloat(i) || 0;
  let valR = parseFloat(r) || 0;
  let valP = parseFloat(p) || 0;

  // Case 1: Given V and R -> find I, P
  if (valV > 0 && valR > 0) {
    valI = valV / valR;
    valP = valV * valI;
  }
  // Case 2: Given V and I -> find R, P
  else if (valV > 0 && valI > 0) {
    valR = valV / valI;
    valP = valV * valI;
  }
  // Case 3: Given I and R -> find V, P
  else if (valI > 0 && valR > 0) {
    valV = valI * valR;
    valP = valI * valI * valR;
  }
  // Case 4: Given P and V -> find I, R
  else if (valP > 0 && valV > 0) {
    valI = valP / valV;
    valR = valV / valI;
  }
  // Case 5: Given P and I -> find V, R
  else if (valP > 0 && valI > 0) {
    valV = valP / valI;
    valR = valV / valI;
  }
  // Case 6: Given P and R -> find V, I
  else if (valP > 0 && valR > 0) {
    valV = Math.sqrt(valP * valR);
    valI = valV / valR;
  }

  return {
    voltage: valV,
    current: valI,
    resistance: valR,
    power: valP,
    formattedV: `${valV.toFixed(2)} V`,
    formattedI: valI >= 1 ? `${valI.toFixed(2)} A` : `${(valI * 1000).toFixed(1)} mA`,
    formattedR: formatResistance(valR),
    formattedP: valP >= 1 ? `${valP.toFixed(2)} W` : `${(valP * 1000).toFixed(1)} mW`
  };
}

/**
 * Calculate LED current limiting resistor & recommend power rating
 */
export function calculateLedResistor({ vSupply, vLed, iLedMa }) {
  const vs = parseFloat(vSupply) || 0;
  const vl = parseFloat(vLed) || 0;
  const ilAmps = (parseFloat(iLedMa) || 0) / 1000.0;

  if (ilAmps <= 0 || vs <= vl) {
    return {
      isValid: false,
      errorMsg: 'Supply voltage (Vs) must be greater than LED drop (Vled)',
      calculatedOhms: 0,
      formattedR: 'Invalid',
      nearestE24: 'N/A',
      actualCurrentMa: 0,
      powerWatt: 0,
      recommendedWattage: 'N/A'
    };
  }

  const vResistor = vs - vl;
  const exactOhms = vResistor / ilAmps;
  const powerWatt = vResistor * ilAmps;

  const nearest = findNearestE24Resistor(exactOhms);
  const actualCurrentAmps = vResistor / nearest.e24Value;

  let recommendedWattage = '1/8W (0.125W)';
  if (powerWatt > 0.5) recommendedWattage = '1W or higher';
  else if (powerWatt > 0.25) recommendedWattage = '1/2W (0.5W)';
  else if (powerWatt > 0.125) recommendedWattage = '1/4W (0.25W)';

  return {
    isValid: true,
    calculatedOhms: exactOhms,
    formattedR: formatResistance(exactOhms),
    nearestE24: nearest.formatted,
    actualCurrentMa: (actualCurrentAmps * 1000.0).toFixed(2),
    powerWatt: powerWatt.toFixed(3),
    formattedPower: powerWatt >= 1 ? `${powerWatt.toFixed(2)} W` : `${(powerWatt * 1000).toFixed(1)} mW`,
    recommendedWattage
  };
}
