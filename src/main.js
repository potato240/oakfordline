import * as THREE from 'three';
import './style.css';
import { buildWorld } from './world.js';
import { Player } from './player.js';
import { startAudio } from './audio.js';
import { PlayerBody } from './body.js';

const canvas = document.getElementById('scene');
const overlay = document.getElementById('overlay');
const startButton = document.getElementById('start');
const crosshair = document.getElementById('crosshair');
const hint = document.getElementById('hint');
const status = document.getElementById('status');
const interact = document.getElementById('interact');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const camera = new THREE.PerspectiveCamera(
  70,
  window.innerWidth / window.innerHeight,
  0.1,
  6000
);

const { scene, heightAt, train, crossings, footCrossings, colliders, seats } = buildWorld();
const player = new Player(camera, renderer.domElement, heightAt, colliders);
scene.add(player.object);

const body = new PlayerBody(camera);
scene.add(body.group);
const bodyEuler = new THREE.Euler(0, 0, 0, 'YXZ');

// Look slightly across the track so the train is in shot on load. The camera
// already faces -Z by default, which is down the platform towards the train.
camera.rotation.y = 0.35;

function enterGame() {
  // Audio can only start from a user gesture, which this is downstream of.
  startAudio();
  overlay.classList.add('hidden');
  crosshair.classList.add('visible');
  status.classList.add('visible');
}

startButton.addEventListener('click', () => {
  startAudio();
  player.lock();
});
player.controls.addEventListener('lock', () => {
  lockFailures = 0;
  enterGame();
});

player.controls.addEventListener('unlock', () => {
  if (player.dragLook) return;
  overlay.classList.remove('hidden');
  crosshair.classList.remove('visible');
});

// Real browsers can reject a pointer lock request for reasons that have
// nothing to do with support - most commonly, Chrome enforces a short
// cooldown (~1.25s) after Escape is pressed to exit a lock, and rejects any
// new request made inside that window. Treating the very first failure as
// permanent used to lock a player into drag-look for the rest of the session
// over what was often just bad timing. Only genuinely unsupported
// environments (the embedded preview pane included) fail on every attempt,
// so only give up after a second consecutive failure - the overlay and
// button stay up in between, so retrying is just clicking Play again.
let lockFailures = 0;

document.addEventListener('pointerlockerror', () => {
  lockFailures++;
  if (lockFailures < 2) return;

  player.enableDragLook(renderer.domElement);
  enterGame();
  hint.textContent =
    'Pointer lock unavailable here - hold the left mouse button and drag to look.';
  hint.classList.add('visible');
});

const SEAT_REACH = 1.3;
let nearestSeat = null;

document.addEventListener('keydown', (event) => {
  if (event.code !== 'KeyE' || !player.isActive) return;

  if (player.isSeated) {
    player.standUp();
  } else if (nearestSeat) {
    player.sitAt(nearestSeat);
  }
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

if (import.meta.env.DEV) {
  window.game = { scene, camera, renderer, player, train, crossings, footCrossings, colliders, body, seats };
}

const sky = scene.getObjectByName('sky');

const clock = new THREE.Clock();
let wasAboard = false;

renderer.setAnimationLoop(() => {
  // Clamp so a backgrounded tab does not teleport the player on return.
  const delta = Math.min(clock.getDelta(), 0.1);

  const position = player.object.position;

  // Test before the train moves, so a passenger is carried along with the
  // floor they are standing on instead of being left a frame behind.
  const aboard = train.contains(position.x, position.z);
  const travelled = train.update(delta, position);
  if (aboard) position.z += travelled;

  // Measure the player's own movement, after any ride on the train, so the
  // walk cycle does not animate while standing still in a moving carriage.
  const previousX = position.x;
  const previousZ = position.z;

  player.update(delta);

  const stepped = Math.hypot(position.x - previousX, position.z - previousZ);
  bodyEuler.setFromQuaternion(camera.quaternion);
  body.update(position, bodyEuler.y, stepped, delta);

  for (const crossing of crossings) crossing.update(delta, train, position);
  // Reads state the crossings above already computed this frame - no own
  // timers, no train/player args needed.
  for (const footCrossing of footCrossings) footCrossing.update();

  // Find the closest seat in reach, for the "Press E to sit" prompt and for
  // KeyE to act on. Skipped entirely while already seated - standing up is
  // handled directly by player.isSeated in the keydown listener.
  if (player.isSeated) {
    nearestSeat = null;
    interact.textContent = 'Press E to stand';
    interact.classList.add('visible');
  } else {
    let closest = null;
    let closestDistSq = SEAT_REACH * SEAT_REACH;
    for (const seat of seats) {
      const dx = position.x - seat.x;
      const dz = position.z - seat.getWorldZ();
      const distSq = dx * dx + dz * dz;
      if (distSq < closestDistSq) {
        closestDistSq = distSq;
        closest = seat;
      }
    }
    nearestSeat = closest;

    if (nearestSeat) {
      interact.textContent = 'Press E to sit';
      interact.classList.add('visible');
    } else {
      interact.classList.remove('visible');
    }
  }

  if (aboard !== wasAboard) {
    hint.textContent = aboard ? 'On board' : 'On the platform';
    hint.classList.add('visible');
    wasAboard = aboard;
  }

  status.textContent = train.status();

  // Keep the sky dome centred on the player: a fixed dome eventually falls
  // outside the far plane and gets clipped to the clear colour, which reads as
  // a huge black hole tracking the middle of the screen.
  sky.position.copy(camera.position);

  renderer.render(scene, camera);
});
