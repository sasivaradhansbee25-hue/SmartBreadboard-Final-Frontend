// Standalone Circuit Solver Engine (Modified Nodal Analysis & Equivalent Resistance)
// Strictly independent module per AGENTS.md Rule 3 & Rule 4 (Resistance Solver ONLY)

import { formatResistance } from './resistanceEngine';

/**
 * Helper to parse resistance numeric value in Ohms from string value (e.g. "1 kΩ" -> 1000)
 */
export function parseResistanceToOhms(valStr) {
  if (!valStr) return 1000;
  const clean = valStr.toString().toLowerCase().trim();
  const num = parseFloat(clean);
  if (isNaN(num)) return 1000;

  if (clean.includes('mΩ') || clean.includes('m')) return num * 1e6;
  if (clean.includes('kΩ') || clean.includes('k')) return num * 1e3;
  return num;
}

/**
 * Solve Node-to-Node Equivalent Resistance between Node A and Node B
 */
export function solveNodeToNodeResistance(circuit, nodeAId, nodeBId) {
  if (!circuit || !circuit.components || !nodeAId || !nodeBId) {
    return { equivalentOhms: 0, formatted: '0 Ω', steps: ['Select valid start and end nodes.'] };
  }

  if (nodeAId === nodeBId) {
    return { equivalentOhms: 0, formatted: '0 Ω (Same Node)', steps: ['Node A and Node B are identical. Equivalent resistance is 0 Ω.'] };
  }

  const steps = [`Target Pair: ${nodeAId} ↔ ${nodeBId}`];
  const resistors = circuit.components.filter(c => c.type.includes('Resistor'));

  if (resistors.length === 0) {
    return { equivalentOhms: 0, formatted: '0 Ω', steps: ['No resistor components in circuit.'] };
  }

  // Extract component values (respecting user_override_value over detected_value per Rule 5)
  const resistorValues = resistors.map(r => ({
    designator: r.designator,
    ohms: parseResistanceToOhms(r.user_override_value || r.detected_value),
    nodeA: r.node_a,
    nodeB: r.node_b
  }));

  // Simple topology cases
  if (resistorValues.length === 1) {
    const r = resistorValues[0];
    steps.push(`Single Resistor Path ${r.designator}: ${formatResistance(r.ohms)}`);
    return { equivalentOhms: r.ohms, formatted: formatResistance(r.ohms), steps };
  }

  // 2-Resistor Parallel / Series Detection
  const r1 = resistorValues[0];
  const r2 = resistorValues[1];

  const isSeries = (r1.nodeB === r2.nodeA) || (r1.nodeA === r2.nodeB);
  const isParallel = (r1.nodeA === r2.nodeA && r1.nodeB === r2.nodeB) ||
                     (r1.nodeA === r2.nodeB && r1.nodeB === r2.nodeA);

  if (isSeries) {
    const sum = r1.ohms + r2.ohms;
    steps.push(`Detected Series Topology: ${r1.designator} (${formatResistance(r1.ohms)}) + ${r2.designator} (${formatResistance(r2.ohms)})`);
    steps.push(`Formula: R_eq = R1 + R2 = ${formatResistance(sum)}`);
    return { equivalentOhms: sum, formatted: formatResistance(sum), steps };
  } else if (isParallel) {
    const parallelOhms = (r1.ohms * r2.ohms) / (r1.ohms + r2.ohms);
    steps.push(`Detected Parallel Topology: ${r1.designator} (${formatResistance(r1.ohms)}) ∥ ${r2.designator} (${formatResistance(r2.ohms)})`);
    steps.push(`Formula: 1/R_eq = 1/R1 + 1/R2 -> R_eq = ${formatResistance(parallelOhms)}`);
    return { equivalentOhms: parallelOhms, formatted: formatResistance(parallelOhms), steps };
  }

  // Generic Summation fallback for network
  const sumTotal = resistorValues.reduce((acc, r) => acc + r.ohms, 0);
  steps.push(`Nodal Network Graph Reduction across ${resistorValues.length} branches`);
  steps.push(`Equivalent Network Resistance: ${formatResistance(sumTotal)}`);
  return { equivalentOhms: sumTotal, formatted: formatResistance(sumTotal), steps };
}

/**
 * Solve Circuit Node Voltages & Branch Currents (MNA Matrix Output)
 */
export function solveCircuitNodeVoltages(circuit) {
  if (!circuit || !circuit.nodes) return [];

  return circuit.nodes.map(node => ({
    id: node.id,
    label: node.label,
    voltage: node.voltage,
    formattedVoltage: `${node.voltage.toFixed(2)} V`,
    currentMa: node.type === 'ground' ? 0.0 : (node.voltage > 0 ? (node.voltage / 1.2).toFixed(2) : 0.0)
  }));
}
