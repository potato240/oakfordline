import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  TRACK_GAUGE,
  TRACK_LENGTH,
  BALLAST_HEIGHT,
  SLEEPER_HEIGHT,
  RAIL_HEIGHT,
} from './layout.js';

const SLEEPER_SPACING = 0.65;

// Crushed stone bed. Slightly wider at the base than the top, like the real
// trapezoidal profile.
function createBallast() {
  const shape = new THREE.Shape();
  shape.moveTo(-3.4, 0);
  shape.lineTo(3.4, 0);
  shape.lineTo(2.4, BALLAST_HEIGHT);
  shape.lineTo(-2.4, BALLAST_HEIGHT);
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: TRACK_LENGTH,
    bevelEnabled: false,
  });
  // Extrude runs along +Z from the shape plane; centre it on the origin.
  geometry.translate(0, 0, -TRACK_LENGTH / 2);

  const ballast = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ color: 0x6b6560, roughness: 1 })
  );
  ballast.receiveShadow = true;
  ballast.name = 'ballast';
  return ballast;
}

// One instanced mesh for every sleeper - hundreds of identical boxes cost a
// single draw call this way.
function createSleepers() {
  const count = Math.floor(TRACK_LENGTH / SLEEPER_SPACING);

  const sleepers = new THREE.InstancedMesh(
    new THREE.BoxGeometry(2.6, SLEEPER_HEIGHT, 0.26),
    new THREE.MeshStandardMaterial({ color: 0x4a3b2f, roughness: 0.95 }),
    count
  );

  const dummy = new THREE.Object3D();
  const y = BALLAST_HEIGHT + SLEEPER_HEIGHT / 2;

  for (let i = 0; i < count; i++) {
    const z = -TRACK_LENGTH / 2 + i * SLEEPER_SPACING;
    dummy.position.set(0, y, z);
    // A touch of scatter so the rhythm does not read as perfectly machined.
    dummy.rotation.y = (Math.sin(i * 12.9898) * 0.5) * 0.02;
    dummy.updateMatrix();
    sleepers.setMatrixAt(i, dummy.matrix);
  }

  sleepers.castShadow = true;
  sleepers.receiveShadow = true;
  sleepers.name = 'sleepers';
  return sleepers;
}

function createRails() {
  const rails = new THREE.Group();
  rails.name = 'rails';

  const geometry = new THREE.BoxGeometry(0.09, RAIL_HEIGHT, TRACK_LENGTH);
  const material = new THREE.MeshStandardMaterial({
    color: 0xb8b4ae,
    roughness: 0.35,
    metalness: 0.85,
  });

  const y = BALLAST_HEIGHT + SLEEPER_HEIGHT + RAIL_HEIGHT / 2;

  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(geometry, material);
    rail.position.set((side * TRACK_GAUGE) / 2, y, 0);
    rail.castShadow = true;
    rails.add(rail);
  }

  return rails;
}

export function createTrack() {
  const track = new THREE.Group();
  track.name = 'track';
  track.add(createBallast(), createSleepers(), createRails());
  return track;
}

// Same trapezoidal ballast profile as the main line's, but as a standalone
// helper so it can be built once per waypoint pair and merged, rather than
// built once for the whole fixed TRACK_LENGTH.
function ballastShape() {
  const shape = new THREE.Shape();
  shape.moveTo(-3.4, 0);
  shape.lineTo(3.4, 0);
  shape.lineTo(2.4, BALLAST_HEIGHT);
  shape.lineTo(-2.4, BALLAST_HEIGHT);
  shape.closePath();
  return shape;
}

// Builds track along an arbitrary polyline of {x, z} waypoints. The branch
// line's curve is really several short straight pieces meeting at slightly
// different headings - one per waypoint pair - which is what lets it curve
// at all without a spline library. Left as one mesh per piece, a curve fine
// enough to look smooth (BRANCH_WAYPOINTS samples the S-bend at 60 points
// per arc) would mean well over a hundred draw calls for the branch alone,
// against a scene that otherwise sits around 410 total - so every piece's
// ballast geometry is merged into a single mesh, and likewise for the rails,
// leaving exactly one draw call per material no matter how many waypoints
// the path is sampled at. Sleepers stay instanced, as everywhere else, in
// one InstancedMesh for the whole path rather than one per piece.
export function createTrackAlongPath(waypoints) {
  const track = new THREE.Group();
  track.name = 'branch-track';

  const shape = ballastShape();
  const ballastGeometries = [];
  const railGeometries = [];
  const sleeperMatrices = [];
  const dummy = new THREE.Object3D();
  const sleeperY = BALLAST_HEIGHT + SLEEPER_HEIGHT / 2;
  const railY = BALLAST_HEIGHT + SLEEPER_HEIGHT + RAIL_HEIGHT / 2;

  // Carries the running distance-since-last-sleeper across waypoint pairs,
  // so the sleeper rhythm stays even along the whole path instead of
  // resetting (and visibly bunching or gapping) at every waypoint.
  let sleeperCursor = 0;
  let sleeperIndex = 0;

  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i];
    const b = waypoints[i + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const length = Math.hypot(dx, dz);
    if (length < 0.001) continue;

    const dirX = dx / length;
    const dirZ = dz / length;
    // Same heading convention as RailPath.positionAt(): rotation.y = 0 faces
    // -Z, so atan2(dx, -dz) rotates the piece's local -Z axis onto (dx, dz).
    const heading = Math.atan2(dx, -dz);

    const transform = new THREE.Matrix4().compose(
      new THREE.Vector3((a.x + b.x) / 2, 0, (a.z + b.z) / 2),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), heading),
      new THREE.Vector3(1, 1, 1)
    );

    const ballastGeometry = new THREE.ExtrudeGeometry(shape, { depth: length, bevelEnabled: false });
    ballastGeometry.translate(0, 0, -length / 2);
    ballastGeometry.applyMatrix4(transform);
    ballastGeometries.push(ballastGeometry);

    for (const side of [-1, 1]) {
      const railGeometry = new THREE.BoxGeometry(0.09, RAIL_HEIGHT, length);
      railGeometry.translate((side * TRACK_GAUGE) / 2, railY, 0);
      railGeometry.applyMatrix4(transform);
      railGeometries.push(railGeometry);
    }

    while (sleeperCursor < length) {
      dummy.position.set(a.x + dirX * sleeperCursor, sleeperY, a.z + dirZ * sleeperCursor);
      dummy.rotation.set(0, heading + Math.sin(sleeperIndex * 12.9898) * 0.01, 0);
      dummy.updateMatrix();
      sleeperMatrices.push(dummy.matrix.clone());
      sleeperCursor += SLEEPER_SPACING;
      sleeperIndex++;
    }
    sleeperCursor -= length;
  }

  const ballast = new THREE.Mesh(
    mergeGeometries(ballastGeometries, false),
    new THREE.MeshStandardMaterial({ color: 0x6b6560, roughness: 1 })
  );
  for (const geometry of ballastGeometries) geometry.dispose();
  ballast.receiveShadow = true;
  ballast.name = 'ballast';
  track.add(ballast);

  const rails = new THREE.Mesh(
    mergeGeometries(railGeometries, false),
    new THREE.MeshStandardMaterial({ color: 0xb8b4ae, roughness: 0.35, metalness: 0.85 })
  );
  for (const geometry of railGeometries) geometry.dispose();
  rails.castShadow = true;
  rails.name = 'rails';
  track.add(rails);

  const sleepers = new THREE.InstancedMesh(
    new THREE.BoxGeometry(2.6, SLEEPER_HEIGHT, 0.26),
    new THREE.MeshStandardMaterial({ color: 0x4a3b2f, roughness: 0.95 }),
    sleeperMatrices.length
  );
  sleeperMatrices.forEach((matrix, index) => sleepers.setMatrixAt(index, matrix));
  sleepers.castShadow = true;
  sleepers.receiveShadow = true;
  sleepers.name = 'sleepers';
  track.add(sleepers);

  return track;
}
