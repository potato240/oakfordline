import * as THREE from 'three';
import './style.css';
import { Game } from './game.js';
import { startAudio } from './audio.js';

const canvas = document.getElementById('scene');
const overlay = document.getElementById('overlay');
const startButton = document.getElementById('start');
const hud = document.getElementById('hud');
const scoreEl = document.getElementById('score');
const barrierStatusEl = document.getElementById('barrier-status');
const warningBanner = document.getElementById('warning-banner');
const barrierButton = document.getElementById('barrier-btn');
const gameOverEl = document.getElementById('gameover');
const finalScoreEl = document.getElementById('final-score');
const restartButton = document.getElementById('restart');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const game = new Game();
game.camera.aspect = window.innerWidth / window.innerHeight;
game.camera.updateProjectionMatrix();

window.addEventListener('resize', () => {
  game.camera.aspect = window.innerWidth / window.innerHeight;
  game.camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

let started = false;

function beginGame() {
  // Audio can only start from a user gesture, which this is downstream of.
  startAudio();
  overlay.classList.add('hidden');
  hud.classList.add('visible');
  barrierButton.classList.add('visible');
  started = true;
}

startButton.addEventListener('click', beginGame);

function toggleBarrier() {
  if (!started) return;
  game.toggleBarrier();
}

barrierButton.addEventListener('click', toggleBarrier);

function restart() {
  game.reset();
  gameOverEl.classList.add('hidden');
  hud.classList.add('visible');
  barrierButton.classList.add('visible');
}

restartButton.addEventListener('click', restart);

document.addEventListener('keydown', (event) => {
  if (event.code === 'Space') {
    event.preventDefault();
    if (game.gameOver) restart();
    else toggleBarrier();
  } else if (event.code === 'KeyR' && game.gameOver) {
    restart();
  }
});

if (import.meta.env.DEV) {
  window.game = game;
}

const clock = new THREE.Clock();
let wasGameOver = false;

renderer.setAnimationLoop(() => {
  const delta = Math.min(clock.getDelta(), 0.1);

  if (started) game.update(delta);

  scoreEl.textContent = `Score: ${game.score}`;
  barrierStatusEl.textContent = `Barrier: ${game.barrierTarget ? 'DOWN' : 'UP'}`;
  barrierButton.textContent = game.barrierTarget
    ? 'Raise Barrier (Space)'
    : 'Lower Barrier (Space)';
  warningBanner.classList.toggle('visible', game.warningActive && !game.gameOver);

  if (game.gameOver && !wasGameOver) {
    finalScoreEl.textContent = `Final score: ${game.score}`;
    gameOverEl.classList.remove('hidden');
    hud.classList.remove('visible');
    barrierButton.classList.remove('visible');
  }
  wasGameOver = game.gameOver;

  renderer.render(game.scene, game.camera);
});
