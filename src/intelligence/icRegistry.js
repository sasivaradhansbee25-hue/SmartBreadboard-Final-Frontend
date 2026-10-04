/**
 * SmartBreadboard 3D — Frontend Integrated Circuit (IC) Registry (Phase 28)
 * Mirrors backend verified IC models, pin mappings, operational limits, and scientific models.
 */

export const IC_REGISTRY = {
  LM741: {
    icId: "LM741",
    manufacturerPart: "LM741CN / UA741",
    displayName: "LM741 General Purpose Op-Amp",
    package: "DIP-8",
    channels: 1,
    modelType: "LINEAR_OPAMP",
    pinout: {
      "1": "OFFSET_NULL_1",
      "2": "IN_NEG",
      "3": "IN_POS",
      "4": "V_MINUS",
      "5": "OFFSET_NULL_2",
      "6": "OUTPUT",
      "7": "V_PLUS",
      "8": "NC"
    },
    defaultPins: {
      nonInverting: "3",
      inverting: "2",
      output: "6",
      vPlus: "7",
      vMinus: "4"
    },
    electricalSpecs: {
      openLoopGain: 200000.0,
      inputResistanceOhms: 2.0e6,
      outputResistanceOhms: 75.0,
      gbwpHz: 1.0e6,
      minSupplyV: 5.0,
      maxSupplyV: 18.0,
      outputHeadroomV: 1.5
    },
    limitations: "Idealized linear model with finite gain & bandwidth. Unmodeled: slew rate (0.5V/μs), input offset (1mV), thermal drift."
  },
  LM358: {
    icId: "LM358",
    manufacturerPart: "LM358N / LM358P",
    displayName: "LM358 Dual Low-Power Op-Amp",
    package: "DIP-8",
    channels: 2,
    modelType: "LINEAR_OPAMP",
    pinout: {
      "1": "OUTPUT_A",
      "2": "IN_NEG_A",
      "3": "IN_POS_A",
      "4": "V_MINUS",
      "5": "IN_POS_B",
      "6": "IN_NEG_B",
      "7": "OUTPUT_B",
      "8": "V_PLUS"
    },
    defaultPins: {
      nonInverting: "3",
      inverting: "2",
      output: "1",
      vPlus: "8",
      vMinus: "4"
    },
    electricalSpecs: {
      openLoopGain: 100000.0,
      inputResistanceOhms: 1.0e7,
      outputResistanceOhms: 100.0,
      gbwpHz: 1.0e6,
      minSupplyV: 3.0,
      maxSupplyV: 32.0,
      outputHeadroomV: 1.2
    },
    limitations: "Linear small-signal model. Unmodeled: crossover distortion in Class-AB stage, output swing limited near V+."
  },
  TL072: {
    icId: "TL072",
    manufacturerPart: "TL072CP / TL072IP",
    displayName: "TL072 Dual JFET-Input Low-Noise Op-Amp",
    package: "DIP-8",
    channels: 2,
    modelType: "LINEAR_OPAMP",
    pinout: {
      "1": "OUTPUT_A",
      "2": "IN_NEG_A",
      "3": "IN_POS_A",
      "4": "V_MINUS",
      "5": "IN_POS_B",
      "6": "IN_NEG_B",
      "7": "OUTPUT_B",
      "8": "V_PLUS"
    },
    defaultPins: {
      nonInverting: "3",
      inverting: "2",
      output: "1",
      vPlus: "8",
      vMinus: "4"
    },
    electricalSpecs: {
      openLoopGain: 200000.0,
      inputResistanceOhms: 1.0e12,
      outputResistanceOhms: 50.0,
      gbwpHz: 3.0e6,
      minSupplyV: 6.0,
      maxSupplyV: 18.0,
      outputHeadroomV: 1.5
    },
    limitations: "JFET-input linear model. Unmodeled: phase reversal when input exceeds common-mode limit."
  },
  NE5532: {
    icId: "NE5532",
    manufacturerPart: "NE5532P / SA5532",
    displayName: "NE5532 Dual Audio Operational Amplifier",
    package: "DIP-8",
    channels: 2,
    modelType: "LINEAR_OPAMP",
    pinout: {
      "1": "OUTPUT_A",
      "2": "IN_NEG_A",
      "3": "IN_POS_A",
      "4": "V_MINUS",
      "5": "IN_POS_B",
      "6": "IN_NEG_B",
      "7": "OUTPUT_B",
      "8": "V_PLUS"
    },
    defaultPins: {
      nonInverting: "3",
      inverting: "2",
      output: "1",
      vPlus: "8",
      vMinus: "4"
    },
    electricalSpecs: {
      openLoopGain: 100000.0,
      inputResistanceOhms: 3.0e5,
      outputResistanceOhms: 30.0,
      gbwpHz: 1.0e7,
      minSupplyV: 5.0,
      maxSupplyV: 22.0,
      outputHeadroomV: 1.5
    },
    limitations: "High-speed bipolar model. Unmodeled: input bias currents (200nA), slew rate (9V/μs)."
  },
  OP07: {
    icId: "OP07",
    manufacturerPart: "OP07CP / OP07EP",
    displayName: "OP07 Ultra-Low Offset Precision Op-Amp",
    package: "DIP-8",
    channels: 1,
    modelType: "LINEAR_OPAMP",
    pinout: {
      "1": "VOS_TRIM_1",
      "2": "IN_NEG",
      "3": "IN_POS",
      "4": "V_MINUS",
      "5": "NC",
      "6": "OUTPUT",
      "7": "V_PLUS",
      "8": "VOS_TRIM_2"
    },
    defaultPins: {
      nonInverting: "3",
      inverting: "2",
      output: "6",
      vPlus: "7",
      vMinus: "4"
    },
    electricalSpecs: {
      openLoopGain: 500000.0,
      inputResistanceOhms: 3.0e7,
      outputResistanceOhms: 60.0,
      gbwpHz: 6.0e5,
      minSupplyV: 3.0,
      maxSupplyV: 18.0,
      outputHeadroomV: 1.0
    },
    limitations: "Precision DC linear model. Low bandwidth (600 kHz GBWP)."
  },
  IDEAL_OPAMP: {
    icId: "IDEAL_OPAMP",
    manufacturerPart: "IDEAL_LINEAR_OPAMP",
    displayName: "Ideal Linear Operational Amplifier",
    package: "GENERIC",
    channels: 1,
    modelType: "IDEAL_OPAMP",
    pinout: {
      "+": "IN_POS",
      "-": "IN_NEG",
      "OUT": "OUTPUT",
      "V+": "V_PLUS",
      "V-": "V_MINUS"
    },
    defaultPins: {
      nonInverting: "IN_POS",
      inverting: "IN_NEG",
      output: "OUTPUT",
      vPlus: "V_PLUS",
      vMinus: "V_MINUS"
    },
    electricalSpecs: {
      openLoopGain: 1.0e6,
      inputResistanceOhms: 1.0e9,
      outputResistanceOhms: 0.001,
      gbwpHz: 1.0e8,
      minSupplyV: 0.0,
      maxSupplyV: 50.0,
      outputHeadroomV: 0.0
    },
    limitations: "Idealized linear model (infinite input impedance, zero output impedance, high open-loop gain)."
  }
};

/**
 * Retrieves IC definition by model name.
 */
export function getIcDefinition(partName) {
  if (!partName) return null;
  const cleaned = String(partName).toUpperCase().trim().replace(/[-_ ]/g, "");
  for (const [key, defn] of Object.entries(IC_REGISTRY)) {
    if (cleaned.includes(key) || key.includes(cleaned)) return defn;
    const partClean = defn.manufacturerPart.toUpperCase().replace(/[-_ ]/g, "");
    if (cleaned.includes(partClean) || partClean.includes(cleaned)) return defn;
  }
  if (cleaned.includes("OPAMP") || cleaned.includes("OP_AMP") || cleaned.includes("AMP")) {
    return IC_REGISTRY.IDEAL_OPAMP;
  }
  return null;
}

/**
 * Resolves op-amp terminals from component dictionary.
 */
export function resolveOpampTerminals(compDict) {
  const ctype = String(compDict.type || compDict.class || "").toLowerCase();
  const partName = compDict.model || compDict.part_number || compDict.part_name || compDict.value || "IDEAL_OPAMP";
  
  let icDef = getIcDefinition(partName);
  if (!icDef && ctype.includes("opamp")) {
    icDef = IC_REGISTRY.IDEAL_OPAMP;
  }

  if (!icDef) {
    return {
      success: false,
      status: "UNKNOWN_IC",
      error: `IC '${partName}' is not recognized in the verified IC registry.`,
      terminals: null
    };
  }

  const pins = compDict.pins || {};
  const terminals = compDict.terminals || {};
  const props = compDict.properties || {};

  function findNode(...keys) {
    for (const k of keys) {
      if (compDict[k]) return String(compDict[k]);
      if (typeof pins === 'object' && pins[k]) return String(pins[k]);
      if (typeof terminals === 'object' && terminals[k]) return String(terminals[k]);
      if (typeof props === 'object' && props[k]) return String(props[k]);
    }
    return null;
  }

  const inPos = findNode("non_inverting_node", "node_in_pos", "in_pos", "v_pos", "plus", "non_inverting", "pin3", "3", "pin_3");
  const inNeg = findNode("inverting_node", "node_in_neg", "in_neg", "v_neg", "minus", "inverting", "pin2", "2", "pin_2");
  const outNode = findNode("output_node", "node_out", "out", "output", "pin6", "6", "pin_6", "pin1", "1", "pin_1");
  const vPlus = findNode("vcc_node", "v_plus", "vcc", "vdd", "pos_supply", "pin7", "7", "pin_7", "pin8", "8", "pin_8");
  const vMinus = findNode("vee_node", "v_minus", "vee", "vss", "neg_supply", "gnd_node", "pin4", "4", "pin_4");

  const isValid = Boolean(inPos && inNeg && outNode);

  return {
    success: isValid,
    status: isValid ? "VERIFIED_PIN_MAPPING" : "INVALID_PIN_MAPPING",
    icDefinition: icDef,
    terminals: {
      in_pos: inPos,
      in_neg: inNeg,
      output: outNode,
      v_plus: vPlus,
      v_minus: vMinus
    },
    missingPins: [
      !inPos && "non_inverting (+)",
      !inNeg && "inverting (-)",
      !outNode && "output"
    ].filter(Boolean)
  };
}

export default {
  IC_REGISTRY,
  getIcDefinition,
  resolveOpampTerminals
};
