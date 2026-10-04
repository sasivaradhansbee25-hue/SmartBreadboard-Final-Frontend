/**
 * SmartBreadboard 3D — Circuit Highlight Service Unit Tests (Phase 22.3)
 *
 * Verifies all 21 required behaviors:
 * 1. Select verified component.
 * 2. Select unknown component.
 * 3. Select ambiguous component.
 * 4. Select terminal.
 * 5. Select verified node.
 * 6. Node members are highlighted.
 * 7. Connected components are highlighted.
 * 8. Connected wires are highlighted.
 * 9. Invalid component ID is rejected.
 * 10. Invalid node ID is rejected.
 * 11. Component highlight.
 * 12. Terminal highlight.
 * 13. Node highlight.
 * 14. Connection highlight.
 * 15. Simulation values included when valid.
 * 16. Stale simulation values excluded.
 * 17. Signature mismatch clears highlight.
 * 18. Selection of rejected detection fails.
 * 19. Empty circuit.
 * 20. Series circuit.
 * 21. Parallel circuit.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { computeHighlightGraph } from '../circuitHighlightService.js';

describe('Phase 22.3: Circuit Highlight & Interaction Service', () => {

  const baseGroundingState = {
    schema_version: '22.1',
    circuit_signature: 'sig_verif_123',
    overall_status: 'VERIFIED',
    components: [
      {
        id: 'R1',
        type: 'resistor',
        value: 220,
        unit: 'Ω',
        display_value: '220 Ω',
        status: 'VERIFIED',
        source: 'ai',
        terminals: {
          terminal_a: { name: 'terminal_a', hole: 'E10', status: 'VERIFIED', electrical_node: 'NODE_1' },
          terminal_b: { name: 'terminal_b', hole: 'E15', status: 'VERIFIED', electrical_node: 'NODE_2' }
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
        terminals: {
          terminal_a: { name: 'terminal_a', hole: 'E15', status: 'VERIFIED', electrical_node: 'NODE_2' },
          terminal_b: { name: 'terminal_b', hole: 'E20', status: 'VERIFIED', electrical_node: 'NODE_GND' }
        }
      },
      {
        id: 'R_AMBIG',
        type: 'resistor',
        value: 1000,
        unit: 'Ω',
        display_value: '1 kΩ',
        status: 'AMBIGUOUS',
        source: 'ai',
        terminals: {
          terminal_a: { name: 'terminal_a', hole: 'A1', status: 'VERIFIED', electrical_node: 'NODE_A' },
          terminal_b: { name: 'terminal_b', hole: 'AMBIGUOUS', status: 'AMBIGUOUS', electrical_node: null }
        }
      },
      {
        id: 'U_COMP',
        type: 'unknown',
        value: null,
        unit: null,
        display_value: 'Unknown',
        status: 'UNKNOWN',
        source: 'unknown',
        terminals: {
          terminal_a: { name: 'terminal_a', hole: null, status: 'UNKNOWN', electrical_node: null },
          terminal_b: { name: 'terminal_b', hole: null, status: 'UNKNOWN', electrical_node: null }
        }
      }
    ],
    wires: [
      {
        id: 'W1',
        type: 'wire',
        start_hole: 'E15',
        end_hole: 'E25',
        status: 'VERIFIED',
        electrical_effect: 'MERGES_HOLE_E15_WITH_HOLE_E25'
      }
    ],
    nodes: [
      { id: 'NODE_1', members: ['R1.terminal_a'], holes: ['E10'], status: 'VERIFIED', voltage_v: 5.0 },
      { id: 'NODE_2', members: ['R1.terminal_b', 'LED1.terminal_a'], holes: ['E15'], status: 'VERIFIED', voltage_v: 2.13 },
      { id: 'NODE_GND', members: ['LED1.terminal_b'], holes: ['E20'], status: 'VERIFIED', voltage_v: 0.0 }
    ],
    rejected_detections: [
      { id: 'REJ_DET_99', label: 'resistor', confidence: 0.12, reason: 'LOW_CONFIDENCE' }
    ],
    simulation: {
      status: 'SOLVED',
      source: 'MNA',
      voltages: { 'NODE_1': 5.0, 'NODE_2': 2.13, 'NODE_GND': 0.0 },
      currents: { 'R1': 0.01304, 'LED1': 0.01304 },
      powers: { 'R1': 0.03743, 'LED1': 0.02778 }
    }
  };

  // 1. Select verified component
  test('1. Select verified component returns successful highlight graph', () => {
    const res = computeHighlightGraph(baseGroundingState, { mode: 'COMPONENT', targetId: 'R1' });
    assert.equal(res.status, 'SUCCESS');
    assert.equal(res.target.id, 'R1');
    assert.equal(res.target.status, 'VERIFIED');
    assert.ok(res.components.includes('R1'));
  });

  // 2. Select unknown component
  test('2. Select unknown component handles missing terminals gracefully', () => {
    const res = computeHighlightGraph(baseGroundingState, { mode: 'COMPONENT', targetId: 'U_COMP' });
    assert.equal(res.status, 'SUCCESS');
    assert.equal(res.target.id, 'U_COMP');
    assert.equal(res.target.status, 'UNKNOWN');
    assert.deepEqual(res.holes, []);
  });

  // 3. Select ambiguous component
  test('3. Select ambiguous component highlights valid terminal and omits ambiguous hole', () => {
    const res = computeHighlightGraph(baseGroundingState, { mode: 'COMPONENT', targetId: 'R_AMBIG' });
    assert.equal(res.status, 'SUCCESS');
    assert.equal(res.target.status, 'AMBIGUOUS');
    assert.ok(res.holes.includes('A1'));
    assert.ok(!res.holes.includes('AMBIGUOUS'));
  });

  // 4. Select terminal
  test('4. Select terminal highlights targeted terminal and its associated node', () => {
    const res = computeHighlightGraph(baseGroundingState, { mode: 'TERMINAL', targetId: 'R1', terminalKey: 'terminal_b' });
    assert.equal(res.status, 'SUCCESS');
    assert.equal(res.target.terminalKey, 'terminal_b');
    assert.ok(res.terminals.includes('R1.terminal_b'));
    assert.ok(res.nodes.includes('NODE_2'));
    assert.ok(res.holes.includes('E15'));
  });

  // 5. Select verified node
  test('5. Select verified node highlights node and its voltages', () => {
    const res = computeHighlightGraph(baseGroundingState, { mode: 'NODE', targetId: 'NODE_2' });
    assert.equal(res.status, 'SUCCESS');
    assert.equal(res.target.id, 'NODE_2');
    assert.equal(res.target.voltage, 2.13);
  });

  // 6. Node members are highlighted
  test('6. Selecting a node highlights all connected terminal pins', () => {
    const res = computeHighlightGraph(baseGroundingState, { mode: 'NODE', targetId: 'NODE_2' });
    assert.ok(res.terminals.includes('R1.terminal_b'));
    assert.ok(res.terminals.includes('LED1.terminal_a'));
  });

  // 7. Connected components are highlighted
  test('7. Selecting a component or node highlights connected neighbor components', () => {
    const res = computeHighlightGraph(baseGroundingState, { mode: 'COMPONENT', targetId: 'R1' });
    assert.ok(res.components.includes('R1'));
    assert.ok(res.components.includes('LED1'), 'LED1 shares NODE_2 with R1 and should be in highlight graph');
  });

  // 8. Connected wires are highlighted
  test('8. Connected wires attached to shared holes are included in highlight', () => {
    const res = computeHighlightGraph(baseGroundingState, { mode: 'NODE', targetId: 'NODE_2' });
    assert.ok(res.wires.includes('W1'), 'W1 connects to E15 and should be highlighted');
  });

  // 9. Invalid component ID is rejected
  test('9. Invalid component ID returns INVALID_TARGET status without throwing', () => {
    const res = computeHighlightGraph(baseGroundingState, { mode: 'COMPONENT', targetId: 'R999' });
    assert.equal(res.status, 'INVALID_TARGET');
    assert.equal(res.components.length, 0);
  });

  // 10. Invalid node ID is rejected
  test('10. Invalid node ID returns INVALID_TARGET status', () => {
    const res = computeHighlightGraph(baseGroundingState, { mode: 'NODE', targetId: 'NODE_DOES_NOT_EXIST' });
    assert.equal(res.status, 'INVALID_TARGET');
    assert.equal(res.nodes.length, 0);
  });

  // 11. Component highlight
  test('11. Component mode properly populates components, terminals, and holes', () => {
    const res = computeHighlightGraph(baseGroundingState, { mode: 'COMPONENT', targetId: 'LED1' });
    assert.equal(res.mode, 'COMPONENT');
    assert.ok(res.holes.includes('E15'));
    assert.ok(res.holes.includes('E20'));
  });

  // 12. Terminal highlight
  test('12. Terminal mode populates specific terminal and related components', () => {
    const res = computeHighlightGraph(baseGroundingState, { mode: 'TERMINAL', targetId: 'LED1', terminalKey: 'terminal_a' });
    assert.equal(res.mode, 'TERMINAL');
    assert.ok(res.terminals.includes('LED1.terminal_a'));
    assert.ok(res.terminals.includes('R1.terminal_b'));
  });

  // 13. Node highlight
  test('13. Node mode populates all holes and terminals belonging to that node', () => {
    const res = computeHighlightGraph(baseGroundingState, { mode: 'NODE', targetId: 'NODE_1' });
    assert.deepEqual(res.nodes, ['NODE_1']);
    assert.ok(res.holes.includes('E10'));
    assert.ok(res.terminals.includes('R1.terminal_a'));
  });

  // 14. Connection highlight
  test('14. Connection mode traces the deterministic path between two components', () => {
    const res = computeHighlightGraph(baseGroundingState, {
      mode: 'CONNECTION',
      targetId: 'R1',
      targetId2: 'LED1'
    });
    assert.equal(res.status, 'SUCCESS');
    assert.equal(res.mode, 'CONNECTION');
    assert.ok(res.connection_path.length > 0);
    assert.equal(res.connection_path[0].from, 'R1.terminal_b');
    assert.equal(res.connection_path[0].via_node, 'NODE_2');
    assert.equal(res.connection_path[0].to, 'LED1.terminal_a');
  });

  // 15. Simulation values included when valid
  test('15. Simulation values are attached when MNA is SOLVED and signature matches', () => {
    const res = computeHighlightGraph(baseGroundingState, {
      mode: 'COMPONENT',
      targetId: 'R1',
      currentCircuitSignature: 'sig_verif_123'
    });
    assert.ok(res.simulation);
    assert.equal(res.simulation.current, 0.01304);
    assert.equal(res.simulation.power, 0.03743);
  });

  // 16. Stale simulation values excluded
  test('16. Simulation values excluded when solver status is not SOLVED', () => {
    const unsimulated = JSON.parse(JSON.stringify(baseGroundingState));
    unsimulated.simulation = { status: 'NOT_RUN' };
    const res = computeHighlightGraph(unsimulated, { mode: 'COMPONENT', targetId: 'R1' });
    assert.equal(res.simulation, null);
  });

  // 17. Signature mismatch clears highlight
  test('17. Signature mismatch returns STALE status and empties highlight collections', () => {
    const res = computeHighlightGraph(baseGroundingState, {
      mode: 'COMPONENT',
      targetId: 'R1',
      currentCircuitSignature: 'sig_mismatched_999'
    });
    assert.equal(res.status, 'STALE');
    assert.equal(res.components.length, 0);
    assert.equal(res.holes.length, 0);
  });

  // 18. Selection of rejected detection fails
  test('18. Selection of rejected candidate ID returns INVALID_TARGET', () => {
    const res = computeHighlightGraph(baseGroundingState, { mode: 'COMPONENT', targetId: 'REJ_DET_99' });
    assert.equal(res.status, 'INVALID_TARGET');
    assert.equal(res.components.length, 0);
  });

  // 19. Empty circuit
  test('19. Empty circuit handles gracefully without error', () => {
    const emptyState = { schema_version: '22.1', components: [], wires: [], nodes: [] };
    const res = computeHighlightGraph(emptyState, { mode: 'COMPONENT', targetId: 'R1' });
    assert.equal(res.status, 'INVALID_TARGET');
  });

  // 20. Series circuit
  test('20. Series circuit highlights node connecting series elements', () => {
    const seriesState = {
      schema_version: '22.1',
      components: [
        {
          id: 'R1',
          type: 'resistor',
          terminals: {
            terminal_a: { hole: 'A1', electrical_node: 'N_IN' },
            terminal_b: { hole: 'A5', electrical_node: 'N_MID' }
          }
        },
        {
          id: 'R2',
          type: 'resistor',
          terminals: {
            terminal_a: { hole: 'A5', electrical_node: 'N_MID' },
            terminal_b: { hole: 'A10', electrical_node: 'N_OUT' }
          }
        }
      ],
      nodes: [
        { id: 'N_MID', holes: ['A5'], members: ['R1.terminal_b', 'R2.terminal_a'] }
      ]
    };
    const res = computeHighlightGraph(seriesState, { mode: 'COMPONENT', targetId: 'R1' });
    assert.ok(res.components.includes('R2'), 'R2 is in series with R1 via N_MID');
    assert.ok(res.holes.includes('A5'));
  });

  // 21. Parallel circuit
  test('21. Parallel circuit highlights both shared nodes and parallel branches', () => {
    const parallelState = {
      schema_version: '22.1',
      components: [
        {
          id: 'R1',
          type: 'resistor',
          terminals: {
            terminal_a: { hole: 'A1', electrical_node: 'N_TOP' },
            terminal_b: { hole: 'A5', electrical_node: 'N_BOT' }
          }
        },
        {
          id: 'R2',
          type: 'resistor',
          terminals: {
            terminal_a: { hole: 'B1', electrical_node: 'N_TOP' },
            terminal_b: { hole: 'B5', electrical_node: 'N_BOT' }
          }
        }
      ],
      nodes: [
        { id: 'N_TOP', holes: ['A1', 'B1'], members: ['R1.terminal_a', 'R2.terminal_a'] },
        { id: 'N_BOT', holes: ['A5', 'B5'], members: ['R1.terminal_b', 'R2.terminal_b'] }
      ]
    };
    const res = computeHighlightGraph(parallelState, { mode: 'CONNECTION', targetId: 'R1', targetId2: 'R2' });
    assert.equal(res.status, 'SUCCESS');
    assert.ok(res.nodes.includes('N_TOP'));
    assert.ok(res.nodes.includes('N_BOT'));
    assert.equal(res.connection_path.length, 2, 'Should trace both parallel node paths');
  });

});
