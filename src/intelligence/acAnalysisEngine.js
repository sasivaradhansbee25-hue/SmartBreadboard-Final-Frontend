/**
 * SmartBreadboard 3D — AC Circuit Analysis & Frequency Domain Engine (Phase 26)
 *
 * Client-side Complex MNA, Phasor Linear Solver, Frequency Sweep Engine,
 * and Deterministic Resonance Analyzer.
 *
 * Provides offline-capable, real-time AC frequency spectrum generation
 * for Series & Parallel RLC circuits, filters, and impedance matching networks.
 */

import { parseComponentValue } from '../utils/valueParser.js';
import { resolveOpampTerminals, getIcDefinition } from './icRegistry.js';

/**
 * Lightweight Complex Number Arithmetic Utilities
 */
export class Complex {
  constructor(real = 0, imag = 0) {
    this.real = Number(real) || 0;
    this.imag = Number(imag) || 0;
  }

  static fromPolar(r, thetaRad) {
    return new Complex(r * Math.cos(thetaRad), r * Math.sin(thetaRad));
  }

  static fromPolarDeg(r, thetaDeg) {
    const rad = (thetaDeg * Math.PI) / 180.0;
    return new Complex(r * Math.cos(rad), r * Math.sin(rad));
  }

  add(c) {
    return new Complex(this.real + c.real, this.imag + c.imag);
  }

  sub(c) {
    return new Complex(this.real - c.real, this.imag - c.imag);
  }

  mul(c) {
    return new Complex(
      this.real * c.real - this.imag * c.imag,
      this.real * c.imag + this.imag * c.real
    );
  }

  div(c) {
    const denom = c.real * c.real + c.imag * c.imag;
    if (denom === 0) return new Complex(1e12, 0);
    return new Complex(
      (this.real * c.real + this.imag * c.imag) / denom,
      (this.imag * c.real - this.real * c.imag) / denom
    );
  }

  mag() {
    return Math.sqrt(this.real * this.real + this.imag * this.imag);
  }

  phaseRad() {
    return Math.atan2(this.imag, this.real);
  }

  phaseDeg() {
    return (this.phaseRad() * 180.0) / Math.PI;
  }

  conj() {
    return new Complex(this.real, -this.imag);
  }

  format() {
    const sign = this.imag >= 0 ? '+' : '-';
    return `${this.real.toFixed(3)} ${sign} j${Math.abs(this.imag).toFixed(3)}`;
  }

  formatPolar() {
    return `${this.mag().toFixed(3)} ∠ ${this.phaseDeg().toFixed(1)}°`;
  }
}

/**
 * Solves N x N Complex Matrix equation A * x = b using Gaussian elimination with partial pivoting.
 */
function solveComplexMatrix(A, b) {
  const n = A.length;
  // Create deep copy
  const M = A.map((row, i) => [...row.map(c => new Complex(c.real, c.imag)), new Complex(b[i].real, b[i].imag)]);

  for (let k = 0; k < n; k++) {
    // Partial pivoting
    let maxRow = k;
    let maxVal = M[k][k].mag();
    for (let r = k + 1; r < n; r++) {
      const val = M[r][k].mag();
      if (val > maxVal) {
        maxVal = val;
        maxRow = r;
      }
    }

    if (maxVal < 1e-12) {
      // Regularize singular element
      M[k][k] = M[k][k].add(new Complex(1e-9, 1e-9));
    }

    if (maxRow !== k) {
      const tmp = M[k];
      M[k] = M[maxRow];
      M[maxRow] = tmp;
    }

    // Eliminate below
    for (let r = k + 1; r < n; r++) {
      const factor = M[r][k].div(M[k][k]);
      for (let c = k; c <= n; c++) {
        M[r][c] = M[r][c].sub(factor.mul(M[k][c]));
      }
    }
  }

  // Back substitution
  const x = new Array(n);
  for (let k = n - 1; k >= 0; k--) {
    let sum = M[k][n];
    for (let c = k + 1; c < n; c++) {
      sum = sum.sub(M[k][c].mul(x[c]));
    }
    x[k] = sum.div(M[k][k]);
  }

  return x;
}

function parseCompValue(comp, defaultVal = 1.0) {
  if (!comp) return defaultVal;
  if (typeof comp.value === 'number' && !isNaN(comp.value)) return comp.value;
  const raw = comp.user_override_value || comp.detected_value || comp.value;
  if (!raw) return defaultVal;
  const parsed = parseComponentValue(String(raw));
  return parsed?.numericValue || parseFloat(raw) || defaultVal;
}

/**
 * Solves single AC frequency point at frequency f (Hz).
 */
export function solveAcPoint(netlist, frequencyHz = 1000.0) {
  if (frequencyHz <= 0) frequencyHz = 1.0;
  const omega = 2.0 * Math.PI * frequencyHz;

  const rawComps = netlist?.components || [];
  const comps = rawComps.filter(c => !String(c.type || c.class).toLowerCase().includes('wire'));

  // Collect opamps
  const rawOpamps = [...(netlist?.ics || []), ...(netlist?.opamps || [])];
  for (const rc of rawComps) {
    const ctype = String(rc.type || rc.class || '').toLowerCase();
    const part = String(rc.model || rc.part_number || rc.value || '').toUpperCase();
    if (ctype.includes('opamp') || ctype.includes('op_amp') || ctype.includes('ic') || ['LM741', 'LM358', 'TL072', 'NE5532', 'OP07'].some(k => part.includes(k))) {
      if (!rawOpamps.includes(rc)) rawOpamps.push(rc);
    }
  }

  const validOpamps = [];
  for (let idx = 0; idx < rawOpamps.length; idx++) {
    const res = resolveOpampTerminals(rawOpamps[idx]);
    if (res.success) {
      validOpamps.push({
        id: rawOpamps[idx].id || `U${idx + 1}`,
        terminals: res.terminals,
        icDefinition: res.icDefinition
      });
    }
  }

  // Collect nodes
  const nodesSet = new Set();
  for (const c of rawComps) {
    const n1 = c.node1 || c.node_a || c.hole1 || c.start_hole;
    const n2 = c.node2 || c.node_b || c.hole2 || c.end_hole;
    if (n1) nodesSet.add(String(n1));
    if (n2) nodesSet.add(String(n2));
  }
  for (const op of validOpamps) {
    const t = op.terminals;
    ['in_pos', 'in_neg', 'output', 'v_plus', 'v_minus'].forEach(k => {
      if (t[k]) nodesSet.add(String(t[k]));
    });
  }
  const sources = netlist?.power_sources || netlist?.sources || (netlist?.power_supply ? [netlist.power_supply] : []);
  for (const s of sources) {
    const pn = s.positive_node || s.node_pos;
    const nn = s.negative_node || s.node_neg;
    if (pn) nodesSet.add(String(pn));
    if (nn) nodesSet.add(String(nn));
  }

  const nodesList = Array.from(nodesSet);
  let groundNode = nodesList.find(n => n.toUpperCase().includes('GND') || n.toUpperCase().includes('GROUND')) || nodesList[nodesList.length - 1] || 'GND';

  const nonGroundNodes = nodesList.filter(n => n !== groundNode);
  const nodeToIdx = new Map();
  nonGroundNodes.forEach((nid, i) => nodeToIdx.set(nid, i));

  const numNodes = nonGroundNodes.length;
  const numVsrc = 1; // Default 1.0V AC reference source
  const numOpamps = validOpamps.length;
  const size = numNodes + numVsrc + numOpamps;

  if (size === 0) {
    return { success: false, frequencyHz, error: 'Empty circuit matrix' };
  }

  // Build A and b
  const A = Array.from({ length: size }, () => Array.from({ length: size }, () => new Complex(0, 0)));
  const b = Array.from({ length: size }, () => new Complex(0, 0));

  // Stamp passives
  for (const comp of rawComps) {
    const ctype = String(comp.type || comp.class || 'resistor').toLowerCase();
    if (ctype.includes('opamp') || ctype.includes('op_amp') || ctype.includes('ic')) continue;

    const n1 = String(comp.node1 || comp.node_a || comp.hole1 || comp.start_hole || '');
    const n2 = String(comp.node2 || comp.node_b || comp.hole2 || comp.end_hole || '');

    const i1 = nodeToIdx.has(n1) ? nodeToIdx.get(n1) : -1;
    const i2 = nodeToIdx.has(n2) ? nodeToIdx.get(n2) : -1;

    let yComp = new Complex(0, 0);
    const val = parseCompValue(comp, 1000.0);

    if (ctype.includes('resistor') || ctype.includes('res')) {
      const r = Math.max(val, 1e-6);
      yComp = new Complex(1.0 / r, 0);
    } else if (ctype.includes('inductor') || ctype.includes('ind')) {
      const l = Math.max(val, 1e-12);
      const xl = omega * l;
      yComp = new Complex(0, -1.0 / Math.max(xl, 1e-12));
    } else if (ctype.includes('capacitor') || ctype.includes('cap')) {
      let c = Math.max(val, 1e-15);
      if (c > 1.0) c = c * 1e-6; // assume microfarads if > 1
      const xc = omega * c;
      yComp = new Complex(0, xc);
    } else if (ctype.includes('wire') || ctype.includes('jumper')) {
      yComp = new Complex(1000.0, 0);
    }

    if (i1 >= 0) A[i1][i1] = A[i1][i1].add(yComp);
    if (i2 >= 0) A[i2][i2] = A[i2][i2].add(yComp);
    if (i1 >= 0 && i2 >= 0) {
      A[i1][i2] = A[i1][i2].sub(yComp);
      A[i2][i1] = A[i2][i1].sub(yComp);
    }
  }

  // Stamp Vsource across candidate input node and GND
  const vSrcIdx = numNodes;
  let posNodeIdx = numNodes > 0 ? 0 : -1;
  if (validOpamps.length > 0 && validOpamps[0].terminals.in_pos) {
    const inPosNode = validOpamps[0].terminals.in_pos;
    if (nodeToIdx.has(inPosNode)) posNodeIdx = nodeToIdx.get(inPosNode);
  }
  if (posNodeIdx < 0 && numNodes > 0) {
    const namedInIdx = nonGroundNodes.findIndex(n => {
      const un = String(n).toUpperCase();
      return un.includes('VIN') || un.includes('VCC') || un.includes('PWR') || un === 'IN';
    });
    if (namedInIdx >= 0) posNodeIdx = namedInIdx;
  }
  const vMag = 1.0;

  if (posNodeIdx >= 0) {
    A[posNodeIdx][vSrcIdx] = A[posNodeIdx][vSrcIdx].add(new Complex(1, 0));
    A[vSrcIdx][posNodeIdx] = A[vSrcIdx][posNodeIdx].add(new Complex(1, 0));
  }
  b[vSrcIdx] = new Complex(vMag, 0);

  // Stamp Op-Amps
  validOpamps.forEach((op, opIdx) => {
    const colIdx = numNodes + numVsrc + opIdx;
    const rowIdx = numNodes + numVsrc + opIdx;
    const t = op.terminals;
    const defn = op.icDefinition || {};
    const specs = defn.electricalSpecs || {};

    const inPos = t.in_pos;
    const inNeg = t.in_neg;
    const outNode = t.output;

    const iPos = nodeToIdx.has(inPos) ? nodeToIdx.get(inPos) : -1;
    const iNeg = nodeToIdx.has(inNeg) ? nodeToIdx.get(inNeg) : -1;
    const iOut = nodeToIdx.has(outNode) ? nodeToIdx.get(outNode) : -1;

    const aOl0 = Number(specs.openLoopGain) || 1.0e6;
    const gbwp = Number(specs.gbwpHz) || 1.0e6;
    const fPole = gbwp / Math.max(aOl0, 1.0);
    // A_OL(jω) = A_ol_0 / (1 + j*(f / fPole))
    const denom = new Complex(1.0, frequencyHz / Math.max(fPole, 1e-6));
    const aOlJw = new Complex(aOl0, 0).div(denom);
    const invGain = new Complex(1.0, 0).div(aOlJw);

    // KCL at output
    if (iOut >= 0) {
      A[iOut][colIdx] = A[iOut][colIdx].add(new Complex(1, 0));
    }

    // Row equation: V+ - V- - (1 / A_OL) * Vout = 0
    if (iPos >= 0) A[rowIdx][iPos] = A[rowIdx][iPos].add(new Complex(1, 0));
    if (iNeg >= 0) A[rowIdx][iNeg] = A[rowIdx][iNeg].sub(new Complex(1, 0));
    if (iOut >= 0) A[rowIdx][iOut] = A[rowIdx][iOut].sub(invGain);

    b[rowIdx] = new Complex(0, 0);
  });

  try {
    const sol = solveComplexMatrix(A, b);
    const nodeVoltages = { [groundNode]: new Complex(0, 0) };
    nonGroundNodes.forEach((nid, i) => {
      nodeVoltages[nid] = sol[i];
    });

    const iSrcRaw = sol[vSrcIdx];
    const iIn = new Complex(-iSrcRaw.real, -iSrcRaw.imag); // Current flowing into circuit
    const zIn = iIn.mag() > 1e-12 ? new Complex(vMag, 0).div(iIn) : new Complex(1e6, 0);
    const inNodeName = posNodeIdx >= 0 ? nonGroundNodes[posNodeIdx] : null;

    return {
      success: true,
      frequencyHz,
      omegaRadS: omega,
      nodeVoltages,
      inputNode: inNodeName,
      groundNode,
      inputImpedance: {
        magnitudeOhms: zIn.mag(),
        phaseDeg: zIn.phaseDeg(),
        realOhms: zIn.real,
        imagReactanceOhms: zIn.imag,
        formatted: zIn.formatPolar()
      },
      sourceCurrent: {
        magnitudeMa: iIn.mag() * 1000.0,
        phaseDeg: iIn.phaseDeg()
      },
      primaryNodeVoltage: (posNodeIdx >= 0 && nodeVoltages[nonGroundNodes[posNodeIdx]]) || (nonGroundNodes[0] ? nodeVoltages[nonGroundNodes[0]] : new Complex(1, 0))
    };
  } catch (err) {
    return {
      success: false,
      frequencyHz,
      error: err.message
    };
  }
}

/**
 * Runs a complete linear or logarithmic frequency sweep across the netlist.
 */
export function runClientFrequencySweep(
  netlist,
  startFreqHz = 10.0,
  stopFreqHz = 100000.0,
  numPoints = 80,
  sweepType = 'log'
) {
  const startF = Math.max(0.1, Number(startFreqHz) || 10.0);
  const stopF = Math.max(startF * 1.1, Number(stopFreqHz) || 100000.0);
  const nPts = Math.min(Math.max(10, Number(numPoints) || 80), 300);

  const frequencies = [];
  if (sweepType === 'log') {
    const logStart = Math.log10(startF);
    const logStop = Math.log10(stopF);
    for (let i = 0; i < nPts; i++) {
      const f = Math.pow(10, logStart + (i / (nPts - 1)) * (logStop - logStart));
      frequencies.push(f);
    }
  } else {
    for (let i = 0; i < nPts; i++) {
      frequencies.push(startF + (i / (nPts - 1)) * (stopF - startF));
    }
  }

  const points = [];
  for (const f of frequencies) {
    const pt = solveAcPoint(netlist, f);
    if (!pt.success) continue;

    const vPri = pt.primaryNodeVoltage;
    const mag = vPri ? vPri.mag() : 1.0;
    const magDb = 20.0 * Math.log10(Math.max(mag, 1e-6));
    const phaseDeg = vPri ? vPri.phaseDeg() : 0.0;

    points.push({
      frequencyHz: Number(f.toFixed(2)),
      omegaRadS: Number((2.0 * Math.PI * f).toFixed(2)),
      magnitudeV: Number(mag.toFixed(4)),
      magnitudeDb: Number(magDb.toFixed(2)),
      phaseDeg: Number(phaseDeg.toFixed(2)),
      impedanceMagnitudeOhms: Number(pt.inputImpedance.magnitudeOhms.toFixed(2)),
      impedancePhaseDeg: Number(pt.inputImpedance.phaseDeg.toFixed(2)),
      reactanceOhms: Number(pt.inputImpedance.imagReactanceOhms.toFixed(2)),
      currentMagnitudeMa: Number(pt.sourceCurrent.magnitudeMa.toFixed(3)),
      currentPhaseDeg: Number(pt.sourceCurrent.phaseDeg.toFixed(2))
    });
  }

  return {
    success: points.length > 0,
    startFreqHz: startF,
    stopFreqHz: stopF,
    sweepType,
    totalPoints: points.length,
    points,
    source: 'mna_simulation',
    is_measured: false
  };
}

/**
 * Detects resonance frequency, bandwidth (-3dB), and Q factor from frequency response points.
 */
export function analyzeClientResonance(sweepResult, isParallel = false) {
  const points = sweepResult?.points || [];
  if (points.length < 5) {
    return {
      resonanceDetected: false,
      status: 'INSUFFICIENT_DATA',
      message: 'Insufficient sweep points for resonance calculation.'
    };
  }

  const freqs = points.map(p => p.frequencyHz);
  const zMags = points.map(p => p.impedanceMagnitudeOhms);
  const iMags = points.map(p => p.currentMagnitudeMa);
  const phases = points.map(p => p.phaseDeg);

  // Find index of zero-phase / extremum
  let resIdx = 0;
  if (!isParallel) {
    let maxI = -1;
    iMags.forEach((val, i) => {
      if (val > maxI) {
        maxI = val;
        resIdx = i;
      }
    });
  } else {
    let maxZ = -1;
    zMags.forEach((val, i) => {
      if (val > maxZ) {
        maxZ = val;
        resIdx = i;
      }
    });
  }

  const f0 = freqs[resIdx];
  const z0 = zMags[resIdx];
  const i0 = iMags[resIdx];
  const phase0 = phases[resIdx];

  // Bandwidth calculation (-3dB / half-power points)
  let fLow = null;
  let fHigh = null;

  if (!isParallel) {
    const iPeak = iMags[resIdx];
    const halfPower = iPeak * 0.7071;

    for (let i = resIdx - 1; i >= 0; i--) {
      if (iMags[i] <= halfPower) {
        fLow = freqs[i];
        break;
      }
    }
    for (let i = resIdx + 1; i < freqs.length; i++) {
      if (iMags[i] <= halfPower) {
        fHigh = freqs[i];
        break;
      }
    }
  } else {
    const zPeak = zMags[resIdx];
    const halfPower = zPeak * 0.7071;

    for (let i = resIdx - 1; i >= 0; i--) {
      if (zMags[i] <= halfPower) {
        fLow = freqs[i];
        break;
      }
    }
    for (let i = resIdx + 1; i < freqs.length; i++) {
      if (zMags[i] <= halfPower) {
        fHigh = freqs[i];
        break;
      }
    }
  }

  const bw = fLow && fHigh && fHigh > fLow ? Number((fHigh - fLow).toFixed(2)) : null;
  const qFactor = bw && bw > 0 ? Number((f0 / bw).toFixed(2)) : null;

  const resonanceDetected = Math.abs(phase0) <= 25.0;

  return {
    resonanceDetected,
    status: resonanceDetected ? 'VERIFIED_RESONANT' : 'NON_RESONANT',
    resonantFrequencyHz: Number(f0.toFixed(2)),
    resonantFrequencyFormatted: f0 < 1000 ? `${f0.toFixed(2)} Hz` : `${(f0 / 1000).toFixed(3)} kHz`,
    impedanceAtResonanceOhms: Number(z0.toFixed(2)),
    currentAtResonanceMa: Number(i0.toFixed(2)),
    phaseAtResonanceDeg: Number(phase0.toFixed(2)),
    bandwidthHz: bw,
    bandwidthFormatted: bw ? `${bw.toFixed(2)} Hz` : 'NOT_DETERMINED_IN_SWEEP_WINDOW',
    qFactor,
    fLowHz: fLow ? Number(fLow.toFixed(2)) : null,
    fHighHz: fHigh ? Number(fHigh.toFixed(2)) : null,
    detectionMethod: 'Complex MNA Frequency Response Extrema & Zero-Phase Crossing',
    source: 'mna_simulation',
    is_measured: false
  };
}

/**
 * Phase 27: Client Transfer Function Extraction H(jω) = Vout / Vin
 */
export function extractClientTransferResponse(netlist, sweepResult, inputNode = null, outputNode = null) {
  const points = sweepResult?.points || [];
  if (!points.length) {
    return {
      success: false,
      outputStatus: 'NOT_DEFINED',
      transferPoints: []
    };
  }

  // Determine IO nodes if not supplied
  const firstPt = solveAcPoint(netlist, points[0].frequencyHz);
  const inN = inputNode || firstPt.inputNode || 'VIN';
  const gndN = firstPt.groundNode || 'GND';

  let outN = outputNode;
  if (!outN && firstPt.nodeVoltages) {
    const keys = Object.keys(firstPt.nodeVoltages).filter(k => k !== gndN && k !== inN);
    const namedOut = keys.find(k => k.toUpperCase().includes('OUT'));
    outN = namedOut || keys[0] || inN;
  }

  const hasDefinedOutput = Boolean(outN && outN !== gndN);
  const transferPoints = [];

  for (const pt of points) {
    const f = pt.frequencyHz;
    const ptMna = solveAcPoint(netlist, f);
    if (!ptMna.success) continue;

    const vInC = ptMna.nodeVoltages[inN] || new Complex(1, 0);
    const vOutC = hasDefinedOutput ? (ptMna.nodeVoltages[outN] || new Complex(0, 0)) : null;

    let gainMag = 0;
    let gainDb = -999;
    let phaseDeg = 0;
    let hReal = 0;
    let hImag = 0;

    if (vOutC) {
      const hC = vOutC.div(vInC);
      gainMag = hC.mag();
      gainDb = 20.0 * Math.log10(Math.max(gainMag, 1e-9));
      phaseDeg = hC.phaseDeg();
      hReal = hC.real;
      hImag = hC.imag;
    }

    transferPoints.push({
      frequencyHz: f,
      omegaRadS: pt.omegaRadS,
      inputVoltage: {
        magnitude: Number(vInC.mag().toFixed(4)),
        phaseDeg: Number(vInC.phaseDeg().toFixed(2)),
        real: Number(vInC.real.toFixed(4)),
        imag: Number(vInC.imag.toFixed(4))
      },
      outputVoltage: vOutC ? {
        magnitude: Number(vOutC.mag().toFixed(4)),
        phaseDeg: Number(vOutC.phaseDeg().toFixed(2)),
        real: Number(vOutC.real.toFixed(4)),
        imag: Number(vOutC.imag.toFixed(4))
      } : null,
      inputCurrent: {
        magnitudeMa: pt.currentMagnitudeMa,
        phaseDeg: pt.currentPhaseDeg
      },
      gainMagnitude: Number(gainMag.toFixed(4)),
      gainDb: Number(gainDb.toFixed(2)),
      phaseDeg: Number(phaseDeg.toFixed(2)),
      impedanceMagnitudeOhms: pt.impedanceMagnitudeOhms,
      impedancePhaseDeg: pt.impedancePhaseDeg,
      transferReal: Number(hReal.toFixed(4)),
      transferImag: Number(hImag.toFixed(4)),
      source: 'mna_simulation',
      isMeasured: false
    });
  }

  return {
    success: true,
    inputNode: inN,
    outputNode: hasDefinedOutput ? outN : null,
    outputStatus: hasDefinedOutput ? 'DEFINED' : 'NOT_DEFINED',
    totalPoints: transferPoints.length,
    transferPoints,
    source: 'mna_simulation',
    isMeasured: false
  };
}

/**
 * Phase 27: Client Response Shape Analysis
 */
export function analyzeClientResponseShape(transferPoints) {
  if (!transferPoints || transferPoints.length < 5) {
    return { status: 'INSUFFICIENT_DATA', isValid: false };
  }

  const gains = transferPoints.map(p => p.gainMagnitude);
  const freqs = transferPoints.map(p => p.frequencyHz);
  const phases = transferPoints.map(p => p.phaseDeg);

  const lowFGain = gains[0];
  const highFGain = gains[gains.length - 1];
  const maxGain = Math.max(...gains);
  const minGain = Math.min(...gains);
  const maxIdx = gains.indexOf(maxGain);
  const minIdx = gains.indexOf(minGain);

  const isMonotonicallyDecreasing = gains.every((g, i) => i === 0 || g <= gains[i - 1] + 0.02);
  const isMonotonicallyIncreasing = gains.every((g, i) => i === 0 || g >= gains[i - 1] - 0.02);

  const isLowPassShape = lowFGain > 0.6 && highFGain < 0.2 && isMonotonicallyDecreasing;
  const isHighPassShape = lowFGain < 0.2 && highFGain > 0.6 && isMonotonicallyIncreasing;
  const isBandPassShape = (maxIdx > 0 && maxIdx < gains.length - 1 && maxGain > lowFGain + 0.15 && maxGain > highFGain + 0.15) || (lowFGain < 0.35 && highFGain < 0.35 && maxGain > 0.5 && maxIdx > 0 && maxIdx < gains.length - 1);
  const isBandStopShape = lowFGain > 0.6 && highFGain > 0.6 && minGain < 0.3 && minIdx > 0 && minIdx < gains.length - 1;
  const isFlatShape = (maxGain - minGain) < 0.05;

  return {
    status: 'ANALYZED',
    isValid: true,
    lowFrequencyGain: Number(lowFGain.toFixed(4)),
    highFrequencyGain: Number(highFGain.toFixed(4)),
    maxGain: Number(maxGain.toFixed(4)),
    minGain: Number(minGain.toFixed(4)),
    peakFrequencyHz: isBandPassShape ? freqs[maxIdx] : null,
    notchFrequencyHz: isBandStopShape ? freqs[minIdx] : null,
    isMonotonicallyDecreasing,
    isMonotonicallyIncreasing,
    isLowPassShape,
    isHighPassShape,
    isBandPassShape,
    isBandStopShape,
    isFlatShape,
    phaseLowFreqDeg: phases[0],
    phaseHighFreqDeg: phases[phases.length - 1]
  };
}

/**
 * Phase 27: Client Cutoff Frequency Detection (-3dB)
 */
export function detectClientCutoffFrequencies(transferPoints, shapeAnalysis) {
  if (!transferPoints || transferPoints.length < 5) {
    return { status: 'NOT_DETERMINED', fcHz: null, fLowHz: null, fHighHz: null };
  }

  const freqs = transferPoints.map(p => p.frequencyHz);
  const gains = transferPoints.map(p => p.gainMagnitude);
  const maxGain = Math.max(...gains);
  if (maxGain < 1e-4) {
    return { status: 'NOT_DETERMINED', fcHz: null };
  }

  const threshold = maxGain * 0.7071;
  let fc = null;

  // Low-Pass cutoff
  if (shapeAnalysis?.isLowPassShape || (gains[0] > threshold && gains[gains.length - 1] < threshold)) {
    for (let i = 0; i < gains.length - 1; i++) {
      if (gains[i] >= threshold && gains[i + 1] <= threshold) {
        const f1 = freqs[i];
        const f2 = freqs[i + 1];
        const g1 = gains[i];
        const g2 = gains[i + 1];
        if (Math.abs(g2 - g1) > 1e-6) {
          const ratio = (threshold - g1) / (g2 - g1);
          const logF = Math.log10(f1) + ratio * (Math.log10(f2) - Math.log10(f1));
          fc = Math.pow(10, logF);
        } else {
          fc = f1;
        }
        break;
      }
    }
    if (fc) {
      return {
        status: 'DETERMINED',
        filterMode: 'LOW_PASS',
        fcHz: Number(fc.toFixed(2)),
        fcFormatted: fc < 1000 ? `${fc.toFixed(2)} Hz` : `${(fc / 1000).toFixed(3)} kHz`,
        thresholdMagnitude: Number(threshold.toFixed(4)),
        referenceGain: Number(maxGain.toFixed(4))
      };
    }
  }

  // High-Pass cutoff
  if (shapeAnalysis?.isHighPassShape || (gains[0] < threshold && gains[gains.length - 1] > threshold)) {
    for (let i = 0; i < gains.length - 1; i++) {
      if (gains[i] <= threshold && gains[i + 1] >= threshold) {
        const f1 = freqs[i];
        const f2 = freqs[i + 1];
        const g1 = gains[i];
        const g2 = gains[i + 1];
        if (Math.abs(g2 - g1) > 1e-6) {
          const ratio = (threshold - g1) / (g2 - g1);
          const logF = Math.log10(f1) + ratio * (Math.log10(f2) - Math.log10(f1));
          fc = Math.pow(10, logF);
        } else {
          fc = f1;
        }
        break;
      }
    }
    if (fc) {
      return {
        status: 'DETERMINED',
        filterMode: 'HIGH_PASS',
        fcHz: Number(fc.toFixed(2)),
        fcFormatted: fc < 1000 ? `${fc.toFixed(2)} Hz` : `${(fc / 1000).toFixed(3)} kHz`,
        thresholdMagnitude: Number(threshold.toFixed(4)),
        referenceGain: Number(maxGain.toFixed(4))
      };
    }
  }

  return { status: 'NOT_DETERMINED', fcHz: null, fLowHz: null, fHighHz: null };
}

/**
 * Phase 27: Client Generalized AC Circuit Analysis Orchestrator
 */
export function analyzeClientGeneralizedAcCircuit(netlist, options = {}) {
  const startF = options.startFrequency || 10.0;
  const stopF = options.stopFrequency || 100000.0;
  const points = options.points || 80;
  const sweepType = options.sweepType || 'log';

  const sweep = runClientFrequencySweep(netlist, startF, stopF, points, sweepType);
  if (!sweep.success) {
    return {
      success: false,
      status: 'FAILED',
      error: 'Sweep execution failed',
      source: 'mna_simulation',
      isMeasured: false
    };
  }

  const isParallelHint = options.topologyType === 'parallel';
  const resonance = analyzeClientResonance(sweep, isParallelHint);
  const transfer = extractClientTransferResponse(netlist, sweep, options.inputNode, options.outputNode);
  const shape = analyzeClientResponseShape(transfer.transferPoints);
  const cutoff = detectClientCutoffFrequencies(transfer.transferPoints, shape);

  let behavior = 'UNKNOWN';
  if (shape.isLowPassShape) behavior = 'LOW_PASS';
  else if (shape.isHighPassShape) behavior = 'HIGH_PASS';
  else if (shape.isBandPassShape || (resonance.resonanceDetected && transfer.outputNode && transfer.outputNode !== transfer.inputNode)) behavior = 'BAND_PASS';
  else if (shape.isBandStopShape) behavior = 'BAND_STOP';
  else if (resonance.resonanceDetected) behavior = 'RESONANT';
  else if (shape.isFlatShape) behavior = 'FREQUENCY_INDEPENDENT';

  return {
    success: true,
    status: behavior !== 'UNKNOWN' ? 'VERIFIED' : 'UNSUPPORTED',
    behavior,
    primaryCandidate: behavior,
    frequencyResponse: transfer,
    shapeAnalysis: shape,
    cutoff,
    resonance,
    sweep,
    source: 'mna_simulation',
    isMeasured: false
  };
}
