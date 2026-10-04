// Centralized Mock Circuit Dataset for SmartBreadboard 3D
// Adheres strictly to AGENTS.md Rule 1 ("source": "mock"), Rule 5 (separated detected_value vs user_override_value), and SPEC.md §14 (5 required sample circuits)

export const MOCK_SOURCE_TAG = 'mock';

export const mockCircuits = [
  // Circuit 1: 5V -> R1 -> LED -> GND (single branch)
  {
    id: 'circ-001',
    name: '1. 5V -> R1 -> LED -> GND (Single Branch)',
    source: MOCK_SOURCE_TAG,
    timestamp: '2026-08-30 14:22:10',
    thumbnail: 'https://images.unsplash.com/photo-1555680202-c86f0e12f086?w=500&auto=format&fit=crop&q=60',
    description: 'Basic DC single-branch circuit with 5V source, 220Ω current-limiting resistor, and red LED.',
    power_supply: { voltage: 5.0, current_limit: 0.5 },
    components: [
      {
        id: 'comp-1',
        designator: 'R1',
        type: 'Resistor',
        detected_value: '220 Ω',
        user_override_value: '220 Ω',
        tolerance: '±5%',
        color_bands: ['red', 'red', 'brown', 'gold'],
        pins: ['A15', 'F15'],
        node_a: 'NODE_PWR',
        node_b: 'NODE_LED_ANODE',
        status: 'ok'
      },
      {
        id: 'comp-2',
        designator: 'D1',
        type: 'LED (Red)',
        detected_value: '2.0V Forward Drop',
        user_override_value: '2.0V Forward Drop',
        tolerance: 'N/A',
        color_bands: [],
        pins: ['G15', 'G18'],
        node_a: 'NODE_LED_ANODE',
        node_b: 'NODE_GND',
        status: 'ok'
      }
    ],
    nodes: [
      { id: 'NODE_PWR', label: 'VCC (+5V)', voltage: 5.0, type: 'power' },
      { id: 'NODE_LED_ANODE', label: 'R1-D1 Junction', voltage: 2.0, type: 'internal' },
      { id: 'NODE_GND', label: 'Ground (0V)', voltage: 0.0, type: 'ground' }
    ],
    readings: {
      total_current_mA: 13.6,
      resistor_power_mW: 40.8,
      led_power_mW: 27.2,
      status: 'NORMAL'
    }
  },

  // Circuit 2: Two Resistors in Series (R1 + R2)
  {
    id: 'circ-002',
    name: '2. Two Resistors in Series (R1 + R2)',
    source: MOCK_SOURCE_TAG,
    timestamp: '2026-08-30 15:10:00',
    thumbnail: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=500&auto=format&fit=crop&q=60',
    description: 'Series resistor divider combining 1kΩ and 2.2kΩ in series (Req = 3.2kΩ).',
    power_supply: { voltage: 9.0, current_limit: 0.5 },
    components: [
      {
        id: 'comp-201',
        designator: 'R1',
        type: 'Resistor',
        detected_value: '1 kΩ',
        user_override_value: '1 kΩ',
        tolerance: '±5%',
        color_bands: ['brown', 'black', 'red', 'gold'],
        pins: ['A10', 'E10'],
        node_a: 'NODE_9V',
        node_b: 'NODE_MID',
        status: 'ok'
      },
      {
        id: 'comp-202',
        designator: 'R2',
        type: 'Resistor',
        detected_value: '2.2 kΩ',
        user_override_value: '2.2 kΩ',
        tolerance: '±5%',
        color_bands: ['red', 'red', 'red', 'gold'],
        pins: ['F10', 'J10'],
        node_a: 'NODE_MID',
        node_b: 'NODE_GND',
        status: 'ok'
      }
    ],
    nodes: [
      { id: 'NODE_9V', label: 'VCC (+9V)', voltage: 9.0, type: 'power' },
      { id: 'NODE_MID', label: 'Series Midpoint', voltage: 6.18, type: 'internal' },
      { id: 'NODE_GND', label: 'Ground (0V)', voltage: 0.0, type: 'ground' }
    ],
    readings: {
      total_current_mA: 2.81,
      resistor_power_mW: 25.3,
      status: 'NORMAL'
    }
  },

  // Circuit 3: Two Resistors in Parallel (R1 || R2)
  {
    id: 'circ-003',
    name: '3. Two Resistors in Parallel (R1 ∥ R2)',
    source: MOCK_SOURCE_TAG,
    timestamp: '2026-08-30 15:45:30',
    thumbnail: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=500&auto=format&fit=crop&q=60',
    description: 'Parallel resistor network with two 10kΩ resistors in parallel (Req = 5kΩ).',
    power_supply: { voltage: 5.0, current_limit: 0.2 },
    components: [
      {
        id: 'comp-301',
        designator: 'R1',
        type: 'Resistor',
        detected_value: '10 kΩ',
        user_override_value: '10 kΩ',
        tolerance: '±5%',
        color_bands: ['brown', 'black', 'orange', 'gold'],
        pins: ['B20', 'E20'],
        node_a: 'NODE_5V',
        node_b: 'NODE_GND',
        status: 'ok'
      },
      {
        id: 'comp-302',
        designator: 'R2',
        type: 'Resistor',
        detected_value: '10 kΩ',
        user_override_value: '10 kΩ',
        tolerance: '±5%',
        color_bands: ['brown', 'black', 'orange', 'gold'],
        pins: ['F20', 'I20'],
        node_a: 'NODE_5V',
        node_b: 'NODE_GND',
        status: 'ok'
      }
    ],
    nodes: [
      { id: 'NODE_5V', label: 'VCC (+5V)', voltage: 5.0, type: 'power' },
      { id: 'NODE_GND', label: 'Ground (0V)', voltage: 0.0, type: 'ground' }
    ],
    readings: {
      total_current_mA: 1.0,
      resistor_power_mW: 5.0,
      status: 'NORMAL'
    }
  },

  // Circuit 4: Mixed Resistor Network (Bridge/Multi-Branch Topology)
  {
    id: 'circ-004',
    name: '4. Mixed Resistor Network (Multi-Branch Bridge)',
    source: MOCK_SOURCE_TAG,
    timestamp: '2026-08-30 16:30:15',
    thumbnail: 'https://images.unsplash.com/photo-1555680202-c86f0e12f086?w=500&auto=format&fit=crop&q=60',
    description: 'Complex multi-branch bridge topology (R1 in series with R2 ∥ R3) proving general MNA solver capability.',
    power_supply: { voltage: 12.0, current_limit: 0.5 },
    components: [
      {
        id: 'comp-401',
        designator: 'R1',
        type: 'Resistor',
        detected_value: '1 kΩ',
        user_override_value: '1 kΩ',
        tolerance: '±5%',
        color_bands: ['brown', 'black', 'red', 'gold'],
        pins: ['A25', 'E25'],
        node_a: 'NODE_12V',
        node_b: 'NODE_BRIDGE',
        status: 'ok'
      },
      {
        id: 'comp-402',
        designator: 'R2',
        type: 'Resistor',
        detected_value: '2.2 kΩ',
        user_override_value: '2.2 kΩ',
        tolerance: '±5%',
        color_bands: ['red', 'red', 'red', 'gold'],
        pins: ['F25', 'I25'],
        node_a: 'NODE_BRIDGE',
        node_b: 'NODE_GND',
        status: 'ok'
      },
      {
        id: 'comp-403',
        designator: 'R3',
        type: 'Resistor',
        detected_value: '4.7 kΩ',
        user_override_value: '4.7 kΩ',
        tolerance: '±5%',
        color_bands: ['yellow', 'violet', 'red', 'gold'],
        pins: ['F26', 'I26'],
        node_a: 'NODE_BRIDGE',
        node_b: 'NODE_GND',
        status: 'ok'
      }
    ],
    nodes: [
      { id: 'NODE_12V', label: 'VCC (+12V)', voltage: 12.0, type: 'power' },
      { id: 'NODE_BRIDGE', label: 'Bridge Node', voltage: 7.18, type: 'internal' },
      { id: 'NODE_GND', label: 'Ground (0V)', voltage: 0.0, type: 'ground' }
    ],
    readings: {
      total_current_mA: 4.82,
      resistor_power_mW: 57.8,
      status: 'NORMAL'
    }
  },

  // Circuit 5: Resistors + Capacitors Combined (RC Filter)
  {
    id: 'circ-005',
    name: '5. Resistors + Capacitors Combined (RC Filter)',
    source: MOCK_SOURCE_TAG,
    timestamp: '2026-08-30 16:50:12',
    thumbnail: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=500&auto=format&fit=crop&q=60',
    description: 'Analog low-pass filter combining 4.7kΩ resistor and 100nF ceramic capacitor (fc = 338.6 Hz).',
    power_supply: { voltage: 5.0, current_limit: 0.1 },
    components: [
      {
        id: 'comp-501',
        designator: 'R1',
        type: 'Resistor',
        detected_value: '4.7 kΩ',
        user_override_value: '4.7 kΩ',
        tolerance: '±5%',
        color_bands: ['yellow', 'violet', 'red', 'gold'],
        pins: ['C30', 'F30'],
        node_a: 'NODE_IN',
        node_b: 'NODE_OUT',
        status: 'ok'
      },
      {
        id: 'comp-502',
        designator: 'C1',
        type: 'Capacitor (Ceramic)',
        detected_value: '100 nF (Code 104)',
        user_override_value: '100 nF (Code 104)',
        tolerance: '±10%',
        color_bands: [],
        pins: ['G30', 'J30'],
        node_a: 'NODE_OUT',
        node_b: 'NODE_GND',
        status: 'ok'
      }
    ],
    nodes: [
      { id: 'NODE_IN', label: 'Signal Input (5V)', voltage: 5.0, type: 'input' },
      { id: 'NODE_OUT', label: 'Filtered Output (fc = 338.6Hz)', voltage: 3.53, type: 'output' },
      { id: 'NODE_GND', label: 'Ground (0V)', voltage: 0.0, type: 'ground' }
    ],
    readings: {
      total_current_mA: 0.31,
      cutoff_frequency_Hz: 338.6,
      status: 'STABLE'
    }
  }
];
