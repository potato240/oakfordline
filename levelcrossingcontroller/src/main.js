import * as THREE from 'three';
import './style.css';
import { Game } from './game.js';
import { startAudio } from './audio.js';
import {
  BARRIER_TYPES,
  LIGHT_STYLES,
  TRACK_COUNTS,
  SURROUNDINGS,
  loadSettings,
  saveSettings,
} from './settings.js';

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
const changeSettingsButton = document.getElementById('change-settings');

const barrierSelect = document.getElementById('setting-barrier');
const lightsSelect = document.getElementById('setting-lights');
const tracksSelect = document.getElementById('setting-tracks');
const surroundingsSelect = document.getElementById('setting-surroundings');

// Build each <select>'s options straight from settings.js's lists, so a new
// option added there needs no changes here.
function fillSelect(select, options, toValue = (o) => o.value, toLabel = (o) => o.label) {
  select.innerHTML = '';
  for (const option of options) {
    const el = document.createElement('option');
    el.value = String(toValue(option));
    el.textContent = toLabel(option);
    select.appendChild(el);
  }
}

fillSelect(barrierSelect, BARRIER_TYPES);
fillSelect(lightsSelect, LIGHT_STYLES);
fillSelect(
  tracksSelect,
  TRACK_COUNTS,
  (n) => n,
  (n) => `${n} track${n === 1 ? '' : 's'}`
);
fillSelect(surroundingsSelect, SURROUNDINGS);

function applySettingsToSelects(settings) {
  barrierSelect.value = settings.barrierType;
  lightsSelect.value = settings.lightStyle;
  tracksSelect.value = String(settings.trackCount);
  surroundingsSelect.value = settings.surroundings;
}

function readSettingsFromSelects() {
  return {
    barrierType: barrierSelect.value,
    lightStyle: lightsSelect.value,
    trackCount: Number(tracksSelect.value),
    surroundings: surroundingsSelect.value,
  };
}

applySettingsToSelects(loadSettings());

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// Rebuilt from scratch by beginGame() whenever the player (re)starts - a
// settings change only actually takes effect on a fresh Game, since the
// scene it builds (track count, barrier/light geometry, surroundings) is
// not something an existing Game can rebuild in place. This first instance
// is just something to render behind the very first start screen.
let game = new Game(loadSettings());
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

  const settings = readSettingsFromSelects();
  saveSettings(settings);
  game = new Game(settings);
  game.camera.aspect = window.innerWidth / window.innerHeight;
  game.camera.updateProjectionMatrix();
  if (import.meta.env.DEV) window.game = game;

  overlay.classList.add('hidden');
  gameOverEl.classList.add('hidden');
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

changeSettingsButton.addEventListener('click', () => {
  started = false;
  gameOverEl.classList.add('hidden');
  hud.classList.remove('visible');
  barrierButton.classList.remove('visible');
  overlay.classList.remove('hidden');
});

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
