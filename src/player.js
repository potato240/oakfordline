import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

const EYE_HEIGHT = 1.7;
const WALK_SPEED = 4.5;
const RUN_SPEED = 8.0;
const ACCELERATION = 12.0;
const DAMPING = 10.0;
const BOUNDS = 190;
const LOOK_SENSITIVITY = 0.002;

export class Player {
  constructor(camera, domElement) {
    this.controls = new PointerLockControls(camera, domElement);
    this.controls.object.position.set(12, EYE_HEIGHT, 20);

    this.velocity = new THREE.Vector3();
    this.direction = new THREE.Vector3();
    this.keys = new Set();

    // Enabled when the browser refuses pointer lock; see enableDragLook.
    this.dragLook = false;
    this.euler = new THREE.Euler(0, 0, 0, 'YXZ');

    document.addEventListener('keydown', (event) => this.keys.add(event.code));
    document.addEventListener('keyup', (event) => this.keys.delete(event.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  get object() {
    return this.controls.object;
  }

  // True when the player is steering the camera by either input method.
  get isActive() {
    return this.controls.isLocked || this.dragLook;
  }

  lock() {
    this.controls.lock();
  }

  // Fallback for browsers that reject pointer lock: hold left button and drag.
  enableDragLook(domElement) {
    if (this.dragLook) return;
    this.dragLook = true;

    let dragging = false;

    domElement.addEventListener('pointerdown', (event) => {
      dragging = true;
      domElement.setPointerCapture(event.pointerId);
    });

    const stop = () => {
      dragging = false;
    };
    domElement.addEventListener('pointerup', stop);
    domElement.addEventListener('pointercancel', stop);

    domElement.addEventListener('pointermove', (event) => {
      if (!dragging) return;

      const camera = this.controls.object;
      this.euler.setFromQuaternion(camera.quaternion);
      this.euler.y -= event.movementX * LOOK_SENSITIVITY;
      this.euler.x -= event.movementY * LOOK_SENSITIVITY;
      // Clamp pitch so the camera never rolls over at the poles.
      this.euler.x = THREE.MathUtils.clamp(this.euler.x, -Math.PI / 2, Math.PI / 2);
      camera.quaternion.setFromEuler(this.euler);
    });
  }

  update(delta) {
    // Exponential damping, independent of framerate.
    const damping = Math.exp(-DAMPING * delta) - 1;
    this.velocity.x += this.velocity.x * damping;
    this.velocity.z += this.velocity.z * damping;

    if (this.isActive) {
      const forward =
        Number(this.keys.has('KeyW') || this.keys.has('ArrowUp')) -
        Number(this.keys.has('KeyS') || this.keys.has('ArrowDown'));
      const strafe =
        Number(this.keys.has('KeyD') || this.keys.has('ArrowRight')) -
        Number(this.keys.has('KeyA') || this.keys.has('ArrowLeft'));

      this.direction.set(strafe, 0, forward);

      if (this.direction.lengthSq() > 0) {
        this.direction.normalize();

        const running = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
        const speed = running ? RUN_SPEED : WALK_SPEED;

        this.velocity.x += this.direction.x * ACCELERATION * speed * delta;
        this.velocity.z += this.direction.z * ACCELERATION * speed * delta;
      }
    }

    this.controls.moveRight(this.velocity.x * delta);
    this.controls.moveForward(this.velocity.z * delta);

    // Pin to the ground plane and keep the player inside the world.
    const position = this.controls.object.position;
    position.y = EYE_HEIGHT;
    position.x = THREE.MathUtils.clamp(position.x, -BOUNDS, BOUNDS);
    position.z = THREE.MathUtils.clamp(position.z, -BOUNDS, BOUNDS);
  }
}
