// Axis-aligned box colliders resolved against the player as a circle in the
// XZ plane. Boxes may carry a Z offset (so the train's walls move with it), an
// X offset (offsetX() - for the branch train, which moves in X as well as Z;
// unset on every other collider so this is a no-op everywhere else) and an
// active() predicate (so a doorway is only solid while its doors are shut).
// offsetX only ever translates a box - it cannot rotate one, so a branch-train
// collider stays axis-aligned even while the train's visual body is banked
// into the curve. That is an accepted approximation: exact at every station
// and on every straight, only approximate for the short stretch of curve
// itself.

const PASSES = 2; // resolving twice settles corners where two boxes meet

export class Colliders {
  constructor() {
    this.boxes = [];
  }

  add(box) {
    this.boxes.push(box);
    return box;
  }

  // Mutates `position`. `feet` and `head` bound the player vertically, so you
  // can walk under a canopy but not through its columns.
  resolve(position, radius, feet, head) {
    for (let pass = 0; pass < PASSES; pass++) {
      for (const box of this.boxes) {
        if (box.active && !box.active()) continue;

        // Anything below your feet or above your head cannot block you.
        if (head <= box.minY || feet >= box.maxY) continue;

        const offset = box.offset ? box.offset() : 0;
        const minZ = box.minZ + offset;
        const maxZ = box.maxZ + offset;

        const offsetX = box.offsetX ? box.offsetX() : 0;
        const minX = box.minX + offsetX;
        const maxX = box.maxX + offsetX;

        const closestX = Math.min(Math.max(position.x, minX), maxX);
        const closestZ = Math.min(Math.max(position.z, minZ), maxZ);

        const dx = position.x - closestX;
        const dz = position.z - closestZ;
        const distanceSq = dx * dx + dz * dz;

        if (distanceSq >= radius * radius) continue;

        if (distanceSq > 1e-8) {
          // Outside the box: push straight out to the surface.
          const distance = Math.sqrt(distanceSq);
          const push = radius - distance;
          position.x += (dx / distance) * push;
          position.z += (dz / distance) * push;
        } else {
          // Dead centre inside the box - eject along whichever wall is nearest.
          const toMinX = position.x - minX;
          const toMaxX = maxX - position.x;
          const toMinZ = position.z - minZ;
          const toMaxZ = maxZ - position.z;
          const smallest = Math.min(toMinX, toMaxX, toMinZ, toMaxZ);

          if (smallest === toMinX) position.x = minX - radius;
          else if (smallest === toMaxX) position.x = maxX + radius;
          else if (smallest === toMinZ) position.z = minZ - radius;
          else position.z = maxZ + radius;
        }
      }
    }
  }
}

// Convenience for building a box from a centre and size.
export function boxAt(x, z, width, depth, minY, maxY, extra = {}) {
  return {
    minX: x - width / 2,
    maxX: x + width / 2,
    minZ: z - depth / 2,
    maxZ: z + depth / 2,
    minY,
    maxY,
    ...extra,
  };
}
