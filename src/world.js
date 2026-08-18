import * as THREE from 'three';

// Vertical gradient sky, drawn on the inside of a large sphere that is always
// rendered behind everything else.
function createSky() {
  const geometry = new THREE.SphereGeometry(1000, 32, 16);
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x2d5f97) },
      horizonColor: { value: new THREE.Color(0xbcd4e8) },
      offset: { value: 40 },
      exponent: { value: 0.7 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 topColor;
      uniform vec3 horizonColor;
      uniform float offset;
      uniform float exponent;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition + offset).y;
        float t = pow(max(h, 0.0), exponent);
        gl_FragColor = vec4(mix(horizonColor, topColor, t), 1.0);
      }
    `,
  });

  const sky = new THREE.Mesh(geometry, material);
  sky.name = 'sky';
  return sky;
}

function createGround() {
  const geometry = new THREE.PlaneGeometry(400, 400, 1, 1);
  const material = new THREE.MeshStandardMaterial({
    color: 0x5d6b4d,
    roughness: 1,
    metalness: 0,
  });
  const ground = new THREE.Mesh(geometry, material);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.name = 'ground';
  return ground;
}

// Placeholder for the station platform. Swapped for real station geometry later.
function createPlatform() {
  const width = 8;
  const height = 1.1;
  const depth = 40;

  const geometry = new THREE.BoxGeometry(width, height, depth);
  const material = new THREE.MeshStandardMaterial({
    color: 0x9a958c,
    roughness: 0.85,
    metalness: 0.05,
  });

  const platform = new THREE.Mesh(geometry, material);
  platform.position.set(0, height / 2, -10);
  platform.castShadow = true;
  platform.receiveShadow = true;
  platform.name = 'platform';
  return platform;
}

function createLights() {
  const group = new THREE.Group();
  group.name = 'lights';

  const hemi = new THREE.HemisphereLight(0xbcd4e8, 0x4a4f42, 1.1);
  hemi.position.set(0, 50, 0);
  group.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff2dd, 2.2);
  sun.position.set(45, 60, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 200;
  sun.shadow.camera.left = -70;
  sun.shadow.camera.right = 70;
  sun.shadow.camera.top = 70;
  sun.shadow.camera.bottom = -70;
  sun.shadow.bias = -0.0004;
  group.add(sun);
  group.add(sun.target);

  return group;
}

export function buildWorld() {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xbcd4e8, 60, 320);

  scene.add(createSky());
  scene.add(createGround());
  scene.add(createPlatform());
  scene.add(createLights());

  return scene;
}
