import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

const EYE_HEIGHT = 1.7;
const WALK_SPEED = 4.5;
const RUN_SPEED = 8.0;
const ACCELERATION = 12.0;
const DAMPING = 10.0;
const BOUNDS = 190;

export class Player {
  constructor(camera, domElement) {
    this.controls = new PointerLockControls(camera, domElement);
    this.controls.object.position.set(12, EYE_HEIGHT, 20);

    this.velocity = new THREE.Vector3();
    this.direction = new THREE.Vector3();
    this.keys = new Set();

    this._onKeyDown = (event) => {
      this.keys.add(event.code);
      // Stop the page scrolling behind the canvas while playing.
      if (event.code === 'Space') event.preventDefault();
    };
    this._onKeyUp = (event) => this.keys.delete(event.code);
    this._onBlur = () => this.keys.clear();

    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
  }

  get object() {
    return this.controls.object;
  }

  get isLocked() {
    return this.controls.isLocked;
  }

  lock() {
    this.controls.lock();
  }

  update(delta) {
    // Exponential damping, framerate independent.
    const damping = Math.exp(-DAMPING * delta) - 1;
    this.velocity.x += this.velocity.x * damping;
    this.velocity.z += this.velocity.z * damping;

    if (this.controls.isLocked) {
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

        this.velocity.z += this.direction.z * ACCELERATION * speed * delta;
        this.velocity.x += this.direction.x * ACCELERATION * speed * delta;
      }
    }

    this.controls.moveRight(this.velocity.x * delta);
    this.controls.moveForward(this.velocity.z * delta);

    // Keep the player on the ground plane and inside the world.
    const position = this.controls.object.position;
    position.y = EYE_HEIGHT;
    position.x = THREE.MathUtils.clamp(position.x, -BOUNDS, BOUNDS);
    position.z = THREE.MathUtils.clamp(position.z, -BOUNDS, BOUNDS);
  }

  dispose() {
    document.removeEventListener('keydown', this._onKeyDown);
    document.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
    this.controls.dispose();
  }
}
