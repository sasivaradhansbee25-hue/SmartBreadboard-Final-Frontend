/**
 * SmartBreadboard 3D — Circuit Highlight & Interaction Service (Phase 22.3)
 *
 * Provides deterministic graph traversal and entity highlighting for
 * interactive component, terminal, node, and connection exploration.
 *
 * Rules:
 * - 100% deterministic, derived from Phase 22.1 Visual Grounding state.
 * - Zero LLM hallucinated coordinates or connections.
 * - Rejects non-existent component/node IDs and rejected detections.
 * - Stale grounding (signature mismatch) clears highlights and excludes simulation values.
 * - Never modifies circuit state (READ-ONLY).
 */

/**
 * Highlights a component, terminal, node, or connection path from grounding state.
 *
 * @param {Object} visualGroundingState - Phase 22.1 Visual Grounding State
 * @param {Object} query - Highlight query parameters
 * @param {'COMPONENT'|'TERMINAL'|'NODE'|'CONNECTION'} [query.mode='COMPONENT'] - Highlighting mode
 * @param {string} [query.targetId=null] - Target Component ID or Node ID
 * @param {string} [query.terminalKey=null] - 'terminal_a' | 'terminal_b' (when mode is TERMINAL)
 * @param {string} [query.targetId2=null] - Second Component ID (when mode is CONNECTION)
 * @param {string} [query.currentCircuitSignature=null] - Signature to verify freshness
 * @returns {Object} Deterministic highlight graph result
 */
export function computeHighlightGraph(visualGroundingState, query = {}) {
  const {
    mode = 'COMPONENT',
    targetId = null,
    terminalKey = null,
    targetId2 = null,
    currentCircuitSignature = null
  } = query;

  // Initial empty response structure
  const emptyResult = (status = 'INVALID_TARGET', message = '') => ({
    status,
    message,
    mode,
    target: null,
    components: [],
    terminals: [],
    holes: [],
    wires: [],
    nodes: [],
    simulation: null,
    connection_path: []
  });

  if (!visualGroundingState || typeof visualGroundingState !== 'object') {
    return emptyResult('INVALID_TARGET', 'No visual grounding state provided');
  }

  // Stale signature check (Rule 20)
  const groundingSig = visualGroundingState.circuit_signature || null;
  if (currentCircuitSignature && groundingSig && currentCircuitSignature !== groundingSig) {
    return emptyResult('STALE', 'Circuit signature mismatch. Stale grounding state.');
  }

  const rawComps = Array.isArray(visualGroundingState.components) ? visualGroundingState.components : [];
  const rawWires = Array.isArray(visualGroundingState.wires) ? visualGroundingState.wires : [];
  const rawNodes = Array.isArray(visualGroundingState.nodes) ? visualGroundingState.nodes : [];
  const rawRejected = Array.isArray(visualGroundingState.rejected_detections) ? visualGroundingState.rejected_detections : [];
  const simState = visualGroundingState.simulation || {};
  const isSimSolved = (simState.status === 'SOLVED');

  const simVoltages = isSimSolved ? (simState.voltages || {}) : {};
  const simCurrents = isSimSolved ? (simState.currents || {}) : {};
  const simPowers = isSimSolved ? (simState.powers || {}) : {};

  // Rule 18: Reject selection if targetId matches a rejected detection
  if (targetId && rawRejected.some(r => r.id === targetId || r.candidate_id === targetId)) {
    return emptyResult('INVALID_TARGET', `Candidate ${targetId} was rejected by verification.`);
  }

  // ----------------------------------------------------
  // MODE: NODE
  // ----------------------------------------------------
  if (mode === 'NODE') {
    if (!targetId) return emptyResult('INVALID_TARGET', 'No node ID specified');

    const nodeMatch = rawNodes.find(n => n.id === targetId);
    if (!nodeMatch) {
      // Check if any component terminal has this electrical node
      const hasTermWithNode = rawComps.some(c => 
        c.terminals?.terminal_a?.electrical_node === targetId ||
        c.terminals?.terminal_b?.electrical_node === targetId
      );
      if (!hasTermWithNode) {
        return emptyResult('INVALID_TARGET', `Node ${targetId} does not exist in verified circuit.`);
      }
    }

    const matchedComponents = new Set();
    const matchedTerminals = new Set();
    const matchedHoles = new Set(nodeMatch?.holes || []);
    const matchedWires = new Set();

    // Find all component terminals mapped to this node
    rawComps.forEach(comp => {
      const cid = comp.id;
      ['terminal_a', 'terminal_b'].forEach(tKey => {
        const tData = comp.terminals?.[tKey];
        if (tData && tData.electrical_node === targetId) {
          matchedComponents.add(cid);
          matchedTerminals.add(`${cid}.${tKey}`);
          if (tData.hole && tData.hole !== 'UNKNOWN' && tData.hole !== 'AMBIGUOUS') {
            matchedHoles.add(tData.hole);
          }
        }
      });
    });

    // Find wires connected to this node or bridging these holes
    rawWires.forEach(w => {
      if (w.start_hole && matchedHoles.has(w.start_hole) || w.end_hole && matchedHoles.has(w.end_hole)) {
        matchedWires.add(w.id);
        if (w.start_hole) matchedHoles.add(w.start_hole);
        if (w.end_hole) matchedHoles.add(w.end_hole);
      }
    });

    const nodeVoltage = isSimSolved ? (simVoltages[targetId] ?? nodeMatch?.voltage_v ?? null) : null;

    return {
      status: 'SUCCESS',
      mode: 'NODE',
      target: {
        id: targetId,
        type: 'node',
        voltage: nodeVoltage
      },
      components: Array.from(matchedComponents),
      terminals: Array.from(matchedTerminals),
      holes: Array.from(matchedHoles),
      wires: Array.from(matchedWires),
      nodes: [targetId],
      simulation: isSimSolved && nodeVoltage !== null ? { voltage: nodeVoltage } : null,
      connection_path: []
    };
  }

  // ----------------------------------------------------
  // MODE: COMPONENT or TERMINAL or CONNECTION
  // ----------------------------------------------------
  if (!targetId) return emptyResult('INVALID_TARGET', 'No component ID specified');

  const compMatch = rawComps.find(c => c.id === targetId || c.designator === targetId);
  if (!compMatch || compMatch.status === 'REJECTED') {
    return emptyResult('INVALID_TARGET', `Component ${targetId} is not present in verified circuit.`);
  }

  const cid = compMatch.id;
  const tA = compMatch.terminals?.terminal_a || {};
  const tB = compMatch.terminals?.terminal_b || {};

  // ----------------------------------------------------
  // MODE: TERMINAL
  // ----------------------------------------------------
  if (mode === 'TERMINAL') {
    const activeTermKey = terminalKey || 'terminal_a';
    const activeTerm = activeTermKey === 'terminal_b' ? tB : tA;
    const termNode = activeTerm.electrical_node;
    const termHole = activeTerm.hole;

    const matchedComponents = new Set([cid]);
    const matchedTerminals = new Set([`${cid}.${activeTermKey}`]);
    const matchedHoles = new Set();
    const matchedWires = new Set();
    const matchedNodes = new Set();

    if (termHole && termHole !== 'UNKNOWN' && termHole !== 'AMBIGUOUS') {
      matchedHoles.add(termHole);
    }

    if (termNode && termNode !== 'UNKNOWN') {
      matchedNodes.add(termNode);
      // Find other components on this node
      rawComps.forEach(otherComp => {
        const ocid = otherComp.id;
        ['terminal_a', 'terminal_b'].forEach(tk => {
          const otData = otherComp.terminals?.[tk];
          if (otData && otData.electrical_node === termNode) {
            matchedComponents.add(ocid);
            matchedTerminals.add(`${ocid}.${tk}`);
            if (otData.hole && otData.hole !== 'UNKNOWN' && otData.hole !== 'AMBIGUOUS') {
              matchedHoles.add(otData.hole);
            }
          }
        });
      });

      // Find wires on this node / holes
      rawWires.forEach(w => {
        if ((w.start_hole && matchedHoles.has(w.start_hole)) || (w.end_hole && matchedHoles.has(w.end_hole))) {
          matchedWires.add(w.id);
          if (w.start_hole) matchedHoles.add(w.start_hole);
          if (w.end_hole) matchedHoles.add(w.end_hole);
        }
      });
    }

    return {
      status: 'SUCCESS',
      mode: 'TERMINAL',
      target: {
        componentId: cid,
        terminalKey: activeTermKey,
        hole: termHole || null,
        electrical_node: termNode || null
      },
      components: Array.from(matchedComponents),
      terminals: Array.from(matchedTerminals),
      holes: Array.from(matchedHoles),
      wires: Array.from(matchedWires),
      nodes: Array.from(matchedNodes),
      simulation: isSimSolved && termNode && simVoltages[termNode] !== undefined ? { voltage: simVoltages[termNode] } : null,
      connection_path: []
    };
  }

  // ----------------------------------------------------
  // MODE: CONNECTION (Trace path between targetId and targetId2)
  // ----------------------------------------------------
  if (mode === 'CONNECTION' && targetId2) {
    const comp2Match = rawComps.find(c => c.id === targetId2 || c.designator === targetId2);
    if (!comp2Match || comp2Match.status === 'REJECTED') {
      return emptyResult('INVALID_TARGET', `Component ${targetId2} is not present in verified circuit.`);
    }

    const cid2 = comp2Match.id;
    const c2tA = comp2Match.terminals?.terminal_a || {};
    const c2tB = comp2Match.terminals?.terminal_b || {};

    const matchedComponents = new Set([cid, cid2]);
    const matchedTerminals = new Set();
    const matchedHoles = new Set();
    const matchedWires = new Set();
    const matchedNodes = new Set();
    const path = [];

    // Check shared nodes between comp1 and comp2
    const c1Nodes = [
      { key: 'terminal_a', node: tA.electrical_node, hole: tA.hole },
      { key: 'terminal_b', node: tB.electrical_node, hole: tB.hole }
    ];
    const c2Nodes = [
      { key: 'terminal_a', node: c2tA.electrical_node, hole: c2tA.hole },
      { key: 'terminal_b', node: c2tB.electrical_node, hole: c2tB.hole }
    ];

    let foundDirectConnection = false;
    c1Nodes.forEach(c1t => {
      c2Nodes.forEach(c2t => {
        if (c1t.node && c2t.node && c1t.node === c2t.node) {
          foundDirectConnection = true;
          matchedTerminals.add(`${cid}.${c1t.key}`);
          matchedTerminals.add(`${cid2}.${c2t.key}`);
          matchedNodes.add(c1t.node);
          if (c1t.hole) matchedHoles.add(c1t.hole);
          if (c2t.hole) matchedHoles.add(c2t.hole);

          path.push({
            from: `${cid}.${c1t.key}`,
            via_node: c1t.node,
            to: `${cid2}.${c2t.key}`,
            shared_hole: c1t.hole === c2t.hole ? c1t.hole : null
          });
        }
      });
    });

    // Check wire bridging if not directly on same node
    if (!foundDirectConnection) {
      rawWires.forEach(w => {
        c1Nodes.forEach(c1t => {
          c2Nodes.forEach(c2t => {
            if ((w.start_hole === c1t.hole && w.end_hole === c2t.hole) ||
                (w.start_hole === c2t.hole && w.end_hole === c1t.hole)) {
              matchedWires.add(w.id);
              matchedTerminals.add(`${cid}.${c1t.key}`);
              matchedTerminals.add(`${cid2}.${c2t.key}`);
              if (c1t.hole) matchedHoles.add(c1t.hole);
              if (c2t.hole) matchedHoles.add(c2t.hole);
              if (c1t.node) matchedNodes.add(c1t.node);
              if (c2t.node) matchedNodes.add(c2t.node);

              path.push({
                from: `${cid}.${c1t.key}`,
                via_wire: w.id,
                to: `${cid2}.${c2t.key}`
              });
            }
          });
        });
      });
    }

    return {
      status: 'SUCCESS',
      mode: 'CONNECTION',
      target: { from: cid, to: cid2 },
      components: Array.from(matchedComponents),
      terminals: Array.from(matchedTerminals),
      holes: Array.from(matchedHoles),
      wires: Array.from(matchedWires),
      nodes: Array.from(matchedNodes),
      simulation: null,
      connection_path: path
    };
  }

  // ----------------------------------------------------
  // MODE: COMPONENT (Default)
  // ----------------------------------------------------
  const matchedComponents = new Set([cid]);
  const matchedTerminals = new Set();
  const matchedHoles = new Set();
  const matchedWires = new Set();
  const matchedNodes = new Set();

  if (tA.hole && tA.hole !== 'UNKNOWN' && tA.hole !== 'AMBIGUOUS') {
    matchedHoles.add(tA.hole);
    matchedTerminals.add(`${cid}.terminal_a`);
  }
  if (tB.hole && tB.hole !== 'UNKNOWN' && tB.hole !== 'AMBIGUOUS') {
    matchedHoles.add(tB.hole);
    matchedTerminals.add(`${cid}.terminal_b`);
  }

  if (tA.electrical_node) matchedNodes.add(tA.electrical_node);
  if (tB.electrical_node) matchedNodes.add(tB.electrical_node);

  // Find other components and wires connected to either node of this component
  rawComps.forEach(otherComp => {
    const ocid = otherComp.id;
    if (ocid === cid) return;

    ['terminal_a', 'terminal_b'].forEach(tk => {
      const otData = otherComp.terminals?.[tk];
      if (otData && (otData.electrical_node === tA.electrical_node || otData.electrical_node === tB.electrical_node)) {
        matchedComponents.add(ocid);
        matchedTerminals.add(`${ocid}.${tk}`);
        if (otData.hole && otData.hole !== 'UNKNOWN' && otData.hole !== 'AMBIGUOUS') {
          matchedHoles.add(otData.hole);
        }
      }
    });
  });

  rawWires.forEach(w => {
    if ((w.start_hole && matchedHoles.has(w.start_hole)) || (w.end_hole && matchedHoles.has(w.end_hole))) {
      matchedWires.add(w.id);
      if (w.start_hole) matchedHoles.add(w.start_hole);
      if (w.end_hole) matchedHoles.add(w.end_hole);
    }
  });

  // Calculate electrical simulation values if SOLVED
  let compSim = null;
  if (isSimSolved) {
    const nodeA = tA.electrical_node;
    const nodeB = tB.electrical_node;
    let compV = undefined;
    if (nodeA && nodeB && simVoltages[nodeA] !== undefined && simVoltages[nodeB] !== undefined) {
      compV = Math.abs(simVoltages[nodeA] - simVoltages[nodeB]);
    } else if (compMatch.type === 'resistor' && simCurrents[cid] !== undefined && typeof compMatch.value === 'number') {
      compV = Math.abs(simCurrents[cid] * compMatch.value);
    }

    const compI = simCurrents[cid];
    const compP = simPowers[cid] ?? (compV !== undefined && compI !== undefined ? Math.abs(compV * compI) : undefined);

    if (compV !== undefined || compI !== undefined || compP !== undefined) {
      compSim = {
        voltage: compV,
        current: compI,
        power: compP
      };
    }
  }

  return {
    status: 'SUCCESS',
    mode: 'COMPONENT',
    target: {
      id: cid,
      type: compMatch.type || 'unknown',
      value: compMatch.value,
      unit: compMatch.unit,
      display_value: compMatch.display_value,
      status: compMatch.status,
      source: compMatch.source
    },
    components: Array.from(matchedComponents),
    terminals: Array.from(matchedTerminals),
    holes: Array.from(matchedHoles),
    wires: Array.from(matchedWires),
    nodes: Array.from(matchedNodes),
    simulation: compSim,
    connection_path: []
  };
}
