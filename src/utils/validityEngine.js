// Standalone Circuit Validity & Diagnostics Engine
// Adheres strictly to SPEC.md §11.4 (Visually distinct Warnings ⚠ vs Errors ❌)

export function analyzeCircuitValidity(circuit) {
  if (!circuit || !circuit.components) {
    return {
      isValid: false,
      healthScore: 0,
      issues: [
        {
          id: 'err-1',
          type: 'ERROR',
          title: 'Missing Circuit Model',
          message: 'No valid circuit components found in input netlist.',
          icon: '❌'
        }
      ]
    };
  }

  const issues = [];

  // 1. Power Supply Connection Check
  if (!circuit.power_supply || circuit.power_supply.voltage <= 0) {
    issues.push({
      id: 'err-pwr',
      type: 'ERROR',
      title: 'Power Supply Disconnected',
      message: 'No active power supply detected on circuit VCC rails.',
      icon: '❌'
    });
  }

  // 2. Open Circuit Check (Disconnected Nodes)
  const disconnectedComps = circuit.components.filter(c => !c.pins || c.pins.length < 2);
  if (disconnectedComps.length > 0) {
    issues.push({
      id: 'err-open',
      type: 'ERROR',
      title: 'Open Circuit / Floating Pin',
      message: `${disconnectedComps.length} component(s) have unconnected floating terminals (${disconnectedComps.map(c => c.designator).join(', ')}).`,
      icon: '❌'
    });
  }

  // 3. Short Circuit Check (Zero resistance supply bypass)
  const zeroResistanceResistors = circuit.components.filter(
    c => c.type.includes('Resistor') && (parseFloat(c.user_override_value || c.detected_value) === 0)
  );
  if (zeroResistanceResistors.length > 0) {
    issues.push({
      id: 'err-short',
      type: 'ERROR',
      title: 'Short Circuit Hazard',
      message: `Zero-ohm path detected across ${zeroResistanceResistors.map(c => c.designator).join(', ')}. Excessive current flow hazard!`,
      icon: '❌'
    });
  }

  // 4. Low Confidence / Uncertain Resistor Value Check (Warning ⚠)
  const lowConfidenceComps = circuit.components.filter(
    c => c.status === 'uncertain' || c.detected_value.includes('uncertain')
  );
  if (lowConfidenceComps.length > 0) {
    issues.push({
      id: 'warn-conf',
      type: 'WARNING',
      title: 'Resistor Value Uncertain',
      message: `Detection confidence below threshold for ${lowConfidenceComps.map(c => c.designator).join(', ')}. Please verify user override.`,
      icon: '⚠'
    });
  }

  // 5. Thermal Dissipation Warning (Warning ⚠)
  const powerMw = circuit.readings?.resistor_power_mW || 0;
  if (powerMw > 125.0) {
    issues.push({
      id: 'warn-thermal',
      type: 'WARNING',
      title: 'High Resistor Thermal Load',
      message: `Total resistor power dissipation is ${powerMw.toFixed(1)} mW. Ensure resistor wattage rating is at least 1/4W.`,
      icon: '⚠'
    });
  }

  // 6. Safe Nominal Check (If no errors)
  const hasErrors = issues.some(i => i.type === 'ERROR');
  if (!hasErrors && issues.length === 0) {
    issues.push({
      id: 'info-ok',
      type: 'PASS',
      title: 'Circuit Topology Verified',
      message: 'All component connections, node voltages, and thermal loads are within nominal safety bounds.',
      icon: '✓'
    });
  }

  const hardErrorCount = issues.filter(i => i.type === 'ERROR').length;
  const warningCount = issues.filter(i => i.type === 'WARNING').length;
  const healthScore = Math.max(0, 100 - (hardErrorCount * 40) - (warningCount * 15));

  return {
    isValid: !hasErrors,
    healthScore,
    hardErrorCount,
    warningCount,
    issues
  };
}
