/**
 * SmartBreadboard 3D — Circuit Signature & Change Detection Utility
 * Phase 16 Real-Time AR Digital Twin Synchronization
 *
 * Computes a deterministic topological signature for netlists to avoid
 * redundant MNA solver runs when only camera angle / visual pose has shifted.
 */

/**
 * Computes a hashable topology signature from a circuit netlist.
 *
 * @param {Object|null} netlist
 * @returns {string}
 */
export function computeCircuitSignature(netlist) {
  if (!netlist) return '';

  const comps = (netlist.components || [])
    .map(c => {
      const id = (c.id || c.designator || '').toUpperCase();
      const type = (c.type || '').toLowerCase();
      const h1 = (c.hole1 || c.start_hole || '').toUpperCase();
      const h2 = (c.hole2 || c.end_hole || '').toUpperCase();
      const val = c.user_override_value || c.formatted_value || c.value || '';
      return `${id}:${type}:${h1}-${h2}:${val}`;
    })
    .sort()
    .join(';');

  const wires = (netlist.wires || [])
    .map(w => {
      const h1 = (w.hole1 || w.start_hole || '').toUpperCase();
      const h2 = (w.hole2 || w.end_hole || '').toUpperCase();
      return `${h1}-${h2}`;
    })
    .sort()
    .join(';');

  const pwr = (netlist.power_sources || [])
    .map(p => {
      const v = p.voltage || p.value || 0;
      const pos = (p.positive_node || p.node1 || '').toUpperCase();
      const neg = (p.negative_node || p.node2 || '').toUpperCase();
      return `${v}V:${pos}-${neg}`;
    })
    .sort()
    .join(';');

  return `COMPS[${comps}]__WIRES[${wires}]__PWR[${pwr}]`;
}

/**
 * Compares two circuit signatures to determine if electrical topology changed.
 *
 * @param {Object|null} netlistA
 * @param {Object|null} netlistB
 * @returns {boolean} True if electrical topology changed
 */
export function hasCircuitTopologyChanged(netlistA, netlistB) {
  if (!netlistA && !netlistB) return false;
  if (!netlistA || !netlistB) return true;
  return computeCircuitSignature(netlistA) !== computeCircuitSignature(netlistB);
}
