import * as THREE from 'three';
import { TRACK_LENGTH } from './layout.js';

// Deterministic pseudo-random so the landscape is the same every load.
function makeRandom(seed) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const TREE_COUNT = 220;
// Keep this corridor clear so trees never grow through the railway.
const CLEAR_HALF_WIDTH = 18;

function createTrees() {
  const group = new THREE.Group();
  group.name = 'trees';

  const trunks = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.16, 0.24, 2.4, 6),
    new THREE.MeshStandardMaterial({ color: 0x4b3a2a, roughness: 1 }),
    TREE_COUNT
  );
  const canopies = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(1.7, 0),
    new THREE.MeshStandardMaterial({ color: 0x3f6b38, roughness: 1, flatShading: true }),
    TREE_COUNT
  );

  const random = makeRandom(20260818);
  const dummy = new THREE.Object3D();

  for (let i = 0; i < TREE_COUNT; i++) {
    const side = random() < 0.5 ? -1 : 1;
    const x = side * (CLEAR_HALF_WIDTH + random() * 150);
    const z = (random() - 0.5) * TRACK_LENGTH * 0.95;
    const scale = 0.7 + random() * 0.9;

    dummy.position.set(x, 1.2 * scale, z);
    dummy.scale.setScalar(scale);
    dummy.rotation.y = random() * Math.PI * 2;
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);

    dummy.position.set(x, (2.4 + random() * 0.6) * scale, z);
    dummy.scale.setScalar(scale * (0.85 + random() * 0.4));
    dummy.updateMatrix();
    canopies.setMatrixAt(i, dummy.matrix);
  }

  trunks.castShadow = true;
  canopies.castShadow = true;
  group.add(trunks, canopies);
  return group;
}

// Low hills on the horizon so the world does not end in flat nothing.
function createHills() {
  const group = new THREE.Group();
  group.name = 'hills';

  const material = new THREE.MeshStandardMaterial({
    color: 0x53663f,
    roughness: 1,
    flatShading: true,
  });

  const random = makeRandom(99);

  // The line runs along Z, so a hill placed near the Z axis sits right on top
  // of the track. Skip any whose skirt would reach the railway corridor.
  const CORRIDOR_CLEARANCE = 45;

  for (let i = 0; i < 14; i++) {
    const radius = 45 + random() * 55;
    const height = 16 + random() * 26;
    const distance = 230 + random() * 90;

    let placed = false;
    for (let attempt = 0; attempt < 12 && !placed; attempt++) {
      const angle = (i / 14) * Math.PI * 2 + random() * 1.2;
      const x = Math.cos(angle) * distance;
      const z = Math.sin(angle) * distance;

      // Keep the whole cone clear of the track, which sits at x = 0.
      if (Math.abs(x) < radius + CORRIDOR_CLEARANCE) continue;

      const hill = new THREE.Mesh(new THREE.ConeGeometry(radius, height, 7), material);
      hill.position.set(x, height / 2 - 4, z);
      hill.rotation.y = random() * Math.PI;
      group.add(hill);
      placed = true;
    }
  }

  return group;
}

// Telegraph poles marching alongside the line.
function createTelegraphPoles() {
  const group = new THREE.Group();
  group.name = 'telegraph';

  const woodMaterial = new THREE.MeshStandardMaterial({
    color: 0x5a4632,
    roughness: 0.95,
  });
  const poleGeometry = new THREE.CylinderGeometry(0.11, 0.15, 7, 7);
  const armGeometry = new THREE.BoxGeometry(1.5, 0.1, 0.1);

  for (let z = -TRACK_LENGTH / 2; z < TRACK_LENGTH / 2; z += 26) {
    const pole = new THREE.Group();

    const post = new THREE.Mesh(poleGeometry, woodMaterial);
    post.position.y = 3.5;
    post.castShadow = true;
    pole.add(post);

    for (const y of [6.2, 5.5]) {
      const arm = new THREE.Mesh(armGeometry, woodMaterial);
      arm.position.y = y;
      pole.add(arm);
    }

    pole.position.set(-9.5, 0, z);
    group.add(pole);
  }

  return group;
}

export function createScenery() {
  const scenery = new THREE.Group();
  scenery.name = 'scenery';
  scenery.add(createTrees(), createHills(), createTelegraphPoles());
  return scenery;
}
