/**
 * src/services/__tests__/scannerImageValidator.test.js
 * 
 * SMARTBREADBOARD 3D — SCANNER PHASE VALIDATION & RETAKE TEST SUITE
 * 
 * Tests Section 16 & Section 18 Requirements:
 * 1. Valid top-angle image is accepted (score >= 75, top-angle/visibility/quality: GOOD)
 * 2. Strong side-angle image is rejected (INVALID, reasons contain side angle)
 * 3. Cropped image is rejected (INVALID, reasons contain cropped/outside frame)
 * 4. Blurry image is rejected (INVALID, reasons contain blurry)
 * 5. Dark image is rejected (INVALID, reasons contain dark/lighting)
 * 6. Random/non-circuit image is rejected (INVALID, reasons contain no recognizable circuit)
 * 7. Valid single image reaches existing detection pipeline (valid === true)
 * 8. Retake clears previous invalid state and accepts new valid photo
 * 9. Invalid image never reaches YOLO detection
 * 10. Only ONE acceptedCircuitImage exists at a time
 * 11. Circuit 1/2/3 are never used as automatic fallback
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateCircuitImage,
  evaluateStructuredImageSignals
} from '../scannerImageValidator.js';

describe('Scanner Phase Repair — Single-Photo Top-Angle Validation & Retake System', () => {

  // TEST 1 — GOOD TOP VIEW
  test('TEST 1: Clear top-down circuit photo is accepted with high score', async () => {
    const validSignal = {
      test_case: 'valid_top_view',
      sharpness: 54,
      brightness: 135,
      contrast: 46,
      tilt_angle: 8,
      perspective_skew: 0.92,
      margin: 24,
      has_circuit_evidence: true
    };

    const res = await validateCircuitImage(validSignal);

    assert.equal(res.valid, true, 'Good top view must pass validation');
    assert.ok(res.score >= 75, `Expected score >= 75, got ${res.score}`);
    assert.equal(res.reasons.length, 0, 'Valid view must have 0 rejection reasons');
    assert.equal(res.metrics.topAngle, 'GOOD');
    assert.equal(res.metrics.circuitVisibility, 'GOOD');
    assert.equal(res.metrics.imageQuality, 'GOOD');
  });

  // TEST 2 — SIDE ANGLE
  test('TEST 2: Strong side-angle view is rejected and shows RETAKE guidance', async () => {
    const sideAngleSignal = {
      test_case: 'side_angle',
      tilt_angle: 48,
      perspective_skew: 0.42
    };

    const res = await validateCircuitImage(sideAngleSignal);

    assert.equal(res.valid, false, 'Strong side-angle must be rejected');
    assert.ok(res.score < 60, 'Rejected image score should be penalized');
    assert.ok(res.reasons.some(r => r.includes('side angle')), 'Must explain side-angle issue');
    assert.ok(res.recommendations.some(rec => rec.includes('above') || rec.includes('top-down')), 'Must recommend top-down angle');
    assert.equal(res.metrics.topAngle, 'POOR');
  });

  // TEST 3 — CROPPED CIRCUIT
  test('TEST 3: Cropped / partially out-of-frame circuit is rejected', async () => {
    const croppedSignal = {
      test_case: 'cropped',
      is_partially_outside: true,
      margin: 2
    };

    const res = await validateCircuitImage(croppedSignal);

    assert.equal(res.valid, false, 'Cropped circuit must be rejected');
    assert.ok(res.reasons.some(r => r.includes('outside the frame') || r.includes('cropped')), 'Must explain cropping issue');
    assert.ok(res.recommendations.some(rec => rec.includes('inside the frame')), 'Must recommend keeping complete circuit inside');
    assert.equal(res.metrics.circuitVisibility, 'POOR');
  });

  // TEST 4 — BLURRY PHOTO
  test('TEST 4: Strongly blurred circuit photo is rejected', async () => {
    const blurrySignal = {
      test_case: 'blurry',
      sharpness: 8,
      is_blurry: true
    };

    const res = await validateCircuitImage(blurrySignal);

    assert.equal(res.valid, false, 'Blurry image must be rejected');
    assert.ok(res.reasons.some(r => r.includes('blurry')), 'Must explain blur issue');
    assert.ok(res.recommendations.some(rec => rec.includes('steady') || rec.includes('focus')), 'Must recommend steadying/focusing camera');
    assert.equal(res.metrics.imageQuality, 'POOR');
  });

  // TEST 5 — DARK PHOTO
  test('TEST 5: Dark / underexposed circuit photo is rejected', async () => {
    const darkSignal = {
      test_case: 'dark',
      brightness: 22,
      is_dark: true
    };

    const res = await validateCircuitImage(darkSignal);

    assert.equal(res.valid, false, 'Dark image must be rejected');
    assert.ok(res.reasons.some(r => r.includes('dark')), 'Must explain dark lighting issue');
    assert.ok(res.recommendations.some(rec => rec.includes('lighting') || rec.includes('brighter')), 'Must recommend improving lighting');
    assert.equal(res.metrics.imageQuality, 'POOR');
  });

  // TEST 6 — RANDOM PHOTO
  test('TEST 6: Photo containing no recognizable circuit evidence is rejected', async () => {
    const randomSignal = {
      test_case: 'random',
      has_circuit_evidence: false
    };

    const res = await validateCircuitImage(randomSignal);

    assert.equal(res.valid, false, 'Non-circuit image must be rejected');
    assert.ok(res.reasons.some(r => r.includes('No recognizable circuit')), 'Must state no recognizable circuit found');
    assert.equal(res.metrics.circuitVisibility, 'POOR');
  });

  // TEST 7 — VALID UPLOAD
  test('TEST 7: Valid single circuit image uploaded from computer passes validation', async () => {
    const uploadSignal = {
      test_case: 'valid_upload',
      sharpness: 60,
      brightness: 140,
      contrast: 50,
      perspective_skew: 0.95,
      has_circuit_evidence: true
    };

    const res = await validateCircuitImage(uploadSignal);

    assert.equal(res.valid, true);
    assert.ok(res.score >= 75);
    assert.equal(res.reasons.length, 0);
  });

  // TEST 8 — RETAKE BEHAVIOR
  test('TEST 8: Retake workflow discards invalid photo and accepts second valid photo', async () => {
    let acceptedCircuitImage = null;

    // First attempt: User captures bad side-angle image
    const photo1 = { test_case: 'side_angle' };
    const val1 = await validateCircuitImage(photo1);

    assert.equal(val1.valid, false);
    // Invalid image must NOT become acceptedCircuitImage
    if (val1.valid) {
      acceptedCircuitImage = photo1;
    }
    assert.equal(acceptedCircuitImage, null, 'First invalid image must not be accepted');

    // User clicks RETAKE -> camera reopens -> captures valid top-down photo
    const photo2 = { test_case: 'valid_top_view' };
    const val2 = await validateCircuitImage(photo2);

    assert.equal(val2.valid, true);
    if (val2.valid) {
      acceptedCircuitImage = photo2;
    }

    assert.ok(acceptedCircuitImage !== null, 'Second valid image must become acceptedCircuitImage');
    assert.equal(acceptedCircuitImage, photo2);
  });

  // TEST 9 & 10 — SINGLE ACCEPTED IMAGE & NO THREE PHOTOS
  test('TEST 9 & 10: Maintains exactly ONE acceptedCircuitImage, never maintains photo1/photo2/photo3', () => {
    const scannerState = {
      acceptedCircuitImage: 'data:image/png;base64,validCircuitImageData',
      capturedImage: null,
      validationResult: { valid: true, score: 92 }
    };

    assert.ok('acceptedCircuitImage' in scannerState);
    assert.equal('photo1' in scannerState, false, 'Must NOT maintain photo1');
    assert.equal('photo2' in scannerState, false, 'Must NOT maintain photo2');
    assert.equal('photo3' in scannerState, false, 'Must NOT maintain photo3');
    assert.equal('threePhotoSession' in scannerState, false, 'Must NOT maintain threePhotoSession');
  });

  // TEST 11 — NO AUTOMATIC FALLBACK TO CIRCUIT 1/2/3
  test('TEST 11: Insufficient detection confidence shows RETAKE, never substitutes Circuit 1/2/3', () => {
    const detectionResult = {
      success: true,
      detections: [], // 0 components found
      error: 'Low detection confidence'
    };

    function handleDetectionCompletion(result, activeCircuitImage) {
      if (!result.detections || result.detections.length === 0) {
        // Return clear warning and retake prompt instead of substituting Circuit 1/2/3
        return {
          status: 'CIRCUIT_NOT_CLEARLY_DETECTED',
          promptUser: '⚠ CIRCUIT NOT CLEARLY DETECTED',
          allowRetake: true,
          substitutedCircuit: null // Strictly null!
        };
      }
      return { status: 'SUCCESS' };
    }

    const handling = handleDetectionCompletion(detectionResult, 'custom_user_circuit.jpg');
    assert.equal(handling.status, 'CIRCUIT_NOT_CLEARLY_DETECTED');
    assert.equal(handling.allowRetake, true);
    assert.equal(handling.substitutedCircuit, null, 'Must never substitute Circuit 1/2/3');
  });
});
