/**
 * SmartBreadboard 3D — Dedicated Motor Animation Controller
 *
 * Single Source of Truth for AC induction motor simulation and visualization.
 * Drives both 3D Digital Twin (Three.js) and AR View (Canvas/Webcam overlay).
 *
 * Deterministic visual motor-speed mapping:
 *   visualMotorSpeed = clamp(baseSpeed × motorPowerFactor × normalizedMotorPower, minSpeed, maxSpeed)
 *
 * Rules:
 * - SOLVED + ON + valid power: rotor/shaft rotates continuously, status RUNNING
 * - SWITCH OFF: rotor smoothly decelerates to 0, status STOPPED
 * - STALE / ERROR / BLOCKED / NOT_RUN: motor immediately stops
 * - Signature mismatch: motor immediately stops
 * - Label visual speed as "SIMULATED RPM", NEVER "MEASURED RPM"
 */

export const MOTOR_DEFAULTS = {
  RATED_POWER_W: 750.0,
  BASE_SPEED_RPM: 3000, // 2-pole 50 Hz synchronous speed
  FULL_LOAD_RPM: 2850,
  MIN_VISUAL_SPEED: 0.04,
  MAX_VISUAL_SPEED: 0.35,
  BASE_VISUAL_SPEED: 0.22,
  DECELERATION_FACTOR: 0.92,
  ACCELERATION_FACTOR: 0.08
};

/**
 * Calculates the deterministic motor operating state from solved simulation results.
 *
 * @param {object} params
 * @param {object} params.simulationResult - Solved AC simulation payload
 * @param {string} [params.simulationStatus] - 'SOLVED' | 'NOT_RUN' | 'STALE' | 'ERROR' | 'BLOCKED'
 * @param {string} [params.simulationSignature] - Signature of the active simulation
 * @param {string} [params.currentCircuitSignature] - Signature of the current circuit parameters
 * @param {string} [params.switchState] - 'ON' | 'OFF'
 * @returns {object} Deterministic motor state object
 */
export function calculateMotorOperatingState({
  simulationResult,
  simulationStatus = 'SOLVED',
  simulationSignature = null,
  currentCircuitSignature = null,
  switchState = 'ON'
}) {
  const solverStatus = simulationResult?.solver_status || simulationStatus || 'NOT_RUN';
  const isSolved = solverStatus === 'SOLVED';
  const isStale = solverStatus === 'STALE';
  const isError = solverStatus === 'ERROR';
  const isBlocked = solverStatus === 'BLOCKED';
  const isNotRun = solverStatus === 'NOT_RUN';

  // Signature validation: must match current circuit signature to avoid stale execution
  const simSig = simulationSignature || simulationResult?.circuit_signature || simulationResult?.simulation_signature;
  const curSig = currentCircuitSignature || simulationResult?.circuit_signature;
  const isSignatureValid = (!simSig || !curSig || simSig === curSig);

  // Protection / switch state
  const effectiveSwitch = switchState || simulationResult?.protection_status?.switch_state || 'ON';
  const isSwitchOn = effectiveSwitch !== 'OFF';
  const isFuseBlown = Boolean(simulationResult?.protection_status?.fuse_blown);

  // Extract electrical values for the motor from single source of truth
  const compList = simulationResult?.components;
  let motorComp = null;
  if (Array.isArray(compList)) {
    motorComp = compList.find(c => (c.id === 'MOTOR' || c.designator === 'MOTOR' || c.type === 'motor'));
  } else if (compList && typeof compList === 'object') {
    motorComp = compList.MOTOR || compList.motor;
  }

  const pAnalysis = simulationResult?.power_analysis || {};
  const freqHz = Number(pAnalysis.frequency_hz || 50.0);
  const vRms = Number(motorComp?.voltage ?? simulationResult?.motor?.voltage_rms ?? simulationResult?.motor?.voltage_v ?? simulationResult?.test_points?.TP5?.voltage_rms ?? 0);
  const iRms = Number(motorComp?.current ?? simulationResult?.motor?.current_rms ?? simulationResult?.motor?.current_a ?? pAnalysis.current_rms ?? 0);
  const pRealW = Number(motorComp?.power ?? motorComp?.real_power_w ?? simulationResult?.motor?.real_power_w ?? simulationResult?.motor?.power_w ?? 0);
  const pf = Number(motorComp?.power_factor ?? simulationResult?.motor?.power_factor ?? pAnalysis.power_factor ?? 0.78);

  const ratedPowerW = Number(MOTOR_DEFAULTS.RATED_POWER_W);
  const normalizedPower = Math.min(1.5, Math.max(0.1, pRealW / ratedPowerW));
  const baseSpeedRpm = (120 * freqHz) / 2; // 3000 RPM at 50Hz, 3600 at 60Hz
  const fullLoadRpm = baseSpeedRpm * 0.95; // 2850 RPM

  // Conditions for valid operating power
  const isDirectRunning = simulationResult?.motor?.status === 'RUNNING' || simulationResult?.motor?.is_running === true;
  const hasValidPower = (vRms > 1.0 && iRms > 0.001 && pRealW > 0.1) || isDirectRunning;

  // Immediate stop triggers: STALE, ERROR, BLOCKED, NOT_RUN, signature mismatch, fuse blown
  const immediateStop = isStale || isError || isBlocked || isNotRun || !isSolved || !isSignatureValid || isFuseBlown;

  // Decelerate triggers: switch turned OFF while solved
  const isSwitchOff = isSolved && !isSwitchOn && !immediateStop;

  const isRunning = isSolved && isSwitchOn && hasValidPower && !immediateStop;

  // Visual motor-speed mapping: clamp(baseSpeed * PF * normalizedPower, minSpeed, maxSpeed)
  let targetVisualSpeed = 0.0;
  let simulatedRpm = 0;

  if (isRunning) {
    const rawVisualSpeed = simulationResult?.motor?.visual_speed || (MOTOR_DEFAULTS.BASE_VISUAL_SPEED * pf * normalizedPower);
    targetVisualSpeed = Math.min(
      MOTOR_DEFAULTS.MAX_VISUAL_SPEED,
      Math.max(MOTOR_DEFAULTS.MIN_VISUAL_SPEED, rawVisualSpeed)
    );

    // Realistic slip calculation: simulated RPM
    simulatedRpm = simulationResult?.motor?.simulated_rpm || Math.round(
      Math.min(
        baseSpeedRpm,
        Math.max(300, fullLoadRpm * pf * Math.min(1.0, normalizedPower))
      )
    );
  }

  return {
    id: 'MOTOR',
    designator: 'MOTOR',
    status: isRunning ? 'RUNNING' : 'STOPPED',
    operating_state: isRunning ? 'RUNNING' : (isSwitchOff ? 'DECELERATING' : 'STOPPED'),
    is_running: isRunning,
    is_rotating: isRunning,
    voltage_rms: vRms,
    current_rms: iRms,
    real_power_w: pRealW,
    power_factor: pf,
    frequency_hz: freqHz,
    simulated_rpm: simulatedRpm,
    visual_speed: targetVisualSpeed,
    visual_speed_label: 'SIMULATED RPM',
    switch_state: isSwitchOn ? 'ON' : 'OFF',
    fuse_blown: isFuseBlown,
    immediate_stop: immediateStop,
    decelerate: isSwitchOff,
    circuit_signature: simSig || 'UNKNOWN'
  };
}

/**
 * Singleton Motor Animation Controller
 * Maintains continuous, unbroken rotor angle across view switches (3D Digital Twin <-> AR View).
 */
export class MotorAnimationControllerClass {
  constructor() {
    this.currentAngle = 0.0;
    this.currentSpeed = 0.0;
    this.lastTimestamp = null;
  }

  /**
   * Updates motor rotation based on current simulation state and delta time.
   *
   * @param {object} motorState - Output from calculateMotorOperatingState
   * @returns {{ angle: number, speed: number, isRotating: boolean }}
   */
  update(motorState) {
    if (!motorState) {
      this.currentSpeed = 0.0;
      return { angle: this.currentAngle, speed: 0.0, isRotating: false };
    }

    if (motorState.immediate_stop) {
      // Immediate stop: STALE, ERROR, BLOCKED, NOT_RUN, signature mismatch
      this.currentSpeed = 0.0;
    } else if (motorState.is_running) {
      // Accelerate / approach target deterministic visual speed
      const target = (typeof motorState.visual_speed === 'number' && !isNaN(motorState.visual_speed))
        ? motorState.visual_speed
        : MOTOR_DEFAULTS.BASE_VISUAL_SPEED;
      this.currentSpeed += (target - this.currentSpeed) * MOTOR_DEFAULTS.ACCELERATION_FACTOR;
      this.currentAngle = (this.currentAngle + this.currentSpeed) % (Math.PI * 2);
    } else if (motorState.decelerate) {
      // Smooth deceleration: switch OFF
      this.currentSpeed *= MOTOR_DEFAULTS.DECELERATION_FACTOR;
      if (this.currentSpeed < 0.001) {
        this.currentSpeed = 0.0;
      } else {
        this.currentAngle = (this.currentAngle + this.currentSpeed) % (Math.PI * 2);
      }
    } else {
      this.currentSpeed = 0.0;
    }

    return {
      angle: this.currentAngle,
      speed: this.currentSpeed,
      isRotating: this.currentSpeed > 0.001
    };
  }

  getAngle() {
    return this.currentAngle;
  }

  getSpeed() {
    return this.currentSpeed;
  }

  reset() {
    this.currentAngle = 0.0;
    this.currentSpeed = 0.0;
  }
}

export const motorAnimationController = new MotorAnimationControllerClass();

/**
 * Draws the high-fidelity 3D-styled AC Motor overlay in AR camera view.
 * Aligned with the detected physical component position and lead axis.
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
 * @param {object} comp - Motor component object
 * @param {object} anchor - Transformed anchor screen coordinates { anchorScreen, t1Screen, t2Screen }
 * @param {object} motorState - Solved motor operating state
 * @param {number} rotationAngle - Continuous rotation angle from motorAnimationController
 */
export function drawArMotorOverlay(ctx, comp, anchor, motorState, rotationAngle = 0, isStale = false) {
  if (!ctx || !anchor || !anchor.anchorScreen) return;

  const { anchorScreen, labelScreen, t1Screen, t2Screen } = anchor;
  const cx = anchorScreen.x;
  const cy = anchorScreen.y;

  const isRunning = !isStale && motorState?.is_running && motorState?.status === 'RUNNING';
  const simulatedRpm = isStale ? 0 : (motorState?.simulated_rpm || 0);
  const vRms = motorState?.voltage_rms ?? 230.0;
  const freq = motorState?.frequency_hz ?? 50.0;
  const iRms = motorState?.current_rms ?? 0.0;
  const pReal = motorState?.real_power_w ?? 0.0;
  const pf = motorState?.power_factor ?? 0.78;

  // 1. SUBTLE ROTATING AR HOLOGRAPHIC RING & SHAFT DIRECTION INDICATOR
  // Anchored directly over the detected physical motor rotor / shaft
  // Real physical motor in the uploaded photo remains 100% visible!
  ctx.save();
  ctx.translate(cx, cy);

  const ringRadius = 26;
  const themeColor = isStale ? '#f59e0b' : (isRunning ? '#34d399' : '#64748b');

  // Outer Holographic Reticle Ring
  ctx.beginPath();
  ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
  ctx.strokeStyle = isRunning ? 'rgba(52, 211, 153, 0.45)' : 'rgba(100, 116, 139, 0.3)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);
  ctx.stroke();

  // Rotating Segmented Tick Marks (Driven by simulation rotationAngle)
  ctx.save();
  ctx.rotate(isRunning ? rotationAngle : 0);

  // 4 Directional Reticle Pointers
  for (let i = 0; i < 4; i++) {
    ctx.rotate((Math.PI * 2) / 4);
    ctx.beginPath();
    ctx.moveTo(ringRadius - 5, 0);
    ctx.lineTo(ringRadius + 5, 0);
    ctx.strokeStyle = themeColor;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([]);
    ctx.stroke();

    if (isRunning) {
      ctx.beginPath();
      ctx.moveTo(ringRadius + 5, 0);
      ctx.lineTo(ringRadius + 2, -3);
      ctx.lineTo(ringRadius + 2, 3);
      ctx.closePath();
      ctx.fillStyle = themeColor;
      ctx.fill();
    }
  }

  // Central Shaft Crosshair / Reticle
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.strokeStyle = isRunning ? '#38bdf8' : '#94a3b8';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([]);
  ctx.stroke();

  // Center Shaft Direction Indicator Line
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -12);
  ctx.strokeStyle = isRunning ? '#38bdf8' : '#cbd5e1';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.restore(); // Restore from rotationAngle

  // Operational Glow Aura
  if (isRunning) {
    ctx.beginPath();
    ctx.arc(0, 0, ringRadius + 4, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#34d399';
    ctx.shadowBlur = 10;
    ctx.stroke();
  }

  ctx.restore(); // Restore from motor center translation

  // 2. TRANSPARENT AR HUD BADGE
  // Positioned adjacent to the motor (labelScreen) so the
  // physical motor in the uploaded photo remains completely visible!
  const hudW = 195;
  const hudH = 92;
  const hudX = labelScreen ? labelScreen.x - hudW / 2 : cx + 40;
  const hudY = labelScreen ? labelScreen.y - hudH / 2 : cy - 80;

  ctx.save();
  ctx.fillStyle = isStale
    ? 'rgba(30, 20, 10, 0.88)'
    : (isRunning ? 'rgba(8, 18, 36, 0.88)' : 'rgba(15, 23, 42, 0.85)');
  ctx.strokeStyle = isStale ? '#f59e0b' : (isRunning ? '#34d399' : '#475569');
  ctx.lineWidth = isRunning ? 1.8 : 1.2;

  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(hudX, hudY, hudW, hudH, 6);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.fillRect(hudX, hudY, hudW, hudH);
    ctx.strokeRect(hudX, hudY, hudW, hudH);
  }

  // Connective line from HUD to shaft anchor
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(hudX + hudW / 2, hudY + hudH);
  ctx.strokeStyle = isRunning ? 'rgba(52, 211, 153, 0.45)' : 'rgba(100, 116, 139, 0.35)';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.stroke();
  ctx.setLineDash([]);

  // Line 1: Header + Running State
  ctx.font = 'bold 11px Inter, system-ui, sans-serif';
  ctx.fillStyle = '#38bdf8';
  ctx.fillText('MOTOR', hudX + 10, hudY + 16);

  ctx.font = 'bold 10px Inter, system-ui, sans-serif';
  if (isStale) {
    ctx.fillStyle = '#f59e0b';
    ctx.fillText('⚠ OUTDATED', hudX + hudW - 82, hudY + 16);
  } else {
    ctx.fillStyle = isRunning ? '#34d399' : '#f87171';
    ctx.fillText(isRunning ? '● RUNNING' : '○ STOPPED', hudX + hudW - 74, hudY + 16);
  }

  // Line 2: 230 V RMS • 50 Hz
  ctx.font = '10px Inter, system-ui, sans-serif';
  ctx.fillStyle = '#f8fafc';
  ctx.fillText(`${vRms.toFixed(1)} V RMS  •  ${freq.toFixed(0)} Hz`, hudX + 10, hudY + 34);

  // Line 3: I = XX A • P = XX W
  ctx.font = '10px Inter, system-ui, sans-serif';
  ctx.fillStyle = '#cbd5e1';
  ctx.fillText(
    `I = ${iRms.toFixed(2)} A   P = ${pReal >= 1000 ? `${(pReal / 1000).toFixed(2)} kW` : `${pReal.toFixed(1)} W`}`,
    hudX + 10,
    hudY + 52
  );

  // Line 4: PF = XX
  ctx.fillText(`PF = ${pf.toFixed(2)} (${pf >= 0 ? 'Lagging' : 'Leading'})`, hudX + 10, hudY + 68);

  // Line 5: SIMULATED RPM: XXXX (Strictly from simulationResult)
  ctx.font = 'bold 10px Inter, monospace';
  ctx.fillStyle = isRunning ? '#fbbf24' : '#94a3b8';
  ctx.fillText(`SIMULATED RPM: ${simulatedRpm}`, hudX + 10, hudY + 84);

  ctx.restore();
}