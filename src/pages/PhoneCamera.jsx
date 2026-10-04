import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, CameraOff, RefreshCw, Zap, CheckCircle2, AlertTriangle, ShieldCheck, Upload, Sparkles, Eye, Box, ArrowRight } from 'lucide-react';
import { API_BASE_URL, WS_BASE_URL } from '../services/api';
import { getIceServers } from '../config/webrtc';
import { useCircuit } from '../context/CircuitContext';

export default function PhoneCamera() {
  const navigate = useNavigate();
  const { setRealCircuitData, setIsAnalyzingReal, setRealAnalysisError } = useCircuit();

  const [sessionId, setSessionId] = useState('');
  const [status, setStatus] = useState('idle'); // idle, requesting, streaming, analyzing, complete, error
  const [connectionStep, setConnectionStep] = useState('idle'); // idle, ws_connecting, signaling_connected, peer_found, offer_sent, ice_checking, camera_connected, failed
  const [errorMessage, setErrorMessage] = useState(null);

  // Photo Capture & Direct Upload State
  const [capturedImage, setCapturedImage] = useState(null); // base64 or blob URL
  const [capturedFile, setCapturedFile] = useState(null); // File object
  const [analysisResult, setAnalysisResult] = useState(null);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const wsRef = useRef(null);
  const pcRef = useRef(null);
  const pendingIceCandidatesRef = useRef([]);
  const isOfferingRef = useRef(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const s = params.get('session');
    if (s) {
      setSessionId(s);
    } else {
      setSessionId('SB3D-' + Math.random().toString(36).substring(2, 8).toUpperCase());
    }
  }, []);

  const stopPhoneStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    pendingIceCandidatesRef.current = [];
    isOfferingRef.current = false;
    setStatus('idle');
    setConnectionStep('idle');
  };

  const startPhoneCamera = async () => {
    stopPhoneStream();
    setErrorMessage(null);
    setStatus('requesting');
    setConnectionStep('ws_connecting');
    setCapturedImage(null);
    setCapturedFile(null);
    setAnalysisResult(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera API unavailable in this browser context. Please allow camera permissions or upload photo below.");
      }

      // 1. Request environment/rear camera stream with optimal mobile resolution
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (playErr) {
          console.warn("[Phone] Local video play error:", playErr);
        }
      }

      setStatus('streaming');

      // 2. Open WebSocket signaling to Render backend
      const wsUrl = `${WS_BASE_URL}/ws/camera/${sessionId}?role=phone`;
      console.log("[Phone] Connecting signaling WebSocket:", wsUrl);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[WebRTC] phone signalingState: connected to session", sessionId);
        setConnectionStep('signaling_connected');
        // DO NOT create WebRTC offer here! Wait for peer_status: connected
      };

      ws.onmessage = async (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === 'peer_status') {
            if (msg.status === 'connected') {
              console.log("[WebRTC] phone peer_status: laptop connected, creating single offer");
              setConnectionStep('peer_found');
              if (!isOfferingRef.current && streamRef.current) {
                await createAndSendOffer(streamRef.current, ws);
              }
            } else if (msg.status === 'disconnected') {
              console.log("[WebRTC] phone peer_status: laptop disconnected");
              setConnectionStep('signaling_connected');
              isOfferingRef.current = false;
              if (pcRef.current) {
                pcRef.current.close();
                pcRef.current = null;
              }
            }
          } else if (msg.type === 'answer') {
            console.log("[WebRTC] phone received answer SDP from laptop");
            const pc = pcRef.current;
            if (pc) {
              await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: msg.sdp }));
              console.log("[WebRTC] phone setRemoteDescription(answer) success");
              // Flush queued ICE candidates
              if (pendingIceCandidatesRef.current.length > 0) {
                console.log(`[WebRTC] phone flushing ${pendingIceCandidatesRef.current.length} queued ICE candidates`);
                for (const candidate of pendingIceCandidatesRef.current) {
                  try {
                    await pc.addIceCandidate(new RTCIceCandidate(candidate));
                  } catch (iceErr) {
                    console.warn("[WebRTC] phone queued ICE error:", iceErr);
                  }
                }
                pendingIceCandidatesRef.current = [];
              }
            }
          } else if (msg.type === 'ice_candidate' && msg.candidate) {
            const pc = pcRef.current;
            if (!pc || !pc.remoteDescription || !pc.remoteDescription.type) {
              console.log("[WebRTC] phone queuing ICE candidate before remote description");
              pendingIceCandidatesRef.current.push(msg.candidate);
            } else {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
              } catch (iceErr) {
                console.warn("[WebRTC] phone addIceCandidate error:", iceErr);
              }
            }
          }
        } catch (e) {
          console.warn("[Phone WS] Message processing error:", e);
        }
      };

      ws.onerror = (e) => {
        console.warn("[Phone WS] Signaling error:", e);
        setConnectionStep('failed');
      };

      ws.onclose = () => {
        console.log("[Phone WS] Signaling closed");
        if (connectionStep !== 'idle') {
          setConnectionStep('idle');
        }
      };
    } catch (err) {
      console.warn("[Phone] Camera start error:", err);
      setErrorMessage(err.message || "Could not start camera. Use Photo Upload below.");
      setStatus('error');
      setConnectionStep('failed');
    }
  };

  const createAndSendOffer = async (stream, ws) => {
    if (isOfferingRef.current) return;
    isOfferingRef.current = true;

    try {
      if (pcRef.current) {
        pcRef.current.close();
      }

      const pc = new RTCPeerConnection({ iceServers: getIceServers() });
      pcRef.current = pc;

      // Bug 3: Connection State Logging
      pc.onconnectionstatechange = () => {
        console.log("[WebRTC] phone connectionState:", pc.connectionState);
        if (pc.connectionState === 'connected') {
          setConnectionStep('camera_connected');
        } else if (pc.connectionState === 'connecting') {
          setConnectionStep('ice_checking');
        } else if (pc.connectionState === 'failed') {
          setConnectionStep('failed');
          isOfferingRef.current = false;
        } else if (pc.connectionState === 'disconnected') {
          isOfferingRef.current = false;
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log("[WebRTC] phone iceConnectionState:", pc.iceConnectionState);
        if (pc.iceConnectionState === 'checking') {
          setConnectionStep('ice_checking');
        } else if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
          setConnectionStep('camera_connected');
        } else if (pc.iceConnectionState === 'failed') {
          setConnectionStep('failed');
        }
      };

      pc.onsignalingstatechange = () => {
        console.log("[WebRTC] phone signalingState:", pc.signalingState);
      };

      pc.onicecandidate = (e) => {
        if (e.candidate && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ice_candidate', candidate: e.candidate }));
        }
      };

      // Add local tracks to peer connection
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      console.log("[WebRTC] phone created single offer & setLocalDescription");

      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'offer', sdp: offer.sdp }));
        console.log("[WebRTC] phone sent offer SDP to laptop");
        setConnectionStep('offer_sent');
      }
    } catch (e) {
      console.warn("[Phone WebRTC] Error creating offer:", e);
      isOfferingRef.current = false;
      setConnectionStep('failed');
    }
  };

  // Action: CAPTURE PHOTO from active video stream
  const capturePhotoFromStream = () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `phone-circuit-${Date.now()}.jpg`, { type: 'image/jpeg' });
        setCapturedFile(file);
        setCapturedImage(canvas.toDataURL('image/jpeg'));
        stopPhoneStream();
      }
    }, 'image/jpeg', 0.92);
  };

  // Action: UPLOAD PHOTO via File Input
  const handleFileInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setCapturedFile(file);
      const reader = new FileReader();
      reader.onload = (evt) => {
        setCapturedImage(evt.target?.result);
      };
      reader.readAsDataURL(file);
      stopPhoneStream();
    }
  };

  // Action: ANALYZE CIRCUIT via POST ${API_BASE_URL}/api/analyze-image
  const analyzeCapturedCircuit = async () => {
    if (!capturedFile && !capturedImage) {
      alert("Please capture or upload a circuit image first.");
      return;
    }

    setStatus('analyzing');
    setErrorMessage(null);
    setIsAnalyzingReal(true);
    setRealAnalysisError(null);

    try {
      let resp;
      if (capturedFile) {
        const formData = new FormData();
        formData.append("file", capturedFile, capturedFile.name || "phone-circuit.jpg");

        resp = await fetch(`${API_BASE_URL}/api/analyze-image`, {
          method: 'POST',
          body: formData
        });
      } else {
        resp = await fetch(`${API_BASE_URL}/api/analyze-image`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_base64: capturedImage })
        });
      }

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`AI Backend Error (HTTP ${resp.status}): ${text}`);
      }

      const data = await resp.json();
      console.log("[Phone] Received AI Analysis Result:", data);

      if (data.status === "error" || (data.success === false && data.error)) {
        throw new Error(data.error || "YOLO Detection pipeline failed.");
      }

      setAnalysisResult(data);
      setStatus('complete');
      setIsAnalyzingReal(false);

      // Synchronize with global CircuitContext
      setRealCircuitData({
        originalImage: data.originalImage || capturedImage,
        detections: data.detections || [],
        mapped_components: data.mapped_components || [],
        netlist: data.netlist || {},
        imageMeta: data.imageMeta || {},
        source: 'real'
      });
    } catch (err) {
      console.error("[Phone] Analysis failure:", err);
      let msg = err.message || "Failed to reach AI backend.";
      if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
        msg = `Cannot reach AI backend. Make sure FastAPI is running at ${API_BASE_URL}`;
      }
      setErrorMessage(msg);
      setRealAnalysisError(msg);
      setStatus('error');
      setIsAnalyzingReal(false);
    }
  };

  useEffect(() => {
    return () => {
      stopPhoneStream();
    };
  }, []);

  const counts = analysisResult?.counts || {
    resistor: 0,
    led: 0,
    capacitor: 0,
    diode_rectifier: 0,
    wire: 0,
    ic_chip: 0
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#020617',
      color: '#f8fafc',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'Inter, system-ui, sans-serif'
    }}>
      {/* Mobile Top Header */}
      <header style={{
        background: '#0f172a',
        padding: '0.85rem 1.25rem',
        borderBottom: '1px solid #1e293b',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '1rem', color: '#f8fafc' }}>
          <Zap style={{ color: '#38bdf8' }} size={20} />
          <span>SmartBreadboard <span style={{ color: '#38bdf8' }}>3D</span></span>
        </div>

        <span style={{
          fontSize: '0.75rem',
          padding: '0.25rem 0.6rem',
          borderRadius: '12px',
          background: status === 'streaming' ? '#064e3b' : status === 'complete' ? '#0284c7' : '#334155',
          color: status === 'streaming' ? '#6ee7b7' : '#f8fafc',
          fontWeight: 600
        }}>
          {status === 'streaming' ? '🟢 LIVE CAMERA' : status === 'complete' ? '✨ ANALYZED' : '📱 SCANNER MOBILE'}
        </span>
      </header>

      {/* Main Content Body */}
      <main style={{ flex: 1, padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '600px', margin: '0 auto', width: '100%' }}>

        {/* Session & WebRTC Connection Status Badge */}
        <div style={{
          background: '#0f172a',
          border: '1px solid #1e293b',
          borderRadius: '10px',
          padding: '0.75rem 1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.5rem'
        }}>
          <div>
            <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>PAIRING SESSION ID</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#38bdf8', fontFamily: 'monospace' }}>{sessionId}</div>
          </div>

          <div style={{
            fontSize: '0.78rem',
            fontWeight: 700,
            padding: '0.25rem 0.65rem',
            borderRadius: '12px',
            background: connectionStep === 'camera_connected' ? 'rgba(16, 185, 129, 0.15)' : connectionStep === 'failed' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(56, 189, 248, 0.15)',
            border: `1px solid ${connectionStep === 'camera_connected' ? '#10b981' : connectionStep === 'failed' ? '#ef4444' : '#38bdf8'}`,
            color: connectionStep === 'camera_connected' ? '#10b981' : connectionStep === 'failed' ? '#ef4444' : '#38bdf8'
          }}>
            {connectionStep === 'ws_connecting' && '● WEBSOCKET CONNECTING'}
            {connectionStep === 'signaling_connected' && '● SIGNALING CONNECTED'}
            {connectionStep === 'peer_found' && '● PEER FOUND'}
            {connectionStep === 'offer_sent' && '● OFFER SENT'}
            {connectionStep === 'ice_checking' && '● ICE CHECKING'}
            {connectionStep === 'camera_connected' && '● CAMERA CONNECTED'}
            {connectionStep === 'failed' && '⚠ PHONE CONNECTION FAILED'}
            {connectionStep === 'idle' && (status === 'complete' ? '● AI SOLVED' : '○ READY FOR CAPTURE')}
          </div>
        </div>

        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          capture="environment"
          onChange={handleFileInputChange}
          style={{ display: 'none' }}
        />

        {/* Media Container: Camera Stream / Preview */}
        <div style={{
          position: 'relative',
          width: '100%',
          minHeight: '320px',
          maxHeight: '480px',
          background: '#090d16',
          borderRadius: '12px',
          overflow: 'hidden',
          border: status === 'complete' ? '2px solid #38bdf8' : '1px solid #1e293b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {/* Active Live Video Stream */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: (status === 'streaming' || status === 'requesting') && !capturedImage ? 'block' : 'none'
            }}
          />

          {/* Captured / Uploaded Image Preview */}
          {capturedImage && (
            <img
              src={analysisResult?.annotated_image ? `data:image/png;base64,${analysisResult.annotated_image}` : capturedImage}
              alt="Circuit Capture"
              style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
            />
          )}

          {/* Idle State Banner */}
          {status === 'idle' && !capturedImage && (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
              <Camera size={52} style={{ marginBottom: '0.75rem', color: '#38bdf8', opacity: 0.8 }} />
              <h3 style={{ margin: '0 0 0.5rem 0', color: '#f8fafc', fontSize: '1.1rem' }}>Mobile Circuit Scanner</h3>
              <p style={{ margin: 0, fontSize: '0.82rem', maxWidth: '280px', lineHeight: 1.4, color: '#94a3b8' }}>
                Use rear camera or upload a photo of your breadboard circuit to run AI component detection.
              </p>
            </div>
          )}

          {/* Loading Indicator */}
          {status === 'analyzing' && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(2, 6, 23, 0.88)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#38bdf8', gap: '0.75rem' }}>
              <RefreshCw size={38} className="spin" />
              <div style={{ fontWeight: 700, fontSize: '1rem' }}>Running YOLO Neural Inference...</div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Analyzing components & netlist topology</div>
            </div>
          )}

          {/* Error Message Alert Banner */}
          {errorMessage && (
            <div style={{ position: 'absolute', margin: '1rem', color: '#f87171', background: 'rgba(239, 68, 68, 0.18)', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #ef4444', fontSize: '0.82rem', textAlign: 'center' }}>
              ⚠️ {errorMessage}
            </div>
          )}
        </div>

        {/* Primary Action Button Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={startPhoneCamera}
              style={{
                flex: 1,
                background: status === 'streaming' ? '#0284c7' : '#1e293b',
                color: '#fff',
                border: '1px solid #334155',
                borderRadius: '8px',
                padding: '0.75rem',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem'
              }}
            >
              <Camera size={18} /> {status === 'streaming' ? 'RESTART' : 'START CAMERA'}
            </button>

            {status === 'streaming' && (
              <button
                onClick={capturePhotoFromStream}
                style={{
                  flex: 1,
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.75rem',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                }}
              >
                <Camera size={18} /> CAPTURE PHOTO
              </button>
            )}

            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                flex: 1,
                background: '#1e293b',
                color: '#f8fafc',
                border: '1px solid #334155',
                borderRadius: '8px',
                padding: '0.75rem',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem'
              }}
            >
              <Upload size={18} /> UPLOAD PHOTO
            </button>
          </div>

          {/* Analyze Circuit Button */}
          {capturedImage && status !== 'analyzing' && (
            <button
              onClick={analyzeCapturedCircuit}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: '10px',
                padding: '0.9rem',
                fontSize: '1rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)'
              }}
            >
              <Sparkles size={20} /> ANALYZE CIRCUIT WITH AI
            </button>
          )}
        </div>

        {/* PART 13 — AI ANALYSIS RESULT CARD */}
        {status === 'complete' && analysisResult && (
          <div style={{
            background: '#0f172a',
            border: '1px solid #38bdf8',
            borderRadius: '12px',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#38bdf8', fontWeight: 700, fontSize: '1.05rem' }}>
              <CheckCircle2 size={22} style={{ color: '#10b981' }} />
              AI Analysis Complete
            </div>

            <div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.5rem', fontWeight: 600 }}>DETECTED COMPONENTS:</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', fontSize: '0.82rem' }}>
                <div style={{ background: '#1e293b', padding: '0.4rem 0.6rem', borderRadius: '6px' }}>Resistor: <strong style={{ color: '#f97316' }}>{counts.resistor || 0}</strong></div>
                <div style={{ background: '#1e293b', padding: '0.4rem 0.6rem', borderRadius: '6px' }}>LED: <strong style={{ color: '#22c55e' }}>{counts.led || 0}</strong></div>
                <div style={{ background: '#1e293b', padding: '0.4rem 0.6rem', borderRadius: '6px' }}>Capacitor: <strong style={{ color: '#3b82f6' }}>{counts.capacitor || 0}</strong></div>
                <div style={{ background: '#1e293b', padding: '0.4rem 0.6rem', borderRadius: '6px' }}>Diode: <strong style={{ color: '#d946ef' }}>{counts.diode_rectifier || 0}</strong></div>
                <div style={{ background: '#1e293b', padding: '0.4rem 0.6rem', borderRadius: '6px' }}>Wire: <strong style={{ color: '#38bdf8' }}>{counts.wire || 0}</strong></div>
                <div style={{ background: '#1e293b', padding: '0.4rem 0.6rem', borderRadius: '6px' }}>IC Chip: <strong style={{ color: '#eab308' }}>{counts.ic_chip || 0}</strong></div>
              </div>
            </div>

            <div style={{ fontSize: '0.82rem', background: '#1e293b', padding: '0.5rem 0.75rem', borderRadius: '6px', display: 'flex', justifyContent: 'space-between' }}>
              <span>Reconstructed Net Nodes:</span>
              <strong style={{ color: '#38bdf8' }}>{analysisResult.netlist?.nodes?.length || analysisResult.nets_summary?.length || 0} Nodes</strong>
            </div>

            {/* Navigation Action Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button
                onClick={() => navigate('/scanner')}
                style={{
                  background: '#2563eb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.75rem',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}
              >
                <Eye size={18} /> VIEW CIRCUIT DETAILS
              </button>

              <button
                onClick={() => navigate('/simulator')}
                style={{
                  background: '#059669',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.75rem',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}
              >
                <Box size={18} /> OPEN 3D SIMULATOR
              </button>

              <button
                onClick={() => navigate('/scanner')}
                style={{
                  background: '#1e293b',
                  color: '#94a3b8',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  padding: '0.6rem',
                  fontWeight: 600,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem'
                }}
              >
                BACK TO SCANNER
              </button>
            </div>
          </div>
        )}

        {/* Info Banner */}
        <div style={{ fontSize: '0.78rem', color: '#64748b', textAlign: 'center', lineHeight: 1.4, padding: '0.5rem' }}>
          <ShieldCheck size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle', color: '#38bdf8' }} />
          FastAPI backend running at <code style={{ color: '#38bdf8' }}>{API_BASE_URL}</code> performs trained YOLO component detection & netlist reconstruction.
        </div>
      </main>
    </div>
  );
}
