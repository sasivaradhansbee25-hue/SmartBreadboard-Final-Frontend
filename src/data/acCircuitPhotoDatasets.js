/**
 * src/data/acCircuitPhotoDatasets.js
 * Reference datasets for the 3 canonical AC benchmark circuit photographs.
 * Contains exact detected bounding boxes, centers, terminals, and physical wire paths.
 */

export const AC_CIRCUIT_PHOTO_DATASETS = {
  CIRCUIT_1_SERIES_RLC_MOTOR: {
    template_id: 'CIRCUIT_1_SERIES_RLC_MOTOR',
    name: 'Series AC RLC Motor Circuit',
    image_url: '/circuits/circuit_1_real_photo.jpg',
    image_width: 1280,
    image_height: 720,
    is_breadboard: false,
    components: [
      {
        id: 'AC_SOURCE',
        designator: 'AC_SOURCE',
        type: 'ac_source',
        bbox: [80, 260, 210, 460],
        center: [145, 360],
        terminals: [
          { terminal: 'terminal_L', pixel: [185, 350] },
          { terminal: 'terminal_N', pixel: [185, 415] }
        ],
        confidence: 0.99,
        status: 'VERIFIED'
      },
      {
        id: 'R1',
        designator: 'R1',
        type: 'resistor',
        value: 10,
        unit: 'Ω',
        displayValue: '10 Ω',
        bbox: [291, 324, 429, 376],
        center: [360, 350],
        orientation: 'horizontal',
        terminals: [
          { terminal: 'terminal_A', pixel: [293, 350] },
          { terminal: 'terminal_B', pixel: [427, 350] }
        ],
        confidence: 0.98,
        status: 'VERIFIED'
      },
      {
        id: 'L1',
        designator: 'L1',
        type: 'inductor',
        value: 100,
        unit: 'mH',
        displayValue: '100 mH',
        bbox: [502, 308, 618, 392],
        center: [560, 350],
        orientation: 'horizontal',
        terminals: [
          { terminal: 'terminal_A', pixel: [504, 350] },
          { terminal: 'terminal_B', pixel: [616, 350] }
        ],
        confidence: 0.98,
        status: 'VERIFIED'
      },
      {
        id: 'C1',
        designator: 'C1',
        type: 'capacitor',
        value: 100,
        unit: 'μF',
        displayValue: '100 μF',
        bbox: [703, 274, 797, 426],
        center: [750, 350],
        orientation: 'vertical',
        terminals: [
          { terminal: 'terminal_A', pixel: [732, 278] },
          { terminal: 'terminal_B', pixel: [768, 278] }
        ],
        confidence: 0.98,
        status: 'VERIFIED'
      },
      {
        id: 'MOTOR',
        designator: 'MOTOR',
        type: 'motor',
        value: 0.75,
        unit: 'HP',
        displayValue: '0.75 HP AC Induction Motor',
        bbox: [915, 232, 1125, 433],
        center: [1020, 342],
        orientation: 'horizontal',
        terminals: [
          { terminal: 'terminal_L', pixel: [965, 242] },
          { terminal: 'terminal_N', pixel: [995, 242] }
        ],
        confidence: 0.99,
        status: 'VERIFIED'
      }
    ],
    circuit_path: [
      // AC L to R1
      [185, 350], [220, 370], [255, 375], [293, 350],
      // R1 lead
      [360, 350], [427, 350],
      // R1 to L1
      [460, 375], [504, 350],
      // L1 lead
      [560, 350], [616, 350],
      // L1 to C1
      [655, 340], [700, 310], [732, 278],
      // C1 through to terminal B
      [768, 278],
      // C1 to Motor L
      [820, 270], [900, 255], [965, 242],
      // Motor
      [1020, 342], [995, 242],
      // Neutral Return Path back to AC Source N
      [1000, 480], [850, 560], [600, 580], [350, 540], [185, 415]
    ]
  },

  CIRCUIT_2_PROTECTED_RLC_MOTOR: {
    template_id: 'CIRCUIT_2_PROTECTED_RLC_MOTOR',
    name: 'Protected AC RLC Motor Circuit with Shunt C2',
    image_url: '/circuits/circuit_2_real_photo.jpg',
    image_width: 1280,
    image_height: 720,
    is_breadboard: false,
    components: [
      {
        id: 'AC_SOURCE',
        designator: 'AC_SOURCE',
        type: 'ac_source',
        bbox: [70, 260, 200, 460],
        center: [135, 360],
        terminals: [
          { terminal: 'terminal_L', pixel: [175, 350] },
          { terminal: 'terminal_N', pixel: [175, 415] }
        ],
        confidence: 0.99,
        status: 'VERIFIED'
      },
      {
        id: 'F1',
        designator: 'F1',
        type: 'fuse',
        value: 5,
        unit: 'A',
        displayValue: '5 A Fuse',
        bbox: [212, 326, 308, 386],
        center: [260, 350],
        orientation: 'horizontal',
        terminals: [
          { terminal: 'terminal_A', pixel: [215, 350] },
          { terminal: 'terminal_B', pixel: [305, 350] }
        ],
        confidence: 0.98,
        status: 'VERIFIED'
      },
      {
        id: 'S1',
        designator: 'S1',
        type: 'switch',
        value: 1,
        unit: 'state',
        displayValue: 'SWITCH ON',
        bbox: [337, 305, 423, 395],
        center: [380, 350],
        orientation: 'horizontal',
        terminals: [
          { terminal: 'terminal_A', pixel: [340, 350] },
          { terminal: 'terminal_B', pixel: [420, 350] }
        ],
        confidence: 0.98,
        status: 'VERIFIED'
      },
      {
        id: 'C2',
        designator: 'C2',
        type: 'capacitor',
        value: 47,
        unit: 'μF',
        displayValue: '47 μF (Shunt PF)',
        bbox: [473, 104, 567, 256],
        center: [520, 180],
        orientation: 'vertical',
        terminals: [
          { terminal: 'terminal_A', pixel: [502, 108] },
          { terminal: 'terminal_B', pixel: [538, 108] }
        ],
        confidence: 0.97,
        status: 'VERIFIED'
      },
      {
        id: 'R1',
        designator: 'R1',
        type: 'resistor',
        value: 10,
        unit: 'Ω',
        displayValue: '10 Ω',
        bbox: [471, 324, 609, 376],
        center: [540, 350],
        orientation: 'horizontal',
        terminals: [
          { terminal: 'terminal_A', pixel: [473, 350] },
          { terminal: 'terminal_B', pixel: [607, 350] }
        ],
        confidence: 0.98,
        status: 'VERIFIED'
      },
      {
        id: 'L1',
        designator: 'L1',
        type: 'inductor',
        value: 100,
        unit: 'mH',
        displayValue: '100 mH',
        bbox: [652, 308, 768, 392],
        center: [710, 350],
        orientation: 'horizontal',
        terminals: [
          { terminal: 'terminal_A', pixel: [654, 350] },
          { terminal: 'terminal_B', pixel: [766, 350] }
        ],
        confidence: 0.98,
        status: 'VERIFIED'
      },
      {
        id: 'C1',
        designator: 'C1',
        type: 'capacitor',
        value: 100,
        unit: 'μF',
        displayValue: '100 μF',
        bbox: [823, 274, 917, 426],
        center: [870, 350],
        orientation: 'vertical',
        terminals: [
          { terminal: 'terminal_A', pixel: [852, 278] },
          { terminal: 'terminal_B', pixel: [888, 278] }
        ],
        confidence: 0.98,
        status: 'VERIFIED'
      },
      {
        id: 'MOTOR',
        designator: 'MOTOR',
        type: 'motor',
        value: 0.75,
        unit: 'HP',
        displayValue: '0.75 HP AC Induction Motor',
        bbox: [965, 232, 1175, 433],
        center: [1070, 342],
        orientation: 'horizontal',
        terminals: [
          { terminal: 'terminal_L', pixel: [1015, 242] },
          { terminal: 'terminal_N', pixel: [1045, 242] }
        ],
        confidence: 0.99,
        status: 'VERIFIED'
      }
    ],
    circuit_path: [
      [175, 350], [215, 350], [305, 350], [340, 350], [420, 350],
      [473, 350], [607, 350], [654, 350], [766, 350],
      [852, 278], [888, 278], [1015, 242], [1070, 342], [1045, 242],
      [1040, 500], [800, 570], [500, 580], [300, 540], [175, 415]
    ]
  },

  CIRCUIT_3_SERIES_PARALLEL_COMPENSATION: {
    template_id: 'CIRCUIT_3_SERIES_PARALLEL_COMPENSATION',
    name: 'Series-Parallel Compensated AC Motor Circuit (A1/V1)',
    image_url: '/circuits/circuit_3_real_photo.jpg',
    image_width: 1280,
    image_height: 720,
    is_breadboard: false,
    components: [
      {
        id: 'AC_SOURCE',
        designator: 'AC_SOURCE',
        type: 'ac_source',
        bbox: [60, 260, 190, 460],
        center: [125, 360],
        terminals: [
          { terminal: 'terminal_L', pixel: [165, 350] },
          { terminal: 'terminal_N', pixel: [165, 415] }
        ],
        confidence: 0.99,
        status: 'VERIFIED'
      },
      {
        id: 'F1',
        designator: 'F1',
        type: 'fuse',
        value: 5,
        unit: 'A',
        displayValue: '5 A Fuse',
        bbox: [182, 326, 278, 386],
        center: [230, 350],
        orientation: 'horizontal',
        terminals: [
          { terminal: 'terminal_A', pixel: [185, 350] },
          { terminal: 'terminal_B', pixel: [275, 350] }
        ],
        confidence: 0.98,
        status: 'VERIFIED'
      },
      {
        id: 'S1',
        designator: 'S1',
        type: 'switch',
        value: 1,
        unit: 'state',
        displayValue: 'SWITCH ON',
        bbox: [297, 305, 383, 395],
        center: [340, 350],
        orientation: 'horizontal',
        terminals: [
          { terminal: 'terminal_A', pixel: [300, 350] },
          { terminal: 'terminal_B', pixel: [380, 350] }
        ],
        confidence: 0.98,
        status: 'VERIFIED'
      },
      {
        id: 'A1',
        designator: 'A1',
        type: 'ammeter',
        value: 0,
        unit: 'A',
        displayValue: 'Line Ammeter A1',
        bbox: [405, 295, 515, 405],
        center: [460, 350],
        orientation: 'horizontal',
        terminals: [
          { terminal: 'terminal_A', pixel: [407, 350] },
          { terminal: 'terminal_B', pixel: [513, 350] }
        ],
        confidence: 0.99,
        status: 'VERIFIED'
      },
      {
        id: 'R2',
        designator: 'R2',
        type: 'resistor',
        value: 220,
        unit: 'Ω',
        displayValue: '220 Ω (Damping)',
        bbox: [521, 134, 659, 186],
        center: [590, 160],
        orientation: 'horizontal',
        terminals: [
          { terminal: 'terminal_A', pixel: [523, 160] },
          { terminal: 'terminal_B', pixel: [657, 160] }
        ],
        confidence: 0.97,
        status: 'VERIFIED'
      },
      {
        id: 'C2',
        designator: 'C2',
        type: 'capacitor',
        value: 1,
        unit: 'μF',
        displayValue: '1 μF (Compensation)',
        bbox: [663, 84, 757, 236],
        center: [710, 160],
        orientation: 'vertical',
        terminals: [
          { terminal: 'terminal_A', pixel: [692, 88] },
          { terminal: 'terminal_B', pixel: [728, 88] }
        ],
        confidence: 0.97,
        status: 'VERIFIED'
      },
      {
        id: 'R1',
        designator: 'R1',
        type: 'resistor',
        value: 10,
        unit: 'Ω',
        displayValue: '10 Ω',
        bbox: [541, 324, 679, 376],
        center: [610, 350],
        orientation: 'horizontal',
        terminals: [
          { terminal: 'terminal_A', pixel: [543, 350] },
          { terminal: 'terminal_B', pixel: [677, 350] }
        ],
        confidence: 0.98,
        status: 'VERIFIED'
      },
      {
        id: 'L1',
        designator: 'L1',
        type: 'inductor',
        value: 100,
        unit: 'mH',
        displayValue: '100 mH',
        bbox: [702, 308, 818, 392],
        center: [760, 350],
        orientation: 'horizontal',
        terminals: [
          { terminal: 'terminal_A', pixel: [704, 350] },
          { terminal: 'terminal_B', pixel: [816, 350] }
        ],
        confidence: 0.98,
        status: 'VERIFIED'
      },
      {
        id: 'C1',
        designator: 'C1',
        type: 'capacitor',
        value: 100,
        unit: 'μF',
        displayValue: '100 μF',
        bbox: [853, 274, 947, 426],
        center: [900, 350],
        orientation: 'vertical',
        terminals: [
          { terminal: 'terminal_A', pixel: [882, 278] },
          { terminal: 'terminal_B', pixel: [918, 278] }
        ],
        confidence: 0.98,
        status: 'VERIFIED'
      },
      {
        id: 'MOTOR',
        designator: 'MOTOR',
        type: 'motor',
        value: 0.75,
        unit: 'HP',
        displayValue: '0.75 HP AC Induction Motor',
        bbox: [995, 232, 1205, 433],
        center: [1100, 342],
        orientation: 'horizontal',
        terminals: [
          { terminal: 'terminal_L', pixel: [1045, 242] },
          { terminal: 'terminal_N', pixel: [1075, 242] }
        ],
        confidence: 0.99,
        status: 'VERIFIED'
      },
      {
        id: 'V1',
        designator: 'V1',
        type: 'voltmeter',
        value: 0,
        unit: 'V',
        displayValue: 'Voltmeter V1',
        bbox: [1025, 95, 1135, 205],
        center: [1080, 150],
        orientation: 'horizontal',
        terminals: [
          { terminal: 'terminal_A', pixel: [1027, 150] },
          { terminal: 'terminal_B', pixel: [1133, 150] }
        ],
        confidence: 0.99,
        status: 'VERIFIED'
      }
    ],
    circuit_path: [
      [165, 350], [185, 350], [275, 350], [300, 350], [380, 350], [407, 350], [513, 350],
      [543, 350], [677, 350], [704, 350], [816, 350],
      [882, 278], [918, 278], [1045, 242], [1100, 342], [1075, 242],
      [1080, 520], [800, 580], [500, 590], [300, 550], [165, 415]
    ]
  }
};

/**
 * Returns photo metadata and detected components for a template ID.
 */
export function getAcCircuitPhotoData(templateId) {
  return AC_CIRCUIT_PHOTO_DATASETS[templateId] || AC_CIRCUIT_PHOTO_DATASETS.CIRCUIT_1_SERIES_RLC_MOTOR;
}
