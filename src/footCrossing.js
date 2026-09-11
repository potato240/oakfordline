import * as THREE from 'three';
import { RAIL_TOP_Y, BALLAST_HEIGHT } from './layout.js';

// A pedestrian footpath crossing next to a station: two swinging gates and a
// red/green signal, tied directly to whether a train is inbound to or present
// at THIS station - not to raw distance the way the road level crossings are.
//
// The footpath runs along X, crossing the railway (which runs along Z) at a
// fixed Z offset from the station. Each gate hinges at a post standing just
// clear of the track and swings between folded open (lying along X, flush
// against the fence, clear of the path) and closed (swung round to span the
// path's width in Z, blocking it).

const PATH_HALF_WIDTH = 1.1; // the footpath is 2.2m wide

// The ballast mound's top surface is 2.4m either side of the rails (see
// track.js) - the deck has to span at least that to bridge it, and the gate
// posts have to stand clear beyond it, or they end up planted on the slope.
const DECK_HALF_WIDTH = 2.6;
const GATE_POST_X = 3.35;

const GATE_LENGTH = PATH_HALF_WIDTH * 2 + 0.25; // reaches right across the path
const GATE_SWING_SECONDS = 1.1;
const FENCE_LENGTH = 3.0;

const materials = {
  post: new THREE.MeshStandardMaterial({ color: 0xdcd6c8, roughness: 0.55 }),
  gateWhite: new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.55 }),
  gateRed: new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.55 }),
  fence: new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 0.9 }),
  path: new THREE.MeshStandardMaterial({ color: 0x8c8577, roughness: 1 }),
  kerb: new THREE.MeshStandardMaterial({ color: 0xd8d4cc, roughness: 0.85 }),
  deck: new THREE.MeshStandardMaterial({ color: 0x4a4238, roughness: 0.95 }),
  signalHousing: new THREE.MeshStandardMaterial({ color: 0x1c1c1e, roughness: 0.5, metalness: 0.2 }),
  signPost: new THREE.MeshStandardMaterial({ color: 0x2a2a2c, roughness: 0.6 }),
};

// "STOP LOOK LISTEN" warning sign, drawn to a canvas the same way the station
// name boards are - cheap and sharp compared to modelling letterforms.
function createWarningSignTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 384;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#f4f0e2';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 14;
  ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

  ctx.fillStyle = '#1a1a1a';
  ctx.textAlign = 'center';
  ctx.font = 'bold 76px Georgia, serif';
  ctx.fillText('STOP', canvas.width / 2, 118);
  ctx.font = 'bold 62px Georgia, serif';
  ctx.fillText('LOOK', canvas.width / 2, 210);
  ctx.fillText('LISTEN', canvas.width / 2, 296);

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 8;
  return texture;
}

let warningTexture = null;
function warningSignMaterial() {
  if (!warningTexture) warningTexture = createWarningSignTexture();
  return new THREE.MeshStandardMaterial({ map: warningTexture, roughness: 0.7 });
}

function createFence(x, z) {
  const group = new THREE.Group();

  for (const railY of [0.35, 0.75]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, FENCE_LENGTH), materials.fence);
    rail.position.y = railY;
    rail.castShadow = true;
    group.add(rail);
  }

  for (const localZ of [-FENCE_LENGTH / 2, 0, FENCE_LENGTH / 2]) {
    const stake = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.9, 0.08), materials.fence);
    stake.position.set(0, 0.45, localZ);
    stake.castShadow = true;
    group.add(stake);
  }

  group.position.set(x, 0, z);
  return group;
}

// A small warning sign on its own short post, standing beside the gate.
function createWarningSign(x, z) {
  const group = new THREE.Group();

  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.3, 8), materials.signPost);
  post.position.y = 0.65;
  post.castShadow = true;
  group.add(post);

  const board = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.42, 0.04), warningSignMaterial());
  board.position.y = 1.32;
  board.castShadow = true;
  group.add(board);

  group.position.set(x, 0, z);
  return group;
}

// One gate assembly: a hinge post carrying a pedestrian signal, and a
// swinging gate built as a proper frame (top and bottom rail, pickets, a
// diagonal brace) rather than a single flat plank.
function createGate(side, lamps) {
  const assembly = new THREE.Group();

  const postX = side * GATE_POST_X;
  // The gate hinges at the -Z edge of the path and swings across to +Z.
  const hingeZ = -PATH_HALF_WIDTH;

  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.7, 10), materials.post);
  post.position.y = 0.85;
  post.castShadow = true;
  assembly.add(post);

  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), materials.post);
  cap.position.y = 1.7;
  assembly.add(cap);

  // Pedestrian signal: a hooded housing with a red lamp above a green one,
  // each lamp getting a small visor so it reads as a real signal head rather
  // than two flat discs stuck to a box.
  const housing = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.5, 0.16), materials.signalHousing);
  housing.position.y = 1.55;
  housing.castShadow = true;
  assembly.add(housing);

  const hood = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.22), materials.signalHousing);
  hood.position.y = 1.79;
  assembly.add(hood);

  const redLampMaterial = new THREE.MeshStandardMaterial({
    color: 0x4a1512,
    emissive: 0xff2a1a,
    emissiveIntensity: 0,
    roughness: 0.35,
  });
  const greenLampMaterial = new THREE.MeshStandardMaterial({
    color: 0x123d1a,
    emissive: 0x2adf4a,
    emissiveIntensity: 0,
    roughness: 0.35,
  });

  for (const [material, y] of [[redLampMaterial, 1.68], [greenLampMaterial, 1.44]]) {
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.05, 14), material);
    lamp.rotation.x = Math.PI / 2;
    lamp.position.set(0, y, 0.09);
    assembly.add(lamp);

    const visor = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.06, 14, 1, true, 0, Math.PI), materials.signalHousing);
    visor.rotation.set(0, 0, Math.PI / 2);
    visor.position.set(0, y + 0.05, 0.09);
    assembly.add(visor);
  }

  lamps.push({ red: redLampMaterial, green: greenLampMaterial });

  // The swinging gate. Geometry is shifted so the hinge end sits at the
  // pivot's origin and it extends towards +Z, so rotating the pivot about Y
  // swings it between lying along X (open) and spanning across Z (closed).
  const pivot = new THREE.Group();
  pivot.position.set(0, 0, hingeZ);

  function railGeometry(length) {
    const geometry = new THREE.BoxGeometry(0.06, 0.07, length);
    geometry.translate(0, 0, length / 2);
    return geometry;
  }

  const topRail = new THREE.Mesh(railGeometry(GATE_LENGTH), materials.gateWhite);
  topRail.position.y = 0.95;
  topRail.castShadow = true;
  pivot.add(topRail);

  const bottomRail = new THREE.Mesh(railGeometry(GATE_LENGTH), materials.gateWhite);
  bottomRail.position.y = 0.25;
  bottomRail.castShadow = true;
  pivot.add(bottomRail);

  // Pickets between the rails, red and white in alternating pairs so the
  // gate reads clearly as a hazard barrier rather than a garden fence.
  const picketCount = 5;
  for (let i = 0; i < picketCount; i++) {
    const z = (GATE_LENGTH / picketCount) * (i + 0.5);
    const picket = new THREE.Mesh(
      new THREE.BoxGeometry(0.045, 0.72, 0.06),
      i % 2 === 0 ? materials.gateWhite : materials.gateRed
    );
    picket.position.set(0, 0.6, z);
    picket.castShadow = true;
    pivot.add(picket);
  }

  // Diagonal brace, hinge corner to the far top corner - what makes a gate
  // read as load-bearing rather than a fence panel stood on its side.
  const braceLength = Math.hypot(GATE_LENGTH, 0.7);
  const brace = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, braceLength), materials.gateWhite);
  brace.position.set(0, 0.6, GATE_LENGTH / 2);
  brace.rotation.x = Math.atan2(0.7, GATE_LENGTH);
  pivot.add(brace);

  // Red end post at the free (latching) end, for visibility when closed.
  const endPost = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.0, 0.08), materials.gateRed);
  endPost.position.set(0, 0.6, GATE_LENGTH);
  endPost.castShadow = true;
  pivot.add(endPost);

  assembly.add(pivot);
  assembly.position.set(postX, 0, 0);

  // Fencing running away from the gate on the hinge side, so it reads as
  // part of a boundary rather than standing alone in open ground, plus a
  // warning sign facing anyone approaching the crossing.
  assembly.add(createFence(postX, hingeZ - FENCE_LENGTH / 2 - 0.15));
  assembly.add(createWarningSign(postX + side * 0.6, hingeZ - 0.3));

  return { assembly, pivot, side };
}

export class FootCrossing {
  // `station` is the actual entry from STATIONS, kept by reference (not
  // copied) so it can be compared directly against train.currentStation /
  // train.nextStation, which return that same array's entries. `offset`
  // places the crossing a little way along the platform from the station's
  // own z, clear of the platform structure itself.
  constructor(station, offset) {
    this.station = station;
    this.z = station.z + offset;

    this.group = new THREE.Group();
    this.group.name = `footcrossing:${station.name}`;
    this.group.position.z = this.z;

    // Raised deck bridging the ballast mound up to railhead height, the same
    // technique the road crossing uses - a flat path slab at ground level
    // would sit half a metre below the actual rails and look like the
    // ballast were punching straight through it.
    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(DECK_HALF_WIDTH * 2, RAIL_TOP_Y - BALLAST_HEIGHT + 0.05, PATH_HALF_WIDTH * 2),
      materials.deck
    );
    deck.position.y = BALLAST_HEIGHT + (RAIL_TOP_Y - BALLAST_HEIGHT) / 2;
    deck.receiveShadow = true;
    this.group.add(deck);

    // Level path either side of the deck, out to the gates.
    for (const side of [-1, 1]) {
      const pathLength = GATE_POST_X - DECK_HALF_WIDTH + 0.6;
      const path = new THREE.Mesh(
        new THREE.BoxGeometry(pathLength, 0.06, PATH_HALF_WIDTH * 2),
        materials.path
      );
      path.position.set(side * (DECK_HALF_WIDTH + pathLength / 2 - 0.05), 0.03, 0);
      path.receiveShadow = true;
      this.group.add(path);
    }

    // Kerb boards along both edges, tying the deck and path together visually.
    for (const edgeZ of [-PATH_HALF_WIDTH, PATH_HALF_WIDTH]) {
      const kerb = new THREE.Mesh(
        new THREE.BoxGeometry(GATE_POST_X * 2 + 0.4, 0.1, 0.1),
        materials.kerb
      );
      kerb.position.set(0, RAIL_TOP_Y * 0.35, edgeZ);
      this.group.add(kerb);
    }

    this.lamps = [];
    this.gates = [];

    for (const side of [-1, 1]) {
      const gate = createGate(side, this.lamps);
      this.group.add(gate.assembly);
      this.gates.push(gate);
    }

    this.closed = false;
    this.swing = 0; // 0 fully open, 1 fully closed

    this.applyGates();
    this.applyLamps();
  }

  applyGates() {
    for (const gate of this.gates) {
      // Open: arm lies along X (rotated 90 degrees away from the path).
      // Closed: arm lies along Z, spanning the path.
      const openAngle = gate.side > 0 ? -Math.PI / 2 : Math.PI / 2;
      gate.pivot.rotation.y = openAngle * (1 - this.swing);
    }
  }

  applyLamps() {
    for (const lamp of this.lamps) {
      lamp.red.emissiveIntensity = this.closed ? 1.4 : 0;
      lamp.green.emissiveIntensity = this.closed ? 0 : 1.4;
    }
  }

  // Solid only once the gate has swung most of the way shut.
  colliders() {
    const boxes = [];
    for (const gate of this.gates) {
      const postX = gate.side * GATE_POST_X;
      boxes.push({
        minX: postX - GATE_LENGTH - 0.1,
        maxX: postX + 0.1,
        minZ: this.z - PATH_HALF_WIDTH - 0.1,
        maxZ: this.z + PATH_HALF_WIDTH + 0.1,
        minY: 0.3,
        maxY: 1.2,
        active: () => this.swing > 0.6,
      });
    }
    return boxes;
  }

  update(delta, train) {
    // Closed the moment the train is inbound to this station, or is still
    // present there in any way (arriving, dwelling, or departing) - open
    // again the instant it actually starts running towards somewhere else.
    const inbound = train.nextStation === this.station && train.state === 'running';
    const present = train.currentStation === this.station && train.state !== 'running';
    this.closed = inbound || present;

    const target = this.closed ? 1 : 0;
    const step = delta / GATE_SWING_SECONDS;
    if (this.swing < target) this.swing = Math.min(target, this.swing + step);
    else if (this.swing > target) this.swing = Math.max(target, this.swing - step);

    this.applyGates();
    this.applyLamps();
  }
}
