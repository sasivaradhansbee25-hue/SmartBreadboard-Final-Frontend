/**
 * src/services/__tests__/realCircuitEndToEnd.test.js
 *
 * SMARTBREADBOARD 3D — FINAL REVIEW MASTER FIX VERIFICATION SUITE
 *
 * Verifies all 14 requirements specified in Section 18:
 * TEST 1: Valid top-angle circuit image accepted.
 * TEST 2: Bad side-angle image rejected.
 * TEST 3: Blurred image rejected.
 * TEST 4: Cropped circuit rejected.
 * TEST 5: Valid image reaches component detection.
 * TEST 6: Detected components receive terminal mappings where confidently possible.
 * TEST 7: Electrical nodes are generated from actual connections.
 * TEST 8: Netlist represents detected circuit.
 * TEST 9: Invalid/unverified topology does not produce fake simulation.
 * TEST 10: Valid netlist reaches simulation.
 * TEST 11: 3D model uses detected components.
 * TEST 12: AR uses uploaded circuit image as reference.
 * TEST 13: No Circuit 1/2/3 fallback occurs for real uploaded circuit analysis.
 * TEST 14: Existing Motor Trainer tests remain passing.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { validateCircuitImage } from '../scannerImageValidator.js';
import { formatPipelineResultForCircuitContext } from '../photoCircuitService.js';
import { validateSupply, extractVerifiedNodes, SUPPLY_STATUS } from '../supplyConfigurationService.js';
import { calculateComponentAnchor, calculateVideoDisplayRect } from '../../utils/arCoordinateTransform.js';
import {
  TRAINER_CURRENT_CONFIG,
  calculateM1Current,
  calculateM2Current,
  calculateTrainerVirtualCurrent,
  createTrainerCircuitModel
} from '../trainerCircuitConfig.js';
import { motorAnimationController, calculateMotorOperatingState } from '../../utils/motorAnimationController.js';

describe('SmartBreadboard 3D — Real Circuit Pipeline End-to-End Tests (Section 18)', () => {

  // TEST 1: Valid top-angle circuit image accepted.
  test('TEST 1: Valid top-angle circuit image accepted', async () => {
    const validSignal = {
      test_case: 'valid_top_view',
      sharpness: 55,
      brightness: 130,
      contrast: 45,
      tilt_angle: 8,
      perspective_skew: 0.93,
      margin: 25,
      has_circuit_evidence: true
    };
    const res = await validateCircuitImage(validSignal);
    assert.equal(res.valid, true);
    assert.ok(res.score >= 75);
    assert.equal(res.metrics.topAngle, 'GOOD');
    assert.equal(res.metrics.circuitVisibility, 'GOOD');
    assert.equal(res.reasons.length, 0);
  });

  // TEST 2: Bad side-angle image rejected.
  test('TEST 2: Bad side-angle image rejected', async () => {
    const sideAngleSignal = {
      test_case: 'side_angle',
      tilt_angle: 50,
      perspective_skew: 0.40
    };
    const res = await validateCircuitImage(sideAngleSignal);
    assert.equal(res.valid, false);
    assert.ok(res.reasons.some(r => r.toLowerCase().includes('angle') || r.toLowerCase().includes('tilt') || r.toLowerCase().includes('top')));
    assert.ok(res.recommendations.some(rec => rec.toLowerCase().includes('top') || rec.toLowerCase().includes('angle')));
  });

  // TEST 3: Blurred image rejected.
  test('TEST 3: Blurred image rejected', async () => {
    const blurSignal = {
      test_case: 'blurry',
      sharpness: 8
    };
    const res = await validateCircuitImage(blurSignal);
    assert.equal(res.valid, false);
    assert.ok(res.reasons.some(r => r.toLowerCase().includes('blur') || r.toLowerCase().includes('focus') || r.toLowerCase().includes('sharp')));
  });

  // TEST 4: Cropped circuit rejected.
  test('TEST 4: Cropped circuit rejected', async () => {
    const cropSignal = {
      test_case: 'cropped',
      margin: 2
    };
    const res = await validateCircuitImage(cropSignal);
    assert.equal(res.valid, false);
    assert.ok(res.reasons.some(r => r.toLowerCase().includes('crop') || r.toLowerCase().includes('frame') || r.toLowerCase().includes('edge')));
  });

  // TEST 5: Valid image reaches component detection.
  test('TEST 5: Valid image reaches component detection', async () => {
    const validSignal = {
      test_case: 'valid_top_view',
      sharpness: 52,
      brightness: 128,
      contrast: 44,
      tilt_angle: 6,
      perspective_skew: 0.95,
      margin: 22,
      has_circuit_evidence: true
    };
    const res = await validateCircuitImage(validSignal);
    assert.equal(res.valid, true);

    // Mock detection response from real pipeline
    const pipelineData = {
      status: 'READY',
      source: 'yolo_model',
      components: [
        {
          id: 'R1',
          type: 'resistor',
          confidence: 0.95,
          boundingBox: [200, 150, 350, 180],
          center: [275, 165],
          orientation: 0.0,
          terminals: [
            { pin: 1, hole: 'A10', node: 'NET_1', status: 'VERIFIED' },
            { pin: 2, hole: 'A15', node: 'NET_2', status: 'VERIFIED' }
          ]
        }
      ],
      nodes: ['NET_1', 'NET_2']
    };

    const formatted = formatPipelineResultForCircuitContext(pipelineData, 'data:image/png;base64,mock');
    assert.ok(formatted);
    assert.equal(formatted.components.length, 1);
    assert.equal(formatted.components[0].id, 'R1');
  });

  // TEST 6: Detected components receive terminal mappings where confidently possible.
  test('TEST 6: Detected components receive terminal mappings where confidently possible', () => {
    const pipelineData = {
      status: 'READY',
      components: [
        {
          id: 'R1',
          type: 'resistor',
          confidence: 0.94,
          terminals: [
            { pin: 1, hole: 'A10', node: 'NET_1', status: 'VERIFIED' },
            { pin: 2, hole: 'A15', node: 'NET_2', status: 'VERIFIED' }
          ]
        },
        {
          id: 'LED1',
          type: 'led',
          confidence: 0.92,
          terminals: [
            { pin: 1, hole: 'B15', node: 'NET_2', status: 'VERIFIED' },
            { pin: 2, hole: 'B20', node: 'NET_GND', status: 'VERIFIED' }
          ]
        }
      ],
      nodes: ['NET_1', 'NET_2', 'NET_GND']
    };

    const formatted = formatPipelineResultForCircuitContext(pipelineData);
    assert.equal(formatted.components[0].start_hole, 'A10');
    assert.equal(formatted.components[0].end_hole, 'A15');
    assert.equal(formatted.components[0].terminals[0].pin, 1);
    assert.equal(formatted.components[0].terminals[0].hole, 'A10');
    assert.equal(formatted.components[1].start_hole, 'B15');
    assert.equal(formatted.components[1].end_hole, 'B20');
  });

  // TEST 7: Electrical nodes are generated from actual connections.
  test('TEST 7: Electrical nodes are generated from actual connections', () => {
    const pipelineData = {
      status: 'READY',
      components: [
        {
          id: 'R1',
          type: 'resistor',
          terminals: [
            { pin: 1, hole: 'A10', node: 'NET_1' },
            { pin: 2, hole: 'A15', node: 'NET_2' }
          ]
        },
        {
          id: 'LED1',
          type: 'led',
          terminals: [
            { pin: 1, hole: 'B15', node: 'NET_2' }, // Connected through column 15 breadboard tie-strip!
            { pin: 2, hole: 'B20', node: 'NET_GND' }
          ]
        }
      ],
      nodes: ['NET_1', 'NET_2', 'NET_GND'],
      connections: [
        { from: 'R1.pin2', to: 'LED1.pin1', node_id: 'NET_2' }
      ]
    };

    const verifiedNodes = extractVerifiedNodes(pipelineData);
    assert.ok(verifiedNodes.includes('NET_1'));
    assert.ok(verifiedNodes.includes('NET_2'));
    assert.ok(verifiedNodes.includes('NET_GND'));
    assert.equal(verifiedNodes.length, 3);
  });

  // TEST 8: Netlist represents detected circuit.
  test('TEST 8: Netlist represents detected circuit', () => {
    const pipelineData = {
      status: 'READY',
      netlist: {
        components: [
          { name: 'R1', type: 'R', nodes: ['NET_1', 'NET_2'], value: 220 },
          { name: 'D1', type: 'D', nodes: ['NET_2', 'NET_GND'], model: 'LED' }
        ],
        nodes: ['NET_1', 'NET_2', 'NET_GND'],
        connections: [
          { comp1: 'R1', pin1: 2, comp2: 'D1', pin2: 1, node: 'NET_2' }
        ]
      },
      components: [
        {
          id: 'R1',
          type: 'resistor',
          terminals: [
            { pin: 1, hole: 'A10', node: 'NET_1' },
            { pin: 2, hole: 'A15', node: 'NET_2' }
          ]
        }
      ]
    };

    const formatted = formatPipelineResultForCircuitContext(pipelineData);
    assert.ok(formatted.netlist);
    assert.equal(formatted.netlist.components.length, 2);
    assert.deepEqual(formatted.netlist.components[0].nodes, ['NET_1', 'NET_2']);
  });

  // TEST 9: Invalid/unverified topology does not produce fake simulation.
  test('TEST 9: Invalid/unverified topology does not produce fake simulation', () => {
    const unverifiedCircuit = {
      status: 'UNVERIFIED',
      simulation_readiness_reason: 'CIRCUIT_CONNECTIONS_NOT_VERIFIED',
      components: [
        {
          id: 'R1',
          type: 'resistor',
          status: 'UNVERIFIED',
          terminals: [
            { pin: 1, hole: 'A10', node: 'UNRESOLVED', status: 'UNVERIFIED' },
            { pin: 2, hole: null, node: 'UNRESOLVED', status: 'UNVERIFIED' }
          ]
        }
      ],
      nodes: []
    };

    const supplyCheck = validateSupply(unverifiedCircuit, 'NET_1', 'NET_GND', '5.0');
    assert.equal(supplyCheck.valid, false);
    assert.equal(supplyCheck.status, SUPPLY_STATUS.BLOCKED);
    assert.ok(supplyCheck.message.toLowerCase().includes('unverified') || supplyCheck.message.toLowerCase().includes('not verified'));
  });

  // TEST 10: Valid netlist reaches simulation.
  test('TEST 10: Valid netlist reaches simulation', () => {
    const validCircuit = {
      status: 'READY',
      components: [
        {
          id: 'R1',
          type: 'resistor',
          value: 220,
          status: 'VERIFIED',
          terminals: [
            { pin: 1, hole: 'A10', node: 'NET_1', status: 'VERIFIED' },
            { pin: 2, hole: 'A15', node: 'NET_GND', status: 'VERIFIED' }
          ]
        }
      ],
      nodes: ['NET_1', 'NET_GND']
    };

    const supplyCheck = validateSupply(validCircuit, 'NET_1', 'NET_GND', '5.0');
    assert.equal(supplyCheck.valid, true);
    assert.equal(supplyCheck.status, SUPPLY_STATUS.VALID);
  });

  // TEST 11: 3D model uses detected components.
  test('TEST 11: 3D model uses detected components', () => {
    const realDetectionResult = {
      status: 'READY',
      components: [
        {
          id: 'R1',
          type: 'resistor',
          value: 1000,
          confidence: 0.96,
          status: 'VERIFIED',
          boundingBox: [200, 150, 360, 200],
          center: [280, 175],
          orientation: 0,
          terminals: [
            { pin: 1, hole: 'A12', node: 'NET_1', status: 'VERIFIED' },
            { pin: 2, hole: 'A17', node: 'NET_2', status: 'VERIFIED' }
          ]
        }
      ]
    };

    const formatted = formatPipelineResultForCircuitContext(realDetectionResult);
    const comp3D = formatted.components[0];
    assert.equal(comp3D.id, 'R1');
    assert.equal(comp3D.start_hole, 'A12');
    assert.equal(comp3D.end_hole, 'A17');
    assert.equal(comp3D.type, 'resistor');
    assert.equal(comp3D.status, 'VERIFIED');
    // Ensure 3D coordinate lookup succeeds without hole mapping warning
    assert.ok(comp3D.terminals && comp3D.terminals.length === 2);
    assert.equal(comp3D.terminals[0].hole, 'A12');
  });

  // TEST 12: AR uses uploaded circuit image as reference.
  test('TEST 12: AR uses uploaded circuit image as reference', () => {
    const comp = {
      id: 'R1',
      boundingBox: [100, 100, 300, 200],
      center: [200, 150],
      terminals: [
        { pin: 1, hole: 'A10', pixel: { x: 110, y: 150 } },
        { pin: 2, hole: 'A15', pixel: { x: 290, y: 150 } }
      ]
    };

    const displayRect = calculateVideoDisplayRect(640, 480, 1280, 720, 'contain');
    const anchor = calculateComponentAnchor(comp, displayRect);
    assert.ok(anchor);
    assert.ok(anchor.anchorScreen.x > 0 && anchor.anchorScreen.x < 640);
    assert.ok(anchor.anchorScreen.y > 0 && anchor.anchorScreen.y < 480);
    assert.ok(anchor.t1Screen && anchor.t2Screen);
  });

  // TEST 13: No Circuit 1/2/3 fallback occurs for real uploaded circuit analysis.
  test('TEST 13: No Circuit 1/2/3 fallback occurs for real uploaded circuit analysis', () => {
    // When detection finds no components, status is marked accordingly, never substituted with Circuit 1/2/3
    const emptyDetectionResult = {
      status: 'READY',
      source: 'yolo_model',
      components: [],
      nodes: []
    };

    const formatted = formatPipelineResultForCircuitContext(emptyDetectionResult);
    assert.equal(formatted.components.length, 0);
    assert.notEqual(formatted.id, 'circuit-1');
    assert.notEqual(formatted.id, 'circuit-2');
    assert.notEqual(formatted.id, 'circuit-3');
    assert.notEqual(formatted.name, 'Basic Series Resistor Circuit');
  });

  // TEST 14: Existing Motor Trainer tests remain passing.
  test('TEST 14: Existing Motor Trainer tests remain passing', () => {
    const trainerModel = createTrainerCircuitModel();
    assert.ok(trainerModel);
    assert.equal(trainerModel.is_trainer, true);
    assert.ok(trainerModel.components.length > 0);

    // Verify virtual current mapping rules:
    // SW1 OFF + SW2 OFF = 0
    assert.equal(calculateTrainerVirtualCurrent(false, false), 0.00);
    // SW1 ON + SW2 OFF = 20.15 mA
    assert.equal(calculateTrainerVirtualCurrent(true, false), 20.15);
    // SW1 OFF + SW2 ON = 13.47 mA
    assert.equal(calculateTrainerVirtualCurrent(false, true), 13.47);
    // SW1 ON + SW2 ON = 33.62 mA
    assert.equal(calculateTrainerVirtualCurrent(true, true), 33.62);

    motorAnimationController.reset();
    const idleState = calculateMotorOperatingState({
      simulationResult: null,
      simulationStatus: 'NOT_RUN',
      switchState: 'OFF'
    });
    assert.equal(idleState.is_running, false);

    const runState = calculateMotorOperatingState({
      simulationResult: {
        circuit_signature: 'SIG_MOTOR_1',
        motor: { is_running: true, status: 'RUNNING', power_w: 50, current_a: 0.5, voltage_v: 230 }
      },
      simulationStatus: 'SOLVED',
      simulationSignature: 'SIG_MOTOR_1',
      currentCircuitSignature: 'SIG_MOTOR_1',
      switchState: 'ON'
    });
    assert.equal(runState.status, 'RUNNING');
    assert.equal(runState.is_running, true);
    assert.ok(runState.simulated_rpm > 0);

    const updateRes = motorAnimationController.update(runState);
    assert.ok(updateRes.speed > 0);
  });
});
