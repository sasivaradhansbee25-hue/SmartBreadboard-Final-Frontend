import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useCircuit } from '../context/CircuitContext';
import {
  calculateVideoDisplayRect,
  cameraPixelToScreenCoord,
  screenCoordToCameraPixel,
  calculateComponentAnchor
} from '../utils/arCoordinateTransform';
import {
  formatVoltage,
  formatCurrent,
  formatPower
} from '../utils/electricalFormatter';
import ARInteractiveInspector from './ARInteractiveInspector';
import VisualCircuitAnnotations from './VisualCircuitAnnotations';
import {
  Eye,
  Zap,
  Layers,
  Activity,
  Sparkles,
  Sliders,
  Info,
  CheckCircle2,
  Edit3,
  Undo2,
  Redo2,
  RotateCcw,
  AlertTriangle,
  Flame
} from 'lucide-react';

export default function ARCameraOverlay({
  videoRef,
  imageRef,
  containerRef,
  trackedComponents = [],
  registration = null,
  videoWidth = 1280,
  videoHeight = 720,
  isActive = true,
  onOpenEditModal = null,
  onOpenWhatIfModal = null,
  visualGroundingState = null,
  highlightedComponentId = null,
  showAnnotationOverlay = true,
  onAskAI = null
}) {
  const {
    activeCircuit,
    simulationResult,
    simulationStatus,
    simulationSignature,
    measurements,
    solverStatus,
    solverError,
    selectedComponent,
    setSelectedComponent,
    selectedNet,
    selectNet,
    isEditMode,
    setIsEditMode,
    undoDigitalEdit,
    redoDigitalEdit,
    resetDigitalChanges,
    canUndo,
    canRedo,
    circuitIntelligence,
    currentTransientSample,
    currentTimeIndex
  } = useCircuit();

  // AR Layer Feature Toggles
  const [arEnabled, setArEnabled] = useState(true);
  const [showComponents, setShowComponents] = useState(true);
  const [showElectrical, setShowElectrical] = useState(true);
  const [showNets, setShowNets] = useState(true);
  const [showCurrentFlow, setShowCurrentFlow] = useState(true);
  const [showValidationWarnings, setShowValidationWarnings] = useState(true);
  const [showDebug, setShowDebug] = useState(false);

  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const particleOffsetRef = useRef(0);

  // Match normalized electrical data for a component with strict freshness gating (Phase 24.2 / 24.4)
  const getComponentElectrical = useCallback((comp) => {
    if (!comp) return null;

    // Strict Freshness Check per Phase 24.2 Rule:
    // Only show values when simulation_signature === current_circuit_signature
    // Never show stale simulation values.
    const currentSig = activeCircuit?.circuit_signature;
    const simSig = simulationSignature || simulationResult?.simulation_signature || simulationResult?.circuit_signature;
    if (!simSig || !currentSig || simSig !== currentSig) {
      return null;
    }

    const cid = (comp.id || '').toUpperCase();
    const cdes = (comp.designator || '').toUpperCase();

    // 0. Phase 24.4: Priority to active transient timeline sample
    if (currentTransientSample) {
      const tCurr = currentTransientSample.componentCurrents?.[cdes] ?? currentTransientSample.componentCurrents?.[cid] ?? currentTransientSample.componentCurrents?.[comp.id] ?? currentTransientSample.componentCurrents?.[comp.designator];
      const tVolt = currentTransientSample.componentVoltages?.[cdes] ?? currentTransientSample.componentVoltages?.[cid] ?? currentTransientSample.componentVoltages?.[comp.id] ?? currentTransientSample.componentVoltages?.[comp.designator];
      const tPow = currentTransientSample.componentPower?.[cdes] ?? currentTransientSample.componentPower?.[cid] ?? currentTransientSample.componentPower?.[comp.id] ?? currentTransientSample.componentPower?.[comp.designator];
      if (tCurr !== undefined || tVolt !== undefined || tPow !== undefined) {
        const cCurr = typeof tCurr === 'number' ? tCurr : 0;
        const cVolt = typeof tVolt === 'number' ? tVolt : 0;
        const cPow = typeof tPow === 'number' ? tPow : Math.abs(cVolt * cCurr);
        return {
          voltage: Math.abs(cVolt),
          voltage_drop: cVolt,
          current: cCurr,
          power: cPow,
          direction: cCurr >= 0 ? 'pin1_to_pin2' : 'pin2_to_pin1',
          state: Math.abs(cCurr) > 1e-4 ? 'ACTIVE' : (Math.abs(cVolt) > 0.01 ? 'CHARGED' : 'STEADY'),
          forward_voltage: Math.abs(cVolt)
        };
      }
    }

    // 1. Check Phase 24.2 structured simulation results
    if (simulationResult?.results) {
      const resMeas = simulationResult.results.measurements?.[cdes] || simulationResult.results.measurements?.[cid] || simulationResult.results.measurements?.[comp.id] || simulationResult.results.measurements?.[comp.designator];
      const resCurr = simulationResult.results.branch_currents?.[cdes] ?? simulationResult.results.branch_currents?.[cid] ?? simulationResult.results.branch_currents?.[comp.id] ?? simulationResult.results.branch_currents?.[comp.designator];
      const resPow = simulationResult.results.component_power?.[cdes] ?? simulationResult.results.component_power?.[cid] ?? simulationResult.results.component_power?.[comp.id] ?? simulationResult.results.component_power?.[comp.designator];
      if (resMeas || resCurr !== undefined || resPow !== undefined) {
        return {
          voltage: resMeas?.voltage_drop ?? resMeas?.voltage,
          current: resCurr ?? resMeas?.current ?? 0,
          power: resPow ?? resMeas?.power ?? 0,
          direction: resMeas?.direction ?? (resCurr > 0 ? 'pin1_to_pin2' : 'unknown'),
          state: resMeas?.state ?? (Math.abs(resCurr || 0) > 1e-4 ? 'ACTIVE' : 'OFF'),
          forward_voltage: resMeas?.voltage_drop
        };
      }
    }

    if (simulationResult?.components && Array.isArray(simulationResult.components)) {
      const match = simulationResult.components.find(c => {
        const sid = (c.id || '').toUpperCase();
        const sdes = (c.designator || '').toUpperCase();
        return (sid && (sid === cid || sid === cdes)) || (sdes && (sdes === cid || sdes === cdes));
      });
      if (match) return match;
    }

    if (simulationResult?.digital_twin?.components) {
      const match = simulationResult.digital_twin.components.find(c => {
        const sid = (c.id || '').toUpperCase();
        const sdes = (c.designator || '').toUpperCase();
        return (sid && (sid === cid || sid === cdes)) || (sdes && (sdes === cid || sdes === cdes));
      });
      if (match?.electrical) return match.electrical;
    }

    const m = measurements?.[comp.designator] || measurements?.[comp.id] || measurements?.[cdes] || measurements?.[cid];
    if (m) {
      return {
        voltage: m.voltage !== undefined ? m.voltage : (m.voltageDrop !== undefined ? Math.abs(m.voltageDrop) : undefined),
        current: m.current,
        power: m.power,
        direction: m.direction,
        state: m.state,
        forward_voltage: m.forward_voltage
      };
    }

    return null;
  }, [simulationResult, simulationSignature, activeCircuit, measurements, currentTransientSample, currentTimeIndex]);

  // Main AR Canvas Render Loop
  const renderARScene = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef?.current;
    const video = videoRef?.current;

    if (!canvas || !container || !isActive) {
      animFrameRef.current = requestAnimationFrame(renderARScene);
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Synchronize canvas resolution with container
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 520;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!arEnabled) {
      animFrameRef.current = requestAnimationFrame(renderARScene);
      return;
    }

    // Compute exact video or image display rectangle with letterbox handling
    const imgElem = imageRef?.current;
    const vWidth = (video && video.videoWidth > 0)
      ? video.videoWidth
      : (imgElem && (imgElem.naturalWidth || imgElem.width) > 0
        ? (imgElem.naturalWidth || imgElem.width)
        : videoWidth);
    const vHeight = (video && video.videoHeight > 0)
      ? video.videoHeight
      : (imgElem && (imgElem.naturalHeight || imgElem.height) > 0
        ? (imgElem.naturalHeight || imgElem.height)
        : videoHeight);
    const displayRect = calculateVideoDisplayRect(width, height, vWidth, vHeight, 'contain');

    particleOffsetRef.current = (particleOffsetRef.current + 0.02) % 1.0;
    const isSolved = (solverStatus === 'SOLVED' || simulationResult?.solver_status === 'SOLVED');

    // 1. Render Breadboard Registration Boundary Frame
    if (registration?.breadboard_corners && registration.breadboard_corners.length === 4) {
      const corners = registration.breadboard_corners.map(pt =>
        cameraPixelToScreenCoord(pt[0], pt[1], displayRect)
      );

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(corners[0].x, corners[0].y);
      ctx.lineTo(corners[1].x, corners[1].y);
      ctx.lineTo(corners[2].x, corners[2].y);
      ctx.lineTo(corners[3].x, corners[3].y);
      ctx.closePath();

      ctx.strokeStyle = registration.status === 'HIGH' ? 'rgba(56, 189, 248, 0.45)' : 'rgba(245, 158, 11, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([8, 6]);
      ctx.stroke();

      // Corner accent brackets
      corners.forEach((c) => {
        ctx.fillStyle = registration.status === 'HIGH' ? '#38bdf8' : '#f59e0b';
        ctx.beginPath();
        ctx.arc(c.x, c.y, 4, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    }

    // 2. Render Net / Wire Connection Paths & Highlighted Selected Net
    if ((showNets || selectedNet) && Array.isArray(trackedComponents)) {
      const netGroups = {};
      trackedComponents.forEach(comp => {
        if (comp.node1 && comp.node1 !== 'N/A') {
          if (!netGroups[comp.node1]) netGroups[comp.node1] = [];
          netGroups[comp.node1].push(comp);
        }
        if (comp.node2 && comp.node2 !== 'N/A') {
          if (!netGroups[comp.node2]) netGroups[comp.node2] = [];
          netGroups[comp.node2].push(comp);
        }
      });

      Object.entries(netGroups).forEach(([netId, comps]) => {
        const isNetHighlighted = selectedNet && (selectedNet === netId);
        if (comps.length > 1 || isNetHighlighted) {
          ctx.save();
          ctx.beginPath();
          comps.forEach((c, idx) => {
            const anchor = calculateComponentAnchor(c, displayRect);
            if (idx === 0) ctx.moveTo(anchor.anchorScreen.x, anchor.anchorScreen.y);
            else ctx.lineTo(anchor.anchorScreen.x, anchor.anchorScreen.y);
          });

          if (isNetHighlighted) {
            ctx.strokeStyle = '#00ffff';
            ctx.lineWidth = 3.5;
            ctx.shadowColor = '#00ffff';
            ctx.shadowBlur = 12;
            ctx.setLineDash([]);
          } else {
            ctx.strokeStyle = 'rgba(129, 140, 248, 0.35)';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
          }
          ctx.stroke();
          ctx.restore();
        }
      });
    }

    // 3. Render Tracked Component AR Badges, Anchors & Callout Lines
    if (showComponents && Array.isArray(trackedComponents)) {
      trackedComponents.forEach((comp) => {
        const { anchorScreen, labelScreen, t1Screen, t2Screen } = calculateComponentAnchor(comp, displayRect);
        const elec = getComponentElectrical(comp);
        const state = (comp.tracking_state || 'TRACKED').toUpperCase();
        const isSelected = selectedComponent && (selectedComponent.id === comp.id || selectedComponent.designator === comp.designator);
        const isCompNetHighlighted = selectedNet && (comp.node1 === selectedNet || comp.node2 === selectedNet);

        let themeColor = '#38bdf8'; // Cyan
        if (state === 'TRACKED') themeColor = '#10b981'; // Emerald
        else if (state === 'REACQUIRED') themeColor = '#f59e0b'; // Amber
        else if (state === 'LOST') themeColor = '#ef4444'; // Red

        if (isSelected || isCompNetHighlighted) {
          themeColor = '#00ffff';
        }

        // A. Physical Component Lead Anchor Dot
        ctx.save();
        ctx.beginPath();
        ctx.arc(anchorScreen.x, anchorScreen.y, isSelected ? 6.5 : 4.5, 0, Math.PI * 2);
        ctx.fillStyle = themeColor;
        ctx.shadowColor = themeColor;
        ctx.shadowBlur = isSelected ? 12 : 8;
        ctx.fill();

        // Terminal markers if both terminals resolved
        if (t1Screen && t2Screen) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
          ctx.beginPath();
          ctx.arc(t1Screen.x, t1Screen.y, 2.5, 0, Math.PI * 2);
          ctx.arc(t2Screen.x, t2Screen.y, 2.5, 0, Math.PI * 2);
          ctx.fill();

          // Directional current particle animation along lead axis (proportional to simulated current)
          if (showCurrentFlow && isSolved && elec && Math.abs(elec.current || 0) > 1e-6) {
            let dir = 1;
            if (elec.direction === 'pin2_to_pin1') {
              dir = -1;
            } else if (elec.direction === 'pin1_to_pin2') {
              dir = 1;
            } else {
              dir = (elec.current || 0) >= 0 ? 1 : -1;
            }
            const refCurrent = 0.01;
            const speedFactor = Math.min(Math.max(Math.pow(Math.abs(elec.current) / refCurrent, 0.75), 0.2), 3.0);
            let progress = (particleOffsetRef.current * speedFactor * dir + 1.0) % 1.0;
            const px = t1Screen.x + (t2Screen.x - t1Screen.x) * progress;
            const py = t1Screen.y + (t2Screen.y - t1Screen.y) * progress;

            ctx.fillStyle = Math.abs(elec.current) > 0.025 ? '#f59e0b' : '#38bdf8';
            ctx.shadowColor = ctx.fillStyle;
            ctx.shadowBlur = 6;
            ctx.beginPath();
            ctx.arc(px, py, 3, 0, Math.PI * 2);
            ctx.fill();
          }

          // LED Glowing Aura (Proportional to forward operating current)
          if (comp.type === 'led' && isSolved && elec && (elec.state === 'ON' || (elec.current || 0) > 0.0005)) {
            const glowAlpha = Math.min(0.4 + (Math.abs(elec.current || 0) / 0.015) * 0.4, 0.95);
            ctx.beginPath();
            ctx.arc(anchorScreen.x, anchorScreen.y, 14, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(16, 185, 129, ${glowAlpha})`;
            ctx.lineWidth = 2.5;
            ctx.shadowColor = '#10b981';
            ctx.shadowBlur = 14;
            ctx.stroke();
          }
        }
        ctx.restore();

        // B. Dynamic AR Callout Line
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(anchorScreen.x, anchorScreen.y);
        ctx.lineTo(anchorScreen.x, labelScreen.y + 20);
        ctx.lineTo(labelScreen.x, labelScreen.y + 15);
        ctx.strokeStyle = isSelected ? '#00ffff' : (state === 'LOST' ? 'rgba(239, 68, 68, 0.5)' : 'rgba(56, 189, 248, 0.5)');
        ctx.lineWidth = isSelected ? 2.5 : 1.2;
        if (state === 'LOST') ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.restore();

        // C. Floating AR Glassmorphic Badge
        const des = comp.designator || comp.id || 'Comp';
        const typeStr = (comp.type || 'Component').toUpperCase();
        const valueStr = comp.user_override_value || comp.displayValue || comp.formatted_value || comp.detected_value || '';
        const hole1 = comp.hole1 || comp.start_hole || '—';
        const hole2 = comp.hole2 || comp.end_hole || '—';

        // Format live electrical data string
        let elecLine1 = '';
        let elecLine2 = '';
        if (showElectrical) {
          if (isSolved && elec) {
            if (comp.type === 'resistor') {
              elecLine1 = `V: ${formatVoltage(elec.voltage)} | I: ${formatCurrent(elec.current)}`;
              elecLine2 = `P: ${formatPower(elec.power)}`;
            } else if (comp.type === 'led') {
              elecLine1 = `Vf: ${formatVoltage(elec.forward_voltage ?? elec.voltage)} | I: ${formatCurrent(elec.current)}`;
              elecLine2 = `State: ${elec.state || 'ON'}`;
            } else if (comp.type === 'wire') {
              elecLine1 = `Net: ${comp.node1 || comp.net || 'N/A'}`;
              elecLine2 = `I: ${formatCurrent(elec.current)}`;
            } else {
              elecLine1 = `V: ${formatVoltage(elec.voltage)} | I: ${formatCurrent(elec.current)}`;
            }
          } else if (solverStatus === 'ERROR' || simulationResult?.solver_status === 'ERROR') {
            elecLine1 = '⚠ CIRCUIT FAULT';
            elecLine2 = 'Check Warnings / Short';
          } else if (solverStatus === 'NOT_RUN' || simulationResult?.solver_status === 'NOT_RUN' || solverStatus === 'POWER_REQUIRED') {
            elecLine1 = '○ NO POWER';
            elecLine2 = 'Simulation: NOT RUN';
          } else {
            elecLine1 = 'Simulation: IDLE';
          }
        }

        // Draw Badge Box
        const badgeW = showElectrical && elecLine1 ? 165 : 135;
        const badgeH = showElectrical && elecLine2 ? 54 : (showElectrical && elecLine1 ? 42 : 28);
        const badgeX = labelScreen.x - badgeW / 2;
        const badgeY = labelScreen.y - badgeH / 2;

        ctx.save();
        ctx.fillStyle = isSelected ? 'rgba(10, 24, 48, 0.96)' : 'rgba(8, 14, 26, 0.88)';
        ctx.strokeStyle = isSelected ? '#00ffff' : themeColor;
        ctx.lineWidth = isSelected ? 2 : 1;

        if (ctx.roundRect) {
          ctx.beginPath();
          ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 6);
          ctx.fill();
          ctx.stroke();
        } else {
          ctx.fillRect(badgeX, badgeY, badgeW, badgeH);
          ctx.strokeRect(badgeX, badgeY, badgeW, badgeH);
        }

        // Badge Header
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.fillStyle = themeColor;
        ctx.fillText(`${des} ${comp.is_digital ? '⚡[DIGITAL]' : ''}`, badgeX + 7, badgeY + 13);

        ctx.font = '10px Inter, sans-serif';
        ctx.fillStyle = '#cbd5e1';
        ctx.fillText(`(${hole1}↔${hole2})`, badgeX + badgeW - 54, badgeY + 13);

        // Electrical Line 1
        if (showElectrical && elecLine1) {
          ctx.font = isSolved ? 'bold 10px Inter, sans-serif' : '10px Inter, sans-serif';
          ctx.fillStyle = isSolved ? '#f8fafc' : '#f59e0b';
          ctx.fillText(elecLine1, badgeX + 7, badgeY + 28);
        }

        // Electrical Line 2
        if (showElectrical && elecLine2) {
          ctx.font = '10px Inter, sans-serif';
          ctx.fillStyle = '#94a3b8';
          ctx.fillText(elecLine2, badgeX + 7, badgeY + 44);
        }

        ctx.restore();
      });
    }

    // 4. Render AR Debug Mode Overlay
    if (showDebug) {
      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1;
      ctx.fillRect(10, 10, 250, 125);
      ctx.strokeRect(10, 10, 250, 125);

      ctx.font = 'bold 11px Inter, monospace';
      ctx.fillStyle = '#38bdf8';
      ctx.fillText('AR LAB DEBUG METRICS', 18, 26);

      ctx.font = '10px Inter, monospace';
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText(`Mode: ${isEditMode ? 'EDIT (DIGITAL LAB)' : 'VIEW (ACTIVE AR)'}`, 18, 42);
      ctx.fillText(`Registration: ${registration?.status || 'UNREGISTERED'} (${Math.round((registration?.confidence || 0) * 100)}%)`, 18, 56);
      ctx.fillText(`Camera Res: ${vWidth}x${vHeight}`, 18, 70);
      ctx.fillText(`Display Rect: ${Math.round(displayRect.displayedWidth)}x${Math.round(displayRect.displayedHeight)}`, 18, 84);
      ctx.fillText(`Tracked Objects: ${trackedComponents.length}`, 18, 98);
      ctx.fillText(`Selected Net: ${selectedNet || 'NONE'}`, 18, 112);
      ctx.restore();
    }

    animFrameRef.current = requestAnimationFrame(renderARScene);
  }, [
    isActive,
    arEnabled,
    showComponents,
    showElectrical,
    showNets,
    showCurrentFlow,
    showValidationWarnings,
    showDebug,
    trackedComponents,
    registration,
    videoWidth,
    videoHeight,
    containerRef,
    videoRef,
    selectedComponent,
    selectedNet,
    isEditMode,
    solverStatus,
    simulationResult,
    getComponentElectrical
  ]);

  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(renderARScene);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [renderARScene]);

  // Tap-to-Select Raycasting Handler
  const handleCanvasPointerDown = (e) => {
    if (!canvasRef.current || !containerRef?.current || !trackedComponents.length) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const vWidth = (videoRef?.current && videoRef.current.videoWidth > 0) ? videoRef.current.videoWidth : videoWidth;
    const vHeight = (videoRef?.current && videoRef.current.videoHeight > 0) ? videoRef.current.videoHeight : videoHeight;
    const displayRect = calculateVideoDisplayRect(canvasRef.current.width, canvasRef.current.height, vWidth, vHeight, 'contain');

    let hitComponent = null;
    let minDistance = 50; // Hit radius in screen pixels

    trackedComponents.forEach(comp => {
      const { anchorScreen, labelScreen } = calculateComponentAnchor(comp, displayRect);
      const distAnchor = Math.hypot(clickX - anchorScreen.x, clickY - anchorScreen.y);
      const distLabel = Math.hypot(clickX - labelScreen.x, clickY - labelScreen.y);

      if (distAnchor < minDistance || distLabel < minDistance) {
        minDistance = Math.min(distAnchor, distLabel);
        hitComponent = comp;
      }
    });

    if (hitComponent) {
      const elec = getComponentElectrical(hitComponent);
      const packaged = {
        ...hitComponent,
        name: hitComponent.designator || hitComponent.id,
        electrical: elec,
        solver_status: simulationResult?.solver_status || solverStatus
      };
      setSelectedComponent(packaged);
    }
  };

  const selectedElec = getComponentElectrical(selectedComponent);

  const containerW = containerRef?.current?.clientWidth || 800;
  const containerH = containerRef?.current?.clientHeight || 520;
  const vWidth = (videoRef?.current && videoRef.current.videoWidth > 0) ? videoRef.current.videoWidth : videoWidth;
  const vHeight = (videoRef?.current && videoRef.current.videoHeight > 0) ? videoRef.current.videoHeight : videoHeight;
  const currentDisplayRect = calculateVideoDisplayRect(containerW, containerH, vWidth, vHeight, 'contain');

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
      {/* AR Interactive Canvas Layer */}
      <canvas
        ref={canvasRef}
        onPointerDown={handleCanvasPointerDown}
        style={{
          width: '100%',
          height: '100%',
          pointerEvents: arEnabled ? 'auto' : 'none',
          cursor: arEnabled ? 'pointer' : 'default'
        }}
      />

      {/* Phase 22.2 Verified Visual Circuit Annotations Layer */}
      {showAnnotationOverlay && visualGroundingState && arEnabled && (
        <VisualCircuitAnnotations
          visualGroundingState={visualGroundingState}
          displayRect={currentDisplayRect}
          containerWidth={containerW}
          containerHeight={containerH}
          selectedComponentId={selectedComponent?.id || selectedComponent?.designator}
          highlightedComponentId={highlightedComponentId}
          onSelectComponent={(comp) => {
            const elec = getComponentElectrical(comp);
            const packaged = {
              ...comp,
              name: comp.label || comp.id,
              electrical: elec,
              solver_status: simulationResult?.solver_status || solverStatus
            };
            setSelectedComponent(packaged);
          }}
          currentCircuitSignature={visualGroundingState?.circuit_signature}
          onAskAI={onAskAI}
          showControls={true}
        />
      )}

      {/* Interactive AR Component Inspector */}
      {selectedComponent && arEnabled && !visualGroundingState && (
        <ARInteractiveInspector
          component={selectedComponent}
          electrical={selectedElec}
          solverStatus={solverStatus}
          onEditValue={(comp) => onOpenEditModal && onOpenEditModal(comp)}
          onStartWhatIf={(comp) => onOpenWhatIfModal && onOpenWhatIfModal(comp)}
          onHighlightNet={(netId) => selectNet(netId)}
          onClose={() => setSelectedComponent(null)}
        />
      )}

      {/* AR Mode Control Toolbar */}
      <div
        style={{
          position: 'absolute',
          bottom: '12px',
          left: '12px',
          right: '12px',
          zIndex: 20,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '6px',
          pointerEvents: 'auto'
        }}
      >
        {/* AR Master Switch, Edit Mode Toggle & History Buttons */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => setArEnabled(prev => !prev)}
            style={{
              background: arEnabled ? 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)' : '#1e293b',
              color: '#fff',
              border: arEnabled ? '1px solid #38bdf8' : '1px solid #475569',
              borderRadius: '6px',
              padding: '0.35rem 0.75rem',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              boxShadow: arEnabled ? '0 0 12px rgba(56, 189, 248, 0.4)' : 'none'
            }}
          >
            <Sparkles size={14} />
            {arEnabled ? '✨ AR: ON' : 'AR: OFF'}
          </button>

          {/* Phase 25 AR Circuit Intelligence Badge */}
          {circuitIntelligence?.classification && (
            <div
              style={{
                background: circuitIntelligence.classification.verificationState === 'VERIFIED'
                  ? 'rgba(16, 185, 129, 0.2)'
                  : 'rgba(30, 41, 59, 0.85)',
                border: circuitIntelligence.classification.verificationState === 'VERIFIED'
                  ? '1px solid #10b981'
                  : '1px solid #475569',
                color: circuitIntelligence.classification.verificationState === 'VERIFIED'
                  ? '#34d399'
                  : '#94a3b8',
                borderRadius: '6px',
                padding: '0.35rem 0.65rem',
                fontSize: '0.74rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                boxShadow: circuitIntelligence.classification.verificationState === 'VERIFIED'
                  ? '0 0 10px rgba(16, 185, 129, 0.3)'
                  : 'none'
              }}
              title={circuitIntelligence.explanation?.summary || 'Circuit Intelligence'}
            >
              <Zap size={12} />
              {circuitIntelligence.classification.displayName}
            </div>
          )}

          {/* Mode Switch: View Mode vs Edit Mode */}
          <button
            onClick={() => setIsEditMode(prev => !prev)}
            style={{
              background: isEditMode ? 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)' : '#1e293b',
              color: isEditMode ? '#fff' : '#cbd5e1',
              border: isEditMode ? '1px solid #a78bfa' : '1px solid #334155',
              borderRadius: '6px',
              padding: '0.35rem 0.75rem',
              fontSize: '0.76rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
          >
            <Edit3 size={13} />
            {isEditMode ? '✏ EDIT MODE (DIGITAL)' : '👁 VIEW MODE'}
          </button>

          {/* Undo / Redo / Reset Quick Controls */}
          {isEditMode && (
            <div style={{ display: 'flex', gap: '3px', background: 'rgba(15, 23, 42, 0.85)', padding: '2px', borderRadius: '6px', border: '1px solid #334155' }}>
              <button
                onClick={undoDigitalEdit}
                disabled={!canUndo}
                style={{
                  background: canUndo ? '#334155' : 'transparent',
                  color: canUndo ? '#fff' : '#64748b',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '0.3rem 0.5rem',
                  cursor: canUndo ? 'pointer' : 'default',
                  display: 'flex',
                  alignItems: 'center'
                }}
                title="Undo Digital Edit"
              >
                <Undo2 size={13} />
              </button>

              <button
                onClick={redoDigitalEdit}
                disabled={!canRedo}
                style={{
                  background: canRedo ? '#334155' : 'transparent',
                  color: canRedo ? '#fff' : '#64748b',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '0.3rem 0.5rem',
                  cursor: canRedo ? 'pointer' : 'default',
                  display: 'flex',
                  alignItems: 'center'
                }}
                title="Redo Digital Edit"
              >
                <Redo2 size={13} />
              </button>

              <button
                onClick={resetDigitalChanges}
                style={{
                  background: 'transparent',
                  color: '#f87171',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '0.3rem 0.5rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  gap: '0.25rem'
                }}
                title="Reset Digital Changes to Scanned Circuit"
              >
                <RotateCcw size={12} /> Reset
              </button>
            </div>
          )}
        </div>

        {/* Feature Toggles */}
        {arEnabled && (
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              onClick={() => setShowComponents(prev => !prev)}
              style={{
                background: showComponents ? 'rgba(56, 189, 248, 0.2)' : 'rgba(15, 23, 42, 0.8)',
                color: showComponents ? '#38bdf8' : '#94a3b8',
                border: showComponents ? '1px solid #38bdf8' : '1px solid #334155',
                borderRadius: '5px',
                padding: '0.25rem 0.55rem',
                fontSize: '0.72rem',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              🏷 Comps
            </button>

            <button
              onClick={() => setShowElectrical(prev => !prev)}
              style={{
                background: showElectrical ? 'rgba(16, 185, 129, 0.2)' : 'rgba(15, 23, 42, 0.8)',
                color: showElectrical ? '#10b981' : '#94a3b8',
                border: showElectrical ? '1px solid #10b981' : '1px solid #334155',
                borderRadius: '5px',
                padding: '0.25rem 0.55rem',
                fontSize: '0.72rem',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              ⚡ Elec
            </button>

            <button
              onClick={() => setShowNets(prev => !prev)}
              style={{
                background: showNets ? 'rgba(129, 140, 248, 0.2)' : 'rgba(15, 23, 42, 0.8)',
                color: showNets ? '#818cf8' : '#94a3b8',
                border: showNets ? '1px solid #818cf8' : '1px solid #334155',
                borderRadius: '5px',
                padding: '0.25rem 0.55rem',
                fontSize: '0.72rem',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              🌐 Nets
            </button>

            <button
              onClick={() => setShowCurrentFlow(prev => !prev)}
              style={{
                background: showCurrentFlow ? 'rgba(251, 191, 36, 0.2)' : 'rgba(15, 23, 42, 0.8)',
                color: showCurrentFlow ? '#fbbf24' : '#94a3b8',
                border: showCurrentFlow ? '1px solid #fbbf24' : '1px solid #334155',
                borderRadius: '5px',
                padding: '0.25rem 0.55rem',
                fontSize: '0.72rem',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              ⚡ Flow
            </button>

            <button
              onClick={() => setShowDebug(prev => !prev)}
              style={{
                background: showDebug ? 'rgba(244, 63, 94, 0.2)' : 'rgba(15, 23, 42, 0.8)',
                color: showDebug ? '#f43f5e' : '#94a3b8',
                border: showDebug ? '1px solid #f43f5e' : '1px solid #334155',
                borderRadius: '5px',
                padding: '0.25rem 0.55rem',
                fontSize: '0.72rem',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              🛠 Debug
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
