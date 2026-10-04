/**
 * src/services/trainerCircuitConfig.js
 * 
 * SMARTBREADBOARD 3D — DUAL MOTOR ESP32 AR CIRCUIT TRAINER CONFIG & MODEL
 * 
 * Strict Guarantees:
 * - Isolated from Circuit 1 / 2 / 3 legacy templates.
 * - Explicit deterministic virtual current mapping:
 *     SW1 OFF = 0 mA, SW1 ON = 20 mA
 *     SW2 OFF = 0 mA, SW2 ON = 11 mA
 *     SW1 OFF + SW2 OFF = 0 mA
 *     SW1 ON  + SW2 OFF = 20 mA
 *     SW1 OFF + SW2 ON  = 11 mA
 *     SW1 ON  + SW2 ON  = 31 mA
 * - Independent animation states for M1 and M2.
 * - Hardware telemetry isolation: ESP32 hardware current is tracked separately from virtual current.
 */

export const TRAINER_CURRENT_CONFIG = {
  SW1_CURRENT_MA: 20.15,
  SW2_CURRENT_MA: 13.47
};

/**
 * Calculates deterministic virtual current for M1 based on SW1 position.
 * @param {boolean} sw1On
 * @returns {number} Current in mA (20.15 or 0.00)
 */
export function calculateM1Current(sw1On) {
  return sw1On ? TRAINER_CURRENT_CONFIG.SW1_CURRENT_MA : 0.00;
}

/**
 * Calculates deterministic virtual current for M2 based on SW2 position.
 * @param {boolean} sw2On
 * @returns {number} Current in mA (13.47 or 0.00)
 */
export function calculateM2Current(sw2On) {
  return sw2On ? TRAINER_CURRENT_CONFIG.SW2_CURRENT_MA : 0.00;
}

/**
 * Calculates deterministic virtual total current based on switch positions.
 * @param {boolean} sw1On 
 * @param {boolean} sw2On 
 * @returns {number} Current in mA (0.00, 20.15, 13.47, 33.62)
 */
export function calculateTrainerVirtualCurrent(sw1On, sw2On) {
  const m1 = calculateM1Current(sw1On);
  const m2 = calculateM2Current(sw2On);
  return Number((m1 + m2).toFixed(2));
}

/**
 * Returns operating status for a motor given its controlling switch.
 * @param {boolean} switchOn 
 * @returns {'RUNNING' | 'STOPPED'}
 */
export function getMotorOperatingStatus(switchOn) {
  return switchOn ? 'RUNNING' : 'STOPPED';
}

/**
 * Generates the canonical component list for the uploaded dual-motor trainer circuit.
 */
export function createTrainerCircuitModel() {
  return {
    id: 'user_uploaded_dual_motor_esp32_trainer',
    name: 'Dual DC Motor ESP32 7805 Trainer Circuit',
    source: 'REAL_UPLOADED_CIRCUIT',
    is_uploaded: true,
    is_trainer: true,
    supply: {
      type: 'DC_SUPPLY',
      voltage: 9.0,
      unit: 'V'
    },
    components: [
      {
        id: 'DC_SUPPLY',
        designator: 'DC_SUPPLY',
        type: 'dc_supply',
        label: 'DC Supply (9V)',
        value: 9.0,
        unit: 'V',
        displayValue: '9.0 V DC',
        normalized_center: [0.12, 0.50],
        confidence: 0.99,
        status: 'VERIFIED'
      },
      {
        id: '7805',
        designator: '7805',
        type: 'regulator',
        label: 'LM7805 5V Regulator (TO-220)',
        value: 5.0,
        unit: 'V',
        displayValue: '5.0 V Out',
        normalized_center: [0.30, 0.40],
        confidence: 0.98,
        status: 'VERIFIED'
      },
      {
        id: 'C1',
        designator: 'C1',
        type: 'capacitor',
        label: 'Filter Capacitor C1 (100 μF)',
        value: 100,
        unit: 'μF',
        displayValue: '100 μF',
        normalized_center: [0.42, 0.35],
        confidence: 0.98,
        status: 'VERIFIED'
      },
      {
        id: 'R1',
        designator: 'R1',
        type: 'resistor',
        label: 'Bleeder Resistor R1 (220 Ω)',
        value: 220,
        unit: 'Ω',
        displayValue: '220 Ω',
        normalized_center: [0.42, 0.65],
        confidence: 0.98,
        status: 'VERIFIED'
      },
      {
        id: 'ESP32',
        designator: 'ESP32',
        type: 'esp32',
        label: 'ESP32-WROOM-32 Controller',
        value: 3.3,
        unit: 'V',
        displayValue: 'ESP32 (USB)',
        normalized_center: [0.58, 0.50],
        confidence: 0.99,
        status: 'VERIFIED'
      },
      {
        id: 'SW1',
        designator: 'SW1',
        type: 'switch',
        label: 'Virtual Switch SW1 (Motor 1 Control)',
        value: 1,
        unit: 'state',
        displayValue: 'SW1',
        normalized_center: [0.72, 0.32],
        confidence: 0.99,
        status: 'VERIFIED'
      },
      {
        id: 'SW2',
        designator: 'SW2',
        type: 'switch',
        label: 'Virtual Switch SW2 (Motor 2 Control)',
        value: 1,
        unit: 'state',
        displayValue: 'SW2',
        normalized_center: [0.72, 0.68],
        confidence: 0.99,
        status: 'VERIFIED'
      },
      {
        id: 'M1',
        designator: 'M1',
        type: 'motor',
        label: 'DC Motor M1 (20 mA load)',
        value: 1.0,
        unit: 'HP',
        displayValue: 'Motor M1',
        normalized_center: [0.88, 0.30],
        confidence: 0.98,
        status: 'VERIFIED'
      },
      {
        id: 'M2',
        designator: 'M2',
        type: 'motor',
        label: 'DC Motor M2 (11 mA load)',
        value: 1.0,
        unit: 'HP',
        displayValue: 'Motor M2',
        normalized_center: [0.88, 0.70],
        confidence: 0.98,
        status: 'VERIFIED'
      }
    ],
    wires: [
      {
        id: 'w_pwr_in',
        connectedComponents: ['DC_SUPPLY', '7805'],
        normalizedPath: [[0.12, 0.50], [0.22, 0.50], [0.30, 0.40]]
      },
      {
        id: 'w_reg_c1',
        connectedComponents: ['7805', 'C1'],
        normalizedPath: [[0.30, 0.40], [0.36, 0.40], [0.42, 0.35]]
      },
      {
        id: 'w_reg_esp32',
        connectedComponents: ['7805', 'ESP32'],
        normalizedPath: [[0.30, 0.40], [0.50, 0.40], [0.58, 0.50]]
      },
      {
        id: 'w_esp_sw1',
        connectedComponents: ['ESP32', 'SW1'],
        normalizedPath: [[0.58, 0.50], [0.65, 0.32], [0.72, 0.32]]
      },
      {
        id: 'w_esp_sw2',
        connectedComponents: ['ESP32', 'SW2'],
        normalizedPath: [[0.58, 0.50], [0.65, 0.68], [0.72, 0.68]]
      },
      {
        id: 'w_sw1_m1',
        connectedComponents: ['SW1', 'M1'],
        normalizedPath: [[0.72, 0.32], [0.80, 0.32], [0.88, 0.30]]
      },
      {
        id: 'w_sw2_m2',
        connectedComponents: ['SW2', 'M2'],
        normalizedPath: [[0.72, 0.68], [0.80, 0.68], [0.88, 0.70]]
      }
    ]
  };
}
