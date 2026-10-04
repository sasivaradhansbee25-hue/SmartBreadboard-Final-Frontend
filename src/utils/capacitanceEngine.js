// Standalone Capacitance Calculation Engine
// Strictly independent module per AGENTS.md Rule 4 (Series/Parallel inverse rules for C vs R)

/**
 * Decode 3-digit ceramic capacitor code (e.g. "104" -> 100nF, "223" -> 22nF, "471" -> 470pF)
 */
export function decodeCapacitorCode(codeStr) {
  if (!codeStr) return { farads: 0, pF: 0, nF: 0, uF: 0, formatted: 'Invalid' };
  const clean = codeStr.trim();

  if (/^\d{3}$/.test(clean)) {
    const digits = parseInt(clean.substring(0, 2), 10);
    const exp = parseInt(clean.substring(2, 3), 10);
    const pF = digits * Math.pow(10, exp);
    const farads = pF * 1e-12;
    return {
      farads,
      pF,
      nF: pF / 1000.0,
      uF: pF / 1000000.0,
      formatted: formatCapacitance(farads)
    };
  }

  return { farads: 0, pF: 0, nF: 0, uF: 0, formatted: 'Unrecognized Code' };
}

/**
 * Calculate Parallel Capacitance: C_total = C1 + C2 + ... + Cn
 * (Inverse of resistance series rule!)
 */
export function calculateParallelCapacitance(capacitanceValuesFarads) {
  const valid = capacitanceValuesFarads.map(v => parseFloat(v)).filter(v => !isNaN(v) && v >= 0);
  const totalFarads = valid.reduce((acc, curr) => acc + curr, 0);
  return {
    totalFarads,
    formatted: formatCapacitance(totalFarads),
    count: valid.length
  };
}

/**
 * Calculate Series Capacitance: 1 / C_total = 1/C1 + 1/C2 + ... + 1/Cn
 * (Inverse of resistance parallel rule!)
 */
export function calculateSeriesCapacitance(capacitanceValuesFarads) {
  const valid = capacitanceValuesFarads.map(v => parseFloat(v)).filter(v => !isNaN(v) && v > 0);
  if (valid.length === 0) return { totalFarads: 0, formatted: '0 pF', count: 0 };

  const invSum = valid.reduce((acc, curr) => acc + (1.0 / curr), 0);
  const totalFarads = 1.0 / invSum;
  return {
    totalFarads,
    formatted: formatCapacitance(totalFarads),
    count: valid.length
  };
}

/**
 * Helper to format capacitance in pF, nF, µF, mF
 */
export function formatCapacitance(farads) {
  if (isNaN(farads) || farads <= 0) return '0 pF';
  if (farads >= 1e-3) return `${(farads * 1e3).toFixed(2)} mF`;
  if (farads >= 1e-6) return `${(farads * 1e6).toFixed(2)} µF`;
  if (farads >= 1e-9) return `${(farads * 1e9).toFixed(1)} nF`;
  return `${(farads * 1e12).toFixed(1)} pF`;
}
