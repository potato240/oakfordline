import * as THREE from 'three';
import {
  WORLD_HALF_X,
  WORLD_HALF_Z,
  TRAIN_WIDTH,
  CAR_LENGTH,
  CAR_WIDTH,
} from './constants.js';

const trainMaterial = new THREE.MeshStandardMaterial({ color: 0x2f6b3f, roughness: 0.6 });
const trainCabMaterial = new THREE.MeshStandardMaterial({ color: 0xe8c317, roughness: 0.5 });

const carPalette = [0xc0392b, 0x2874a6, 0xd68910, 0x7d3c98, 0x1e8449, 0xb03a2e];
let carColourIndex = 0;

// A train travelling along X at constant speed - `direction` is +1 (moving
// toward +X, spawned on the west edge) or -1 (spawned on the east edge).
export class Train {
  constructor(direction, length, speed) {
    this.direction = direction;
    this.length = length;
    this.halfLength = length / 2;
    this.speed = speed;
    this.x = direction > 0 ? -WORLD_HALF_X - length : WORLD_HALF_X + length;
    this.dangerZoneHadCar = false; // for the clean-pass score bonus

    this.group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(length, 1.6, TRAIN_WIDTH),
      trainMaterial
    );
    body.position.y = 1.0;
    body.castShadow = true;
    this.group.add(body);

    const cab = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 1.7, TRAIN_WIDTH + 0.1),
      trainCabMaterial
    );
    cab.position.set(direction * (length / 2 - 0.7), 1.05, 0);
    cab.castShadow = true;
    this.group.add(cab);

    this.applyPosition();
  }

  applyPosition() {
    this.group.position.x = this.x;
  }

  // Signed distance the train's leading edge still has to travel to reach
  // the danger zone's near edge, in its own direction of travel - positive
  // while still approaching, zero right at the edge, and *negative* once
  // the train has already passed it. That negative case matters: it is
  // what lets a caller tell "about to arrive" (small positive) apart from
  // "already went through, ignore me" (negative) - collapsing both to 0
  // (an earlier version of this did) made a train that had already cleared
  // the zone read as permanently imminent for its entire, much longer coast
  // out to the despawn point far beyond it, which kept the crossing's
  // warning - and so the barrier - stuck on long after the real danger had
  // passed.
  distanceToZone(zoneHalfWidth) {
    const zoneEdge = -this.direction * zoneHalfWidth;
    const leadingEdge = this.x + this.direction * this.halfLength;
    return this.direction * (zoneEdge - leadingEdge);
  }

  occupiesZone(zoneHalfWidth) {
    return this.x - this.halfLength < zoneHalfWidth && this.x + this.halfLength > -zoneHalfWidth;
  }

  isOffscreen() {
    return this.direction > 0
      ? this.x - this.halfLength > WORLD_HALF_X + 15
      : this.x + this.halfLength < -WORLD_HALF_X - 15;
  }

  update(delta) {
    this.x += this.direction * this.speed * delta;
    this.applyPosition();
  }
}

// A car travelling along Z in its own lane - `direction` +1 moves toward +Z
// (spawned south, lane offset +LANE_OFFSET), -1 moves toward -Z (spawned
// north, lane offset -LANE_OFFSET). Movement is a simple positional clamp
// each frame rather than force/acceleration - enough for arcade traffic.
export class Car {
  constructor(direction, laneX) {
    this.direction = direction;
    this.laneX = laneX;
    this.z = direction > 0 ? -WORLD_HALF_Z - 5 : WORLD_HALF_Z + 5;
    this.committed = false; // once true, this car no longer stops for the barrier

    const colour = carPalette[carColourIndex % carPalette.length];
    carColourIndex++;

    this.group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(CAR_WIDTH, 0.7, CAR_LENGTH),
      new THREE.MeshStandardMaterial({ color: colour, roughness: 0.5 })
    );
    body.position.y = 0.45;
    body.castShadow = true;
    this.group.add(body);

    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(CAR_WIDTH * 0.75, 0.4, CAR_LENGTH * 0.55),
      new THREE.MeshStandardMaterial({ color: 0x1b2a33, roughness: 0.3 })
    );
    cabin.position.y = 0.92;
    cabin.castShadow = true;
    this.group.add(cabin);

    this.applyPosition();
  }

  applyPosition() {
    this.group.position.set(this.laneX, 0, this.z);
  }

  get halfLength() {
    return CAR_LENGTH / 2;
  }

  occupiesZone(zoneHalfWidth) {
    return this.z - this.halfLength < zoneHalfWidth && this.z + this.halfLength > -zoneHalfWidth;
  }

  isOffscreen() {
    return this.direction > 0
      ? this.z - this.halfLength > WORLD_HALF_Z + 10
      : this.z + this.halfLength < -WORLD_HALF_Z - 10;
  }
}
