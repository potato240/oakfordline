import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// A PEAK-style first-person body: just hands and boots, with no arms, legs or
// torso connecting them.
//
// The two halves deliberately live in different spaces:
//
//   hands - children of the CAMERA, so they hold station at the lower corners
//           of the frame however you turn your head, like a held viewmodel.
//   boots - world space, following the player's position and yaw only, so they
//           stay planted and come into view when you look down.
//
// Parenting the boots to the camera would swing them into the sky when you
// look up; putting the hands in world space would let them drift out of frame.

// PEAK holds its hands big and low, well into the bottom corners and slightly
// cropped by the frame edge. Close to the camera and wide apart does that.
const HAND_OUT = 0.4; // sideways from the view centre
const HAND_DROP = 0.3; // below the view centre
const HAND_FORWARD = -0.47; // the camera looks down -Z

const BOOT_OUT = 0.17;
// NEGATIVE, because the camera looks down -Z and the body shares its yaw, so
// forward is -Z here just as it is for HAND_FORWARD. Positive put the boots
// behind the player, permanently out of shot.
//
// The magnitude matters too: at 0.26 the boots sat 81 degrees below horizontal,
// past the bottom edge of the frame even looking straight down. At 0.6 they are
// about 70 degrees - in view when you look down, out of it when you look ahead.
const BOOT_FORWARD = -0.6;

const STRIDE_LENGTH = 1.4; // metres of travel per half stride
const STEP_REACH = 0.3; // how far a boot swings fore and aft
const STEP_LIFT = 0.14;

const handMaterial = new THREE.MeshStandardMaterial({
  color: 0x9fe3b8,
  roughness: 0.75,
});
const bootMaterial = new THREE.MeshStandardMaterial({
  color: 0x5f3327,
  roughness: 0.85,
});
const cuffMaterial = new THREE.MeshStandardMaterial({
  color: 0xa8e6c0,
  roughness: 0.8,
});
const soleMaterial = new THREE.MeshStandardMaterial({
  color: 0xe08a3c,
  roughness: 0.9,
});

// A chunky PEAK-style hand: a big soft palm, three stubby jointed fingers and
// an opposed thumb. Held close to the camera and wide apart so the pair sit in
// the bottom corners of the frame, slightly cropped - together they cover
// about 9% of the screen, which is what makes them read as *your* hands rather
// than props in the distance.
//
// Each finger is three capsule segments on nested pivots, so the curl happens
// at the joints the way a knuckle does, rather than the whole finger bending
// as one rigid banana.
function makeFinger(length, radius, curl) {
  const root = new THREE.Group();

  const proportions = [0.42, 0.33, 0.25];
  let parent = root;

  proportions.forEach((share, i) => {
    const segmentLength = length * share;

    const joint = new THREE.Group();
    // The first segment sits at the knuckle; later ones stack on the previous
    // segment's tip and bend a little further.
    joint.rotation.x = i === 0 ? curl * 0.6 : curl;
    parent.add(joint);

    const bone = new THREE.Mesh(
      new THREE.CapsuleGeometry(radius * (1 - i * 0.13), segmentLength, 3, 8),
      handMaterial
    );
    bone.position.y = segmentLength / 2;
    bone.castShadow = true;
    joint.add(bone);

    const tip = new THREE.Group();
    tip.position.y = segmentLength;
    joint.add(tip);

    parent = tip;
  });

  return root;
}

function makeHand(side) {
  const hand = new THREE.Group();

  // Palm.
  const palm = new THREE.Mesh(
    new RoundedBoxGeometry(0.175, 0.185, 0.078, 5, 0.048),
    handMaterial
  );
  palm.castShadow = true;
  hand.add(palm);

  // Heel of the hand, tapering towards the wrist.
  const heel = new THREE.Mesh(
    new RoundedBoxGeometry(0.15, 0.095, 0.074, 5, 0.042),
    handMaterial
  );
  heel.position.y = -0.115;
  hand.add(heel);

  // Three fingers and a thumb. Splayed slightly, unequal in length, and a
  // little thicker than four would be so the hand stays chunky.
  const fingers = [
    { x: -0.052, length: 0.085, radius: 0.034, splay: 0.2 },  // index
    { x: 0.002, length: 0.094, radius: 0.036, splay: 0.02 },  // middle
    { x: 0.056, length: 0.08, radius: 0.033, splay: -0.19 },  // outer
  ];

  for (const spec of fingers) {
    const finger = makeFinger(spec.length, spec.radius, 0.42);
    finger.position.set(side * spec.x, 0.085, 0);
    finger.rotation.z = side * spec.splay;
    hand.add(finger);
  }

  // Thumb, off the side of the palm and rotated across it.
  const thumb = makeFinger(0.082, 0.036, 0.4);
  thumb.position.set(side * 0.086, -0.055, 0.016);
  thumb.rotation.z = side * 1.2;
  thumb.rotation.x = -0.4;
  hand.add(thumb);

  const group = new THREE.Group();
  group.add(hand);

  // Cock the wrists so the hands frame the view rather than lying flat on.
  group.rotation.z = side * 0.34;
  group.rotation.x = -0.22;
  group.rotation.y = side * -0.18;

  return group;
}

function makeBoot() {
  const boot = new THREE.Group();

  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.115, 14, 10), bootMaterial);
  shell.scale.set(1.0, 0.8, 1.55);
  shell.castShadow = true;
  boot.add(shell);

  const cuff = new THREE.Mesh(
    new THREE.CylinderGeometry(0.082, 0.088, 0.05, 12),
    cuffMaterial
  );
  cuff.position.set(0, 0.075, -0.03);
  boot.add(cuff);

  const toe = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.035, 0.07), soleMaterial);
  toe.position.set(0, 0.045, 0.1);
  boot.add(toe);

  return boot;
}

export class PlayerBody {
  constructor(camera) {
    // Hands ride with the camera.
    this.handRig = new THREE.Group();
    this.handRig.name = 'player-hands';

    this.hands = [makeHand(-1), makeHand(1)];
    this.hands[0].position.set(-HAND_OUT, -HAND_DROP, HAND_FORWARD);
    this.hands[1].position.set(HAND_OUT, -HAND_DROP, HAND_FORWARD);
    for (const hand of this.hands) this.handRig.add(hand);

    camera.add(this.handRig);

    // Boots stay in the world.
    this.group = new THREE.Group();
    this.group.name = 'player-feet';

    this.boots = [makeBoot(), makeBoot()];
    for (const boot of this.boots) this.group.add(boot);

    this.phase = 0;
  }

  // `distance` is how far the player actually moved this frame, so the stride
  // tracks real travel rather than drifting with framerate.
  update(position, yaw, distance, delta) {
    this.group.position.copy(position);
    this.group.rotation.y = yaw;

    const speed = delta > 0 ? distance / delta : 0;
    this.phase += (distance / STRIDE_LENGTH) * Math.PI;

    // Everything settles when you stop moving.
    const effort = Math.min(speed / 6, 1);
    const cycle = Math.sin(this.phase) * effort;
    const lift = Math.abs(Math.cos(this.phase)) * effort;

    // `position` is eye level, so drop to the sole of the boot.
    const groundDrop = -1.7 + 0.09;

    this.boots.forEach((boot, i) => {
      const side = i === 0 ? -1 : 1;
      const swing = i === 0 ? cycle : -cycle;

      boot.position.set(
        side * BOOT_OUT,
        groundDrop + (swing > 0 ? lift * STEP_LIFT : 0),
        BOOT_FORWARD + swing * STEP_REACH
      );
      boot.rotation.x = swing * 0.35;
    });

    // Hands bob against the stride, opposite each other.
    this.hands.forEach((hand, i) => {
      const bob = (i === 0 ? cycle : -cycle) * 0.045;
      hand.position.y = -HAND_DROP + bob;
      hand.position.z = HAND_FORWARD - Math.abs(bob) * 0.35;
    });
  }
}
