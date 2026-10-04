// SmartBreadboard 3D — Built-in Demo Circuits Data
// Provides offline-capable demo circuits for DC & Transient electrical analysis testing.

export const demoCircuits = [
  {
    id: "demo_dc_led",
    name: "DC LED & Resistor Circuit",
    description: "5V DC supply, R1 = 1 kΩ current limiting resistor, Red LED1, and R2 = 330 Ω",
    source: "demo",
    power_supply: {
      voltage: 5.0,
      current_limit: 0.5,
      positive_node: "NODE_PWR",
      negative_node: "NODE_GND"
    },
    nodes: [
      { id: "NODE_PWR", label: "VCC (+5V)", voltage: 5.0, type: "power" },
      { id: "N1", label: "R1-LED Junction", voltage: 3.0, type: "internal" },
      { id: "N2", label: "LED-R2 Junction", voltage: 1.0, type: "internal" },
      { id: "NODE_GND", label: "Ground (0V)", voltage: 0.0, type: "ground" }
    ],
    components: [
      {
        id: "R1",
        designator: "R1",
        type: "resistor",
        class: "resistor",
        value: 1000,
        unit: "Ω",
        detected_value: "1 kΩ",
        formatted_value: "1.00 kΩ",
        valueSource: "ocr",
        confidence: 0.95,
        hole1: "E10",
        hole2: "E15",
        node1: "NODE_PWR",
        node2: "N1"
      },
      {
        id: "LED1",
        designator: "LED1",
        type: "led",
        class: "led",
        value: "Red LED",
        unit: "color",
        detected_value: "Red LED",
        formatted_value: "Red LED (2.0V Forward)",
        valueSource: "detected",
        confidence: 0.98,
        hole1: "E15",
        hole2: "E20",
        node1: "N1",
        node2: "N2"
      },
      {
        id: "R2",
        designator: "R2",
        type: "resistor",
        class: "resistor",
        value: 330,
        unit: "Ω",
        detected_value: "330 Ω",
        formatted_value: "330.00 Ω",
        valueSource: "ocr",
        confidence: 0.92,
        hole1: "E20",
        hole2: "E25",
        node1: "N2",
        node2: "NODE_GND"
      },
      {
        id: "W1",
        designator: "W1",
        type: "wire",
        class: "wire",
        value: "jumper",
        unit: "wire",
        detected_value: "Wire",
        formatted_value: "Jumper Wire",
        valueSource: "detected",
        confidence: 0.99,
        hole1: "A10",
        hole2: "E10",
        node1: "NODE_PWR",
        node2: "NODE_PWR"
      }
    ]
  },
  {
    id: "demo_rlc_transient",
    name: "RLC Transient Circuit",
    description: "12V DC step input, R1 = 1 kΩ, C1 = 100 µF, and L1 = 10 mH transient response circuit",
    source: "demo",
    power_supply: {
      voltage: 12.0,
      current_limit: 1.0,
      positive_node: "NODE_PWR",
      negative_node: "NODE_GND"
    },
    nodes: [
      { id: "NODE_PWR", label: "VCC (+12V)", voltage: 12.0, type: "power" },
      { id: "N1", label: "R1-C1 Junction", voltage: 12.0, type: "internal" },
      { id: "N2", label: "C1-L1 Junction", voltage: 12.0, type: "internal" },
      { id: "NODE_GND", label: "Ground (0V)", voltage: 0.0, type: "ground" }
    ],
    components: [
      {
        id: "R1",
        designator: "R1",
        type: "resistor",
        class: "resistor",
        value: 1000,
        unit: "Ω",
        detected_value: "1 kΩ",
        formatted_value: "1.00 kΩ",
        valueSource: "detected",
        confidence: 0.94,
        hole1: "E5",
        hole2: "E12",
        node1: "NODE_PWR",
        node2: "N1"
      },
      {
        id: "C1",
        designator: "C1",
        type: "capacitor",
        class: "capacitor",
        value: 0.0001,
        unit: "F",
        detected_value: "100 µF",
        formatted_value: "100.00 µF",
        valueSource: "user_override",
        confidence: 0.90,
        hole1: "E12",
        hole2: "E18",
        node1: "N1",
        node2: "N2"
      },
      {
        id: "L1",
        designator: "L1",
        type: "inductor",
        class: "inductor",
        value: 0.01,
        unit: "H",
        detected_value: "10 mH",
        formatted_value: "10.00 mH",
        valueSource: "user_required",
        confidence: 0.88,
        hole1: "E18",
        hole2: "E24",
        node1: "N2",
        node2: "NODE_GND"
      }
    ]
  }
];
