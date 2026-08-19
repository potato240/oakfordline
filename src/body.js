import * as THREE from 'three';

// A first-person body you can actually see when you look down - arms out in
// front, legs below, swinging with the walk cycle.
//
// It is NOT parented to the camera. Parenting would pitch the whole body when
// you look up or down, so your feet would swing into the sky. Instead it
// follows the player's position and *yaw only*, which is what makes looking
// down at your own boots read correctly.

// Shoulders sit well below the eye: any closer and the torso swallows the
// whole frame when you look down.
const SHOULDER_DROP = 0.42;
const SHOULDER_HALF_WIDTH = 0.19;
// Chosen so hip + thigh + shin + half the boot equals the 1.7 eye height,
// which puts the soles exactly on the surface the player is standing on.
const HIP_DROP = 0.855;
const HIP_HALF_WIDTH = 0.11;

const STRIDE_LENGTH = 1.5; // metres of travel per half stride
const MAX_SWING = 0.75; // radians at full running speed

const skin = new THREE.MeshStandardMaterial({ color: 0xc98d63, roughness: 0.8 });
const sleeve = new THREE.MeshStandardMaterial({ color: 0x2f4f63, roughness: 0.85 });
const trouser = new THREE.MeshStandardMaterial({ color: 0x333a46, roughness: 0.9 });
const boot = new THREE.MeshStandardMaterial({ color: 0x241f1c, roughness: 0.95 });

// A limb hanging from a pivot: the geometry is shifted down so the pivot sits
// at the joint, which means rotating the pivot swings the limb from the joint.
function makeLimb(width, length, material) {
  const geometry = new THREE.BoxGeometry(width, length, width);
  geometry.translate(0, -length / 2, 0);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  return mesh;
}

function makeArm(side) {
  const pivot = new THREE.Group();
  pivot.position.set(side * SHOULDER_HALF_WIDTH, -SHOULDER_DROP, 0);

  const upper = makeLimb(0.1, 0.3, sleeve);
  pivot.add(upper);

  // Forearm hinges at the elbow and is held forward, so it stays in view.
  const elbow = new THREE.Group();
  elbow.position.y = -0.3;
  elbow.rotation.x = -1.15;
  pivot.add(elbow);

  const forearm = makeLimb(0.09, 0.27, skin);
  elbow.add(forearm);

  const hand = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.13, 0.08), skin);
  hand.position.y = -0.33;
  hand.castShadow = true;
  elbow.add(hand);

  return pivot;
}

function makeLeg(side) {
  const pivot = new THREE.Group();
  pivot.position.set(side * HIP_HALF_WIDTH, -HIP_DROP, 0);

  const thigh = makeLimb(0.13, 0.42, trouser);
  pivot.add(thigh);

  const knee = new THREE.Group();
  knee.position.y = -0.42;
  pivot.add(knee);

  const shin = makeLimb(0.11, 0.38, trouser);
  knee.add(shin);

  const foot = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.09, 0.26), boot);
  foot.position.set(0, -0.38, 0.06);
  foot.castShadow = true;
  knee.add(foot);

  return { pivot, knee };
}

export class PlayerBody {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'player-body';

    // Chest, so looking straight down does not show a hole where you are.
    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.46, 0.18), sleeve);
    chest.position.y = -0.63;
    chest.castShadow = true;
    this.group.add(chest);

    const hips = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.2, 0.19), trouser);
    hips.position.y = -0.9;
    hips.castShadow = true;
    this.group.add(hips);

    this.arms = [makeArm(-1), makeArm(1)];
    this.legs = [makeLeg(-1), makeLeg(1)];

    for (const arm of this.arms) this.group.add(arm);
    for (const leg of this.legs) this.group.add(leg.pivot);

    this.phase = 0;
  }

  // `distance` is how far the player actually moved this frame, so the stride
  // stays in step with real travel rather than drifting against framerate.
  update(position, yaw, distance, delta) {
    this.group.position.copy(position);
    this.group.rotation.y = yaw;

    const speed = delta > 0 ? distance / delta : 0;
    this.phase += (distance / STRIDE_LENGTH) * Math.PI;

    // Swing scales with speed, so standing still means standing still.
    const swing = Math.min(speed / 6, 1) * MAX_SWING;
    const cycle = Math.sin(this.phase) * swing;

    this.legs[0].pivot.rotation.x = cycle;
    this.legs[1].pivot.rotation.x = -cycle;
    // Knees only bend on the backswing, which stops the shin passing through
    // the thigh.
    this.legs[0].knee.rotation.x = Math.max(0, -cycle) * 1.1;
    this.legs[1].knee.rotation.x = Math.max(0, cycle) * 1.1;

    // Arms counter-swing against the legs.
    this.arms[0].rotation.x = -cycle * 0.55;
    this.arms[1].rotation.x = cycle * 0.55;
  }
}
