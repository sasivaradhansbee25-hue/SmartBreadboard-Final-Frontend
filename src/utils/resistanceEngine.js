// Standalone Resistance Calculation Engine
// Strictly independent per AGENTS.md Rule 3 & Rule 4

export const COLOR_CODES = {
  '0': { name: 'Black', hex: '#000000', text: '#ffffff', val: 0, mult: 1 },
  '1': { name: 'Brown', hex: '#78350f', text: '#ffffff', val: 1, mult: 10, tol: 1 },
  '2': { name: 'Red', hex: '#dc2626', text: '#ffffff', val: 2, mult: 100, tol: 2 },
  '3': { name: 'Orange', hex: '#ea580c', text: '#ffffff', val: 3, mult: 1000 },
  '4': { name: 'Yellow', hex: '#ca8a04', text: '#000000', val: 4, mult: 10000 },
  '5': { name: 'Green', hex: '#16a34a', text: '#ffffff', val: 5, mult: 100000, tol: 0.5 },
  '6': { name: 'Blue', hex: '#2563eb', text: '#ffffff', val: 6, mult: 1000000, tol: 0.25 },
  '7': { name: 'Violet', hex: '#9333ea', text: '#ffffff', val: 7, mult: 10000000, tol: 0.1 },
  '8': { name: 'Grey', hex: '#4b5563', text: '#ffffff', val: 8, mult: 100000000, tol: 0.05 },
  '9': { name: 'White', hex: '#f8fafc', text: '#000000', val: 9, mult: 1000000000 },
  '-1': { name: 'Gold', hex: '#eab308', text: '#000000', mult: 0.1, tol: 5 },
  '-2': { name: 'Silver', hex: '#94a3b8', text: '#000000', mult: 0.01, tol: 10 }
};

export const E24_VALUES = [
  1.0, 1.1, 1.2, 1.3, 1.5, 1.6, 1.8, 2.0, 2.2, 2.4, 2.7, 3.0,
  3.3, 3.6, 3.9, 4.3, 4.7, 5.1, 5.6, 6.2, 6.8, 7.5, 8.2, 9.1
];

/**
 * Decode resistor bands into resistance in Ohms and tolerance %
 */
export function decodeResistorColors(bands, bandCount = 4) {
  if (!bands || bands.length < bandCount) return { ohms: 0, formatted: '0 Ω', tolerance: '±5%' };

  let digitsStr = '';
  if (bandCount === 4) {
    digitsStr = `${bands[0]}${bands[1]}`;
  } else {
    digitsStr = `${bands[0]}${bands[1]}${bands[2]}`;
  }

  const baseDigits = parseInt(digitsStr, 10);
  const multKey = bandCount === 4 ? bands[2] : bands[3];
  const tolKey = bandCount === 4 ? bands[3] : bands[4];

  const multObj = COLOR_CODES[multKey] || { mult: 1 };
  const tolObj = COLOR_CODES[tolKey] || { tol: 5 };

  const ohms = baseDigits * multObj.mult;
  return {
    ohms,
    formatted: formatResistance(ohms),
    tolerance: `±${tolObj.tol || 5}%`
  };
}

/**
 * Decode SMD resistor code (e.g. "103", "4702", "4R7", "01C")
 */
export function decodeSmdResistorCode(codeStr) {
  if (!codeStr) return { ohms: 0, formatted: 'Invalid', type: 'Unknown' };
  const clean = codeStr.trim().toUpperCase();

  // R or K decimal notation (e.g. 4R7 = 4.7Ω, R22 = 0.22Ω)
  if (clean.includes('R')) {
    const ohms = parseFloat(clean.replace('R', '.'));
    return { ohms, formatted: formatResistance(ohms), type: 'Standard Decimal' };
  }

  // Standard 3-digit (e.g. 103 = 10 * 10^3 = 10k)
  if (/^\d{3}$/.test(clean)) {
    const digits = parseInt(clean.substring(0, 2), 10);
    const exp = parseInt(clean.substring(2, 3), 10);
    const ohms = digits * Math.pow(10, exp);
    return { ohms, formatted: formatResistance(ohms), type: '3-Digit SMD (5%)' };
  }

  // Standard 4-digit (e.g. 4702 = 470 * 10^2 = 47k)
  if (/^\d{4}$/.test(clean)) {
    const digits = parseInt(clean.substring(0, 3), 10);
    const exp = parseInt(clean.substring(3, 4), 10);
    const ohms = digits * Math.pow(10, exp);
    return { ohms, formatted: formatResistance(ohms), type: '4-Digit Precision SMD (1%)' };
  }

  return { ohms: 0, formatted: 'Invalid SMD Code', type: 'Unrecognized' };
}

/**
 * Calculate Series Resistance: R_total = R1 + R2 + ... + Rn
 */
export function calculateSeriesResistance(resistorValuesOhms) {
  const valid = resistorValuesOhms.map(v => parseFloat(v)).filter(v => !isNaN(v) && v >= 0);
  const total = valid.reduce((acc, curr) => acc + curr, 0);
  return {
    totalOhms: total,
    formatted: formatResistance(total),
    count: valid.length
  };
}

/**
 * Calculate Parallel Resistance: 1 / R_total = 1/R1 + 1/R2 + ... + 1/Rn
 */
export function calculateParallelResistance(resistorValuesOhms) {
  const valid = resistorValuesOhms.map(v => parseFloat(v)).filter(v => !isNaN(v) && v > 0);
  if (valid.length === 0) return { totalOhms: 0, formatted: '0 Ω', count: 0 };

  const invSum = valid.reduce((acc, curr) => acc + (1.0 / curr), 0);
  const total = 1.0 / invSum;
  return {
    totalOhms: total,
    formatted: formatResistance(total),
    count: valid.length
  };
}

/**
 * Find closest E24 standard resistor value
 */
export function findNearestE24Resistor(ohms) {
  if (!ohms || ohms <= 0) return { e24Value: 10, formatted: '10 Ω' };
  
  const exponent = Math.floor(Math.log10(ohms));
  const normalized = ohms / Math.pow(10, exponent);
  
  let closest = E24_VALUES[0];
  let minDiff = Math.abs(normalized - closest);
  
  for (let i = 1; i < E24_VALUES.length; i++) {
    const diff = Math.abs(normalized - E24_VALUES[i]);
    if (diff < minDiff) {
      minDiff = diff;
      closest = E24_VALUES[i];
    }
  }

  const nearestOhms = closest * Math.pow(10, exponent);
  return {
    e24Value: nearestOhms,
    formatted: formatResistance(nearestOhms)
  };
}

/**
 * Helper to format resistance in Ω, kΩ, MΩ
 */
export function formatResistance(ohms) {
  if (isNaN(ohms) || ohms < 0) return '0 Ω';
  if (ohms >= 1e6) return `${(ohms / 1e6).toFixed(2)} MΩ`;
  if (ohms >= 1e3) return `${(ohms / 1e3).toFixed(2)} kΩ`;
  return `${ohms.toFixed(1)} Ω`;
}
