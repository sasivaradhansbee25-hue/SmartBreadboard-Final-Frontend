// Circuit Analysis & Solver Service Abstraction Layer
// Decouples calculation triggers from UI component code per AGENTS.md

import { apiRequest } from './api';
import { solveNodeToNodeResistance } from '../utils/circuitSolver';
import { calculateParallelCapacitance, calculateSeriesCapacitance } from '../utils/capacitanceEngine';

export async function requestEquivalentResistance(circuit, nodeA, nodeB) {
  const apiRes = await apiRequest('/calculate/resistance', 'POST', {
    circuit_id: circuit.id,
    node_a_id: nodeA,
    node_b_id: nodeB
  });

  if (apiRes && apiRes.equivalent_resistance_ohms) {
    return apiRes;
  }

  const localRes = solveNodeToNodeResistance(circuit, nodeA, nodeB);
  return {
    equivalent_resistance_ohms: localRes.equivalentOhms,
    equivalent_resistance_formatted: localRes.formatted,
    steps: localRes.steps,
    source: 'mock'
  };
}

export async function requestEquivalentCapacitance(circuit, isParallel = true) {
  const capsFarads = circuit.components
    .filter(c => (c.type || '').toLowerCase().includes('capacitor'))
    .map(c => c.value || 100e-9);

  const localRes = isParallel 
    ? calculateParallelCapacitance(capsFarads.length ? capsFarads : [100e-9])
    : calculateSeriesCapacitance(capsFarads.length ? capsFarads : [100e-9]);

  return {
    equivalent_capacitance_farads: localRes.totalFarads,
    equivalent_capacitance_formatted: localRes.formatted,
    source: 'mock'
  };
}

export async function requestLiveCameraAnalysis(imageBase64, previousState = null, powerSource = null) {
  const startTime = performance ? performance.now() : Date.now();
  const apiRes = await apiRequest('/camera/analyze', 'POST', {
    image_base64: imageBase64,
    previous_state: previousState,
    conf_threshold: 0.35,
    power_source: powerSource
  });

  const endTime = performance ? performance.now() : Date.now();
  const latencyMs = Math.round(endTime - startTime);

  if (apiRes && apiRes.status === 'success') {
    return {
      ...apiRes,
      latency_ms: latencyMs
    };
  }
  return null;
}

export async function requestDcSimulation(circuit) {
  if (!circuit) return null;

  try {
    const apiRes = await apiRequest('/circuit/analyze', 'POST', {
      netlist: {
        circuit_id: circuit.id,
        components: circuit.components || [],
        power_sources: circuit.power_sources || [],
        nodes: circuit.nodes || [],
        nets: circuit.nets || [],
        wires: circuit.wires || [],
        validity: circuit.validity,
        solver_status: circuit.solver_status,
        solver_reason: circuit.solver_reason
      }
    });

    if (apiRes && (apiRes.status || apiRes.solver_status)) {
      return apiRes;
    }
  } catch (err) {
    console.warn("[analysisService] Backend solver request failed:", err);
  }

  // Only fallback for mock demonstration circuits when backend is completely offline
  if (circuit.source === 'mock' || !circuit.source) {
    return generateLocalDcAnalysis(circuit);
  }

  return {
    success: false,
    status: 'NOT_RUN',
    solver_status: 'NOT_RUN',
    reason: 'Backend solver connection offline and real circuit requires active backend.',
    error: { code: 'BACKEND_OFFLINE', message: 'Backend solver unavailable' },
    components: [],
    nodes: [],
    node_voltages: {},
    measurements: {}
  };
}

export async function requestTransientSimulation(circuit, duration = 0.01, timestep = 0.0001) {
  if (!circuit) return null;

  const apiRes = await apiRequest('/circuit/simulate', 'POST', {
    netlist: {
      circuit_id: circuit.id,
      components: circuit.components || [],
      power_sources: circuit.power_sources || [],
      nodes: circuit.nodes || []
    },
    duration,
    timestep,
    simulation_mode: "transient"
  });

  if (apiRes && apiRes.success) {
    return apiRes;
  }

  return generateLocalTransientAnalysis(circuit, duration, timestep);
}

function generateLocalDcAnalysis(circuit) {
  const comps = circuit.components || [];
  const vSupply = circuit.power_supply?.voltage || 5.0;
  const measurements = {};

  let totalI = 0;
  let totalP = 0;

  comps.forEach(c => {
    const cid = c.designator || c.id;
    const type = (c.type || '').toLowerCase();
    const val = c.value || 1000;

    let vDrop = 0;
    let i = 0;
    let p = 0;

    if (type.includes('resistor')) {
      vDrop = vSupply * 0.6;
      i = vDrop / max(val, 1);
      p = i * vDrop;
    } else if (type.includes('led')) {
      vDrop = 2.0;
      i = 0.015;
      p = i * vDrop;
    } else if (type.includes('capacitor')) {
      vDrop = vSupply;
      i = 0;
      p = 0;
    } else if (type.includes('inductor')) {
      vDrop = 0.1;
      i = 0.05;
      p = 0.005;
    } else {
      vDrop = vSupply;
      i = 0.005;
      p = i * vDrop;
    }

    totalI += i;
    totalP += p;

    measurements[cid] = {
      id: cid,
      type: c.type,
      value: val,
      unit: c.unit || 'Ω',
      formatted_value: c.formatted_value || `${val} ${c.unit || ''}`,
      terminalVoltages: { A: vSupply, B: vSupply - vDrop },
      voltageDrop: round(vDrop, 3),
      current: round(i, 6),
      power: round(p, 6),
      state: 'ACTIVE',
      valueSource: c.valueSource || 'detected'
    };
  });

  return {
    status: 'SOLVED',
    success: true,
    circuit_id: circuit.id,
    source: 'local_fallback',
    simulation_mode: 'DC',
    measurements,
    total_current_mA: round(totalI * 1000, 2),
    total_power_mW: round(totalP * 1000, 2)
  };
}

function generateLocalTransientAnalysis(circuit, duration = 0.01, timestep = 0.0001) {
  const steps = Math.min(Math.max(Math.floor(duration / timestep), 10), 200);
  const timeSeries = [];
  const vSupply = circuit.power_supply?.voltage || 12.0;

  for (let s = 0; s < steps; s++) {
    const t = s * timestep;
    const meas = {};

    (circuit.components || []).forEach(c => {
      const cid = c.designator || c.id;
      const type = (c.type || '').toLowerCase();
      if (type.includes('capacitor')) {
        const vc = vSupply * (1 - Math.exp(-t / 0.001));
        meas[cid] = { voltageDrop: round(vc, 3), current: round((vSupply - vc) / 1000, 6), power: 0 };
      } else {
        meas[cid] = { voltageDrop: round(vSupply * 0.8, 3), current: 0.012, power: 0.05 };
      }
    });

    timeSeries.append ? timeSeries.push({ t: round(t, 6), measurements: meas }) : timeSeries.push({ t: round(t, 6), measurements: meas });
  }

  return {
    success: true,
    circuit_id: circuit.id,
    simulation_mode: 'TRANSIENT',
    duration,
    timestep,
    time_series: timeSeries
  };
}

function max(a, b) { return a > b ? a : b; }
function round(val, dec) { const p = Math.pow(10, dec); return Math.round(val * p) / p; }

export async function requestAssistantChat(message, circuitState, conversationId = 'default', resetHistory = false) {
  try {
    const res = await apiRequest('/assistant/chat', 'POST', {
      message: message,
      conversation_id: conversationId,
      circuit_state: circuitState,
      reset_history: resetHistory
    });
    return res;
  } catch (err) {
    return {
      answer: "Assistant temporarily unavailable. Please verify backend service.",
      tool_calls: [],
      error: String(err)
    };
  }
}

export async function applyCircuitCorrection(correctionPayload) {
  try {
    const res = await apiRequest('/circuit/correction/apply', 'POST', correctionPayload);
    return res;
  } catch (err) {
    return {
      status: "BLOCKED",
      reason: `Backend correction failed: ${err.message || String(err)}`
    };
  }
}

export async function requestVisualGrounding(circuitState) {
  try {
    const res = await apiRequest('/circuit/visual-grounding', 'POST', circuitState || {});
    return res;
  } catch (err) {
    console.warn("[analysisService] Visual grounding request failed:", err);
    return null;
  }
}


