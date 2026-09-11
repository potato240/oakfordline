import * as THREE from 'three';
import { RAIL_TOP_Y, BALLAST_HEIGHT } from './layout.js';
import { ROAD_HALF_WIDTH } from './crossing.js';

// A pedestrian footpath running alongside a road level crossing, sharing its
// signal posts and its open/closed state - this is deliberately NOT an
// independent crossing with its own approach/clear logic. Real crossings that
// carry both a road and a footpath over the same tracks operate as one unit:
// the same booms-down warning protects both, so the footpath simply mirrors
// whatever the road crossing is already doing.

const PATH_HALF_WIDTH = 1.1; // the footpath is 2.2m wide
const FOOTPATH_GAP = 0.5; // clear gap between the road's edge and the path's
// The path runs parallel to the road, offset to one side of it (arbitrary,
// but consistent) rather than crossing at a different point on the line.
const FOOTPATH_SIDE = 1;
const FOOTPATH_Z = FOOTPATH_SIDE * (ROAD_HALF_WIDTH + FOOTPATH_GAP + PATH_HALF_WIDTH);

const DECK_HALF_WIDTH = 2.6; // must clear the ballast mound's 2.4m-wide top
const GATE_LENGTH = PATH_HALF_WIDTH * 2 + 0.25; // reaches right across the path
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

// A red/green pedestrian signal, mounted directly onto an existing crossing
// barrier post as a child - not a separate post of its own. `post` is the
// actual THREE.Mesh from crossing.js's createBarrier(), so this really is
// the same physical post the road barrier's own lamps are on, just lower
// down it, out of the way of those.
function addPedestrianSignal(post, lamps) {
  const housing = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.46, 0.15), materials.signalHousing);
  housing.position.set(0, 0.45, 0.16);
  housing.castShadow = true;
  post.add(housing);

  const hood = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.07, 0.2), materials.signalHousing);
  hood.position.set(0, 0.67, 0.16);
  post.add(hood);

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

  for (const [material, y] of [[redLampMaterial, 0.58], [greenLampMaterial, 0.34]]) {
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.05, 14), material);
    lamp.rotation.x = Math.PI / 2;
    lamp.position.set(0, y, 0.24);
    post.add(lamp);

    const visor = new THREE.Mesh(
      new THREE.CylinderGeometry(0.085, 0.085, 0.06, 14, 1, true, 0, Math.PI),
      materials.signalHousing
    );
    visor.rotation.set(0, 0, Math.PI / 2);
    visor.position.set(0, y + 0.05, 0.24);
    post.add(visor);
  }

  lamps.push({ red: redLampMaterial, green: greenLampMaterial });
}

// The swinging gate itself: a hinge post (unlit - the signal lives on the
// crossing's own post, some way off across the road) and a proper gate
// frame, not a single flat plank.
//
// `postX` is shared with the crossing's own barrier on this side, so the
// pedestrian gate lines up with the road barrier it belongs to rather than
// standing at some independently chosen distance out.
function createGate(side, postX) {
  const assembly = new THREE.Group();

  // The gate hinges at the near edge of the path (closer to the road) and
  // swings out to the far edge - i.e. away from the track, not across it,
  // when it opens.
  const hingeZ = -FOOTPATH_SIDE * PATH_HALF_WIDTH;

  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.3, 10), materials.post);
  post.position.y = 0.65;
  post.castShadow = true;
  assembly.add(post);

  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), materials.post);
  cap.position.y = 1.3;
  assembly.add(cap);

  const pivot = new THREE.Group();
  pivot.position.set(0, 0, hingeZ);

  function railGeometry(length) {
    const geometry = new THREE.BoxGeometry(0.06, 0.07, length);
    geometry.translate(0, 0, length / 2);
    return geometry;
  }

  const armDirection = FOOTPATH_SIDE; // the arm extends towards the far edge when shut

  const topRail = new THREE.Mesh(railGeometry(armDirection * GATE_LENGTH), materials.gateWhite);
  topRail.position.y = 0.95;
  topRail.castShadow = true;
  pivot.add(topRail);

  const bottomRail = new THREE.Mesh(railGeometry(armDirection * GATE_LENGTH), materials.gateWhite);
  bottomRail.position.y = 0.25;
  bottomRail.castShadow = true;
  pivot.add(bottomRail);

  const picketCount = 5;
  for (let i = 0; i < picketCount; i++) {
    const z = armDirection * (GATE_LENGTH / picketCount) * (i + 0.5);
    const picket = new THREE.Mesh(
      new THREE.BoxGeometry(0.045, 0.72, 0.06),
      i % 2 === 0 ? materials.gateWhite : materials.gateRed
    );
    picket.position.set(0, 0.6, z);
    picket.castShadow = true;
    pivot.add(picket);
  }

  const braceLength = Math.hypot(GATE_LENGTH, 0.7);
  const brace = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, braceLength), materials.gateWhite);
  brace.position.set(0, 0.6, (armDirection * GATE_LENGTH) / 2);
  brace.rotation.x = Math.atan2(0.7, GATE_LENGTH) * armDirection;
  pivot.add(brace);

  const endPost = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.0, 0.08), materials.gateRed);
  endPost.position.set(0, 0.6, armDirection * GATE_LENGTH);
  endPost.castShadow = true;
  pivot.add(endPost);

  assembly.add(pivot);
  assembly.position.set(0, 0, 0); // positioned by the caller, in path-local space

  // Fencing and a warning sign flanking the hinge post.
  assembly.add(createFence(0, hingeZ - FOOTPATH_SIDE * (FENCE_LENGTH / 2 + 0.15)));
  assembly.add(createWarningSign(side * 0.6, hingeZ - FOOTPATH_SIDE * 0.3));

  return { assembly, pivot, side };
}

export class FootCrossing {
  // `crossing` is the road Crossing this footpath runs alongside - state,
  // position and even the signal posts are all taken directly from it, so
  // the two can never fall out of sync with each other.
  constructor(crossing) {
    this.crossing = crossing;
    this.z = crossing.z;

    this.group = new THREE.Group();
    this.group.name = `footcrossing:${crossing.z}`;
    this.group.position.z = crossing.z;

    // Everything below is built in "path-local" space, where 0 sits on the
    // footpath's own centreline - this group carries that whole local frame
    // out to FOOTPATH_Z, clear of the road.
    const pathGroup = new THREE.Group();
    pathGroup.position.z = FOOTPATH_Z;
    this.group.add(pathGroup);

    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(DECK_HALF_WIDTH * 2, RAIL_TOP_Y - BALLAST_HEIGHT + 0.05, PATH_HALF_WIDTH * 2),
      materials.deck
    );
    deck.position.y = BALLAST_HEIGHT + (RAIL_TOP_Y - BALLAST_HEIGHT) / 2;
    deck.receiveShadow = true;
    pathGroup.add(deck);

    this.lamps = [];
    this.gates = [];

    for (const barrier of crossing.barriers) {
      const side = Math.sign(barrier.postX) || 1;

      // The signal lives on the crossing's own post - not a new one.
      addPedestrianSignal(barrier.post, this.lamps);

      const gate = createGate(side, barrier.postX);
      gate.assembly.position.set(barrier.postX, 0, 0);
      pathGroup.add(gate.assembly);
      this.gates.push(gate);

      // Approach path either side of the deck, out to this gate.
      const pathLength = Math.abs(barrier.postX) - DECK_HALF_WIDTH + 0.6;
      const approach = new THREE.Mesh(
        new THREE.BoxGeometry(pathLength, 0.06, PATH_HALF_WIDTH * 2),
        materials.path
      );
      approach.position.set(
        side * (DECK_HALF_WIDTH + pathLength / 2 - 0.05),
        0.03,
        0
      );
      approach.receiveShadow = true;
      pathGroup.add(approach);
    }

    for (const edgeZ of [-PATH_HALF_WIDTH, PATH_HALF_WIDTH]) {
      const farPostX = Math.max(...crossing.barriers.map((b) => Math.abs(b.postX)));
      const kerb = new THREE.Mesh(
        new THREE.BoxGeometry(farPostX * 2 + 0.4, 0.1, 0.1),
        materials.kerb
      );
      kerb.position.set(0, RAIL_TOP_Y * 0.35, edgeZ);
      pathGroup.add(kerb);
    }

    this.applyGates();
    this.applyLamps();
  }

  applyGates() {
    const swing = this.crossing.lowered;
    for (const gate of this.gates) {
      // Shut: arm lies flat, spanning the path (rotation 0). Open: it swings
      // outward, away from the track - which for the +X side means turning
      // further towards +X, and for the -X side further towards -X.
      const openAngle = gate.side > 0 ? Math.PI / 2 : -Math.PI / 2;
      gate.pivot.rotation.y = openAngle * (1 - swing);
    }
  }

  applyLamps() {
    const closed = this.crossing.active;
    for (const lamp of this.lamps) {
      lamp.red.emissiveIntensity = closed ? 1.4 : 0;
      lamp.green.emissiveIntensity = closed ? 0 : 1.4;
    }
  }

  // Solid only once the parent crossing's booms are most of the way down -
  // exactly the same threshold the road collider itself uses.
  colliders() {
    const boxes = [];
    for (const gate of this.gates) {
      const postX = gate.assembly.position.x;
      const reach = (gate.side > 0 ? 1 : -1) * GATE_LENGTH;
      boxes.push({
        minX: Math.min(postX, postX + reach),
        maxX: Math.max(postX, postX + reach),
        minZ: this.z + FOOTPATH_Z - PATH_HALF_WIDTH - 0.1,
        maxZ: this.z + FOOTPATH_Z + PATH_HALF_WIDTH + 0.1,
        minY: 0.3,
        maxY: 1.2,
        active: () => this.crossing.lowered > 0.6,
      });
    }
    return boxes;
  }

  // No own timers or approach logic at all - just read what the road
  // crossing has already worked out this frame. Call this after
  // crossing.update() so the values it reads are current.
  update() {
    this.applyGates();
    this.applyLamps();
  }
}
