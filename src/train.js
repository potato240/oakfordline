import * as THREE from 'three';
import {
  TRACK_GAUGE,
  CAR_LENGTH,
  CAR_WIDTH,
  CAR_HEIGHT,
  CAR_GAP,
  WALL_THICKNESS,
  WHEEL_RADIUS,
  AXLE_Y,
  FLOOR_Y,
  INTERIOR_HEIGHT,
  DOOR_CENTRES,
  DOOR_HALF_WIDTH,
  DOOR_HEIGHT,
  STATIONS,
} from './layout.js';

const MAX_SPEED = 18; // m/s
const ACCELERATION = 1.3;
const DECELERATION = 1.6;
const DWELL_SECONDS = 14;
const DOOR_SECONDS = 2.2;

const HALF_LENGTH = CAR_LENGTH / 2;

// Gangway opening between cars: clear headroom, and half-width of the gap in
// the end wall. The player's eye sits 1.7 above the floor, so this leaves room.
const GANGWAY_HEIGHT = 2.02;
const GANGWAY_HALF_WIDTH = 0.45;

// Waist stripe, sitting just under the window line.
const STRIPE_HEIGHT = 0.17;
const STRIPE_Y = FLOOR_Y + CAR_HEIGHT * 0.46;
const INNER_HALF_WIDTH = CAR_WIDTH / 2 - WALL_THICKNESS;
const CEILING_Y = FLOOR_Y + INTERIOR_HEIGHT;

// KCR "Yellowhead" livery: off-white bodyside with a red waist stripe, and a
// yellow cab face - which is what the nickname refers to.
const materials = {
  body: new THREE.MeshStandardMaterial({ color: 0xf2efe7, roughness: 0.42, metalness: 0.1 }),
  stripe: new THREE.MeshStandardMaterial({ color: 0xcf2a35, roughness: 0.4 }),
  cabYellow: new THREE.MeshStandardMaterial({ color: 0xf6c81b, roughness: 0.4 }),
  cabBlack: new THREE.MeshStandardMaterial({ color: 0x1b1b1d, roughness: 0.5 }),
  roof: new THREE.MeshStandardMaterial({ color: 0xb4b4b0, roughness: 0.8 }),
  glass: new THREE.MeshStandardMaterial({
    color: 0x25333c,
    roughness: 0.12,
    metalness: 0.45,
  }),
  under: new THREE.MeshStandardMaterial({ color: 0x232326, roughness: 0.9 }),
  wheel: new THREE.MeshStandardMaterial({ color: 0x3a3a3d, roughness: 0.5, metalness: 0.6 }),
  floor: new THREE.MeshStandardMaterial({ color: 0x77797e, roughness: 0.85 }),
  ceiling: new THREE.MeshStandardMaterial({ color: 0xf4f3ef, roughness: 0.9 }),
  interiorWall: new THREE.MeshStandardMaterial({ color: 0xeae7df, roughness: 0.85 }),
  seat: new THREE.MeshStandardMaterial({ color: 0x2f4a7a, roughness: 0.9 }),
  seatBack: new THREE.MeshStandardMaterial({ color: 0x27406b, roughness: 0.9 }),
  pole: new THREE.MeshStandardMaterial({ color: 0xc9ccd1, roughness: 0.3, metalness: 0.8 }),
  door: new THREE.MeshStandardMaterial({ color: 0xe4e1d7, roughness: 0.45 }),
  strip: new THREE.MeshStandardMaterial({
    color: 0xfff8e6,
    emissive: 0xfff2cc,
    emissiveIntensity: 0.9,
  }),
};

// Wall panels run between the door openings rather than being one long box,
// so the doorways are real holes you can walk through.
function wallSegments() {
  const edges = [-HALF_LENGTH];
  for (const centre of DOOR_CENTRES) {
    edges.push(centre - DOOR_HALF_WIDTH, centre + DOOR_HALF_WIDTH);
  }
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
  const x = side * (CAR_WIDTH / 2 - WALL_THICKNESS / 2);
  const wallHeight = CAR_HEIGHT;

  // The platform side is +X and is the only side with doorways.
  const segments = side > 0 ? wallSegments() : [{ centre: 0, length: CAR_LENGTH }];

  for (const segment of segments) {
    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(WALL_THICKNESS, wallHeight, segment.length),
      materials.body
    );
    panel.position.set(x, FLOOR_Y + wallHeight / 2, segment.centre);
    panel.castShadow = true;
    car.add(panel);

    // Red waist stripe, proud of the bodyside so it catches the light.
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(WALL_THICKNESS + 0.03, STRIPE_HEIGHT, segment.length),
      materials.stripe
    );
    stripe.position.set(x, STRIPE_Y, segment.centre);
    car.add(stripe);

    // Inner face, so the interior does not read as raw livery colour.
    const lining = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, INTERIOR_HEIGHT * 0.9, segment.length - 0.05),
      materials.interiorWall
    );
    lining.position.set(x - side * WALL_THICKNESS * 0.6, FLOOR_Y + INTERIOR_HEIGHT * 0.45, segment.centre);
    car.add(lining);

    // Glazing punched into longer panels.
    if (segment.length > 3) {
      const panes = Math.max(1, Math.floor(segment.length / 2.4));
      const spacing = segment.length / panes;
      for (let i = 0; i < panes; i++) {
        const z = segment.centre - segment.length / 2 + spacing * (i + 0.5);
        const pane = new THREE.Mesh(
          new THREE.BoxGeometry(WALL_THICKNESS + 0.06, 0.9, spacing * 0.72),
          materials.glass
        );
        pane.position.set(x, FLOOR_Y + CAR_HEIGHT * 0.68, z);
        car.add(pane);
      }
    }
  }

  if (side > 0) {
    // Header above each doorway. The wall opening runs the full height of the
    // car but the leaves only reach DOOR_HEIGHT, so without this you can see
    // daylight over the top of the doors.
    for (const centre of DOOR_CENTRES) {
      const headerHeight = CAR_HEIGHT - DOOR_HEIGHT;

      const header = new THREE.Mesh(
        new THREE.BoxGeometry(WALL_THICKNESS, headerHeight, DOOR_HALF_WIDTH * 2),
        materials.body
      );
      header.position.set(x, FLOOR_Y + DOOR_HEIGHT + headerHeight / 2, centre);
      header.castShadow = true;
      car.add(header);

      const headerLining = new THREE.Mesh(
        new THREE.BoxGeometry(0.03, headerHeight, DOOR_HALF_WIDTH * 2 - 0.04),
        materials.interiorWall
      );
      headerLining.position.set(
        x - side * WALL_THICKNESS * 0.6,
        FLOOR_Y + DOOR_HEIGHT + headerHeight / 2,
        centre
      );
      car.add(headerLining);
    }

    // Two sliding leaves per doorway, parting towards the ends of the car.
    for (const centre of DOOR_CENTRES) {
      for (const direction of [-1, 1]) {
        const leaf = new THREE.Mesh(
          new THREE.BoxGeometry(WALL_THICKNESS * 0.8, DOOR_HEIGHT, DOOR_HALF_WIDTH),
          materials.door
        );
        const closedZ = centre + (direction * DOOR_HALF_WIDTH) / 2;
        leaf.position.set(x + 0.03, FLOOR_Y + DOOR_HEIGHT / 2, closedZ);
        leaf.castShadow = true;
        car.add(leaf);

        // Stripe segment parented to the leaf, so it slides with the door
        // instead of hanging in the opening.
        const leafStripe = new THREE.Mesh(
          new THREE.BoxGeometry(WALL_THICKNESS * 0.9, STRIPE_HEIGHT, DOOR_HALF_WIDTH),
          materials.stripe
        );
        leafStripe.position.set(0.02, STRIPE_Y - (FLOOR_Y + DOOR_HEIGHT / 2), 0);
        leaf.add(leafStripe);

        const window = new THREE.Mesh(
          new THREE.BoxGeometry(WALL_THICKNESS * 0.9, 0.7, DOOR_HALF_WIDTH * 0.6),
          materials.glass
        );
        window.position.set(x + 0.03, FLOOR_Y + 1.35, closedZ);
        car.add(window);

        doorLeaves.push({ leaf, window, closedZ, direction });
      }
    }
  }
}

function addInterior(car) {
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(CAR_WIDTH - WALL_THICKNESS, 0.08, CAR_LENGTH),
    materials.floor
  );
  floor.position.y = FLOOR_Y - 0.04;
  floor.receiveShadow = true;
  car.add(floor);

  const ceiling = new THREE.Mesh(
    new THREE.BoxGeometry(CAR_WIDTH - WALL_THICKNESS, 0.08, CAR_LENGTH),
    materials.ceiling
  );
  ceiling.position.y = CEILING_Y;
  car.add(ceiling);

  // Lighting strip down the centre of the ceiling.
  const strip = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.05, CAR_LENGTH - 1.4),
    materials.strip
  );
  strip.position.y = CEILING_Y - 0.06;
  car.add(strip);

  // End walls, with a gangway opening wide and tall enough to walk through.
  for (const side of [-1, 1]) {
    for (const offset of [-1, 1]) {
      const panel = new THREE.Mesh(
        new THREE.BoxGeometry(0.95, INTERIOR_HEIGHT, WALL_THICKNESS),
        materials.interiorWall
      );
      panel.position.set(offset * 0.92, FLOOR_Y + INTERIOR_HEIGHT / 2, side * HALF_LENGTH);
      car.add(panel);
    }

    // Header sits above head height - the opening clears GANGWAY_HEIGHT.
    const header = new THREE.Mesh(
      new THREE.BoxGeometry(CAR_WIDTH, INTERIOR_HEIGHT - GANGWAY_HEIGHT, WALL_THICKNESS),
      materials.interiorWall
    );
    header.position.set(
      0,
      FLOOR_Y + GANGWAY_HEIGHT + (INTERIOR_HEIGHT - GANGWAY_HEIGHT) / 2,
      side * HALF_LENGTH
    );
    car.add(header);
  }

  // Saloon lighting. The emissive ceiling strip looks lit but casts nothing,
  // so without these the interior is a cave once the roof blocks the sun.
  for (const z of [-5.5, 5.5]) {
    const light = new THREE.PointLight(0xfff4e0, 22, 17, 1.6);
    light.position.set(0, CEILING_Y - 0.25, z);
    car.add(light);
  }

  // Seating bays in the two saloons, clear of the doorways.
  for (const saloon of [-1, 1]) {
    for (let bay = 0; bay < 2; bay++) {
      const baseZ = saloon * (1.4 + bay * 3.0);
      for (const side of [-1, 1]) {
        const x = side * (INNER_HALF_WIDTH - 0.45);

        const cushion = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.1, 1.05), materials.seat);
        cushion.position.set(x, FLOOR_Y + 0.44, baseZ);
        cushion.castShadow = true;
        car.add(cushion);

        const back = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.62, 1.05), materials.seatBack);
        back.position.set(side * (INNER_HALF_WIDTH - 0.06), FLOOR_Y + 0.75, baseZ);
        car.add(back);

        const pedestal = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.5), materials.under);
        pedestal.position.set(x, FLOOR_Y + 0.2, baseZ);
        car.add(pedestal);
      }
    }
  }

  // Grab poles beside each doorway.
  const poleGeometry = new THREE.CylinderGeometry(0.035, 0.035, INTERIOR_HEIGHT, 8);
  for (const centre of DOOR_CENTRES) {
    for (const offset of [-1, 1]) {
      const pole = new THREE.Mesh(poleGeometry, materials.pole);
      pole.position.set(
        INNER_HALF_WIDTH - 0.5,
        FLOOR_Y + INTERIOR_HEIGHT / 2,
        centre + offset * (DOOR_HALF_WIDTH + 0.35)
      );
      car.add(pole);
    }
  }
}

function addRunningGear(car, wheels) {
  const wheelGeometry = new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, 0.13, 16);

  for (const bogieZ of [-HALF_LENGTH + 3.2, HALF_LENGTH - 3.2]) {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.42, 3.4), materials.under);
    frame.position.set(0, AXLE_Y + 0.18, bogieZ);
    frame.castShadow = true;
    car.add(frame);

    for (const axleZ of [-1.1, 1.1]) {
      for (const side of [-1, 1]) {
        const wheel = new THREE.Mesh(wheelGeometry, materials.wheel);
        // Cylinders stand up the Y axis; lay it over so the axle runs across
        // the track. Spinning is then a rotation about the wheel's local Y.
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set((side * TRACK_GAUGE) / 2, AXLE_Y, bogieZ + axleZ);
        wheel.castShadow = true;
        car.add(wheel);
        wheels.push(wheel);
      }
    }
  }

  const skirt = new THREE.Mesh(
    new THREE.BoxGeometry(CAR_WIDTH - 0.2, 0.5, CAR_LENGTH - 1),
    materials.under
  );
  skirt.position.y = FLOOR_Y - 0.3;
  car.add(skirt);
}

function createCarriage({ cabEnd = 0 }, doorLeaves, wheels, cabs) {
  const car = new THREE.Group();

  addRunningGear(car, wheels);
  addInterior(car);
  addSideWall(car, 1, doorLeaves);
  addSideWall(car, -1, doorLeaves);

  // Curved roof over the top.
  const roof = new THREE.Mesh(
    new THREE.CylinderGeometry(CAR_WIDTH / 2, CAR_WIDTH / 2, CAR_LENGTH, 16, 1, false, 0, Math.PI),
    materials.roof
  );
  roof.rotation.z = Math.PI / 2;
  roof.rotation.y = Math.PI / 2;
  roof.scale.y = 0.34;
  roof.position.y = FLOOR_Y + CAR_HEIGHT;
  roof.castShadow = true;
  car.add(roof);

  // A driving cab at one end. The unit is double-ended, so this is built
  // twice - once facing +Z, once facing -Z - and never needs turning.
  if (cabEnd !== 0) {
    const endZ = cabEnd * HALF_LENGTH;

    // The yellow cab face the "Yellowhead" nickname comes from.
    const front = new THREE.Mesh(
      new THREE.BoxGeometry(CAR_WIDTH, CAR_HEIGHT, 0.3),
      materials.cabYellow
    );
    front.position.set(0, FLOOR_Y + CAR_HEIGHT / 2, endZ + cabEnd * 0.15);
    front.castShadow = true;
    car.add(front);

    // Yellow wraps a short way down both bodysides at the cab end.
    for (const side of [-1, 1]) {
      const wrap = new THREE.Mesh(
        new THREE.BoxGeometry(WALL_THICKNESS + 0.05, CAR_HEIGHT, 0.9),
        materials.cabYellow
      );
      wrap.position.set(
        side * (CAR_WIDTH / 2 - WALL_THICKNESS / 2),
        FLOOR_Y + CAR_HEIGHT / 2,
        endZ - cabEnd * 0.45
      );
      car.add(wrap);
    }

    // Black surround, then the windscreen sitting proud of it.
    const surround = new THREE.Mesh(
      new THREE.BoxGeometry(CAR_WIDTH - 0.16, 1.28, 0.1),
      materials.cabBlack
    );
    surround.position.set(0, FLOOR_Y + CAR_HEIGHT * 0.72, endZ + cabEnd * 0.3);
    car.add(surround);

    const screen = new THREE.Mesh(
      new THREE.BoxGeometry(CAR_WIDTH - 0.42, 1.0, 0.12),
      materials.glass
    );
    screen.position.set(0, FLOOR_Y + CAR_HEIGHT * 0.72, endZ + cabEnd * 0.33);
    car.add(screen);

    // Route indicator box on the roofline, with two red marker lamps.
    const indicator = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.32, 0.16),
      materials.cabBlack
    );
    indicator.position.set(0, FLOOR_Y + CAR_HEIGHT - 0.02, endZ + cabEnd * 0.3);
    car.add(indicator);

    for (const side of [-1, 1]) {
      const marker = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.16, 0.08),
        new THREE.MeshStandardMaterial({
          color: 0xd8241c,
          emissive: 0xff2a1a,
          emissiveIntensity: 1.1,
        })
      );
      marker.position.set(side * 0.22, FLOOR_Y + CAR_HEIGHT - 0.02, endZ + cabEnd * 0.37);
      car.add(marker);
    }

    // Driving desk, visible through the windscreen.
    const desk = new THREE.Mesh(
      new THREE.BoxGeometry(CAR_WIDTH - 0.9, 0.12, 0.6),
      materials.under
    );
    desk.position.set(0, FLOOR_Y + 0.95, endZ - cabEnd * 0.5);
    car.add(desk);

    // Marker lamps get their own material per cab so the leading end can show
    // white while the trailing end shows red.
    const lamps = [];
    for (const side of [-1, 1]) {
      const material = new THREE.MeshStandardMaterial({
        color: 0xfff6de,
        emissive: 0xffe9b0,
        emissiveIntensity: 1.4,
      });
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.16, 0.1), material);
      lamp.position.set(side * 0.85, FLOOR_Y + 0.45, endZ + cabEnd * 0.32);
      car.add(lamp);
      lamps.push(lamp);
    }

    cabs.push({ end: cabEnd, lamps });
  }

  return car;
}

// Bellows connection spanning the gap between the two cars, so walking
// through the gangway is enclosed rather than open to the sky.
function createGangway() {
  const gangway = new THREE.Group();
  gangway.name = 'gangway';

  const bellows = new THREE.MeshStandardMaterial({ color: 0x2b2b2e, roughness: 0.95 });

  // Ribbed sleeve around the opening.
  for (let i = 0; i < 4; i++) {
    const z = -CAR_GAP / 2 + CAR_GAP * ((i + 0.5) / 4);

    for (const side of [-1, 1]) {
      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, GANGWAY_HEIGHT, CAR_GAP / 5),
        bellows
      );
      wall.position.set(side * (GANGWAY_HALF_WIDTH + 0.06), FLOOR_Y + GANGWAY_HEIGHT / 2, z);
      gangway.add(wall);
    }

    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(GANGWAY_HALF_WIDTH * 2 + 0.24, 0.1, CAR_GAP / 5),
      bellows
    );
    roof.position.set(0, FLOOR_Y + GANGWAY_HEIGHT, z);
    gangway.add(roof);
  }

  // Plate bridging the floor gap between the cars.
  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(GANGWAY_HALF_WIDTH * 2, 0.08, CAR_GAP + 0.3),
    new THREE.MeshStandardMaterial({ color: 0x4a4d52, roughness: 0.7, metalness: 0.4 })
  );
  plate.position.set(0, FLOOR_Y - 0.04, 0);
  gangway.add(plate);

  return gangway;
}

export class Train {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'train';

    this.doorLeaves = [];
    this.wheels = [];
    this.cabs = [];

    // Double-ended unit: a cab at each extremity of the formation, so it can
    // run either way down the line without ever being turned.
    const front = createCarriage({ cabEnd: 1 }, this.doorLeaves, this.wheels, this.cabs);
    front.position.z = (CAR_LENGTH + CAR_GAP) / 2;
    this.group.add(front);

    const rear = createCarriage({ cabEnd: -1 }, this.doorLeaves, this.wheels, this.cabs);
    rear.position.z = -(CAR_LENGTH + CAR_GAP) / 2;
    this.group.add(rear);

    this.group.add(createGangway());

    this.stationIndex = 0;
    this.targetIndex = 1;
    this.speed = 0;
    this.doorOpen = 1; // 0 shut, 1 fully open
    this.state = 'dwell';
    this.timer = DWELL_SECONDS;

    this.group.position.z = STATIONS[this.stationIndex].z;

    // Which way the unit is currently working: +1 towards +Z, -1 towards -Z.
    this.direction = Math.sign(STATIONS[this.targetIndex].z - this.group.position.z) || -1;

    this.applyDoors();
    this.applyLights();
  }

  // White at the leading cab, red at the trailing one. Because the unit is
  // double-ended this swaps over at each terminus rather than turning.
  applyLights() {
    for (const cab of this.cabs) {
      const leading = cab.end === this.direction;
      for (const lamp of cab.lamps) {
        lamp.material.color.setHex(leading ? 0xfff6de : 0x6b1414);
        lamp.material.emissive.setHex(leading ? 0xffe9b0 : 0xd11a1a);
        lamp.material.emissiveIntensity = leading ? 1.4 : 1.1;
      }
    }
  }

  get currentStation() {
    return STATIONS[this.stationIndex];
  }

  get nextStation() {
    return STATIONS[this.targetIndex];
  }

  applyDoors() {
    const travel = this.doorOpen * (DOOR_HALF_WIDTH * 0.96);
    for (const { leaf, window, closedZ, direction } of this.doorLeaves) {
      leaf.position.z = closedZ + direction * travel;
      window.position.z = leaf.position.z;
    }
  }

  // Half-extent of the whole unit along Z, used for the "am I aboard" test.
  get halfLength() {
    return CAR_LENGTH + CAR_GAP / 2;
  }

  update(delta) {
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
        const target = STATIONS[this.targetIndex].z;
        const remaining = target - this.group.position.z;
        const distance = Math.abs(remaining);
        const stoppingDistance = (this.speed * this.speed) / (2 * DECELERATION);

        if (distance <= stoppingDistance) {
          this.speed = Math.max(0, this.speed - DECELERATION * delta);
        } else {
          this.speed = Math.min(MAX_SPEED, this.speed + ACCELERATION * delta);
        }

        // Never stall short of the platform.
        if (distance > 0.3 && this.speed < 0.4) this.speed = 0.4;

        this.group.position.z += Math.sign(remaining) * this.speed * delta;

        if (Math.abs(target - this.group.position.z) < 0.3 && this.speed < 0.6) {
          this.group.position.z = target;
          this.speed = 0;
          this.stationIndex = this.targetIndex;
          this.targetIndex = (this.targetIndex + 1) % STATIONS.length;
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

    this.applyDoors();

    // Swap the marker lights over when the unit changes ends at a terminus.
    const heading = Math.sign(STATIONS[this.targetIndex].z - this.group.position.z);
    if (heading !== 0 && heading !== this.direction) {
      this.direction = heading;
      this.applyLights();
    }

    // Roll the wheels at whatever speed we are actually doing.
    if (this.speed > 0) {
      const spin = (this.speed * delta) / WHEEL_RADIUS;
      for (const wheel of this.wheels) wheel.rotateY(spin);
    }

    // How far the whole train moved this frame - anyone aboard rides along.
    return this.group.position.z - previousZ;
  }

  // True when a world-space point is inside the saloon. The X range reaches
  // out to the platform edge so stepping across the gap does not drop you.
  contains(x, z) {
    const localZ = z - this.group.position.z;
    return (
      x > -INNER_HALF_WIDTH &&
      x < 1.6 &&
      Math.abs(localZ) < this.halfLength
    );
  }

  // Solid parts of the bodyshell, in train-local Z. The offset() closure keeps
  // them attached as the unit runs, and the doorways only become solid once
  // the doors are most of the way shut.
  colliders() {
    const boxes = [];
    const offset = () => this.group.position.z;
    const top = FLOOR_Y + CAR_HEIGHT;
    const outer = CAR_WIDTH / 2;
    const inner = outer - WALL_THICKNESS - 0.08;

    for (const carCentre of [(CAR_LENGTH + CAR_GAP) / 2, -(CAR_LENGTH + CAR_GAP) / 2]) {
      // Blind side: one unbroken wall.
      boxes.push({
        minX: -outer, maxX: -inner,
        minZ: carCentre - HALF_LENGTH, maxZ: carCentre + HALF_LENGTH,
        minY: FLOOR_Y, maxY: top, offset,
      });

      // Platform side: the panels between the door openings.
      for (const segment of wallSegments()) {
        boxes.push({
          minX: inner, maxX: outer,
          minZ: carCentre + segment.centre - segment.length / 2,
          maxZ: carCentre + segment.centre + segment.length / 2,
          minY: FLOOR_Y, maxY: top, offset,
        });
      }

      // The openings themselves, solid only while the doors are shut.
      for (const doorCentre of DOOR_CENTRES) {
        boxes.push({
          minX: inner, maxX: outer,
          minZ: carCentre + doorCentre - DOOR_HALF_WIDTH,
          maxZ: carCentre + doorCentre + DOOR_HALF_WIDTH,
          minY: FLOOR_Y, maxY: FLOOR_Y + DOOR_HEIGHT, offset,
          active: () => this.doorOpen < 0.55,
        });
      }

      // Both ends of each car. The two inner ends face each other across the
      // gangway, so they get a gap you can walk through; the outer ends of the
      // formation stay solid.
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
            minY: FLOOR_Y, maxY: top, offset,
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
