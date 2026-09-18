import * as THREE from 'three';
import { WORLD_HALF_X, WORLD_HALF_Z, ROAD_HALF_WIDTH } from './constants.js';

// Deterministic pseudo-random, same idea as Oakford Line's own scenery
// placement - the point is a repeatable layout per game load, not
// cryptographic quality.
function makeRandom(seed) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const materials = {
  grass: new THREE.MeshStandardMaterial({ color: 0x4c5a3f, roughness: 1 }),
  trunk: new THREE.MeshStandardMaterial({ color: 0x4b3a2a, roughness: 1 }),
  canopy: new THREE.MeshStandardMaterial({ color: 0x3f6b38, roughness: 1, flatShading: true }),
  concrete: new THREE.MeshStandardMaterial({ color: 0x8a8f92, roughness: 0.9 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x6f93ad, roughness: 0.3, metalness: 0.2 }),
  brick: new THREE.MeshStandardMaterial({ color: 0x8f5a45, roughness: 0.95 }),
  brickLight: new THREE.MeshStandardMaterial({ color: 0xc9a876, roughness: 0.9 }),
  roofDark: new THREE.MeshStandardMaterial({ color: 0x3d3a38, roughness: 0.9 }),
  roofRed: new THREE.MeshStandardMaterial({ color: 0x7a3226, roughness: 0.9 }),
  barnRed: new THREE.MeshStandardMaterial({ color: 0x9a2e24, roughness: 0.9 }),
  silo: new THREE.MeshStandardMaterial({ color: 0xd8d4c4, roughness: 0.6, metalness: 0.2 }),
  hay: new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 1 }),
  fence: new THREE.MeshStandardMaterial({ color: 0x6b5a42, roughness: 0.95 }),
  field: new THREE.MeshStandardMaterial({ color: 0x7a8f4a, roughness: 1 }),
};

function tree(random) {
  const group = new THREE.Group();
  const scale = 0.8 + random() * 0.8;

  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 2.4, 6), materials.trunk);
  trunk.position.y = 1.2 * scale;
  trunk.scale.set(scale, scale, scale);
  trunk.castShadow = true;
  group.add(trunk);

  const canopy = new THREE.Mesh(new THREE.IcosahedronGeometry(1.7, 0), materials.canopy);
  canopy.position.y = 2.7 * scale;
  canopy.scale.setScalar(scale * (0.85 + random() * 0.4));
  canopy.rotation.y = random() * Math.PI * 2;
  canopy.castShadow = true;
  group.add(canopy);

  return group;
}

function box(w, h, d, material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.y = h / 2;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function tower(footprint, height, material, glassMaterial) {
  const group = new THREE.Group();
  group.add(box(footprint, height, footprint, material));

  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(footprint * 0.98, height * 0.9, footprint * 0.02),
    glassMaterial
  );
  glass.position.set(0, height * 0.5 + 0.4, footprint / 2 + 0.01);
  group.add(glass);

  return group;
}

function cottage(random) {
  const group = new THREE.Group();
  const w = 3.2 + random() * 1.2;
  const d = 3.6 + random() * 1.2;
  group.add(box(w, 2.4, d, random() < 0.5 ? materials.brick : materials.brickLight));

  const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.75, 1.6, 4), materials.roofRed);
  roof.position.y = 2.4 + 0.8;
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  group.add(roof);

  return group;
}

function shopBuilding(random) {
  const group = new THREE.Group();
  const w = 5 + random() * 2;
  const h = 3.2 + random() * 2;
  group.add(box(w, h, 4.5, materials.brickLight));
  const roof = box(w + 0.2, 0.2, 4.7, materials.roofDark);
  roof.position.y = h + 0.1;
  group.add(roof);
  return group;
}

function barn() {
  const group = new THREE.Group();
  group.add(box(6, 3.2, 8, materials.barnRed));

  const roof = new THREE.Mesh(new THREE.ConeGeometry(5.2, 2.2, 4), materials.roofDark);
  roof.position.y = 3.2 + 1.1;
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1, 1, 1.4);
  roof.castShadow = true;
  group.add(roof);

  return group;
}

function silo() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 5, 14), materials.silo);
  body.position.y = 2.5;
  body.castShadow = true;
  group.add(body);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(1.4, 1.2, 14), materials.roofDark);
  cap.position.y = 5.6;
  cap.castShadow = true;
  group.add(cap);
  return group;
}

function hayBale() {
  const bale = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.1, 10), materials.hay);
  bale.rotation.z = Math.PI / 2;
  bale.position.y = 0.6;
  bale.castShadow = true;
  return bale;
}

function fenceLine(random, length, segments) {
  const group = new THREE.Group();
  const step = length / segments;
  for (let i = 0; i <= segments; i++) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.0, 0.1), materials.fence);
    post.position.set(-length / 2 + i * step, 0.5, 0);
    post.castShadow = true;
    group.add(post);
  }
  const rail = new THREE.Mesh(new THREE.BoxGeometry(length, 0.06, 0.06), materials.fence);
  rail.position.y = 0.75;
  group.add(rail);
  return group;
}

function fieldPatch(w, d) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), materials.field);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.01; // just above the grass, to avoid z-fighting
  mesh.receiveShadow = true;
  return mesh;
}

// Places `count` props via `place(random)`, each rejected and retried while
// it falls inside the crossing's own clearance rectangle - the same idea as
// Oakford Line's tree placement, generalised to an arbitrary clear box
// instead of a fixed "distance from x = 0" formula, since this game's
// danger zone can be wide (more tracks) or narrow depending on settings.
function scatter(group, random, count, clearHalfX, clearHalfZ, place) {
  for (let i = 0; i < count; i++) {
    let x, z;
    let clear = false;
    for (let attempt = 0; attempt < 8 && !clear; attempt++) {
      x = (random() - 0.5) * WORLD_HALF_X * 2.2;
      z = (random() - 0.5) * WORLD_HALF_Z * 2.2;
      clear = Math.abs(x) > clearHalfX || Math.abs(z) > clearHalfZ;
    }
    if (!clear) continue;

    const prop = place(random);
    prop.position.x += x;
    prop.position.z += z;
    group.add(prop);
  }
}

// `combinedHalfWidth` is the current danger corridor's own Z half-extent
// (wider with more tracks) - passed in, rather than imported, so this stays
// in sync with whatever TRACK_COUNT the player picked without needing to
// know about settings.js itself.
export function buildSurroundings(kind, combinedHalfWidth) {
  const group = new THREE.Group();
  const clearHalfX = ROAD_HALF_WIDTH + 6;
  const clearHalfZ = combinedHalfWidth + 6;
  const random = makeRandom(20260101);

  if (kind === 'default') {
    return group; // bare, as the game always looked before this setting existed
  }

  if (kind === 'rural') {
    scatter(group, random, 18, clearHalfX, clearHalfZ, tree);
    return group;
  }

  if (kind === 'city') {
    scatter(group, random, 26, clearHalfX, clearHalfZ, (r) =>
      tower(3 + r() * 3, 8 + r() * 22, materials.concrete, materials.glass)
    );
    scatter(group, random, 6, clearHalfX, clearHalfZ, tree);
    return group;
  }

  if (kind === 'town') {
    scatter(group, random, 16, clearHalfX, clearHalfZ, shopBuilding);
    scatter(group, random, 10, clearHalfX, clearHalfZ, tree);
    return group;
  }

  if (kind === 'village') {
    scatter(group, random, 14, clearHalfX, clearHalfZ, cottage);
    scatter(group, random, 16, clearHalfX, clearHalfZ, tree);
    return group;
  }

  if (kind === 'farm') {
    scatter(group, random, 22, clearHalfX, clearHalfZ, fieldPatch.bind(null, 14, 14));
    scatter(group, random, 2, clearHalfX, clearHalfZ, barn);
    scatter(group, random, 2, clearHalfX, clearHalfZ, silo);
    scatter(group, random, 10, clearHalfX, clearHalfZ, hayBale);
    scatter(group, random, 4, clearHalfX, clearHalfZ, (r) => fenceLine(r, 8, 4));
    scatter(group, random, 4, clearHalfX, clearHalfZ, tree);
    return group;
  }

  return group;
}
