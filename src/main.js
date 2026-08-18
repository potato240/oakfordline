import * as THREE from 'three';
import './style.css';
import { buildWorld } from './world.js';
import { Player } from './player.js';

const canvas = document.getElementById('scene');
const overlay = document.getElementById('overlay');
const startButton = document.getElementById('start');
const crosshair = document.getElementById('crosshair');
const hint = document.getElementById('hint');

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

function enterGame() {
  overlay.classList.add('hidden');
  crosshair.classList.add('visible');
}

startButton.addEventListener('click', () => player.lock());
player.controls.addEventListener('lock', enterGame);

player.controls.addEventListener('unlock', () => {
  if (player.dragLook) return;
  overlay.classList.remove('hidden');
  crosshair.classList.remove('visible');
});

// Some embedded browsers refuse pointer lock outright. Rather than leaving the
// start button looking broken, fall back to drag-to-look and say so.
document.addEventListener('pointerlockerror', () => {
  player.enableDragLook(renderer.domElement);
  enterGame();
  hint.textContent =
    'Pointer lock unavailable here - hold the left mouse button and drag to look.';
  hint.classList.add('visible');
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

if (import.meta.env.DEV) {
  window.game = { scene, camera, renderer, player };
}

const clock = new THREE.Clock();

renderer.setAnimationLoop(() => {
  // Clamp so a backgrounded tab does not teleport the player on return.
  player.update(Math.min(clock.getDelta(), 0.1));
  renderer.render(scene, camera);
});
