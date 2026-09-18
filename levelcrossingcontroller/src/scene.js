import * as THREE from 'three';
import {
  WORLD_HALF_X,
  WORLD_HALF_Z,
  ROAD_HALF_WIDTH,
  TRACK_HALF_WIDTH,
  STOP_LINE_MARGIN,
} from './constants.js';

const materials = {
  ground: new THREE.MeshStandardMaterial({ color: 0x4c5a3f, roughness: 1 }),
  road: new THREE.MeshStandardMaterial({ color: 0x35363a, roughness: 0.95 }),
  marking: new THREE.MeshStandardMaterial({ color: 0xd8d4c4, roughness: 0.9 }),
  ballast: new THREE.MeshStandardMaterial({ color: 0x6b6560, roughness: 1 }),
  sleeper: new THREE.MeshStandardMaterial({ color: 0x4a3b2f, roughness: 0.95 }),
  rail: new THREE.MeshStandardMaterial({ color: 0xb8b4ae, roughness: 0.35, metalness: 0.7 }),
  deck: new THREE.MeshStandardMaterial({ color: 0x4a4238, roughness: 0.95 }),
  post: new THREE.MeshStandardMaterial({ color: 0xe8e4dc, roughness: 0.7 }),
  boomWhite: new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.6 }),
  boomRed: new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.6 }),
};

function buildGround() {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD_HALF_X * 2.4, WORLD_HALF_Z * 2.4),
    materials.ground
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  return ground;
}

function buildRoad() {
  const group = new THREE.Group();

  const road = new THREE.Mesh(
    new THREE.BoxGeometry(ROAD_HALF_WIDTH * 2, 0.06, WORLD_HALF_Z * 2),
    materials.road
  );
  road.position.y = 0.03;
  road.receiveShadow = true;
  group.add(road);

  for (let z = -WORLD_HALF_Z; z < WORLD_HALF_Z; z += 6) {
    if (Math.abs(z) < TRACK_HALF_WIDTH + 4) continue; // gap at the crossing
    const dash = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.02, 3), materials.marking);
    dash.position.set(0, 0.07, z + 1.5);
    group.add(dash);
  }

  return group;
}

function buildTrack() {
  const group = new THREE.Group();

  const ballast = new THREE.Mesh(
    new THREE.BoxGeometry(WORLD_HALF_X * 2, 0.2, TRACK_HALF_WIDTH * 2 + 1.2),
    materials.ballast
  );
  ballast.position.y = 0.1;
  ballast.receiveShadow = true;
  group.add(ballast);

  const sleeperCount = Math.floor((WORLD_HALF_X * 2) / 0.65);
  const sleepers = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.26, 0.16, TRACK_HALF_WIDTH * 2 + 0.8),
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

  for (const z of [-TRACK_HALF_WIDTH * 0.6, TRACK_HALF_WIDTH * 0.6]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(WORLD_HALF_X * 2, 0.14, 0.09),
      materials.rail
    );
    rail.position.set(0, 0.37, z);
    rail.castShadow = true;
    group.add(rail);
  }

  // Timber deck where the road crosses.
  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(ROAD_HALF_WIDTH * 2, 0.36, TRACK_HALF_WIDTH * 2 + 0.6),
    materials.deck
  );
  deck.position.y = 0.2;
  deck.receiveShadow = true;
  group.add(deck);

  return group;
}

// One barrier assembly: a post, two flashing lamps and a boom that lowers
// across a single approach's lanes. `stopZ` is the Z of the stop line this
// barrier protects; the post stands at one edge of the road and the boom
// swings across to the other, mirroring a real gate's reach.
function buildBarrier(stopZ, postSide, lamps) {
  const assembly = new THREE.Group();
  const postX = postSide * (ROAD_HALF_WIDTH + 0.4);
  const reachDirection = -postSide;
  const boomLength = ROAD_HALF_WIDTH * 2 + 0.6;

  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 2.4, 10), materials.post);
  post.position.set(postX, 1.2, stopZ);
  post.castShadow = true;
  assembly.add(post);

  for (const offset of [-0.35, 0.35]) {
    const lamp = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.16, 0.09, 12),
      new THREE.MeshStandardMaterial({
        color: 0x5c1512,
        emissive: 0xff2a1a,
        emissiveIntensity: 0,
        roughness: 0.4,
      })
    );
    lamp.rotation.z = Math.PI / 2;
    lamp.position.set(postX + offset, 2.25, stopZ);
    assembly.add(lamp);
    lamps.push({ mesh: lamp, phase: offset > 0 ? 1 : 0 });
  }

  const pivot = new THREE.Group();
  pivot.position.set(postX, 1.4, stopZ);

  const boomGeometry = new THREE.BoxGeometry(boomLength, 0.11, 0.11);
  boomGeometry.translate((reachDirection * boomLength) / 2, 0, 0);
  const boom = new THREE.Mesh(boomGeometry, materials.boomWhite);
  boom.castShadow = true;
  pivot.add(boom);

  for (let i = 0; i < 4; i++) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.13, 0.13), materials.boomRed);
    band.position.x = reachDirection * (0.8 + i * 1.6);
    pivot.add(band);
  }

  assembly.add(pivot);
  // Raised (vertical) to start; Game drives rotation from crossing.lowered.
  pivot.rotation.z = reachDirection * (Math.PI / 2);

  return { assembly, pivot, reachDirection };
}

export function buildScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8fb4d9);
  scene.fog = new THREE.Fog(0x8fb4d9, 90, 190);

  scene.add(new THREE.HemisphereLight(0xdceaf0, 0x3c4632, 1.1));
  const sun = new THREE.DirectionalLight(0xfff2dd, 2.2);
  sun.position.set(40, 60, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -100;
  sun.shadow.camera.right = 100;
  sun.shadow.camera.top = 100;
  sun.shadow.camera.bottom = -100;
  sun.shadow.camera.far = 200;
  scene.add(sun);

  scene.add(buildGround());
  scene.add(buildTrack());
  scene.add(buildRoad());

  const lamps = [];
  const southStopZ = -(TRACK_HALF_WIDTH + STOP_LINE_MARGIN);
  const northStopZ = TRACK_HALF_WIDTH + STOP_LINE_MARGIN;
  const southBarrier = buildBarrier(southStopZ, -1, lamps);
  const northBarrier = buildBarrier(northStopZ, 1, lamps);
  scene.add(southBarrier.assembly, northBarrier.assembly);

  const camera = new THREE.PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.1,
    500
  );
  camera.position.set(0, 62, 78);
  camera.lookAt(0, 0, -4);

  return {
    scene,
    camera,
    lamps,
    barrierPivots: [southBarrier.pivot, northBarrier.pivot],
    reachDirections: [southBarrier.reachDirection, northBarrier.reachDirection],
  };
}
