import * as THREE from 'three';

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

  const sky = new THREE.Mesh(new THREE.SphereGeometry(1000, 32, 16), material);
  sky.name = 'sky';
  return sky;
}

function createGround() {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400),
    new THREE.MeshStandardMaterial({ color: 0x5d6b4d, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.name = 'ground';
  return ground;
}

// Stand-in for the station platform until real station geometry exists.
function createPlatform() {
  const platform = new THREE.Mesh(
    new THREE.BoxGeometry(8, 1.1, 40),
    new THREE.MeshStandardMaterial({ color: 0x9a958c, roughness: 0.85 })
  );
  platform.position.set(0, 0.55, -10);
  platform.castShadow = true;
  platform.receiveShadow = true;
  platform.name = 'platform';
  return platform;
}

function createLights() {
  const lights = new THREE.Group();
  lights.name = 'lights';

  lights.add(new THREE.HemisphereLight(SKY_HORIZON, 0x4a4f42, 1.1));

  const sun = new THREE.DirectionalLight(0xfff2dd, 2.2);
  sun.position.set(45, 60, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.far = 200;
  sun.shadow.camera.left = -70;
  sun.shadow.camera.right = 70;
  sun.shadow.camera.top = 70;
  sun.shadow.camera.bottom = -70;
  sun.shadow.bias = -0.0004;
  lights.add(sun);

  return lights;
}

export function buildWorld() {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(SKY_HORIZON, 60, 320);

  scene.add(createSky(), createGround(), createPlatform(), createLights());

  return scene;
}
