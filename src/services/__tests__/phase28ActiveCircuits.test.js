import { describe, it } from 'node:test';
import assert from 'node:assert';

import { getIcDefinition, resolveOpampTerminals, IC_REGISTRY } from '../../intelligence/icRegistry.js';
import { classifyCircuitTopology } from '../../intelligence/topologyClassifier.js';
import { calculateCircuitBehaviour } from '../../intelligence/electricalBehaviourModel.js';
import { generateEducationalExplanation } from '../../intelligence/educationalExplanationGenerator.js';
import { generateVisualizationState } from '../../intelligence/visualizationStateEngine.js';
import { solveAcPoint } from '../../intelligence/acAnalysisEngine.js';

describe('Phase 28 — Active Circuit Intelligence & Op-Amp Engine', () => {

  describe('1. IC Registry & Pin Mapping Verification', () => {
    it('verifies all supported canonical op-amp models', () => {
      const models = ['LM741', 'LM358', 'TL072', 'NE5532', 'OP07', 'IDEAL_OPAMP'];
      for (const m of models) {
        const defn = getIcDefinition(m);
        assert.ok(defn, `Model ${m} must exist in IC registry`);
        assert.ok(defn.pinout, `Model ${m} must have pinout`);
        assert.ok(defn.electricalSpecs, `Model ${m} must have electrical specs`);
      }
    });

    it('rejects unknown IC part numbers with status UNKNOWN', () => {
      const defn = getIcDefinition('UNKNOWN_CHIP_XYZ');
      assert.strictEqual(defn, null);

      const comp = { id: 'U1', model: 'UNKNOWN_CHIP_XYZ', pins: { '1': 'N1', '2': 'N2' } };
      const res = resolveOpampTerminals(comp);
      assert.strictEqual(res.success, false);
      assert.strictEqual(res.status, 'UNKNOWN_IC');
    });

    it('resolves valid DIP-8 pin mapping properly', () => {
      const comp = {
        id: 'U1',
        model: 'LM741',
        pins: {
          '3': 'NODE_VIN',
          '2': 'NODE_INV',
          '6': 'NODE_VOUT',
          '7': 'NODE_VCC',
          '4': 'NODE_VEE'
        }
      };
      const res = resolveOpampTerminals(comp);
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.status, 'VERIFIED_PIN_MAPPING');
      assert.strictEqual(res.terminals.in_pos, 'NODE_VIN');
      assert.strictEqual(res.terminals.in_neg, 'NODE_INV');
      assert.strictEqual(res.terminals.output, 'NODE_VOUT');
    });

    it('detects missing pins and marks mapping invalid', () => {
      const comp = {
        id: 'U1',
        model: 'LM741',
        pins: {
          '3': 'NODE_VIN',
          '6': 'NODE_VOUT'
        }
      };
      const res = resolveOpampTerminals(comp);
      assert.strictEqual(res.success, false);
      assert.strictEqual(res.status, 'INVALID_PIN_MAPPING');
      assert.ok(res.missingPins.length > 0);
    });
  });

  describe('2. Non-Inverting Op-Amp Amplifier', () => {
    const netlist = {
      components: [
        { id: 'R_F', type: 'resistor', node1: 'NODE_VOUT', node2: 'NODE_INV', value: 10000.0 },
        { id: 'R_G', type: 'resistor', node1: 'NODE_INV', node2: 'NODE_GND', value: 10000.0 }
      ],
      ics: [
        {
          id: 'U1',
          model: 'LM741',
          terminals: {
            in_pos: 'NODE_VIN',
            in_neg: 'NODE_INV',
            output: 'NODE_VOUT'
          }
        }
      ],
      power_sources: [
        { id: 'V1', type: 'ac_voltage', positive_node: 'NODE_VIN', negative_node: 'NODE_GND', voltage: 1.0 }
      ]
    };

    it('classifies topology as OPAMP_NON_INVERTING with VERIFIED status', () => {
      const topo = classifyCircuitTopology(netlist);
      assert.strictEqual(topo.circuitType, 'OPAMP_NON_INVERTING');
      assert.strictEqual(topo.verificationState, 'VERIFIED');
      assert.strictEqual(topo.parameters.theoretical_gain, 2.0);
    });

    it('calculates theoretical electrical behaviour with Av = 1 + Rf/Rg', () => {
      const topo = classifyCircuitTopology(netlist);
      const behaviour = calculateCircuitBehaviour(topo, netlist);
      assert.strictEqual(behaviour.status, 'SOLVED_THEORETICAL');
      assert.strictEqual(behaviour.parameters.gain.value, 2.0);
      assert.strictEqual(behaviour.parameters.phase.value, 0.0);
      assert.strictEqual(behaviour.parameters.operatingState, 'LINEAR');
      assert.strictEqual(behaviour.parameters.gain.is_measured, false);
      assert.strictEqual(behaviour.parameters.gain.source, 'theoretical_model');
    });

    it('solves Complex MNA frequency point accurately for Non-Inverting Op-Amp', () => {
      const pt = solveAcPoint(netlist, 1000.0);
      assert.strictEqual(pt.success, true);
      const vout = pt.nodeVoltages['NODE_VOUT'];
      const vin = pt.nodeVoltages['NODE_VIN'];
      assert.ok(vout, 'Vout must be solved');
      assert.ok(vin, 'Vin must be solved');
      const gainMag = vout.mag() / Math.max(vin.mag(), 1e-12);
      assert.ok(Math.abs(gainMag - 2.0) < 0.05, `Solved gain ${gainMag} should be close to 2.0`);
    });

    it('generates educational explanation for in-phase amplification and feedback role', () => {
      const topo = classifyCircuitTopology(netlist);
      const behaviour = calculateCircuitBehaviour(topo, netlist);
      const edu = generateEducationalExplanation(topo, behaviour);
      assert.ok(edu.isVerified);
      assert.ok(edu.governingEquations.some(e => e.equation.includes('Av = 1 + (Rf / Rg)')));
      assert.ok(edu.visualGuide.includes('non-inverting'));
    });

    it('generates AR visualization state with active feedback overlays', () => {
      const topo = classifyCircuitTopology(netlist);
      const behaviour = calculateCircuitBehaviour(topo, netlist);
      const vis = generateVisualizationState(topo, behaviour, netlist);
      assert.strictEqual(vis.status, 'VERIFIED');
      assert.strictEqual(vis.overlays.feedbackPath, true);
      assert.strictEqual(vis.overlays.signalFlow, true);
      assert.strictEqual(vis.activeState.gain, 2.0);
    });
  });

  describe('3. Inverting Op-Amp Amplifier', () => {
    const netlist = {
      components: [
        { id: 'R_IN', type: 'resistor', node1: 'NODE_VIN', node2: 'NODE_INV', value: 10000.0 },
        { id: 'R_F', type: 'resistor', node1: 'NODE_INV', node2: 'NODE_VOUT', value: 10000.0 }
      ],
      ics: [
        {
          id: 'U1',
          model: 'TL072',
          terminals: {
            in_pos: 'NODE_GND',
            in_neg: 'NODE_INV',
            output: 'NODE_VOUT'
          }
        }
      ],
      power_sources: [
        { id: 'V1', type: 'ac_voltage', positive_node: 'NODE_VIN', negative_node: 'NODE_GND', voltage: 1.0 }
      ]
    };

    it('classifies topology as OPAMP_INVERTING with VERIFIED status', () => {
      const topo = classifyCircuitTopology(netlist);
      assert.strictEqual(topo.circuitType, 'OPAMP_INVERTING');
      assert.strictEqual(topo.verificationState, 'VERIFIED');
      assert.strictEqual(topo.parameters.theoretical_gain, -1.0);
    });

    it('calculates theoretical electrical behaviour with Av = -Rf/Rin and 180° phase inversion', () => {
      const topo = classifyCircuitTopology(netlist);
      const behaviour = calculateCircuitBehaviour(topo, netlist);
      assert.strictEqual(behaviour.status, 'SOLVED_THEORETICAL');
      assert.strictEqual(behaviour.parameters.gainMagnitude.value, 1.0);
      assert.strictEqual(behaviour.parameters.gain.value, -1.0);
      assert.strictEqual(behaviour.parameters.phase.value, 180.0);
    });

    it('solves Complex MNA frequency point accurately for Inverting Op-Amp', () => {
      const pt = solveAcPoint(netlist, 1000.0);
      assert.strictEqual(pt.success, true);
      const vout = pt.nodeVoltages['NODE_VOUT'];
      const vin = pt.nodeVoltages['NODE_VIN'];
      assert.ok(vout);
      assert.ok(vin);
      const gainMag = vout.mag() / Math.max(vin.mag(), 1e-12);
      assert.ok(Math.abs(gainMag - 1.0) < 0.05, `Solved gain ${gainMag} should be close to 1.0`);
    });
  });

  describe('4. Op-Amp Voltage Follower (Buffer)', () => {
    const netlist = {
      components: [
        { id: 'W_FB', type: 'wire', node1: 'NODE_VOUT', node2: 'NODE_INV' }
      ],
      ics: [
        {
          id: 'U1',
          model: 'LM358',
          terminals: {
            in_pos: 'NODE_VIN',
            in_neg: 'NODE_INV',
            output: 'NODE_VOUT'
          }
        }
      ],
      power_sources: [
        { id: 'V1', type: 'ac_voltage', positive_node: 'NODE_VIN', negative_node: 'NODE_GND', voltage: 1.0 }
      ]
    };

    it('classifies topology as OPAMP_VOLTAGE_FOLLOWER with VERIFIED status', () => {
      const topo = classifyCircuitTopology(netlist);
      assert.strictEqual(topo.circuitType, 'OPAMP_VOLTAGE_FOLLOWER');
      assert.strictEqual(topo.verificationState, 'VERIFIED');
      assert.strictEqual(topo.parameters.theoretical_gain, 1.0);
    });

    it('calculates theoretical electrical behaviour with unity gain Av ≈ 1.0', () => {
      const topo = classifyCircuitTopology(netlist);
      const behaviour = calculateCircuitBehaviour(topo, netlist);
      assert.strictEqual(behaviour.parameters.gain.value, 1.0);
      assert.strictEqual(behaviour.parameters.phase.value, 0.0);
    });

    it('solves Complex MNA for Voltage Follower with 1:1 unity output tracking', () => {
      const pt = solveAcPoint(netlist, 1000.0);
      assert.strictEqual(pt.success, true);
      const vout = pt.nodeVoltages['NODE_VOUT'];
      assert.ok(vout);
      assert.ok(Math.abs(vout.mag() - 1.0) < 0.05);
    });
  });

  describe('5. Dynamic Validation & Parameter Sensitivity', () => {
    it('updates solved gain when Rf is dynamically modified from 10k to 20k in Non-Inverting', () => {
      const netlist = {
        components: [
          { id: 'R_F', type: 'resistor', node1: 'NODE_VOUT', node2: 'NODE_INV', value: 20000.0 }, // 20k
          { id: 'R_G', type: 'resistor', node1: 'NODE_INV', node2: 'NODE_GND', value: 10000.0 }  // 10k
        ],
        ics: [
          {
            id: 'U1',
            model: 'LM741',
            terminals: { in_pos: 'NODE_VIN', in_neg: 'NODE_INV', output: 'NODE_VOUT' }
          }
        ]
      };
      const topo = classifyCircuitTopology(netlist);
      const behaviour = calculateCircuitBehaviour(topo, netlist);
      assert.strictEqual(topo.parameters.theoretical_gain, 3.0); // 1 + 20/10 = 3
      assert.strictEqual(behaviour.parameters.gain.value, 3.0);
    });

    it('detects saturation when output voltage exceeds linear swing limits', () => {
      const netlist = {
        components: [
          { id: 'R_F', type: 'resistor', node1: 'NODE_VOUT', node2: 'NODE_INV', value: 50000.0 },
          { id: 'R_G', type: 'resistor', node1: 'NODE_INV', node2: 'NODE_GND', value: 10000.0 }
        ],
        ics: [
          {
            id: 'U1',
            model: 'LM741',
            terminals: { in_pos: 'NODE_VIN', in_neg: 'NODE_INV', output: 'NODE_VOUT' }
          }
        ],
        power_sources: [
          { id: 'V1', type: 'ac_voltage', positive_node: 'NODE_VIN', negative_node: 'NODE_GND', voltage: 5.0 } // 5V * 6 = 30V > 15V rail
        ]
      };
      const topo = classifyCircuitTopology(netlist);
      const behaviour = calculateCircuitBehaviour(topo, netlist);
      assert.strictEqual(behaviour.parameters.operatingState, 'SATURATED');
    });
  });

  describe('6. Topology Invalidation & Broken Circuit Rejection', () => {
    it('rejects circuit when feedback resistor is broken / missing', () => {
      const brokenNetlist = {
        components: [
          { id: 'R_G', type: 'resistor', node1: 'NODE_INV', node2: 'NODE_GND', value: 10000.0 }
        ],
        ics: [
          {
            id: 'U1',
            model: 'LM741',
            terminals: { in_pos: 'NODE_VIN', in_neg: 'NODE_INV', output: 'NODE_VOUT' }
          }
        ]
      };
      const topo = classifyCircuitTopology(brokenNetlist);
      assert.strictEqual(topo.verificationState, 'UNSUPPORTED');
      assert.strictEqual(topo.topologyStatus, 'UNSUPPORTED_FEEDBACK_TOPOLOGY');
    });

    it('marks active filter with capacitor as UNSUPPORTED architectural placeholder per SPEC', () => {
      const activeFilterNetlist = {
        components: [
          { id: 'R1', type: 'resistor', node1: 'NODE_VIN', node2: 'NODE_INV', value: 10000.0 },
          { id: 'C1', type: 'capacitor', node1: 'NODE_INV', node2: 'NODE_VOUT', value: 1e-6 }
        ],
        ics: [
          {
            id: 'U1',
            model: 'LM741',
            terminals: { in_pos: 'NODE_GND', in_neg: 'NODE_INV', output: 'NODE_VOUT' }
          }
        ]
      };
      const topo = classifyCircuitTopology(activeFilterNetlist);
      assert.strictEqual(topo.verificationState, 'UNSUPPORTED');
      assert.strictEqual(topo.topologyStatus, 'UNSUPPORTED_ACTIVE_FILTER');
    });
  });
});
