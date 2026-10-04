/**
 * src/components/Realistic3DComponents.js
 * 
 * 3D Electrical Hardware Components & Physical AR Effects for Three.js.
 * 
 * Includes:
 * - 3D Golden Heat-Sinked Power Resistor with dynamic thermal glow
 * - 3D Toroidal Core Inductor with copper windings and dynamic magnetic flux rings
 * - 3D Aluminum Can Capacitor with terminal lugs and electrostatic field visualization
 * - 3D Glass Cartridge Fuse with internal fuse wire (green healthy, red blown)
 * - 3D Industrial Toggle Switch with movable lever
 * - 3D Analog Dial Meter (Ammeter / Voltmeter) with needle deflecting to simulated RMS
 * - 3D AC Source Terminal Block with Phase (L) and Neutral (N) binding posts
 * - 3D AC Wire Path with 50 Hz bidirectional current particle animation
 */

import * as THREE from 'three';
import { MotorAnimationControllerClass } from '../utils/motorAnimationController.js';

// -------------------------------------------------------------
// Shared Standard Materials
// -------------------------------------------------------------
const goldAnodizedMaterial = new THREE.MeshStandardMaterial({
  color: 0xd97706, // Amber/Gold heat-sink aluminum
  metalness: 0.88,
  roughness: 0.28
});

const copperWireMaterial = new THREE.MeshStandardMaterial({
  color: 0xb45309, // Polished copper
  metalness: 0.92,
  roughness: 0.22
});

const ferriteCoreMaterial = new THREE.MeshStandardMaterial({
  color: 0x1f2937, // Dark ferrite
  metalness: 0.65,
  roughness: 0.70
});

const aluminumCanMaterial = new THREE.MeshStandardMaterial({
  color: 0xe2e8f0, // Brushed aluminum
  metalness: 0.90,
  roughness: 0.25
});

const chromeTerminalMaterial = new THREE.MeshStandardMaterial({
  color: 0xf8fafc,
  metalness: 0.95,
  roughness: 0.15
});

/**
 * 3D Resistor (Industrial wirewound aluminum housed power resistor)
 */
export function create3DResistor(comp = {}, scale = 1.0) {
  const group = new THREE.Group();
  group.name = `Resistor_${comp.id || 'R'}`;

  // Gold Anodized Aluminum Housing Body
  const bodyW = 1.4;
  const bodyH = 0.45;
  const bodyD = 0.55;
  const bodyGeo = new THREE.BoxGeometry(bodyW, bodyH, bodyD);
  const bodyMesh = new THREE.Mesh(bodyGeo, goldAnodizedMaterial);
  group.add(bodyMesh);

  // Longitudinal Cooling Fins (4 fins along top and bottom)
  for (let f = -1; f <= 1; f += 2) {
    for (let j = -2; j <= 2; j++) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(bodyW * 0.92, 0.08, 0.04), goldAnodizedMaterial);
      fin.position.set(0, (bodyH / 2 + 0.04) * f, j * 0.1);
      group.add(fin);
    }
  }

  // Ceramic Core Ends
  const ceramicMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.6 });
  const endCapGeo = new THREE.BoxGeometry(0.12, bodyH * 0.9, bodyD * 0.9);
  const endLeft = new THREE.Mesh(endCapGeo, ceramicMat);
  endLeft.position.set(-bodyW / 2 - 0.06, 0, 0);
  const endRight = new THREE.Mesh(endCapGeo, ceramicMat);
  endRight.position.set(bodyW / 2 + 0.06, 0, 0);
  group.add(endLeft, endRight);

  // Lead Terminals
  const leadGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.5, 12);
  const lead1 = new THREE.Mesh(leadGeo, chromeTerminalMaterial);
  lead1.rotation.z = Math.PI / 2;
  lead1.position.set(-bodyW / 2 - 0.35, 0, 0);

  const lead2 = new THREE.Mesh(leadGeo, chromeTerminalMaterial);
  lead2.rotation.z = Math.PI / 2;
  lead2.position.set(bodyW / 2 + 0.35, 0, 0);
  group.add(lead1, lead2);

  // Thermal Infrared Glow Aura Mesh
  const glowGeo = new THREE.SphereGeometry(1.0, 16, 16);
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0xf97316,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending
  });
  const glowMesh = new THREE.Mesh(glowGeo, glowMat);
  glowMesh.scale.set(1.4, 0.8, 0.8);
  group.add(glowMesh);

  group.scale.set(scale, scale, scale);

  return {
    group,
    update(powerWatts = 0, isRunning = true) {
      // Modulate thermal glow based on calculated real power
      const intensity = isRunning ? Math.min(1.0, Math.max(0, powerWatts / 120.0)) : 0.0;
      glowMat.opacity = intensity * 0.35;
      glowMesh.scale.set(1.4 + intensity * 0.2, 0.8 + intensity * 0.2, 0.8 + intensity * 0.2);
    }
  };
}

/**
 * 3D Inductor (Toroidal core inductor with copper wire windings)
 */
export function create3DInductor(comp = {}, scale = 1.0) {
  const group = new THREE.Group();
  group.name = `Inductor_${comp.id || 'L'}`;

  // Ferrite Toroidal Core Ring
  const coreRadius = 0.65;
  const tubeRadius = 0.25;
  const coreGeo = new THREE.TorusGeometry(coreRadius, tubeRadius, 20, 36);
  const coreMesh = new THREE.Mesh(coreGeo, ferriteCoreMaterial);
  group.add(coreMesh);

  // Copper Coil Windings (24 turns wound radially around the toroid)
  const numTurns = 24;
  for (let t = 0; t < numTurns; t++) {
    const angle = (t / numTurns) * Math.PI * 2;
    const turnMesh = new THREE.Mesh(new THREE.TorusGeometry(tubeRadius + 0.02, 0.035, 10, 20), copperWireMaterial);
    turnMesh.position.set(Math.cos(angle) * coreRadius, Math.sin(angle) * coreRadius, 0);
    turnMesh.rotation.z = angle + Math.PI / 2;
    group.add(turnMesh);
  }

  // Connecting Lead Pins
  const lead1 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.45, 12), copperWireMaterial);
  lead1.position.set(-coreRadius - 0.2, -tubeRadius - 0.15, 0);
  const lead2 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.45, 12), copperWireMaterial);
  lead2.position.set(coreRadius + 0.2, -tubeRadius - 0.15, 0);
  group.add(lead1, lead2);

  // Magnetic Field Concentric Flux Rings (3 expanding rings)
  const fluxRings = [];
  for (let r = 0; r < 3; r++) {
    const ringGeo = new THREE.TorusGeometry(coreRadius * (1.3 + r * 0.35), 0.02, 8, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    group.add(ringMesh);
    fluxRings.push({ mesh: ringMesh, mat: ringMat, baseR: coreRadius * (1.3 + r * 0.35), phase: r * 0.33 });
  }

  group.scale.set(scale, scale, scale);

  return {
    group,
    update(currentAmps = 0, elapsedSec = 0, isRunning = true) {
      const active = isRunning && currentAmps > 0.05;
      fluxRings.forEach((ring) => {
        if (!active) {
          ring.mat.opacity = 0;
          return;
        }
        const cycle = (elapsedSec * 1.5 + ring.phase) % 1.0;
        const currentScale = 1.0 + cycle * 0.5;
        ring.mesh.scale.set(currentScale, currentScale, currentScale);
        ring.mat.opacity = Math.sin(cycle * Math.PI) * Math.min(0.65, currentAmps / 4.0);
      });
    }
  };
}

/**
 * 3D Capacitor (Aluminum can motor-run / electrolytic capacitor)
 */
export function create3DCapacitor(comp = {}, scale = 1.0) {
  const group = new THREE.Group();
  group.name = `Capacitor_${comp.id || 'C'}`;

  const canRadius = 0.55;
  const canHeight = 1.5;

  // Aluminum Cylindrical Body
  const canGeo = new THREE.CylinderGeometry(canRadius, canRadius, canHeight, 32);
  const canMesh = new THREE.Mesh(canGeo, aluminumCanMaterial);
  group.add(canMesh);

  // Bottom Crimped Rim Flange
  const rimGeo = new THREE.CylinderGeometry(canRadius * 1.04, canRadius * 1.04, 0.08, 32);
  const rimMesh = new THREE.Mesh(rimGeo, aluminumCanMaterial);
  rimMesh.position.y = -canHeight / 2 + 0.04;
  group.add(rimMesh);

  // Black Bakelite Top Terminal Insulator Disk
  const topDiskGeo = new THREE.CylinderGeometry(canRadius * 0.95, canRadius * 0.95, 0.12, 32);
  const topDiskMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8 });
  const topDisk = new THREE.Mesh(topDiskGeo, topDiskMat);
  topDisk.position.y = canHeight / 2 + 0.06;
  group.add(topDisk);

  // Two Terminal Spade Studs
  const studGeo = new THREE.BoxGeometry(0.08, 0.28, 0.16);
  const stud1 = new THREE.Mesh(studGeo, chromeTerminalMaterial);
  stud1.position.set(-canRadius * 0.42, canHeight / 2 + 0.22, 0);

  const stud2 = new THREE.Mesh(studGeo, chromeTerminalMaterial);
  stud2.position.set(canRadius * 0.42, canHeight / 2 + 0.22, 0);
  group.add(stud1, stud2);

  // Electric Field Pulse Rings between studs
  const eFieldGeo = new THREE.TorusGeometry(0.35, 0.02, 8, 24);
  const eFieldMat = new THREE.MeshBasicMaterial({
    color: 0x3b82f6,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending
  });
  const eFieldMesh = new THREE.Mesh(eFieldGeo, eFieldMat);
  eFieldMesh.rotation.x = Math.PI / 2;
  eFieldMesh.position.y = canHeight / 2 + 0.25;
  group.add(eFieldMesh);

  group.scale.set(scale, scale, scale);

  return {
    group,
    update(voltageV = 0, elapsedSec = 0, isRunning = true) {
      if (!isRunning || voltageV < 2.0) {
        eFieldMat.opacity = 0;
        return;
      }
      const pulse = Math.abs(Math.sin(elapsedSec * 6.0));
      eFieldMat.opacity = 0.25 + 0.45 * pulse * Math.min(1.0, voltageV / 230.0);
      const s = 1.0 + 0.2 * pulse;
      eFieldMesh.scale.set(s, s, 1.0);
    }
  };
}

/**
 * 3D Fuse (Industrial glass cartridge fuse with ferrule endcaps)
 */
export function create3DFuse(comp = {}, scale = 1.0) {
  const group = new THREE.Group();
  group.name = `Fuse_${comp.id || 'F'}`;

  const fuseRadius = 0.22;
  const fuseLength = 1.1;

  // Transparent Glass Tube
  const glassGeo = new THREE.CylinderGeometry(fuseRadius, fuseRadius, fuseLength * 0.65, 24);
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.45,
    roughness: 0.1,
    transmission: 0.85,
    thickness: 0.2
  });
  const glassMesh = new THREE.Mesh(glassGeo, glassMat);
  glassMesh.rotation.z = Math.PI / 2;
  group.add(glassMesh);

  // Chrome Nickel Ferrule Endcaps
  const capGeo = new THREE.CylinderGeometry(fuseRadius * 1.08, fuseRadius * 1.08, fuseLength * 0.22, 24);
  const capLeft = new THREE.Mesh(capGeo, chromeTerminalMaterial);
  capLeft.rotation.z = Math.PI / 2;
  capLeft.position.x = -fuseLength * 0.42;

  const capRight = new THREE.Mesh(capGeo, chromeTerminalMaterial);
  capRight.rotation.z = Math.PI / 2;
  capRight.position.x = fuseLength * 0.42;
  group.add(capLeft, capRight);

  // Internal Fuse Wire Link
  const wireGeo = new THREE.CylinderGeometry(0.025, 0.025, fuseLength * 0.7, 8);
  const wireMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
  const wireMesh = new THREE.Mesh(wireGeo, wireMat);
  wireMesh.rotation.z = Math.PI / 2;
  group.add(wireMesh);

  group.scale.set(scale, scale, scale);

  return {
    group,
    update(isBlown = false) {
      wireMat.color.setHex(isBlown ? 0xef4444 : 0x10b981);
    }
  };
}

/**
 * 3D Switch (Heavy-duty industrial toggle switch with actuator lever)
 */
export function create3DSwitch(comp = {}, scale = 1.0) {
  const group = new THREE.Group();
  group.name = `Switch_${comp.id || 'S'}`;

  // Base Plate Housing
  const baseGeo = new THREE.BoxGeometry(0.7, 0.2, 0.7);
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.3 });
  const baseMesh = new THREE.Mesh(baseGeo, baseMat);
  group.add(baseMesh);

  // Bushing Ring
  const bushingGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.22, 16);
  const bushing = new THREE.Mesh(bushingGeo, chromeTerminalMaterial);
  bushing.position.y = 0.15;
  group.add(bushing);

  // Actuator Lever Pivot Group
  const leverPivot = new THREE.Group();
  leverPivot.position.set(0, 0.24, 0);

  const leverGeo = new THREE.CylinderGeometry(0.05, 0.08, 0.75, 12);
  const leverMesh = new THREE.Mesh(leverGeo, chromeTerminalMaterial);
  leverMesh.position.y = 0.375;
  leverPivot.add(leverMesh);

  const tipGeo = new THREE.SphereGeometry(0.1, 16, 16);
  const tipMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3 });
  const tipMesh = new THREE.Mesh(tipGeo, tipMat);
  tipMesh.position.y = 0.75;
  leverPivot.add(tipMesh);

  group.add(leverPivot);
  group.scale.set(scale, scale, scale);

  return {
    group,
    update(isOn = true) {
      leverPivot.rotation.z = isOn ? -0.42 : 0.42;
      tipMat.color.setHex(isOn ? 0x10b981 : 0xef4444);
    }
  };
}

/**
 * 3D Analog Panel Meter (Ammeter or Voltmeter with deflecting needle)
 */
export function create3DAnalogMeter(type = 'ammeter', scale = 1.0) {
  const group = new THREE.Group();
  group.name = `Meter_${type}`;

  const meterRadius = 0.75;

  // Round Dial Case
  const caseGeo = new THREE.CylinderGeometry(meterRadius, meterRadius, 0.25, 32);
  const caseMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.7, metalness: 0.5 });
  const caseMesh = new THREE.Mesh(caseGeo, caseMat);
  caseMesh.rotation.x = Math.PI / 2;
  group.add(caseMesh);

  // Dial Face (White parchment)
  const faceGeo = new THREE.CircleGeometry(meterRadius * 0.92, 32);
  const faceMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
  const faceMesh = new THREE.Mesh(faceGeo, faceMat);
  faceMesh.position.z = 0.13;
  group.add(faceMesh);

  // Meter Label (A or V)
  const labelGeo = new THREE.RingGeometry(meterRadius * 0.55, meterRadius * 0.58, 24, 1, Math.PI * 0.2, Math.PI * 0.6);
  const labelMat = new THREE.MeshBasicMaterial({ color: 0x334155, side: THREE.DoubleSide });
  const scaleArc = new THREE.Mesh(labelGeo, labelMat);
  scaleArc.position.z = 0.135;
  group.add(scaleArc);

  // Pointer Needle
  const needleGroup = new THREE.Group();
  needleGroup.position.set(0, -meterRadius * 0.35, 0.14);

  const needleGeo = new THREE.BoxGeometry(0.025, meterRadius * 0.85, 0.01);
  const needleMat = new THREE.MeshBasicMaterial({ color: 0xd97706 });
  const needleMesh = new THREE.Mesh(needleGeo, needleMat);
  needleMesh.position.y = meterRadius * 0.425;
  needleGroup.add(needleMesh);
  group.add(needleGroup);

  group.scale.set(scale, scale, scale);

  return {
    group,
    update(val = 0, maxVal = 10) {
      // Map 0..maxVal to -0.6 to +0.6 radians
      const fraction = Math.min(1.0, Math.max(0.0, val / maxVal));
      needleGroup.rotation.z = 0.6 - fraction * 1.2;
    }
  };
}

/**
 * 3D LED (Realistic 5mm epoxy lens with cathode rim, flat edge, and illumination glow)
 */
export function create3DLED(comp = {}, scale = 1.0) {
  const group = new THREE.Group();
  group.name = `LED_${comp.id || 'D'}`;

  const ledColorHex = comp.color === 'green' ? 0x22c55e : (comp.color === 'blue' ? 0x3b82f6 : (comp.color === 'yellow' ? 0xeab308 : 0xef4444));

  // 1. Base Cylinder
  const baseGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.45, 16);
  const lensMat = new THREE.MeshPhysicalMaterial({
    color: ledColorHex,
    transmission: 0.85,
    opacity: 0.95,
    transparent: true,
    roughness: 0.15,
    ior: 1.5,
    emissive: ledColorHex,
    emissiveIntensity: 0.2
  });
  const baseMesh = new THREE.Mesh(baseGeo, lensMat);
  baseMesh.position.y = 0.22;
  group.add(baseMesh);

  // 2. Domed Top Cap
  const domeGeo = new THREE.SphereGeometry(0.35, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  const domeMesh = new THREE.Mesh(domeGeo, lensMat);
  domeMesh.position.y = 0.45;
  group.add(domeMesh);

  // 3. Flange Rim
  const rimGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.08, 16);
  const rimMesh = new THREE.Mesh(rimGeo, lensMat);
  rimMesh.position.y = 0.04;
  group.add(rimMesh);

  // 4. Anode & Cathode Leads
  const leadMat = chromeTerminalMaterial;
  const leadGeoAnode = new THREE.CylinderGeometry(0.03, 0.03, 0.6, 8);
  const leadAnode = new THREE.Mesh(leadGeoAnode, leadMat);
  leadAnode.position.set(-0.14, -0.3, 0);

  const leadGeoCathode = new THREE.CylinderGeometry(0.03, 0.03, 0.5, 8);
  const leadCathode = new THREE.Mesh(leadGeoCathode, leadMat);
  leadCathode.position.set(0.14, -0.25, 0);

  group.add(leadAnode, leadCathode);

  // 5. Illumination Aura Mesh
  const glowGeo = new THREE.SphereGeometry(0.65, 16, 16);
  const glowMat = new THREE.MeshBasicMaterial({
    color: ledColorHex,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending
  });
  const glowMesh = new THREE.Mesh(glowGeo, glowMat);
  glowMesh.position.y = 0.35;
  group.add(glowMesh);

  group.scale.set(scale, scale, scale);

  return {
    group,
    update(currentAmps = 0, isLit = true) {
      const active = isLit && currentAmps > 0.001;
      const intensity = active ? Math.min(2.0, Math.max(0.4, currentAmps * 50.0)) : 0.0;
      lensMat.emissiveIntensity = 0.1 + intensity * 0.8;
      glowMat.opacity = active ? Math.min(0.7, 0.2 + intensity * 0.3) : 0.0;
    }
  };
}

/**
 * 3D AC Power Source Terminal Block (Phase L and Neutral N binding posts)
 */
export function create3DACSource(scale = 1.0) {
  const group = new THREE.Group();
  group.name = 'AC_Source_Block';

  const blockGeo = new THREE.BoxGeometry(1.2, 1.8, 0.4);
  const blockMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.6, metalness: 0.4 });
  const blockMesh = new THREE.Mesh(blockGeo, blockMat);
  group.add(blockMesh);

  // Red Phase (L) Binding Post
  const redPostMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3, metalness: 0.6 });
  const postGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.3, 16);
  const redPost = new THREE.Mesh(postGeo, redPostMat);
  redPost.rotation.x = Math.PI / 2;
  redPost.position.set(0.25, 0.25, 0.25);

  // Blue Neutral (N) Binding Post
  const bluePostMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.3, metalness: 0.6 });
  const bluePost = new THREE.Mesh(postGeo, bluePostMat);
  bluePost.rotation.x = Math.PI / 2;
  bluePost.position.set(0.25, -0.4, 0.25);

  group.add(redPost, bluePost);
  group.scale.set(scale, scale, scale);

  return { group };
}

/**
 * 3D Current Particles Path Animation
 */
export function create3DCurrentFlowParticles(screenPath = [], numParticles = 24) {
  const points = (screenPath || []).map(p => new THREE.Vector3(p.x || p[0] || 0, p.y || p[1] || 0, 0));
  if (points.length < 2) return null;

  const curve = new THREE.CatmullRomCurve3(points);
  const geo = new THREE.SphereGeometry(3.5, 8, 8);
  const mat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending
  });

  const particleMeshes = [];
  const group = new THREE.Group();
  group.name = 'CurrentFlowParticles';

  for (let i = 0; i < numParticles; i++) {
    const mesh = new THREE.Mesh(geo, mat);
    group.add(mesh);
    particleMeshes.push(mesh);
  }

  return {
    group,
    update(progressOffset = 0, currentRms = 1.0, freqHz = 50.0, elapsedSec = 0) {
      if (currentRms <= 0.05) {
        group.visible = false;
        return;
      }
      group.visible = true;

      // 50 Hz AC oscillation: particles slow down and alternate direction
      const omega = 2 * Math.PI * freqHz;
      const acFactor = Math.sin(omega * elapsedSec * 0.1); // slowed down for clear viewing
      const dir = acFactor >= 0 ? 1 : -1;
      const speed = Math.abs(acFactor) * Math.min(2.5, currentRms * 0.5);

      particleMeshes.forEach((mesh, idx) => {
        const baseT = (idx / numParticles + progressOffset * dir * speed + 1.0) % 1.0;
        const pt = curve.getPointAt(baseT);
        mesh.position.copy(pt);
        mesh.scale.setScalar(0.7 + 0.6 * Math.abs(acFactor));
      });
    },
    dispose() {
      geo.dispose();
      mat.dispose();
    }
  };
}

/**
 * 3D LM7805 Voltage Regulator (TO-220 Package)
 * Realistic aluminum heatsink tab with mounting hole, molded black epoxy body, and 3 pins.
 */
export function create3D7805Regulator(comp = {}, scale = 1.0) {
  const group = new THREE.Group();
  group.name = `Regulator_${comp.id || '7805'}`;

  // 1. Metal Heatsink Tab (Top)
  const tabGeo = new THREE.BoxGeometry(1.0, 0.65, 0.08);
  const tabMesh = new THREE.Mesh(tabGeo, aluminumCanMaterial);
  tabMesh.position.y = 0.55;
  group.add(tabMesh);

  // Mounting Hole in tab
  const holeGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.1, 16);
  const holeMat = new THREE.MeshBasicMaterial({ color: 0x030712 });
  const holeMesh = new THREE.Mesh(holeGeo, holeMat);
  holeMesh.rotation.x = Math.PI / 2;
  holeMesh.position.set(0, 0.60, 0);
  group.add(holeMesh);

  // 2. Molded Black Epoxy Resin Body
  const bodyGeo = new THREE.BoxGeometry(1.0, 0.9, 0.35);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.75,
    metalness: 0.15
  });
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
  bodyMesh.position.y = -0.05;
  group.add(bodyMesh);

  // 3. Laser Engraved Text Strip
  const labelGeo = new THREE.PlaneGeometry(0.75, 0.22);
  const labelMat = new THREE.MeshBasicMaterial({ color: 0x94a3b8 });
  const labelMesh = new THREE.Mesh(labelGeo, labelMat);
  labelMesh.position.set(0, 0.0, 0.18);
  group.add(labelMesh);

  // 4. Three Terminal Lead Pins (1: Input, 2: Ground, 3: Output)
  const pinGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.7, 8);
  [-0.32, 0.0, 0.32].forEach((xPos, idx) => {
    const pin = new THREE.Mesh(pinGeo, chromeTerminalMaterial);
    pin.position.set(xPos, -0.75, 0);
    group.add(pin);
  });

  group.scale.set(scale, scale, scale);

  return {
    group,
    update() {}
  };
}

/**
 * 3D ESP32 Development Board
 * Realistic PCB with ESP-WROOM-32 RF shield, gold trace antenna, micro-USB, and pin headers.
 */
export function create3DESP32(comp = {}, scale = 1.0) {
  const group = new THREE.Group();
  group.name = `ESP32_${comp.id || 'Board'}`;

  // 1. Matte Black FR4 PCB Substrate
  const pcbGeo = new THREE.BoxGeometry(1.8, 2.8, 0.08);
  const pcbMat = new THREE.MeshStandardMaterial({
    color: 0x090d16,
    roughness: 0.65,
    metalness: 0.2
  });
  const pcbMesh = new THREE.Mesh(pcbGeo, pcbMat);
  group.add(pcbMesh);

  // 2. ESP-WROOM-32 Metal RF Shielding Can
  const shieldGeo = new THREE.BoxGeometry(1.2, 1.2, 0.16);
  const shieldMesh = new THREE.Mesh(shieldGeo, aluminumCanMaterial);
  shieldMesh.position.set(0, 0.15, 0.1);
  group.add(shieldMesh);

  // 3. Gold PCB Meandering Trace Antenna
  const antGeo = new THREE.BoxGeometry(1.2, 0.35, 0.02);
  const antMesh = new THREE.Mesh(antGeo, goldAnodizedMaterial);
  antMesh.position.set(0, 1.05, 0.05);
  group.add(antMesh);

  // 4. Micro-USB Metal Connector Port
  const usbGeo = new THREE.BoxGeometry(0.5, 0.35, 0.18);
  const usbMesh = new THREE.Mesh(usbGeo, chromeTerminalMaterial);
  usbMesh.position.set(0, -1.35, 0.1);
  group.add(usbMesh);

  // 5. Dual Row Header Pins (Left and Right)
  const pinHeaderMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
  const pinMat = goldAnodizedMaterial;

  [-0.78, 0.78].forEach(xSide => {
    // Plastic base strip
    const stripGeo = new THREE.BoxGeometry(0.18, 2.5, 0.15);
    const strip = new THREE.Mesh(stripGeo, pinHeaderMat);
    strip.position.set(xSide, -0.05, 0.1);
    group.add(strip);

    // Gold pins
    for (let p = -5; p <= 5; p++) {
      const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.25, 6), pinMat);
      pin.position.set(xSide, p * 0.22, 0.2);
      group.add(pin);
    }
  });

  // 6. Onboard Status LEDs (Power Red + GPIO Blue)
  const pwrLed = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.05), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
  pwrLed.position.set(-0.35, -0.9, 0.08);

  const ioLed = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.05), new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
  ioLed.position.set(-0.15, -0.9, 0.08);

  group.add(pwrLed, ioLed);

  group.scale.set(scale, scale, scale);

  return {
    group,
    update() {}
  };
}

/**
 * 3D DC Power Supply Module (Dual Binding Posts + / -)
 */
export function create3DDCSupply(comp = {}, scale = 1.0) {
  const group = new THREE.Group();
  group.name = `DCSupply_${comp.id || 'Pwr'}`;

  // Base module block
  const blockGeo = new THREE.BoxGeometry(1.5, 1.2, 0.45);
  const blockMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5, metalness: 0.5 });
  const blockMesh = new THREE.Mesh(blockGeo, blockMat);
  group.add(blockMesh);

  // Red Positive Terminal Post
  const redMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3, metalness: 0.5 });
  const postGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.35, 16);
  const redPost = new THREE.Mesh(postGeo, redMat);
  redPost.rotation.x = Math.PI / 2;
  redPost.position.set(-0.4, 0.0, 0.3);

  // Black Negative Terminal Post
  const blackMat = new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.3, metalness: 0.5 });
  const blackPost = new THREE.Mesh(postGeo, blackMat);
  blackPost.rotation.x = Math.PI / 2;
  blackPost.position.set(0.4, 0.0, 0.3);

  group.add(redPost, blackPost);
  group.scale.set(scale, scale, scale);

  return {
    group,
    update() {}
  };
}

/**
 * 3D Realistic DC Motor (M1 / M2)
 * High-fidelity DC motor with metallic cylindrical housing, front bearing,
 * rotating polished drive shaft, and independent MotorAnimationControllerClass.
 */
export function create3DDCMotor(comp = {}, scale = 1.0) {
  const group = new THREE.Group();
  group.name = `DCMotor_${comp.id || 'M'}`;

  // Independent animation controller for this specific motor
  const animController = new MotorAnimationControllerClass();

  // 1. Stationary Motor Casing
  const stationaryBody = new THREE.Group();

  // Brushed steel cylindrical housing
  const casingRadius = 0.55;
  const casingLength = 1.3;
  const casingGeo = new THREE.CylinderGeometry(casingRadius, casingRadius, casingLength, 24);
  const casingMesh = new THREE.Mesh(casingGeo, aluminumCanMaterial);
  casingMesh.rotation.x = Math.PI / 2;
  stationaryBody.add(casingMesh);

  // Front bearing boss collar
  const bossGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.2, 16);
  const bossMesh = new THREE.Mesh(bossGeo, chromeTerminalMaterial);
  bossMesh.rotation.x = Math.PI / 2;
  bossMesh.position.z = casingLength / 2 + 0.1;
  stationaryBody.add(bossMesh);

  // Rear plastic endcap
  const endcapGeo = new THREE.CylinderGeometry(casingRadius * 0.96, casingRadius * 0.96, 0.15, 24);
  const endcapMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
  const endcapMesh = new THREE.Mesh(endcapGeo, endcapMat);
  endcapMesh.rotation.x = Math.PI / 2;
  endcapMesh.position.z = -casingLength / 2 - 0.05;
  stationaryBody.add(endcapMesh);

  // Rear solder terminal tabs (copper)
  [-0.22, 0.22].forEach(x => {
    const tab = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.25, 0.04), copperWireMaterial);
    tab.position.set(x, -casingRadius * 0.2, -casingLength / 2 - 0.2);
    stationaryBody.add(tab);
  });

  group.add(stationaryBody);

  // 2. Rotating Drive Shaft & Coupling Assembly
  const rotatingAssembly = new THREE.Group();
  rotatingAssembly.name = 'DCMotorRotor';

  // Polished Steel Drive Shaft
  const shaftRadius = 0.1;
  const shaftLength = 0.9;
  const shaftGeo = new THREE.CylinderGeometry(shaftRadius, shaftRadius, shaftLength, 16);
  const shaftMesh = new THREE.Mesh(shaftGeo, chromeTerminalMaterial);
  shaftMesh.rotation.x = Math.PI / 2;
  shaftMesh.position.z = casingLength / 2 + shaftLength / 2;
  rotatingAssembly.add(shaftMesh);

  // Brass Pulley / Coupling attached to shaft for high visual contrast rotation
  const pulleyGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.35, 16);
  const pulleyMesh = new THREE.Mesh(pulleyGeo, goldAnodizedMaterial);
  pulleyMesh.rotation.x = Math.PI / 2;
  pulleyMesh.position.z = casingLength / 2 + 0.45;
  rotatingAssembly.add(pulleyMesh);

  // Keyway slot notch on pulley
  const notchGeo = new THREE.BoxGeometry(0.06, 0.06, 0.36);
  const notchMesh = new THREE.Mesh(notchGeo, new THREE.MeshBasicMaterial({ color: 0x090d16 }));
  notchMesh.position.set(0, 0.18, casingLength / 2 + 0.45);
  rotatingAssembly.add(notchMesh);

  group.add(rotatingAssembly);
  group.scale.set(scale, scale, scale);

  return {
    group,
    stationaryBody,
    rotatingAssembly,
    shaftGroup: rotatingAssembly,
    animController,

    /**
     * Updates motor rotation based on status ('RUNNING' or 'STOPPED').
     * Smoothly accelerates when RUNNING and smoothly decelerates when STOPPED.
     */
    update(motorState = {}, dt = 0.016, isStale = false) {
      const isRunning = !isStale && Boolean(
        motorState.status === 'RUNNING' ||
        motorState.is_running === true ||
        motorState.running_state === 'RUNNING'
      );

      const controllerInput = isRunning
        ? { is_running: true, visual_speed: 0.22, ...motorState }
        : { is_running: false, decelerate: true, ...motorState };

      const anim = animController.update(controllerInput);
      rotatingAssembly.rotation.z = anim.angle;

      return {
        angle: anim.angle,
        speed: anim.speed,
        isRotating: anim.isRotating,
        status: isRunning ? 'RUNNING' : 'STOPPED'
      };
    },

    dispose() {
      group.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
          else child.material.dispose();
        }
      });
    }
  };
}

export const createRealisticIndustrialMotor = create3DDCMotor;

