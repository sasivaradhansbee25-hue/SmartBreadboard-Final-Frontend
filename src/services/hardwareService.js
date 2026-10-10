import { apiRequest, getWebSocketBaseUrl } from './api';

export async function fetchHardwareStatus() {
  try {
    const res = await apiRequest('/hardware/status', 'GET');
    return res;
  } catch (err) {
    return {
      status: 'DISCONNECTED',
      connected: false,
      m1_state: false,
      m2_state: false,
      m1_measured_mA: 0.00,
      m2_measured_mA: 0.00,
      total_measured_mA: 0.00,
      message: 'Hardware backend server offline or unavailable.'
    };
  }
}

export async function sendMotorControlCommand(motor, state) {
  try {
    const res = await apiRequest('/hardware/motor', 'POST', {
      motor,
      state
    });
    return res;
  } catch (err) {
    return {
      status: 'ERROR',
      connected: false,
      message: err.message || 'Hardware communication error'
    };
  }
}

export function connectHardwareWebSocket(onMessage, onError, onClose) {
  const wsUrl = `${getWebSocketBaseUrl()}/ws/hardware`;
  let ws = null;
  try {
    ws = new WebSocket(wsUrl);
    ws.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data);
        if (onMessage) onMessage(data);
      } catch (e) {
        console.error('Failed to parse hardware WS message', e);
      }
    };
    ws.onerror = (err) => {
      if (onError) onError(err);
    };
    ws.onclose = () => {
      if (onClose) onClose();
    };
  } catch (err) {
    if (onError) onError(err);
  }
  return ws;
}
