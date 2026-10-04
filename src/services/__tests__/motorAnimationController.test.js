import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateMotorOperatingState,
  motorAnimationController,
  MOTOR_DEFAULTS
} from '../../utils/motorAnimationController.js';
import { solveAcCircuitTemplate } from '../acCircuitEngine.js';

describe('SmartBreadboard 3D — Critical Motor Visualization Tests', () => {
  let solvedCircuit1;

  beforeEach(() => {
    motorAnimationController.reset();
    solvedCircuit1 = solveAcCircuitTemplate('CIRCUIT_1_SERIES_RLC_MOTOR');
  });

  test('motor rotates when solved and switch is ON', () => {
    const motorState = calculateMotorOperatingState({
      simulationResult: solvedCircuit1,
      simulationStatus: 'SOLVED',
      simulationSignature: solvedCircuit1.circuit_signature,
      currentCircuitSignature: solvedCircuit1.circuit_signature,
      switchState: 'ON'
    });

    assert.equal(motorState.status, 'RUNNING');
    assert.equal(motorState.is_running, true);
    assert.equal(motorState.is_rotating, true);
    assert.ok(motorState.simulated_rpm > 1000, `Expected RPM > 1000, got ${motorState.simulated_rpm}`);
    assert.ok(motorState.visual_speed >= MOTOR_DEFAULTS.MIN_VISUAL_SPEED);
    assert.equal(motorState.visual_speed_label, 'SIMULATED RPM');

    // Controller updates rotor angle
    const initialAngle = motorAnimationController.getAngle();
    const update1 = motorAnimationController.update(motorState);
    assert.ok(update1.speed > 0);
    assert.ok(update1.angle > initialAngle);
    assert.equal(update1.isRotating, true);
  });

  test('motor stops when switch OFF (smooth deceleration)', () => {
    // First run the motor
    const runState = calculateMotorOperatingState({
      simulationResult: solvedCircuit1,
      simulationStatus: 'SOLVED',
      simulationSignature: solvedCircuit1.circuit_signature,
      currentCircuitSignature: solvedCircuit1.circuit_signature,
      switchState: 'ON'
    });
    for (let i = 0; i < 20; i++) {
      motorAnimationController.update(runState);
    }
    const runningSpeed = motorAnimationController.getSpeed();
    assert.ok(runningSpeed > 0.05);

    // Switch turns OFF
    const offState = calculateMotorOperatingState({
      simulationResult: solvedCircuit1,
      simulationStatus: 'SOLVED',
      simulationSignature: solvedCircuit1.circuit_signature,
      currentCircuitSignature: solvedCircuit1.circuit_signature,
      switchState: 'OFF'
    });

    assert.equal(offState.status, 'STOPPED');
    assert.equal(offState.is_running, false);
    assert.equal(offState.simulated_rpm, 0);
    assert.equal(offState.decelerate, true);

    // Spin down over multiple animation frames
    let prevSpeed = runningSpeed;
    for (let f = 0; f < 80; f++) {
      const u = motorAnimationController.update(offState);
      assert.ok(u.speed <= prevSpeed + 1e-6, 'Speed must monotonically decrease during deceleration');
      prevSpeed = u.speed;
    }

    assert.equal(motorAnimationController.getSpeed(), 0.0);
    assert.equal(motorAnimationController.update(offState).isRotating, false);
  });

  test('motor stops immediately when simulation becomes STALE', () => {
    // Start running
    const runState = calculateMotorOperatingState({
      simulationResult: solvedCircuit1,
      simulationStatus: 'SOLVED',
      simulationSignature: solvedCircuit1.circuit_signature,
      currentCircuitSignature: solvedCircuit1.circuit_signature,
      switchState: 'ON'
    });
    motorAnimationController.update(runState);
    assert.ok(motorAnimationController.getSpeed() > 0);

    // Simulation becomes STALE
    const staleState = calculateMotorOperatingState({
      simulationResult: { ...solvedCircuit1, solver_status: 'STALE' },
      simulationStatus: 'STALE',
      simulationSignature: solvedCircuit1.circuit_signature,
      currentCircuitSignature: solvedCircuit1.circuit_signature,
      switchState: 'ON'
    });

    assert.equal(staleState.status, 'STOPPED');
    assert.equal(staleState.immediate_stop, true);

    const res = motorAnimationController.update(staleState);
    assert.equal(res.speed, 0.0, 'Motor must stop immediately on STALE without gradual spinning');
    assert.equal(res.isRotating, false);
  });

  test('motor stops immediately when simulation is ERROR, BLOCKED, or NOT_RUN', () => {
    ['ERROR', 'BLOCKED', 'NOT_RUN'].forEach(status => {
      motorAnimationController.reset();
      const state = calculateMotorOperatingState({
        simulationResult: { ...solvedCircuit1, solver_status: status },
        simulationStatus: status,
        switchState: 'ON'
      });
      assert.equal(state.status, 'STOPPED');
      assert.equal(state.immediate_stop, true);
      const res = motorAnimationController.update(state);
      assert.equal(res.speed, 0.0);
    });
  });

  test('motor speed changes when motor power changes', () => {
    // Full power (230 V RMS source)
    const normalState = calculateMotorOperatingState({
      simulationResult: solvedCircuit1,
      simulationStatus: 'SOLVED',
      switchState: 'ON'
    });

    // Lower power (reduced supply voltage e.g. 115 V RMS)
    const lowPowerSol = solveAcCircuitTemplate('CIRCUIT_1_SERIES_RLC_MOTOR', { source_vrms: 115.0 });
    const lowPowerState = calculateMotorOperatingState({
      simulationResult: lowPowerSol,
      simulationStatus: 'SOLVED',
      switchState: 'ON'
    });

    assert.ok(
      normalState.real_power_w > lowPowerState.real_power_w,
      `Normal power (${normalState.real_power_w} W) should exceed low power (${lowPowerState.real_power_w} W)`
    );
    assert.ok(
      normalState.visual_speed > lowPowerState.visual_speed,
      `Normal visual speed (${normalState.visual_speed}) should be higher than low power speed (${lowPowerState.visual_speed})`
    );
    assert.ok(
      normalState.simulated_rpm > lowPowerState.simulated_rpm,
      `Normal RPM (${normalState.simulated_rpm}) should be higher than low power RPM (${lowPowerState.simulated_rpm})`
    );
  });

  test('motor animation halts immediately when simulation signature mismatches circuit signature', () => {
    const mismatchedState = calculateMotorOperatingState({
      simulationResult: solvedCircuit1,
      simulationStatus: 'SOLVED',
      simulationSignature: 'AC_SIG_OLD_abc123',
      currentCircuitSignature: 'AC_SIG_NEW_xyz999',
      switchState: 'ON'
    });

    assert.equal(mismatchedState.immediate_stop, true);
    assert.equal(mismatchedState.status, 'STOPPED');
    const update = motorAnimationController.update(mismatchedState);
    assert.equal(update.speed, 0.0);
    assert.equal(update.isRotating, false);
  });

  test('AR and 3D use the exact same motor state and continuous angle', () => {
    const motorState = calculateMotorOperatingState({
      simulationResult: solvedCircuit1,
      simulationStatus: 'SOLVED',
      switchState: 'ON'
    });

    // Step in 3D Digital Twin
    const step3D = motorAnimationController.update(motorState);
    const angleAfter3D = motorAnimationController.getAngle();
    assert.equal(step3D.angle, angleAfter3D);

    // Switch to AR View and read next frame
    const stepAR = motorAnimationController.update(motorState);
    const angleAfterAR = motorAnimationController.getAngle();

    // The angle must advance smoothly from the 3D angle without reset
    assert.ok(angleAfterAR >= angleAfter3D);
    assert.equal(solvedCircuit1.motor.id, 'MOTOR');
    assert.equal(solvedCircuit1.motor.visual_speed_label, 'SIMULATED RPM');
    assert.notEqual(solvedCircuit1.motor.visual_speed_label, 'MEASURED RPM');
  });
});
