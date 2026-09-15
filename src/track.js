import * as THREE from 'three';
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

// One straight run of ballast + sleepers + rails, `length` long, centred on
// its own local origin along Z the same way the main line's pieces are -
// callers position and rotate the returned group to lay it along whichever
// segment of a curved path it belongs to.
function createTrackSegment(length) {
  const segment = new THREE.Group();

  // Same trapezoidal profile as the main line's ballast, extruded to this
  // segment's own length instead of the fixed TRACK_LENGTH.
  const shape = new THREE.Shape();
  shape.moveTo(-3.4, 0);
  shape.lineTo(3.4, 0);
  shape.lineTo(2.4, BALLAST_HEIGHT);
  shape.lineTo(-2.4, BALLAST_HEIGHT);
  shape.closePath();
  const ballastGeometry = new THREE.ExtrudeGeometry(shape, { depth: length, bevelEnabled: false });
  ballastGeometry.translate(0, 0, -length / 2);

  const ballast = new THREE.Mesh(
    ballastGeometry,
    new THREE.MeshStandardMaterial({ color: 0x6b6560, roughness: 1 })
  );
  ballast.receiveShadow = true;
  segment.add(ballast);

  const sleeperCount = Math.max(1, Math.floor(length / SLEEPER_SPACING));
  const sleepers = new THREE.InstancedMesh(
    new THREE.BoxGeometry(2.6, SLEEPER_HEIGHT, 0.26),
    new THREE.MeshStandardMaterial({ color: 0x4a3b2f, roughness: 0.95 }),
    sleeperCount
  );
  const dummy = new THREE.Object3D();
  const sleeperY = BALLAST_HEIGHT + SLEEPER_HEIGHT / 2;
  for (let i = 0; i < sleeperCount; i++) {
    dummy.position.set(0, sleeperY, -length / 2 + i * SLEEPER_SPACING);
    dummy.rotation.y = Math.sin(i * 12.9898) * 0.01;
    dummy.updateMatrix();
    sleepers.setMatrixAt(i, dummy.matrix);
  }
  sleepers.castShadow = true;
  sleepers.receiveShadow = true;
  segment.add(sleepers);

  const railGeometry = new THREE.BoxGeometry(0.09, RAIL_HEIGHT, length);
  const railMaterial = new THREE.MeshStandardMaterial({
    color: 0xb8b4ae,
    roughness: 0.35,
    metalness: 0.85,
  });
  const railY = BALLAST_HEIGHT + SLEEPER_HEIGHT + RAIL_HEIGHT / 2;
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(railGeometry, railMaterial);
    rail.position.set((side * TRACK_GAUGE) / 2, railY, 0);
    rail.castShadow = true;
    segment.add(rail);
  }

  return segment;
}

// Builds track along an arbitrary polyline of {x, z} waypoints - one
// straight segment per pair of consecutive points, each laid at that
// segment's own length and rotated to its own heading. This is what lets the
// branch line curve: the curve is really just several short straight
// segments meeting at slightly different angles, in keeping with the low-poly
// style everything else in this scene already uses.
export function createTrackAlongPath(waypoints) {
  const track = new THREE.Group();
  track.name = 'branch-track';

  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i];
    const b = waypoints[i + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const length = Math.hypot(dx, dz);
    if (length < 0.001) continue;

    const segment = createTrackSegment(length);
    segment.position.set((a.x + b.x) / 2, 0, (a.z + b.z) / 2);
    // Same heading convention as RailPath.positionAt(): rotation.y = 0 faces
    // -Z, so atan2(dx, -dz) rotates the segment's local -Z axis onto (dx, dz).
    segment.rotation.y = Math.atan2(dx, -dz);
    track.add(segment);
  }

  return track;
}
