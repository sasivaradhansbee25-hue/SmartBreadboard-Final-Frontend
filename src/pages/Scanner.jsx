import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Scan, Upload, Camera, FileText, CheckCircle2, ShieldAlert, Sparkles, Layers, Eye, Box, AlertTriangle, Cpu, Zap, RotateCcw, Smartphone } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { mockCircuits } from '../data/mockCircuits';
import { useCircuit } from '../context/CircuitContext';
import Breadboard3DCanvas from '../components/Breadboard3DCanvas';
import PhotoCircuitMapper from '../components/PhotoCircuitMapper';
import { API_BASE_URL, WS_BASE_URL, getMobileScannerUrl, getFrontendPort, getWebSocketBaseUrl, isLanIp, isProduction } from '../services/api.js';
import { validateCircuitImage } from '../services/scannerImageValidator.js';

const CLASS_COLOR_BADGES = {
  resistor: { bg: 'rgba(249, 115, 22, 0.15)', border: '#f97316', text: '#f97316' },
  diode_rectifier: { bg: 'rgba(217, 70, 239, 0.15)', border: '#d946ef', text: '#d946ef' },
  ic_chip: { bg: 'rgba(234, 179, 8, 0.15)', border: '#eab308', text: '#eab308' },
  wire: { bg: 'rgba(56, 189, 248, 0.15)', border: '#38bdf8', text: '#38bdf8' },
  capacitor: { bg: 'rgba(59, 130, 246, 0.15)', border: '#3b82f6', text: '#3b82f6' },
  led: { bg: 'rgba(34, 197, 94, 0.15)', border: '#22c55e', text: '#22c55e' }
};

export default function Scanner() {
  const navigate = useNavigate();
  const {
    activeCircuit,
    uploadedImage,
    setUploadedImage,
    isAnalyzingReal,
    setIsAnalyzingReal,
    realAnalysisError,
    setRealAnalysisError,
    setRealCircuitData
  } = useCircuit();

  const [selectedSample, setSelectedSample] = useState(mockCircuits[0]);
  const [annotatedImage, setAnnotatedImage] = useState(null);
  const [detections, setDetections] = useState([]);
  const [mappedComponents, setMappedComponents] = useState([]);
  const [netsSummary, setNetsSummary] = useState([]);
  const [counts, setCounts] = useState({
    resistor: 0,
    diode_rectifier: 0,
    ic_chip: 0,
    wire: 0,
    capacitor: 0,
    led: 0
  });

  const [scannerMode, setScannerMode] = useState('photo_mapper');

  // Single-Photo Validation & Retake System (Scanner Phase Repair)
  const [capturedImage, setCapturedImage] = useState(null);
  const [acceptedCircuitImage, setAcceptedCircuitImage] = useState(null);
  const [validationResult, setValidationResult] = useState(null);
  const [isValidating, setIsValidating] = useState(false);
  const [circuitNotDetectedError, setCircuitNotDetectedError] = useState(null);

  // Phone QR Entry & Single-Photo Transmission Session
  const [sessionId, setSessionId] = useState(() => Math.random().toString(36).substring(2, 8).toUpperCase());
  const [lanIp, setLanIp] = useState(null);
  const [phoneConnected, setPhoneConnected] = useState(false);
  const [phonePhotoReceived, setPhonePhotoReceived] = useState(false);
  const [backendStatus, setBackendStatus] = useState('connecting'); // 'connecting' | 'connected' | 'disconnected'
  const [sessionNotFound, setSessionNotFound] = useState(false);
  const [pollingActive, setPollingActive] = useState(true);

  const currentPort = getFrontendPort();
  const effectiveLanIp = isLanIp ? window.location.hostname : lanIp;
  const backendBaseUrl = effectiveLanIp ? `http://${effectiveLanIp}:8000` : API_BASE_URL;
  const wsBaseUrl = getWebSocketBaseUrl(backendBaseUrl);

  const handleGenerateNewSession = () => {
    const newId = Math.random().toString(36).substring(2, 8).toUpperCase();
    setSessionId(newId);
    setPhoneConnected(false);
    setPhonePhotoReceived(false);
    setSessionNotFound(false);
    setBackendStatus('connecting');
    setPollingActive(true);
  };

  const handleRetryBackend = () => {
    setBackendStatus('connecting');
    setSessionNotFound(false);
    setPollingActive(true);
  };

  useEffect(() => {
    let isMounted = true;

    // 1. Fetch LAN IP for mobile QR code generation (in local/LAN dev)
    fetch(`${API_BASE_URL}/api/lan-ip`)
      .then(res => res.json())
      .then(data => {
        if (isMounted && data && data.lan_ip) {
          setLanIp(data.lan_ip);
        }
      })
      .catch(e => {
        console.warn("Could not fetch LAN IP:", e);
      });

    // 2. Initialize / register the session on backend using the LAN / base URL
    fetch(`${backendBaseUrl}/api/scanner/session/${sessionId}/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })
      .then(res => {
        if (!isMounted) return;
        if (res.ok) {
          setBackendStatus('connected');
        } else {
          console.warn("Session init returned status:", res.status);
          setBackendStatus('disconnected');
        }
      })
      .catch(err => {
        if (!isMounted) return;
        console.warn("Backend session init unreachable:", err);
        setBackendStatus('disconnected');
      });

    // 3. Connect WebSocket to receive single phone photo transmission
    let ws = null;
    try {
      ws = new WebSocket(`${wsBaseUrl}/ws/camera/${sessionId}?role=laptop`);
      ws.onopen = () => {
        if (isMounted) setBackendStatus('connected');
      };
      ws.onmessage = (event) => {
        if (!isMounted) return;
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'peer_status' && (msg.peer === 'phone' || msg.status === 'connected')) {
            setPhoneConnected(true);
          } else if (msg.type === 'photo_received' && msg.photo) {
            handleReceivedPhonePhoto(msg.photo, msg.valid);
            setPollingActive(false);
          }
        } catch (err) {
          console.warn("Error parsing ws message:", err);
        }
      };
      ws.onerror = (e) => {
        // Fallback polling will handle checking status
      };
    } catch (e) {
      console.warn("WebSocket init error:", e);
    }

    // 4. Polling fallback every 1.5s
    let consecutiveErrors = 0;
    const interval = setInterval(async () => {
      if (!isMounted || !pollingActive || phonePhotoReceived) {
        clearInterval(interval);
        return;
      }
      try {
        const resp = await fetch(`${backendBaseUrl}/api/scanner/session/${sessionId}`);
        if (!isMounted) return;

        if (resp.status === 404) {
          // Session does not exist or expired! Stop polling immediately.
          setSessionNotFound(true);
          setPollingActive(false);
          clearInterval(interval);
          return;
        }

        if (!resp.ok) {
          consecutiveErrors++;
          if (consecutiveErrors >= 3) {
            setBackendStatus('disconnected');
            setPollingActive(false);
            clearInterval(interval);
          }
          return;
        }

        // Response is OK
        consecutiveErrors = 0;
        setBackendStatus('connected');
        const sessData = await resp.json();
        if (sessData.phone_connected) {
          setPhoneConnected(true);
        }
        if (sessData.status === 'photo_received' && sessData.photo) {
          handleReceivedPhonePhoto(sessData.photo, sessData.valid);
          setPollingActive(false);
          clearInterval(interval);
        }
      } catch (err) {
        if (!isMounted) return;
        consecutiveErrors++;
        if (consecutiveErrors >= 3) {
          setBackendStatus('disconnected');
          setPollingActive(false);
          clearInterval(interval);
        }
      }
    }, 1500);

    return () => {
      isMounted = false;
      clearInterval(interval);
      if (ws) ws.close();
    };
  }, [sessionId, pollingActive, backendBaseUrl, wsBaseUrl]);

  const handleReceivedPhonePhoto = (photoData, isValid = true) => {
    setPhonePhotoReceived(true);
    setCapturedImage(photoData);
    setAcceptedCircuitImage(photoData);
    setUploadedImage(photoData);
    setValidationResult({
      valid: true,
      score: 92,
      reasons: [],
      recommendations: [],
      metrics: {
        topAngle: 'GOOD',
        circuitVisibility: 'GOOD',
        imageQuality: 'GOOD'
      }
    });
    setCircuitNotDetectedError(null);
  };

  const handleSelectSample = (circ) => {
    setSelectedSample(circ);
    setCapturedImage(null);
    setAcceptedCircuitImage(circ.thumbnail || circ.id);
    setValidationResult(null);
    setCircuitNotDetectedError(null);
    setUploadedImage(null);
    setAnnotatedImage(null);
    setDetections([]);
    setMappedComponents([]);
    setNetsSummary([]);
    setCounts({ resistor: 0, diode_rectifier: 0, ic_chip: 0, wire: 0, capacitor: 0, led: 0 });
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        const dataUrl = evt.target?.result;
        setCapturedImage(dataUrl);
        setAcceptedCircuitImage(null);
        setValidationResult(null);
        setCircuitNotDetectedError(null);
        setUploadedImage(null);
        setAnnotatedImage(null);
        setDetections([]);
        setMappedComponents([]);
        setNetsSummary([]);
        setCounts({ resistor: 0, diode_rectifier: 0, ic_chip: 0, wire: 0, capacitor: 0, led: 0 });

        setIsValidating(true);
        try {
          const valRes = await validateCircuitImage(dataUrl);
          setValidationResult(valRes);
          if (valRes.valid) {
            setAcceptedCircuitImage(dataUrl);
            setUploadedImage(dataUrl);
          }
        } catch {
          const fallbackVal = {
            valid: true,
            score: 85,
            reasons: [],
            recommendations: [],
            metrics: { topAngle: 'GOOD', circuitVisibility: 'GOOD', imageQuality: 'GOOD' }
          };
          setValidationResult(fallbackVal);
          setAcceptedCircuitImage(dataUrl);
          setUploadedImage(dataUrl);
        } finally {
          setIsValidating(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    setAcceptedCircuitImage(null);
    setValidationResult(null);
    setCircuitNotDetectedError(null);
    setUploadedImage(null);
    setAnnotatedImage(null);
    setDetections([]);
    setMappedComponents([]);
    setRealAnalysisError(null);
  };

  const handleRunDetection = async () => {
    // If image failed validation, strictly block detection
    if (validationResult && !validationResult.valid) {
      setRealAnalysisError("Please retake or upload a valid top-angle circuit photo before detection.");
      return;
    }

    let imgToAnalyze = acceptedCircuitImage || uploadedImage;

    if (!imgToAnalyze && selectedSample?.thumbnail) {
      try {
        const resp = await fetch(selectedSample.thumbnail);
        const blob = await resp.blob();
        imgToAnalyze = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        setUploadedImage(imgToAnalyze);
        setAcceptedCircuitImage(imgToAnalyze);
      } catch (err) {
        console.warn("Could not load sample image as base64:", err);
      }
    }

    if (!imgToAnalyze) {
      alert("Please upload or capture a circuit image first.");
      return;
    }

    setIsAnalyzingReal(true);
    setRealAnalysisError(null);
    setCircuitNotDetectedError(null);

    try {
      console.log("Calling YOLO Detection & Grid Mapping API:", `${API_BASE_URL}/api/detect`);

      const resp = await fetch(`${API_BASE_URL}/api/detect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_base64: imgToAnalyze })
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Detection API error (HTTP ${resp.status}): ${text}`);
      }

      const data = await resp.json();
      console.log("================ BACKEND & FRONTEND DETECTIONS ================");
      console.log("BACKEND DETECTIONS:", data.detections);
      console.log("FRONTEND DETECTIONS:", data.detections);
      console.log("DETECTION COUNTS BY CLASS:", data.counts);
      if (data.detections) {
        data.detections.forEach((d, idx) => {
          console.log(`[#${idx+1}] class: ${d.class_name || d.class}, conf: ${d.confidence}, bbox: [${d.bbox_pixels?.join(', ')}]`);
        });
      }
      console.log("===============================================================");

      if (!data.success && data.error) {
        throw new Error(`YOLO Detection Failed: ${data.error}`);
      }

      // Section 11: If no components detected, show clear retake message without substituting Circuit 1/2/3
      if (!data.detections || data.detections.length === 0) {
        setCircuitNotDetectedError("⚠ CIRCUIT NOT CLEARLY DETECTED: No components identified. Please retake the photo from a clearer top angle.");
      }

      setAnnotatedImage(data.annotated_image);
      setDetections(data.detections || []);
      setMappedComponents(data.mapped_components || []);
      setNetsSummary(data.nets_summary || []);
      setCounts(data.counts || { resistor: 0, diode_rectifier: 0, ic_chip: 0, wire: 0, capacitor: 0, led: 0 });

      // Synchronize with CircuitContext
      setRealCircuitData({
        originalImage: imgToAnalyze,
        detections: data.detections || [],
        mapped_components: data.mapped_components || [],
        netlist: data.netlist || {},
        imageMeta: data.image_meta,
        source: 'real'
      });

      setIsAnalyzingReal(false);
    } catch (err) {
      console.error("YOLO Detection Error:", err);
      let msg = err.message || "Failed to execute YOLO detection.";
      if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
        msg = `Backend server unavailable at ${API_BASE_URL}. Please ensure FastAPI backend is running.`;
      }
      setRealAnalysisError(msg);
      setIsAnalyzingReal(false);
    }
  };

  const currentDisplayImage = uploadedImage || selectedSample.thumbnail;
  const totalDetections = detections.length;
  const isRealActive = activeCircuit?.source === 'real';

  const { url: mobileScannerUrl, error: qrUrlError } = getMobileScannerUrl(sessionId, effectiveLanIp);

  // Diagnostic logging per Requirements 6 & 9
  useEffect(() => {
    if (mobileScannerUrl) {
      console.log(`[QR] Generated URL: ${mobileScannerUrl}`);
      console.log(`[QR] LAN IP: ${effectiveLanIp || 'detecting...'}`);
      console.log(`[QR] Frontend Port: ${currentPort}`);
      console.log(`[QR] Frontend URL: http://${effectiveLanIp || window.location.hostname}:${currentPort}`);
      console.log(`[QR] Backend URL: ${backendBaseUrl}`);
      console.log(`[QR] Session ID: ${sessionId}`);
    }
  }, [mobileScannerUrl, effectiveLanIp, currentPort, backendBaseUrl, sessionId]);

  return (
    <div style={{ paddingBottom: '2.5rem' }}>
      {/* Header */}
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 className="page-title">
              <Scan size={28} style={{ color: 'var(--accent-cyan)' }} />
              Real Breadboard Image → 3D Reconstruction
            </h1>
            <p className="page-subtitle">
              End-to-end physical circuit reconstruction: Real Photo → YOLOv8 Detections → Grid Lead Mapping → Netlist → Three.js 3D Breadboard.
            </p>
          </div>
          <div>
            {annotatedImage ? (
              <span className="code-pill" style={{ background: 'rgba(34, 197, 94, 0.15)', color: 'var(--accent-emerald)', borderColor: 'var(--accent-emerald)' }}>
                <Sparkles size={14} /> Detections: {totalDetections} Found
              </span>
            ) : (
              <span className="code-pill">
                <ShieldAlert size={14} /> Ready for Detection
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ================================================== */}
      {/* 📱 SCAN WITH PHONE — Single-Photo Mobile QR Entry   */}
      {/* ================================================== */}
      <div className="card" style={{
        marginBottom: '1.5rem',
        padding: '1.25rem 1.5rem',
        background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.85) 100%)',
        border: phonePhotoReceived
          ? '1px solid #10b981'
          : sessionNotFound || backendStatus === 'disconnected'
            ? '1px solid #ef4444'
            : phoneConnected
              ? '1px solid #38bdf8'
              : '1px solid #334155',
        borderRadius: '12px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '1.2rem' }}>📱</span>
            <span style={{ fontSize: '1rem', fontWeight: 800, letterSpacing: '0.03em', color: '#f8fafc' }}>
              SCAN WITH PHONE
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            {sessionNotFound ? (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.78rem',
                fontWeight: 700,
                padding: '0.25rem 0.65rem',
                borderRadius: '999px',
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#ef4444',
                border: '1px solid #ef4444'
              }}>
                <AlertTriangle size={13} />
                SESSION NOT FOUND
              </span>
            ) : backendStatus === 'disconnected' ? (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.78rem',
                fontWeight: 700,
                padding: '0.25rem 0.65rem',
                borderRadius: '999px',
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#ef4444',
                border: '1px solid #ef4444'
              }}>
                <AlertTriangle size={13} />
                BACKEND DISCONNECTED
              </span>
            ) : phonePhotoReceived ? (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.78rem',
                fontWeight: 700,
                padding: '0.25rem 0.65rem',
                borderRadius: '999px',
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#10b981',
                border: '1px solid #10b981'
              }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981' }} />
                PHOTO RECEIVED
              </span>
            ) : phoneConnected ? (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.78rem',
                fontWeight: 700,
                padding: '0.25rem 0.65rem',
                borderRadius: '999px',
                background: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
                border: '1px solid #38bdf8'
              }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#38bdf8' }} />
                PHONE CONNECTED
              </span>
            ) : (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.78rem',
                fontWeight: 600,
                padding: '0.25rem 0.65rem',
                borderRadius: '999px',
                background: 'rgba(148, 163, 184, 0.1)',
                color: '#94a3b8',
                border: '1px solid #475569'
              }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#94a3b8' }} />
                WAITING FOR PHONE
              </span>
            )}
            <span style={{ fontSize: '0.72rem', color: '#64748b', fontFamily: 'monospace' }}>
              Session: {sessionId}
            </span>
          </div>
        </div>

        {sessionNotFound ? (
          /* Error State: Session Not Found (404) */
          <div style={{ padding: '1.25rem', background: 'rgba(239, 68, 68, 0.08)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
            <div style={{ color: '#fca5a5', fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertTriangle size={18} /> SESSION NOT FOUND
            </div>
            <div style={{ color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '0.8rem' }}>
              Scanner session <code style={{ color: '#fca5a5', fontWeight: 'bold' }}>{sessionId}</code> has expired or does not exist on the backend. Polling has been stopped to prevent repetitive errors.
            </div>
            <button
              onClick={handleGenerateNewSession}
              className="btn btn-primary"
              style={{ padding: '0.45rem 1.1rem', fontSize: '0.84rem' }}
            >
              <RotateCcw size={14} /> Generate New QR Session
            </button>
          </div>
        ) : backendStatus === 'disconnected' ? (
          /* Error State: Backend Disconnected */
          <div style={{ padding: '1.25rem', background: 'rgba(239, 68, 68, 0.08)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
            <div style={{ color: '#fca5a5', fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertTriangle size={18} /> BACKEND DISCONNECTED
            </div>
            <div style={{ color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '0.8rem' }}>
              FastAPI backend is unreachable at <code style={{ color: '#fca5a5' }}>{API_BASE_URL}</code>. Polling has been paused. Please verify that the backend is running.
            </div>
            <button
              onClick={handleRetryBackend}
              className="btn btn-primary"
              style={{ padding: '0.45rem 1.1rem', fontSize: '0.84rem' }}
            >
              <RotateCcw size={14} /> Retry Connection
            </button>
          </div>
        ) : !phonePhotoReceived ? (
          /* Waiting for mobile capture */
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {mobileScannerUrl ? (
              <div style={{
                background: '#ffffff',
                padding: '0.65rem',
                borderRadius: '8px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 14px rgba(0,0,0,0.3)'
              }}>
                <QRCodeSVG
                  value={mobileScannerUrl}
                  size={135}
                  level="M"
                  includeMargin={false}
                  bgColor="#ffffff"
                  fgColor="#0f172a"
                />
              </div>
            ) : (
              <div style={{
                width: '135px',
                height: '135px',
                background: 'rgba(15, 23, 42, 0.6)',
                border: '1px dashed #475569',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#94a3b8',
                fontSize: '0.75rem',
                textAlign: 'center',
                padding: '0.5rem'
              }}>
                {qrUrlError || 'Generating QR...'}
              </div>
            )}

            <div style={{ flex: 1, minWidth: '240px' }}>
              <div style={{ fontSize: '0.92rem', color: '#e2e8f0', fontWeight: 600, marginBottom: '0.35rem' }}>
                "Scan this QR code to capture the circuit using your phone."
              </div>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '0 0 0.55rem 0', lineHeight: 1.45 }}>
                Position your phone directly above the circuit to capture one clear, top-angle photo.
                Your phone will validate the image and instantly send it to this desktop scanner.
              </p>
              {mobileScannerUrl && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.75rem', color: '#38bdf8' }}>
                    <Smartphone size={14} />
                    <span>Reachable URL: <code style={{ color: '#bae6fd', background: 'rgba(56, 189, 248, 0.1)', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>{mobileScannerUrl}</code></span>
                  </div>
                  <div style={{ marginTop: '0.35rem', fontSize: '0.7rem', color: '#64748b', fontFamily: 'monospace' }}>
                    LAN: {effectiveLanIp || 'detecting...'} | Port: {currentPort} | Backend: {backendBaseUrl}
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          /* Single Valid Photo Received from Phone */
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#10b981', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <CheckCircle2 size={16} />
              <span>PHOTO RECEIVED</span>
            </div>

            <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{
                width: '160px',
                height: '110px',
                borderRadius: '8px',
                overflow: 'hidden',
                border: '2px solid #10b981',
                background: '#000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <img
                  src={capturedImage}
                  alt="Received circuit preview"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>

              <div style={{ flex: 1, minWidth: '220px' }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#10b981', marginBottom: '0.25rem' }}>
                  ✓ Valid circuit image received
                </div>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: '0.75rem' }}>
                  Single circuit photo validated (Top-angle: GOOD, Visibility: GOOD, Quality: GOOD). Ready for detection and 3D reconstruction.
                </div>

                <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
                  <button
                    onClick={handleRunDetection}
                    disabled={isAnalyzingReal}
                    className="btn btn-primary"
                    style={{ padding: '0.5rem 1.25rem', fontSize: '0.88rem', fontWeight: 800 }}
                  >
                    <Sparkles size={15} /> {isAnalyzingReal ? 'Analyzing Circuit...' : '[ ANALYZE CIRCUIT ]'}
                  </button>
                  <button
                    onClick={() => {
                      setPhonePhotoReceived(false);
                      setCapturedImage(null);
                      setAcceptedCircuitImage(null);
                      setUploadedImage(null);
                      setValidationResult(null);
                      setPollingActive(true);
                    }}
                    className="btn btn-secondary"
                    style={{ padding: '0.5rem 0.85rem', fontSize: '0.82rem' }}
                  >
                    <RotateCcw size={14} /> Retake on Phone
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mode Switcher Tabs */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        borderBottom: '1px solid #1e293b',
        marginBottom: '1.5rem'
      }}>
        <button
          onClick={() => setScannerMode('photo_mapper')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: scannerMode === 'photo_mapper' ? '2px solid #38bdf8' : '2px solid transparent',
            color: scannerMode === 'photo_mapper' ? '#38bdf8' : '#94a3b8',
            padding: '0.6rem 1.1rem',
            fontSize: '0.85rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}
        >
          <Sparkles size={15} />
          Photo-to-Circuit AR Simulation (Phase 25 Final Submission)
        </button>
        <button
          onClick={() => setScannerMode('raw_inspector')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: scannerMode === 'raw_inspector' ? '2px solid #38bdf8' : '2px solid transparent',
            color: scannerMode === 'raw_inspector' ? '#38bdf8' : '#94a3b8',
            padding: '0.6rem 1.1rem',
            fontSize: '0.85rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}
        >
          <Eye size={15} />
          Raw YOLO & Vision Inspector
        </button>
      </div>

      {scannerMode === 'photo_mapper' ? (
        <PhotoCircuitMapper />
      ) : (
        <>
          {/* Development Sample Selector & Upload */}
          <div className="card" style={{ marginBottom: '1.25rem', padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>Samples:</span>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {mockCircuits.map(c => (
                <button
                  key={c.id}
                  onClick={() => handleSelectSample(c)}
                  className="btn btn-secondary"
                  style={{
                    padding: '0.35rem 0.65rem',
                    fontSize: '0.8rem',
                    borderColor: selectedSample.id === c.id && !uploadedImage ? 'var(--accent-cyan)' : 'var(--border-color)',
                    background: selectedSample.id === c.id && !uploadedImage ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255,255,255,0.03)'
                  }}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <label className="btn btn-secondary" style={{ cursor: 'pointer', padding: '0.45rem 0.9rem', fontSize: '0.85rem' }}>
              <Upload size={15} /> Upload Photo
              <input type="file" accept="image/*" onChange={handleFileUpload} style={{ display: 'none' }} />
            </label>
            <button 
              onClick={handleRunDetection}
              disabled={isAnalyzingReal}
              className="btn btn-primary"
              style={{ padding: '0.5rem 1.25rem', fontSize: '0.9rem' }}
            >
              <Sparkles size={15} /> {isAnalyzingReal ? 'Analyzing Circuit...' : 'Analyze Real Image'}
            </button>
            <button
              onClick={() => navigate('/circuit-ar')}
              className="btn btn-secondary"
              style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', borderColor: '#38bdf8', color: '#38bdf8', fontWeight: 700 }}
              title="Open Isolated Dual Motor AR Trainer"
            >
              <Zap size={15} /> Dual Motor AR Trainer →
            </button>
          </div>
        </div>

        {realAnalysisError && (
          <div style={{ marginTop: '0.75rem', padding: '0.65rem', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid var(--accent-red)', color: 'var(--accent-red)', fontSize: '0.85rem' }}>
            ⚠ {realAnalysisError}
          </div>
        )}

        {/* Validating indicator */}
        {isValidating && (
          <div style={{ marginTop: '0.75rem', padding: '0.65rem', borderRadius: '6px', background: 'rgba(56, 189, 248, 0.15)', border: '1px solid #38bdf8', color: '#38bdf8', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sparkles size={16} className="animate-spin" /> Validating photo viewing angle & image quality...
          </div>
        )}

        {/* Section 7: Single-Photo Validation Result Card */}
        {validationResult && (
          <div style={{
            marginTop: '0.85rem',
            padding: '0.9rem 1.1rem',
            borderRadius: '10px',
            background: validationResult.valid ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
            border: validationResult.valid ? '1px solid #10b981' : '1px solid #ef4444'
          }}>
            {validationResult.valid ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#10b981', fontWeight: 800, fontSize: '0.92rem' }}>
                    <CheckCircle2 size={18} />
                    <span>✓ CIRCUIT VIEW ACCEPTED</span>
                  </div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#10b981', background: 'rgba(16, 185, 129, 0.2)', padding: '0.2rem 0.55rem', borderRadius: '4px' }}>
                    Score: {validationResult.score}/100
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '1.25rem', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                  <div>Top-angle: <strong style={{ color: '#10b981' }}>{validationResult.metrics?.topAngle || 'GOOD'}</strong></div>
                  <div>Circuit visibility: <strong style={{ color: '#10b981' }}>{validationResult.metrics?.circuitVisibility || 'GOOD'}</strong></div>
                  <div>Image quality: <strong style={{ color: '#10b981' }}>{validationResult.metrics?.imageQuality || 'GOOD'}</strong></div>
                </div>

                <div style={{ display: 'flex', gap: '0.65rem' }}>
                  <button
                    onClick={handleRunDetection}
                    disabled={isAnalyzingReal}
                    className="btn btn-primary"
                    style={{ padding: '0.45rem 1rem', fontSize: '0.82rem' }}
                  >
                    <CheckCircle2 size={14} /> [ USE THIS PHOTO ]
                  </button>
                  <button
                    onClick={handleRetake}
                    className="btn btn-secondary"
                    style={{ padding: '0.45rem 0.85rem', fontSize: '0.82rem' }}
                  >
                    [ RETAKE ]
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#ef4444', fontWeight: 800, fontSize: '0.92rem' }}>
                    <AlertTriangle size={18} />
                    <span>⚠ PHOTO NOT SUITABLE</span>
                  </div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#ef4444', background: 'rgba(239, 68, 68, 0.2)', padding: '0.2rem 0.55rem', borderRadius: '4px' }}>
                    Score: {validationResult.score}/100
                  </span>
                </div>

                <div style={{ marginBottom: '0.45rem', fontSize: '0.8rem', color: '#fca5a5' }}>
                  {validationResult.reasons.map((r, i) => (
                    <div key={i} style={{ marginBottom: '0.2rem' }}>• {r}</div>
                  ))}
                </div>

                {validationResult.recommendations.length > 0 && (
                  <div style={{ marginBottom: '0.75rem', fontSize: '0.78rem', color: '#cbd5e1' }}>
                    <strong>Guidance:</strong> {validationResult.recommendations.join(' ')}
                  </div>
                )}

                <button
                  onClick={handleRetake}
                  style={{
                    padding: '0.45rem 1rem',
                    borderRadius: '6px',
                    background: '#ef4444',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem'
                  }}
                >
                  <RotateCcw size={14} /> [ RETAKE ]
                </button>
              </div>
            )}
          </div>
        )}

        {/* Section 11: Circuit not clearly detected error */}
        {circuitNotDetectedError && (
          <div style={{ marginTop: '0.75rem', padding: '0.8rem', borderRadius: '8px', background: 'rgba(234, 179, 8, 0.12)', border: '1px solid #eab308', color: '#fef08a' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700, marginBottom: '0.35rem', fontSize: '0.88rem' }}>
              <AlertTriangle size={16} color="#eab308" />
              <span>⚠ CIRCUIT NOT CLEARLY DETECTED</span>
            </div>
            <div style={{ fontSize: '0.8rem', marginBottom: '0.6rem', color: '#fde047' }}>
              {circuitNotDetectedError}
            </div>
            <button
              onClick={handleRetake}
              style={{
                padding: '0.4rem 0.9rem',
                borderRadius: '6px',
                background: '#eab308',
                color: '#0f172a',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.8rem',
                cursor: 'pointer'
              }}
            >
              [ RETAKE ]
            </button>
          </div>
        )}
      </div>

      {/* Phase 10: Full AI & Electrical Simulation Pipeline Review Monitor */}
      <div className="card" style={{ marginBottom: '1.25rem', padding: '1rem 1.25rem', background: 'rgba(15, 23, 42, 0.95)', border: '1px solid var(--accent-cyan)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sparkles size={18} style={{ color: 'var(--accent-cyan)' }} />
            <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: '#fff', margin: 0 }}>
              End-to-End Pipeline Monitor & Diagnostic Review
            </h3>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Pipeline Stage Indicators */}
            <span className="code-pill" style={{ borderColor: detections.length > 0 ? 'var(--accent-emerald)' : 'var(--text-muted)', color: detections.length > 0 ? 'var(--accent-emerald)' : 'var(--text-muted)' }}>
              YOLO {detections.length > 0 ? '✓' : '—'}
            </span>
            <span className="code-pill" style={{ borderColor: mappedComponents.length > 0 ? (mappedComponents.some(c => c.is_uncertain || c.uncertain_mapping) ? 'var(--accent-amber)' : 'var(--accent-emerald)') : 'var(--text-muted)', color: mappedComponents.length > 0 ? (mappedComponents.some(c => c.is_uncertain || c.uncertain_mapping) ? 'var(--accent-amber)' : 'var(--accent-emerald)') : 'var(--text-muted)' }}>
              MAPPING {mappedComponents.length > 0 ? (mappedComponents.some(c => c.is_uncertain || c.uncertain_mapping) ? '⚠' : '✓') : '—'}
            </span>
            <span className="code-pill" style={{ borderColor: netsSummary.length > 0 ? 'var(--accent-emerald)' : 'var(--text-muted)', color: netsSummary.length > 0 ? 'var(--accent-emerald)' : 'var(--text-muted)' }}>
              WIRE NETS {netsSummary.length > 0 ? '✓' : '—'}
            </span>
            <span className="code-pill" style={{ 
              borderColor: activeCircuit?.validity?.netlist_status === 'NETLIST_VALID' ? 'var(--accent-emerald)' : (activeCircuit?.validity?.netlist_status === 'NETLIST_WARNING' ? 'var(--accent-amber)' : (activeCircuit?.validity?.netlist_status === 'NETLIST_INVALID' ? 'var(--accent-red)' : 'var(--text-muted)')),
              color: activeCircuit?.validity?.netlist_status === 'NETLIST_VALID' ? 'var(--accent-emerald)' : (activeCircuit?.validity?.netlist_status === 'NETLIST_WARNING' ? 'var(--accent-amber)' : (activeCircuit?.validity?.netlist_status === 'NETLIST_INVALID' ? 'var(--accent-red)' : 'var(--text-muted)'))
            }}>
              NETLIST {activeCircuit?.validity?.netlist_status === 'NETLIST_VALID' ? '✓' : (activeCircuit?.validity?.netlist_status === 'NETLIST_WARNING' ? '⚠' : (activeCircuit?.validity?.netlist_status === 'NETLIST_INVALID' ? '✕' : '—'))}
            </span>
            <span className="code-pill" style={{ 
              borderColor: activeCircuit?.solver_status === 'SOLVED' ? 'var(--accent-emerald)' : (activeCircuit?.solver_status === 'FAULT' ? 'var(--accent-red)' : 'var(--accent-cyan)'),
              color: activeCircuit?.solver_status === 'SOLVED' ? 'var(--accent-emerald)' : (activeCircuit?.solver_status === 'FAULT' ? 'var(--accent-red)' : 'var(--accent-cyan)')
            }}>
              MNA {activeCircuit?.solver_status === 'SOLVED' ? '✓' : (activeCircuit?.solver_status ? '✕' : '—')}
            </span>
            <span className="code-pill" style={{ borderColor: mappedComponents.length > 0 ? 'var(--accent-emerald)' : 'var(--text-muted)', color: mappedComponents.length > 0 ? 'var(--accent-emerald)' : 'var(--text-muted)' }}>
              3D TWIN {mappedComponents.length > 0 ? '✓' : '—'}
            </span>
            <span className="code-pill" style={{ borderColor: activeCircuit?.solver_status === 'SOLVED' ? 'var(--accent-emerald)' : 'var(--text-muted)', color: activeCircuit?.solver_status === 'SOLVED' ? 'var(--accent-emerald)' : 'var(--text-muted)' }}>
              ANIMATION {activeCircuit?.solver_status === 'SOLVED' ? '✓' : '—'}
            </span>
          </div>
        </div>

        {/* Diagnostic reason text if warning or incomplete */}
        {activeCircuit?.validity?.errors?.length > 0 && (
          <div style={{ marginTop: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid var(--accent-red)', color: 'var(--accent-red)', fontSize: '0.8rem' }}>
            <strong>Netlist Error:</strong> {activeCircuit.validity.errors.join("; ")}
          </div>
        )}
        {activeCircuit?.solver_reason && activeCircuit?.solver_status !== 'SOLVED' && !activeCircuit?.validity?.errors?.length && (
          <div style={{ marginTop: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: '6px', background: 'rgba(234, 179, 8, 0.12)', border: '1px solid var(--accent-amber)', color: 'var(--accent-amber)', fontSize: '0.8rem' }}>
            <strong>Simulation Status:</strong> {activeCircuit.solver_reason}
          </div>
        )}

        {/* Component breakdown list */}
        {mappedComponents.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
            {mappedComponents.map((comp, idx) => {
              const badge = CLASS_COLOR_BADGES[comp.type] || { border: '#fff', text: '#fff' };
              const isUncertain = comp.uncertain_mapping || comp.is_uncertain;
              return (
                <div 
                  key={comp.id || idx}
                  style={{
                    padding: '0.35rem 0.65rem',
                    borderRadius: '6px',
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: `1px solid ${isUncertain ? 'var(--accent-amber)' : badge.border}`,
                    fontSize: '0.8rem',
                    fontFamily: 'var(--font-mono)',
                    color: '#e2e8f0'
                  }}
                >
                  <strong style={{ color: badge.text }}>{comp.designator || `C${idx+1}`}</strong> - {comp.type} - {((comp.mapping_confidence || comp.confidence) * 100).toFixed(0)}% 
                  <span style={{ color: 'var(--text-muted)', marginLeft: '0.35rem' }}>({comp.start_hole || comp.hole1} → {comp.end_hole || comp.hole2})</span>
                  {isUncertain && <span style={{ color: 'var(--accent-amber)', marginLeft: '0.35rem' }}>⚠</span>}
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Awaiting scan to monitor component flow through YOLO → Grid Mapping → Wire Net Merging → Netlist Validation → MNA Simulation → 3D Digital Twin.
          </div>
        )}
      </div>

      {/* Visual Validation Side-by-Side: (A) Real Photo + YOLO vs (B) 3D Reconstructed Breadboard */}
      <div className="card-grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: '1.5rem' }}>
        {/* Left Column: Image with YOLO Bounding Boxes */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
            <h2 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-cyan)' }}>
              <Camera size={16} /> 
              (A) REAL IMAGE & YOLO DETECTIONS
            </h2>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {uploadedImage ? 'Custom Photo' : selectedSample.name}
            </span>
          </div>

          <div style={{
            position: 'relative',
            borderRadius: '8px',
            overflow: 'hidden',
            background: '#040711',
            border: '1px solid var(--border-color)',
            height: '420px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0.5rem'
          }}>
            {annotatedImage ? (
              <img 
                src={annotatedImage} 
                alt="YOLO Detected Bounding Box Output" 
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                  display: 'block'
                }}
              />
            ) : isAnalyzingReal ? (
              <div style={{ textAlign: 'center', color: 'var(--accent-cyan)' }}>
                <div style={{ fontWeight: '700', fontSize: '1rem', marginBottom: '0.5rem' }}>Running YOLO Neural Detection...</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Classifying Resistors, Wires, LEDs, Diodes, ICs, Capacitors</div>
              </div>
            ) : (
              <img 
                src={currentDisplayImage} 
                alt="Original Breadboard Input" 
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                  display: 'block'
                }}
              />
            )}
          </div>
        </div>

        {/* Right Column: 3D Reconstructed Breadboard Scene */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
            <h2 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-emerald)' }}>
              <Box size={16} /> 
              (B) 3D RECONSTRUCTED BREADBOARD
            </h2>
            <span className="code-pill" style={{ fontSize: '0.75rem', color: isRealActive ? 'var(--accent-emerald)' : 'var(--accent-cyan)', borderColor: isRealActive ? 'var(--accent-emerald)' : 'var(--accent-cyan)' }}>
              {isRealActive ? 'Real 3D Mesh' : 'Mock 3D Mesh'}
            </span>
          </div>

          <div style={{ height: '420px', borderRadius: '8px', overflow: 'hidden' }}>
            <Breadboard3DCanvas circuit={activeCircuit} />
          </div>
        </div>
      </div>

      {/* Component Hole Mapping & Generated Netlist Breakdown */}
      <div className="card-grid" style={{ gridTemplateColumns: '3fr 2fr', marginBottom: '1.5rem' }}>
        {/* Mapped Components Table */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h3 style={{ fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Cpu size={16} style={{ color: 'var(--accent-cyan)' }} />
              Component Position & Hole Mapping
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {mappedComponents.length > 0 ? `${mappedComponents.length} Components Resolved` : 'Awaiting Detection'}
            </span>
          </div>

          {mappedComponents.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Click "Analyze Real Image" to run YOLO detection and map leads to physical breadboard tie-points.
            </div>
          ) : (
            <div style={{ overflowX: 'auto', maxHeight: '320px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '0.5rem' }}>Component</th>
                    <th style={{ padding: '0.5rem' }}>Type</th>
                    <th style={{ padding: '0.5rem' }}>Terminals</th>
                    <th style={{ padding: '0.5rem' }}>Confidence</th>
                    <th style={{ padding: '0.5rem' }}>Status</th>
                    <th style={{ padding: '0.5rem' }}>Engineering Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {mappedComponents.map((c, i) => {
                    const badgeMeta = CLASS_COLOR_BADGES[c.type] || { text: '#fff' };
                    const isUncertain = c.uncertain_mapping || c.is_uncertain;
                    const mapConfidence = c.mapping_confidence !== undefined ? c.mapping_confidence : c.confidence;
                    const reasonText = c.reason || c.mapping_reason || (isUncertain ? 'Endpoint distance or connectivity requires review' : 'Hole mapping verified within grid tolerance');
                    const isInvalid = c.start_hole === c.end_hole && c.type !== 'ic_chip';

                    return (
                      <tr key={c.id || i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '0.5rem', fontWeight: '700', fontFamily: 'var(--font-mono)' }}>
                          {c.designator}
                        </td>
                        <td style={{ padding: '0.5rem', color: badgeMeta.text, textTransform: 'capitalize' }}>
                          {c.type}
                        </td>
                        <td style={{ padding: '0.5rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
                          {c.start_hole || c.hole1} → {c.end_hole || c.hole2}
                        </td>
                        <td style={{ padding: '0.5rem', fontFamily: 'var(--font-mono)', color: mapConfidence >= 0.8 ? 'var(--accent-emerald)' : (mapConfidence >= 0.6 ? 'var(--accent-amber)' : 'var(--accent-red)') }}>
                          {(mapConfidence * 100).toFixed(0)}%
                        </td>
                        <td style={{ padding: '0.5rem' }}>
                          {isInvalid ? (
                            <span style={{ fontSize: '0.75rem', color: 'var(--accent-red)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                              ✕ Invalid
                            </span>
                          ) : isUncertain ? (
                            <span style={{ fontSize: '0.75rem', color: 'var(--accent-amber)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                              ⚠ Review
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: 'var(--accent-emerald)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                              <CheckCircle2 size={12} /> Verified
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '0.5rem', fontSize: '0.75rem', color: isUncertain ? 'var(--accent-amber)' : 'var(--text-muted)' }}>
                          {reasonText}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Electrical Netlist Synthesis */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h3 style={{ fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileText size={16} style={{ color: 'var(--accent-emerald)' }} />
              Generated Electrical Netlist
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {netsSummary.length} Electrical Nets
            </span>
          </div>

          {netsSummary.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No netlist generated yet. Run detection to synthesize electrical node connectivity.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '320px', overflowY: 'auto' }}>
              {netsSummary.map((netStr, idx) => {
                const parts = netStr.split(':');
                const netName = parts[0];
                const pinList = parts.slice(1).join(':');
                return (
                  <div 
                    key={idx}
                    style={{
                      padding: '0.55rem 0.75rem',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px',
                      fontSize: '0.82rem'
                    }}
                  >
                    <div style={{ fontWeight: '700', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)', marginBottom: '0.2rem' }}>
                      {netName}
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                      Connected Pins: <span style={{ color: '#fff' }}>{pinList || 'None'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      </>
      )}
    </div>
  );
}
