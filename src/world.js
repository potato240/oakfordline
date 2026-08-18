import * as THREE from 'three';
import { createTrack } from './track.js';
import { createStation } from './station.js';
import { Train } from './train.js';
import { createScenery } from './scenery.js';
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
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 horizonColor;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition).y;
        gl_FragColor = vec4(mix(horizonColor, topColor, pow(max(h, 0.0), 0.7)), 1.0);
      }
    `,
  });

  const sky = new THREE.Mesh(new THREE.SphereGeometry(1400, 32, 16), material);
  sky.name = 'sky';
  return sky;
}

function createGround() {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1600, 1600),
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
  if (Math.abs(x - PLATFORM_CENTRE_X) > halfWidth) return false;
  return STATIONS.some((station) => Math.abs(z - station.z) <= halfLength);
}

export function buildWorld() {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(SKY_HORIZON, 140, 620);

  scene.add(createSky());
  scene.add(createGround());
  scene.add(createLights());
  scene.add(createTrack());
  scene.add(createScenery());

  for (const station of STATIONS) scene.add(createStation(station));

  const train = new Train();
  scene.add(train.group);

  // Standing surface under the player. The train wins over the platform, so
  // stepping through the doorway puts you on the saloon floor.
  function heightAt(x, z) {
    if (train.contains(x, z)) return FLOOR_Y;
    if (onAnyPlatform(x, z)) return PLATFORM_HEIGHT;
    return 0;
  }

  return { scene, heightAt, train };
}
