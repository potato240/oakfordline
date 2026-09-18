import * as THREE from 'three';
import { buildScene } from './scene.js';
import { Train, Car } from './entities.js';
import { playWarningDing, playCrash } from './audio.js';
import {
  ROAD_HALF_WIDTH,
  TRACK_HALF_WIDTH,
  STOP_LINE_MARGIN,
  LANE_OFFSET,
  CAR_MIN_GAP,
  CAR_SPEED,
  TRAIN_MIN_LENGTH,
  TRAIN_MAX_LENGTH,
  TRAIN_MIN_SPEED,
  TRAIN_MAX_SPEED,
  BARRIER_SECONDS,
  FLASH_INTERVAL,
  WARNING_LEAD_TIME,
  RAMP_SECONDS,
  TRAIN_INTERVAL_MIN,
  TRAIN_INTERVAL_MAX,
  CAR_INTERVAL_START,
  CAR_INTERVAL_MIN,
  MAX_CARS,
} from './constants.js';

// Owns every piece of live state - the scene is built once in the
// constructor and reused; reset() (also called by the constructor) clears
// everything else so a restart never needs a fresh Game or a page reload.
export class Game {
  constructor() {
    const { scene, camera, lamps, barrierPivots, reachDirections } = buildScene();
    this.scene = scene;
    this.camera = camera;
    this.lamps = lamps;
    this.barrierPivots = barrierPivots;
    this.reachDirections = reachDirections;

    this.reset();
  }

  reset() {
    for (const train of this.trains ?? []) this.scene.remove(train.group);
    for (const car of this.cars ?? []) this.scene.remove(car.group);

    this.trains = [];
    this.cars = [];
    this.score = 0;
    this.elapsed = 0;
    this.gameOver = false;

    this.barrierTarget = 0; // 0 raised, 1 lowered - what the player has commanded
    this.lowered = 0; // 0..1, how far down the booms actually are right now
    this.flashTimer = 0;
    this.flashState = 0;
    this.warningActive = false;

    this.trainTimer = 3;
    this.carTimer = 1.5;

    this.updateBarrier(0);
    this.setLamps(false);
  }

  toggleBarrier() {
    if (this.gameOver) return;
    this.barrierTarget = this.barrierTarget > 0 ? 0 : 1;
  }

  currentCarInterval() {
    const t = Math.min(1, this.elapsed / RAMP_SECONDS);
    return THREE.MathUtils.lerp(CAR_INTERVAL_START, CAR_INTERVAL_MIN, t);
  }

  spawnTrain() {
    const direction = Math.random() < 0.5 ? 1 : -1;
    const length = THREE.MathUtils.lerp(TRAIN_MIN_LENGTH, TRAIN_MAX_LENGTH, Math.random());
    const speed = THREE.MathUtils.lerp(TRAIN_MIN_SPEED, TRAIN_MAX_SPEED, Math.random());
    const train = new Train(direction, length, speed);
    this.trains.push(train);
    this.scene.add(train.group);
  }

  spawnCar() {
    if (this.cars.length >= MAX_CARS) return; // the road is backed up out of sight - see MAX_CARS

    const direction = Math.random() < 0.5 ? 1 : -1;
    const laneX = direction > 0 ? LANE_OFFSET : -LANE_OFFSET;
    const car = new Car(direction, laneX);
    this.cars.push(car);
    this.scene.add(car.group);
  }

  // One lane's worth of cars, ordered lead car first, each clamped behind
  // the car ahead and (until committed to crossing) behind the stop line
  // whenever the barrier is closing or closed.
  advanceLane(orderedCars, delta) {
    let previous = null;
    for (const car of orderedCars) {
      let desired = car.z + car.direction * CAR_SPEED * delta;

      if (!car.committed && this.lowered > 0.12) {
        const stopZ =
          car.direction > 0
            ? -(TRACK_HALF_WIDTH + STOP_LINE_MARGIN)
            : TRACK_HALF_WIDTH + STOP_LINE_MARGIN;
        desired = car.direction > 0 ? Math.min(desired, stopZ) : Math.max(desired, stopZ);
      }

      if (previous) {
        const gap = CAR_MIN_GAP + car.halfLength + previous.halfLength;
        desired =
          car.direction > 0
            ? Math.min(desired, previous.z - gap)
            : Math.max(desired, previous.z + gap);
      }

      car.z = desired;
      car.applyPosition();

      if (!car.committed && car.occupiesZone(TRACK_HALF_WIDTH)) car.committed = true;

      previous = car;
    }
  }

  updateCars(delta) {
    const northbound = this.cars.filter((c) => c.direction === 1).sort((a, b) => b.z - a.z);
    const southbound = this.cars.filter((c) => c.direction === -1).sort((a, b) => a.z - b.z);
    this.advanceLane(northbound, delta);
    this.advanceLane(southbound, delta);
  }

  updateBarrier(delta) {
    const step = delta / BARRIER_SECONDS;
    if (this.lowered < this.barrierTarget) {
      this.lowered = Math.min(this.barrierTarget, this.lowered + step);
    } else if (this.lowered > this.barrierTarget) {
      this.lowered = Math.max(this.barrierTarget, this.lowered - step);
    }

    for (let i = 0; i < this.barrierPivots.length; i++) {
      this.barrierPivots[i].rotation.z =
        this.reachDirections[i] * (1 - this.lowered) * (Math.PI / 2);
    }

    const lightsOn = this.lowered > 0.02;
    if (lightsOn) {
      this.flashTimer += delta;
      if (this.flashTimer >= FLASH_INTERVAL) {
        this.flashTimer -= FLASH_INTERVAL;
        this.flashState = this.flashState === 0 ? 1 : 0;
      }
    }
    this.setLamps(lightsOn);
  }

  setLamps(on) {
    for (const lamp of this.lamps) {
      const lit = on && this.flashState === lamp.phase;
      lamp.mesh.material.emissiveIntensity = lit ? 2.2 : 0;
      lamp.mesh.material.color.setHex(lit ? 0xff5544 : 0x5c1512);
    }
  }

  updateWarning() {
    let active = false;
    for (const train of this.trains) {
      if (train.occupiesZone(ROAD_HALF_WIDTH)) {
        active = true;
        continue;
      }
      const distance = train.distanceToZone(ROAD_HALF_WIDTH);
      if (distance <= 0) continue; // already cleared the zone - not a threat
      if (distance / train.speed <= WARNING_LEAD_TIME) active = true;
    }

    if (active && !this.warningActive) playWarningDing();
    this.warningActive = active;
  }

  checkCollision() {
    const trainInZone = this.trains.some((t) => t.occupiesZone(ROAD_HALF_WIDTH));
    const carInZone = this.cars.some((c) => c.occupiesZone(TRACK_HALF_WIDTH));
    if (trainInZone && carInZone) {
      this.gameOver = true;
      playCrash();
    }
  }

  pruneOffscreen() {
    for (let i = this.trains.length - 1; i >= 0; i--) {
      if (this.trains[i].isOffscreen()) {
        this.scene.remove(this.trains[i].group);
        this.trains.splice(i, 1);
        this.score += 2;
      }
    }
    for (let i = this.cars.length - 1; i >= 0; i--) {
      if (this.cars[i].isOffscreen()) {
        this.scene.remove(this.cars[i].group);
        this.cars.splice(i, 1);
        this.score += 1;
      }
    }
  }

  update(delta) {
    if (this.gameOver) return;

    this.elapsed += delta;

    this.trainTimer -= delta;
    if (this.trainTimer <= 0) {
      this.spawnTrain();
      this.trainTimer = THREE.MathUtils.lerp(TRAIN_INTERVAL_MIN, TRAIN_INTERVAL_MAX, Math.random());
    }

    this.carTimer -= delta;
    if (this.carTimer <= 0) {
      this.spawnCar();
      this.carTimer = this.currentCarInterval() * (0.7 + Math.random() * 0.6);
    }

    for (const train of this.trains) train.update(delta);
    this.updateCars(delta);
    this.updateBarrier(delta);
    this.updateWarning();
    this.checkCollision();

    if (!this.gameOver) this.pruneOffscreen();
  }
}
