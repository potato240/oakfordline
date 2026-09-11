import * as THREE from 'three';
import { RAIL_TOP_Y, BALLAST_HEIGHT } from './layout.js';
import { playBell } from './audio.js';

const ROAD_HALF_LENGTH = 60; // how far the road runs either side of the line
const ROAD_HALF_WIDTH = 3.5; // half the road width, measured along Z
const BOOM_LENGTH = ROAD_HALF_WIDTH * 2 + 0.6; // reaches the far kerb
const POST_X = 5.6; // how far out from the track centre the posts stand

// Warning starts this far out, and clears once the train is this far past.
const WARN_DISTANCE = 150;
const CLEAR_DISTANCE = 34;

const BARRIER_SECONDS = 3.2; // time for a boom to travel up or down
const BELL_INTERVAL = 0.62;
const FLASH_INTERVAL = 0.55;
const AUDIBLE_RANGE = 110;

const materials = {
  road: new THREE.MeshStandardMaterial({ color: 0x38383a, roughness: 0.95 }),
  marking: new THREE.MeshStandardMaterial({ color: 0xd8d4c4, roughness: 0.9 }),
  deck: new THREE.MeshStandardMaterial({ color: 0x4a4238, roughness: 0.95 }),
  post: new THREE.MeshStandardMaterial({ color: 0xe8e4dc, roughness: 0.7 }),
  boomWhite: new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.6 }),
  boomRed: new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.6 }),
};

function createRoad() {
  const group = new THREE.Group();

  const road = new THREE.Mesh(
    new THREE.BoxGeometry(ROAD_HALF_LENGTH * 2, 0.06, ROAD_HALF_WIDTH * 2),
    materials.road
  );
  road.position.y = 0.03;
  road.receiveShadow = true;
  group.add(road);

  // Dashed centre line, broken where the railway crosses.
  for (let x = -ROAD_HALF_LENGTH; x < ROAD_HALF_LENGTH; x += 6) {
    if (Math.abs(x) < 9) continue;
    const dash = new THREE.Mesh(new THREE.BoxGeometry(3, 0.02, 0.16), materials.marking);
    dash.position.set(x + 1.5, 0.07, 0);
    group.add(dash);
  }

  // Timber deck carrying the road over the ballast and between the rails.
  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(7.2, RAIL_TOP_Y - BALLAST_HEIGHT + 0.06, ROAD_HALF_WIDTH * 2),
    materials.deck
  );
  deck.position.y = BALLAST_HEIGHT + (RAIL_TOP_Y - BALLAST_HEIGHT) / 2;
  deck.receiveShadow = true;
  group.add(deck);

  return group;
}

// One barrier assembly: a post, two flashing lamps and a boom that lowers.
//
// The road runs along X and the railway along Z, so a boom that blocks the
// road has to span Z - across the carriageway, not along it. Each barrier
// stands on one approach, at the opposite road edge from its partner, so the
// pair closes the road from both sides.
function createBarrier(side, lamps) {
  const assembly = new THREE.Group();

  const postX = side * POST_X;
  const postZ = side * (ROAD_HALF_WIDTH + 0.5);
  const direction = -side; // the boom reaches towards the far kerb

  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.16, 2.6, 10),
    materials.post
  );
  post.position.y = 1.3;
  post.castShadow = true;
  assembly.add(post);

  // Two red lamps side by side, flashed alternately.
  for (const offset of [-0.42, 0.42]) {
    const lamp = new THREE.Mesh(
      new THREE.CylinderGeometry(0.19, 0.19, 0.1, 12),
      new THREE.MeshStandardMaterial({
        color: 0x5c1512,
        emissive: 0xff2a1a,
        emissiveIntensity: 0,
        roughness: 0.4,
      })
    );
    lamp.rotation.x = Math.PI / 2;
    lamp.position.set(0, 2.5, offset);
    assembly.add(lamp);
    lamps.push({ mesh: lamp, phase: offset > 0 ? 1 : 0 });
  }

  // Boom pivots at the post, running along Z so it spans the carriageway.
  const pivot = new THREE.Group();
  pivot.position.y = 1.55;

  const boomGeometry = new THREE.BoxGeometry(0.13, 0.13, BOOM_LENGTH);
  boomGeometry.translate(0, 0, (direction * BOOM_LENGTH) / 2);
  const boom = new THREE.Mesh(boomGeometry, materials.boomWhite);
  boom.castShadow = true;
  pivot.add(boom);

  // Red bands along the boom.
  for (let i = 0; i < 4; i++) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.8), materials.boomRed);
    band.position.z = direction * (0.9 + i * 1.8);
    pivot.add(band);
  }

  // Skirt hanging under the boom, as on full-barrier crossings.
  const skirt = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, 0.34, BOOM_LENGTH - 0.6),
    materials.boomWhite
  );
  skirt.position.set(0, -0.28, (direction * (BOOM_LENGTH - 0.6)) / 2);
  pivot.add(skirt);

  assembly.add(pivot);
  assembly.position.set(postX, 0, postZ);

  return { assembly, pivot, direction, postX, postZ };
}

export class Crossing {
  constructor(z) {
    this.z = z;
    this.group = new THREE.Group();
    this.group.name = `crossing:${z}`;
    this.group.position.z = z;

    this.lamps = [];
    this.barriers = [];

    this.group.add(createRoad());

    for (const side of [-1, 1]) {
      const barrier = createBarrier(side, this.lamps);
      this.group.add(barrier.assembly);
      this.barriers.push(barrier);
    }

    this.active = false;
    this.lowered = 0; // 0 fully raised, 1 fully down
    this.bellTimer = 0;
    this.flashTimer = 0;
    this.flashState = 0;

    this.applyBooms();
  }

  // Posts are always solid; a boom only blocks the road once it is down.
  colliders() {
    const boxes = [];

    for (const barrier of this.barriers) {
      const postX = barrier.postX;
      const postZ = this.z + barrier.postZ;

      boxes.push({
        minX: postX - 0.2, maxX: postX + 0.2,
        minZ: postZ - 0.2, maxZ: postZ + 0.2,
        minY: 0, maxY: 2.6,
      });

      // Lowered, the boom lies across the road - so it blocks along Z.
      const reach = barrier.direction * BOOM_LENGTH;
      boxes.push({
        minX: postX - 0.16, maxX: postX + 0.16,
        minZ: Math.min(postZ, postZ + reach), maxZ: Math.max(postZ, postZ + reach),
        minY: 1.2, maxY: 1.75,
        active: () => this.lowered > 0.6,
      });
    }

    return boxes;
  }

  applyBooms() {
    for (const barrier of this.barriers) {
      // Raised is vertical; lowered is horizontal across the road.
      barrier.pivot.rotation.x = -barrier.direction * (1 - this.lowered) * (Math.PI / 2);
    }
  }

  setLamps(on) {
    for (const lamp of this.lamps) {
      const lit = on && this.flashState === lamp.phase;
      lamp.mesh.material.emissiveIntensity = lit ? 2.4 : 0;
      lamp.mesh.material.color.setHex(lit ? 0xff5544 : 0x5c1512);
    }
  }

  update(delta, train, playerPosition) {
    const offset = train.group.position.z - this.z;
    const distance = Math.abs(offset);

    // Approaching if the train is heading towards us rather than away.
    const approaching = Math.sign(-offset) === train.direction && train.speed > 0.2;

    // ...and only if we are on the leg the train is actually working. A train
    // braking into a station brings the next crossing beyond that station
    // inside the warning range, but it is going to stop short of it, so that
    // crossing must stay up. The crossing has to lie between the train and the
    // station it is running to.
    const trainZ = train.group.position.z;
    const toTarget = train.targetZ - trainZ;
    const toCrossing = this.z - trainZ;
    const onThisLeg =
      Math.sign(toCrossing) === Math.sign(toTarget) &&
      Math.abs(toCrossing) <= Math.abs(toTarget);

    this.active =
      (onThisLeg && approaching && distance < WARN_DISTANCE) ||
      distance < CLEAR_DISTANCE;

    // Booms follow the warning state, with a lag so the bell leads them.
    const target = this.active ? 1 : 0;
    const step = delta / BARRIER_SECONDS;
    if (this.lowered < target) this.lowered = Math.min(target, this.lowered + step);
    else if (this.lowered > target) this.lowered = Math.max(target, this.lowered - step);
    this.applyBooms();

    if (this.active) {
      this.flashTimer += delta;
      if (this.flashTimer >= FLASH_INTERVAL) {
        this.flashTimer -= FLASH_INTERVAL;
        this.flashState = this.flashState === 0 ? 1 : 0;
      }
      this.setLamps(true);

      // Bell rings the whole time the crossing is protecting, attenuated by
      // how far the player is standing from it.
      this.bellTimer -= delta;
      if (this.bellTimer <= 0) {
        this.bellTimer += BELL_INTERVAL;

        const dx = playerPosition.x - 0;
        const dz = playerPosition.z - this.z;
        const range = Math.sqrt(dx * dx + dz * dz);
        const falloff = Math.max(0, 1 - range / AUDIBLE_RANGE);

        playBell(falloff * falloff, this.flashState === 0 ? 672 : 640);
      }
    } else {
      this.setLamps(false);
      this.bellTimer = 0;
    }
  }
}
