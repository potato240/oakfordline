import * as THREE from 'three';

// A rideable bicycle, parked out in the world. Unlike the train seats
// (Player pins to a spot the train carries) riding this one is player-driven:
// W/S throttle and A/D steer a small heading+speed model, the same shape as
// BranchTrain's own distance/heading state but driven by input instead of a
// timetable.

const WHEEL_RADIUS = 0.33;
const WHEELBASE = 1.05;
const FRAME_HEIGHT = 0.55;

const MAX_SPEED = 9; // m/s - faster than the player's own run speed (8)
const REVERSE_SPEED = 2.5;
const ACCELERATION = 4.5;
const FRICTION_DECEL = 2.5; // coasting to a stop with no throttle held
const TURN_RATE = 2.2; // rad/s at full steer and full speed

const RIDE_RADIUS = 0.45; // collision circle while ridden
export const MOUNT_REACH = 1.7;

const materials = {
  frame: new THREE.MeshStandardMaterial({ color: 0xb43b2f, roughness: 0.6, metalness: 0.2 }),
  wheel: new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.85 }),
  hub: new THREE.MeshStandardMaterial({ color: 0xaaaaaa, roughness: 0.4, metalness: 0.6 }),
  seat: new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.85 }),
  grip: new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.85 }),
};

// A cylinder stretched and oriented to join two points - the frame tubes are
// built from a handful of these rather than one bespoke shape, the same way
// the telegraph poles' cross-arms reuse a single box.
function cylinderBetween(a, b, radius) {
  const start = new THREE.Vector3(...a);
  const end = new THREE.Vector3(...b);
  const direction = new THREE.Vector3().subVectors(end, start);
  const length = direction.length();

  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, 8),
    materials.frame
  );
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  mesh.castShadow = true;
  return mesh;
}

// The frame is a diamond of tubes between five points - bottom bracket, the
// two axles, the seat and the head tube - the same skeleton a real bike's
// frame is built from, just five cylinders instead of welded tubing.
function buildBikeGroup() {
  const group = new THREE.Group();
  group.name = 'bike';

  const wheels = [];
  for (const z of [WHEELBASE / 2, -WHEELBASE / 2]) {
    const wheelGroup = new THREE.Group();

    const tire = new THREE.Mesh(new THREE.TorusGeometry(WHEEL_RADIUS, 0.045, 8, 16), materials.wheel);
    // TorusGeometry's hole runs along Z by default; rotating it onto X makes
    // the ring stand upright facing sideways, so it rolls forward along Z
    // when this whole group later spins about its own local X axis.
    tire.rotation.y = Math.PI / 2;
    tire.castShadow = true;
    wheelGroup.add(tire);

    const hub = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), materials.hub);
    wheelGroup.add(hub);

    wheelGroup.position.set(0, WHEEL_RADIUS, z);
    group.add(wheelGroup);
    wheels.push(wheelGroup);
  }

  const rearAxle = [0, WHEEL_RADIUS, WHEELBASE / 2];
  const frontAxle = [0, WHEEL_RADIUS, -WHEELBASE / 2];
  const bottomBracket = [0, WHEEL_RADIUS + 0.05, -0.05];
  const seatPoint = [0, FRAME_HEIGHT + 0.3, WHEELBASE / 2 - 0.2];
  const headTube = [0, FRAME_HEIGHT + 0.2, -WHEELBASE / 2 + 0.08];

  const tube = 0.035;
  group.add(cylinderBetween(bottomBracket, seatPoint, tube)); // seat tube
  group.add(cylinderBetween(seatPoint, headTube, tube)); // top tube
  group.add(cylinderBetween(headTube, frontAxle, tube)); // fork
  group.add(cylinderBetween(bottomBracket, rearAxle, tube)); // chain stay
  group.add(cylinderBetween(bottomBracket, headTube, tube)); // down tube

  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.28), materials.seat);
  seat.position.set(seatPoint[0], seatPoint[1] + 0.06, seatPoint[2]);
  seat.castShadow = true;
  group.add(seat);

  const handlebarY = headTube[1] + 0.2;
  const handlebarZ = headTube[2] - 0.05;
  group.add(cylinderBetween(headTube, [headTube[0], handlebarY, handlebarZ], tube * 0.8)); // steerer

  const handlebar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.03, 0.03), materials.grip);
  handlebar.position.set(0, handlebarY, handlebarZ);
  handlebar.castShadow = true;
  group.add(handlebar);

  return { group, wheels };
}

export class Bike {
  constructor(x, z, heading = 0) {
    this.x = x;
    this.z = z;
    this.heading = heading;
    this.speed = 0;

    const built = buildBikeGroup();
    this.group = built.group;
    this.wheels = built.wheels;
    this.applyTransform();
  }

  applyTransform() {
    this.group.position.set(this.x, 0, this.z);
    this.group.rotation.y = this.heading;
  }

  distanceTo(x, z) {
    return Math.hypot(x - this.x, z - this.z);
  }

  // World XZ of the saddle - where the camera pins to while ridden. Offset
  // slightly forward of the frame's own pivot so the rider's eye sits over
  // the seat rather than dead centre of the bike.
  riderPosition() {
    const forward = -0.12;
    return {
      x: this.x + Math.sin(this.heading) * forward,
      z: this.z - Math.cos(this.heading) * forward,
    };
  }

  // throttle/steer are -1..1 (S/W and A/D). Reuses the world's own Colliders
  // instance so a ridden bike bumps into the same benches, columns and walls
  // a walking player would, rather than passing through them.
  update(delta, throttle, steer, colliders) {
    if (throttle > 0) {
      this.speed = Math.min(MAX_SPEED, this.speed + ACCELERATION * delta);
    } else if (throttle < 0) {
      this.speed = Math.max(-REVERSE_SPEED, this.speed - ACCELERATION * delta);
    } else if (this.speed > 0) {
      this.speed = Math.max(0, this.speed - FRICTION_DECEL * delta);
    } else if (this.speed < 0) {
      this.speed = Math.min(0, this.speed + FRICTION_DECEL * delta);
    }

    // A real bike cannot turn on the spot - steering is scaled by speed so it
    // barely bites while nearly stopped and bites fully once moving.
    const steerStrength = THREE.MathUtils.clamp(Math.abs(this.speed) / 2.5, 0.2, 1);
    this.heading += steer * TURN_RATE * steerStrength * delta;

    // Same heading convention as RailPath/BranchTrain: rotation.y = 0 faces
    // -Z, so (sin heading, -cos heading) is the unit forward vector.
    const dirX = Math.sin(this.heading);
    const dirZ = -Math.cos(this.heading);
    const point = {
      x: this.x + dirX * this.speed * delta,
      z: this.z + dirZ * this.speed * delta,
    };

    if (colliders) colliders.resolve(point, RIDE_RADIUS, 0.1, 2.0);

    this.x = point.x;
    this.z = point.z;
    this.applyTransform();

    if (Math.abs(this.speed) > 0.01) {
      const spin = (this.speed * delta) / WHEEL_RADIUS;
      for (const wheel of this.wheels) wheel.rotation.x += spin;
    }
  }
}
