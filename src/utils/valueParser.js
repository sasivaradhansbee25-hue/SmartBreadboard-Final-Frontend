/**
 * Value Parser & Normalizer Utility for Electronic Components
 * Standardizes engineering units (e.g., 1k -> 1000 Ω, 10uF -> 0.00001 F, 100nF -> 0.0000001 F).
 * Enforces strict validation: rejects empty inputs, NaN, negative resistance, and physically impossible values.
 */

// SI Multiplier mapping
const SI_PREFIXES = {
  'p': 1e-12,
  'n': 1e-9,
  'u': 1e-6,
  'µ': 1e-6,
  'm': 1e-3,
  'k': 1e3,
  'K': 1e3,
  'M': 1e6,
  'G': 1e9
};

/**
 * Parses and validates an input string for a given component type.
 * @param {string|number} rawInput - e.g. "2.2k", "10uF", "470", "0.5V"
 * @param {string} componentType - "resistor", "capacitor", "inductor", "led", "diode", "voltage_source"
 * @returns {{ isValid: boolean, siValue: number|null, unit: string, formatted: string, error?: string }}
 */
export function parseComponentValue(rawInput, componentType = 'resistor') {
  if (rawInput === null || rawInput === undefined) {
    return { isValid: false, siValue: null, unit: '', formatted: '', error: 'Input cannot be empty' };
  }

  const str = String(rawInput).trim();
  if (str === '') {
    return { isValid: false, siValue: null, unit: '', formatted: '', error: 'Input cannot be empty' };
  }

  const type = (componentType || 'resistor').toLowerCase();

  // Handle European notation like "2k2" -> 2.2k, "4R7" -> 4.7
  let normalizedStr = str.replace(/,/g, '.');
  const euroMatch = normalizedStr.match(/^(\d+)([RkKMmunpµ])(\d+)$/i);
  if (euroMatch) {
    const whole = euroMatch[1];
    const prefix = euroMatch[2];
    const fraction = euroMatch[3];
    normalizedStr = `${whole}.${fraction}${prefix.toUpperCase() === 'R' ? '' : prefix}`;
  }

  const regex = /^([+-]?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*([pnumµkKMGT]?)\s*([Ω\w%]*)$/;
  const match = normalizedStr.match(regex);

  if (!match) {
    return { isValid: false, siValue: null, unit: '', formatted: '', error: `Invalid numeric format: "${str}"` };
  }

  const numPart = parseFloat(match[1]);
  const prefixPart = match[2];
  const unitPart = match[3];

  if (isNaN(numPart) || !isFinite(numPart)) {
    return { isValid: false, siValue: null, unit: '', formatted: '', error: 'Value must be a finite number' };
  }

  const multiplier = prefixPart ? (SI_PREFIXES[prefixPart] || 1.0) : 1.0;
  const siValue = numPart * multiplier;

  // Component-specific validation rules
  if (type.includes('resistor')) {
    if (siValue < 0) {
      return { isValid: false, siValue: null, unit: 'Ω', formatted: '', error: 'Resistance cannot be negative' };
    }
    if (siValue === 0) {
      return { isValid: true, siValue: 0, unit: 'Ω', formatted: '0 Ω (Jumper)' };
    }
    if (siValue > 1e9) {
      return { isValid: false, siValue: null, unit: 'Ω', formatted: '', error: 'Resistance exceeds maximum limit (1 GΩ)' };
    }
    return {
      isValid: true,
      siValue,
      unit: 'Ω',
      formatted: formatEngineeringValue(siValue, 'Ω')
    };
  }

  if (type.includes('capacitor')) {
    if (siValue <= 0) {
      return { isValid: false, siValue: null, unit: 'F', formatted: '', error: 'Capacitance must be strictly positive' };
    }
    if (siValue > 1.0) {
      return { isValid: false, siValue: null, unit: 'F', formatted: '', error: 'Capacitance exceeds maximum limit (1 F)' };
    }
    return {
      isValid: true,
      siValue,
      unit: 'F',
      formatted: formatEngineeringValue(siValue, 'F')
    };
  }

  if (type.includes('inductor')) {
    if (siValue <= 0) {
      return { isValid: false, siValue: null, unit: 'H', formatted: '', error: 'Inductance must be strictly positive' };
    }
    return {
      isValid: true,
      siValue,
      unit: 'H',
      formatted: formatEngineeringValue(siValue, 'H')
    };
  }

  if (type.includes('led') || type.includes('diode')) {
    // Forward voltage specification
    if (siValue <= 0 || siValue > 10.0) {
      return { isValid: false, siValue: null, unit: 'V', formatted: '', error: 'Forward voltage must be between 0.1V and 10V' };
    }
    return {
      isValid: true,
      siValue,
      unit: 'V',
      formatted: `${siValue.toFixed(2)} V`
    };
  }

  if (type.includes('voltage') || type.includes('source') || type.includes('power')) {
    if (Math.abs(siValue) > 1000) {
      return { isValid: false, siValue: null, unit: 'V', formatted: '', error: 'Voltage exceeds safety limit (±1000V)' };
    }
    return {
      isValid: true,
      siValue,
      unit: 'V',
      formatted: `${siValue.toFixed(2)} V`
    };
  }

  // Generic fallback
  return {
    isValid: true,
    siValue,
    unit: unitPart || '',
    formatted: `${siValue}`
  };
}

/**
 * Formats a raw SI numeric value into standard engineering notation with unit.
 * @param {number} val - raw SI value (e.g. 1000, 0.00001)
 * @param {string} baseUnit - e.g. "Ω", "F", "H", "V", "A", "W"
 * @param {number} decimals - precision digits
 * @returns {string} - e.g. "1.00 kΩ", "10.0 µF"
 */
export function formatEngineeringValue(val, baseUnit = 'Ω', decimals = 2) {
  if (val === null || val === undefined || isNaN(val)) return 'N/A';
  if (val === 0) return `0 ${baseUnit}`;

  const absVal = Math.abs(val);
  const sign = val < 0 ? '-' : '';

  if (absVal >= 1e9) {
    return `${sign}${(absVal / 1e9).toFixed(decimals)} G${baseUnit}`;
  }
  if (absVal >= 1e6) {
    return `${sign}${(absVal / 1e6).toFixed(decimals)} M${baseUnit}`;
  }
  if (absVal >= 1e3) {
    return `${sign}${(absVal / 1e3).toFixed(decimals)} k${baseUnit}`;
  }
  if (absVal >= 1) {
    return `${sign}${absVal.toFixed(decimals)} ${baseUnit}`;
  }
  if (absVal >= 1e-3) {
    return `${sign}${(absVal * 1e3).toFixed(decimals)} m${baseUnit}`;
  }
  if (absVal >= 1e-6) {
    return `${sign}${(absVal * 1e6).toFixed(decimals)} µ${baseUnit}`;
  }
  if (absVal >= 1e-9) {
    return `${sign}${(absVal * 1e9).toFixed(decimals)} n${baseUnit}`;
  }
  if (absVal >= 1e-12) {
    return `${sign}${(absVal * 1e12).toFixed(decimals)} p${baseUnit}`;
  }

  return `${sign}${absVal.toExponential(decimals)} ${baseUnit}`;
}
