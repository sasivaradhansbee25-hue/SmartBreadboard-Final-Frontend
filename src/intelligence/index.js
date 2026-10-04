/**
 * SmartBreadboard 3D — Circuit Intelligence & AR Learning Engine (Phase 25)
 *
 * Master Orchestrator:
 * Physical Circuit State / Netlist
 *       ↓
 * Topology Classification Pipeline
 *       ↓
 * Circuit Verification & Gate
 *       ↓
 * Electrical Behaviour Model (Theoretical & MNA)
 *       ↓
 * Visualization State Engine (Decoupled Visual Instructions)
 *       ↓
 * Educational Explanation Generator
 */

import { circuitRegistry, CIRCUIT_CATEGORIES, VERIFICATION_STATES, VISUALIZATION_TYPES } from './circuitKnowledgeRegistry.js';
import { classifyCircuitTopology } from './topologyClassifier.js';
import { calculateCircuitBehaviour } from './electricalBehaviourModel.js';
import { generateVisualizationState } from './visualizationStateEngine.js';
import { generateEducationalExplanation } from './educationalExplanationGenerator.js';
import {
  normalizeTransientResponse,
  extractClientTransientMetrics,
  TRANSIENT_CIRCUIT_TYPES,
  DAMPING_TYPES
} from './transientAnalysisEngine.js';

export {
  circuitRegistry,
  CIRCUIT_CATEGORIES,
  VERIFICATION_STATES,
  VISUALIZATION_TYPES,
  classifyCircuitTopology,
  calculateCircuitBehaviour,
  generateVisualizationState,
  generateEducationalExplanation,
  normalizeTransientResponse,
  extractClientTransientMetrics,
  TRANSIENT_CIRCUIT_TYPES,
  DAMPING_TYPES
};


/**
 * Main Master Analysis Function.
 * Accepts active circuit netlist and simulation results, returns comprehensive intelligence package.
 */
export function analyzeCircuitIntelligence(netlist, simulationResult = null, userOverrides = {}) {
  if (!netlist) {
    return {
      classification: {
        circuitType: 'UNKNOWN',
        displayName: 'Empty Circuit',
        verificationState: VERIFICATION_STATES.NOT_VERIFIED,
        confidence: 0,
        topologyStatus: 'EMPTY'
      },
      electricalBehaviour: { status: 'UNAVAILABLE', parameters: {}, waveforms: [] },
      visualizationState: generateVisualizationState(null, null, null),
      explanation: null,
      timestamp: new Date().toISOString()
    };
  }

  // 1. Classification & Topology Verification
  const classification = classifyCircuitTopology(netlist, simulationResult);

  // 2. Deterministic Electrical Behaviour Calculation
  const electricalBehaviour = calculateCircuitBehaviour(classification, netlist, simulationResult);

  // 3. Declarative Visualization State Generation
  const visualizationState = generateVisualizationState(classification, electricalBehaviour, netlist);

  // 4. Pedagogical Explanation Synthesis
  const explanation = generateEducationalExplanation(classification, electricalBehaviour);

  return {
    classification,
    electricalBehaviour,
    visualizationState,
    explanation,
    timestamp: new Date().toISOString()
  };
}

export default analyzeCircuitIntelligence;
