import * as THREE from 'three';

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
const BOOT_FORWARD = -0.22; // kept short so the boots sit under you

const STRIDE_LENGTH = 1.4; // metres of travel per half stride
const STEP_REACH = 0.3; // how far a boot swings fore and aft
const STEP_LIFT = 0.14;

const handMaterial = new THREE.MeshStandardMaterial({
  color: 0xa9e8c0,
  roughness: 0.8,
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

// A chunky three-dimensional hand: solid rounded palm, three fat fingers and a
// thumb, each of three capsule segments on nested pivots so the curl happens at
// the knuckles.
function makeHand(side) {
  // A simple sphere. Kept in its own group (rather than positioned directly)
  // so the update loop's per-frame bob/position logic - which targets this
  // group - does not need to change if the hand shape changes again later.
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), handMaterial);
  sphere.castShadow = true;

  const group = new THREE.Group();
  group.add(sphere);
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
