import * as THREE from 'three';
import { WORLD_HALF_X, WORLD_HALF_Z, ROAD_HALF_WIDTH, STOP_LINE_MARGIN } from './constants.js';
import { buildProtectionUnit } from './protection.js';
import { buildTrack } from './track.js';
import { buildSurroundings } from './surroundings.js';
import { combinedTrackHalfWidth } from './settings.js';

const materials = {
  ground: new THREE.MeshStandardMaterial({ color: 0x4c5a3f, roughness: 1 }),
  road: new THREE.MeshStandardMaterial({ color: 0x35363a, roughness: 0.95 }),
  marking: new THREE.MeshStandardMaterial({ color: 0xd8d4c4, roughness: 0.9 }),
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

function buildRoad(combinedHalfWidth) {
  const group = new THREE.Group();

  const road = new THREE.Mesh(
    new THREE.BoxGeometry(ROAD_HALF_WIDTH * 2, 0.06, WORLD_HALF_Z * 2),
    materials.road
  );
  road.position.y = 0.03;
  road.receiveShadow = true;
  group.add(road);

  for (let z = -WORLD_HALF_Z; z < WORLD_HALF_Z; z += 6) {
    if (Math.abs(z) < combinedHalfWidth + 4) continue; // gap at the crossing
    const dash = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.02, 3), materials.marking);
    dash.position.set(0, 0.07, z + 1.5);
    group.add(dash);
  }

  return group;
}

// `settings` is the full {barrierType, lightStyle, trackCount, surroundings}
// object from settings.js. Builds every part of the world that depends on
// it - Game (game.js) owns the parts that change moment to moment (the
// barrier's own lowered amount, spawned trains/cars).
export function buildScene(settings, trackZs) {
  const combinedHalfWidth = combinedTrackHalfWidth(trackZs.length);

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
  scene.add(buildTrack(trackZs, combinedHalfWidth));
  scene.add(buildRoad(combinedHalfWidth));
  scene.add(buildSurroundings(settings.surroundings, combinedHalfWidth));

  const lamps = [];
  const southStopZ = -(combinedHalfWidth + STOP_LINE_MARGIN);
  const northStopZ = combinedHalfWidth + STOP_LINE_MARGIN;
  const southUnit = buildProtectionUnit(southStopZ, -1, settings.barrierType, settings.lightStyle, lamps);
  const northUnit = buildProtectionUnit(northStopZ, 1, settings.barrierType, settings.lightStyle, lamps);
  scene.add(southUnit.group, northUnit.group);

  // A wider multi-track corridor is a bigger scene to frame - pull the
  // camera back a little per extra track rather than leaving it a fixed
  // distance that would crop a 4-track crossing.
  const extraTracks = trackZs.length - 1;
  const camera = new THREE.PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.1,
    500
  );
  camera.position.set(0, 62 + extraTracks * 6, 78 + extraTracks * 6);
  camera.lookAt(0, 0, -4);

  return {
    scene,
    camera,
    lamps,
    protectionUnits: [southUnit, northUnit],
    combinedHalfWidth,
  };
}
