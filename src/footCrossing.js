import * as THREE from 'three';

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
const GATE_POST_X = 2.1; // how far out from the track centre each gate stands
const GATE_LENGTH = PATH_HALF_WIDTH * 2 + 0.25; // reaches right across the path
const GATE_SWING_SECONDS = 1.1;
const FENCE_LENGTH = 3.2;

// Closed the moment a train is inbound to this station or still present at
// it; open again the instant it departs. No distance thresholds - the
// crossing sits right next to the platform, so "is this train's business
// with this station finished" is the correct question, not "how far away".

const materials = {
  post: new THREE.MeshStandardMaterial({ color: 0xe8e4dc, roughness: 0.6 }),
  gateWhite: new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.6 }),
  gateRed: new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.6 }),
  fence: new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 0.9 }),
  path: new THREE.MeshStandardMaterial({ color: 0x8c8577, roughness: 1 }),
  signalHousing: new THREE.MeshStandardMaterial({ color: 0x232326, roughness: 0.6 }),
};

function createFence(x, z) {
  const fence = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.9, FENCE_LENGTH),
    materials.fence
  );
  fence.position.set(x, 0.45, z);
  fence.castShadow = true;
  return fence;
}

// One gate assembly: a hinge post, a red/white swinging arm, and a small
// pedestrian signal (red over green) mounted on the same post.
function createGate(side, lamps) {
  const assembly = new THREE.Group();

  const postX = side * GATE_POST_X;
  // The gate hinges at the -Z edge of the path and swings across to +Z.
  const hingeZ = -PATH_HALF_WIDTH;

  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.09, 1.3, 10),
    materials.post
  );
  post.position.y = 0.65;
  post.castShadow = true;
  assembly.add(post);

  // Pedestrian signal: a small dark housing with a red lamp above a green one.
  const housing = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.4, 0.12), materials.signalHousing);
  housing.position.y = 1.55;
  assembly.add(housing);

  const redLampMaterial = new THREE.MeshStandardMaterial({
    color: 0x4a1512,
    emissive: 0xff2a1a,
    emissiveIntensity: 0,
    roughness: 0.4,
  });
  const greenLampMaterial = new THREE.MeshStandardMaterial({
    color: 0x123d1a,
    emissive: 0x2adf4a,
    emissiveIntensity: 0,
    roughness: 0.4,
  });

  const redLamp = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 12), redLampMaterial);
  redLamp.rotation.x = Math.PI / 2;
  redLamp.position.set(0, 1.66, 0.07);
  assembly.add(redLamp);

  const greenLamp = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 12), greenLampMaterial);
  greenLamp.rotation.x = Math.PI / 2;
  greenLamp.position.set(0, 1.44, 0.07);
  assembly.add(greenLamp);

  lamps.push({ red: redLampMaterial, green: greenLampMaterial });

  // The swinging arm. Geometry is shifted so its pivot end sits at the origin
  // and it extends towards +Z, so rotating the pivot about Y swings it
  // between lying along X (open) and spanning across Z (closed).
  const pivot = new THREE.Group();
  pivot.position.set(0, 0, hingeZ);

  const armGeometry = new THREE.BoxGeometry(0.06, 0.9, GATE_LENGTH);
  armGeometry.translate(0, 0, GATE_LENGTH / 2);
  const arm = new THREE.Mesh(armGeometry, materials.gateWhite);
  arm.position.y = 0.75;
  arm.castShadow = true;
  pivot.add(arm);

  for (let i = 0; i < 2; i++) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.5), materials.gateRed);
    band.position.set(0, 0.75, 0.45 + i * 0.9);
    pivot.add(band);
  }

  assembly.add(pivot);
  assembly.position.set(postX, 0, 0);

  // Short fence stubs either side of the post, so the gate reads as part of
  // a boundary rather than standing alone in open ground.
  assembly.add(createFence(postX, hingeZ - FENCE_LENGTH / 2 - 0.1));

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

    // Path deck, just for visual continuity across the ballast.
    const path = new THREE.Mesh(
      new THREE.BoxGeometry(GATE_POST_X * 2 + 1.4, 0.05, PATH_HALF_WIDTH * 2),
      materials.path
    );
    path.position.y = 0.025;
    path.receiveShadow = true;
    this.group.add(path);

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
