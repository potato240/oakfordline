import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

const EYE_HEIGHT = 1.7;
const WALK_SPEED = 4.5;
const RUN_SPEED = 8.0;
const ACCELERATION = 12.0;
const DAMPING = 10.0;
const BOUNDS = 2250;
const LOOK_SENSITIVITY = 0.002;
const PLAYER_RADIUS = 0.34;
// Spawn standing on the platform deck.
const PLATFORM_EYE = 1.0 + EYE_HEIGHT;

export class Player {
  constructor(camera, domElement, heightAt = () => 0, colliders = null) {
    this.colliders = colliders;
    // Returns the standing surface height at a world position, so the player
    // walks up onto the platform rather than through it.
    this.heightAt = heightAt;

    this.controls = new PointerLockControls(camera, domElement);
    this.controls.object.position.set(5.6, PLATFORM_EYE, 22);

    this.velocity = new THREE.Vector3();
    this.direction = new THREE.Vector3();
    this.keys = new Set();

    // Enabled when the browser refuses pointer lock; see enableDragLook.
    this.dragLook = false;
    this.euler = new THREE.Euler(0, 0, 0, 'YXZ');

    // Set while sitting: { x, eyeY, getWorldZ() }. Movement is suspended and
    // position is pinned to the seat (which itself tracks the moving train)
    // until standUp() is called or the player presses a movement key.
    this.seat = null;

    // Set while riding: a Bike instance. Unlike sitting, movement is not
    // suspended - WASD drives the bike's own throttle/steer model instead of
    // the player's normal camera-relative walk.
    this.bike = null;

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

  sitAt(seat) {
    this.seat = seat;
    this.velocity.set(0, 0, 0);
  }

  standUp() {
    this.seat = null;
  }

  get isSeated() {
    return this.seat !== null;
  }

  mountBike(bike) {
    this.bike = bike;
    this.velocity.set(0, 0, 0);
  }

  // Steps off wherever the bike currently is, to one side of it rather than
  // on top of where it is still parked.
  dismountBike() {
    if (!this.bike) return;
    const bike = this.bike;
    this.bike = null;
    bike.speed = 0;

    // Perpendicular to the bike's own heading - see Bike.update()'s forward
    // vector, this is that rotated 90 degrees.
    const asideX = bike.x + Math.cos(bike.heading) * 0.9;
    const asideZ = bike.z + Math.sin(bike.heading) * 0.9;
    const position = this.controls.object.position;
    position.x = asideX;
    position.z = asideZ;
    position.y = this.heightAt(asideX, asideZ) + EYE_HEIGHT;
  }

  get isOnBike() {
    return this.bike !== null;
  }

  // Instant relocation for the teleport menu. Sets height immediately (from
  // the same heightAt() the normal per-frame update uses) so there is no
  // one-frame drop through the old surface before the next update() call
  // corrects it anyway.
  teleportTo(x, z) {
    this.seat = null;
    this.velocity.set(0, 0, 0);
    const position = this.controls.object.position;
    position.x = x;
    position.z = z;
    position.y = this.heightAt(x, z) + EYE_HEIGHT;
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
    if (this.bike) {
      const forward =
        Number(this.keys.has('KeyW') || this.keys.has('ArrowUp')) -
        Number(this.keys.has('KeyS') || this.keys.has('ArrowDown'));
      const steer =
        Number(this.keys.has('KeyD') || this.keys.has('ArrowRight')) -
        Number(this.keys.has('KeyA') || this.keys.has('ArrowLeft'));

      // Gated on isActive the same way walking is - no input reaches the
      // bike while the pointer is unlocked (paused, or the teleport menu).
      const throttle = this.isActive ? forward : 0;
      const turn = this.isActive ? steer : 0;
      this.bike.update(delta, throttle, turn, this.colliders);

      const rider = this.bike.riderPosition();
      const position = this.controls.object.position;
      position.set(rider.x, this.heightAt(rider.x, rider.z) + EYE_HEIGHT, rider.z);
      return;
    }

    if (this.seat) {
      // Standing up on any movement key is a deliberate convenience - most
      // players will try to just walk away rather than hunt for a key.
      const tryingToMove =
        this.keys.has('KeyW') || this.keys.has('KeyA') ||
        this.keys.has('KeyS') || this.keys.has('KeyD') ||
        this.keys.has('ArrowUp') || this.keys.has('ArrowDown') ||
        this.keys.has('ArrowLeft') || this.keys.has('ArrowRight');

      if (tryingToMove) {
        this.standUp();
      } else {
        const position = this.controls.object.position;
        position.set(this.seat.x, this.seat.eyeY, this.seat.getWorldZ());
        return;
      }
    }

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

    const position = this.controls.object.position;

    // Push out of anything solid before settling on a standing height, using
    // last frame's height to bound the player vertically.
    if (this.colliders) {
      const feet = position.y - EYE_HEIGHT;
      this.colliders.resolve(position, PLAYER_RADIUS, feet, feet + EYE_HEIGHT);
    }

    // Stand on whatever surface is underfoot, and keep inside the world.
    position.y = this.heightAt(position.x, position.z) + EYE_HEIGHT;
    position.x = THREE.MathUtils.clamp(position.x, -BOUNDS, BOUNDS);
    position.z = THREE.MathUtils.clamp(position.z, -BOUNDS, BOUNDS);
  }
}
