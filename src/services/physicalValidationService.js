/**
 * SmartBreadboard 3D — Physical Validation & Accuracy Calibration Service (Phase 23)
 *
 * Provides deterministic client functions to evaluate real physical breadboard ground truth
 * against the camera-to-circuit pipeline (YOLO detections, Phase 18 verification,
 * Phase 19 terminal mapping, Phase 19 topology, Phase 22.1 visual grounding,
 * Simulation results, and AR/3D grounding state).
 *
 * Rules:
 * - Never automatically correct ground truth.
 * - Never fabricate missing measurements.
 * - If a result is unknown or ambiguous, mark it UNKNOWN/AMBIGUOUS.
 * - Do not claim physical validation was performed unless an actual camera/physical circuit was tested.
 */

import { apiRequest } from './api.js';

export const PHASE23_SCENARIOS = [
  {
    circuit_id: "SCENARIO-1-SINGLE-RESISTOR",
    name: "1. Single Resistor",
    description: "A single 1000Ω resistor connected between columns 10 and 15 powered by 5V DC.",
    is_physical_test: false,
    components: [
      {
        id: "R1",
        type: "resistor",
        nominal_value: 1000.0,
        measured_value: null,
        unit: "Ω",
        terminal_holes: ["A10", "A15"],
        orientation: "HORIZONTAL",
        electrical_nodes: { terminal_1: "NODE_VCC", terminal_2: "NODE_GND" },
        tolerance_percent: 5.0
      }
    ],
    jumper_wires: [],
    electrical_nodes: {
      "NODE_VCC": ["R1.1", "POWER_PLUS"],
      "NODE_GND": ["R1.2", "POWER_MINUS"]
    },
    topology: {
      pattern: "SINGLE_COMPONENT",
      series_groups: [],
      parallel_groups: [],
      electrical_nodes: { "NODE_VCC": ["R1.1"], "NODE_GND": ["R1.2"] },
      is_closed_loop: true
    },
    simulation_state: {
      expected_status: "SOLVED",
      expected_node_voltages: { "NODE_VCC": 5.0, "NODE_GND": 0.0 },
      expected_branch_currents_ma: { "R1": 5.0 },
      expected_operating_states: { "R1": "PASSIVE_CONDUCTING" },
      expected_power_mw: 25.0
    },
    power_source: { voltage_v: 5.0, positive_hole: "A10", ground_hole: "A15" },
    ar_grounding_state: { expected_tracking: "ACTIVE", orientation: "HORIZONTAL" }
  },
  {
    circuit_id: "SCENARIO-2-RESISTOR-LED-SERIES",
    name: "2. Resistor + LED Series",
    description: "220Ω resistor in series with red LED, sharing breadboard column 15.",
    is_physical_test: false,
    components: [
      {
        id: "R1",
        type: "resistor",
        nominal_value: 220.0,
        measured_value: null,
        unit: "Ω",
        terminal_holes: ["A10", "A15"],
        orientation: "HORIZONTAL",
        electrical_nodes: { terminal_1: "NODE_VCC", terminal_2: "NODE_MID" },
        tolerance_percent: 5.0
      },
      {
        id: "LED1",
        type: "led",
        nominal_value: null,
        measured_value: null,
        unit: "V",
        terminal_holes: ["B15", "B20"],
        orientation: "HORIZONTAL",
        electrical_nodes: { anode: "NODE_MID", cathode: "NODE_GND" },
        tolerance_percent: 10.0
      }
    ],
    jumper_wires: [],
    electrical_nodes: {
      "NODE_VCC": ["R1.1"],
      "NODE_MID": ["R1.2", "LED1.anode"],
      "NODE_GND": ["LED1.cathode"]
    },
    topology: {
      pattern: "SERIES",
      series_groups: [["R1", "LED1"]],
      parallel_groups: [],
      electrical_nodes: { "NODE_VCC": ["R1.1"], "NODE_MID": ["R1.2", "LED1.anode"], "NODE_GND": ["LED1.cathode"] },
      is_closed_loop: true
    },
    simulation_state: {
      expected_status: "SOLVED",
      expected_node_voltages: { "NODE_VCC": 5.0, "NODE_MID": 2.1, "NODE_GND": 0.0 },
      expected_branch_currents_ma: { "R1": 13.18, "LED1": 13.18 },
      expected_operating_states: { "LED1": "ACTIVE_ILLUMINATED" },
      expected_power_mw: 65.9
    },
    power_source: { voltage_v: 5.0, positive_hole: "A10", ground_hole: "B20" },
    ar_grounding_state: { expected_tracking: "ACTIVE", orientation: "HORIZONTAL" }
  },
  {
    circuit_id: "SCENARIO-3-RESISTOR-LED-PARALLEL",
    name: "3. Resistor + LED Parallel",
    description: "1000Ω resistor and LED placed in parallel between column 10 and column 15.",
    is_physical_test: false,
    components: [
      {
        id: "R1",
        type: "resistor",
        nominal_value: 1000.0,
        measured_value: null,
        unit: "Ω",
        terminal_holes: ["A10", "A15"],
        orientation: "HORIZONTAL",
        electrical_nodes: { terminal_1: "NODE_VCC", terminal_2: "NODE_GND" },
        tolerance_percent: 5.0
      },
      {
        id: "LED1",
        type: "led",
        nominal_value: null,
        measured_value: null,
        unit: "V",
        terminal_holes: ["C10", "C15"],
        orientation: "HORIZONTAL",
        electrical_nodes: { anode: "NODE_VCC", cathode: "NODE_GND" },
        tolerance_percent: 10.0
      }
    ],
    jumper_wires: [],
    electrical_nodes: {
      "NODE_VCC": ["R1.1", "LED1.anode"],
      "NODE_GND": ["R1.2", "LED1.cathode"]
    },
    topology: {
      pattern: "PARALLEL",
      series_groups: [],
      parallel_groups: [["R1", "LED1"]],
      electrical_nodes: { "NODE_VCC": ["R1.1", "LED1.anode"], "NODE_GND": ["R1.2", "LED1.cathode"] },
      is_closed_loop: true
    },
    simulation_state: {
      expected_status: "SOLVED",
      expected_node_voltages: { "NODE_VCC": 5.0, "NODE_GND": 0.0 },
      expected_branch_currents_ma: { "R1": 5.0, "LED1": 20.0 },
      expected_operating_states: { "LED1": "ACTIVE_ILLUMINATED" },
      expected_power_mw: 125.0
    },
    power_source: { voltage_v: 5.0, positive_hole: "A10", ground_hole: "C15" },
    ar_grounding_state: { expected_tracking: "ACTIVE", orientation: "HORIZONTAL" }
  },
  {
    circuit_id: "SCENARIO-4-VOLTAGE-DIVIDER",
    name: "4. Voltage Divider",
    description: "Two 10kΩ resistors in series forming a 2:1 voltage divider (V_mid = 2.5V).",
    is_physical_test: false,
    components: [
      {
        id: "R1",
        type: "resistor",
        nominal_value: 10000.0,
        measured_value: null,
        unit: "Ω",
        terminal_holes: ["A10", "A15"],
        orientation: "HORIZONTAL",
        electrical_nodes: { terminal_1: "NODE_VCC", terminal_2: "NODE_MID" },
        tolerance_percent: 1.0
      },
      {
        id: "R2",
        type: "resistor",
        nominal_value: 10000.0,
        measured_value: null,
        unit: "Ω",
        terminal_holes: ["B15", "B20"],
        orientation: "HORIZONTAL",
        electrical_nodes: { terminal_1: "NODE_MID", terminal_2: "NODE_GND" },
        tolerance_percent: 1.0
      }
    ],
    jumper_wires: [],
    electrical_nodes: {
      "NODE_VCC": ["R1.1"],
      "NODE_MID": ["R1.2", "R2.1"],
      "NODE_GND": ["R2.2"]
    },
    topology: {
      pattern: "VOLTAGE_DIVIDER",
      series_groups: [["R1", "R2"]],
      parallel_groups: [],
      electrical_nodes: { "NODE_VCC": ["R1.1"], "NODE_MID": ["R1.2", "R2.1"], "NODE_GND": ["R2.2"] },
      is_closed_loop: true
    },
    simulation_state: {
      expected_status: "SOLVED",
      expected_node_voltages: { "NODE_VCC": 5.0, "NODE_MID": 2.5, "NODE_GND": 0.0 },
      expected_branch_currents_ma: { "R1": 0.25, "R2": 0.25 },
      expected_operating_states: { "R1": "PASSIVE_CONDUCTING", "R2": "PASSIVE_CONDUCTING" },
      expected_power_mw: 1.25
    },
    power_source: { voltage_v: 5.0, positive_hole: "A10", ground_hole: "B20" },
    ar_grounding_state: { expected_tracking: "ACTIVE", orientation: "HORIZONTAL" }
  },
  {
    circuit_id: "SCENARIO-5-JUMPER-WIRE-MERGE",
    name: "5. Jumper Wire Node Merge",
    description: "Jumper wire W1 connects column 15 to column 25, merging R1 and R2 terminals into one electrical node.",
    is_physical_test: false,
    components: [
      {
        id: "R1",
        type: "resistor",
        nominal_value: 220.0,
        measured_value: null,
        unit: "Ω",
        terminal_holes: ["A10", "A15"],
        orientation: "HORIZONTAL",
        electrical_nodes: { terminal_1: "NODE_VCC", terminal_2: "NODE_MERGED" },
        tolerance_percent: 5.0
      },
      {
        id: "R2",
        type: "resistor",
        nominal_value: 220.0,
        measured_value: null,
        unit: "Ω",
        terminal_holes: ["A25", "A30"],
        orientation: "HORIZONTAL",
        electrical_nodes: { terminal_1: "NODE_MERGED", terminal_2: "NODE_GND" },
        tolerance_percent: 5.0
      }
    ],
    jumper_wires: [
      {
        id: "W1",
        start_hole: "E15",
        end_hole: "E25",
        color: "yellow",
        wire_type: "solid_core_jumper",
        electrical_node: "NODE_MERGED"
      }
    ],
    electrical_nodes: {
      "NODE_VCC": ["R1.1"],
      "NODE_MERGED": ["R1.2", "W1.start", "W1.end", "R2.1"],
      "NODE_GND": ["R2.2"]
    },
    topology: {
      pattern: "NODE_MERGE",
      series_groups: [["R1", "R2"]],
      parallel_groups: [],
      electrical_nodes: { "NODE_VCC": ["R1.1"], "NODE_MERGED": ["R1.2", "W1.start", "W1.end", "R2.1"], "NODE_GND": ["R2.2"] },
      is_closed_loop: true
    },
    simulation_state: {
      expected_status: "SOLVED",
      expected_node_voltages: { "NODE_VCC": 5.0, "NODE_MERGED": 2.5, "NODE_GND": 0.0 },
      expected_branch_currents_ma: { "R1": 11.36, "R2": 11.36, "W1": 11.36 },
      expected_operating_states: { "R1": "PASSIVE_CONDUCTING", "R2": "PASSIVE_CONDUCTING" },
      expected_power_mw: 56.8
    },
    power_source: { voltage_v: 5.0, positive_hole: "A10", ground_hole: "A30" },
    ar_grounding_state: { expected_tracking: "ACTIVE", orientation: "HORIZONTAL" }
  }
];

/**
 * Fetches all Phase 23 validation scenarios from the backend or returns local definitions.
 */
export async function fetchPhase23Scenarios() {
  try {
    const res = await apiRequest('/api/validation/phase23/scenarios');
    if (res && res.scenarios && res.scenarios.length > 0) {
      return res.scenarios;
    }
  } catch (err) {
    console.warn("Backend /api/validation/phase23/scenarios unavailable, using standard local scenarios:", err);
  }
  return PHASE23_SCENARIOS;
}

/**
 * Fetches a single scenario by ID.
 */
export async function fetchPhase23Scenario(scenarioId) {
  try {
    const res = await apiRequest(`/api/validation/phase23/scenarios/${encodeURIComponent(scenarioId)}`);
    if (res && res.circuit_id) return res;
  } catch (err) {
    console.warn(`Backend fetch for scenario ${scenarioId} failed, checking local:`, err);
  }
  return PHASE23_SCENARIOS.find(s => s.circuit_id.toLowerCase() === scenarioId.toLowerCase()) || null;
}

/**
 * Runs physical validation comparison between ground truth and pipeline output.
 * If backend is unavailable, performs deterministic calculation on client.
 */
export async function runPhase23Validation({
  scenarioId,
  groundTruth,
  pipelineData = {},
  isActualHardwareTest = false
}) {
  try {
    const res = await apiRequest('/api/validation/phase23/validate', {
      method: 'POST',
      body: JSON.stringify({
        scenario_id: scenarioId,
        ground_truth: groundTruth,
        pipeline_data: pipelineData,
        is_actual_hardware_test: isActualHardwareTest
      })
    });
    if (res && res.metrics_breakdown) {
      return res;
    }
  } catch (err) {
    console.warn("Backend validation run failed, executing deterministic client-side validation:", err);
  }

  // Client-side fallback evaluator strictly mirroring python logic
  const gt = groundTruth || PHASE23_SCENARIOS.find(s => s.circuit_id === scenarioId) || PHASE23_SCENARIOS[0];
  return evaluateClientSideValidation(gt, pipelineData, isActualHardwareTest);
}

/**
 * Deterministic client-side validation calculation (strictly mirrors backend/validation/physical_validation.py).
 */
export function evaluateClientSideValidation(gt, pipelineData = {}, isActualHardwareTest = false) {
  const normHole = (h) => (h ? String(h).trim().toUpperCase() : null);

  // 1. Component Detection Accuracy
  const expComps = (gt.components || []).map(c => c.id);
  const detComps = (pipelineData.components || pipelineData.yolo_detections || []).filter(c => c.status !== 'REJECTED');
  const matchedComps = [];
  const missingComps = [];
  const extraComps = [];
  const detRemaining = [...detComps];

  expComps.forEach(expId => {
    const idx = detRemaining.findIndex(d => (d.id || d.component_id || d.designator) === expId);
    if (idx >= 0) {
      matchedComps.push(expId);
      detRemaining.splice(idx, 1);
    } else {
      missingComps.push(expId);
    }
  });
  detRemaining.forEach(d => extraComps.push(d.id || d.candidate_id || 'extra_component'));

  const compDetPool = Math.max(expComps.length, matchedComps.length + extraComps.length);
  const compDetAcc = compDetPool > 0 ? Number(((matchedComps.length / compDetPool) * 100).toFixed(2)) : 100.0;

  // 2. Component Classification Accuracy
  let correctClassCount = 0;
  const incorrectClass = [];
  (gt.components || []).forEach(gc => {
    const found = detComps.find(d => (d.id || d.component_id) === gc.id);
    if (found) {
      const type = (found.type || found.label || '').toLowerCase();
      if (type && type !== 'unknown' && type !== 'ambiguous' && type === gc.type.toLowerCase()) {
        correctClassCount++;
      } else {
        incorrectClass.push(gc.id);
      }
    }
  });
  const compClassAcc = expComps.length > 0 ? Number(((correctClassCount / expComps.length) * 100).toFixed(2)) : 100.0;

  // 3. Terminal Detection Accuracy
  let expTerminals = 0;
  let detTerminals = 0;
  (gt.components || []).forEach(gc => {
    expTerminals += (gc.terminal_holes || []).length;
    const found = detComps.find(d => (d.id || d.component_id) === gc.id);
    if (found) {
      if (found.terminals) detTerminals += found.terminals.length;
      else if (found.start_hole && found.end_hole) detTerminals += 2;
      else if (found.holes) detTerminals += found.holes.length;
    }
  });
  const terminalAcc = expTerminals > 0 ? Number((Math.min(100, (detTerminals / expTerminals) * 100)).toFixed(2)) : 100.0;

  // 4. Hole Mapping Accuracy
  let expHolesTotal = 0;
  let matchedHolesCount = 0;
  const incorrectHoles = [];
  const holeMapping = pipelineData.hole_mapping || pipelineData.holes_mapped || {};
  (gt.components || []).forEach(gc => {
    const expH = (gc.terminal_holes || []).map(normHole);
    expHolesTotal += expH.length;
    const detH = (holeMapping[gc.id] || []).map(normHole);
    if (detH.length === 0 || detH.includes('UNKNOWN') || detH.includes('AMBIGUOUS')) {
      incorrectHoles.push(gc.id);
    } else {
      const expSet = new Set(expH);
      const detSet = new Set(detH);
      let match = true;
      expSet.forEach(h => { if (!detSet.has(h)) match = false; });
      if (match && expSet.size === detSet.size) {
        matchedHolesCount += expH.length;
      } else {
        incorrectHoles.push(gc.id);
        detSet.forEach(h => { if (expSet.has(h)) matchedHolesCount++; });
      }
    }
  });
  const holeAcc = expHolesTotal > 0 ? Number(((matchedHolesCount / expHolesTotal) * 100).toFixed(2)) : 100.0;

  // 5. Electrical Node Accuracy
  const expNodes = gt.electrical_nodes || {};
  const detNodes = (pipelineData.topology?.nodes || []).map(n => n.connected_pins || []);
  let matchedNodesCount = 0;
  Object.keys(expNodes).forEach(nid => {
    const pins = expNodes[nid];
    const foundGroup = detNodes.find(g => pins.every(p => g.includes(p)));
    if (foundGroup) matchedNodesCount++;
  });
  const totalExpNodes = Object.keys(expNodes).length;
  const nodeAcc = totalExpNodes > 0 ? Number(((matchedNodesCount / totalExpNodes) * 100).toFixed(2)) : 100.0;

  // 6. Wire Detection Accuracy
  const expWires = gt.jumper_wires || [];
  const detWires = pipelineData.jumper_wires || pipelineData.wires || [];
  let matchedWiresCount = 0;
  expWires.forEach(ew => {
    const s1 = normHole(ew.start_hole);
    const e1 = normHole(ew.end_hole);
    const found = detWires.find(dw => {
      const s2 = normHole(dw.start_hole || dw.hole1);
      const e2 = normHole(dw.end_hole || dw.hole2);
      return (s1 === s2 && e1 === e2) || (s1 === e2 && e1 === s2);
    });
    if (found) matchedWiresCount++;
  });
  const wirePool = Math.max(expWires.length, detWires.length);
  const wireAcc = wirePool > 0 ? Number(((matchedWiresCount / wirePool) * 100).toFixed(2)) : 100.0;

  // 7. Topology Accuracy
  const expPattern = gt.topology?.pattern || 'SINGLE_COMPONENT';
  const detPattern = pipelineData.topology?.pattern || pipelineData.topology?.topology_type || 'UNKNOWN';
  const topoAcc = (detPattern.toUpperCase() === expPattern.toUpperCase()) ? 100.0 : 0.0;

  // 8. Simulation Consistency
  const sim = pipelineData.simulation_result || pipelineData.simulationResult || {};
  const expVoltages = gt.simulation_state?.expected_node_voltages || {};
  let simChecks = 0;
  let simMatches = 0;
  if (sim.status === 'SOLVED') {
    const detV = sim.node_voltages || sim.voltages || {};
    Object.keys(expVoltages).forEach(k => {
      simChecks++;
      const ev = expVoltages[k];
      const dv = detV[k];
      if (dv !== undefined && Math.abs(Number(dv) - Number(ev)) <= Math.max(0.1, Math.abs(Number(ev)) * 0.05)) {
        simMatches++;
      }
    });
  }
  const simAcc = simChecks > 0 ? Number(((simMatches / simChecks) * 100).toFixed(2)) : (sim.status === 'SOLVED' ? 100.0 : 0.0);

  // 9. AR Grounding Consistency
  const arState = pipelineData.ar_grounding_state || pipelineData.registration || {};
  const arTrack = arState.tracking || arState.status;
  const arAcc = (arTrack === 'ACTIVE' || arTrack === 'REGISTERED') ? 100.0 : (arTrack === 'MINOR_OFFSET' ? 50.0 : 0.0);

  // Composite Calculation
  const metrics_breakdown = {
    component_detection: { accuracy_percentage: compDetAcc, matched: matchedComps, missing: missingComps, extra_detections: extraComps },
    component_classification: { accuracy_percentage: compClassAcc, matched: expComps.filter(id => !incorrectClass.includes(id)), incorrect: incorrectClass },
    terminal_detection: { accuracy_percentage: terminalAcc },
    hole_mapping: { accuracy_percentage: holeAcc, incorrect: incorrectHoles },
    electrical_node: { accuracy_percentage: nodeAcc },
    wire_detection: { accuracy_percentage: wireAcc },
    topology: { accuracy_percentage: topoAcc },
    simulation_consistency: { accuracy_percentage: simAcc },
    ar_grounding: { accuracy_percentage: arAcc }
  };

  const weights = {
    component_detection: 0.15,
    component_classification: 0.15,
    terminal_detection: 0.10,
    hole_mapping: 0.15,
    electrical_node: 0.15,
    wire_detection: 0.10,
    topology: 0.10,
    simulation_consistency: 0.05,
    ar_grounding: 0.05
  };

  const composite = Object.keys(weights).reduce((acc, k) => acc + (metrics_breakdown[k]?.accuracy_percentage || 0) * weights[k], 0);
  const compositeAcc = Number(composite.toFixed(2));

  const isConfirmedPhysical = Boolean(isActualHardwareTest && gt.is_physical_test);
  const physicalStatus = isConfirmedPhysical
    ? (compositeAcc >= 90.0 ? "PERFORMED_VERIFIED" : "PERFORMED_FAILED")
    : "NOT PERFORMED (SYNTHETIC BENCHMARK)";

  const failure_reasons = [];
  if (missingComps.length > 0) failure_reasons.push(`Missing components: ${missingComps.join(', ')}`);
  if (extraComps.length > 0) failure_reasons.push(`Extra components detected: ${extraComps.join(', ')}`);
  if (incorrectClass.length > 0) failure_reasons.push(`Classification mismatch on: ${incorrectClass.join(', ')}`);
  if (incorrectHoles.length > 0) failure_reasons.push(`Hole mapping discrepancies on: ${incorrectHoles.join(', ')}`);
  if (topoAcc < 100.0) failure_reasons.push(`Topology pattern mismatch: expected '${expPattern}', detected '${detPattern}'`);
  if (simAcc < 100.0 && sim.status !== 'SOLVED') failure_reasons.push(`Simulation did not solve: status '${sim.status || 'NOT_RUN'}'`);

  return {
    circuit_id: gt.circuit_id,
    circuit_name: gt.name,
    is_physical_test: isConfirmedPhysical,
    physical_validation_status: physicalStatus,
    expected: gt,
    detected: pipelineData,
    matched: matchedComps,
    incorrect: [...incorrectClass, ...incorrectHoles],
    missing: missingComps,
    extra_detections: extraComps,
    accuracy_percentage: compositeAcc,
    failure_reason: failure_reasons,
    metrics_breakdown: metrics_breakdown,
    timestamp: new Date().toISOString()
  };
}
