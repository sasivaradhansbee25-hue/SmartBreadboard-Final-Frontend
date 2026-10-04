/**
 * SmartBreadboard 3D
 * Breadboard Hole ID -> Three.js 3D Coordinate
 *
 * Supports:
 *   Main holes : A-J
 *   Power rails: VCC_TOP, GND_TOP, VCC_BOT, GND_BOT
 *
 * Example:
 *   A22
 *   E22
 *   F15
 *   VCC_TOP_10
 *   GND_BOT_15
 */

// ============================================================
// BREADBOARD GEOMETRY
// ============================================================

const GRID_START_X = -12.4;
const GRID_STEP_X = 0.40;

// Y position of component/hole
const GRID_Y = 0.61;

// Z position of each breadboard row
const ROW_Z_MAP = {
  VCC_TOP: -4.2,
  GND_TOP: -3.8,

  A: -2.8,
  B: -2.3,
  C: -1.8,
  D: -1.3,
  E: -0.8,

  // Centre gap
  F: 0.8,
  G: 1.3,
  H: 1.8,
  I: 2.3,
  J: 2.8,

  VCC_BOT: 4.2,
  GND_BOT: 3.8
};

// ============================================================
// LIMITS
// ============================================================

const MIN_X = -12.4;
const MAX_X = 12.4;

// ============================================================
// HELPER
// ============================================================

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// ============================================================
// MAIN FUNCTION
// ============================================================

/**
 * Convert breadboard hole ID into 3D coordinate.
 *
 * Examples:
 *   A22
 *   E22
 *   F22
 *   VCC_TOP_10
 *   GND_BOT_15
 *
 * @param {string} holeId
 * @returns {{x:number, y:number, z:number}}
 */
export function holeTo3DPos(holeId) {

  // Invalid input
  if (!holeId || typeof holeId !== 'string') {
    return {
      x: 0,
      y: GRID_Y,
      z: 0
    };
  }

  const cleanHole = holeId.trim().toUpperCase();

  // ==========================================================
  // 1. POWER RAIL
  // ==========================================================

  const railMatch = cleanHole.match(
    /^(VCC_TOP|GND_TOP|VCC_BOT|GND_BOT)(?:_(\d+))?$/
  );

  if (railMatch) {

    const railType = railMatch[1];

    // If column is not provided, use column 1
    const colIdx = parseInt(railMatch[2] || '1', 10);

    const x =
      GRID_START_X +
      (colIdx - 1) * 0.48;

    const z = ROW_Z_MAP[railType];

    return {
      x: clamp(x, MIN_X, MAX_X),
      y: GRID_Y,
      z
    };
  }

  // ==========================================================
  // 2. MAIN BREADBOARD GRID
  // ==========================================================

  const mainMatch = cleanHole.match(
    /^([A-J])(\d+)$/
  );

  if (mainMatch) {

    const rowLetter = mainMatch[1];

    const colIdx = parseInt(
      mainMatch[2],
      10
    );

    // Prevent invalid column
    if (colIdx < 1) {
      return {
        x: 0,
        y: GRID_Y,
        z: ROW_Z_MAP[rowLetter]
      };
    }

    const x =
      GRID_START_X +
      (colIdx - 1) * GRID_STEP_X;

    const z =
      ROW_Z_MAP[rowLetter];

    return {
      x: clamp(x, MIN_X, MAX_X),
      y: GRID_Y,
      z
    };
  }

  // ==========================================================
  // 3. INVALID HOLE
  // ==========================================================

  console.warn(
    `[Breadboard3DCoords] Unknown hole ID: ${holeId}`
  );

  return {
    x: 0,
    y: GRID_Y,
    z: 0
  };
}

// ============================================================
// COMPONENT POSITION HELPER
// ============================================================

/**
 * Get 3D position for a component using its holes.
 *
 * Example:
 *   getComponent3DPosition("E22", "E26")
 *
 * Returns the midpoint between the two holes.
 */
export function getComponent3DPosition(
  hole1,
  hole2
) {

  const p1 = holeTo3DPos(hole1);
  const p2 = holeTo3DPos(hole2);

  return {
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2,
    z: (p1.z + p2.z) / 2
  };
}

// ============================================================
// COMPONENT ROTATION HELPER
// ============================================================

/**
 * Calculate rotation around Y axis based on
 * two connected breadboard holes.
 */
export function getComponentRotation(
  hole1,
  hole2
) {

  const p1 = holeTo3DPos(hole1);
  const p2 = holeTo3DPos(hole2);

  const dx = p2.x - p1.x;
  const dz = p2.z - p1.z;

  return Math.atan2(dz, dx);
}

// ============================================================
// DEBUG HELPER
// ============================================================

/**
 * Debug a hole position in console.
 */
export function debugHolePosition(holeId) {

  const position = holeTo3DPos(holeId);

  console.log(
    `[Breadboard3DCoords] ${holeId}`,
    position
  );

  return position;
}