import * as THREE from 'three';
import {
  TRACK_GAUGE,
  TRACK_LENGTH,
  BALLAST_HEIGHT,
  SLEEPER_HEIGHT,
  RAIL_HEIGHT,
} from './layout.js';

const SLEEPER_SPACING = 0.65;

// Crushed stone bed. Slightly wider at the base than the top, like the real
// trapezoidal profile.
function createBallast() {
  const shape = new THREE.Shape();
  shape.moveTo(-3.4, 0);
  shape.lineTo(3.4, 0);
  shape.lineTo(2.4, BALLAST_HEIGHT);
  shape.lineTo(-2.4, BALLAST_HEIGHT);
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: TRACK_LENGTH,
    bevelEnabled: false,
  });
  // Extrude runs along +Z from the shape plane; centre it on the origin.
  geometry.translate(0, 0, -TRACK_LENGTH / 2);

  const ballast = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ color: 0x6b6560, roughness: 1 })
  );
  ballast.receiveShadow = true;
  ballast.name = 'ballast';
  return ballast;
}

// One instanced mesh for every sleeper - hundreds of identical boxes cost a
// single draw call this way.
function createSleepers() {
  const count = Math.floor(TRACK_LENGTH / SLEEPER_SPACING);

  const sleepers = new THREE.InstancedMesh(
    new THREE.BoxGeometry(2.6, SLEEPER_HEIGHT, 0.26),
    new THREE.MeshStandardMaterial({ color: 0x4a3b2f, roughness: 0.95 }),
    count
  );

  const dummy = new THREE.Object3D();
  const y = BALLAST_HEIGHT + SLEEPER_HEIGHT / 2;

  for (let i = 0; i < count; i++) {
    const z = -TRACK_LENGTH / 2 + i * SLEEPER_SPACING;
    dummy.position.set(0, y, z);
    // A touch of scatter so the rhythm does not read as perfectly machined.
    dummy.rotation.y = (Math.sin(i * 12.9898) * 0.5) * 0.02;
    dummy.updateMatrix();
    sleepers.setMatrixAt(i, dummy.matrix);
  }

  sleepers.castShadow = true;
  sleepers.receiveShadow = true;
  sleepers.name = 'sleepers';
  return sleepers;
}

function createRails() {
  const rails = new THREE.Group();
  rails.name = 'rails';

  const geometry = new THREE.BoxGeometry(0.09, RAIL_HEIGHT, TRACK_LENGTH);
  const material = new THREE.MeshStandardMaterial({
    color: 0xb8b4ae,
    roughness: 0.35,
    metalness: 0.85,
  });

  const y = BALLAST_HEIGHT + SLEEPER_HEIGHT + RAIL_HEIGHT / 2;

  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(geometry, material);
    rail.position.set((side * TRACK_GAUGE) / 2, y, 0);
    rail.castShadow = true;
    rails.add(rail);
  }

  return rails;
}

export function createTrack() {
  const track = new THREE.Group();
  track.name = 'track';
  track.add(createBallast(), createSleepers(), createRails());
  return track;
}
