// The second line: it leaves the main line at Marsden Cross on its own new
// platform, runs parallel to the main line as far as a second new platform at
// Kingsford, then curves away - an S-bend that shifts it sideways and hands
// it back onto a straight, ordinary (Z-aligned) alignment - out to two brand
// new stations the main line never reaches.
//
// The whole route is kept at x >= 70 everywhere on purpose: every existing
// road level crossing on the main line reaches out to x = +-60 (its
// ROAD_HALF_LENGTH), so x >= 70 clears all seven of them regardless of which
// one the branch happens to run near in Z. That is what decided the curve's
// shape below, not aesthetics.
//
// The curve is a reverse S (quarter-turn right, then quarter-turn left of the
// same angle) rather than a single bend to a new heading, specifically so the
// branch hands back onto a plain Z-aligned straight before reaching its own
// stations. Z-aligned stations can reuse station.js completely unmodified -
// just offset in X, the same trick createStation() already gets for the
// shared Marsden Cross / Kingsford platforms - with no need to rotate
// geometry or extend the (AABB-only) collision system to handle rotated
// boxes for a station that only ever sits still.

const BRANCH_X = 70; // the parallel section's distance out from the main line

// Sample a two-arc S-curve (right turn, then an equal left turn) that starts
// and ends heading due south (-Z), so track built from these waypoints joins
// cleanly onto a Z-aligned straight at both ends.
function buildSCurve(startX, startZ, radius, angleDeg, segmentsPerArc) {
  const angleRad = (angleDeg * Math.PI) / 180;
  let x = startX;
  let z = startZ;
  let dirX = 0;
  let dirZ = -1; // heading south

  const points = [{ x, z }];

  function stepArc(turnRight, totalAngle, segments) {
    const step = totalAngle / segments;
    const sign = turnRight ? -1 : 1;
    for (let i = 0; i < segments; i++) {
      const cos = Math.cos(sign * step);
      const sin = Math.sin(sign * step);
      const nextDirX = dirX * cos - dirZ * sin;
      const nextDirZ = dirX * sin + dirZ * cos;
      dirX = nextDirX;
      dirZ = nextDirZ;

      const arcLength = radius * step;
      x += dirX * arcLength;
      z += dirZ * arcLength;
      points.push({ x, z });
    }
  }

  // turnRight = false curves toward +X here - away from the main line, which
  // sits at x = 0.
  stepArc(false, angleRad, segmentsPerArc);
  stepArc(true, angleRad, segmentsPerArc);

  return points;
}

// 60 samples per arc (120 across the whole S-bend) is fine enough that the
// track built from it - a single merged mesh per material in track.js, not
// one mesh per segment - reads as a genuinely smooth curve rather than a
// chain of visibly straight pieces, at no extra draw-call cost.
const curveStart = { x: BRANCH_X, z: -1220 };
const curvePoints = buildSCurve(curveStart.x, curveStart.z, 100, 42, 60);
const curveEnd = curvePoints[curvePoints.length - 1];

export const BRANCH_WAYPOINTS = [
  { x: BRANCH_X, z: -840 }, // Marsden Cross Branch
  { x: BRANCH_X, z: -1120 }, // Kingsford Branch
  { x: BRANCH_X, z: -1220 }, // short clear throat before the curve starts
  ...curvePoints.slice(1),
  { x: curveEnd.x, z: -1500 }, // straight again - Fenwick Bridge
  { x: curveEnd.x, z: -1700 }, // Redgate, the branch terminus
];

// Each stop's platformSide follows the same convention Train.js already uses
// for the main line: the platform is always built on the same side the
// branch train's own door logic expects, from src/train.js's
// applyDoors()/colliders(), which key off platformSide the identical way.
export const BRANCH_STATIONS = [
  { name: 'Marsden Cross Branch', x: BRANCH_X, z: -840, platformSide: 1 },
  { name: 'Kingsford Branch', x: BRANCH_X, z: -1120, platformSide: 1 },
  { name: 'Fenwick Bridge', x: curveEnd.x, z: -1500, platformSide: 1 },
  { name: 'Redgate', x: curveEnd.x, z: -1700, platformSide: 1 },
];

// Turns the waypoint polyline into a "distance travelled" -> {x, z, heading}
// function, the same role STATIONS[i].z plays for the main line's Train -
// except the branch needs a 2D position and a heading (for which way the
// train itself is facing), not just a scalar Z.
export class RailPath {
  constructor(waypoints) {
    this.waypoints = waypoints;
    this.segments = [];

    let cumulative = 0;
    for (let i = 0; i < waypoints.length - 1; i++) {
      const a = waypoints[i];
      const b = waypoints[i + 1];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const length = Math.hypot(dx, dz);
      this.segments.push({
        a,
        b,
        length,
        startDistance: cumulative,
        dirX: dx / length,
        dirZ: dz / length,
      });
      cumulative += length;
    }
    this.totalLength = cumulative;
  }

  // The cumulative distance along the path at which a given waypoint sits -
  // used to place stations, which in this design always sit exactly on a
  // waypoint.
  distanceAt(waypoint) {
    for (const segment of this.segments) {
      if (segment.a === waypoint) return segment.startDistance;
    }
    // The final waypoint is only ever a segment's `b`, never an `a`.
    const last = this.segments[this.segments.length - 1];
    if (last.b === waypoint) return last.startDistance + last.length;
    throw new Error('waypoint not found on this path');
  }

  // World position and heading (radians, matching THREE's rotation.y - 0
  // faces -Z) at a distance along the path. Clamped to the ends.
  positionAt(distance) {
    const clamped = Math.max(0, Math.min(this.totalLength, distance));

    let segment = this.segments[0];
    for (const candidate of this.segments) {
      if (clamped >= candidate.startDistance) segment = candidate;
      else break;
    }

    const into = clamped - segment.startDistance;
    const x = segment.a.x + segment.dirX * into;
    const z = segment.a.z + segment.dirZ * into;
    // THREE's rotation.y = 0 faces -Z; atan2(dirX, -dirZ) gives the yaw that
    // rotates the model's local -Z axis onto (dirX, dirZ).
    const heading = Math.atan2(segment.dirX, -segment.dirZ);

    return { x, z, heading };
  }

  // Shortest distance from an arbitrary point to the path - used to keep
  // trees and hills off a curved corridor, where a single "how far from
  // x = 0" check (fine for the dead-straight main line) cannot work.
  distanceToPoint(px, pz) {
    let closest = Infinity;
    for (const segment of this.segments) {
      const abx = segment.b.x - segment.a.x;
      const abz = segment.b.z - segment.a.z;
      const apx = px - segment.a.x;
      const apz = pz - segment.a.z;
      const t = Math.max(
        0,
        Math.min(1, (apx * abx + apz * abz) / (segment.length * segment.length))
      );
      const cx = segment.a.x + abx * t;
      const cz = segment.a.z + abz * t;
      const distance = Math.hypot(px - cx, pz - cz);
      if (distance < closest) closest = distance;
    }
    return closest;
  }
}

export const BRANCH_PATH = new RailPath(BRANCH_WAYPOINTS);
