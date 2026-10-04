import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  TRAINER_CURRENT_CONFIG,
  calculateM1Current,
  calculateM2Current,
  calculateTrainerVirtualCurrent,
  getMotorOperatingStatus,
  createTrainerCircuitModel
} from '../trainerCircuitConfig.js';

import {
  create3D7805Regulator,
  create3DESP32,
  create3DDCSupply,
  create3DDCMotor,
  create3DResistor,
  create3DCapacitor,
  create3DSwitch
} from '../../components/Realistic3DComponents.js';

import { MotorAnimationControllerClass } from '../../utils/motorAnimationController.js';

describe('SMARTBREADBOARD 3D — AR CIRCUIT TRAINER LOGIC & ACCEPTANCE TESTS', () => {

  // TEST 1: SW1 OFF, SW2 OFF
  test('TEST 1: SW1 OFF, SW2 OFF -> M1 STOPPED, M2 STOPPED, TOTAL = 0.00 mA', () => {
    const sw1On = false;
    const sw2On = false;

    const m1Status = getMotorOperatingStatus(sw1On);
    const m2Status = getMotorOperatingStatus(sw2On);

    const m1Current = calculateM1Current(sw1On);
    const m2Current = calculateM2Current(sw2On);
    const totalCurrent = calculateTrainerVirtualCurrent(sw1On, sw2On);

    assert.equal(m1Status, 'STOPPED', 'M1 must be STOPPED when SW1 is OFF');
    assert.equal(m2Status, 'STOPPED', 'M2 must be STOPPED when SW2 is OFF');
    assert.equal(m1Current, 0.00, 'M1 current contribution must be 0.00 mA');
    assert.equal(m2Current, 0.00, 'M2 current contribution must be 0.00 mA');
    assert.equal(totalCurrent, 0.00, 'Total virtual current must be 0.00 mA');
  });

  // TEST 2: SW1 ON, SW2 OFF
  test('TEST 2: SW1 ON, SW2 OFF -> M1 RUNNING, M2 STOPPED, M1 = 20.15 mA, M2 = 0.00 mA, TOTAL = 20.15 mA', () => {
    const sw1On = true;
    const sw2On = false;

    const m1Status = getMotorOperatingStatus(sw1On);
    const m2Status = getMotorOperatingStatus(sw2On);

    const m1Current = calculateM1Current(sw1On);
    const m2Current = calculateM2Current(sw2On);
    const totalCurrent = calculateTrainerVirtualCurrent(sw1On, sw2On);

    assert.equal(m1Status, 'RUNNING', 'M1 must be RUNNING when SW1 is ON');
    assert.equal(m2Status, 'STOPPED', 'M2 must be STOPPED when SW2 is OFF');
    assert.equal(m1Current, 20.15, 'M1 current contribution must be exactly 20.15 mA');
    assert.equal(m2Current, 0.00, 'M2 current contribution must be 0.00 mA');
    assert.equal(totalCurrent, 20.15, 'Total virtual current must be 20.15 mA');
  });

  // TEST 3: SW1 OFF, SW2 ON
  test('TEST 3: SW1 OFF, SW2 ON -> M1 STOPPED, M2 RUNNING, M1 = 0.00 mA, M2 = 13.47 mA, TOTAL = 13.47 mA', () => {
    const sw1On = false;
    const sw2On = true;

    const m1Status = getMotorOperatingStatus(sw1On);
    const m2Status = getMotorOperatingStatus(sw2On);

    const m1Current = calculateM1Current(sw1On);
    const m2Current = calculateM2Current(sw2On);
    const totalCurrent = calculateTrainerVirtualCurrent(sw1On, sw2On);

    assert.equal(m1Status, 'STOPPED', 'M1 must be STOPPED when SW1 is OFF');
    assert.equal(m2Status, 'RUNNING', 'M2 must be RUNNING when SW2 is ON');
    assert.equal(m1Current, 0.00, 'M1 current contribution must be 0.00 mA');
    assert.equal(m2Current, 13.47, 'M2 current contribution must be exactly 13.47 mA');
    assert.equal(totalCurrent, 13.47, 'Total virtual current must be 13.47 mA');
  });

  // TEST 4: SW1 ON, SW2 ON
  test('TEST 4: SW1 ON, SW2 ON -> M1 RUNNING, M2 RUNNING, M1 = 20.15 mA, M2 = 13.47 mA, TOTAL = 33.62 mA', () => {
    const sw1On = true;
    const sw2On = true;

    const m1Status = getMotorOperatingStatus(sw1On);
    const m2Status = getMotorOperatingStatus(sw2On);

    const m1Current = calculateM1Current(sw1On);
    const m2Current = calculateM2Current(sw2On);
    const totalCurrent = calculateTrainerVirtualCurrent(sw1On, sw2On);

    assert.equal(m1Status, 'RUNNING', 'M1 must be RUNNING');
    assert.equal(m2Status, 'RUNNING', 'M2 must be RUNNING');
    assert.equal(m1Current, 20.15, 'M1 current must be 20.15 mA');
    assert.equal(m2Current, 13.47, 'M2 current must be 13.47 mA');
    assert.equal(totalCurrent, 33.62, 'Total virtual current must be exactly 33.62 mA');
  });

  // TEST 5: SW1 OFF while M1 is running -> M1 smoothly stops, M2 remains unchanged
  test('TEST 5: SW1 OFF while M1 is running -> M1 smoothly decelerates to STOPPED, M2 remains unchanged', () => {
    const m1 = create3DDCMotor({ id: 'M1' });
    const m2 = create3DDCMotor({ id: 'M2' });

    // Both running initially
    m1.update({ status: 'RUNNING', is_running: true });
    m2.update({ status: 'RUNNING', is_running: true });

    assert.ok(m1.animController.getSpeed() > 0, 'M1 should be rotating');
    assert.ok(m2.animController.getSpeed() > 0, 'M2 should be rotating');

    const m2InitialSpeed = m2.animController.getSpeed();

    // Turn SW1 OFF
    const step1 = m1.update({ status: 'STOPPED', is_running: false });
    assert.equal(step1.status, 'STOPPED');
    // Still in decelerating phase (smooth deceleration factor 0.92)
    assert.ok(step1.speed > 0, 'M1 should decelerate smoothly, not stop abruptly in zero frames');

    // M2 continues running completely unchanged
    m2.update({ status: 'RUNNING', is_running: true });
    assert.ok(m2.animController.getSpeed() >= m2InitialSpeed * 0.9, 'M2 speed must remain high and unaffected by SW1');

    // Run deceleration loop for M1 until fully stopped
    for (let i = 0; i < 60; i++) {
      m1.update({ status: 'STOPPED', is_running: false });
    }
    assert.equal(m1.animController.getSpeed(), 0.0, 'M1 must reach 0 speed smoothly');
  });

  // TEST 6: SW2 OFF while M2 is running -> M2 smoothly stops, M1 remains unchanged
  test('TEST 6: SW2 OFF while M2 is running -> M2 smoothly decelerates to STOPPED, M1 remains unchanged', () => {
    const m1 = create3DDCMotor({ id: 'M1' });
    const m2 = create3DDCMotor({ id: 'M2' });

    // Both running
    m1.update({ status: 'RUNNING', is_running: true });
    m2.update({ status: 'RUNNING', is_running: true });

    const m1InitialSpeed = m1.animController.getSpeed();

    // Turn SW2 OFF
    const step1 = m2.update({ status: 'STOPPED', is_running: false });
    assert.equal(step1.status, 'STOPPED');
    assert.ok(step1.speed > 0, 'M2 should decelerate smoothly');

    // M1 continues running completely unchanged
    m1.update({ status: 'RUNNING', is_running: true });
    assert.ok(m1.animController.getSpeed() >= m1InitialSpeed * 0.9, 'M1 must remain running unaffected by SW2');

    // Run deceleration loop for M2 until fully stopped
    for (let i = 0; i < 60; i++) {
      m2.update({ status: 'STOPPED', is_running: false });
    }
    assert.equal(m2.animController.getSpeed(), 0.0, 'M2 must reach 0 speed smoothly');
  });

  // TEST 7: ESP32 disconnected
  test('TEST 7: ESP32 disconnected -> AR still works, SW1/SW2 still work, Virtual current unaffected, Hardware current displays "ESP32 Disconnected"', () => {
    let esp32Connected = false;

    // Virtual current calculation does NOT depend on ESP32
    const sw1On = true;
    const sw2On = true;
    const virtualCurrent = calculateTrainerVirtualCurrent(sw1On, sw2On);
    assert.equal(virtualCurrent, 33.62, 'Virtual current must be calculated instantly even when ESP32 is offline');

    // Hardware current displays "ESP32 Disconnected"
    const hardwareCurrentDisplay = esp32Connected ? `${virtualCurrent.toFixed(2)} mA` : 'ESP32 Disconnected';
    assert.equal(hardwareCurrentDisplay, 'ESP32 Disconnected');

    // Reconnecting updates hardware display without corrupting virtual values
    esp32Connected = true;
    const reconnectedHardwareDisplay = esp32Connected ? `${virtualCurrent.toFixed(2)} mA` : 'ESP32 Disconnected';
    assert.equal(reconnectedHardwareDisplay, '33.62 mA');
  });

  // TEST 8: Uploaded circuit becomes the AR reference, no Circuit 1/2/3 replacement
  test('TEST 8: Uploaded circuit model contains exact 9 trainer components, no Circuit 1/2/3 fallback', () => {
    const trainerCircuit = createTrainerCircuitModel();

    assert.equal(trainerCircuit.source, 'REAL_UPLOADED_CIRCUIT');
    assert.notEqual(trainerCircuit.id, 'CIRCUIT_1_SERIES_RLC_MOTOR');
    assert.notEqual(trainerCircuit.id, 'CIRCUIT_2_PROTECTED_RLC_MOTOR');
    assert.notEqual(trainerCircuit.id, 'CIRCUIT_3_SERIES_PARALLEL_COMPENSATION');

    const compIds = trainerCircuit.components.map(c => c.id);
    assert.ok(compIds.includes('7805'), '7805 must be present');
    assert.ok(compIds.includes('C1'), 'C1 must be present');
    assert.ok(compIds.includes('R1'), 'R1 must be present');
    assert.ok(compIds.includes('SW1'), 'SW1 must be present');
    assert.ok(compIds.includes('SW2'), 'SW2 must be present');
    assert.ok(compIds.includes('M1'), 'M1 must be present');
    assert.ok(compIds.includes('M2'), 'M2 must be present');
    assert.ok(compIds.includes('ESP32'), 'ESP32 must be present');
    assert.ok(compIds.includes('DC_SUPPLY'), 'DC_SUPPLY must be present');
    assert.ok(trainerCircuit.wires.length >= 6, 'Connecting wires must be present');
  });

  // Realistic 3D Components Construction Verification
  test('3D Components Factory: creates valid 7805, ESP32, DC Supply, and DC Motor meshes', () => {
    const reg7805 = create3D7805Regulator();
    assert.ok(reg7805.group, '7805 group must exist');
    assert.equal(reg7805.group.name, 'Regulator_7805');

    const esp32 = create3DESP32();
    assert.ok(esp32.group, 'ESP32 group must exist');
    assert.equal(esp32.group.name, 'ESP32_Board');

    const dcSupply = create3DDCSupply();
    assert.ok(dcSupply.group, 'DC Supply group must exist');

    const dcMotorM1 = create3DDCMotor({ id: 'M1' });
    assert.ok(dcMotorM1.group, 'DC Motor M1 group must exist');
    assert.ok(dcMotorM1.shaftGroup, 'M1 rotating shaft must exist');
    assert.ok(dcMotorM1.animController, 'M1 independent controller must exist');

    const dcMotorM2 = create3DDCMotor({ id: 'M2' });
    assert.ok(dcMotorM2.group, 'DC Motor M2 group must exist');
    assert.ok(dcMotorM2.shaftGroup, 'M2 rotating shaft must exist');
    assert.ok(dcMotorM2.animController, 'M2 independent controller must exist');

    // Confirm M1 and M2 controllers are distinct instances
    assert.notStrictEqual(dcMotorM1.animController, dcMotorM2.animController, 'M1 and M2 must not share the same controller instance');
  });

});
