import * as THREE from 'three';
import { createTrack, createTrackAlongPath } from './track.js';
import { createStation, stationColliders } from './station.js';
import { Train } from './train.js';
import { createScenery } from './scenery.js';
import { Crossing } from './crossing.js';
import { Colliders } from './collision.js';
import { BRANCH_WAYPOINTS, BRANCH_STATIONS } from './branchLayout.js';
import { BranchTrain } from './branchTrain.js';
import { Bike } from './bike.js';
import {
  PLATFORM_HEIGHT,
  PLATFORM_WIDTH,
  PLATFORM_LENGTH,
  PLATFORM_CENTRE_X,
  FLOOR_Y,
  STATIONS,
} from './layout.js';

const SKY_TOP = 0x2d5f97;
const SKY_HORIZON = 0xbcd4e8;

// Gradient sky painted on the inside of a large sphere.
function createSky() {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(SKY_TOP) },
      horizonColor: { value: new THREE.Color(SKY_HORIZON) },
    },
    // The gradient runs off the dome's own geometry, not world position, so
    // the dome can be re-centred on the camera each frame without skewing it.
    vertexShader: `
      varying vec3 vDirection;
      void main() {
        vDirection = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 horizonColor;
      varying vec3 vDirection;
      void main() {
        float h = vDirection.y;
        gl_FragColor = vec4(mix(horizonColor, topColor, pow(max(h, 0.0), 0.7)), 1.0);
      }
    `,
  });

  const sky = new THREE.Mesh(new THREE.SphereGeometry(2400, 48, 24), material);
  sky.name = 'sky';
  return sky;
}

function createGround() {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(5200, 5200),
    new THREE.MeshStandardMaterial({ color: 0x5d6b4d, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.name = 'ground';
  return ground;
}

function createLights() {
  const lights = new THREE.Group();
  lights.name = 'lights';

  lights.add(new THREE.HemisphereLight(SKY_HORIZON, 0x4a4f42, 1.0));

  const sun = new THREE.DirectionalLight(0xfff2dd, 2.4);
  sun.position.set(45, 70, 30);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.far = 260;
  sun.shadow.camera.left = -80;
  sun.shadow.camera.right = 80;
  sun.shadow.camera.top = 80;
  sun.shadow.camera.bottom = -80;
  sun.shadow.bias = -0.0004;
  lights.add(sun);

  return lights;
}

const halfWidth = PLATFORM_WIDTH / 2;
const halfLength = PLATFORM_LENGTH / 2;

function onAnyPlatform(x, z) {
  if (Math.abs(x - PLATFORM_CENTRE_X) <= halfWidth) {
    if (STATIONS.some((station) => Math.abs(z - station.z) <= halfLength)) return true;
  }
  // Branch platforms sit at whichever X that station's own stop on the
  // branch route works out to (station.js is built around PLATFORM_CENTRE_X
  // assuming the track is at x = 0, so it is wrapped with an X offset here
  // rather than modified itself - see the branch station loop below).
  return BRANCH_STATIONS.some(
    (station) =>
      Math.abs(x - (station.x + PLATFORM_CENTRE_X)) <= halfWidth &&
      Math.abs(z - station.z) <= halfLength
  );
}

export function buildWorld() {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(SKY_HORIZON, 140, 620);

  scene.add(createSky());
  scene.add(createGround());
  scene.add(createLights());
  scene.add(createTrack());
  scene.add(createScenery());

  const colliders = new Colliders();

  for (const station of STATIONS) {
    scene.add(createStation(station));
    for (const box of stationColliders(station.z)) colliders.add(box);
  }

  const train = new Train();
  scene.add(train.group);
  for (const box of train.colliders()) colliders.add(box);

  // The branch: its own track, its own four stops (station.js is built
  // entirely around PLATFORM_CENTRE_X on the assumption the track sits at
  // x = 0, so a branch stop just gets the whole station group and its
  // colliders shifted by that stop's own track X - no changes to station.js
  // itself, and no rotation needed since the branch line is Z-aligned again
  // by the time it reaches any of its stations).
  scene.add(createTrackAlongPath(BRANCH_WAYPOINTS));

  for (const station of BRANCH_STATIONS) {
    const group = createStation({ name: station.name, z: station.z });
    group.position.x = station.x;
    scene.add(group);
    for (const box of stationColliders(station.z)) {
      colliders.add({ ...box, minX: box.minX + station.x, maxX: box.maxX + station.x });
    }
  }

  const branchTrain = new BranchTrain();
  scene.add(branchTrain.group);
  for (const box of branchTrain.colliders()) colliders.add(box);

  // A bike, parked on the grass beside Oakford - clear of the platform, the
  // track's own clearance corridor (so no tree ever spawns on top of it),
  // and the telegraph poles' spacing.
  const bike = new Bike(-12, 18, 0);
  scene.add(bike.group);

  // Level crossings out on the line between the two stations.
  // Roughly midway between consecutive stops.
  const crossings = [-140, -420, -700, -980, -1260, -1540, -1820].map(
    (z) => new Crossing(z)
  );

  for (const crossing of crossings) {
    scene.add(crossing.group);
    for (const box of crossing.colliders()) colliders.add(box);
  }

  // Standing surface under the player. The train wins over the platform, so
  // stepping through the doorway puts you on the saloon floor.
  function heightAt(x, z) {
    if (train.contains(x, z)) return FLOOR_Y;
    if (branchTrain.contains(x, z)) return FLOOR_Y;
    if (onAnyPlatform(x, z)) return PLATFORM_HEIGHT;
    return 0;
  }

  // Sittable spots. train.seats stores car-local data (car is a specific
  // carriage's group, which only ever moves in Z); wrapping it here gives
  // each spot a live world position that tracks the train as it runs,
  // without train.js needing to know anything about player interaction.
  const seats = train.seats.map((seat) => ({
    x: seat.x,
    eyeY: seat.eyeY,
    getWorldZ: () => train.group.position.z + seat.car.position.z + seat.localZ,
  }));

  return { scene, heightAt, train, branchTrain, bike, crossings, colliders, seats };
}
