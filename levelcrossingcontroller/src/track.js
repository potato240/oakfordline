import * as THREE from 'three';
import { WORLD_HALF_X, TRACK_HALF_WIDTH, ROAD_HALF_WIDTH } from './constants.js';

const materials = {
  ballast: new THREE.MeshStandardMaterial({ color: 0x6b6560, roughness: 1 }),
  sleeper: new THREE.MeshStandardMaterial({ color: 0x4a3b2f, roughness: 0.95 }),
  rail: new THREE.MeshStandardMaterial({ color: 0xb8b4ae, roughness: 0.35, metalness: 0.7 }),
  deck: new THREE.MeshStandardMaterial({ color: 0x4a4238, roughness: 0.95 }),
};

// One continuous ballast bed spanning every parallel track (a real
// multi-track railway is one contiguous corridor, not N separate strips
// with gaps between them), with one rail pair per entry in `trackZs`.
// `combinedHalfWidth` is the Z half-extent of that whole corridor -
// settings.combinedTrackHalfWidth(trackZs.length), passed in rather than
// recomputed here so scene.js and game.js can never disagree about it.
export function buildTrack(trackZs, combinedHalfWidth) {
  const group = new THREE.Group();

  const ballast = new THREE.Mesh(
    new THREE.BoxGeometry(WORLD_HALF_X * 2, 0.2, combinedHalfWidth * 2 + 1.2),
    materials.ballast
  );
  ballast.position.y = 0.1;
  ballast.receiveShadow = true;
  group.add(ballast);

  const sleeperCount = Math.floor((WORLD_HALF_X * 2) / 0.65);
  const sleepers = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.26, 0.16, combinedHalfWidth * 2 + 0.8),
    materials.sleeper,
    sleeperCount
  );
  const dummy = new THREE.Object3D();
  for (let i = 0; i < sleeperCount; i++) {
    dummy.position.set(-WORLD_HALF_X + i * 0.65, 0.28, 0);
    dummy.updateMatrix();
    sleepers.setMatrixAt(i, dummy.matrix);
  }
  sleepers.castShadow = true;
  sleepers.receiveShadow = true;
  group.add(sleepers);

  const railGeometry = new THREE.BoxGeometry(WORLD_HALF_X * 2, 0.14, 0.09);
  for (const trackZ of trackZs) {
    for (const offset of [-TRACK_HALF_WIDTH * 0.6, TRACK_HALF_WIDTH * 0.6]) {
      const rail = new THREE.Mesh(railGeometry, materials.rail);
      rail.position.set(0, 0.37, trackZ + offset);
      rail.castShadow = true;
      group.add(rail);
    }
  }

  // Timber deck where the road crosses, spanning the full combined corridor.
  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(ROAD_HALF_WIDTH * 2, 0.36, combinedHalfWidth * 2 + 0.6),
    materials.deck
  );
  deck.position.y = 0.2;
  deck.receiveShadow = true;
  group.add(deck);

  return group;
}
