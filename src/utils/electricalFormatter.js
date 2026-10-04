/**
 * Electrical Value Formatting Utility
 * Provides SI-standard formatting for Voltage, Current, and Power values.
 * Zero fabricated data: returns 'N/A' or '—' when input is null/undefined.
 */

export function formatVoltage(v, decimals = 2) {
  if (v === null || v === undefined || isNaN(v)) return 'N/A';
  const absV = Math.abs(v);
  if (absV >= 1000) {
    return `${(v / 1000).toFixed(decimals)} kV`;
  }
  if (absV >= 1 || absV === 0) {
    return `${v.toFixed(decimals)} V`;
  }
  if (absV >= 1e-3) {
    return `${(v * 1e3).toFixed(decimals)} mV`;
  }
  return `${(v * 1e6).toFixed(decimals)} µV`;
}

export function formatCurrent(i, decimals = 2) {
  if (i === null || i === undefined || isNaN(i)) return 'N/A';
  const absI = Math.abs(i);
  if (absI >= 1 || absI === 0) {
    return `${i.toFixed(decimals)} A`;
  }
  if (absI >= 1e-3) {
    return `${(i * 1e3).toFixed(decimals)} mA`;
  }
  if (absI >= 1e-6) {
    return `${(i * 1e6).toFixed(decimals)} µA`;
  }
  return `${(i * 1e9).toFixed(decimals)} nA`;
}

export function formatPower(p, decimals = 2) {
  if (p === null || p === undefined || isNaN(p)) return 'N/A';
  const absP = Math.abs(p);
  if (absP >= 1000) {
    return `${(p / 1000).toFixed(decimals)} kW`;
  }
  if (absP >= 1 || absP === 0) {
    return `${p.toFixed(decimals)} W`;
  }
  if (absP >= 1e-3) {
    return `${(p * 1e3).toFixed(decimals)} mW`;
  }
  return `${(p * 1e6).toFixed(decimals)} µW`;
}

export function formatResistance(r, decimals = 2) {
  if (r === null || r === undefined || isNaN(r)) return 'N/A';
  const absR = Math.abs(r);
  if (absR >= 1e6) {
    return `${(r / 1e6).toFixed(decimals)} MΩ`;
  }
  if (absR >= 1e3) {
    return `${(r / 1e3).toFixed(decimals)} kΩ`;
  }
  return `${r.toFixed(decimals)} Ω`;
}
