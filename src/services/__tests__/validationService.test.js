/**
 * SmartBreadboard 3D — Validation Service Unit Tests (Phase 24A)
 *
 * Tests:
 * 1. Static benchmark matrix completeness (PHYS-001 through PHYS-010).
 * 2. Unmeasured physical telemetry defaults to null / NOT_TESTED.
 * 3. Failure injection scenarios coverage (FAULT-A through FAULT-F).
 * 4. Validation summary calculation accuracy.
 * 5. Single benchmark case retrieval.
 * 6. Report generation content.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  STATIC_BENCHMARKS,
  STATIC_FAILURE_SCENARIOS,
  fetchValidationSummary,
  fetchValidationBenchmarks,
  fetchValidationBenchmarkCase,
  fetchFailureInjectionScenarios,
  fetchValidationReport
} from '../validationService.js';

describe('Phase 24A: Validation Dashboard & Evidence Service', () => {

  test('1. Static benchmark suite contains exactly 10 cases with NOT_TESTED status', () => {
    assert.equal(STATIC_BENCHMARKS.length, 10);
    const caseIds = STATIC_BENCHMARKS.map(b => b.case_id);
    assert.equal(caseIds[0], 'PHYS-001');
    assert.equal(caseIds[9], 'PHYS-010');

    // All must be NOT_TESTED by default (zero fabrication)
    for (const b of STATIC_BENCHMARKS) {
      assert.equal(b.status, 'NOT_TESTED');
      assert.equal(b.physical_measurements.v_supply_measured_v, null);
      assert.equal(b.physical_measurements.i_circuit_measured_ma, null);
    }
  });

  test('2. Failure injection scenarios include all 6 canonical fault modes', () => {
    assert.equal(STATIC_FAILURE_SCENARIOS.length, 6);
    const ids = STATIC_FAILURE_SCENARIOS.map(s => s.scenario_id);
    assert.deepEqual(ids, ['FAULT-A', 'FAULT-B', 'FAULT-C', 'FAULT-D', 'FAULT-E', 'FAULT-F']);

    for (const s of STATIC_FAILURE_SCENARIOS) {
      assert.equal(s.safety_status, 'VERIFIED_SAFE');
      assert.ok(s.expected_behavior.length > 0);
      assert.ok(s.software_response.length > 0);
    }
  });

  test('3. fetchValidationSummary returns software verified status and not performed physical status', async () => {
    const summary = await fetchValidationSummary();
    assert.equal(summary.total_benchmarks, 10);
    assert.equal(summary.not_tested, 10);
    assert.equal(summary.physical_validation_status, 'NOT PERFORMED');
    assert.equal(summary.software_verified, true);
  });

  test('4. fetchValidationBenchmarks retrieves list of 10 cases', async () => {
    const benchmarks = await fetchValidationBenchmarks();
    assert.equal(benchmarks.length, 10);
    assert.equal(benchmarks[0].case_id, 'PHYS-001');
  });

  test('5. fetchValidationBenchmarkCase returns specific case details', async () => {
    const case001 = await fetchValidationBenchmarkCase('PHYS-001');
    assert.ok(case001);
    assert.equal(case001.case_id, 'PHYS-001');
    assert.equal(case001.circuit_name, '5V_Resistor_LED');

    const invalidCase = await fetchValidationBenchmarkCase('PHYS-999');
    assert.equal(invalidCase, null);
  });

  test('6. fetchFailureInjectionScenarios returns all 6 scenarios', async () => {
    const scenarios = await fetchFailureInjectionScenarios();
    assert.equal(scenarios.length, 6);
  });

  test('7. fetchValidationReport returns markdown document', async () => {
    const report = await fetchValidationReport();
    assert.ok(report.markdown);
    assert.ok(report.markdown.includes('PHYSICAL VALIDATION STATUS: NOT PERFORMED'));
  });
});
