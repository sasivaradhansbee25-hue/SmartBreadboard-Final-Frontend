/**
 * SmartBreadboard 3D — WebRTC ICE & TURN Configuration
 * Provides STUN and environment-configurable TURN servers for cross-network WebRTC streaming.
 */

export function getIceServers() {
  const iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ];

  // Optional TURN server from environment configuration
  const turnUrl = import.meta.env.VITE_TURN_URL;
  const turnUsername = import.meta.env.VITE_TURN_USERNAME;
  const turnCredential = import.meta.env.VITE_TURN_CREDENTIAL;

  if (turnUrl) {
    const turnServer = { urls: turnUrl };
    if (turnUsername) turnServer.username = turnUsername;
    if (turnCredential) turnServer.credential = turnCredential;
    iceServers.push(turnServer);
    console.log("[WebRTC] TURN server configured:", turnUrl);
  } else {
    console.log("[WebRTC] TURN not configured — direct WebRTC with STUN only");
  }

  return iceServers;
}
