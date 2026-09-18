import * as THREE from 'three';
import './style.css';

// Blank-slate starting point for Level Crossing Controller. Reuses this
// repo's own three.js install (see the note in levelcrossingcontroller's
// section of CLAUDE.md) rather than a separate project with its own
// node_modules - there is no gameplay here yet, just a working scene to
// build on.

const canvas = document.getElementById('scene');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0e13);

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.set(3, 2.5, 5);
camera.lookAt(0, 0.5, 0);

scene.add(new THREE.HemisphereLight(0xffffff, 0x222222, 1.2));
const sun = new THREE.DirectionalLight(0xffffff, 1.4);
sun.position.set(4, 6, 3);
scene.add(sun);

// A boom-shaped placeholder so the scene reads as "a level crossing thing",
// not an empty room - swap for real geometry once the game takes shape.
const boom = new THREE.Mesh(
  new THREE.BoxGeometry(2, 0.15, 0.15),
  new THREE.MeshStandardMaterial({ color: 0xc0392b })
);
boom.position.y = 0.5;
scene.add(boom);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

renderer.setAnimationLoop((time) => {
  boom.rotation.z = Math.sin(time / 1000) * 0.3;
  renderer.render(scene, camera);
});
