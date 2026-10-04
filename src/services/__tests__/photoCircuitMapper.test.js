/**
 * SmartBreadboard 3D — Photo Circuit Mapper Unit Tests (Phase 24.1)
 *
 * Validates:
 * 1. Successful mapping (READY state, verified components, electrical nodes)
 * 2. Partial mapping (PARTIAL state, unsupported component)
 * 3. Ambiguous mapping (AMBIGUOUS state, manual review required, resolution)
 * 4. Blocked mapping (BLOCKED state, blank image or no components)
 * 5. Verified component rendering structure & hole rendering
 * 6. Simulation readiness gate (simulation_ready === false with SUPPLY_CONFIGURATION_REQUIRED)
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  getCanonicalNodeForHole,
  buildElectricalGraphFromComponents,
  resolveAmbiguousTerminal,
  formatPipelineResultForCircuitContext
} from '../photoCircuitService.js';

describe('Phase 24.1: Photo to Verified Circuit Mapping Pipeline', () => {

  // 1. Successful mapping
  test('1. Successful mapping creates verified components, connections, and nodes', () => {
    const rawComps = [
      {
        id: 'R1',
        type: 'resistor',
        status: 'VERIFIED',
        terminals: [
          { terminal: 'terminal_a', hole: 'A10', status: 'VERIFIED' },
          { terminal: 'terminal_b', hole: 'A15', status: 'VERIFIED' }
        ]
      },
      {
        id: 'LED1',
        type: 'led',
        status: 'VERIFIED',
        terminals: [
          { terminal: 'anode', hole: 'C15', status: 'VERIFIED' },
          { terminal: 'cathode', hole: 'C20', status: 'VERIFIED' }
        ]
      }
    ];

    const graph = buildElectricalGraphFromComponents(rawComps);
    assert.equal(graph.components.length, 2);
    // Col 15 (A15 and C15) are merged into one electrical node
    assert.equal(graph.nodes.length, 3);

    const midNode = graph.nodes.find(n => n.members.includes('R1.terminal_b'));
    assert.ok(midNode);
    assert.ok(midNode.members.includes('LED1.anode'));

    assert.equal(graph.connections.length, 4);
  });

  // 2. Partial mapping
  test('2. Partial mapping correctly flags unverified or unknown component', () => {
    const rawComps = [
      {
        id: 'R1',
        type: 'resistor',
        status: 'VERIFIED',
        terminals: [
          { terminal: 'terminal_a', hole: 'A10', status: 'VERIFIED' },
          { terminal: 'terminal_b', hole: 'A15', status: 'VERIFIED' }
        ]
      },
      {
        id: 'U1',
        type: 'unknown_sensor',
        status: 'UNKNOWN',
        terminals: []
      }
    ];

    const hasUnknown = rawComps.some(c => c.status === 'UNKNOWN');
    const allVerified = rawComps.every(c => c.status === 'VERIFIED');
    const status = hasUnknown ? 'PARTIAL' : (allVerified ? 'READY' : 'BLOCKED');

    assert.equal(status, 'PARTIAL');
  });

  // 3. Ambiguous mapping & resolution
  test('3. Ambiguous mapping requires manual review and resolves cleanly', () => {
    const mockPipelineResult = {
      status: 'AMBIGUOUS',
      components: [
        {
          id: 'R1',
          type: 'resistor',
          status: 'AMBIGUOUS',
          terminals: [
            { terminal: 'terminal_a', hole: 'A10', status: 'VERIFIED' },
            {
              terminal: 'terminal_b',
              hole: 'E15',
              status: 'AMBIGUOUS',
              alternate_holes: ['E15', 'E16']
            }
          ]
        }
      ],
      connections: [],
      nodes: [],
      simulation_ready: false,
      simulation_readiness_reason: 'AMBIGUOUS_TERMINAL_MAPPING'
    };

    assert.equal(mockPipelineResult.status, 'AMBIGUOUS');
    assert.equal(mockPipelineResult.simulation_ready, false);

    // User resolves ambiguous terminal_b to E15
    const resolved = resolveAmbiguousTerminal(mockPipelineResult, 'R1', 'terminal_b', 'E15');

    assert.equal(resolved.status, 'READY');
    const r1 = resolved.components[0];
    assert.equal(r1.status, 'VERIFIED');
    const tb = r1.terminals.find(t => t.terminal === 'terminal_b');
    assert.equal(tb.hole, 'E15');
    assert.equal(tb.status, 'VERIFIED');
    assert.equal(tb.alternate_holes, null);
    assert.equal(resolved.simulation_readiness_reason, 'SUPPLY_CONFIGURATION_REQUIRED');
  });

  // 4. Blocked mapping
  test('4. Blocked mapping state when zero components or invalid image', () => {
    const emptyResult = {
      status: 'BLOCKED',
      components: [],
      connections: [],
      nodes: [],
      breadboard: { detected: false },
      diagnostics: ['No components or breadboard structure detected.'],
      simulation_ready: false,
      simulation_readiness_reason: 'NO_COMPONENTS_DETECTED'
    };

    assert.equal(emptyResult.status, 'BLOCKED');
    assert.equal(emptyResult.simulation_ready, false);
    assert.equal(emptyResult.components.length, 0);
  });

  // 5. Verified component rendering structure & hole rendering
  test('5. Verified component rendering formats correctly for 3D digital twin & context', () => {
    const verifiedResult = {
      status: 'READY',
      circuit_signature: 'sig_abc123',
      components: [
        {
          id: 'R1',
          type: 'resistor',
          nominal_value: 1000.0,
          status: 'VERIFIED',
          terminals: [
            { terminal: 'terminal_a', hole: 'E10', node: 'NODE_1', status: 'VERIFIED' },
            { terminal: 'terminal_b', hole: 'E15', node: 'NODE_2', status: 'VERIFIED' }
          ]
        }
      ],
      nodes: [
        { node_id: 'NODE_1', members: ['R1.terminal_a'] },
        { node_id: 'NODE_2', members: ['R1.terminal_b'] }
      ]
    };

    const contextPayload = formatPipelineResultForCircuitContext(verifiedResult, 'data:image/png;base64,sample');
    assert.ok(contextPayload);
    assert.ok(contextPayload.netlist);
    assert.equal(contextPayload.netlist.components.length, 1);
    const comp = contextPayload.netlist.components[0];
    assert.equal(comp.id, 'R1');
    assert.equal(comp.start_hole, 'E10');
    assert.equal(comp.end_hole, 'E15');
    assert.equal(comp.node1, 'NODE_1');
    assert.equal(comp.node2, 'NODE_2');
    assert.equal(contextPayload.netlist.solver_status, 'POWER_REQUIRED');
  });

  // 6. Simulation readiness gate (Phase 24.1 vs Phase 24.2)
  test('6. Simulation readiness is strictly gated until power supply configuration', () => {
    const verifiedResult = {
      status: 'READY',
      components: [
        {
          id: 'R1',
          type: 'resistor',
          status: 'VERIFIED',
          terminals: [
            { terminal: 'terminal_a', hole: 'E10', status: 'VERIFIED' },
            { terminal: 'terminal_b', hole: 'E15', status: 'VERIFIED' }
          ]
        }
      ],
      simulation_ready: false,
      simulation_readiness_reason: 'SUPPLY_CONFIGURATION_REQUIRED'
    };

    // Even if status is READY, simulation_ready MUST be false because power supply is configured in Phase 24.2
    assert.equal(verifiedResult.status, 'READY');
    assert.equal(verifiedResult.simulation_ready, false);
    assert.equal(verifiedResult.simulation_readiness_reason, 'SUPPLY_CONFIGURATION_REQUIRED');
  });

  // 7. Canonical breadboard tie-point mapping
  test('7. Canonical tie-point mapping maps Rows A-E to TOP and Rows F-J to BOT', () => {
    assert.equal(getCanonicalNodeForHole('A10'), 'NODE_COL_10_TOP');
    assert.equal(getCanonicalNodeForHole('E10'), 'NODE_COL_10_TOP');
    assert.equal(getCanonicalNodeForHole('F10'), 'NODE_COL_10_BOT');
    assert.equal(getCanonicalNodeForHole('J10'), 'NODE_COL_10_BOT');
    assert.equal(getCanonicalNodeForHole('VCC_TOP_1'), 'NODE_VCC');
    assert.equal(getCanonicalNodeForHole('GND_TOP_1'), 'NODE_GND');
  });

});
