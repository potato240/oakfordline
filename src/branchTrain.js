import * as THREE from 'three';
import { RAIL_TOP_Y } from './layout.js';
import { BRANCH_PATH, BRANCH_STATIONS, BRANCH_WAYPOINTS } from './branchLayout.js';

// A single-car railcar for the branch line - deliberately simpler than the
// main EMU (no tumblehome bodyside curve, no mullioned windows, no seating
// hooked into the sit-down system), because this is a second, smaller line's
// train, not a second copy of the main one. It reuses the same shape of
// state machine as the main Train - dwell/closing/running/opening, a
// braking-distance run between stops - generalised from "a scalar Z" to "a
// distance travelled along the branch's own curved RailPath".

const CAR_LENGTH = 13;
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

const HALF_LENGTH = CAR_LENGTH / 2;
const INNER_HALF_WIDTH = CAR_WIDTH / 2 - 0.12;

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
    color: 0x28343a,
    roughness: 0.1,
    metalness: 0.3,
    transparent: true,
    opacity: 0.35,
  }),
  under: new THREE.MeshStandardMaterial({ color: 0x232326, roughness: 0.9 }),
  wheel: new THREE.MeshStandardMaterial({ color: 0x3a3a3d, roughness: 0.5, metalness: 0.6 }),
  floor: new THREE.MeshStandardMaterial({ color: 0x555a52, roughness: 0.85 }),
  ceiling: new THREE.MeshStandardMaterial({ color: 0xe6e6e0, roughness: 0.9 }),
  interiorWall: new THREE.MeshStandardMaterial({ color: 0xd6d2c2, roughness: 0.85 }),
  seat: new THREE.MeshStandardMaterial({ color: 0x6b3a2f, roughness: 0.9 }),
  door: new THREE.MeshStandardMaterial({ color: 0xcfd6c8, roughness: 0.5 }),
  headlight: new THREE.MeshStandardMaterial({
    color: 0xfff6de,
    emissive: 0xffe9b0,
    emissiveIntensity: 1.2,
  }),
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
      new THREE.BoxGeometry(0.12, CAR_HEIGHT * 0.5, segment.length),
      materials.bodyLower
    );
    lower.position.set(x, FLOOR_Y + (CAR_HEIGHT * 0.5) / 2, segment.centre);
    lower.castShadow = true;
    car.add(lower);

    const upper = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, CAR_HEIGHT * 0.5, segment.length),
      materials.bodyUpper
    );
    upper.position.set(x, FLOOR_Y + CAR_HEIGHT * 0.5 + (CAR_HEIGHT * 0.5) / 2, segment.centre);
    upper.castShadow = true;
    car.add(upper);

    if (segment.length > 1.4) {
      const pane = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.9, segment.length * 0.7),
        materials.glass
      );
      pane.position.set(x, FLOOR_Y + CAR_HEIGHT * 0.66, segment.centre);
      car.add(pane);
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
  // system, unlike the main EMU's seating.
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

function createCarBody(doorLeaves, wheels) {
  const car = new THREE.Group();

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

  addCabFace(car, 1);
  addCabFace(car, -1);

  return car;
}

export class BranchTrain {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'branch-train';

    this.doorLeaves = [];
    this.wheels = [];
    this.body = createCarBody(this.doorLeaves, this.wheels);
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

  // Half-extent along the car's own local Z - used for the "am I aboard"
  // test, expressed in the train's own rotating local frame.
  get halfLength() {
    return HALF_LENGTH;
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
  // Train.colliders() in train.js. offsetX()/offset() keep the boxes attached
  // as the unit runs - axis-aligned always, so exact on the straights and at
  // every station, and only an approximation for the short stretch of curve
  // the route passes through (see the note in collision.js).
  colliders() {
    const boxes = [];
    const offset = () => this.group.position.z;
    const offsetX = () => this.group.position.x;
    const top = FLOOR_Y + CAR_HEIGHT;
    const outer = CAR_WIDTH / 2;
    const inner = outer - 0.2;

    for (const segment of wallSegments()) {
      for (const [minX, maxX] of [[inner, outer], [-outer, -inner]]) {
        boxes.push({
          minX, maxX,
          minZ: segment.centre - segment.length / 2,
          maxZ: segment.centre + segment.length / 2,
          minY: FLOOR_Y, maxY: top, offset, offsetX,
        });
      }
    }

    for (const doorCentre of DOOR_CENTRES) {
      for (const [side, minX, maxX] of [[1, inner, outer], [-1, -outer, -inner]]) {
        boxes.push({
          minX, maxX,
          minZ: doorCentre - DOOR_HALF_WIDTH,
          maxZ: doorCentre + DOOR_HALF_WIDTH,
          minY: FLOOR_Y, maxY: FLOOR_Y + DOOR_HEIGHT, offset, offsetX,
          active: () => this.doorOpen < 0.55 || this.currentStation.platformSide !== side,
        });
      }
    }

    for (const end of [-1, 1]) {
      boxes.push({
        minX: -outer, maxX: outer,
        minZ: end * HALF_LENGTH - 0.14, maxZ: end * HALF_LENGTH + 0.14,
        minY: FLOOR_Y, maxY: top, offset, offsetX,
      });
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
