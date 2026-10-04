// Circuit Data Service Abstraction Layer
// Decouples frontend components from database / API storage details per AGENTS.md

import { mockCircuits, MOCK_SOURCE_TAG } from '../data/mockCircuits';
import { apiRequest } from './api';

export async function fetchAllCircuits() {
  const res = await apiRequest('/circuit/list', 'GET');
  if (res && res.circuits) return res.circuits;
  return mockCircuits;
}

export async function fetchCircuitById(id) {
  const res = await apiRequest(`/circuit/${id}`, 'GET');
  if (res && res.circuit_id) return res;
  return mockCircuits.find(c => c.id === id) || mockCircuits[0];
}

export async function updateComponentUserOverride(circuitId, compId, newOverrideValue) {
  const res = await apiRequest(`/circuit/${circuitId}/override`, 'POST', { compId, newOverrideValue });
  return {
    circuitId,
    compId,
    user_override_value: newOverrideValue,
    source: MOCK_SOURCE_TAG,
    status: 'saved'
  };
}
