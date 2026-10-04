/**
 * SmartBreadboard 3D — Visual Annotation Service (Phase 22.2)
 *
 * Deterministically transforms the Phase 22.1 Verified Visual Grounding State
 * into renderable annotations for Camera / AR Overlay.
 *
 * Principles:
 * - 100% deterministic, pure calculation.
 * - Zero LLM hallucinated coordinates.
 * - Coordinates are only populated if verified in grounding state; otherwise null.
 * - Rejected detections are NEVER active components.
 * - Electrical simulation values are only attached when MNA simulation is SOLVED and not stale.
 * - Stale grounding (circuit signature mismatch) invalidates electrical annotations.
 */

import { formatVoltage, formatCurrent, formatPower } from '../utils/electricalFormatter.js';

/**
 * Default visibility configuration for annotation layers.
 */
export const DEFAULT_VISIBILITY = {
  components: true,
  terminals: true,
  holes: false, // Default: only relevant holes or hidden unless enabled
  nodes: true,
  wires: true,
  diagnostics: true,
  electrical: false // Normal mode defaults to clean, toggleable
};

/**
 * Formats component electrical values safely into human-readable strings.
 */
export function formatComponentElectrical(electricalData) {
  if (!electricalData) return null;
  const { voltage, current, power, forward_voltage, state } = electricalData;

  const lines = [];
  if (voltage !== undefined && voltage !== null) {
    lines.push(`V = ${formatVoltage(voltage)}`);
  } else if (forward_voltage !== undefined && forward_voltage !== null) {
    lines.push(`Vf = ${formatVoltage(forward_voltage)}`);
  }

  if (current !== undefined && current !== null) {
    lines.push(`I = ${formatCurrent(current)}`);
  }

  if (power !== undefined && power !== null) {
    lines.push(`P = ${formatPower(power)}`);
  }

  if (state) {
    lines.push(`State: ${state}`);
  }

  return {
    raw: electricalData,
    summary: lines.join(' | '),
    lines
  };
}

/**
 * Extracts coordinate position {x, y} for a component if available in grounding state.
 * Returns null if coordinates cannot be determined without guessing.
 */
export function resolveComponentPosition(compGrounding) {
  if (!compGrounding) return null;

  // 1. Direct pixel center
  if (compGrounding.image_geometry?.center && Array.isArray(compGrounding.image_geometry.center)) {
    const [cx, cy] = compGrounding.image_geometry.center;
    if (typeof cx === 'number' && typeof cy === 'number' && !isNaN(cx) && !isNaN(cy)) {
      return { x: cx, y: cy };
    }
  }

  // 2. Direct midpoint from terminal pixels
  const tA = compGrounding.terminals?.terminal_a?.pixel;
  const tB = compGrounding.terminals?.terminal_b?.pixel;
  if (Array.isArray(tA) && Array.isArray(tB) && tA.length === 2 && tB.length === 2) {
    if (typeof tA[0] === 'number' && typeof tB[0] === 'number') {
      return {
        x: (tA[0] + tB[0]) / 2.0,
        y: (tA[1] + tB[1]) / 2.0
      };
    }
  }

  // 3. Bounding box center
  const bbox = compGrounding.image_geometry?.bbox;
  if (Array.isArray(bbox) && bbox.length === 4) {
    const [x1, y1, x2, y2] = bbox;
    if (typeof x1 === 'number' && typeof x2 === 'number') {
      return {
        x: (x1 + x2) / 2.0,
        y: (y1 + y2) / 2.0
      };
    }
  }

  return null;
}

/**
 * Primary visual annotation generator.
 *
 * @param {Object} visualGroundingState - Phase 22.1 Visual Grounding State
 * @param {Object} [options] - Configuration & UI options
 * @param {boolean} [options.debugMode=false] - When true, outputs extra diagnostics & mapped canonical holes
 * @param {string} [options.currentCircuitSignature=null] - Circuit signature to verify freshness
 * @param {string} [options.selectedComponentId=null] - Currently selected component ID
 * @param {string} [options.highlightedComponentId=null] - Currently highlighted component ID
 * @param {Object} [options.visibility] - Custom visibility toggles
 * @returns {Object} Deterministic renderable annotations object
 */
export function generateVisualAnnotations(visualGroundingState, options = {}) {
  const {
    debugMode = false,
    currentCircuitSignature = null,
    selectedComponentId = null,
    highlightedComponentId = null,
    visibility = DEFAULT_VISIBILITY
  } = options;

  if (!visualGroundingState || typeof visualGroundingState !== 'object') {
    return {
      circuit_signature: null,
      is_stale: false,
      summary: { total: 0, verified: 0, diagnostics: 0 },
      components: [],
      terminals: [],
      holes: [],
      wires: [],
      nodes: [],
      diagnostics: [],
      labels: [],
      selectedComponent: null,
      highlightedComponent: null
    };
  }

  const groundingSig = visualGroundingState.circuit_signature || null;
  const isStale = Boolean(
    currentCircuitSignature &&
    groundingSig &&
    currentCircuitSignature !== groundingSig
  );

  const rawComps = Array.isArray(visualGroundingState.components) ? visualGroundingState.components : [];
  const rawWires = Array.isArray(visualGroundingState.wires) ? visualGroundingState.wires : [];
  const rawNodes = Array.isArray(visualGroundingState.nodes) ? visualGroundingState.nodes : [];
  const rawCanonicalHoles = visualGroundingState.canonical_holes || {};
  const rawDiagnostics = Array.isArray(visualGroundingState.diagnostics) ? visualGroundingState.diagnostics : [];
  const rawRejected = Array.isArray(visualGroundingState.rejected_detections) ? visualGroundingState.rejected_detections : [];
  const simState = visualGroundingState.simulation || {};
  const isSimSolved = (simState.status === 'SOLVED' && !isStale);

  const simVoltages = isSimSolved ? (simState.voltages || {}) : {};
  const simCurrents = isSimSolved ? (simState.currents || {}) : {};
  const simPowers = isSimSolved ? (simState.powers || {}) : {};

  const annotatedComponents = [];
  const annotatedTerminals = [];
  const annotatedHoles = [];
  const annotatedWires = [];
  const annotatedNodes = [];
  const annotatedDiagnostics = [];
  const annotatedLabels = [];

  const relevantHoleIds = new Set();
  let selectedCompObj = null;
  let highlightedCompObj = null;

  // 1. Process Components
  rawComps.forEach((comp) => {
    const cid = comp.id || 'UNKNOWN_COMP';
    const cstatus = comp.status || 'UNKNOWN';

    // Rule 8: Rejected detections must never be active components
    if (cstatus === 'REJECTED' || comp.verified === false && comp.type === 'rejected') {
      return;
    }

    const pos = resolveComponentPosition(comp);
    const isSelected = (selectedComponentId !== null && (selectedComponentId === cid || selectedComponentId === comp.designator));
    const isHighlighted = (highlightedComponentId !== null && (highlightedComponentId === cid || highlightedComponentId === comp.designator));

    // Extract Terminals
    const tA = comp.terminals?.terminal_a || {};
    const tB = comp.terminals?.terminal_b || {};

    if (tA.hole && tA.hole !== 'UNKNOWN' && tA.hole !== 'AMBIGUOUS') relevantHoleIds.add(tA.hole);
    if (tB.hole && tB.hole !== 'UNKNOWN' && tB.hole !== 'AMBIGUOUS') relevantHoleIds.add(tB.hole);

    // Calculate electrical values strictly from MNA simulation if SOLVED & not stale
    let electrical = null;
    if (isSimSolved) {
      const nodeA = tA.electrical_node;
      const nodeB = tB.electrical_node;
      let compVoltage = undefined;
      if (nodeA && nodeB && simVoltages[nodeA] !== undefined && simVoltages[nodeB] !== undefined) {
        compVoltage = Math.abs(simVoltages[nodeA] - simVoltages[nodeB]);
      } else if (comp.type === 'resistor' && simCurrents[cid] !== undefined && typeof comp.value === 'number') {
        compVoltage = Math.abs(simCurrents[cid] * comp.value);
      }

      const compCurrent = simCurrents[cid];
      const compPower = simPowers[cid] ?? (compVoltage !== undefined && compCurrent !== undefined ? Math.abs(compVoltage * compCurrent) : undefined);

      if (compVoltage !== undefined || compCurrent !== undefined || compPower !== undefined) {
        electrical = {
          voltage: compVoltage,
          current: compCurrent,
          power: compPower,
          state: comp.type === 'led' ? (compCurrent && compCurrent > 0.0005 ? 'ON' : 'OFF') : undefined
        };
      }
    }

    const formattedElec = formatComponentElectrical(electrical);

    const compObj = {
      id: cid,
      type: "component",
      componentType: comp.type || "unknown",
      status: cstatus,
      position: pos,
      label: cid,
      sublabel: comp.display_value || (comp.value !== null && comp.value !== undefined ? `${comp.value} ${comp.unit || 'Ω'}` : 'Unknown'),
      source: comp.source || "ai",
      verified: Boolean(comp.verified),
      terminals: comp.terminals || {},
      image_geometry: comp.image_geometry || null,
      isSelected,
      isHighlighted,
      electrical: electrical,
      electrical_formatted: formattedElec,
      provenance: comp.provenance || null
    };

    if (isSelected) selectedCompObj = compObj;
    if (isHighlighted) highlightedCompObj = compObj;

    annotatedComponents.push(compObj);

    // Composite floating label
    annotatedLabels.push({
      id: `label_${cid}`,
      componentId: cid,
      type: "component_badge",
      position: pos,
      primaryText: cid,
      secondaryText: compObj.sublabel,
      status: cstatus,
      electricalText: formattedElec ? formattedElec.summary : null,
      isSelected,
      isHighlighted
    });

    // 2. Process Terminals
    ['terminal_a', 'terminal_b'].forEach((tKey) => {
      const tData = comp.terminals?.[tKey];
      if (!tData) return;

      const tPixel = Array.isArray(tData.pixel) && tData.pixel.length === 2 ? { x: tData.pixel[0], y: tData.pixel[1] } : null;
      const tName = tData.name === 'terminal_a' ? 'A' : (tData.name === 'terminal_b' ? 'B' : tData.name || (tKey === 'terminal_a' ? 'A' : 'B'));

      // Do not display unknown fields
      const isTermUnknown = tData.status === 'UNKNOWN' || !tData.hole;

      annotatedTerminals.push({
        id: `${cid}.${tKey}`,
        componentId: cid,
        terminalKey: tKey,
        name: tName,
        hole: isTermUnknown ? null : tData.hole,
        electrical_node: isTermUnknown ? null : tData.electrical_node,
        status: tData.status || cstatus,
        position: tPixel,
        isSelected: isSelected || isHighlighted
      });
    });
  });

  // 3. Process Jumper Wires
  rawWires.forEach((wire) => {
    const wid = wire.id || 'W1';
    const sh = wire.start_hole;
    const eh = wire.end_hole;

    if (sh) relevantHoleIds.add(sh);
    if (eh) relevantHoleIds.add(eh);

    const shData = rawCanonicalHoles[sh] || {};
    const ehData = rawCanonicalHoles[eh] || {};

    const startPos = Array.isArray(shData.pixel) ? { x: shData.pixel[0], y: shData.pixel[1] } : null;
    const endPos = Array.isArray(ehData.pixel) ? { x: ehData.pixel[0], y: ehData.pixel[1] } : null;
    const isResolved = Boolean(startPos && endPos);

    annotatedWires.push({
      id: wid,
      type: "wire",
      start_hole: sh || null,
      end_hole: eh || null,
      status: wire.status || (sh && eh ? "VERIFIED" : "AMBIGUOUS"),
      startPosition: startPos,
      endPosition: endPos,
      isResolved,
      electrical_effect: wire.electrical_effect || "UNRESOLVED",
      source: wire.source || "detected"
    });

    if (!isResolved) {
      annotatedDiagnostics.push({
        id: `diag_wire_unresolved_${wid}`,
        componentId: wid,
        issue: "UNRESOLVED_WIRE_ENDPOINT",
        status: "AMBIGUOUS",
        description: `${wid} — endpoint unresolved`,
        position: null
      });
    }
  });

  // 4. Process Holes
  Object.entries(rawCanonicalHoles).forEach(([hId, hData]) => {
    const isRelevant = relevantHoleIds.has(hId);
    // Visibility strategy: Normal mode only relevant holes; Debug mode allows all mapped
    if (isRelevant || debugMode) {
      const hPixel = Array.isArray(hData.pixel) && hData.pixel.length === 2 ? { x: hData.pixel[0], y: hData.pixel[1] } : null;
      annotatedHoles.push({
        id: hId,
        hole: hId,
        region: hData.region || "terminal_matrix",
        row: hData.row,
        column: hData.column,
        electrical_node: hData.electrical_node || null,
        status: hData.status || "VERIFIED",
        position: hPixel,
        isRelevant
      });
    }
  });

  // 5. Process Electrical Nodes
  rawNodes.forEach((node) => {
    const nid = node.id || 'NODE_UNKNOWN';
    const nodeVoltage = isSimSolved ? (node.voltage_v ?? simVoltages[nid] ?? null) : null;

    annotatedNodes.push({
      id: nid,
      members: Array.isArray(node.members) ? node.members : (node.connected_pins || []),
      holes: Array.isArray(node.holes) ? node.holes : [],
      status: node.status || 'VERIFIED',
      voltage_v: nodeVoltage,
      voltage_formatted: nodeVoltage !== null ? formatVoltage(nodeVoltage) : null,
      position: null // Nodes span multiple points, positions reside on terminals/holes
    });
  });

  // 6. Process Diagnostics
  rawDiagnostics.forEach((diag, idx) => {
    const compMatch = annotatedComponents.find(c => c.id === diag.component_id);
    annotatedDiagnostics.push({
      id: diag.diagnostic_id || `diag_${idx}`,
      componentId: diag.component_id || null,
      issue: diag.issue || "DIAGNOSTIC_WARNING",
      status: diag.status || "AMBIGUOUS",
      description: diag.description || "Diagnostic check triggered",
      position: compMatch?.position || null
    });
  });

  // Circuit Blocked Alert if overall status is BLOCKED
  if (visualGroundingState.overall_status === 'BLOCKED') {
    annotatedDiagnostics.push({
      id: 'diag_circuit_blocked',
      componentId: null,
      issue: 'CIRCUIT_BLOCKED',
      status: 'BLOCKED',
      description: '⛔ CIRCUIT BLOCKED',
      position: null
    });
  }

  // Stale signature warning
  if (isStale) {
    annotatedDiagnostics.push({
      id: 'diag_stale_grounding',
      componentId: null,
      issue: 'STALE_GROUNDING',
      status: 'STALE',
      description: `Stale visual grounding: circuit signature mismatch (${groundingSig.slice(0, 8)} vs current ${currentCircuitSignature.slice(0, 8)}). Refresh required.`,
      position: null
    });
  }

  // Debug Mode: include rejected detections as non-active diagnostic markers
  if (debugMode && rawRejected.length > 0) {
    rawRejected.forEach((rej, idx) => {
      annotatedDiagnostics.push({
        id: rej.id || `rej_${idx}`,
        componentId: rej.id || `rejected_${idx}`,
        issue: "REJECTED_DETECTION",
        status: "REJECTED",
        description: `REJECTED: ${rej.label || 'Candidate'} (${rej.reason || 'Low confidence'})`,
        confidence: rej.confidence,
        position: Array.isArray(rej.bbox) && rej.bbox.length === 4 ? { x: (rej.bbox[0] + rej.bbox[2]) / 2, y: (rej.bbox[1] + rej.bbox[3]) / 2 } : null
      });
    });
  }

  // Filter based on visibility options
  const result = {
    circuit_signature: groundingSig,
    is_stale: isStale,
    summary: {
      total_components: annotatedComponents.length,
      verified_components: annotatedComponents.filter(c => c.status === 'VERIFIED' || c.status === 'USER_CONFIRMED').length,
      unknown_components: annotatedComponents.filter(c => c.status === 'UNKNOWN').length,
      ambiguous_components: annotatedComponents.filter(c => c.status === 'AMBIGUOUS').length,
      wires_count: annotatedWires.length,
      nodes_count: annotatedNodes.length,
      diagnostics_count: annotatedDiagnostics.length,
      simulation_status: isSimSolved ? 'SOLVED' : (isStale ? 'STALE' : (simState.status || 'NOT_RUN'))
    },
    components: visibility.components ? annotatedComponents : [],
    terminals: visibility.terminals ? annotatedTerminals : [],
    holes: visibility.holes ? annotatedHoles : annotatedHoles.filter(h => h.isRelevant),
    wires: visibility.wires ? annotatedWires : [],
    nodes: visibility.nodes ? annotatedNodes : [],
    diagnostics: visibility.diagnostics ? annotatedDiagnostics : [],
    labels: annotatedLabels,
    selectedComponent: selectedCompObj,
    highlightedComponent: highlightedCompObj
  };

  return result;
}
