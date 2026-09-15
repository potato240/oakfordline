import * as THREE from 'three';
import { RAIL_TOP_Y } from './layout.js';
import { BRANCH_PATH, BRANCH_STATIONS, BRANCH_WAYPOINTS } from './branchLayout.js';

// A two-car railcar unit for the branch line - deliberately simpler than the
// main EMU (no tumblehome bodyside curve, no mullioned windows, no seating
// hooked into the sit-down system), because this is a second, smaller line's
// train, not a second copy of the main one. It reuses the same shape of
// state machine as the main Train - dwell/closing/running/opening, a
// braking-distance run between stops - generalised from "a scalar Z" to "a
// distance travelled along the branch's own curved RailPath".

const CAR_LENGTH = 13;
const CAR_GAP = 0.7; // gangway gap between the two cars
const CAR_WIDTH = 2.6;
const CAR_HEIGHT = 2.4;
const WHEEL_RADIUS = 0.4;
const AXLE_Y = RAIL_TOP_Y + WHEEL_RADIUS;
const FLOOR_Y = AXLE_Y + 0.2;
const INTERIOR_HEIGHT = 2.15;
const CEILING_Y = FLOOR_Y + INTERIOR_HEIGHT;

const DOOR_CENTRES = [-4, 4];
const DOOR_HALF_WIDTH = 0.6;
const DOOR_HEIGHT = 1.9;

// The window band is a real opening, not glass laid over a solid sheet - see
// the "Window openings are real" note in CLAUDE.md, which this mirrors: a
// solid lower band, an open (glazed) middle band, and a solid header band,
// with nothing opaque placed inside the middle band on either side of the
// car. That is what makes it genuinely see-through rather than just tinted.
const LOWER_BAND_HEIGHT = 0.85;
const UPPER_BAND_HEIGHT = 0.35;
const WINDOW_BAND_HEIGHT = CAR_HEIGHT - LOWER_BAND_HEIGHT - UPPER_BAND_HEIGHT;

const HALF_LENGTH = CAR_LENGTH / 2;
const TOTAL_HALF_LENGTH = CAR_LENGTH + CAR_GAP / 2; // both cars plus the gangway between them
const INNER_HALF_WIDTH = CAR_WIDTH / 2 - 0.12;
const GANGWAY_HALF_WIDTH = 0.55;

const MAX_SPEED = 14; // m/s - a smaller railcar, not run flat out like the EMU
const ACCELERATION = 1.2;
const DECELERATION = 1.5;
const DWELL_SECONDS = 10;
const DOOR_SECONDS = 2.0;

const materials = {
  bodyLower: new THREE.MeshStandardMaterial({ color: 0x1f4a2e, roughness: 0.5 }),
  bodyUpper: new THREE.MeshStandardMaterial({ color: 0xe8e0c8, roughness: 0.55 }),
  roof: new THREE.MeshStandardMaterial({ color: 0x3a3d38, roughness: 0.8 }),
  glass: new THREE.MeshStandardMaterial({
    color: 0x9fc4d8,
    roughness: 0.08,
    metalness: 0.1,
    transparent: true,
    opacity: 0.22,
  }),
  under: new THREE.MeshStandardMaterial({ color: 0x232326, roughness: 0.9 }),
  wheel: new THREE.MeshStandardMaterial({ color: 0x3a3a3d, roughness: 0.5, metalness: 0.6 }),
  floor: new THREE.MeshStandardMaterial({ color: 0x555a52, roughness: 0.85 }),
  ceiling: new THREE.MeshStandardMaterial({ color: 0xe6e6e0, roughness: 0.9 }),
  seat: new THREE.MeshStandardMaterial({ color: 0x6b3a2f, roughness: 0.9 }),
  door: new THREE.MeshStandardMaterial({ color: 0xcfd6c8, roughness: 0.5 }),
  headlight: new THREE.MeshStandardMaterial({
    color: 0xfff6de,
    emissive: 0xffe9b0,
    emissiveIntensity: 1.2,
  }),
  gangway: new THREE.MeshStandardMaterial({ color: 0x2e2f2c, roughness: 0.9 }),
};

function wallSegments() {
  const edges = [-HALF_LENGTH];
  for (const centre of DOOR_CENTRES) edges.push(centre - DOOR_HALF_WIDTH, centre + DOOR_HALF_WIDTH);
  edges.push(HALF_LENGTH);

  const segments = [];
  for (let i = 0; i < edges.length; i += 2) {
    const from = edges[i];
    const to = edges[i + 1];
    if (to - from > 0.01) segments.push({ centre: (from + to) / 2, length: to - from });
  }
  return segments;
}

function addSideWall(car, side, doorLeaves) {
  const x = side * (CAR_WIDTH / 2 - 0.06);

  for (const segment of wallSegments()) {
    const lower = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, LOWER_BAND_HEIGHT, segment.length),
      materials.bodyLower
    );
    lower.position.set(x, FLOOR_Y + LOWER_BAND_HEIGHT / 2, segment.centre);
    lower.castShadow = true;
    car.add(lower);

    const upper = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, UPPER_BAND_HEIGHT, segment.length),
      materials.bodyUpper
    );
    upper.position.set(x, FLOOR_Y + CAR_HEIGHT - UPPER_BAND_HEIGHT / 2, segment.centre);
    upper.castShadow = true;
    car.add(upper);

    // The window band itself is left with no solid box at all - the glass
    // pane below sits in a true opening, not in front of a solid sheet, so
    // looking through one side's window band hits open air (and then, if
    // nothing is in the way, the far side's window) rather than the car's
    // own painted bodyside.
    if (segment.length > 1.0) {
      const pane = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, WINDOW_BAND_HEIGHT - 0.12, segment.length - 0.3),
        materials.glass
      );
      pane.position.set(x, FLOOR_Y + LOWER_BAND_HEIGHT + WINDOW_BAND_HEIGHT / 2, segment.centre);
      car.add(pane);

      // A slim frame ring around the opening reads the pane as glazing set
      // into a real hole, rather than a stray transparent box floating over
      // solid paint.
      const frameMaterial = materials.bodyLower;
      for (const frameY of [
        FLOOR_Y + LOWER_BAND_HEIGHT,
        FLOOR_Y + LOWER_BAND_HEIGHT + WINDOW_BAND_HEIGHT,
      ]) {
        const bar = new THREE.Mesh(
          new THREE.BoxGeometry(0.12, 0.05, segment.length - 0.2),
          frameMaterial
        );
        bar.position.set(x, frameY, segment.centre);
        car.add(bar);
      }
    }
  }

  for (const centre of DOOR_CENTRES) {
    const headerHeight = CAR_HEIGHT - DOOR_HEIGHT;
    const header = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, headerHeight, DOOR_HALF_WIDTH * 2),
      materials.bodyUpper
    );
    header.position.set(x, FLOOR_Y + DOOR_HEIGHT + headerHeight / 2, centre);
    car.add(header);

    // Each door leaf carries its own small glazed panel - doors are the one
    // place on the branch railcar that keeps a window even though the leaf
    // itself is solid, matching how real sliding doors are glazed.
    const doorGlass = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, DOOR_HEIGHT * 0.45, DOOR_HALF_WIDTH * 2 - 0.3),
      materials.glass
    );
    doorGlass.position.set(x + side * 0.06, FLOOR_Y + DOOR_HEIGHT * 0.62, centre);
    car.add(doorGlass);

    for (const direction of [-1, 1]) {
      const leaf = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, DOOR_HEIGHT, DOOR_HALF_WIDTH),
        materials.door
      );
      const closedZ = centre + (direction * DOOR_HALF_WIDTH) / 2;
      leaf.position.set(x + side * 0.03, FLOOR_Y + DOOR_HEIGHT / 2, closedZ);
      leaf.castShadow = true;
      car.add(leaf);
      doorLeaves.push({ leaf, closedZ, direction, side });
    }
  }
}

function addInterior(car) {
  const floor = new THREE.Mesh(new THREE.BoxGeometry(CAR_WIDTH - 0.15, 0.08, CAR_LENGTH), materials.floor);
  floor.position.y = FLOOR_Y - 0.04;
  floor.receiveShadow = true;
  car.add(floor);

  const ceiling = new THREE.Mesh(new THREE.BoxGeometry(CAR_WIDTH - 0.15, 0.06, CAR_LENGTH), materials.ceiling);
  ceiling.position.y = CEILING_Y;
  car.add(ceiling);

  const light = new THREE.PointLight(0xfff4e0, 16, 13, 1.6);
  light.position.set(0, CEILING_Y - 0.2, 0);
  car.add(light);

  // A few simple bench seats - visual only, not wired into the sit-down
  // system, unlike the main EMU's seating. Kept below the window sill so
  // they never block the new see-through glazing above them.
  for (const segment of wallSegments()) {
    if (segment.length < 1.2) continue;
    for (const side of [-1, 1]) {
      const seat = new THREE.Mesh(
        new THREE.BoxGeometry(0.45, 0.42, segment.length - 0.2),
        materials.seat
      );
      seat.position.set(side * (INNER_HALF_WIDTH - 0.25), FLOOR_Y + 0.24, segment.centre);
      seat.castShadow = true;
      car.add(seat);
    }
  }
}

function addRunningGear(car, wheels) {
  const wheelGeometry = new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, 0.11, 14);

  for (const bogieZ of [-HALF_LENGTH + 2.6, HALF_LENGTH - 2.6]) {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.36, 2.6), materials.under);
    frame.position.set(0, AXLE_Y + 0.15, bogieZ);
    frame.castShadow = true;
    car.add(frame);

    for (const axleZ of [-0.85, 0.85]) {
      for (const side of [-1, 1]) {
        const wheel = new THREE.Mesh(wheelGeometry, materials.wheel);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(side * 0.72, AXLE_Y, bogieZ + axleZ);
        wheel.castShadow = true;
        car.add(wheel);
        wheels.push(wheel);
      }
    }
  }
}

// The outer end of the unit - a cab face with a windscreen and marker
// lamps, the same as the old single-car railcar had at both ends.
function addCabFace(car, end) {
  const endZ = end * HALF_LENGTH;

  const face = new THREE.Mesh(new THREE.BoxGeometry(CAR_WIDTH, CAR_HEIGHT, 0.2), materials.bodyLower);
  face.position.set(0, FLOOR_Y + CAR_HEIGHT / 2, endZ + end * 0.1);
  face.castShadow = true;
  car.add(face);

  const screen = new THREE.Mesh(new THREE.BoxGeometry(CAR_WIDTH - 0.4, 0.8, 0.1), materials.glass);
  screen.position.set(0, FLOOR_Y + CAR_HEIGHT * 0.68, endZ + end * 0.21);
  car.add(screen);

  for (const side of [-1, 1]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 0.08), materials.headlight);
    lamp.position.set(side * 0.7, FLOOR_Y + 0.4, endZ + end * 0.22);
    car.add(lamp);
  }
}

// The inner end of the unit, where the two cars meet - an open gangway
// (mirroring the main EMU's inner-end gap in train.js) rather than a cab, so
// the two-car unit reads as one connected train, not two railcars glued
// together nose to nose.
function addGangwayEnd(car, end) {
  const endZ = end * HALF_LENGTH;
  const outer = CAR_WIDTH / 2;

  for (const [minX, maxX] of [[-outer, -GANGWAY_HALF_WIDTH], [GANGWAY_HALF_WIDTH, outer]]) {
    const pillar = new THREE.Mesh(
      new THREE.BoxGeometry(maxX - minX, CAR_HEIGHT, 0.1),
      materials.gangway
    );
    pillar.position.set((minX + maxX) / 2, FLOOR_Y + CAR_HEIGHT / 2, endZ + end * 0.05);
    pillar.castShadow = true;
    car.add(pillar);
  }

  const bridge = new THREE.Mesh(
    new THREE.BoxGeometry(GANGWAY_HALF_WIDTH * 2, 0.14, CAR_GAP + 0.2),
    materials.gangway
  );
  bridge.position.set(0, FLOOR_Y + CAR_HEIGHT - 0.07, endZ + end * (CAR_GAP / 2));
  car.add(bridge);
}

function createCar(doorLeaves, wheels, isFront) {
  const car = new THREE.Group();
  const outerEnd = isFront ? 1 : -1;
  const innerEnd = -outerEnd;

  addRunningGear(car, wheels);
  addInterior(car);
  addSideWall(car, 1, doorLeaves);
  addSideWall(car, -1, doorLeaves);

  const roof = new THREE.Mesh(
    new THREE.CylinderGeometry(CAR_WIDTH / 2, CAR_WIDTH / 2, CAR_LENGTH, 12, 1, false, 0, Math.PI),
    materials.roof
  );
  roof.rotation.z = Math.PI / 2;
  roof.rotation.y = Math.PI / 2;
  roof.scale.y = 0.3;
  roof.position.y = FLOOR_Y + CAR_HEIGHT;
  roof.castShadow = true;
  car.add(roof);

  addCabFace(car, outerEnd);
  addGangwayEnd(car, innerEnd);

  return car;
}

export class BranchTrain {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'branch-train';

    this.carCentres = [(CAR_LENGTH + CAR_GAP) / 2, -(CAR_LENGTH + CAR_GAP) / 2];

    this.doorLeaves = [];
    this.wheels = [];
    this.body = new THREE.Group();

    const front = createCar(this.doorLeaves, this.wheels, true);
    front.position.z = this.carCentres[0];
    this.body.add(front);

    const rear = createCar(this.doorLeaves, this.wheels, false);
    rear.position.z = this.carCentres[1];
    this.body.add(rear);

    this.group.add(this.body);

    this.stationIndex = 0;
    this.step = 1;
    this.targetIndex = 1;
    this.speed = 0;
    this.doorOpen = 1;
    this.state = 'dwell';
    this.timer = DWELL_SECONDS;

    this.distance = this.distanceOf(0);
    this.applyPosition();
    this.applyDoors();
  }

  distanceOf(stationIndex) {
    const station = BRANCH_STATIONS[stationIndex];
    const waypoint = BRANCH_WAYPOINTS.find((w) => w.x === station.x && w.z === station.z);
    return BRANCH_PATH.distanceAt(waypoint);
  }

  get currentStation() {
    return BRANCH_STATIONS[this.stationIndex];
  }

  get nextStation() {
    return BRANCH_STATIONS[this.targetIndex];
  }

  get targetDistance() {
    return this.distanceOf(this.targetIndex);
  }

  applyPosition() {
    const { x, z, heading } = BRANCH_PATH.positionAt(this.distance);
    this.group.position.set(x, 0, z);
    this.group.rotation.y = heading;
  }

  applyDoors() {
    const platformSide = this.currentStation.platformSide;
    const maxTravel = DOOR_HALF_WIDTH * 0.96;
    for (const { leaf, closedZ, direction, side } of this.doorLeaves) {
      const travel = side === platformSide ? this.doorOpen * maxTravel : 0;
      leaf.position.z = closedZ + direction * travel;
    }
  }

  // Half-extent along the unit's own local Z, spanning both cars and the
  // gangway between them - used for the "am I aboard" test, expressed in the
  // train's own rotating local frame.
  get halfLength() {
    return TOTAL_HALF_LENGTH;
  }

  // World point -> is it inside the saloon? Unlike the main Train (which
  // never rotates, so world X/Z can be compared directly), this train's
  // heading changes along the curve, so the query point has to be converted
  // into the train's own local frame first.
  contains(worldX, worldZ) {
    const dx = worldX - this.group.position.x;
    const dz = worldZ - this.group.position.z;
    const cos = Math.cos(this.group.rotation.y);
    const sin = Math.sin(this.group.rotation.y);
    // Inverse of THREE's Y-rotation: local = R(-heading) * world-offset.
    const localX = dx * cos - dz * sin;
    const localZ = dx * sin + dz * cos;

    return localX > -INNER_HALF_WIDTH && localX < 1.4 && Math.abs(localZ) < this.halfLength;
  }

  update(delta) {
    const previousX = this.group.position.x;
    const previousZ = this.group.position.z;

    switch (this.state) {
      case 'dwell':
        this.doorOpen = Math.min(1, this.doorOpen + delta / DOOR_SECONDS);
        this.timer -= delta;
        if (this.timer <= 0) this.state = 'closing';
        break;

      case 'closing':
        this.doorOpen = Math.max(0, this.doorOpen - delta / DOOR_SECONDS);
        if (this.doorOpen === 0) this.state = 'running';
        break;

      case 'running': {
        const target = this.targetDistance;
        const remaining = target - this.distance;
        const distanceToGo = Math.abs(remaining);
        const stoppingDistance = (this.speed * this.speed) / (2 * DECELERATION);

        if (distanceToGo <= stoppingDistance) {
          this.speed = Math.max(0, this.speed - DECELERATION * delta);
        } else {
          this.speed = Math.min(MAX_SPEED, this.speed + ACCELERATION * delta);
        }
        if (distanceToGo > 0.3 && this.speed < 0.4) this.speed = 0.4;

        this.distance += Math.sign(remaining) * this.speed * delta;

        if (Math.abs(target - this.distance) < 0.3 && this.speed < 0.6) {
          this.distance = target;
          this.speed = 0;
          this.stationIndex = this.targetIndex;

          if (
            this.stationIndex + this.step < 0 ||
            this.stationIndex + this.step >= BRANCH_STATIONS.length
          ) {
            this.step = -this.step;
          }
          this.targetIndex = this.stationIndex + this.step;
          this.state = 'opening';
        }
        break;
      }

      case 'opening':
        this.doorOpen = Math.min(1, this.doorOpen + delta / DOOR_SECONDS);
        if (this.doorOpen === 1) {
          this.state = 'dwell';
          this.timer = DWELL_SECONDS;
        }
        break;
    }

    this.applyPosition();
    this.applyDoors();

    if (this.speed > 0) {
      const spin = (this.speed * delta) / WHEEL_RADIUS;
      for (const wheel of this.wheels) wheel.rotateY(spin);
    }

    return {
      dx: this.group.position.x - previousX,
      dz: this.group.position.z - previousZ,
    };
  }

  // Solid parts of the bodyshell, in train-local Z, the same shape as
  // Train.colliders() in train.js - looped once per car, at that car's own
  // centre, the same way the main train's two carriages are. offsetX()/
  // offset() keep the boxes attached as the unit runs - axis-aligned always,
  // so exact on the straights and at every station, and only an
  // approximation for the short stretch of curve the route passes through
  // (see the note in collision.js).
  colliders() {
    const boxes = [];
    const offset = () => this.group.position.z;
    const offsetX = () => this.group.position.x;
    const top = FLOOR_Y + CAR_HEIGHT;
    const outer = CAR_WIDTH / 2;
    const inner = outer - 0.2;

    for (const carCentre of this.carCentres) {
      for (const segment of wallSegments()) {
        for (const [minX, maxX] of [[inner, outer], [-outer, -inner]]) {
          boxes.push({
            minX, maxX,
            minZ: carCentre + segment.centre - segment.length / 2,
            maxZ: carCentre + segment.centre + segment.length / 2,
            minY: FLOOR_Y, maxY: top, offset, offsetX,
          });
        }
      }

      for (const doorCentre of DOOR_CENTRES) {
        for (const [side, minX, maxX] of [[1, inner, outer], [-1, -outer, -inner]]) {
          boxes.push({
            minX, maxX,
            minZ: carCentre + doorCentre - DOOR_HALF_WIDTH,
            maxZ: carCentre + doorCentre + DOOR_HALF_WIDTH,
            minY: FLOOR_Y, maxY: FLOOR_Y + DOOR_HEIGHT, offset, offsetX,
            active: () => this.doorOpen < 0.55 || this.currentStation.platformSide !== side,
          });
        }
      }

      // Only the outer end of each car is fully solid - the inner ends face
      // each other across the gangway, so they get a walkway gap instead.
      for (const end of [-1, 1]) {
        const endZ = carCentre + end * HALF_LENGTH;
        const isInner = Math.abs(endZ) < HALF_LENGTH;

        const spans = isInner
          ? [[-outer, -GANGWAY_HALF_WIDTH], [GANGWAY_HALF_WIDTH, outer]]
          : [[-outer, outer]];

        for (const [minX, maxX] of spans) {
          boxes.push({
            minX, maxX,
            minZ: endZ - 0.14, maxZ: endZ + 0.14,
            minY: FLOOR_Y, maxY: top, offset, offsetX,
          });
        }
      }
    }

    return boxes;
  }

  status() {
    switch (this.state) {
      case 'dwell':
        return `${this.currentStation.name} — doors open, departing in ${Math.ceil(this.timer)}s — next stop ${this.nextStation.name}`;
      case 'closing':
        return 'Doors closing — stand clear';
      case 'running':
        return `Next stop: ${this.nextStation.name} — ${Math.round(this.speed * 2.237)} mph`;
      case 'opening':
        return `Arriving at ${this.currentStation.name}`;
      default:
        return '';
    }
  }
}
