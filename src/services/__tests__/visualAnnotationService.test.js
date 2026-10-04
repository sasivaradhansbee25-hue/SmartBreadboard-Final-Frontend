/**
 * SmartBreadboard 3D — Visual Annotation Service Unit Tests (Phase 22.2)
 *
 * Verifies all 20 required behaviors for the visual annotation engine:
 * 1. Verified resistor annotation.
 * 2. Verified LED annotation.
 * 3. USER_CONFIRMED component.
 * 4. UNKNOWN component.
 * 5. AMBIGUOUS component.
 * 6. Rejected detection excluded.
 * 7. Terminal annotations.
 * 8. Hole annotations.
 * 9. Node annotations.
 * 10. Wire annotations.
 * 11. Missing wire endpoint not fabricated.
 * 12. Simulation SOLVED values.
 * 13. Simulation NOT_RUN hides values.
 * 14. Stale simulation hides values.
 * 15. Missing coordinates do not create fake positions.
 * 16. Component selection.
 * 17. Highlight by component ID.
 * 18. Signature mismatch handling.
 * 19. Debug mode.
 * 20. Normal mode.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateVisualAnnotations,
  resolveComponentPosition,
  formatComponentElectrical,
  DEFAULT_VISIBILITY
} from '../visualAnnotationService.js';

describe('Phase 22.2: Visual Annotation Service', () => {

  const baseGroundingState = {
    schema_version: '22.1',
    circuit_signature: 'sig_abc123',
    overall_status: 'VERIFIED',
    summary: { component_count: 2, verified_components: 2 },
    components: [
      {
        id: 'R1',
        type: 'resistor',
        value: 220,
        unit: 'Ω',
        display_value: '220 Ω',
        status: 'VERIFIED',
        source: 'ai',
        verified: true,
        image_geometry: {
          bbox: [100, 150, 200, 250],
          center: [150, 200]
        },
        terminals: {
          terminal_a: { name: 'terminal_a', hole: 'E10', status: 'VERIFIED', pixel: [100, 200], electrical_node: 'NODE_1' },
          terminal_b: { name: 'terminal_b', hole: 'E15', status: 'VERIFIED', pixel: [200, 200], electrical_node: 'NODE_2' }
        }
      },
      {
        id: 'LED1',
        type: 'led',
        value: null,
        unit: null,
        display_value: 'LED (Red)',
        status: 'VERIFIED',
        source: 'ai',
        verified: true,
        image_geometry: {
          bbox: [220, 150, 300, 250],
          center: [260, 200]
        },
        terminals: {
          terminal_a: { name: 'terminal_a', hole: 'E15', status: 'VERIFIED', pixel: [220, 200], electrical_node: 'NODE_2' },
          terminal_b: { name: 'terminal_b', hole: 'E20', status: 'VERIFIED', pixel: [300, 200], electrical_node: 'NODE_GND' }
        }
      }
    ],
    wires: [
      {
        id: 'W1',
        type: 'wire',
        start_hole: 'A10',
        end_hole: 'A20',
        status: 'VERIFIED',
        electrical_effect: 'MERGES_HOLE_A10_WITH_HOLE_A20'
      }
    ],
    canonical_holes: {
      'E10': { hole: 'E10', row: 'E', column: 10, pixel: [100, 200], electrical_node: 'NODE_1', status: 'VERIFIED' },
      'E15': { hole: 'E15', row: 'E', column: 15, pixel: [200, 200], electrical_node: 'NODE_2', status: 'VERIFIED' },
      'E20': { hole: 'E20', row: 'E', column: 20, pixel: [300, 200], electrical_node: 'NODE_GND', status: 'VERIFIED' },
      'A10': { hole: 'A10', row: 'A', column: 10, pixel: [100, 100], electrical_node: 'NODE_1', status: 'VERIFIED' },
      'A20': { hole: 'A20', row: 'A', column: 20, pixel: [300, 100], electrical_node: 'NODE_1', status: 'VERIFIED' },
      'J50': { hole: 'J50', row: 'J', column: 50, pixel: [600, 500], electrical_node: 'NODE_UNUSED', status: 'VERIFIED' }
    },
    nodes: [
      { id: 'NODE_1', members: ['R1.terminal_a'], holes: ['E10', 'A10'], status: 'VERIFIED', voltage_v: 5.0 },
      { id: 'NODE_2', members: ['R1.terminal_b', 'LED1.terminal_a'], holes: ['E15'], status: 'VERIFIED', voltage_v: 2.13 },
      { id: 'NODE_GND', members: ['LED1.terminal_b'], holes: ['E20'], status: 'VERIFIED', voltage_v: 0.0 }
    ],
    diagnostics: [],
    rejected_detections: [
      { id: 'det_rej_1', label: 'resistor', confidence: 0.15, reason: 'LOW_CONFIDENCE_FALSE_POSITIVE', bbox: [50, 50, 80, 80] }
    ],
    simulation: {
      status: 'SOLVED',
      source: 'MNA',
      voltages: { 'NODE_1': 5.0, 'NODE_2': 2.13, 'NODE_GND': 0.0 },
      currents: { 'R1': 0.01304, 'LED1': 0.01304 },
      powers: { 'R1': 0.03743, 'LED1': 0.02778 }
    }
  };

  // 1. Verified resistor annotation
  test('1. Verified resistor annotation creates accurate component structure', () => {
    const res = generateVisualAnnotations(baseGroundingState);
    const r1 = res.components.find(c => c.id === 'R1');
    assert.ok(r1, 'R1 component should be present');
    assert.equal(r1.status, 'VERIFIED');
    assert.equal(r1.componentType, 'resistor');
    assert.equal(r1.label, 'R1');
    assert.equal(r1.sublabel, '220 Ω');
    assert.deepEqual(r1.position, { x: 150, y: 200 });
  });

  // 2. Verified LED annotation
  test('2. Verified LED annotation contains correct status and type', () => {
    const res = generateVisualAnnotations(baseGroundingState);
    const led = res.components.find(c => c.id === 'LED1');
    assert.ok(led, 'LED1 should be present');
    assert.equal(led.componentType, 'led');
    assert.equal(led.status, 'VERIFIED');
    assert.deepEqual(led.position, { x: 260, y: 200 });
  });

  // 3. USER_CONFIRMED component
  test('3. USER_CONFIRMED component retains USER_CONFIRMED status', () => {
    const state = JSON.parse(JSON.stringify(baseGroundingState));
    state.components[0].status = 'USER_CONFIRMED';
    state.components[0].source = 'user_confirmed';
    const res = generateVisualAnnotations(state);
    const r1 = res.components.find(c => c.id === 'R1');
    assert.equal(r1.status, 'USER_CONFIRMED');
  });

  // 4. UNKNOWN component
  test('4. UNKNOWN component has UNKNOWN status and unknown sublabel', () => {
    const state = JSON.parse(JSON.stringify(baseGroundingState));
    state.components.push({
      id: 'U_COMP_1',
      type: 'unknown',
      value: null,
      unit: null,
      display_value: 'Unknown',
      status: 'UNKNOWN',
      verified: false,
      terminals: {
        terminal_a: { name: 'terminal_a', hole: null, status: 'UNKNOWN' },
        terminal_b: { name: 'terminal_b', hole: null, status: 'UNKNOWN' }
      }
    });
    const res = generateVisualAnnotations(state);
    const uComp = res.components.find(c => c.id === 'U_COMP_1');
    assert.ok(uComp);
    assert.equal(uComp.status, 'UNKNOWN');
    assert.equal(uComp.sublabel, 'Unknown');
  });

  // 5. AMBIGUOUS component
  test('5. AMBIGUOUS component has AMBIGUOUS status', () => {
    const state = JSON.parse(JSON.stringify(baseGroundingState));
    state.components[0].status = 'AMBIGUOUS';
    const res = generateVisualAnnotations(state);
    const r1 = res.components.find(c => c.id === 'R1');
    assert.equal(r1.status, 'AMBIGUOUS');
  });

  // 6. Rejected detection excluded
  test('6. Rejected detections are NEVER included in active components list', () => {
    const res = generateVisualAnnotations(baseGroundingState);
    const activeIds = res.components.map(c => c.id);
    assert.ok(!activeIds.includes('det_rej_1'), 'Rejected detection must not be in active components');
  });

  // 7. Terminal annotations
  test('7. Terminal annotations include terminal names, holes, and electrical nodes', () => {
    const res = generateVisualAnnotations(baseGroundingState);
    const r1TermA = res.terminals.find(t => t.id === 'R1.terminal_a');
    assert.ok(r1TermA);
    assert.equal(r1TermA.name, 'A');
    assert.equal(r1TermA.hole, 'E10');
    assert.equal(r1TermA.electrical_node, 'NODE_1');
    assert.deepEqual(r1TermA.position, { x: 100, y: 200 });
  });

  // 8. Hole annotations
  test('8. Hole annotations only include relevant holes in normal mode, all in debug mode', () => {
    const normalRes = generateVisualAnnotations(baseGroundingState, { debugMode: false, visibility: { holes: true, components: true, wires: true, terminals: true, nodes: true, diagnostics: true } });
    const debugRes = generateVisualAnnotations(baseGroundingState, { debugMode: true, visibility: { holes: true, components: true, wires: true, terminals: true, nodes: true, diagnostics: true } });

    const normalHoles = normalRes.holes.map(h => h.id);
    const debugHoles = debugRes.holes.map(h => h.id);

    assert.ok(normalHoles.includes('E10'));
    assert.ok(normalHoles.includes('E15'));
    assert.ok(normalHoles.includes('A10'));
    assert.ok(!normalHoles.includes('J50'), 'Unused hole J50 should not appear in normal mode');

    assert.ok(debugHoles.includes('J50'), 'All mapped holes should appear in debug mode');
  });

  // 9. Node annotations
  test('9. Node annotations originate from grounding state without fabricating names', () => {
    const res = generateVisualAnnotations(baseGroundingState);
    const nodeIds = res.nodes.map(n => n.id);
    assert.deepEqual(nodeIds, ['NODE_1', 'NODE_2', 'NODE_GND']);
  });

  // 10. Wire annotations
  test('10. Wire annotations contain verified start/end positions and status', () => {
    const res = generateVisualAnnotations(baseGroundingState);
    const w1 = res.wires.find(w => w.id === 'W1');
    assert.ok(w1);
    assert.equal(w1.status, 'VERIFIED');
    assert.equal(w1.isResolved, true);
    assert.deepEqual(w1.startPosition, { x: 100, y: 100 });
    assert.deepEqual(w1.endPosition, { x: 300, y: 100 });
  });

  // 11. Missing wire endpoint not fabricated
  test('11. Wire with missing hole coordinates does not fabricate coordinates', () => {
    const state = JSON.parse(JSON.stringify(baseGroundingState));
    state.wires.push({
      id: 'W_UNRESOLVED',
      type: 'wire',
      start_hole: 'Z99', // Not in canonical_holes
      end_hole: 'E10',
      status: 'AMBIGUOUS'
    });
    const res = generateVisualAnnotations(state);
    const wUnres = res.wires.find(w => w.id === 'W_UNRESOLVED');
    assert.ok(wUnres);
    assert.equal(wUnres.startPosition, null);
    assert.equal(wUnres.isResolved, false);
    // Should have diagnostic entry
    const wireDiag = res.diagnostics.find(d => d.componentId === 'W_UNRESOLVED');
    assert.ok(wireDiag, 'Unresolved wire diagnostic must be added');
  });

  // 12. Simulation SOLVED values
  test('12. Simulation SOLVED values are accurately computed and attached', () => {
    const res = generateVisualAnnotations(baseGroundingState);
    const r1 = res.components.find(c => c.id === 'R1');
    assert.ok(r1.electrical, 'Electrical values must be present when SOLVED');
    assert.equal(r1.electrical.current, 0.01304);
    assert.equal(r1.electrical.power, 0.03743);
    assert.ok(r1.electrical_formatted.summary.includes('13.04 mA'));
  });

  // 13. Simulation NOT_RUN hides values
  test('13. Simulation NOT_RUN hides electrical values', () => {
    const state = JSON.parse(JSON.stringify(baseGroundingState));
    state.simulation = { status: 'NOT_RUN', source: 'MNA' };
    const res = generateVisualAnnotations(state);
    const r1 = res.components.find(c => c.id === 'R1');
    assert.equal(r1.electrical, null);
    assert.equal(r1.electrical_formatted, null);
  });

  // 14. Stale simulation hides values
  test('14. Stale signature invalidates and hides simulation values', () => {
    const res = generateVisualAnnotations(baseGroundingState, {
      currentCircuitSignature: 'sig_different_xyz789'
    });
    assert.equal(res.is_stale, true);
    const r1 = res.components.find(c => c.id === 'R1');
    assert.equal(r1.electrical, null);
    const staleDiag = res.diagnostics.find(d => d.issue === 'STALE_GROUNDING');
    assert.ok(staleDiag, 'Stale grounding diagnostic must be emitted');
  });

  // 15. Missing coordinates do not create fake positions
  test('15. Component without geometry or pixels has position null', () => {
    const state = JSON.parse(JSON.stringify(baseGroundingState));
    state.components.push({
      id: 'R_NO_POS',
      type: 'resistor',
      value: 1000,
      unit: 'Ω',
      status: 'VERIFIED',
      image_geometry: null,
      terminals: {
        terminal_a: { hole: 'A1', pixel: null },
        terminal_b: { hole: 'A2', pixel: null }
      }
    });
    const res = generateVisualAnnotations(state);
    const rNoPos = res.components.find(c => c.id === 'R_NO_POS');
    assert.equal(rNoPos.position, null);
  });

  // 16. Component selection
  test('16. Setting selectedComponentId flags matching component as selected', () => {
    const res = generateVisualAnnotations(baseGroundingState, {
      selectedComponentId: 'R1'
    });
    const r1 = res.components.find(c => c.id === 'R1');
    const led = res.components.find(c => c.id === 'LED1');
    assert.equal(r1.isSelected, true);
    assert.equal(led.isSelected, false);
    assert.ok(res.selectedComponent);
    assert.equal(res.selectedComponent.id, 'R1');
  });

  // 17. Highlight by component ID
  test('17. Setting highlightedComponentId flags matching component as highlighted', () => {
    const res = generateVisualAnnotations(baseGroundingState, {
      highlightedComponentId: 'LED1'
    });
    const led = res.components.find(c => c.id === 'LED1');
    assert.equal(led.isHighlighted, true);
    assert.ok(res.highlightedComponent);
    assert.equal(res.highlightedComponent.id, 'LED1');
  });

  // 18. Signature mismatch handling
  test('18. Identical signature preserves freshness and electrical data', () => {
    const res = generateVisualAnnotations(baseGroundingState, {
      currentCircuitSignature: 'sig_abc123'
    });
    assert.equal(res.is_stale, false);
    const r1 = res.components.find(c => c.id === 'R1');
    assert.ok(r1.electrical !== null);
  });

  // 19. Debug mode
  test('19. Debug mode includes rejected detections as diagnostic markers', () => {
    const res = generateVisualAnnotations(baseGroundingState, { debugMode: true });
    const rejDiag = res.diagnostics.find(d => d.issue === 'REJECTED_DETECTION');
    assert.ok(rejDiag, 'Debug mode should expose rejected detections in diagnostics');
    assert.equal(rejDiag.status, 'REJECTED');
  });

  // 20. Normal mode
  test('20. Normal mode suppresses rejected detections from diagnostic markers', () => {
    const res = generateVisualAnnotations(baseGroundingState, { debugMode: false });
    const rejDiag = res.diagnostics.find(d => d.issue === 'REJECTED_DETECTION');
    assert.equal(rejDiag, undefined, 'Normal mode should not include rejected detections in diagnostics');
  });
});
