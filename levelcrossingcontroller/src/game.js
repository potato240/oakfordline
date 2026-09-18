import * as THREE from 'three';
import { buildScene } from './scene.js';
import { Train, Car } from './entities.js';
import { playWarningDing, playCrash } from './audio.js';
import { DEFAULT_SETTINGS, combinedTrackHalfWidth } from './settings.js';
import {
  ROAD_HALF_WIDTH,
  TRACK_HALF_WIDTH,
  TRACK_SPACING,
  STOP_LINE_MARGIN,
  GATE_CLEARANCE,
  LANE_OFFSET,
  CAR_MIN_GAP,
  CAR_SPEED,
  TRAIN_MIN_LENGTH,
  TRAIN_MAX_LENGTH,
  TRAIN_MIN_SPEED,
  TRAIN_MAX_SPEED,
  BARRIER_SECONDS,
  BARRIER_CLOSE_DELAY,
  FLASH_INTERVAL,
  UK_AMBER_SECONDS,
  GERMANY_AMBER_SECONDS,
  WIGWAG_SWING_PERIOD,
  WIGWAG_SWING_AMPLITUDE,
  WARNING_LEAD_TIME,
  RAMP_SECONDS,
  TRAIN_INTERVAL_MIN,
  TRAIN_INTERVAL_MAX,
  CAR_INTERVAL_START,
  CAR_INTERVAL_MIN,
  MAX_CARS,
} from './constants.js';

// Owns every piece of live state - the scene is built once in the
// constructor (from `settings`, which is why a settings *change* needs a
// whole new Game rather than mutating this one - see main.js) and reused;
// reset() (also called by the constructor) clears everything else so a
// same-settings restart never needs a fresh Game or a page reload.
export class Game {
  constructor(settings) {
    this.settings = { ...DEFAULT_SETTINGS, ...settings };

    const trackCount = this.settings.trackCount;
    this.combinedHalfWidth = combinedTrackHalfWidth(trackCount);
    // Centred on Z = 0 regardless of count, e.g. 1 track -> [0], 2 tracks ->
    // [-spacing/2, +spacing/2], 3 -> [-spacing, 0, +spacing].
    this.trackZs = Array.from(
      { length: trackCount },
      (_, i) => (i - (trackCount - 1) / 2) * TRACK_SPACING
    );

    const { scene, camera, lamps, protectionUnits } = buildScene(this.settings, this.trackZs);
    this.scene = scene;
    this.camera = camera;
    this.lamps = lamps;
    this.protectionUnits = protectionUnits;

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
    this.lowered = 0; // 0..1, how far down the gate(s) actually are right now
    this.flashTimer = 0;
    this.flashState = 0;
    this.warningActive = false;
    this.wasLightsOn = false;
    this.waitingToClose = false; // BARRIER_CLOSE_DELAY countdown active - see updateBarrier()
    this.closeDelayTimer = 0;
    this.amberLeadActive = false; // lightStyle 'uk'/'germany' only - see updateBarrier()
    this.amberLeadTimer = 0;
    this.wigwagSwingPhase = 0; // lightStyle 'wigwag' only - see updateBarrier()

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
    const trackZ = this.trackZs[Math.floor(Math.random() * this.trackZs.length)];
    const train = new Train(direction, length, speed, trackZ);
    this.trains.push(train);
    this.scene.add(train.group);
  }

  spawnCar() {
    if (this.cars.length >= MAX_CARS) return; // the road is backed up out of sight - see MAX_CARS

    const direction = Math.random() < 0.5 ? 1 : -1;
    // Right-hand traffic: a car heading +Z (south, toward the camera) keeps
    // to the -X side of the road, and one heading -Z (north, away from the
    // camera) keeps to +X - see the derivation in entities.js's Car comment.
    const laneX = direction > 0 ? -LANE_OFFSET : LANE_OFFSET;
    const car = new Car(direction, laneX);
    this.cars.push(car);
    this.scene.add(car.group);
  }

  // One lane's worth of cars, ordered lead car first, each clamped behind
  // the car ahead and (until committed to crossing) behind the gate
  // whenever the barrier is closing or closed. The gate sits out beyond the
  // *combined* multi-track corridor, not any one track, since a car must
  // clear every track before it is genuinely safe.
  advanceLane(orderedCars, delta) {
    let previous = null;
    for (const car of orderedCars) {
      let desired = car.z + car.direction * CAR_SPEED * delta;

      if (!car.committed && this.lowered > 0.12) {
        const gateZ =
          car.direction > 0
            ? -(this.combinedHalfWidth + STOP_LINE_MARGIN)
            : this.combinedHalfWidth + STOP_LINE_MARGIN;
        // The car's front bumper, not its centre, is what should stop short
        // of the gate - otherwise its own half-length hangs past the gate
        // line and it reads as stopping inside the barrier.
        const stopZ = gateZ - car.direction * (car.halfLength + GATE_CLEARANCE);
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

      if (!car.committed && car.overlapsBand(0, this.combinedHalfWidth)) car.committed = true;

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
    // Lights come on the instant the barrier is *commanded* down, but the
    // gate itself holds still for BARRIER_CLOSE_DELAY before it is actually
    // allowed to start moving - "warn first, then act". Only closing waits;
    // raising (barrierTarget back to 0) is immediate, same as before. The
    // delay only ever starts fresh from a fully raised gate - re-commanding
    // close while already mid-close (or mid-delay) does not restart it.
    if (this.barrierTarget === 1) {
      if (!this.waitingToClose && this.lowered === 0) {
        this.waitingToClose = true;
        this.closeDelayTimer = BARRIER_CLOSE_DELAY;
      }
    } else {
      this.waitingToClose = false;
    }

    let moveTarget = this.barrierTarget;
    if (this.waitingToClose) {
      this.closeDelayTimer -= delta;
      if (this.closeDelayTimer > 0) {
        moveTarget = this.lowered; // held at 0 - not allowed to move yet
      } else {
        this.waitingToClose = false; // delay elapsed - closing can proceed
      }
    }

    const step = delta / BARRIER_SECONDS;
    if (this.lowered < moveTarget) {
      this.lowered = Math.min(moveTarget, this.lowered + step);
    } else if (this.lowered > moveTarget) {
      this.lowered = Math.max(moveTarget, this.lowered - step);
    }

    for (const unit of this.protectionUnits) unit.apply(this.lowered);

    // On, from the command, the instant it is given - not from `lowered`
    // alone, which is what would make the lights wait for BARRIER_CLOSE_DELAY
    // too instead of warning *before* the gate actually moves.
    const lightsOn = this.barrierTarget === 1 || this.lowered > 0.02;

    // The real UK and German sequences: a steady amber/yellow lead-in
    // before the reds ever start flashing, starting fresh every time the
    // lights come on from off (not just once per game) - every other light
    // style skips this entirely and goes straight to flashing red. Both
    // styles share this one state machine, keyed off `lightStyle` only for
    // which duration to use - the behaviour itself is identical.
    if (lightsOn && !this.wasLightsOn) {
      if (this.settings.lightStyle === 'uk') {
        this.amberLeadActive = true;
        this.amberLeadTimer = UK_AMBER_SECONDS;
      } else if (this.settings.lightStyle === 'germany') {
        this.amberLeadActive = true;
        this.amberLeadTimer = GERMANY_AMBER_SECONDS;
      }
    }
    if (!lightsOn) this.amberLeadActive = false;

    if (lightsOn) {
      if (this.amberLeadActive) {
        this.amberLeadTimer -= delta;
        if (this.amberLeadTimer <= 0) this.amberLeadActive = false;
      } else {
        this.flashTimer += delta;
        if (this.flashTimer >= FLASH_INTERVAL) {
          this.flashTimer -= FLASH_INTERVAL;
          this.flashState = this.flashState === 0 ? 1 : 0;
        }
      }
    }
    this.wasLightsOn = lightsOn;

    // 'wigwag' only: the lamp's arm physically swings while active - a
    // continuous oscillation, not tied to flashState/amberLeadActive at all,
    // since the swinging motion itself *is* the signal here, the way a
    // flashing lamp is everywhere else. Snaps back to rest (angle 0) the
    // instant the lights go off, rather than drifting to a stop.
    this.wigwagSwingPhase += lightsOn ? (delta * 2 * Math.PI) / WIGWAG_SWING_PERIOD : 0;
    for (const lamp of this.lamps) {
      if (!lamp.swingPivot) continue;
      lamp.swingPivot.rotation.z = lightsOn
        ? Math.sin(this.wigwagSwingPhase) * WIGWAG_SWING_AMPLITUDE
        : 0;
    }

    this.setLamps(lightsOn);
  }

  setLamps(on) {
    for (const lamp of this.lamps) {
      let lit;
      if (lamp.phase === 'amber') {
        // The amber/yellow lead-in lamp ('uk'/'germany' only) is steady
        // during its own phase and off otherwise - it never joins the
        // reds' alternation.
        lit = on && this.amberLeadActive;
      } else if (lamp.phase === 'wigwag') {
        // Continuously lit while active - the swinging arm (above) is what
        // reads as "on/off" to a driver, not the lamp itself flashing.
        lit = on;
      } else {
        lit = on && !this.amberLeadActive && this.flashState === lamp.phase;
      }
      lamp.mesh.material.emissiveIntensity = lit ? 2.2 : 0;
      lamp.mesh.material.color.setHex(lit ? lamp.onColor ?? 0xff5544 : lamp.offColor ?? 0x5c1512);
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

    // 'none' lights means no warning system at all, audio included - not
    // just an invisible lamp mesh.
    if (active && !this.warningActive && this.settings.lightStyle !== 'none') {
      playWarningDing();
    }
    this.warningActive = active;
  }

  // Seconds until the next train reaches the danger zone, for the "next
  // train" HUD box - not "how long until one spawns" (trainTimer alone),
  // since a spawned-but-still-approaching train arrives sooner than that
  // and is the actually relevant number once one is en route. Falls back to
  // trainTimer (the spawn countdown) when nothing is live yet, which is the
  // best estimate available at that point, even though the real arrival is
  // spawn time plus however long it then takes to reach the zone.
  nextTrainETA() {
    let soonest = this.trainTimer;
    for (const train of this.trains) {
      if (train.occupiesZone(ROAD_HALF_WIDTH)) return 0; // already there
      const distance = train.distanceToZone(ROAD_HALF_WIDTH);
      if (distance <= 0) continue; // already cleared - not "next"
      soonest = Math.min(soonest, distance / train.speed);
    }
    return soonest;
  }

  // Checked per train, against that train's own track band specifically -
  // not "any car anywhere in the whole multi-track corridor", since a train
  // on one track cannot be hit by a car only overlapping a different track.
  checkCollision() {
    for (const train of this.trains) {
      if (!train.occupiesZone(ROAD_HALF_WIDTH)) continue;
      if (this.cars.some((c) => c.overlapsBand(train.trackZ, TRACK_HALF_WIDTH))) {
        this.gameOver = true;
        playCrash();
        return;
      }
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
