import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useCircuit } from '../context/CircuitContext';
import { requestLiveCameraAnalysis, applyCircuitCorrection } from '../services/analysisService';
import { API_BASE_URL, FRONTEND_BASE_URL, WS_BASE_URL } from '../services/api';
import { getIceServers } from '../config/webrtc';
import { computeCircuitSignature, hasCircuitTopologyChanged } from '../utils/circuitSignature';
import Breadboard3DCanvas from '../components/Breadboard3DCanvas';
import ComponentMeasurementCard from '../components/ComponentMeasurementCard';
import PowerSourcePanel from '../components/PowerSourcePanel';
import SimulationControls from '../components/SimulationControls';
import ValueInputModal from '../components/ValueInputModal';
import ManualComponentModal from '../components/ManualComponentModal';
import UserCorrectionModal from '../components/UserCorrectionModal';
import ARCameraOverlay from '../components/ARCameraOverlay';
import DigitalChangeConfirmModal from '../components/DigitalChangeConfirmModal';
import WhatIfComparisonModal from '../components/WhatIfComparisonModal';
import CircuitAssistant from '../components/CircuitAssistant';
import VisualGroundingPanel from '../components/VisualGroundingPanel';
import { Camera, CameraOff, RefreshCw, Zap, Layers, Smartphone, Monitor, QrCode, Wifi, CheckCircle2, Download, Upload, Sparkles, ShieldCheck, Cpu, MessageSquare, Eye } from 'lucide-react';

export default function LiveCamera() {
  const {
    activeCircuit,
    setActiveCircuit,
    measurements,
    setMeasurements,
    solverStatus,
    setSolverStatus,
    solverError,
    simulationResult,
    setSimulationResult,
    runElectricalAnalysis,
    setSelectedComponent,
    simulationSource,
    applyDigitalComponentValue,
    updateComponentTerminals,
    applyBackendCorrection,
    startWhatIf,
    applyWhatIfToCircuit,
    cancelWhatIf,
    whatIfState,
    exportDigitalCircuitJson,
    importDigitalCircuitJson,
    isEditMode,
    setIsEditMode,
    undoDigitalEdit,
    redoDigitalEdit,
    resetDigitalChanges,
    canUndo,
    canRedo
  } = useCircuit();

  // Camera Source Mode: 'phone' (Default flagship) | 'laptop'
  const [cameraSource, setCameraSource] = useState('phone');

  // Phone Camera WebRTC & Session State
  const [sessionId, setSessionId] = useState('');
  const [lanIp, setLanIp] = useState('');
  const [phoneConnected, setPhoneConnected] = useState(false);
  const [phoneSignalingStep, setPhoneSignalingStep] = useState('idle'); // idle, ws_connecting, phone_found, offer_received, answer_sent, ice_checking, phone_ready, failed

  // Camera Stream Lifecycle State: 'idle' | 'requesting' | 'connected' | 'video_ready' | 'error'
  const [cameraStatus, setCameraStatus] = useState('idle');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [compareMode, setCompareMode] = useState(true);
  const [videoDimensions, setVideoDimensions] = useState({ width: 0, height: 0 });

  // Analysis & Tracking State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [scanStatus, setScanStatus] = useState('idle'); // idle, scanning, stable, desynced, error
  const [events, setEvents] = useState([]);
  const [latestToast, setLatestToast] = useState(null);
  const [previousState, setPreviousState] = useState(null);
  const [detections, setDetections] = useState([]);
  const [visionVerification, setVisionVerification] = useState({
    raw_count: 0,
    verified_count: 0,
    unknown_count: 0,
    rejected_count: 0,
    verified: [],
    unknown: [],
    rejected: [],
    all_candidates: []
  });
  const [showVisionDebug, setShowVisionDebug] = useState(false);

  // Phase 19: Circuit Intelligence & Topology State
  const [circuitIntelligence, setCircuitIntelligence] = useState({
    component_intelligence: [],
    node_graph: { nodes: [], components: [] },
    topology: { status: 'VALID', series_count: 0, parallel_count: 0, series_groups: [], parallel_groups: [], short_circuits: [] },
    summary: {}
  });

  // Phase 20: LLM Circuit Assistant State
  const [showAssistant, setShowAssistant] = useState(false);
  // Phase 22.1: Visual Grounding State
  const [showVisualGrounding, setShowVisualGrounding] = useState(false);
  // Phase 22.2: Highlighted Component State
  const [highlightedComponentId, setHighlightedComponentId] = useState(null);

  // Deterministic Visual Grounding State Memoization
  const currentVisualGroundingState = useMemo(() => {
    const comps = (activeCircuit?.components || []).map(c => {
      const cid = c.id || c.designator;
      const tA = c.terminals?.terminal_a || {};
      const tB = c.terminals?.terminal_b || {};
      const h1 = c.hole1 || c.start_hole || tA.hole;
      const h2 = c.hole2 || c.end_hole || tB.hole;
      const isAmbig = h1 === 'AMBIGUOUS' || h2 === 'AMBIGUOUS';
      const isUnknown = c.verification === 'UNKNOWN' || c.type === 'unknown';
      const isUserConf = c.source === 'USER_CONFIRMED' || c.user_override_value != null;

      let status = 'VERIFIED';
      if (isUnknown) status = 'UNKNOWN';
      else if (isAmbig) status = 'AMBIGUOUS';
      else if (isUserConf) status = 'USER_CONFIRMED';

      return {
        id: cid,
        designator: cid,
        type: c.type || 'resistor',
        value: c.value,
        unit: c.unit || 'Ω',
        display_value: c.displayValue || c.formatted_value || c.user_override_value || `${c.value || ''} ${c.unit || 'Ω'}`.trim() || 'Unknown',
        status: status,
        source: c.source || 'ai',
        verified: (status === 'VERIFIED' || status === 'USER_CONFIRMED'),
        terminals: {
          terminal_a: {
            name: 'terminal_a',
            hole: h1 && h1 !== 'AMBIGUOUS' && h1 !== 'UNKNOWN' ? h1 : null,
            status: isAmbig ? 'AMBIGUOUS' : (isUnknown ? 'UNKNOWN' : (isUserConf ? 'USER_CONFIRMED' : 'VERIFIED')),
            pixel: tA.pixel || c.t1_img || null,
            electrical_node: c.node1 || tA.electrical_node || (h1 ? `NODE_HOLE_${h1}` : null)
          },
          terminal_b: {
            name: 'terminal_b',
            hole: h2 && h2 !== 'AMBIGUOUS' && h2 !== 'UNKNOWN' ? h2 : null,
            status: isAmbig ? 'AMBIGUOUS' : (isUnknown ? 'UNKNOWN' : (isUserConf ? 'USER_CONFIRMED' : 'VERIFIED')),
            pixel: tB.pixel || c.t2_img || null,
            electrical_node: c.node2 || tB.electrical_node || (h2 ? `NODE_HOLE_${h2}` : null)
          }
        },
        image_geometry: {
          bbox: c.bbox || c.bbox_pixels || [],
          center: c.center || (c.center_x !== undefined && c.center_y !== undefined ? [c.center_x, c.center_y] : null)
        }
      };
    });

    const canonicalHoles = {};
    comps.forEach(c => {
      const h1 = c.terminals?.terminal_a?.hole;
      const h2 = c.terminals?.terminal_b?.hole;
      if (h1) canonicalHoles[h1] = { hole: h1, status: 'VERIFIED', pixel: c.terminals.terminal_a.pixel };
      if (h2) canonicalHoles[h2] = { hole: h2, status: 'VERIFIED', pixel: c.terminals.terminal_b.pixel };
    });

    const simComps = simulationResult?.components || [];
    const simCurrents = {};
    const simPowers = {};
    simComps.forEach(sc => {
      const scid = sc.id || sc.designator;
      if (scid) {
        simCurrents[scid] = sc.current;
        simPowers[scid] = sc.power;
      }
    });

    return {
      schema_version: '22.1',
      circuit_signature: computeCircuitSignature(activeCircuit || {}),
      overall_status: activeCircuit?.validity?.status === 'PASS' ? 'VERIFIED' : 'PARTIALLY_VERIFIED',
      summary: {
        component_count: comps.length,
        verified_components: comps.filter(c => c.verified).length,
        wires_count: (activeCircuit?.wires || []).length,
        simulation_status: solverStatus === 'SOLVED' ? 'SOLVED' : 'NOT_RUN'
      },
      components: comps,
      wires: activeCircuit?.wires || [],
      nodes: circuitIntelligence?.node_graph?.nodes || [],
      canonical_holes: canonicalHoles,
      diagnostics: [],
      rejected_detections: visionVerification?.rejected || [],
      simulation: {
        status: solverStatus === 'SOLVED' ? 'SOLVED' : 'NOT_RUN',
        source: 'MNA',
        voltages: simulationResult?.node_voltages || {},
        currents: simCurrents,
        powers: simPowers
      }
    };
  }, [activeCircuit, circuitIntelligence, visionVerification, simulationResult, solverStatus]);

  // Live Tracking Metrics State
  const [trackingMetrics, setTrackingMetrics] = useState({
    detected: 0,
    tracked: 0,
    lost: 0,
    fps: 0,
    latency: 0,
    backendConnected: true
  });

  const [registration, setRegistration] = useState(null);
  const [renderFps, setRenderFps] = useState(60);
  const frameCountRef = useRef(0);
  const lastFpsTimeRef = useRef(typeof performance !== 'undefined' ? performance.now() : Date.now());
  const rafIdRef = useRef(null);

  // Fast Visual Tracking Loop (rAF for render FPS and visual synchronization)
  useEffect(() => {
    const measureRenderLoop = () => {
      frameCountRef.current += 1;
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (now - lastFpsTimeRef.current >= 500) {
        const calculated = Math.round((frameCountRef.current * 1000) / (now - lastFpsTimeRef.current));
        setRenderFps(Math.min(Math.max(calculated, 1), 120));
        frameCountRef.current = 0;
        lastFpsTimeRef.current = now;
      }
      rafIdRef.current = requestAnimationFrame(measureRenderLoop);
    };
    rafIdRef.current = requestAnimationFrame(measureRenderLoop);
    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, []);

  // Modals & Digital Lab State
  const [valueModalComp, setValueModalComp] = useState(null);
  const [manualModalComp, setManualModalComp] = useState(null);
  const [correctionModalComp, setCorrectionModalComp] = useState(null);
  const [digitalConfirmData, setDigitalConfirmData] = useState({
    isOpen: false,
    component: null,
    oldValue: '',
    newValue: '',
    rawVal: '',
    rawUnit: ''
  });

  // DOM & WebRTC Refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);
  const videoContainerRef = useRef(null);
  const streamRef = useRef(null);
  const sampleTimer = useRef(null);
  const wsRef = useRef(null);
  const pcRef = useRef(null);
  const pendingIceCandidatesRef = useRef([]);
  const isAnalyzingRef = useRef(false);
  const lastFrameTimeRef = useRef(Date.now());
  const fileInputRef = useRef(null);

  // 1. Generate Session ID & Fetch LAN IP for Phone Pairing
  const generateNewSession = useCallback(() => {
    const newId = 'SB3D-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    setSessionId(newId);
    setPhoneConnected(false);
    setPhoneSignalingStep('idle');
    return newId;
  }, []);

  useEffect(() => {
    generateNewSession();

    // Fetch Laptop LAN IP from backend for QR code generation
    fetch(`${API_BASE_URL}/api/lan-ip`)
      .then(res => res.json())
      .then(data => {
        if (data && data.lan_ip) {
          setLanIp(data.lan_ip);
        }
      })
      .catch(e => {
        console.warn("Could not fetch LAN IP, falling back to window.location.hostname:", e);
      });
  }, [generateNewSession]);

  // Check if video is truly ready with valid dimensions and frame data
  const checkVideoReady = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
      console.log(`[WebRTC] Video stream ready: ${video.videoWidth}x${video.videoHeight} (readyState: ${video.readyState})`);
      setVideoDimensions({ width: video.videoWidth, height: video.videoHeight });
      setCameraStatus('video_ready');
      setPhoneSignalingStep('phone_ready');
      setCameraActive(true);
      setScanStatus('scanning');
    }
  }, []);

  // Phone Camera WebRTC Signaling Connection
  const initPhoneSignaling = useCallback((sessId) => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    pendingIceCandidatesRef.current = [];

    const wsUrl = `${WS_BASE_URL}/ws/camera/${sessId}?role=laptop`;
    console.log("[Laptop] Connecting signaling WebSocket:", wsUrl);

    setPhoneSignalingStep('ws_connecting');
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[WebRTC] laptop signalingState: connected for session:", sessId);
    };

    ws.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === 'peer_status') {
          if (msg.status === 'connected') {
            console.log("[WebRTC] laptop peer_status: phone connected to pairing session!");
            setPhoneConnected(true);
            setPhoneSignalingStep('phone_found');
          } else if (msg.status === 'disconnected') {
            console.log("[WebRTC] laptop peer_status: phone disconnected");
            setPhoneConnected(false);
            setCameraStatus('idle');
            setPhoneSignalingStep('idle');
            setScanStatus('idle');
            if (pcRef.current) {
              pcRef.current.close();
              pcRef.current = null;
            }
          }
        } else if (msg.type === 'offer') {
          console.log("[WebRTC] laptop received offer SDP from phone");
          setPhoneSignalingStep('offer_received');

          if (pcRef.current) {
            pcRef.current.close();
            pcRef.current = null;
          }

          const pc = new RTCPeerConnection({ iceServers: getIceServers() });
          pcRef.current = pc;

          // Bug 3: Connection State Logging
          pc.onconnectionstatechange = () => {
            console.log("[WebRTC] laptop connectionState:", pc.connectionState);
            if (pc.connectionState === 'connected') {
              checkVideoReady();
            } else if (pc.connectionState === 'connecting') {
              setPhoneSignalingStep('ice_checking');
            } else if (pc.connectionState === 'failed') {
              setPhoneSignalingStep('failed');
            }
          };

          pc.oniceconnectionstatechange = () => {
            console.log("[WebRTC] laptop iceConnectionState:", pc.iceConnectionState);
            if (pc.iceConnectionState === 'checking') {
              setPhoneSignalingStep('ice_checking');
            } else if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
              checkVideoReady();
            } else if (pc.iceConnectionState === 'failed') {
              setPhoneSignalingStep('failed');
            }
          };

          pc.onsignalingstatechange = () => {
            console.log("[WebRTC] laptop signalingState:", pc.signalingState);
          };

          pc.ontrack = async (e) => {
            console.log("[WebRTC] laptop received remote video stream track from phone!", e.streams[0]);
            if (videoRef.current && e.streams[0]) {
              videoRef.current.srcObject = e.streams[0];
              try {
                await videoRef.current.play();
                console.log("[WebRTC] laptop video play initiated successfully");
              } catch (playErr) {
                console.warn("[WebRTC] laptop remote video play notice:", playErr);
              }
              checkVideoReady();
            }
          };

          pc.onicecandidate = (e) => {
            if (e.candidate && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'ice_candidate', candidate: e.candidate }));
            }
          };

          await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: msg.sdp }));
          console.log("[WebRTC] laptop setRemoteDescription(offer) success");

          // Flush queued ICE candidates
          if (pendingIceCandidatesRef.current.length > 0) {
            console.log(`[WebRTC] laptop flushing ${pendingIceCandidatesRef.current.length} queued ICE candidates`);
            for (const candidate of pendingIceCandidatesRef.current) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
              } catch (iceErr) {
                console.warn("[WebRTC] laptop queued ICE candidate error:", iceErr);
              }
            }
            pendingIceCandidatesRef.current = [];
          }

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          console.log("[WebRTC] laptop created answer & setLocalDescription");

          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'answer', sdp: answer.sdp }));
            console.log("[WebRTC] laptop sent answer SDP to phone");
            setPhoneSignalingStep('answer_sent');
          }
        } else if (msg.type === 'ice_candidate' && msg.candidate) {
          const pc = pcRef.current;
          if (!pc || !pc.remoteDescription || !pc.remoteDescription.type) {
            console.log("[WebRTC] laptop queuing ICE candidate before remote description");
            pendingIceCandidatesRef.current.push(msg.candidate);
          } else {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
            } catch (iceErr) {
              console.warn("[WebRTC] laptop addIceCandidate error:", iceErr);
            }
          }
        }
      } catch (e) {
        console.warn("[Laptop WS] Message error:", e);
      }
    };

    ws.onerror = (e) => {
      console.warn("[Laptop WS] Signaling error:", e);
      setPhoneSignalingStep('failed');
    };

    ws.onclose = () => {
      console.log("[Laptop WS] Signaling closed");
    };
  }, [checkVideoReady]);

  useEffect(() => {
    if (cameraSource === 'phone' && sessionId && !isDemoMode) {
      initPhoneSignaling(sessionId);
    }

    return () => {
      if (wsRef.current) wsRef.current.close();
      if (pcRef.current) pcRef.current.close();
    };
  }, [cameraSource, sessionId, isDemoMode, initPhoneSignaling]);


  const handleVideoLoadedMetadata = () => {
    if (videoRef.current) {
      videoRef.current.play().catch(e => console.warn("Video play error on metadata load:", e));
    }
    checkVideoReady();
  };

  const handleVideoCanPlay = () => {
    checkVideoReady();
  };

  // 2. Start Physical Laptop Webcam Fallback
  const startLaptopCamera = async () => {
    stopCamera();
    setCameraError(null);
    setIsDemoMode(false);
    setCameraSource('laptop');
    setCameraStatus('requesting');

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Webcam API (navigator.mediaDevices.getUserMedia) is not supported in this browser.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "environment" },
        audio: false
      });

      const tracks = stream.getVideoTracks();
      if (!tracks || tracks.length === 0 || !tracks[0].enabled) {
        throw new Error("Webcam stream acquired but no active video track found.");
      }

      streamRef.current = stream;
      setCameraStatus('connected');

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (playErr) {
          console.warn("video.play() warning:", playErr);
        }
      }

      checkVideoReady();
    } catch (err) {
      console.warn("Laptop camera start error:", err);
      setCameraError(err.message || "Failed to access laptop webcam. Please check permissions or try Demo Camera mode.");
      setCameraStatus('error');
      setCameraActive(false);
    }
  };

  // 3. Stop Camera Stream
  const stopCamera = useCallback(() => {
    if (sampleTimer.current) {
      clearInterval(sampleTimer.current);
      sampleTimer.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
    if (overlayRef.current) {
      const ctx = overlayRef.current.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, overlayRef.current.width, overlayRef.current.height);
    }
    setCameraActive(false);
    setCameraStatus('idle');
    setScanStatus('idle');
    setDetections([]);
    setVideoDimensions({ width: 0, height: 0 });
  }, []);

  // 4. Enable Demo Camera Mode
  const startDemoMode = async () => {
    stopCamera();
    setIsDemoMode(true);
    setCameraError(null);
    setCameraStatus('idle');
    setScanStatus('scanning');
    analyzeFrameFromAsset();
  };

  // 5. Capture Frame from Video / Canvas (Works for both Phone WebRTC & Laptop Webcam)
  const captureFrameBase64 = () => {
    if (isDemoMode) {
      return null;
    }

    if (!videoRef.current || !canvasRef.current || cameraStatus !== 'video_ready') {
      return null;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || video.paused || video.ended || video.videoWidth === 0 || video.videoHeight === 0) {
      return null;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85);
  };

  // 6. Draw Bounding Box Visual Overlay over Camera Preview with State-Based Color Codes
  const drawOverlayDetections = (dets, imgW = 800, imgH = 600) => {
    if (!overlayRef.current) return;
    const overlay = overlayRef.current;
    const ctx = overlay.getContext('2d');
    if (!ctx) return;

    const width = overlay.clientWidth || 800;
    const height = overlay.clientHeight || 600;
    if (overlay.width !== width || overlay.height !== height) {
      overlay.width = width;
      overlay.height = height;
    }

    ctx.clearRect(0, 0, overlay.width, overlay.height);

    if (!dets || dets.length === 0) return;

    const sourceW = (videoRef.current && videoRef.current.videoWidth > 0) ? videoRef.current.videoWidth : imgW;
    const sourceH = (videoRef.current && videoRef.current.videoHeight > 0) ? videoRef.current.videoHeight : imgH;

    const scaleX = overlay.width / Math.max(sourceW, 1);
    const scaleY = overlay.height / Math.max(sourceH, 1);

    dets.forEach(d => {
      const bbox = d.bbox || d.bbox_pixels || [100, 100, 200, 200];
      const x1 = bbox[0] * scaleX;
      const y1 = bbox[1] * scaleY;
      const bw = (bbox[2] - bbox[0]) * scaleX;
      const bh = (bbox[3] - bbox[1]) * scaleY;
      
      const state = (d.tracking_state || 'TRACKED').toUpperCase();
      let strokeColor = '#10b981'; // TRACKED
      if (state === 'DETECTED') strokeColor = '#38bdf8';
      else if (state === 'REACQUIRED') strokeColor = '#f59e0b';
      else if (state === 'LOST') strokeColor = '#ef4444';

      ctx.save();
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2.5;
      if (state === 'LOST') {
        ctx.setLineDash([6, 4]);
      } else {
        ctx.setLineDash([]);
      }
      ctx.strokeRect(x1, y1, bw, bh);

      const confPct = Math.round((d.confidence || d.tracking_confidence || 0.9) * 100);
      const label = `${d.designator || d.id || 'Comp'} • ${(d.type || d.class || 'Component').toUpperCase()} (${confPct}%) [${state}]`;

      ctx.font = 'bold 11px Inter, sans-serif';
      const textWidth = ctx.measureText(label).width;
      
      ctx.fillStyle = 'rgba(8, 12, 24, 0.92)';
      ctx.fillRect(x1, Math.max(0, y1 - 22), textWidth + 12, 22);
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(x1, Math.max(0, y1 - 22), textWidth + 12, 22);

      ctx.fillStyle = strokeColor;
      ctx.fillText(label, x1 + 6, Math.max(15, y1 - 7));
      ctx.restore();
    });
  };

  // 7. Analyze Single Frame via FastAPI `/api/camera/analyze`
  const processFrameAnalysis = async (frameB64) => {
    if (isAnalyzingRef.current) return;
    isAnalyzingRef.current = true;
    setIsAnalyzing(true);

    try {
      let b64Payload = frameB64;

      if (!b64Payload || isDemoMode) {
        b64Payload = await fetchDemoAssetBase64();
      }

      if (!b64Payload) {
        isAnalyzingRef.current = false;
        setIsAnalyzing(false);
        return;
      }

      const pSource = simulationSource ? {
        id: "V_USER_SIMULATED",
        type: "dc",
        voltage: simulationSource.value || 12.0,
        positive_node: simulationSource.positiveNode || "NET_VCC (+5V)",
        negative_node: simulationSource.negativeNode || "NET_GND (0V)",
        source: "user_simulated"
      } : null;

      const res = await requestLiveCameraAnalysis(b64Payload, previousState, pSource);

      if (res && res.status === 'success') {
        const now = Date.now();
        const deltaSec = (now - lastFrameTimeRef.current) / 1000.0;
        lastFrameTimeRef.current = now;
        const currentFps = deltaSec > 0 ? Math.min(Math.round(1.0 / deltaSec), 30) : 3;

        const summary = res.tracking_summary || {};
        setTrackingMetrics({
          detected: summary.detected_count !== undefined ? summary.detected_count : (res.mapped_components || []).length,
          tracked: summary.tracked_count !== undefined ? summary.tracked_count : (res.mapped_components || []).filter(c => c.tracking_state === 'TRACKED').length,
          lost: summary.lost_count !== undefined ? summary.lost_count : (res.mapped_components || []).filter(c => c.tracking_state === 'LOST').length,
          fps: currentFps,
          latency: res.latency_ms || 110,
          backendConnected: true
        });

        if (res.vision_verification) {
          setVisionVerification(res.vision_verification);
        }

        if (res.circuit_intelligence) {
          setCircuitIntelligence(res.circuit_intelligence);
        } else if (res.topology) {
          setCircuitIntelligence(prev => ({
            ...prev,
            topology: res.topology,
            node_graph: res.node_graph || prev.node_graph
          }));
        }

        setDetections(res.mapped_components || res.detections || []);
        drawOverlayDetections(res.mapped_components || res.detections || []);
        setRegistration(res.registration || null);

        if (res.change_events && res.change_events.length > 0) {
          setEvents(prev => [...res.change_events, ...prev].slice(0, 10));
          setLatestToast(res.change_events[0]);
          setTimeout(() => setLatestToast(null), 4000);
        }

        setScanStatus(res.stable ? 'stable' : 'desynced');

        if (res.netlist) {
          const updatedNetlist = {
            ...res.netlist,
            source: cameraSource === 'phone' ? 'phone_webrtc' : 'laptop_camera',
            power_supply: simulationSource ? { voltage: simulationSource.value } : { voltage: 12.0 }
          };
          setActiveCircuit(updatedNetlist);
          setPreviousState({ components: res.mapped_components || [] });

          if (res.electrical_analysis && res.electrical_analysis.measurements) {
            runElectricalAnalysis();
          }
        }
      } else {
        setTrackingMetrics(prev => ({ ...prev, backendConnected: false }));
      }
    } catch (e) {
      console.warn("Live camera analysis error:", e);
      setTrackingMetrics(prev => ({ ...prev, backendConnected: false }));
    } finally {
      isAnalyzingRef.current = false;
      setIsAnalyzing(false);
    }
  };

  const analyzeFrameFromAsset = () => {
    processFrameAnalysis(null);
  };

  // 8. Frame Sampling Loop (Controlled 3–5 FPS with concurrency lock)
  useEffect(() => {
    if (cameraStatus === 'video_ready' && !isDemoMode) {
      sampleTimer.current = setInterval(() => {
        const frame = captureFrameBase64();
        if (frame) {
          processFrameAnalysis(frame);
        }
      }, 300); // ~3-4 FPS for optimal real-time tracking stability
    } else {
      if (sampleTimer.current) clearInterval(sampleTimer.current);
    }

    return () => {
      if (sampleTimer.current) clearInterval(sampleTimer.current);
    };
  }, [cameraStatus, isDemoMode, previousState, simulationSource]);

  useEffect(() => {
    return () => {
      stopCamera();
      if (wsRef.current) wsRef.current.close();
      if (pcRef.current) pcRef.current.close();
    };
  }, [stopCamera]);

  const comps = activeCircuit?.components || [];
  const phoneCameraUrl = `${FRONTEND_BASE_URL}/phone-camera?session=${sessionId}`;

  const handleExportCircuitJson = () => {
    const jsonStr = exportDigitalCircuitJson();
    if (!jsonStr) return;
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SmartBreadboard_Circuit_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportCircuitJson = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const res = importDigitalCircuitJson(event.target.result);
      if (res && res.success) {
        setLatestToast("Digital circuit imported successfully!");
        setTimeout(() => setLatestToast(null), 3000);
      } else {
        alert(res?.error || "Failed to parse circuit JSON");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleOpenWhatIfPrompt = (comp) => {
    const curVal = comp.user_override_value || comp.displayValue || comp.formatted_value || `${comp.value || 1000} ${comp.unit || 'Ω'}`;
    const candidate = window.prompt(`Enter What-If hypothetical value for ${comp.designator || comp.id}:`, curVal);
    if (candidate && candidate.trim()) {
      startWhatIf(comp, candidate.trim());
    }
  };

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1600px', margin: '0 auto', color: '#f8fafc' }}>
      {/* Hidden file input for importing circuit JSON */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImportCircuitJson}
        accept=".json,application/json"
        style={{ display: 'none' }}
      />

      {/* Top Header / Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Zap style={{ color: '#38bdf8' }} size={26} />
            INTERACTIVE AR CIRCUIT LAB
          </h2>
          <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.88rem', color: '#94a3b8' }}>
            AR Camera Overlay ↔ Digital Modification ↔ MNA Solver ↔ 3D Digital Twin Synchronized
          </p>
        </div>

        {/* Top Action Bar: Save / Load / Mode Selector */}
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={handleExportCircuitJson}
            style={{
              background: '#1e293b',
              color: '#38bdf8',
              border: '1px solid #334155',
              borderRadius: '6px',
              padding: '0.35rem 0.75rem',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
            title="Save Digital Circuit as JSON"
          >
            <Download size={14} /> Save JSON
          </button>

          <button
            onClick={() => fileInputRef.current && fileInputRef.current.click()}
            style={{
              background: '#1e293b',
              color: '#a78bfa',
              border: '1px solid #334155',
              borderRadius: '6px',
              padding: '0.35rem 0.75rem',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
            title="Load Digital Circuit from JSON"
          >
            <Upload size={14} /> Load JSON
          </button>
          {/* Camera Source Selector Pills */}
          <div style={{
            display: 'flex',
            background: '#1e293b',
            padding: '3px',
            borderRadius: '20px',
            border: '1px solid #334155'
          }}>
            <button
              onClick={() => { setCameraSource('phone'); setIsDemoMode(false); }}
              style={{
                background: cameraSource === 'phone' && !isDemoMode ? '#2563eb' : 'transparent',
                color: cameraSource === 'phone' && !isDemoMode ? '#fff' : '#94a3b8',
                border: 'none',
                borderRadius: '16px',
                padding: '0.3rem 0.8rem',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
            >
              <Smartphone size={14} /> PHONE CAMERA
            </button>
            <button
              onClick={() => { setCameraSource('laptop'); setIsDemoMode(false); startLaptopCamera(); }}
              style={{
                background: cameraSource === 'laptop' && !isDemoMode ? '#2563eb' : 'transparent',
                color: cameraSource === 'laptop' && !isDemoMode ? '#fff' : '#94a3b8',
                border: 'none',
                borderRadius: '16px',
                padding: '0.3rem 0.8rem',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
            >
              <Monitor size={14} /> LAPTOP CAMERA
            </button>
          </div>

          <span style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            background: cameraStatus === 'video_ready' ? '#064e3b' : (cameraStatus === 'connected' || cameraStatus === 'requesting' ? '#78350f' : '#334155'),
            color: cameraStatus === 'video_ready' ? '#6ee7b7' : (cameraStatus === 'connected' || cameraStatus === 'requesting' ? '#fde047' : '#cbd5e1'),
            padding: '0.4rem 0.8rem',
            borderRadius: '20px',
            fontSize: '0.8rem',
            fontWeight: 600
          }}>
            <span style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: cameraStatus === 'video_ready' ? '#10b981' : (cameraStatus === 'connected' || cameraStatus === 'requesting' ? '#eab308' : '#64748b')
            }}></span>
            {cameraStatus === 'video_ready' ? (cameraSource === 'phone' ? '🟢 PHONE CAMERA READY' : '🟢 LAPTOP CAMERA READY') : 
             cameraStatus === 'connected' ? '🟡 STREAM CONNECTED' :
             cameraStatus === 'requesting' ? '🟡 CONNECTING CAMERA...' :
             isDemoMode ? 'DEMO CAMERA MODE' : 'CAMERA STANDBY'}
          </span>

          <span style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            background: scanStatus === 'stable' ? '#064e3b' : (scanStatus === 'desynced' ? '#78350f' : '#1e293b'),
            color: scanStatus === 'stable' ? '#6ee7b7' : (scanStatus === 'desynced' ? '#fde047' : '#94a3b8'),
            padding: '0.4rem 0.8rem',
            borderRadius: '20px',
            fontSize: '0.8rem',
            fontWeight: 600
          }}>
            {scanStatus === 'stable' ? '● CIRCUIT STABLE' : (scanStatus === 'desynced' ? '🟡 DESYNC DETECTED' : '○ STANDBY')}
          </span>
        </div>
      </div>

      {/* Floating Change Event Toast */}
      {latestToast && (
        <div style={{
          position: 'fixed',
          top: '80px',
          right: '24px',
          zIndex: 9999,
          background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
          border: '1px solid #818cf8',
          borderRadius: '8px',
          padding: '0.8rem 1.2rem',
          boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
          color: '#e0e7ff',
          fontSize: '0.9rem',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem'
        }}>
          <span style={{ fontSize: '1.2rem' }}>⚡</span>
          <span>{latestToast}</span>
        </div>
      )}

      {/* Live Status HUD (Phase 16 Technical Indicator) */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.75rem',
        background: 'rgba(15, 23, 42, 0.95)',
        padding: '0.65rem 1.1rem',
        borderRadius: '8px',
        border: '1px solid rgba(56, 189, 248, 0.25)',
        marginBottom: '1rem',
        fontSize: '0.82rem',
        boxShadow: '0 4px 16px rgba(0,0,0,0.3)'
      }}>
        {/* Phase 16 Required Indicators */}
        <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* PHONE */}
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.2rem 0.55rem',
            borderRadius: '4px',
            background: phoneConnected ? 'rgba(16, 185, 129, 0.15)' : 'rgba(148, 163, 184, 0.1)',
            color: phoneConnected ? '#34d399' : '#94a3b8',
            fontWeight: 700,
            fontSize: '0.75rem'
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: phoneConnected ? '#10b981' : '#64748b' }} />
            PHONE: {phoneConnected ? 'CONNECTED' : (cameraSource === 'laptop' ? 'LAPTOP CAM' : 'DISCONNECTED')}
          </span>

          {/* TRACKING */}
          {(() => {
            const isLost = trackingMetrics.lost > 0 && trackingMetrics.tracked === 0;
            const isReacquiring = trackingMetrics.lost > 0 && trackingMetrics.tracked > 0;
            const isTracked = (cameraActive || isDemoMode) && !isLost;
            const trackingColor = isLost ? '#ef4444' : isReacquiring ? '#f59e0b' : isTracked ? '#10b981' : '#64748b';
            const trackingLabel = isLost ? 'LOST' : isReacquiring ? 'REACQUIRING' : isTracked ? 'TRACKED' : 'STANDBY';
            return (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.2rem 0.55rem',
                borderRadius: '4px',
                background: `${trackingColor}22`,
                color: trackingColor,
                fontWeight: 700,
                fontSize: '0.75rem'
              }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: trackingColor }} />
                TRACKING: {trackingLabel}
              </span>
            );
          })()}

          {/* AI */}
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.2rem 0.55rem',
            borderRadius: '4px',
            background: isAnalyzing ? 'rgba(56, 189, 248, 0.2)' : 'rgba(16, 185, 129, 0.15)',
            color: isAnalyzing ? '#38bdf8' : '#34d399',
            fontWeight: 700,
            fontSize: '0.75rem'
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: isAnalyzing ? '#38bdf8' : '#10b981' }} />
            AI: {isAnalyzing ? 'ANALYZING' : 'READY'}
          </span>

          {/* CIRCUIT */}
          {(() => {
            const isInvalid = activeCircuit?.validity?.status === 'INVALID';
            const isChanged = scanStatus === 'desynced';
            const circuitColor = isInvalid ? '#ef4444' : isChanged ? '#f59e0b' : '#10b981';
            const circuitLabel = isInvalid ? 'INVALID' : isChanged ? 'CHANGED' : 'SYNCED';
            return (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.2rem 0.55rem',
                borderRadius: '4px',
                background: `${circuitColor}22`,
                color: circuitColor,
                fontWeight: 700,
                fontSize: '0.75rem'
              }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: circuitColor }} />
                CIRCUIT: {circuitLabel}
              </span>
            );
          })()}

          {/* SIMULATION */}
          {(() => {
            const isSolved = solverStatus === 'SOLVED';
            const isUnpowered = solverStatus === 'NOT_RUN' || solverStatus === 'POWER_REQUIRED';
            const simColor = isSolved ? '#10b981' : isUnpowered ? '#f59e0b' : '#ef4444';
            const simLabel = isSolved ? 'SOLVED' : isUnpowered ? 'NOT_RUN' : 'FAULT';
            return (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.2rem 0.55rem',
                borderRadius: '4px',
                background: `${simColor}22`,
                color: simColor,
                fontWeight: 700,
                fontSize: '0.75rem'
              }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: simColor }} />
                ⚡ SIMULATION: {simLabel}
              </span>
            );
          })()}
        </div>

        {/* Live Performance & Real Measured FPS */}
        <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span>Detected: <strong style={{ color: '#38bdf8' }}>{trackingMetrics.detected}</strong></span>
          <span>Tracked: <strong style={{ color: '#10b981' }}>{trackingMetrics.tracked}</strong></span>
          <span>Lost: <strong style={{ color: trackingMetrics.lost > 0 ? '#ef4444' : '#94a3b8' }}>{trackingMetrics.lost}</strong></span>
          <span style={{ color: 'rgba(255,255,255,0.2)' }}>|</span>
          <span>AI Rate: <strong style={{ color: '#38bdf8' }}>{cameraActive ? `${trackingMetrics.fps} FPS` : '0 FPS'}</strong></span>
          <span>Render: <strong style={{ color: '#fbbf24' }}>{renderFps} FPS</strong></span>
          <span>Latency: <strong style={{ color: '#a78bfa' }}>{trackingMetrics.latency} ms</strong></span>
        </div>
      </div>

      {/* Vision Verification HUD (Phase 18 Technical Rejection Layer) */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.6rem',
        background: 'rgba(15, 23, 42, 0.90)',
        padding: '0.45rem 0.9rem',
        borderRadius: '6px',
        border: '1px solid rgba(168, 85, 247, 0.25)',
        marginBottom: '1rem',
        fontSize: '0.80rem'
      }}>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, color: '#c084fc', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <ShieldCheck size={14} /> VISION VERIFIER:
          </span>
          <span style={{ padding: '0.15rem 0.45rem', borderRadius: '4px', background: '#1e293b', color: '#94a3b8' }}>
            RAW <strong>{visionVerification.raw_count}</strong>
          </span>
          <span style={{ padding: '0.15rem 0.45rem', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
            VERIFIED <strong>{visionVerification.verified_count}</strong>
          </span>
          <span style={{ padding: '0.15rem 0.45rem', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>
            UNKNOWN <strong>{visionVerification.unknown_count}</strong>
          </span>
          <span style={{ padding: '0.15rem 0.45rem', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171' }}>
            REJECTED <strong>{visionVerification.rejected_count}</strong>
          </span>
        </div>

        <button
          onClick={() => setShowVisionDebug(prev => !prev)}
          style={{
            background: showVisionDebug ? '#7c3aed' : '#334155',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            padding: '0.25rem 0.6rem',
            fontSize: '0.75rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.3rem'
          }}
        >
          {showVisionDebug ? 'Hide Rejection Diagnostics' : 'Inspect Rejection Reasons'}
        </button>
      </div>

      {/* Expandable Rejection Diagnostics Panel */}
      {showVisionDebug && (
        <div style={{
          background: '#0b0f19',
          border: '1px solid #4c1d95',
          borderRadius: '8px',
          padding: '0.75rem 1rem',
          marginBottom: '1rem',
          fontSize: '0.78rem',
          maxHeight: '220px',
          overflowY: 'auto'
        }}>
          <div style={{ fontWeight: 700, color: '#e0e7ff', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
            <span>Candidate Lifecycle & Verification Audit</span>
            <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>Phase 18 Decision Engine</span>
          </div>
          {visionVerification.all_candidates && visionVerification.all_candidates.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {visionVerification.all_candidates.map((cand, idx) => {
                const vState = cand.verification;
                const badgeColor = vState === 'VERIFIED' ? '#34d399' : vState === 'UNKNOWN' ? '#fbbf24' : '#f87171';
                const badgeBg = vState === 'VERIFIED' ? 'rgba(16, 185, 129, 0.15)' : vState === 'UNKNOWN' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)';
                return (
                  <div key={cand.detection_id || idx} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: '#131b2e',
                    padding: '0.35rem 0.6rem',
                    borderRadius: '4px',
                    borderLeft: `3px solid ${badgeColor}`
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <strong style={{ color: '#e2e8f0' }}>{cand.detection_id || cand.id}</strong>
                      <span style={{ color: '#94a3b8' }}>{cand.class} (conf: {Math.round((cand.confidence || 0) * 100)}%)</span>
                      <span style={{
                        padding: '0.1rem 0.4rem',
                        borderRadius: '3px',
                        fontSize: '0.70rem',
                        fontWeight: 700,
                        background: badgeBg,
                        color: badgeColor
                      }}>
                        {vState}
                      </span>
                    </div>
                    <div style={{ color: '#94a3b8', fontSize: '0.72rem', maxWidth: '50%', textAlign: 'right' }}>
                      reasons: <span style={{ color: '#cbd5e1' }}>{(cand.reasons || []).join(', ')}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ color: '#64748b', fontStyle: 'italic' }}>No candidate detections in current frame buffer.</div>
          )}
        </div>
      )}

      {/* Phase 19: Circuit Intelligence & Topology Reasoning HUD */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.6rem',
        background: 'rgba(15, 23, 42, 0.90)',
        padding: '0.45rem 0.9rem',
        borderRadius: '6px',
        border: '1px solid rgba(56, 189, 248, 0.25)',
        marginBottom: '1rem',
        fontSize: '0.80rem'
      }}>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <Cpu size={14} /> CIRCUIT INTELLIGENCE & TOPOLOGY:
          </span>
          <span style={{ padding: '0.15rem 0.45rem', borderRadius: '4px', background: '#1e293b', color: '#94a3b8' }}>
            NODES <strong>{circuitIntelligence.node_graph?.nodes?.length || 0}</strong>
          </span>
          <span style={{ padding: '0.15rem 0.45rem', borderRadius: '4px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
            SERIES <strong>{circuitIntelligence.topology?.series_count || 0}</strong>
          </span>
          <span style={{ padding: '0.15rem 0.45rem', borderRadius: '4px', background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc' }}>
            PARALLEL <strong>{circuitIntelligence.topology?.parallel_count || 0}</strong>
          </span>
          <span style={{
            padding: '0.15rem 0.45rem',
            borderRadius: '4px',
            background: circuitIntelligence.topology?.status === 'VALID' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            color: circuitIntelligence.topology?.status === 'VALID' ? '#34d399' : '#f87171',
            fontWeight: 700
          }}>
            TOPOLOGY: {circuitIntelligence.topology?.status || 'VALID'}
          </span>
          <span style={{
            padding: '0.15rem 0.45rem',
            borderRadius: '4px',
            background: activeCircuit?.validity?.status === 'VALID' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            color: activeCircuit?.validity?.status === 'VALID' ? '#34d399' : '#f87171',
            fontWeight: 700
          }}>
            NETLIST: {activeCircuit?.validity?.status === 'VALID' ? 'READY' : 'BLOCKED'}
          </span>
        </div>

        <button
          onClick={() => setShowAssistant(!showAssistant)}
          style={{
            background: showAssistant ? '#6366f1' : 'rgba(99, 102, 241, 0.20)',
            color: showAssistant ? '#ffffff' : '#c7d2fe',
            border: '1px solid #6366f1',
            borderRadius: '5px',
            padding: '0.25rem 0.65rem',
            fontSize: '0.78rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            transition: 'all 0.2s ease'
          }}
        >
          <MessageSquare size={14} />
          {showAssistant ? 'Hide Circuit Assistant' : '💬 Circuit Assistant'}
        </button>

        <button
          onClick={() => setShowVisualGrounding(!showVisualGrounding)}
          style={{
            background: showVisualGrounding ? '#0ea5e9' : 'rgba(14, 165, 233, 0.20)',
            color: showVisualGrounding ? '#ffffff' : '#7dd3fc',
            border: '1px solid #0ea5e9',
            borderRadius: '5px',
            padding: '0.25rem 0.65rem',
            fontSize: '0.78rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            transition: 'all 0.2s ease'
          }}
        >
          <Eye size={14} />
          {showVisualGrounding ? 'Hide Visual Grounding' : '👁️ Visual Grounding'}
        </button>
      </div>

      {/* Phase 20: Circuit Assistant Drawer / Panel */}
      {showAssistant && (
        <div style={{ marginBottom: '1.25rem' }}>
          <CircuitAssistant
            circuitContext={{
              components: activeCircuit?.components || [],
              topology: circuitIntelligence?.topology || {},
              node_graph: circuitIntelligence?.node_graph || {},
              solverStatus: solverStatus,
              simulationResult: simulationResult,
              measurements: measurements,
              validity: activeCircuit?.validity || { status: 'VALID' },
              sources: activeCircuit?.power_sources || activeCircuit?.sources || (simulationSource ? [{
                id: "V_SIMULATED",
                type: simulationSource.type || "dc_voltage",
                voltage: parseFloat(simulationSource.value || 12.0),
                positive_node: simulationSource.positiveNode,
                negative_node: simulationSource.negativeNode,
                source: "user_simulated"
              }] : [])
            }}
            onSimulationUpdate={(simResult) => {
              if (simResult && simResult.success) {
                setSimulationResult(simResult);
                setSolverStatus(simResult.solver_status || 'SOLVED');
                if (simResult.measurements) {
                  setMeasurements(simResult.measurements);
                }
              }
            }}
            onClose={() => setShowAssistant(false)}
            onHighlightComponent={(cid) => setHighlightedComponentId(cid)}
            onApplyCorrection={async (payload, sugg) => {
              if (!payload) return { status: 'BLOCKED', reason: 'Missing correction payload' };
              
              const res = await applyCircuitCorrection({
                ...payload,
                circuit_state: activeCircuit || {}
              });

              if (res && res.status === 'APPLIED') {
                applyBackendCorrection(res);
                const cid = res.component_id || payload.component_id;
                const h1 = res.updated_terminals?.terminal_a || payload.hole1;
                const h2 = res.updated_terminals?.terminal_b || payload.hole2;
                setLatestToast({
                  type: 'success',
                  message: `Verified mapping applied for ${cid} (${h1} → ${h2}). Simulation invalidated.`
                });
                return res;
              } else {
                setLatestToast({
                  type: 'error',
                  message: `Correction blocked: ${res?.reason || 'Validation checks failed'}`
                });
                return res || { status: 'BLOCKED', reason: 'Backend validation failed' };
              }
            }}
          />
        </div>
      )}

      {/* Phase 22.1: Visual Grounding Inspection Panel */}
      {showVisualGrounding && (
        <div style={{ marginBottom: '1.25rem' }}>
          <VisualGroundingPanel
            visualGrounding={currentVisualGroundingState}
            onClose={() => setShowVisualGrounding(false)}
          />
        </div>
      )}

      {/* Main Split Grid (Live Camera | 3D Digital Twin) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: compareMode ? '1fr 1fr' : '1fr',
        gap: '1.25rem',
        marginBottom: '1.5rem'
      }}>
        {/* LEFT: Live Camera Preview / Phone QR Pairing */}
        <div style={{
          background: '#0f172a',
          border: '1px solid #334155',
          borderRadius: '12px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 4px 15px rgba(0,0,0,0.4)'
        }}>
          {/* Card Header */}
          <div style={{
            background: '#1e293b',
            padding: '0.75rem 1rem',
            display: 'flex',
            justify: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid #334155'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '0.95rem' }}>
              {cameraSource === 'phone' ? <Smartphone size={18} style={{ color: '#38bdf8' }} /> : <Camera size={18} style={{ color: '#38bdf8' }} />}
              <span>{cameraSource === 'phone' ? '📱 PHONE CAMERA STREAM' : '📷 LAPTOP WEBCAM SCANNER'}</span>
            </div>

            {/* Toolbar Buttons */}
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              {cameraSource === 'phone' && (
                <button
                  onClick={() => { const newSess = generateNewSession(); initPhoneSignaling(newSess); }}
                  style={{
                    background: '#334155',
                    color: '#cbd5e1',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '0.4rem 0.8rem',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem'
                  }}
                >
                  <RefreshCw size={14} /> New QR
                </button>
              )}

              {cameraSource === 'laptop' && (
                cameraStatus === 'idle' ? (
                  <button
                    onClick={startLaptopCamera}
                    style={{
                      background: '#2563eb',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '0.4rem 0.8rem',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem'
                    }}
                  >
                    <Camera size={14} /> Start Camera
                  </button>
                ) : (
                  <button
                    onClick={stopCamera}
                    style={{
                      background: '#dc2626',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '0.4rem 0.8rem',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem'
                    }}
                  >
                    <CameraOff size={14} /> Stop Camera
                  </button>
                )
              )}

              <button
                onClick={startDemoMode}
                style={{
                  background: isDemoMode ? '#7c3aed' : '#334155',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.4rem 0.8rem',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                📺 Demo Mode
              </button>

              <button
                onClick={() => setCompareMode(!compareMode)}
                style={{
                  background: '#334155',
                  color: '#cbd5e1',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.4rem 0.8rem',
                  fontSize: '0.8rem',
                  cursor: 'pointer'
                }}
              >
                ⇄ Compare View
              </button>
            </div>
          </div>

          {/* Camera Video Container / QR Pairing Card */}
          <div ref={videoContainerRef} style={{ position: 'relative', width: '100%', height: '420px', background: '#020617', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            
            {/* Always mounted video element for receiving WebRTC remote stream or Laptop webcam */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              onLoadedMetadata={handleVideoLoadedMetadata}
              onCanPlay={handleVideoCanPlay}
              onPlaying={checkVideoReady}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                display: (cameraStatus === 'video_ready' || cameraStatus === 'connected') && !isDemoMode ? 'block' : 'none'
              }}
            />

            {/* Real-Time AR Camera Overlay */}
            <ARCameraOverlay
              videoRef={videoRef}
              containerRef={videoContainerRef}
              trackedComponents={detections}
              registration={registration}
              videoWidth={videoDimensions.width || 1280}
              videoHeight={videoDimensions.height || 720}
              isActive={(cameraActive || isDemoMode)}
              onOpenEditModal={(c) => setValueModalComp(c)}
              onOpenWhatIfModal={(c) => handleOpenWhatIfPrompt(c)}
              visualGroundingState={currentVisualGroundingState}
              highlightedComponentId={highlightedComponentId}
              onAskAI={(targetId) => setShowAssistant(true)}
            />

            {/* Phone Camera QR Pairing Screen (Shown when PHONE CAMERA is selected and phone is not yet streaming) */}
            {cameraSource === 'phone' && cameraStatus !== 'video_ready' && !isDemoMode && (
              <div style={{
                textAlign: 'center',
                padding: '1.5rem',
                color: '#f8fafc',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.8rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#38bdf8', fontWeight: 600, fontSize: '0.95rem' }}>
                  <QrCode size={20} />
                  <span>CONNECT PHONE CAMERA</span>
                </div>

                <div style={{
                  background: '#ffffff',
                  padding: '12px',
                  borderRadius: '12px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                  display: 'inline-block'
                }}>
                  <QRCodeSVG value={phoneCameraUrl} size={160} level="M" includeMargin={false} />
                </div>

                <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                  Scan QR with your phone or visit:
                  <div style={{ color: '#38bdf8', fontWeight: 600, marginTop: '2px', fontFamily: 'monospace' }}>
                    {phoneCameraUrl}
                  </div>
                </div>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  background: phoneSignalingStep === 'phone_ready' ? '#064e3b' : phoneSignalingStep === 'failed' ? '#7f1d1d' : 'rgba(30, 41, 59, 0.9)',
                  color: phoneSignalingStep === 'phone_ready' ? '#6ee7b7' : phoneSignalingStep === 'failed' ? '#fca5a5' : '#fbbf24',
                  padding: '0.4rem 0.9rem',
                  borderRadius: '20px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  border: `1px solid ${phoneSignalingStep === 'phone_ready' ? '#10b981' : phoneSignalingStep === 'failed' ? '#ef4444' : '#334155'}`
                }}>
                  <span style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: phoneSignalingStep === 'phone_ready' ? '#10b981' : phoneSignalingStep === 'failed' ? '#ef4444' : '#eab308'
                  }}></span>
                  {phoneSignalingStep === 'ws_connecting' && '● WEBSOCKET CONNECTING...'}
                  {phoneSignalingStep === 'phone_found' && '● PHONE FOUND — AWAITING OFFER...'}
                  {phoneSignalingStep === 'offer_received' && '● OFFER RECEIVED — CREATING ANSWER...'}
                  {phoneSignalingStep === 'answer_sent' && '● ANSWER SENT — CONNECTING ICE...'}
                  {phoneSignalingStep === 'ice_checking' && '● ICE CHECKING...'}
                  {phoneSignalingStep === 'phone_ready' && '🟢 PHONE CAMERA READY'}
                  {phoneSignalingStep === 'failed' && '⚠ PHONE CONNECTION FAILED'}
                  {phoneSignalingStep === 'idle' && (phoneConnected ? '● PHONE JOINED SESSION' : `Session: ${sessionId} — Waiting for phone connection...`)}
                </div>
              </div>
            )}

            {/* Laptop Camera Standby State */}
            {cameraSource === 'laptop' && cameraStatus === 'idle' && !isDemoMode && (
              <div style={{ textAlign: 'center', color: '#64748b', padding: '2rem' }}>
                <Camera size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                <h4 style={{ margin: '0 0 0.5rem 0', color: '#94a3b8' }}>Laptop Webcam Disconnected</h4>
                <p style={{ margin: 0, fontSize: '0.85rem', maxWidth: '340px' }}>
                  Click <strong>Start Camera</strong> to enable laptop webcam or switch to <strong>PHONE CAMERA</strong> mode.
                </p>
                {cameraError && (
                  <div style={{ marginTop: '1rem', color: '#f87171', fontSize: '0.85rem', background: 'rgba(239, 68, 68, 0.1)', padding: '0.6rem 1rem', borderRadius: '6px', border: '1px solid #ef4444' }}>
                    ⚠️ {cameraError}
                  </div>
                )}
              </div>
            )}

            {/* Demo Mode Asset Image */}
            {isDemoMode && (
              <img
                src="/src/assets/real_breadboard_photo.jpg"
                alt="Demo Breadboard Circuit"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                onError={(e) => {
                  e.currentTarget.src = "https://raw.githubusercontent.com/ultralytics/yolov5/master/data/images/bus.jpg";
                }}
              />
            )}

            {/* Development / Video Diagnostic Bar */}
            {cameraStatus === 'video_ready' && !isDemoMode && (
              <div style={{
                position: 'absolute',
                bottom: '8px',
                left: '8px',
                background: 'rgba(15, 23, 42, 0.8)',
                color: '#38bdf8',
                padding: '0.25rem 0.6rem',
                borderRadius: '4px',
                fontSize: '0.72rem',
                fontFamily: 'monospace',
                pointerEvents: 'none',
                border: '1px solid rgba(56, 189, 248, 0.3)'
              }}>
                📷 READY: {videoDimensions.width}×{videoDimensions.height} px | Source: {cameraSource.toUpperCase()} | ReadyState: {videoRef.current?.readyState || 4}
              </div>
            )}

            {/* Hidden canvas for frame capture */}
            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </div>

          {/* Camera Footer Controls */}
          <div style={{ padding: '0.75rem 1rem', background: '#0f172a', borderTop: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              Detections: <strong style={{ color: '#38bdf8' }}>{detections.length} components</strong>
            </span>

            <button
              onClick={() => processFrameAnalysis(captureFrameBase64())}
              disabled={isAnalyzing}
              style={{
                background: '#0284c7',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                padding: '0.4rem 1rem',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
            >
              <RefreshCw size={14} className={isAnalyzing ? 'spin' : ''} />
              {isAnalyzing ? 'Analyzing Frame...' : 'Scan / Re-Analyze'}
            </button>
          </div>
        </div>

        {/* RIGHT: Live 3D Digital Twin Canvas */}
        <div style={{
          background: '#0f172a',
          border: '1px solid #3b82f6',
          borderRadius: '12px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 4px 15px rgba(0,0,0,0.4)'
        }}>
          <div style={{
            background: '#1e293b',
            padding: '0.75rem 1rem',
            display: 'flex',
            justify: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid #334155'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '0.95rem' }}>
              <Layers size={18} style={{ color: '#60a5fa' }} />
              <span>🧊 LIVE 3D DIGITAL TWIN</span>
            </div>
            <span style={{ fontSize: '0.75rem', color: '#34d399', fontWeight: 600 }}>
              ● REAL-TIME SYNCHRONIZED
            </span>
          </div>

          <div style={{ height: '420px', position: 'relative' }}>
            <Breadboard3DCanvas />
          </div>

          <div style={{ padding: '0.75rem 1rem', background: '#0f172a', borderTop: '1px solid #1e293b' }}>
            <SimulationControls />
          </div>
        </div>
      </div>

      {/* Middle Grid: Power Source Setup & Electrical Component Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.25rem', marginBottom: '1.5rem' }}>
        {/* Power Source Panel */}
        <PowerSourcePanel />

        {/* Component Measurement Inspector */}
        <ComponentMeasurementCard
          onOpenValueModal={(c) => setValueModalComp(c)}
          onOpenCorrectionModal={(c) => setCorrectionModalComp(c)}
        />
      </div>

      {/* Bottom Component Table & Real-Time Events */}
      <div style={{
        background: '#0f172a',
        border: '1px solid #334155',
        borderRadius: '12px',
        padding: '1.25rem',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc' }}>
            📋 AI RECONSTRUCTED COMPONENTS & TOPOLOGY
          </h3>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            Click any row to focus component in 3D simulator
          </span>
        </div>

        {comps.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
            No components detected yet. Scan QR code with phone camera or enable Demo Mode to scan circuit.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#1e293b', color: '#94a3b8', borderBottom: '1px solid #334155' }}>
                  <th style={{ padding: '0.6rem 0.8rem' }}>ID</th>
                  <th style={{ padding: '0.6rem 0.8rem' }}>Type</th>
                  <th style={{ padding: '0.6rem 0.8rem' }}>Value</th>
                  <th style={{ padding: '0.6rem 0.8rem' }}>Terminals</th>
                  <th style={{ padding: '0.6rem 0.8rem' }}>Voltage Drop</th>
                  <th style={{ padding: '0.6rem 0.8rem' }}>Current</th>
                  <th style={{ padding: '0.6rem 0.8rem' }}>Power</th>
                  <th style={{ padding: '0.6rem 0.8rem' }}>Confidence</th>
                  <th style={{ padding: '0.6rem 0.8rem' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {comps.map((c) => {
                  const cid = c.id || c.designator;
                  const m = measurements[cid] || measurements[c.id] || {};
                  const needsConf = c.needsConfirmation || false;
                  const valDisp = c.displayValue || c.user_override_value || c.formatted_value || c.detected_value || '1 kΩ';

                  return (
                    <tr
                      key={cid}
                      onClick={() => setSelectedComponent(c)}
                      style={{
                        borderBottom: '1px solid #1e293b',
                        cursor: 'pointer',
                        background: 'transparent',
                        transition: 'background 0.15s ease'
                      }}
                    >
                      <td style={{ padding: '0.6rem 0.8rem', fontWeight: 600, color: '#38bdf8' }}>{cid}</td>
                      <td style={{ padding: '0.6rem 0.8rem', color: '#f8fafc', textTransform: 'capitalize' }}>{c.type}</td>
                      <td style={{ padding: '0.6rem 0.8rem', fontWeight: 600, color: needsConf ? '#f59e0b' : '#f8fafc' }}>
                        {valDisp}
                      </td>
                      <td style={{ padding: '0.6rem 0.8rem', color: '#cbd5e1' }}>
                        {c.hole1 || c.start_hole || 'A1'} ↔ {c.hole2 || c.end_hole || 'A2'}
                      </td>
                      <td style={{ padding: '0.6rem 0.8rem', color: '#10b981' }}>
                        {m.voltageDrop !== undefined ? `${m.voltageDrop.toFixed(2)} V` : '0.00 V'}
                      </td>
                      <td style={{ padding: '0.6rem 0.8rem', color: '#fbbf24' }}>
                        {m.current !== undefined ? `${(m.current * 1000).toFixed(2)} mA` : '0.00 mA'}
                      </td>
                      <td style={{ padding: '0.6rem 0.8rem', color: '#f43f5e' }}>
                        {m.power !== undefined ? `${(m.power * 1000).toFixed(2)} mW` : '0.00 mW'}
                      </td>
                      <td style={{ padding: '0.6rem 0.8rem' }}>
                        {needsConf ? (
                          <span style={{ color: '#f59e0b', fontWeight: 600 }}>⚠️ Confirm</span>
                        ) : (
                          <span style={{ color: '#34d399', fontWeight: 600 }}>● {Math.round((c.val_confidence || c.confidence || 0.9) * 100)}%</span>
                        )}
                      </td>
                      <td style={{ padding: '0.6rem 0.8rem' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setValueModalComp(c);
                          }}
                          style={{
                            background: '#334155',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '0.2rem 0.5rem',
                            fontSize: '0.75rem',
                            cursor: 'pointer'
                          }}
                        >
                          ✏ Edit
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ marginTop: '1rem', fontSize: '0.75rem', color: '#64748b', textAlign: 'center' }}>
          Electrical values are calculated from reconstructed topology, component values and source conditions. They are not direct physical measurements.
        </div>
      </div>

      {/* Value Input Modal */}
      {valueModalComp && (
        <ValueInputModal
          component={valueModalComp}
          onClose={() => setValueModalComp(null)}
          onConfirmOverride={(comp, val, unit, formatted) => {
            setValueModalComp(null);
            setDigitalConfirmData({
              isOpen: true,
              component: comp,
              oldValue: comp.user_override_value || comp.displayValue || comp.formatted_value || `${comp.value || 1000} ${comp.unit || 'Ω'}`,
              newValue: formatted || `${val} ${unit}`,
              rawVal: val,
              rawUnit: unit
            });
          }}
        />
      )}

      {/* User Terminal Correction Modal */}
      {correctionModalComp && (
        <UserCorrectionModal
          component={correctionModalComp}
          onClose={() => setCorrectionModalComp(null)}
        />
      )}

      {/* Digital Change Confirmation Modal */}
      {digitalConfirmData.isOpen && (
        <DigitalChangeConfirmModal
          isOpen={digitalConfirmData.isOpen}
          component={digitalConfirmData.component}
          oldValue={digitalConfirmData.oldValue}
          newValue={digitalConfirmData.newValue}
          onConfirm={() => {
            applyDigitalComponentValue(
              digitalConfirmData.component.id || digitalConfirmData.component.designator,
              digitalConfirmData.rawVal,
              digitalConfirmData.rawUnit
            );
            setDigitalConfirmData({ isOpen: false, component: null, oldValue: '', newValue: '', rawVal: '', rawUnit: '' });
          }}
          onCancel={() => setDigitalConfirmData({ isOpen: false, component: null, oldValue: '', newValue: '', rawVal: '', rawUnit: '' })}
        />
      )}

      {/* What-If Simulation Comparison Modal */}
      {whatIfState.active && (
        <WhatIfComparisonModal
          isOpen={whatIfState.active}
          targetComponent={whatIfState.targetComponent}
          originalValue={whatIfState.originalValue}
          candidateValue={whatIfState.candidateValue}
          originalSimulationResult={whatIfState.originalSimulationResult}
          whatIfSimulationResult={whatIfState.whatIfSimulationResult}
          onApply={applyWhatIfToCircuit}
          onDiscard={cancelWhatIf}
        />
      )}
    </div>
  );
}

// Helper to fetch Base64 string for Demo Mode asset
async function fetchDemoAssetBase64() {
  try {
    const response = await fetch('/src/assets/real_breadboard_photo.jpg');
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    return null;
  }
}

function max(a, b) {
  return a > b ? a : b;
}


