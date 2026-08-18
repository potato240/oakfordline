import * as THREE from 'three';
import './style.css';
import { buildWorld } from './world.js';
import { Player } from './player.js';

const canvas = document.getElementById('scene');
const overlay = document.getElementById('overlay');
const startButton = document.getElementById('start');
const crosshair = document.getElementById('crosshair');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const camera = new THREE.PerspectiveCamera(
  70,
  window.innerWidth / window.innerHeight,
  0.1,
  2000
);

const scene = buildWorld();
const player = new Player(camera, renderer.domElement);
scene.add(player.object);

const hint = document.getElementById('hint');

startButton.addEventListener('click', () => player.lock());

// Some embedded browsers refuse pointer lock outright (WrongDocumentError).
// Rather than leaving the button looking broken, drop into drag-to-look.
document.addEventListener('pointerlockerror', () => {
  player.enableDragLook(renderer.domElement);
  overlay.classList.add('hidden');
  crosshair.classList.add('visible');
  hint.textContent =
    'Pointer lock unavailable here - hold the left mouse button and drag to look. WASD to walk.';
  hint.classList.add('visible');
});
player.controls.addEventListener('lock', () => {
  overlay.classList.add('hidden');
  crosshair.classList.add('visible');
});
player.controls.addEventListener('unlock', () => {
  overlay.classList.remove('hidden');
  crosshair.classList.remove('visible');
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Handy for poking at the scene from the devtools console during development.
if (import.meta.env.DEV) {
  window.game = { scene, camera, renderer, player };
}

const clock = new THREE.Clock();

renderer.setAnimationLoop(() => {
  // Clamp so a backgrounded tab does not teleport the player on return.
  const delta = Math.min(clock.getDelta(), 0.1);
  player.update(delta);
  renderer.render(scene, camera);
});
