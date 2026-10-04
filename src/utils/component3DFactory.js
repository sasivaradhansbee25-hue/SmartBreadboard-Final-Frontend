/**
 * SmartBreadboard 3D — Procedural 3D Component Mesh Factory Engine
 * Builds procedural Three.js 3D meshes and metallic wire leads for all SPEC component classes:
 * Resistors, LEDs, Diodes, Ceramic Capacitors, Electrolytic Capacitors, DIP IC Chips, and Jumper Wires.
 */

import * as THREE from 'three';
import { holeTo3DPos } from './breadboard3DCoords.js';

// Color map for resistor bands
const RESISTOR_BAND_COLORS = {
  black: 0x000000,
  brown: 0x78350f,
  red: 0xdc2626,
  orange: 0xea580c,
  yellow: 0xeab308,
  green: 0x16a34a,
  blue: 0x2563eb,
  violet: 0x7c3aed,
  gray: 0x6b7280,
  white: 0xf8fafc,
  gold: 0xd97706,
  silver: 0x94a3b8
};

// LED lens color map
const LED_COLORS = {
  led_red: 0xef4444,
  led_green: 0x22c55e,
  led_blue: 0x3b82f6,
  led_yellow: 0xeab308
};

/**
 * Creates a 3D component mesh group based on component type and Phase 12 hole positions.
 * @param {Object} comp - Component object from Circuit Data Model JSON
 * @returns {THREE.Group} Three.js 3D component group
 */
export function createComponent3DMesh(comp) {
  const group = new THREE.Group();
  group.name = comp.id || comp.designator || 'comp_3d';

  const pos1 = holeTo3DPos(comp.hole1 || 'A22');
  const pos2 = holeTo3DPos(comp.hole2 || 'E22');

  const compType = (comp.type || 'resistor').toLowerCase();
  const leadMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.2 });

  if (compType === 'resistor') {
    // 1. Resistor 3D Cylinder Mesh
    const midX = (pos1.x + pos2.x) / 2;
    const midZ = (pos1.z + pos2.z) / 2;
    const spanDist = Math.sqrt((pos2.x - pos1.x)**2 + (pos2.z - pos1.z)**2);
    const bodyLength = Math.max(1.2, Math.min(2.2, spanDist * 0.7));

    const bodyGeo = new THREE.CylinderGeometry(0.35, 0.35, bodyLength, 16);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xd4a373, roughness: 0.4 });
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);

    // Calculate rotation angle in X-Z plane
    const angle = Math.atan2(pos2.z - pos1.z, pos2.x - pos1.x);
    bodyMesh.rotation.z = Math.PI / 2;
    bodyMesh.rotation.y = -angle;
    bodyMesh.castShadow = true;
    group.add(bodyMesh);

    // Procedural Color Bands
    const bandList = comp.bands || ['brown', 'black', 'red', 'gold'];
    const numBands = bandList.length;
    const step = (bodyLength * 0.7) / Math.max(1, numBands - 1);
    const startOffset = -(bodyLength * 0.35);

    bandList.forEach((bName, idx) => {
      const bColor = RESISTOR_BAND_COLORS[bName.toLowerCase()] || 0x000000;
      const bandGeo = new THREE.CylinderGeometry(0.37, 0.37, 0.12, 16);
      const bandMat = new THREE.MeshBasicMaterial({ color: bColor });
      const bandMesh = new THREE.Mesh(bandGeo, bandMat);
      bandMesh.rotation.z = Math.PI / 2;
      bandMesh.rotation.y = -angle;
      bandMesh.position.set(
        (startOffset + idx * step) * Math.cos(angle),
        0,
        (startOffset + idx * step) * Math.sin(angle)
      );
      group.add(bandMesh);
    });

    // Bent Metallic Wire Leads down to hole1 and hole2
    const lead1Geo = new THREE.CylinderGeometry(0.05, 0.05, 1.0, 8);
    const lead1 = new THREE.Mesh(lead1Geo, leadMat);
    lead1.position.set(pos1.x - midX, -0.4, pos1.z - midZ);
    group.add(lead1);

    const lead2Geo = new THREE.CylinderGeometry(0.05, 0.05, 1.0, 8);
    const lead2 = new THREE.Mesh(lead2Geo, leadMat);
    lead2.position.set(pos2.x - midX, -0.4, pos2.z - midZ);
    group.add(lead2);

    group.position.set(midX, 1.3, midZ);
    bodyMesh.userData = {
      id: comp.id,
      designator: comp.designator || 'R1',
      type: 'Resistor',
      value: comp.user_override_value || comp.detected_value || '1 kΩ',
      nodes: `${comp.node1 || 'N1'} <-> ${comp.node2 || 'N2'}`,
      holes: `${comp.hole1 || 'A22'} <-> ${comp.hole2 || 'E22'}`
    };

  } else if (compType.includes('led')) {
    // 2. LED 3D Dome & Glow Light Mesh
    const hexColor = LED_COLORS[compType] || 0xef4444;

    const domeGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.8, 16);
    const domeMat = new THREE.MeshPhysicalMaterial({
      color: hexColor,
      transparent: true,
      opacity: 0.85,
      roughness: 0.1,
      transmission: 0.6
    });
    const domeMesh = new THREE.Mesh(domeGeo, domeMat);
    domeMesh.position.y = 0.4;
    domeMesh.castShadow = true;
    group.add(domeMesh);

    const topSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.38, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      domeMat
    );
    topSphere.position.y = 0.8;
    group.add(topSphere);

    // Point Light Glow Source
    const pointLight = new THREE.PointLight(hexColor, 2.0, 3.5);
    pointLight.position.set(0, 0.5, 0);
    group.add(pointLight);

    // Wire Leads
    const lead1 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.9, 8), leadMat);
    lead1.position.set(-0.15, -0.45, 0);
    const lead2 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.8, 8), leadMat);
    lead2.position.set(0.15, -0.5, 0);
    group.add(lead1, lead2);

    group.position.set(pos1.x, 1.2, pos1.z);
    domeMesh.userData = {
      id: comp.id,
      designator: comp.designator || 'D1',
      type: `LED (${compType.replace('led_', '').toUpperCase()})`,
      value: comp.user_override_value || comp.detected_value || '2.1V Drop',
      nodes: `${comp.node1 || 'N1'} <-> ${comp.node2 || 'N2'}`,
      holes: `${comp.hole1 || 'A22'} <-> ${comp.hole2 || 'E22'}`
    };

  } else if (compType === 'capacitor_ceramic') {
    // 3. Ceramic Capacitor Flat Disc Mesh
    const discGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.2, 16);
    const discMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.3 });
    const discMesh = new THREE.Mesh(discGeo, discMat);
    discMesh.rotation.x = Math.PI / 2;
    discMesh.position.y = 0.5;
    group.add(discMesh);

    const lead1 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.8, 8), leadMat);
    lead1.position.set(-0.15, -0.4, 0);
    const lead2 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.8, 8), leadMat);
    lead2.position.set(0.15, -0.4, 0);
    group.add(lead1, lead2);

    group.position.set(pos1.x, 1.1, pos1.z);
    discMesh.userData = {
      id: comp.id,
      designator: comp.designator || 'C1',
      type: 'Ceramic Capacitor',
      value: comp.user_override_value || comp.detected_value || '100 nF',
      nodes: `${comp.node1 || 'N1'} <-> ${comp.node2 || 'N2'}`,
      holes: `${comp.hole1 || 'A22'} <-> ${comp.hole2 || 'E22'}`
    };

  } else if (compType === 'capacitor_electrolytic') {
    // 4. Electrolytic Canister Capacitor Mesh
    const canGeo = new THREE.CylinderGeometry(0.45, 0.45, 1.2, 16);
    const canMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.3 });
    const canMesh = new THREE.Mesh(canGeo, canMat);
    canMesh.position.y = 0.6;
    group.add(canMesh);

    // Silver Polarity Stripe
    const stripeGeo = new THREE.BoxGeometry(0.1, 1.22, 0.92);
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.2 });
    const stripeMesh = new THREE.Mesh(stripeGeo, stripeMat);
    stripeMesh.position.set(-0.2, 0.6, 0);
    group.add(stripeMesh);

    const lead1 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.8, 8), leadMat);
    lead1.position.set(-0.18, -0.4, 0);
    const lead2 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.7, 8), leadMat);
    lead2.position.set(0.18, -0.45, 0);
    group.add(lead1, lead2);

    group.position.set(pos1.x, 1.2, pos1.z);
    canMesh.userData = {
      id: comp.id,
      designator: comp.designator || 'C1',
      type: 'Electrolytic Capacitor',
      value: comp.user_override_value || comp.detected_value || '10 uF',
      nodes: `${comp.node1 || 'N1'} <-> ${comp.node2 || 'N2'}`,
      holes: `${comp.hole1 || 'A22'} <-> ${comp.hole2 || 'E22'}`
    };

  } else if (compType === 'ic_chip') {
    // 5. Dual-In-Line DIP IC Chip Mesh
    const icGeo = new THREE.BoxGeometry(1.6, 0.6, 3.2);
    const icMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2 });
    const icMesh = new THREE.Mesh(icGeo, icMat);
    icMesh.position.y = 0.5;
    group.add(icMesh);

    // Pin Rows (DIP Pins)
    for (let z = -1.2; z <= 1.2; z += 0.8) {
      const pinLeft = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.4, 0.1), leadMat);
      pinLeft.position.set(-0.9, 0.1, z);
      const pinRight = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.4, 0.1), leadMat);
      pinRight.position.set(0.9, 0.1, z);
      group.add(pinLeft, pinRight);
    }

    group.position.set(pos1.x, 0.9, pos1.z);
    icMesh.userData = {
      id: comp.id,
      designator: comp.designator || 'IC1',
      type: 'Integrated Circuit DIP',
      value: comp.user_override_value || comp.detected_value || 'NE555 Timer',
      nodes: `${comp.node1 || 'N1'} <-> ${comp.node2 || 'N2'}`,
      holes: `${comp.hole1 || 'A22'} <-> ${comp.hole2 || 'E22'}`
    };

  } else {
    // 6. 3D Jumper Wire Quadratic Bezier Curve Tube
    const startP = new THREE.Vector3(pos1.x, 0.61, pos1.z);
    const endP = new THREE.Vector3(pos2.x, 0.61, pos2.z);
    const midP = new THREE.Vector3(
      (pos1.x + pos2.x) / 2,
      Math.max(0.61, 2.5),
      (pos1.z + pos2.z) / 2
    );

    const curve = new THREE.QuadraticBezierCurve3(startP, midP, endP);
    const tubeGeo = new THREE.TubeGeometry(curve, 20, 0.12, 8, false);
    const tubeMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3 });
    const wireMesh = new THREE.Mesh(tubeGeo, tubeMat);
    wireMesh.castShadow = true;
    group.add(wireMesh);

    wireMesh.userData = {
      id: comp.id,
      designator: comp.designator || 'W1',
      type: 'Jumper Wire',
      value: 'Short Circuit Wire',
      nodes: `${comp.node1 || 'N1'} <-> ${comp.node2 || 'N2'}`,
      holes: `${comp.hole1 || 'A22'} <-> ${comp.hole2 || 'E22'}`
    };
  }

  return group;
}
