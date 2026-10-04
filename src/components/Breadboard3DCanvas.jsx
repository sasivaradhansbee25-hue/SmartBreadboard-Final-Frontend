import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { holeTo3DPos } from '../utils/breadboard3DCoords';
import { useCircuit } from '../context/CircuitContext';
import { formatVoltage, formatCurrent, formatPower, formatResistance } from '../utils/electricalFormatter';
import {
  calculateCurrentFlowMetrics,
  calculateLEDElectricalAnimation,
  calculateComponentElectricalActivity,
  checkCircuitFaultState
} from '../utils/electricalAnimation';

export default function Breadboard3DCanvas({ circuit: propCircuit }) {
  const {
    setSelectedComponent,
    selectedComponent,
    measurements,
    simulation,
    simulationResult,
    solverStatus,
    solverError,
    activeCircuit,
    simulationStatus,
    currentTransientSample,
    currentTimeIndex
  } = useCircuit();
  const circuit = propCircuit || activeCircuit;
  const mountRef = useRef(null);
  const controlsRef = useRef(null);
  const cameraRef = useRef(null);

  const currentTransientSampleRef = useRef(currentTransientSample);
  useEffect(() => {
    currentTransientSampleRef.current = currentTransientSample;
  }, [currentTransientSample]);

  const [selectedComp, setSelectedComp] = useState(null);

  // Synchronize selection from CircuitContext (AR Overlay / Table / Inspector)
  useEffect(() => {
    if (selectedComponent) {
      setSelectedComp(selectedComponent);
    } else {
      setSelectedComp(null);
    }
  }, [selectedComponent]);

  // Electrical Visualization Controls State
  const [showCurrentFlow, setShowCurrentFlow] = useState(true);
  const [showNodeVoltages, setShowNodeVoltages] = useState(false);
  const [showElectricalValues, setShowElectricalValues] = useState(false);
  const [showPowerMode, setShowPowerMode] = useState(false);

  // References to dynamic Three.js visual groups (for 0ms toggle updates)
  const groupsRef = useRef({
    nodeVoltages: null,
    electricalValues: null,
    powerHalos: null,
    selectionHighlight: null
  });

  // Reactive toggles without 3D scene re-creation
  useEffect(() => {
    if (groupsRef.current.nodeVoltages) {
      groupsRef.current.nodeVoltages.visible = showNodeVoltages;
    }
  }, [showNodeVoltages]);

  useEffect(() => {
    if (groupsRef.current.electricalValues) {
      groupsRef.current.electricalValues.visible = showElectricalValues;
    }
  }, [showElectricalValues]);

  useEffect(() => {
    if (groupsRef.current.powerHalos) {
      groupsRef.current.powerHalos.visible = showPowerMode;
    }
  }, [showPowerMode]);

  useEffect(() => {
    const container = mountRef.current;

    if (!container) return;

    const width = container.clientWidth || 900;
    const height = 520;

    // =========================================================
    // SCENE
    // =========================================================

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x040711);

    const camera = new THREE.PerspectiveCamera(
      45,
      width / height,
      0.1,
      1000
    );

    camera.position.set(0, 25, 25);
    camera.lookAt(0, 0, 0);

    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true
    });

    renderer.setSize(width, height);
    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, 2)
    );

    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    container.appendChild(renderer.domElement);

    // =========================================================
    // ORBIT CONTROLS
    // =========================================================

    const controls = new OrbitControls(
      camera,
      renderer.domElement
    );

    controls.enableDamping = true;
    controls.dampingFactor = 0.06;

    controls.minDistance = 8;
    controls.maxDistance = 55;

    controls.maxPolarAngle = Math.PI / 2 - 0.03;

    controls.target.set(0, 0, 0);

    controlsRef.current = controls;

    // =========================================================
    // LIGHTING
    // =========================================================

    scene.add(
      new THREE.AmbientLight(
        0xffffff,
        0.9
      )
    );

    const keyLight =
      new THREE.DirectionalLight(
        0xffffff,
        1.4
      );

    keyLight.position.set(
      8,
      25,
      12
    );

    keyLight.castShadow = true;

    scene.add(keyLight);

    const fillLight =
      new THREE.DirectionalLight(
        0x88aaff,
        0.6
      );

    fillLight.position.set(
      -15,
      12,
      -10
    );

    scene.add(fillLight);

    // =========================================================
    // BREADBOARD
    // =========================================================

    const boardGroup =
      new THREE.Group();

    // Main body

    const boardGeometry =
      new THREE.BoxGeometry(
        26,
        1.2,
        10
      );

    const boardMaterial =
      new THREE.MeshStandardMaterial({
        color: 0xf1f5f9,
        roughness: 0.42,
        metalness: 0.05
      });

    const board =
      new THREE.Mesh(
        boardGeometry,
        boardMaterial
      );

    board.position.y = 0;

    board.receiveShadow = true;

    boardGroup.add(board);

    // =========================================================
    // CENTER CHANNEL
    // =========================================================

    const channelGeometry =
      new THREE.BoxGeometry(
        25.6,
        0.16,
        1.1
      );

    const channelMaterial =
      new THREE.MeshStandardMaterial({
        color: 0x334155,
        roughness: 0.8
      });

    const channel =
      new THREE.Mesh(
        channelGeometry,
        channelMaterial
      );

    channel.position.set(
      0,
      0.62,
      0
    );

    boardGroup.add(channel);

    // =========================================================
    // POWER RAILS
    // =========================================================

    const redMaterial =
      new THREE.MeshBasicMaterial({
        color: 0xef4444
      });

    const blueMaterial =
      new THREE.MeshBasicMaterial({
        color: 0x2563eb
      });

    const railGeometry =
      new THREE.BoxGeometry(
        25,
        0.05,
        0.12
      );

    const redTop =
      new THREE.Mesh(
        railGeometry,
        redMaterial
      );

    redTop.position.set(
      0,
      0.63,
      -4.2
    );

    const blueTop =
      new THREE.Mesh(
        railGeometry,
        blueMaterial
      );

    blueTop.position.set(
      0,
      0.63,
      -3.8
    );

    const redBottom =
      new THREE.Mesh(
        railGeometry,
        redMaterial
      );

    redBottom.position.set(
      0,
      0.63,
      4.2
    );

    const blueBottom =
      new THREE.Mesh(
        railGeometry,
        blueMaterial
      );

    blueBottom.position.set(
      0,
      0.63,
      3.8
    );

    boardGroup.add(
      redTop,
      blueTop,
      redBottom,
      blueBottom
    );

    // =========================================================
    // 830 HOLES
    // =========================================================

    const holeGeometry =
      new THREE.CylinderGeometry(
        0.075,
        0.075,
        0.08,
        12
      );

    const holeMaterial =
      new THREE.MeshStandardMaterial({
        color: 0x111827,
        roughness: 0.9
      });

    // Main 63 x 10 grid

    for (let col = 1; col <= 63; col++) {

      const x =
        -12.4 +
        (col - 1) * 0.4;

      for (
        let rowIndex = 0;
        rowIndex < 10;
        rowIndex++
      ) {

        const row =
          String.fromCharCode(
            65 + rowIndex
          );

        const zMap = {
          A: -2.8,
          B: -2.3,
          C: -1.8,
          D: -1.3,
          E: -0.8,
          F: 0.8,
          G: 1.3,
          H: 1.8,
          I: 2.3,
          J: 2.8
        };

        const hole =
          new THREE.Mesh(
            holeGeometry,
            holeMaterial
          );

        hole.position.set(
          x,
          0.63,
          zMap[row]
        );

        boardGroup.add(hole);
      }
    }

    // Power rail holes

    for (let col = 1; col <= 50; col++) {

      const x =
        -12.4 +
        (col - 1) * 0.48;

      const positions = [
        -4.2,
        -3.8,
        3.8,
        4.2
      ];

      positions.forEach((z) => {

        const hole =
          new THREE.Mesh(
            holeGeometry,
            holeMaterial
          );

        hole.position.set(
          x,
          0.63,
          z
        );

        boardGroup.add(hole);
      });
    }

    scene.add(boardGroup);

    // =========================================================
    // COMPONENT CLICKABLE OBJECTS & DIGITAL TWIN MATCHING
    // =========================================================

    const clickableObjects = [];

    // Helper to match normalized electrical simulation data to component
    function matchSimulationElectrical(comp, simRes, measMap) {
      if (!comp) return null;
      const cid = (comp.id || '').toUpperCase();
      const cdes = (comp.designator || '').toUpperCase();

      // Phase 24.4 / 25: Absolute priority to active transient timeline sample (via live ref)
      const activeSample = currentTransientSampleRef?.current || currentTransientSample;
      if (activeSample) {
        const tCurr = activeSample.componentCurrents?.[cdes] ?? activeSample.componentCurrents?.[cid] ?? activeSample.componentCurrents?.[comp.id] ?? activeSample.componentCurrents?.[comp.designator];
        const tVolt = activeSample.componentVoltages?.[cdes] ?? activeSample.componentVoltages?.[cid] ?? activeSample.componentVoltages?.[comp.id] ?? activeSample.componentVoltages?.[comp.designator];
        const tPow = activeSample.componentPower?.[cdes] ?? activeSample.componentPower?.[cid] ?? activeSample.componentPower?.[comp.id] ?? activeSample.componentPower?.[comp.designator];
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
            state: Math.abs(cCurr) > 1e-4 ? 'ACTIVE' : (Math.abs(cVolt) > 0.01 ? 'CHARGED' : 'STEADY')
          };
        }
      }

      // Phase 24.2 structured simulation results
      if (simRes?.results) {
        const resMeas = simRes.results.measurements?.[cdes] || simRes.results.measurements?.[cid] || simRes.results.measurements?.[comp.id] || simRes.results.measurements?.[comp.designator];
        const resCurr = simRes.results.branch_currents?.[cdes] ?? simRes.results.branch_currents?.[cid] ?? simRes.results.branch_currents?.[comp.id] ?? simRes.results.branch_currents?.[comp.designator];
        const resPow = simRes.results.component_power?.[cdes] ?? simRes.results.component_power?.[cid] ?? simRes.results.component_power?.[comp.id] ?? simRes.results.component_power?.[comp.designator];
        if (resMeas || resCurr !== undefined || resPow !== undefined) {
          return {
            voltage: resMeas?.voltage_drop ?? resMeas?.voltage,
            voltage_drop: resMeas?.voltage_drop,
            current: resCurr ?? resMeas?.current ?? 0,
            power: resPow ?? resMeas?.power ?? 0,
            direction: resMeas?.direction ?? (resCurr > 0 ? 'pin1_to_pin2' : 'unknown'),
            state: resMeas?.state ?? (Math.abs(resCurr || 0) > 1e-4 ? 'ACTIVE' : 'OFF'),
            forward_voltage: resMeas?.voltage_drop
          };
        }
      }

      // Phase 24.2 / 24.3 top-level component dictionaries (component_currents, component_voltages, component_power)
      if (simRes?.component_currents || simRes?.component_voltages) {
        const rawCurr = simRes.component_currents?.[cdes] ?? simRes.component_currents?.[cid] ?? simRes.component_currents?.[comp.id] ?? simRes.component_currents?.[comp.designator];
        const rawVolt = simRes.component_voltages?.[cdes] ?? simRes.component_voltages?.[cid] ?? simRes.component_voltages?.[comp.id] ?? simRes.component_voltages?.[comp.designator];
        const rawPow = simRes.component_power?.[cdes] ?? simRes.component_power?.[cid] ?? simRes.component_power?.[comp.id] ?? simRes.component_power?.[comp.designator];

        const tIdx = currentTimeIndex ?? 0;
        const cCurr = Array.isArray(rawCurr) ? rawCurr[tIdx] : rawCurr;
        const cVolt = Array.isArray(rawVolt) ? rawVolt[tIdx] : rawVolt;
        const cPow = Array.isArray(rawPow) ? rawPow[tIdx] : rawPow;

        if (cCurr !== undefined || cVolt !== undefined || cPow !== undefined) {
          return {
            voltage: cVolt !== undefined ? Math.abs(cVolt) : 0,
            voltage_drop: cVolt ?? 0,
            current: cCurr ?? 0,
            power: cPow ?? ((cVolt !== undefined && cCurr !== undefined) ? Math.abs(cVolt * cCurr) : 0),
            direction: (cCurr || 0) >= 0 ? 'pin1_to_pin2' : 'pin2_to_pin1',
            state: Math.abs(cCurr || 0) > 1e-4 ? 'ACTIVE' : (Math.abs(cVolt || 0) > 0.01 ? 'CHARGED' : 'STEADY')
          };
        }
      }

      // 1. Match from normalized simulationResult.components
      if (simRes?.components && Array.isArray(simRes.components)) {
        const item = simRes.components.find(c => {
          const sid = (c.id || '').toUpperCase();
          const sdes = (c.designator || '').toUpperCase();
          return (sid && (sid === cid || sid === cdes)) || (sdes && (sdes === cid || sdes === cdes));
        });
        if (item) {
          return {
            voltage: item.voltage,
            voltage_drop: item.voltage,
            current: item.current,
            power: item.power,
            direction: item.direction,
            state: item.state,
            forward_voltage: item.forward_voltage,
            charge: item.charge,
            voltage_difference: item.voltage_difference
          };
        }
      }

      // 2. Match from simulationResult.digital_twin.components
      if (simRes?.digital_twin?.components && Array.isArray(simRes.digital_twin.components)) {
        const item = simRes.digital_twin.components.find(c => {
          const sid = (c.id || '').toUpperCase();
          const sdes = (c.designator || '').toUpperCase();
          return (sid && (sid === cid || sid === cdes)) || (sdes && (sdes === cid || sdes === cdes));
        });
        if (item?.electrical) {
          return item.electrical;
        }
      }

      // 3. Fallback to measurements map
      const m = measMap?.[comp.designator] || measMap?.[comp.id] || measMap?.[cdes] || measMap?.[cid];
      if (m) {
        return {
          voltage: m.voltage !== undefined ? m.voltage : (m.voltageDrop !== undefined ? Math.abs(m.voltageDrop) : undefined),
          voltage_drop: m.voltageDrop !== undefined ? m.voltageDrop : m.voltage,
          current: m.current,
          power: m.power,
          direction: m.direction,
          state: m.state,
          forward_voltage: m.forward_voltage,
          charge: m.charge,
          voltage_difference: m.voltage_difference
        };
      }

      return null;
    }

    // Helper to resolve physical breadboard hole for a given electrical Net ID
    function findHoleForNode(nodeId, circuitObj) {
      if (!nodeId) return null;
      // 1. Check circuit.nets
      if (circuitObj?.nets && Array.isArray(circuitObj.nets)) {
        const net = circuitObj.nets.find(n => (n.net_id === nodeId || n.id === nodeId || n.name === nodeId));
        if (net && net.holes && net.holes.length > 0) {
          return net.holes[0];
        }
      }
      // 2. Check components connected to this node
      if (circuitObj?.components && Array.isArray(circuitObj.components)) {
        for (const c of circuitObj.components) {
          if (c.node1 === nodeId && (c.start_hole || c.hole1)) return c.start_hole || c.hole1;
          if (c.node2 === nodeId && (c.end_hole || c.hole2)) return c.end_hole || c.hole2;
          if (Array.isArray(c.terminals)) {
            const t = c.terminals.find(term => term.node === nodeId && term.hole);
            if (t) return t.hole;
          }
        }
      }
      // 2b. Check connections (Phase 24.1 / 24.2)
      if (circuitObj?.connections && Array.isArray(circuitObj.connections)) {
        const conn = circuitObj.connections.find(c => c.node_id === nodeId && c.hole);
        if (conn) return conn.hole;
      }
      // 3. Check wires
      if (circuitObj?.wires && Array.isArray(circuitObj.wires)) {
        for (const w of circuitObj.wires) {
          if ((w.net === nodeId || w.node1 === nodeId) && (w.start_hole || w.hole1)) return w.start_hole || w.hole1;
        }
      }
      // 4. If nodeId contains hole like 'NODE_HOLE_10A'
      if (nodeId.includes('NODE_HOLE_')) {
        return nodeId.replace('NODE_HOLE_', '');
      }
      if (/^[A-J]\d+$/i.test(nodeId) || /^\d+[A-J]$/i.test(nodeId)) {
        return nodeId;
      }
      return null;
    }

    // Helper to construct 3D Billboard Canvas Text Sprites
    function createTextCanvasSprite(lines, options = {}) {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = options.width || 256;
      canvas.height = options.height || 128;

      const bg = options.bg || 'rgba(8, 12, 24, 0.94)';
      const border = options.border || 'rgba(56, 189, 248, 0.75)';
      const radius = 10;

      ctx.fillStyle = bg;
      ctx.strokeStyle = border;
      ctx.lineWidth = 4;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(4, 4, canvas.width - 8, canvas.height - 8, radius);
      } else {
        ctx.rect(4, 4, canvas.width - 8, canvas.height - 8);
      }
      ctx.fill();
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const lineHeight = 28;
      const startY = (canvas.height / 2) - (((lines.length - 1) * lineHeight) / 2);
      lines.forEach((line, idx) => {
        ctx.font = line.font || 'bold 18px Inter, sans-serif';
        ctx.fillStyle = line.color || '#f8fafc';
        ctx.fillText(line.text, canvas.width / 2, startY + (idx * lineHeight));
      });

      const texture = new THREE.CanvasTexture(canvas);
      texture.minFilter = THREE.LinearFilter;
      const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.scale.set(options.scaleX || 2.8, options.scaleY || 1.4, 1);
      return sprite;
    }

    // Helper to package physical + electrical digital-twin model onto mesh userData
    function buildDigitalTwinUserData(component, compType, hole1, hole2) {
      const elec = matchSimulationElectrical(component, simulationResult, measurements);
      const des = component.designator || component.id || 'Component';
      const curStatus = simulationResult?.solver_status || solverStatus || 'IDLE';

      const n1 = component.node1 || component.net1 || (hole1 ? `NODE_${hole1}` : 'N/A');
      const n2 = component.node2 || component.net2 || (hole2 ? `NODE_${hole2}` : 'N/A');
      const nodeVoltages = simulationResult?.node_voltages || {};

      return {
        id: component.id || des,
        designator: des,
        name: des,
        type: compType,
        value: component.user_override_value || component.detected_value || component.value || 'Unknown',
        start_hole: hole1,
        end_hole: hole2,
        hole1: hole1,
        hole2: hole2,
        node1: n1,
        node2: n2,
        node1_voltage: nodeVoltages[n1] !== undefined ? nodeVoltages[n1] : null,
        node2_voltage: nodeVoltages[n2] !== undefined ? nodeVoltages[n2] : null,
        mapping_confidence: component.mapping_confidence ?? component.confidence ?? 0.9,
        tracking_state: component.tracking_state || 'TRACKED',
        tracking_confidence: component.tracking_confidence ?? component.confidence ?? 0.9,
        last_seen: component.last_seen_frame ?? component.last_seen ?? null,
        electrical: elec,
        solver_status: curStatus,
        source: simulationResult?.source || circuit?.source || 'real'
      };
    }

    // =========================================================
    // MATERIAL HELPERS
    // =========================================================

    const metalMaterial =
      new THREE.MeshStandardMaterial({
        color: 0xb8c2cc,
        metalness: 0.85,
        roughness: 0.25
      });

    // =========================================================
    // RESISTOR
    // =========================================================

    function createResistor(
      component,
      p1,
      p2,
      hole1,
      hole2
    ) {

      const group =
        new THREE.Group();

      const body =
        new THREE.Mesh(
          new THREE.CylinderGeometry(
            0.42,
            0.42,
            1.8,
            24
          ),
          new THREE.MeshStandardMaterial({
            color: 0xd6a06d,
            roughness: 0.45
          })
        );

      body.rotation.z =
        Math.PI / 2;

      body.castShadow = true;

      group.add(body);

      // Color bands

      const bandColors = [
        0x78350f,
        0x000000,
        0xdc2626,
        0xeab308
      ];

      [-0.6, -0.2, 0.2, 0.6]
        .forEach((pos, index) => {

          const band =
            new THREE.Mesh(
              new THREE.CylinderGeometry(
                0.44,
                0.44,
                0.14,
                24
              ),
              new THREE.MeshBasicMaterial({
                color:
                  bandColors[index]
              })
            );

          band.rotation.z =
            Math.PI / 2;

          band.position.x = pos;

          group.add(band);
        });

      // Leads

      const leadLength = 1.0;

      const lead1 =
        new THREE.Mesh(
          new THREE.CylinderGeometry(
            0.055,
            0.055,
            leadLength,
            10
          ),
          metalMaterial
        );

      const lead2 =
        lead1.clone();

      lead1.position.x = -1.35;
      lead2.position.x = 1.35;

      group.add(
        lead1,
        lead2
      );

      positionComponent(
        group,
        p1,
        p2
      );

      body.userData = buildDigitalTwinUserData(component, 'resistor', hole1, hole2);

      clickableObjects.push(body);
      animatedComponents.push({
        comp: component,
        compId: component.id || component.designator,
        compType: 'resistor',
        mesh: body,
        material: body.material,
        currentEmissive: 0.0
      });

      scene.add(group);
    }

    // =========================================================
    // LED
    // =========================================================

    function createLED(
      component,
      p1,
      p2,
      hole1,
      hole2
    ) {

      const group =
        new THREE.Group();

      const color =
        getLEDColor(
          component
        );

      const elec = matchSimulationElectrical(component, simulationResult, measurements);
      const isSolved = (simulationStatus === 'SOLVED' || simulationResult?.status === 'SOLVED' || simulationResult?.solver_status === 'SOLVED' || solverStatus === 'SOLVED');

      // LED 3D Visual State (ON: intense glow, OFF: unlit, REVERSE: warning amber, UNKNOWN: neutral)
      let glowIntensity = 0.6;
      let emissiveColor = color;
      let emissiveIntensity = 0.15;

      if (isSolved && elec) {
        const state = (elec.state || '').toUpperCase();
        if (state === 'ON') {
          glowIntensity = 2.8;
          emissiveIntensity = 0.65;
        } else if (state === 'OFF') {
          glowIntensity = 0.0;
          emissiveColor = 0x000000;
          emissiveIntensity = 0.0;
        } else if (state === 'REVERSE') {
          glowIntensity = 0.25;
          emissiveColor = 0xf59e0b;
          emissiveIntensity = 0.35;
        }
      }

      const bodyMaterial = new THREE.MeshPhysicalMaterial({
        color,
        emissive: emissiveColor,
        emissiveIntensity: emissiveIntensity,
        transparent: true,
        opacity: 0.88,
        roughness: 0.12,
        transmission: 0.25
      });

      const body =
        new THREE.Mesh(
          new THREE.CylinderGeometry(
            0.45,
            0.38,
            0.65,
            24
          ),
          bodyMaterial
        );

      body.position.y = 0.4;

      group.add(body);

      const dome =
        new THREE.Mesh(
          new THREE.SphereGeometry(
            0.45,
            24,
            16,
            0,
            Math.PI * 2,
            0,
            Math.PI / 2
          ),
          bodyMaterial
        );

      dome.position.y = 0.72;

      group.add(dome);

      // LED glow
      const glow =
        new THREE.PointLight(
          emissiveColor,
          glowIntensity,
          4
        );

      glow.position.y = 0.6;

      group.add(glow);

      // Leads

      const lead1 =
        new THREE.Mesh(
          new THREE.CylinderGeometry(
            0.05,
            0.05,
            1.2,
            10
          ),
          metalMaterial
        );

      const lead2 =
        lead1.clone();

      lead1.position.x = -0.16;
      lead2.position.x = 0.16;

      lead1.position.y = -0.45;
      lead2.position.y = -0.45;

      group.add(
        lead1,
        lead2
      );

      positionComponent(
        group,
        p1,
        p2
      );

      body.userData = buildDigitalTwinUserData(component, 'led', hole1, hole2);

      clickableObjects.push(body);
      animatedLeds.push({
        comp: component,
        compId: component.id || component.designator,
        bodyMaterial,
        domeMaterial: dome.material,
        glowLight: glow,
        baseColor: color,
        currentGlow: glowIntensity,
        currentEmissive: emissiveIntensity
      });

      scene.add(group);
    }

    // =========================================================
    // CAPACITOR
    // =========================================================

    function createCapacitor(
      component,
      p1,
      p2,
      hole1,
      hole2
    ) {

      const group =
        new THREE.Group();

      const body =
        new THREE.Mesh(
          new THREE.CylinderGeometry(
            0.48,
            0.48,
            1.15,
            24
          ),
          new THREE.MeshStandardMaterial({
            color: 0x1e3a8a,
            roughness: 0.35
          })
        );

      body.position.y = 0.7;

      group.add(body);

      // Stripe

      const stripe =
        new THREE.Mesh(
          new THREE.BoxGeometry(
            0.08,
            1.0,
            0.98
          ),
          new THREE.MeshBasicMaterial({
            color: 0xe5e7eb
          })
        );

      stripe.position.set(
        -0.28,
        0.7,
        0
      );

      group.add(stripe);

      // Leads

      const lead1 =
        new THREE.Mesh(
          new THREE.CylinderGeometry(
            0.055,
            0.055,
            1.1,
            10
          ),
          metalMaterial
        );

      const lead2 =
        lead1.clone();

      lead1.position.x = -0.18;
      lead2.position.x = 0.18;

      lead1.position.y = -0.35;
      lead2.position.y = -0.35;

      group.add(
        lead1,
        lead2
      );

      positionComponent(
        group,
        p1,
        p2
      );

      body.userData = buildDigitalTwinUserData(component, 'capacitor', hole1, hole2);

      clickableObjects.push(body);
      animatedComponents.push({
        comp: component,
        compId: component.id || component.designator,
        compType: 'capacitor',
        mesh: body,
        material: body.material,
        currentEmissive: 0.0
      });

      scene.add(group);
    }

    // =========================================================
    // INDUCTOR
    // =========================================================

    function createInductor(
      component,
      p1,
      p2,
      hole1,
      hole2
    ) {
      const group = new THREE.Group();

      const core = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.35, 1.2, 16),
        new THREE.MeshStandardMaterial({
          color: 0x334155,
          roughness: 0.5
        })
      );
      core.rotation.z = Math.PI / 2;
      group.add(core);

      const coilCurve = new THREE.CatmullRomCurve3(
        Array.from({ length: 24 }).map((_, i) => {
          const angle = i * Math.PI * 0.8;
          const x = -0.55 + i * 0.045;
          return new THREE.Vector3(x, Math.sin(angle) * 0.42, Math.cos(angle) * 0.42);
        })
      );

      const coilMesh = new THREE.Mesh(
        new THREE.TubeGeometry(coilCurve, 32, 0.06, 8, false),
        new THREE.MeshStandardMaterial({
          color: 0xb45309,
          metalness: 0.8,
          roughness: 0.3
        })
      );
      group.add(coilMesh);

      const lead1 = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, 1.0, 8),
        metalMaterial
      );
      const lead2 = lead1.clone();
      lead1.position.x = -0.7;
      lead2.position.x = 0.7;

      group.add(lead1, lead2);

      positionComponent(group, p1, p2);

      core.userData = buildDigitalTwinUserData(component, 'inductor', hole1, hole2);

      clickableObjects.push(core);
      animatedComponents.push({
        comp: component,
        compId: component.id || component.designator,
        compType: 'inductor',
        mesh: core,
        material: core.material,
        currentEmissive: 0.0
      });
      scene.add(group);
    }

    // =========================================================
    // DIODE
    // =========================================================

    function createDiode(
      component,
      p1,
      p2,
      hole1,
      hole2
    ) {

      const group =
        new THREE.Group();

      const body =
        new THREE.Mesh(
          new THREE.CylinderGeometry(
            0.22,
            0.22,
            1.45,
            20
          ),
          new THREE.MeshStandardMaterial({
            color: 0x111827,
            roughness: 0.3
          })
        );

      body.rotation.z =
        Math.PI / 2;

      group.add(body);

      // Cathode band

      const band =
        new THREE.Mesh(
          new THREE.CylinderGeometry(
            0.24,
            0.24,
            0.16,
            20
          ),
          new THREE.MeshBasicMaterial({
            color: 0xf8fafc
          })
        );

      band.rotation.z =
        Math.PI / 2;

      band.position.x = 0.45;

      group.add(band);

      const lead1 =
        new THREE.Mesh(
          new THREE.CylinderGeometry(
            0.045,
            0.045,
            0.9,
            8
          ),
          metalMaterial
        );

      const lead2 =
        lead1.clone();

      lead1.position.x = -1.05;
      lead2.position.x = 1.05;

      group.add(
        lead1,
        lead2
      );

      positionComponent(
        group,
        p1,
        p2
      );

      body.userData = buildDigitalTwinUserData(component, 'diode_rectifier', hole1, hole2);

      clickableObjects.push(body);
      animatedComponents.push({
        comp: component,
        compId: component.id || component.designator,
        compType: 'diode',
        mesh: body,
        material: body.material,
        currentEmissive: 0.0
      });

      scene.add(group);
    }

    // =========================================================
    // IC CHIP
    // =========================================================

    function createIC(
      component,
      p1,
      p2,
      hole1,
      hole2
    ) {

      const group =
        new THREE.Group();

      const body =
        new THREE.Mesh(
          new THREE.BoxGeometry(
            1.7,
            0.45,
            1.1
          ),
          new THREE.MeshStandardMaterial({
            color: 0x111827,
            roughness: 0.3
          })
        );

      body.position.y = 0.75;

      group.add(body);

      // IC notch

      const notch =
        new THREE.Mesh(
          new THREE.TorusGeometry(
            0.16,
            0.05,
            8,
            16,
            Math.PI
          ),
          new THREE.MeshBasicMaterial({
            color: 0x64748b
          })
        );

      notch.rotation.x =
        Math.PI / 2;

      notch.position.set(
        0,
        0.99,
        -0.55
      );

      group.add(notch);

      // Pins

      for (
        let i = 0;
        i < 4;
        i++
      ) {

        const pin1 =
          new THREE.Mesh(
            new THREE.BoxGeometry(
              0.08,
              0.5,
              0.08
            ),
            metalMaterial
          );

        const pin2 =
          pin1.clone();

        pin1.position.set(
          -0.55 + i * 0.36,
          0.25,
          -0.72
        );

        pin2.position.set(
          -0.55 + i * 0.36,
          0.25,
          0.72
        );

        group.add(
          pin1,
          pin2
        );
      }

      positionComponent(
        group,
        p1,
        p2
      );

      body.userData = buildDigitalTwinUserData(component, 'ic_chip', hole1, hole2);

      clickableObjects.push(body);

      scene.add(group);
    }

    // =========================================================
    // JUMPER WIRE
    // =========================================================

    function createWire(
      component,
      p1,
      p2,
      hole1,
      hole2
    ) {

      const start =
        new THREE.Vector3(
          p1.x,
          0.72,
          p1.z
        );

      const end =
        new THREE.Vector3(
          p2.x,
          0.72,
          p2.z
        );

      const midpoint =
        new THREE.Vector3(
          (start.x + end.x) / 2,
          2.0,
          (start.z + end.z) / 2
        );

      const curve =
        new THREE.QuadraticBezierCurve3(
          start,
          midpoint,
          end
        );

      const geometry =
        new THREE.TubeGeometry(
          curve,
          24,
          0.09,
          8,
          false
        );

      const material =
        new THREE.MeshStandardMaterial({
          color:
            getWireColor(component),
          roughness: 0.35
        });

      const mesh =
        new THREE.Mesh(
          geometry,
          material
        );

      mesh.castShadow = true;

      mesh.userData = buildDigitalTwinUserData(component, 'wire', hole1, hole2);

      clickableObjects.push(mesh);

      scene.add(mesh);
      return curve;
    }

    // =========================================================
    // POSITION COMPONENT
    // =========================================================

    function positionComponent(
      group,
      p1,
      p2
    ) {

      const midpoint =
        new THREE.Vector3(
          (p1.x + p2.x) / 2,
          1.2,
          (p1.z + p2.z) / 2
        );

      group.position.copy(
        midpoint
      );

      const dx =
        p2.x - p1.x;

      const dz =
        p2.z - p1.z;

      group.rotation.y =
        Math.atan2(dz, dx);
    }

    // =========================================================
    // COLOR HELPERS
    // =========================================================

    function getLEDColor(component) {

      const text =
        JSON.stringify(component)
          .toLowerCase();

      if (text.includes('green')) {
        return 0x22c55e;
      }

      if (text.includes('blue')) {
        return 0x3b82f6;
      }

      if (text.includes('yellow')) {
        return 0xfacc15;
      }

      return 0xef4444;
    }

    function getWireColor(component) {

      const text =
        JSON.stringify(component)
          .toLowerCase();

      if (text.includes('black')) {
        return 0x111827;
      }

      if (text.includes('blue')) {
        return 0x2563eb;
      }

      if (text.includes('green')) {
        return 0x16a34a;
      }

      if (text.includes('yellow')) {
        return 0xfacc15;
      }

      return 0xef4444;
    }

    // =========================================================
    // COMPONENT DATA NORMALIZATION
    // =========================================================

    function getHolePair(component) {
      if (!component) return { hole1: null, hole2: null };

      // 1. Array of terminals: [{ pin: 1, hole: "A15" }, { pin: 2, hole: "A20" }]
      const termArr = Array.isArray(component.terminals) ? component.terminals : null;
      // 2. Object of terminals: { terminal_a: { hole: "A15" }, terminal_b: { hole: "A20" } }
      const termObj = (!termArr && typeof component.terminals === 'object' && component.terminals !== null) ? component.terminals : null;

      const hole1 =
        component.hole1 ||
        component.node1_hole ||
        component.lead1_hole ||
        component.start_hole ||
        component.from_hole ||
        component.node1?.hole ||
        component.hole_mapping?.terminal_a ||
        component.hole_mapping?.hole1 ||
        component.hole_mapping?.start ||
        (termArr && (termArr[0]?.hole || termArr[0]?.hole_id)) ||
        (termObj && (termObj.terminal_a?.hole || termObj.start?.hole || termObj.anode?.hole || termObj.pin1?.hole)) ||
        (Array.isArray(component.pins) && component.pins[0]?.hole) ||
        (Array.isArray(component.leads) && component.leads[0]?.hole);

      const hole2 =
        component.hole2 ||
        component.node2_hole ||
        component.lead2_hole ||
        component.end_hole ||
        component.to_hole ||
        component.node2?.hole ||
        component.hole_mapping?.terminal_b ||
        component.hole_mapping?.hole2 ||
        component.hole_mapping?.end ||
        (termArr && (termArr[1]?.hole || termArr[1]?.hole_id)) ||
        (termObj && (termObj.terminal_b?.hole || termObj.end?.hole || termObj.cathode?.hole || termObj.pin2?.hole)) ||
        (Array.isArray(component.pins) && component.pins[1]?.hole) ||
        (Array.isArray(component.leads) && component.leads[1]?.hole);

      return {
        hole1: typeof hole1 === 'string' ? hole1.trim().toUpperCase() : null,
        hole2: typeof hole2 === 'string' ? hole2.trim().toUpperCase() : null
      };
    }

    // =========================================================
    // RENDER ACTUAL CIRCUIT COMPONENTS & PARTICLE GROUPS
    // =========================================================

    const components =
      Array.isArray(circuit?.components)
        ? circuit.components
        : [];

    const particleGroups = [];
    const animatedLeds = [];
    const animatedComponents = [];

    components.forEach(
      (component, index) => {

        const {
          hole1,
          hole2
        } =
          getHolePair(component);

        if (!hole1 || !hole2) {
          // If component is explicitly marked UNVERIFIED / UNRESOLVED / UNKNOWN, skip 3D creation cleanly
          const status = String(component.status || '').toUpperCase();
          if (status === 'UNVERIFIED' || status === 'UNRESOLVED' || status === 'UNKNOWN' || status === 'BLOCKED') {
            return;
          }

          console.warn(
            `[3D] Component ${component.id || component.designator || index} has no hole mapping (marked UNVERIFIED)`,
            component
          );

          return;
        }

        const p1 =
          holeTo3DPos(hole1);

        const p2 =
          holeTo3DPos(hole2);

        const type =
          String(
            component.type ||
            component.class ||
            component.name ||
            ''
          )
            .toLowerCase();

        let wireCurve = null;

        if (
          type.includes('resistor')
        ) {

          createResistor(
            component,
            p1,
            p2,
            hole1,
            hole2
          );

        } else if (
          type.includes('led')
        ) {

          createLED(
            component,
            p1,
            p2,
            hole1,
            hole2
          );

        } else if (
          type.includes('capacitor')
        ) {

          createCapacitor(
            component,
            p1,
            p2,
            hole1,
            hole2
          );

        } else if (
          type.includes('diode')
        ) {

          createDiode(
            component,
            p1,
            p2,
            hole1,
            hole2
          );

        } else if (
          type.includes('inductor')
        ) {

          createInductor(
            component,
            p1,
            p2,
            hole1,
            hole2
          );

        } else if (
          type.includes('ic')
        ) {

          createIC(
            component,
            p1,
            p2,
            hole1,
            hole2
          );

        } else if (
          type.includes('wire') ||
          type.includes('jumper')
        ) {

          wireCurve = createWire(
            component,
            p1,
            p2,
            hole1,
            hole2
          );

        } else {

          console.warn(
            '[3D] Unknown component type:',
            component.type
          );
        }

        // Create current flow animation particles for component
        const compId = component.id || component.designator || `comp-${index}`;
        const compParticles = [];
        const particleGeo = new THREE.SphereGeometry(0.08, 8, 8);
        const particleMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
        
        for (let i = 0; i < 5; i++) {
          const pMesh = new THREE.Mesh(particleGeo, particleMat);
          pMesh.visible = false;
          const initialProgress = i / 5.0;
          if (wireCurve) {
            pMesh.position.copy(wireCurve.getPoint(initialProgress));
          } else {
            pMesh.position.lerpVectors(p1, p2, initialProgress);
          }
          scene.add(pMesh);
          compParticles.push({ mesh: pMesh, progress: initialProgress });
        }

        particleGroups.push({
          compId: compId,
          component: component,
          p1: p1,
          p2: p2,
          curve: wireCurve,
          currentSpeed: 0.0,
          particles: compParticles
        });
      }
    );

    // Also render any dedicated wires in circuit.wires
    const rawWires = Array.isArray(circuit?.wires) ? circuit.wires : [];
    rawWires.forEach((wire, wireIdx) => {
      const hole1 = wire.start_hole || wire.hole1;
      const hole2 = wire.end_hole || wire.hole2;
      if (!hole1 || !hole2) return;
      const p1 = holeTo3DPos(hole1);
      const p2 = holeTo3DPos(hole2);
      const wireComp = {
        id: wire.id || `W${wireIdx + 1}`,
        designator: wire.designator || wire.id || `W${wireIdx + 1}`,
        type: 'wire',
        start_hole: hole1,
        end_hole: hole2,
        net: wire.net || wire.net_id || wire.node1,
        node1: wire.node1 || wire.net,
        node2: wire.node2 || wire.net
      };
      const wireCurve = createWire(wireComp, p1, p2, hole1, hole2);

      const wireParticles = [];
      const particleGeo = new THREE.SphereGeometry(0.08, 8, 8);
      const particleMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
      for (let i = 0; i < 5; i++) {
        const pMesh = new THREE.Mesh(particleGeo, particleMat);
        pMesh.visible = false;
        const initialProgress = i / 5.0;
        if (wireCurve) {
          pMesh.position.copy(wireCurve.getPoint(initialProgress));
        } else {
          pMesh.position.lerpVectors(p1, p2, initialProgress);
        }
        scene.add(pMesh);
        wireParticles.push({ mesh: pMesh, progress: initialProgress });
      }

      particleGroups.push({
        compId: wireComp.designator || wireComp.id,
        component: wireComp,
        p1: p1,
        p2: p2,
        curve: wireCurve,
        currentSpeed: 0.0,
        particles: wireParticles
      });
    });

    // =========================================================
    // 3D ELECTRICAL VISUALIZATION OVERLAYS
    // =========================================================

    const isSolved = (simulationStatus === 'SOLVED' || simulationResult?.status === 'SOLVED' || solverStatus === 'SOLVED' || simulationResult?.solver_status === 'SOLVED');

    // 1. 3D Node Voltages Group
    const nodeVoltagesGroup = new THREE.Group();
    const nodeVoltages = simulationResult?.results?.node_voltages || simulationResult?.node_voltages || {};
    const renderedHoles = new Set();

    Object.entries(nodeVoltages).forEach(([nodeId, voltage]) => {
      const hole = findHoleForNode(nodeId, circuit);
      if (hole && !renderedHoles.has(hole)) {
        renderedHoles.add(hole);
        const pos = holeTo3DPos(hole);

        // Marker Stem
        const stemGeo = new THREE.CylinderGeometry(0.035, 0.035, 1.0, 8);
        const stemMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
        const stem = new THREE.Mesh(stemGeo, stemMat);
        stem.position.set(pos.x, 1.15, pos.z);
        nodeVoltagesGroup.add(stem);

        // Marker Head Sphere
        const markerHeadGeo = new THREE.SphereGeometry(0.1, 8, 8);
        const markerHeadMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
        const markerHead = new THREE.Mesh(markerHeadGeo, markerHeadMat);
        markerHead.position.set(pos.x, 1.68, pos.z);
        nodeVoltagesGroup.add(markerHead);

        // Billboard Text Sprite
        const sprite = createTextCanvasSprite([
          { text: nodeId, font: 'bold 16px Inter, sans-serif', color: '#38bdf8' },
          { text: `${voltage !== null && voltage !== undefined ? Number(voltage).toFixed(2) : '0.00'} V`, font: 'bold 20px Inter, sans-serif', color: '#10b981' }
        ], { width: 180, height: 90, scaleX: 2.2, scaleY: 1.1, bg: 'rgba(8, 14, 28, 0.92)', border: 'rgba(56, 189, 248, 0.8)' });

        sprite.position.set(pos.x, 2.35, pos.z);
        nodeVoltagesGroup.add(sprite);
      }
    });
    nodeVoltagesGroup.visible = showNodeVoltages;
    groupsRef.current.nodeVoltages = nodeVoltagesGroup;
    scene.add(nodeVoltagesGroup);

    // 2. 3D Electrical Values Badges Group
    const electricalValuesGroup = new THREE.Group();
    const allDigitalComponents = [...components, ...rawWires.map((w, idx) => ({
      id: w.id || `W${idx + 1}`,
      designator: w.designator || w.id || `W${idx + 1}`,
      type: 'wire',
      hole1: w.start_hole || w.hole1,
      hole2: w.end_hole || w.hole2,
      start_hole: w.start_hole || w.hole1,
      end_hole: w.end_hole || w.hole2,
      node1: w.node1 || w.net,
      node2: w.node2 || w.net
    }))];

    allDigitalComponents.forEach(comp => {
      const { hole1, hole2 } = getHolePair(comp);
      if (!hole1 || !hole2) return;
      const p1 = holeTo3DPos(hole1);
      const p2 = holeTo3DPos(hole2);
      const midX = (p1.x + p2.x) / 2;
      const midZ = (p1.z + p2.z) / 2;
      const des = comp.designator || comp.id || 'Component';
      const elec = matchSimulationElectrical(comp, simulationResult, measurements);

      let lines = [];
      if (isSolved && elec) {
        const vStr = formatVoltage(elec.voltage ?? elec.forward_voltage);
        const iStr = formatCurrent(elec.current);
        const pStr = formatPower(elec.power);
        lines.push({ text: des, font: 'bold 16px Inter, sans-serif', color: '#38bdf8' });
        lines.push({ text: `${vStr} | ${iStr}`, font: '14px Inter, sans-serif', color: '#e2e8f0' });
        if (elec.power !== undefined) {
          lines.push({ text: pStr, font: '13px Inter, sans-serif', color: '#f43f5e' });
        }
      } else {
        lines.push({ text: des, font: 'bold 16px Inter, sans-serif', color: '#94a3b8' });
        lines.push({ text: isSolved ? 'No data' : 'NOT RUN', font: '13px Inter, sans-serif', color: '#f59e0b' });
      }

      const sprite = createTextCanvasSprite(lines, {
        width: 220,
        height: 100,
        scaleX: 2.2,
        scaleY: 1.0,
        bg: 'rgba(10, 16, 30, 0.92)',
        border: isSolved ? 'rgba(56, 189, 248, 0.7)' : 'rgba(245, 158, 11, 0.6)'
      });
      sprite.position.set(midX, 2.4, midZ);
      electricalValuesGroup.add(sprite);
    });
    electricalValuesGroup.visible = showElectricalValues;
    groupsRef.current.electricalValues = electricalValuesGroup;
    scene.add(electricalValuesGroup);

    // 3. 3D Power Mode Dissipation Halos Group
    const powerHalosGroup = new THREE.Group();
    components.forEach(component => {
      const { hole1, hole2 } = getHolePair(component);
      if (!hole1 || !hole2) return;
      const p1 = holeTo3DPos(hole1);
      const p2 = holeTo3DPos(hole2);
      const midX = (p1.x + p2.x) / 2;
      const midZ = (p1.z + p2.z) / 2;
      const elec = matchSimulationElectrical(component, simulationResult, measurements);
      const powerW = elec?.power ?? ((elec?.voltage !== undefined && elec?.current !== undefined) ? Math.abs(elec.voltage * elec.current) : 0);

      if (isSolved && powerW > 1e-6) {
        const radius = Math.min(Math.max(0.45 + (powerW / 0.05) * 0.45, 0.55), 2.2);
        const ringGeo = new THREE.RingGeometry(0.1, radius, 32);
        const ringMat = new THREE.MeshBasicMaterial({
          color: powerW > 0.02 ? 0xf43f5e : (powerW > 0.005 ? 0xf59e0b : 0x10b981),
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.6,
          depthWrite: false
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(midX, 0.65, midZ);
        powerHalosGroup.add(ring);
      }
    });
    powerHalosGroup.visible = showPowerMode;
    groupsRef.current.powerHalos = powerHalosGroup;
    scene.add(powerHalosGroup);

    // 4. Selection Highlight Indicator
    const selectionHighlightGroup = new THREE.Group();
    const selRingGeo = new THREE.RingGeometry(0.75, 0.9, 32);
    const selRingMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85
    });
    const selRing = new THREE.Mesh(selRingGeo, selRingMat);
    selRing.rotation.x = -Math.PI / 2;
    selRing.position.y = 0.66;
    selectionHighlightGroup.add(selRing);
    selectionHighlightGroup.visible = false;
    groupsRef.current.selectionHighlight = selectionHighlightGroup;
    scene.add(selectionHighlightGroup);

    // 5. 3D Fault Warning Beacon Group
    const faultBeaconGroup = new THREE.Group();
    const faultRingGeo = new THREE.RingGeometry(0.85, 1.15, 32);
    const faultRingMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85
    });
    const faultRing = new THREE.Mesh(faultRingGeo, faultRingMat);
    faultRing.rotation.x = -Math.PI / 2;
    faultRing.position.y = 0.67;
    faultBeaconGroup.add(faultRing);

    const faultSprite = createTextCanvasSprite([
      { text: '⚠️ CIRCUIT FAULT', font: 'bold 16px Inter, sans-serif', color: '#ef4444' },
      { text: 'Simulation / Validation Error', font: '13px Inter, sans-serif', color: '#fca5a5' }
    ], {
      width: 230,
      height: 90,
      scaleX: 2.3,
      scaleY: 1.0,
      bg: 'rgba(30, 8, 12, 0.95)',
      border: 'rgba(239, 68, 68, 0.9)'
    });
    faultSprite.position.set(0, 2.7, 0);
    faultBeaconGroup.add(faultSprite);
    faultBeaconGroup.visible = false;
    scene.add(faultBeaconGroup);

    // =========================================================
    // RAYCASTING
    // =========================================================

    const raycaster =
      new THREE.Raycaster();

    const mouse =
      new THREE.Vector2();

    const handlePointerDown =
      (event) => {

        const rect =
          renderer.domElement
            .getBoundingClientRect();

        mouse.x =
          ((event.clientX - rect.left) /
            rect.width) *
          2 -
          1;

        mouse.y =
          -(
            (event.clientY - rect.top) /
            rect.height
          ) *
          2 +
          1;

        raycaster.setFromCamera(
          mouse,
          camera
        );

        const intersects =
          raycaster.intersectObjects(
            clickableObjects,
            true
          );

        if (
          intersects.length > 0
        ) {
          const hitMesh = intersects[0].object;
          const hitData = hitMesh.userData;
          setSelectedComp(hitData);
          if (setSelectedComponent) {
            setSelectedComponent(hitData);
          }
          if (groupsRef.current.selectionHighlight) {
            const worldPos = new THREE.Vector3();
            hitMesh.getWorldPosition(worldPos);
            groupsRef.current.selectionHighlight.position.set(worldPos.x, 0.0, worldPos.z);
            groupsRef.current.selectionHighlight.visible = true;
          }
        }
      };

    renderer.domElement.addEventListener(
      'pointerdown',
      handlePointerDown
    );

    // =========================================================
    // ANIMATION
    // =========================================================

    let animationFrameId;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const time = performance.now() * 0.001;
      const faultState = checkCircuitFaultState(circuit, simulationResult, solverStatus, solverError);
      const isSolved = (simulationStatus === 'SOLVED' || simulationResult?.status === 'SOLVED' || solverStatus === 'SOLVED' || simulationResult?.solver_status === 'SOLVED') && !faultState.isFault;

      // 1. Animate current flow particles along electrical paths (wires and components)
      if (particleGroups && particleGroups.length > 0) {
        particleGroups.forEach(group => {
          const comp = group.component;
          const elec = matchSimulationElectrical(comp, simulationResult, measurements);
          const m = measurements?.[group.compId] || {};
          const current = (elec && elec.current !== undefined) ? elec.current : (m.current || 0);

          if (showCurrentFlow && isSolved && Math.abs(current) > 1e-6) {
            const metrics = calculateCurrentFlowMetrics(current, elec?.direction);
            if (metrics.active) {
              // Smooth speed transition
              group.currentSpeed += (metrics.speed - group.currentSpeed) * 0.08;
              const step = 0.004 * group.currentSpeed * metrics.direction;

              group.particles.forEach(p => {
                p.mesh.visible = true;
                p.progress += step;
                if (p.progress > 1.0) p.progress -= 1.0;
                if (p.progress < 0.0) p.progress += 1.0;

                if (group.curve) {
                  p.mesh.position.copy(group.curve.getPoint(p.progress));
                } else {
                  p.mesh.position.lerpVectors(group.p1, group.p2, p.progress);
                }

                if (p.mesh.material.color.getHex() !== metrics.color) {
                  p.mesh.material.color.setHex(metrics.color);
                }
              });
            } else {
              group.particles.forEach(p => { p.mesh.visible = false; });
            }
          } else {
            // Hide particles when current is 0, unpowered, faulted, or toggle disabled
            group.particles.forEach(p => { p.mesh.visible = false; });
          }
        });
      }

      // 2. Animate LEDs with realistic glow, breathing pulse, and fault warning
      if (animatedLeds && animatedLeds.length > 0) {
        animatedLeds.forEach(led => {
          const elec = matchSimulationElectrical(led.comp, simulationResult, measurements);
          const ledAnim = calculateLEDElectricalAnimation(elec, isSolved ? 'SOLVED' : solverStatus, led.baseColor, time);

          let targetGlow = ledAnim.glowIntensity;
          let targetEmissive = ledAnim.emissiveIntensity;
          let emissiveColor = ledAnim.emissiveColor;

          if (faultState.isFault && (faultState.faultedComponentIds.includes(led.compId) || faultState.faultedComponentIds.length === 0)) {
            const flash = Math.sin(time * 10.0) > 0;
            targetGlow = flash ? 2.5 : 0.0;
            targetEmissive = flash ? 0.7 : 0.0;
            emissiveColor = 0xef4444;
          }

          // Smooth intensity transitions
          led.currentGlow += (targetGlow - led.currentGlow) * 0.1;
          led.currentEmissive += (targetEmissive - led.currentEmissive) * 0.1;

          if (led.glowLight) {
            led.glowLight.intensity = led.currentGlow;
            led.glowLight.color.setHex(emissiveColor);
          }
          if (led.bodyMaterial) {
            led.bodyMaterial.emissive.setHex(emissiveColor);
            led.bodyMaterial.emissiveIntensity = led.currentEmissive;
          }
          if (led.domeMaterial) {
            led.domeMaterial.emissive.setHex(emissiveColor);
            led.domeMaterial.emissiveIntensity = led.currentEmissive;
          }
        });
      }

      // 3. Animate component electrical activity (power dissipation heat highlight)
      if (animatedComponents && animatedComponents.length > 0) {
        animatedComponents.forEach(item => {
          const elec = matchSimulationElectrical(item.comp, simulationResult, measurements);
          const isComponentFaulted = faultState.isFault && (faultState.faultedComponentIds.includes(item.compId) || (faultState.faultedComponentIds.length === 0 && faultState.faultType === 'SOLVER_FAULT'));

          if (isComponentFaulted) {
            const pulse = 0.4 + 0.35 * Math.sin(time * 8.0);
            item.material.emissive.setHex(0xef4444);
            item.material.emissiveIntensity = pulse;
          } else {
            const act = calculateComponentElectricalActivity(item.compType, elec, isSolved ? 'SOLVED' : solverStatus, time);
            item.currentEmissive += (act.emissiveIntensity - item.currentEmissive) * 0.1;
            item.material.emissive.setHex(act.emissiveColor);
            item.material.emissiveIntensity = item.currentEmissive;
          }
        });
      }

      // 4. Animate Fault Warning Beacon
      if (faultBeaconGroup) {
        if (faultState.isFault) {
          faultBeaconGroup.visible = true;
          const s = 1.0 + 0.08 * Math.sin(time * 6.0);
          faultBeaconGroup.scale.set(s, 1.0, s);
        } else {
          faultBeaconGroup.visible = false;
        }
      }

      controls.update();
      renderer.render(scene, camera);
    };

    animate();

    // =========================================================
    // RESIZE
    // =========================================================

    const handleResize = () => {

      const newWidth =
        container.clientWidth ||
        900;

      camera.aspect =
        newWidth / height;

      camera.updateProjectionMatrix();

      renderer.setSize(
        newWidth,
        height
      );
    };

    window.addEventListener(
      'resize',
      handleResize
    );

    // =========================================================
    // CLEANUP
    // =========================================================

    return () => {

      cancelAnimationFrame(
        animationFrameId
      );

      if (particleGroups && particleGroups.length > 0) {
        particleGroups.forEach(group => {
          group.particles.forEach(p => {
            scene.remove(p.mesh);
            if (p.mesh.geometry) p.mesh.geometry.dispose();
            if (p.mesh.material) p.mesh.material.dispose();
          });
        });
      }

      window.removeEventListener(
        'resize',
        handleResize
      );

      renderer.domElement
        .removeEventListener(
          'pointerdown',
          handlePointerDown
        );

      controls.dispose();

      scene.traverse(
        (object) => {

          if (object.geometry) {
            object.geometry.dispose();
          }

          if (object.material) {

            if (
              Array.isArray(
                object.material
              )
            ) {

              object.material.forEach(
                (material) =>
                  material.dispose()
              );

            } else {

              object.material.dispose();
            }
          }
        }
      );

      renderer.dispose();
    };

  }, [circuit, simulationResult, solverStatus]);

  // ===========================================================
  // CAMERA PRESETS
  // ===========================================================

  const setCameraPreset =
    (type) => {

      if (
        !cameraRef.current ||
        !controlsRef.current
      ) {
        return;
      }

      const camera =
        cameraRef.current;

      const controls =
        controlsRef.current;

      if (type === 'top') {

        camera.position.set(
          0,
          28,
          0.01
        );

      } else if (type === 'iso') {

        camera.position.set(
          0,
          25,
          25
        );

      } else if (type === 'side') {

        camera.position.set(
          26,
          8,
          0
        );
      }

      controls.target.set(
        0,
        0,
        0
      );

      controls.update();
    };

  // ===========================================================
  // UI & DIGITAL TWIN CONTROLS
  // ===========================================================

  const componentCount =
    Array.isArray(circuit?.components)
      ? circuit.components.length
      : 0;

  const wireCount =
    Array.isArray(circuit?.wires)
      ? circuit.wires.length
      : 0;

  const nodeCount =
    simulationResult?.node_voltages
      ? Object.keys(simulationResult.node_voltages).length
      : (circuit?.nets?.length || 0);

  const isSolved = (simulationStatus === 'SOLVED' || simulationResult?.status === 'SOLVED' || solverStatus === 'SOLVED' || simulationResult?.solver_status === 'SOLVED');

  const activeSelectedElectrical = React.useMemo(() => {
    if (!selectedComp) return null;
    const cid = (selectedComp.id || '').toUpperCase();
    const cdes = (selectedComp.designator || '').toUpperCase();
    if (currentTransientSample) {
      const tCurr = currentTransientSample.componentCurrents?.[cdes] ?? currentTransientSample.componentCurrents?.[cid] ?? currentTransientSample.componentCurrents?.[selectedComp.id];
      const tVolt = currentTransientSample.componentVoltages?.[cdes] ?? currentTransientSample.componentVoltages?.[cid] ?? currentTransientSample.componentVoltages?.[selectedComp.id];
      const tPow = currentTransientSample.componentPower?.[cdes] ?? currentTransientSample.componentPower?.[cid] ?? currentTransientSample.componentPower?.[selectedComp.id];
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
    return selectedComp.electrical || null;
  }, [selectedComp, currentTransientSample]);

  return (
    <div
      style={{
        position: 'relative',
        background: '#040711',
        borderRadius: '12px',
        border:
          '1px solid var(--border-color)',
        overflow: 'hidden'
      }}
    >

      {/* Top Toolbar */}
      <div
        style={{
          position: 'absolute',
          top: '12px',
          left: '12px',
          right: '12px',
          zIndex: 10,
          display: 'flex',
          justifyContent:
            'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px',
          pointerEvents: 'none'
        }}
      >

        {/* Source & Status Badges */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
            flexWrap: 'wrap',
            pointerEvents: 'auto'
          }}
        >
          <span className="code-pill">
            source: {circuit?.source || 'real'}
          </span>

          <span className="code-pill">
            3D Components: {componentCount} | Wires: {wireCount} | Nodes: {nodeCount}
          </span>

          {/* Simulation Status Badge */}
          {isSolved ? (
            <span
              style={{
                fontSize: '0.75rem',
                padding: '0.2rem 0.6rem',
                borderRadius: '4px',
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#10b981',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                fontWeight: '600'
              }}
            >
              ⚡ SOLVED ({simulationResult?.analysis_mode || 'DC_OP'})
            </span>
          ) : solverStatus === 'NOT_RUN' || simulationResult?.solver_status === 'NOT_RUN' ? (
            <span
              style={{
                fontSize: '0.75rem',
                padding: '0.2rem 0.6rem',
                borderRadius: '4px',
                background: 'rgba(245, 158, 11, 0.15)',
                color: '#f59e0b',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                fontWeight: '600'
              }}
            >
              ⏸ SIMULATION: NOT RUN
            </span>
          ) : (
            <span
              style={{
                fontSize: '0.75rem',
                padding: '0.2rem 0.6rem',
                borderRadius: '4px',
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#ef4444',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                fontWeight: '600'
              }}
            >
              ⚠️ {solverStatus || 'SIMULATION: IDLE'}
            </span>
          )}
        </div>

        {/* Camera Views & Electrical Visualization Toggles */}
        <div
          style={{
            display: 'flex',
            gap: '6px',
            alignItems: 'center',
            flexWrap: 'wrap',
            pointerEvents: 'auto'
          }}
        >
          {/* Visual Mode Toggles */}
          <button
            onClick={() => setShowCurrentFlow(prev => !prev)}
            style={{
              padding: '0.25rem 0.6rem',
              fontSize: '0.75rem',
              borderRadius: '5px',
              border: showCurrentFlow ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.12)',
              background: showCurrentFlow ? 'rgba(56, 189, 248, 0.22)' : 'rgba(15, 23, 42, 0.8)',
              color: showCurrentFlow ? '#38bdf8' : '#94a3b8',
              cursor: 'pointer',
              fontWeight: showCurrentFlow ? '600' : '400',
              transition: 'all 0.15s ease'
            }}
            title="Toggle current particle animation"
          >
            ⚡ Current Flow
          </button>

          <button
            onClick={() => setShowNodeVoltages(prev => !prev)}
            style={{
              padding: '0.25rem 0.6rem',
              fontSize: '0.75rem',
              borderRadius: '5px',
              border: showNodeVoltages ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.12)',
              background: showNodeVoltages ? 'rgba(16, 185, 129, 0.22)' : 'rgba(15, 23, 42, 0.8)',
              color: showNodeVoltages ? '#10b981' : '#94a3b8',
              cursor: 'pointer',
              fontWeight: showNodeVoltages ? '600' : '400',
              transition: 'all 0.15s ease'
            }}
            title="Toggle 3D node voltage callout markers"
          >
            📍 Node Voltages
          </button>

          <button
            onClick={() => setShowElectricalValues(prev => !prev)}
            style={{
              padding: '0.25rem 0.6rem',
              fontSize: '0.75rem',
              borderRadius: '5px',
              border: showElectricalValues ? '1px solid #818cf8' : '1px solid rgba(255,255,255,0.12)',
              background: showElectricalValues ? 'rgba(129, 140, 248, 0.22)' : 'rgba(15, 23, 42, 0.8)',
              color: showElectricalValues ? '#818cf8' : '#94a3b8',
              cursor: 'pointer',
              fontWeight: showElectricalValues ? '600' : '400',
              transition: 'all 0.15s ease'
            }}
            title="Toggle component 3D electrical value badges"
          >
            🏷 Electrical Values
          </button>

          <button
            onClick={() => setShowPowerMode(prev => !prev)}
            style={{
              padding: '0.25rem 0.6rem',
              fontSize: '0.75rem',
              borderRadius: '5px',
              border: showPowerMode ? '1px solid #f43f5e' : '1px solid rgba(255,255,255,0.12)',
              background: showPowerMode ? 'rgba(244, 63, 94, 0.22)' : 'rgba(15, 23, 42, 0.8)',
              color: showPowerMode ? '#f43f5e' : '#94a3b8',
              cursor: 'pointer',
              fontWeight: showPowerMode ? '600' : '400',
              transition: 'all 0.15s ease'
            }}
            title="Toggle power dissipation emissive halos"
          >
            🔥 Power Mode
          </button>

          <span style={{ color: 'rgba(255,255,255,0.2)', margin: '0 2px' }}>|</span>

          {/* Camera Buttons */}
          <button
            onClick={() => setCameraPreset('top')}
            className="btn btn-secondary"
            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
          >
            Top 2D
          </button>

          <button
            onClick={() => setCameraPreset('iso')}
            className="btn btn-secondary"
            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
          >
            3D Iso
          </button>

          <button
            onClick={() => setCameraPreset('side')}
            className="btn btn-secondary"
            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
          >
            Side
          </button>
        </div>

      </div>

      {/* WebGL Canvas */}
      <div
        ref={mountRef}
        style={{
          width: '100%',
          height: '520px',
          cursor: 'grab'
        }}
      />

      {/* Digital Twin Inspector Bar */}
      <div
        style={{
          padding: '0.85rem 1.25rem',
          background: 'rgba(8,12,20,0.98)',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.45rem'
        }}
      >

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            {selectedComp ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontSize: '0.95rem',
                    fontWeight: '700',
                    color: 'var(--accent-cyan)'
                  }}
                >
                  {selectedComp.name || selectedComp.designator || selectedComp.id}
                </span>

                <span style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', background: 'rgba(255,255,255,0.06)', padding: '0.15rem 0.45rem', borderRadius: '4px' }}>
                  {selectedComp.type}
                </span>

                {selectedComp.tracking_state && (
                  <span style={{
                    fontSize: '0.72rem',
                    padding: '0.12rem 0.45rem',
                    borderRadius: '4px',
                    fontWeight: 600,
                    background: selectedComp.tracking_state === 'TRACKED' ? 'rgba(16, 185, 129, 0.2)' :
                                selectedComp.tracking_state === 'REACQUIRED' ? 'rgba(245, 158, 11, 0.2)' :
                                selectedComp.tracking_state === 'LOST' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(56, 189, 248, 0.2)',
                    color: selectedComp.tracking_state === 'TRACKED' ? '#10b981' :
                           selectedComp.tracking_state === 'REACQUIRED' ? '#f59e0b' :
                           selectedComp.tracking_state === 'LOST' ? '#ef4444' : '#38bdf8',
                    border: `1px solid ${selectedComp.tracking_state === 'TRACKED' ? 'rgba(16, 185, 129, 0.4)' :
                                        selectedComp.tracking_state === 'REACQUIRED' ? 'rgba(245, 158, 11, 0.4)' :
                                        selectedComp.tracking_state === 'LOST' ? 'rgba(239, 68, 68, 0.4)' : 'rgba(56, 189, 248, 0.4)'}`
                  }}>
                    {selectedComp.tracking_state}
                  </span>
                )}

                <span style={{ fontSize: '0.85rem', color: '#cbd5e1', fontWeight: '600' }}>
                  Nominal: {formatResistance(selectedComp.value)}
                </span>

                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                  | Pin 1 (<strong style={{ color: '#e2e8f0' }}>{selectedComp.hole1 || selectedComp.start_hole || '—'}</strong>) $\rightarrow$ Net <strong style={{ color: '#38bdf8' }}>{selectedComp.node1 || 'N/A'}</strong> {selectedComp.node1_voltage !== null && selectedComp.node1_voltage !== undefined ? `(${selectedComp.node1_voltage.toFixed(2)}V)` : ''}
                </span>

                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                  | Pin 2 (<strong style={{ color: '#e2e8f0' }}>{selectedComp.hole2 || selectedComp.end_hole || '—'}</strong>) $\rightarrow$ Net <strong style={{ color: '#38bdf8' }}>{selectedComp.node2 || 'N/A'}</strong> {selectedComp.node2_voltage !== null && selectedComp.node2_voltage !== undefined ? `(${selectedComp.node2_voltage.toFixed(2)}V)` : ''}
                </span>
              </div>
            ) : (
              <span
                style={{
                  fontSize: '0.85rem',
                  color: 'var(--text-muted)'
                }}
              >
                🔍 Click any component in the 3D Breadboard to inspect physical terminals & electrical simulation data.
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <span className="code-pill" style={{ fontSize: '0.75rem' }}>
              Drag: Rotate | Scroll: Zoom
            </span>
          </div>
        </div>

        {/* Tracking Loss Warning Notice */}
        {selectedComp && selectedComp.tracking_state === 'LOST' && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            color: '#fca5a5',
            padding: '0.3rem 0.65rem',
            borderRadius: '4px',
            fontSize: '0.76rem',
            marginTop: '0.1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}>
            <span>⚠️</span>
            <span>Component physical tracking temporarily lost (occluded / camera motion) — preserving last verified simulation result.</span>
          </div>
        )}

        {/* Electrical Simulation Data Line */}
        {selectedComp && (
          <div style={{
            background: 'rgba(15, 23, 42, 0.7)',
            padding: '0.5rem 0.75rem',
            borderRadius: '6px',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            fontSize: '0.82rem',
            marginTop: '0.2rem'
          }}>
            {isSolved ? (
              activeSelectedElectrical ? (
                <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  {/* Resistor Readout */}
                  {selectedComp.type === 'resistor' && (
                    <>
                      <span>Voltage Drop: <strong style={{ color: '#10b981' }}>{formatVoltage(activeSelectedElectrical.voltage)}</strong></span>
                      <span>Current: <strong style={{ color: '#fbbf24' }}>{formatCurrent(activeSelectedElectrical.current)}</strong></span>
                      <span>Power Dissipation: <strong style={{ color: '#f43f5e' }}>{formatPower(activeSelectedElectrical.power)}</strong></span>
                      <span>Current Direction: <strong style={{ color: '#38bdf8' }}>{activeSelectedElectrical.direction || 'pin1_to_pin2'}</strong></span>
                    </>
                  )}

                  {/* Inductor Readout */}
                  {selectedComp.type === 'inductor' && (
                    <>
                      <span>Voltage: <strong style={{ color: '#10b981' }}>{formatVoltage(activeSelectedElectrical.voltage)}</strong></span>
                      <span>Current: <strong style={{ color: '#fbbf24' }}>{formatCurrent(activeSelectedElectrical.current)}</strong></span>
                      <span>Power: <strong style={{ color: '#f43f5e' }}>{formatPower(activeSelectedElectrical.power)}</strong></span>
                      <span>Inductance: <strong style={{ color: '#38bdf8' }}>{selectedComp.displayValue || selectedComp.formatted_value || `${selectedComp.value || 0} H`}</strong></span>
                    </>
                  )}

                  {/* LED Readout */}
                  {selectedComp.type === 'led' && (
                    <>
                      <span>Forward Voltage: <strong style={{ color: '#10b981' }}>{formatVoltage(activeSelectedElectrical.forward_voltage ?? activeSelectedElectrical.voltage)}</strong></span>
                      <span>Current: <strong style={{ color: '#fbbf24' }}>{formatCurrent(activeSelectedElectrical.current)}</strong></span>
                      <span>Power: <strong style={{ color: '#f43f5e' }}>{formatPower(activeSelectedElectrical.power)}</strong></span>
                      <span>State: <strong style={{ color: activeSelectedElectrical.state === 'ON' ? '#10b981' : (activeSelectedElectrical.state === 'REVERSE' ? '#f59e0b' : '#94a3b8') }}>{activeSelectedElectrical.state || 'ON'}</strong></span>
                      <span>Direction: <strong style={{ color: '#38bdf8' }}>{activeSelectedElectrical.direction || 'FORWARD'}</strong></span>
                    </>
                  )}

                  {/* Capacitor Readout */}
                  {selectedComp.type === 'capacitor' && (
                    <>
                      <span>Voltage: <strong style={{ color: '#10b981' }}>{formatVoltage(activeSelectedElectrical.voltage)}</strong></span>
                      <span>Current: <strong style={{ color: '#fbbf24' }}>{formatCurrent(activeSelectedElectrical.current)}</strong></span>
                      <span>Power: <strong style={{ color: '#f43f5e' }}>{formatPower(activeSelectedElectrical.power)}</strong></span>
                      <span>Capacitance: <strong style={{ color: '#38bdf8' }}>{selectedComp.displayValue || selectedComp.formatted_value || `${selectedComp.value || 0} F`}</strong></span>
                    </>
                  )}

                  {/* Wire Readout */}
                  {selectedComp.type === 'wire' && (
                    <>
                      <span>Net: <strong style={{ color: '#38bdf8' }}>{selectedComp.node1 || selectedComp.net || 'N/A'}</strong></span>
                      <span>Current: <strong style={{ color: '#fbbf24' }}>{formatCurrent(activeSelectedElectrical.current)}</strong></span>
                      <span>Voltage Drop: <strong style={{ color: '#10b981' }}>{activeSelectedElectrical.voltage_difference !== undefined ? `${activeSelectedElectrical.voltage_difference} V` : '0.00 V'}</strong></span>
                    </>
                  )}

                  {/* Generic Diode / Other Component Readout */}
                  {selectedComp.type !== 'resistor' && selectedComp.type !== 'inductor' && selectedComp.type !== 'led' && selectedComp.type !== 'capacitor' && selectedComp.type !== 'wire' && (
                    <>
                      <span>Voltage: <strong style={{ color: '#10b981' }}>{formatVoltage(activeSelectedElectrical.voltage)}</strong></span>
                      <span>Current: <strong style={{ color: '#fbbf24' }}>{formatCurrent(activeSelectedElectrical.current)}</strong></span>
                      {activeSelectedElectrical.power !== undefined && (
                        <span>Power: <strong style={{ color: '#f43f5e' }}>{formatPower(activeSelectedElectrical.power)}</strong></span>
                      )}
                      <span>State: <strong style={{ color: '#38bdf8' }}>{activeSelectedElectrical.state || 'ACTIVE'}</strong></span>
                    </>
                  )}
                </div>
              ) : (
                <span style={{ color: '#94a3b8' }}>Electrical data unavailable for this component.</span>
              )
            ) : solverStatus === 'NOT_RUN' || simulationResult?.solver_status === 'NOT_RUN' ? (
              <span style={{ color: '#f59e0b' }}>
                ⏸ <strong>Simulation: NOT RUN</strong> — {simulationResult?.reason || solverError?.message || 'No active power source was detected in this photograph. Please add a simulated source for analysis.'} | <em>Electrical data unavailable</em>
              </span>
            ) : (
              <span style={{ color: '#ef4444' }}>
                ⚠️ <strong>Simulation: ERROR</strong> — {solverError?.message || simulationResult?.reason || 'Circuit solver encountered an error.'} | <em>Electrical data unavailable</em>
              </span>
            )}
          </div>
        )}

        {/* Node Voltages Summary & Safety Disclaimer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: '#64748b', marginTop: '0.1rem' }}>
          <div>
            {simulationResult?.node_voltages && Object.keys(simulationResult.node_voltages).length > 0 && (
              <span>
                Node Voltages: {Object.entries(simulationResult.node_voltages).map(([k, v]) => `${k}: ${Number(v).toFixed(2)}V`).join(' | ')}
              </span>
            )}
          </div>
          <div>
            Simulation result — not a physical measurement.
          </div>
        </div>

      </div>

    </div>
  );
}