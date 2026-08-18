import * as THREE from 'three';
import './style.css';
import { buildWorld } from './world.js';
import { Player } from './player.js';

const canvas = document.getElementById('scene');
const overlay = document.getElementById('overlay');
const startButton = document.getElementById('start');
const crosshair = document.getElementById('crosshair');
const hint = document.getElementById('hint');
const status = document.getElementById('status');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const camera = new THREE.PerspectiveCamera(
  70,
  window.innerWidth / window.innerHeight,
  0.1,
  3000
);

const { scene, heightAt, train } = buildWorld();
const player = new Player(camera, renderer.domElement, heightAt);
scene.add(player.object);

// Look slightly across the track so the train is in shot on load. The camera
// already faces -Z by default, which is down the platform towards the train.
camera.rotation.y = 0.35;

function enterGame() {
  overlay.classList.add('hidden');
  crosshair.classList.add('visible');
  status.classList.add('visible');
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
  window.game = { scene, camera, renderer, player, train };
}

const clock = new THREE.Clock();
let wasAboard = false;

renderer.setAnimationLoop(() => {
  // Clamp so a backgrounded tab does not teleport the player on return.
  const delta = Math.min(clock.getDelta(), 0.1);

  const position = player.object.position;

  // Test before the train moves, so a passenger is carried along with the
  // floor they are standing on instead of being left a frame behind.
  const aboard = train.contains(position.x, position.z);
  const travelled = train.update(delta);
  if (aboard) position.z += travelled;

  player.update(delta);

  if (aboard !== wasAboard) {
    hint.textContent = aboard ? 'On board' : 'On the platform';
    hint.classList.add('visible');
    wasAboard = aboard;
  }

  status.textContent = train.status();

  renderer.render(scene, camera);
});
