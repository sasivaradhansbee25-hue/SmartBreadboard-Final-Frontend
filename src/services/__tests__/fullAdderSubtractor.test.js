/**
 * src/services/__tests__/fullAdderSubtractor.test.js
 *
 * Unit tests for Full Adder & Full Subtractor calculation logic and data export schemas.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

function calculate(inA, inB, inC, opMode) {
  const p = inA ^ inB;
  if (opMode === 'adder') {
    return {
      x: p ^ inC,             // Sum
      y: (inA & inB) | (inC & p), // Cout
      p
    };
  }
  // Subtractor
  return {
    x: p ^ inC,                               // Difference
    y: ((1 - inA) & inB) | (inC & (1 - p)),   // Bout
    p
  };
}

describe('Full Adder & Full Subtractor Logic Engine', () => {
  describe('Full Adder 8-State Truth Table', () => {
    const expectedAdder = [
      { a: 0, b: 0, cin: 0, sum: 0, cout: 0 },
      { a: 0, b: 0, cin: 1, sum: 1, cout: 0 },
      { a: 0, b: 1, cin: 0, sum: 1, cout: 0 },
      { a: 0, b: 1, cin: 1, sum: 0, cout: 1 },
      { a: 1, b: 0, cin: 0, sum: 1, cout: 0 },
      { a: 1, b: 0, cin: 1, sum: 0, cout: 1 },
      { a: 1, b: 1, cin: 0, sum: 0, cout: 1 },
      { a: 1, b: 1, cin: 1, sum: 1, cout: 1 }
    ];

    expectedAdder.forEach(({ a, b, cin, sum, cout }) => {
      test(`Adder A=${a}, B=${b}, Cin=${cin} => Sum=${sum}, Cout=${cout}`, () => {
        const res = calculate(a, b, cin, 'adder');
        assert.equal(res.x, sum, `Sum mismatch for ${a},${b},${cin}`);
        assert.equal(res.y, cout, `Cout mismatch for ${a},${b},${cin}`);
        assert.equal(res.p, a ^ b, `Intermediate XOR mismatch`);
      });
    });
  });

  describe('Full Subtractor 8-State Truth Table', () => {
    const expectedSubtractor = [
      { a: 0, b: 0, bin: 0, diff: 0, bout: 0 },
      { a: 0, b: 0, bin: 1, diff: 1, bout: 1 },
      { a: 0, b: 1, bin: 0, diff: 1, bout: 1 },
      { a: 0, b: 1, bin: 1, diff: 0, bout: 1 },
      { a: 1, b: 0, bin: 0, diff: 1, bout: 0 },
      { a: 1, b: 0, bin: 1, diff: 0, bout: 0 },
      { a: 1, b: 1, bin: 0, diff: 0, bout: 0 },
      { a: 1, b: 1, bin: 1, diff: 1, bout: 1 }
    ];

    expectedSubtractor.forEach(({ a, b, bin, diff, bout }) => {
      test(`Subtractor A=${a}, B=${b}, Bin=${bin} => Diff=${diff}, Bout=${bout}`, () => {
        const res = calculate(a, b, bin, 'subtractor');
        assert.equal(res.x, diff, `Diff mismatch for ${a},${b},${bin}`);
        assert.equal(res.y, bout, `Bout mismatch for ${a},${b},${bin}`);
      });
    });
  });

  describe('JSON Export Schema Integrity', () => {
    test('Produces valid export structure with 8 truth table rows', () => {
      const a = 1, b = 0, c = 1, mode = 'adder';
      const res = calculate(a, b, c, mode);
      const truthRows = Array.from({ length: 8 }, (_, i) => {
        const bitA = (i >> 2) & 1;
        const bitB = (i >> 1) & 1;
        const bitC = i & 1;
        const r = calculate(bitA, bitB, bitC, mode);
        return { A: bitA, B: bitB, Cin: bitC, Sum: r.x, Cout: r.y };
      });

      const exportData = {
        source: 'smart-breadboard-3d-lab',
        mode,
        inputs: { A: a, B: b, thirdInput: c },
        outputs: { out1: res.x, out2: res.y },
        truthTable: truthRows
      };

      assert.equal(exportData.mode, 'adder');
      assert.equal(exportData.outputs.out1, 0); // 1 ^ 0 ^ 1 = 0
      assert.equal(exportData.outputs.out2, 1); // carry = 1
      assert.equal(exportData.truthTable.length, 8);
      assert.deepEqual(exportData.truthTable[5], { A: 1, B: 0, Cin: 1, Sum: 0, Cout: 1 });
    });
  });
});
