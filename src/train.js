import * as THREE from 'three';
import {
  TRACK_GAUGE,
  CAR_LENGTH,
  CAR_WIDTH,
  CAR_HEIGHT,
  CAR_GAP,
  WALL_THICKNESS,
  WHEEL_RADIUS,
  AXLE_Y,
  FLOOR_Y,
  INTERIOR_HEIGHT,
  DOOR_CENTRES,
  DOOR_HALF_WIDTH,
  DOOR_HEIGHT,
  STATIONS,
} from './layout.js';

const MAX_SPEED = 18; // m/s
const ACCELERATION = 1.3;
const DECELERATION = 1.6;
const DWELL_SECONDS = 14;
const DOOR_SECONDS = 2.2;

const HALF_LENGTH = CAR_LENGTH / 2;

// Gangway opening between cars: clear headroom, and half-width of the gap in
// the end wall. The player's eye sits 1.7 above the floor, so this leaves room.
const GANGWAY_HEIGHT = 2.02;
const GANGWAY_HALF_WIDTH = 0.45;

// Waist stripe, sitting just under the window line.
const STRIPE_HEIGHT = 0.13;
const STRIPE_Y = FLOOR_Y + CAR_HEIGHT * 0.38;
const INNER_HALF_WIDTH = CAR_WIDTH / 2 - WALL_THICKNESS;
const CEILING_Y = FLOOR_Y + INTERIOR_HEIGHT;
const ROOF_TOP = FLOOR_Y + CAR_HEIGHT + (CAR_WIDTH / 2) * 0.34;

// KCR "Yellowhead" livery: off-white bodyside with a red waist stripe, and a
// yellow cab face - which is what the nickname refers to.
const materials = {
  body: new THREE.MeshStandardMaterial({ color: 0xdcdfe1, roughness: 0.35, metalness: 0.3 }),
  trim: new THREE.MeshStandardMaterial({ color: 0xfdfdfd, roughness: 0.35 }),
  stripe: new THREE.MeshStandardMaterial({ color: 0xd4262f, roughness: 0.4 }),
  cabYellow: new THREE.MeshStandardMaterial({ color: 0xf6c81b, roughness: 0.4 }),
  cabBlack: new THREE.MeshStandardMaterial({ color: 0x1b1b1d, roughness: 0.5 }),
  roof: new THREE.MeshStandardMaterial({ color: 0xb4b4b0, roughness: 0.8 }),
  glass: new THREE.MeshStandardMaterial({
    color: 0x11161a,
    roughness: 0.1,
    metalness: 0.5,
  }),
  under: new THREE.MeshStandardMaterial({ color: 0x232326, roughness: 0.9 }),
  wheel: new THREE.MeshStandardMaterial({ color: 0x3a3a3d, roughness: 0.5, metalness: 0.6 }),
  floor: new THREE.MeshStandardMaterial({ color: 0x77797e, roughness: 0.85 }),
  ceiling: new THREE.MeshStandardMaterial({ color: 0xf4f3ef, roughness: 0.9 }),
  interiorWall: new THREE.MeshStandardMaterial({ color: 0xeae7df, roughness: 0.85 }),
  seat: new THREE.MeshStandardMaterial({ color: 0x2f4a7a, roughness: 0.9 }),
  seatBack: new THREE.MeshStandardMaterial({ color: 0x27406b, roughness: 0.9 }),
  pole: new THREE.MeshStandardMaterial({ color: 0xc9ccd1, roughness: 0.3, metalness: 0.8 }),
  door: new THREE.MeshStandardMaterial({ color: 0xf7f8f9, roughness: 0.4 }),
  windowFrame: new THREE.MeshStandardMaterial({ color: 0x33383d, roughness: 0.55, metalness: 0.3 }),
  roofGear: new THREE.MeshStandardMaterial({ color: 0x8f9195, roughness: 0.6, metalness: 0.5 }),
  skirt: new THREE.MeshStandardMaterial({ color: 0x53585c, roughness: 0.8 }),
  strip: new THREE.MeshStandardMaterial({
    color: 0xfff8e6,
    emissive: 0xfff2cc,
    emissiveIntensity: 0.9,
  }),
};


// Dot-matrix style destination board. The canvas is kept so the text can be
// redrawn in place when the train turns round, rather than rebuilding a mesh.
function createDestinationBoard(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 8;

  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshStandardMaterial({
      map: texture,
      emissive: 0xffffff,
      emissiveMap: texture,
      emissiveIntensity: 0.55,
      roughness: 0.6,
    })
  );

  function set(text) {
    ctx.fillStyle = '#0b0b0d';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#ffb43c';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Spaced-out capitals read far more reliably at a distance and low
    // resolution than tightly kerned mixed case - a destination blind is
    // meant to be legible from the platform, not just up close.
    const spaced = text.toUpperCase().split('').join(' ');

    let size = 148;
    ctx.font = `bold ${size}px "Segoe UI", system-ui, sans-serif`;
    while (ctx.measureText(spaced).width > canvas.width - 88 && size > 44) {
      size -= 4;
      ctx.font = `bold ${size}px "Segoe UI", system-ui, sans-serif`;
    }

    ctx.fillText(spaced, canvas.width / 2, canvas.height / 2 + 4);
    texture.needsUpdate = true;
  }

  set('');
  return { mesh, set };
}

// KCR-style double arrow, drawn once to a transparent canvas and applied as a
// decal on the bodyside.
function createChevronTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#d4262f';
  ctx.strokeStyle = '#d4262f';
  ctx.lineWidth = 26;
  ctx.lineCap = 'square';

  // Two chevrons and a bar, reading as an arrow along the bodyside.
  for (const x of [120, 210]) {
    ctx.beginPath();
    ctx.moveTo(x, 34);
    ctx.lineTo(x - 58, 80);
    ctx.lineTo(x, 126);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.moveTo(215, 80);
  ctx.lineTo(400, 80);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(345, 30);
  ctx.lineTo(408, 80);
  ctx.lineTo(345, 130);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 8;
  return texture;
}

let chevronTexture = null;
function chevronMaterial() {
  if (!chevronTexture) chevronTexture = createChevronTexture();
  return new THREE.MeshStandardMaterial({
    map: chevronTexture,
    transparent: true,
    roughness: 0.5,
  });
}


// The bodyside cross-section, drawn in XY and extruded along Z.
//
// This is what makes it a railway carriage rather than a shoebox: the sides
// bulge to their widest at the waist and taper back in both at the solebar and
// again at the cantrail (tumblehome). A flat slab side reads wrong no matter
// what you paint on it.
//
// Each pair is [half-width, height above the floor].
const BODY_PROFILE = [
  [1.06, -0.46],
  [1.25, -0.22],
  [1.37, 0.08],
  [1.42, 0.6],
  [1.42, 1.5],
  [1.39, 1.86],
  [1.32, 2.14],
  [1.19, 2.36],
  [1.03, 2.5],
];

// Outer half-width at a given height, for hanging trim on the curved surface.
function outerHalfWidth(heightAboveFloor) {
  const p = BODY_PROFILE;
  if (heightAboveFloor <= p[0][1]) return p[0][0];
  for (let i = 1; i < p.length; i++) {
    if (heightAboveFloor <= p[i][1]) {
      const t = (heightAboveFloor - p[i - 1][1]) / (p[i][1] - p[i - 1][1]);
      return p[i - 1][0] + (p[i][0] - p[i - 1][0]) * t;
    }
  }
  return p[p.length - 1][0];
}

function bodysideShape(side) {
  const shape = new THREE.Shape();

  shape.moveTo(side * BODY_PROFILE[0][0], FLOOR_Y + BODY_PROFILE[0][1]);
  for (let i = 1; i < BODY_PROFILE.length; i++) {
    shape.lineTo(side * BODY_PROFILE[i][0], FLOOR_Y + BODY_PROFILE[i][1]);
  }
  for (let i = BODY_PROFILE.length - 1; i >= 0; i--) {
    const [halfWidth, y] = BODY_PROFILE[i];
    shape.lineTo(side * (halfWidth - WALL_THICKNESS), FLOOR_Y + y);
  }
  shape.closePath();

  return shape;
}

// Clip BODY_PROFILE to a Y sub-range, interpolating new points at the cut
// so a band's silhouette still follows the true curve rather than being
// approximated as a straight edge.
function clipProfile(minY, maxY) {
  const p = BODY_PROFILE;
  const widthAt = (y) => outerHalfWidth(y);
  const points = [[widthAt(minY), minY]];
  for (const [w, y] of p) {
    if (y > minY && y < maxY) points.push([w, y]);
  }
  points.push([widthAt(maxY), maxY]);
  return points;
}

// A wall band covering only [minY, maxY] of the profile, otherwise identical
// in construction to bodysideShape.
function bandShape(side, minY, maxY) {
  const profile = clipProfile(minY, maxY);
  const shape = new THREE.Shape();

  shape.moveTo(side * profile[0][0], FLOOR_Y + profile[0][1]);
  for (let i = 1; i < profile.length; i++) {
    shape.lineTo(side * profile[i][0], FLOOR_Y + profile[i][1]);
  }
  for (let i = profile.length - 1; i >= 0; i--) {
    const [halfWidth, y] = profile[i];
    shape.lineTo(side * (halfWidth - WALL_THICKNESS), FLOOR_Y + y);
  }
  shape.closePath();

  return shape;
}

function extrudeBand(side, minY, maxY, centreZ, lengthZ) {
  const geometry = new THREE.ExtrudeGeometry(bandShape(side, minY, maxY), {
    depth: lengthZ,
    bevelEnabled: false,
  });
  geometry.translate(0, 0, centreZ - lengthZ / 2);

  const mesh = new THREE.Mesh(geometry, materials.body);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// Window band vertical extent, centred on the same height the glass uses.
const WINDOW_CENTRE_Y = CAR_HEIGHT * 0.66;
const WINDOW_SILL_Y = WINDOW_CENTRE_Y - 0.61;
const WINDOW_HEAD_Y = WINDOW_CENTRE_Y + 0.61;


// The roof shell, arcing between the tops of the two bodysides.
function roofShape() {
  const top = BODY_PROFILE[BODY_PROFILE.length - 1];
  const shape = new THREE.Shape();

  shape.moveTo(-top[0], FLOOR_Y + top[1]);
  shape.quadraticCurveTo(0, FLOOR_Y + top[1] + 0.62, top[0], FLOOR_Y + top[1]);
  shape.lineTo(top[0] - 0.09, FLOOR_Y + top[1] - 0.04);
  shape.quadraticCurveTo(0, FLOOR_Y + top[1] + 0.5, -(top[0] - 0.09), FLOOR_Y + top[1] - 0.04);
  shape.closePath();

  return shape;
}

// Wall panels run between the door openings rather than being one long box,
// so the doorways are real holes you can walk through.
function wallSegments() {
  const edges = [-HALF_LENGTH];
  for (const centre of DOOR_CENTRES) {
    edges.push(centre - DOOR_HALF_WIDTH, centre + DOOR_HALF_WIDTH);
  }
  edges.push(HALF_LENGTH);

  const segments = [];
  for (let i = 0; i < edges.length; i += 2) {
    const from = edges[i];
    const to = edges[i + 1];
    if (to - from > 0.01) segments.push({ centre: (from + to) / 2, length: to - from });
  }
  return segments;
}

function addSideWall(car, side, doorLeaves) {
  const x = side * (CAR_WIDTH / 2 - WALL_THICKNESS / 2);
  const wallHeight = CAR_HEIGHT;

  // Doors on both sides now, so both get the door-aware segmentation.
  const segments = wallSegments();

  for (const segment of segments) {
    const segStart = segment.centre - segment.length / 2;
    const segEnd = segment.centre + segment.length / 2;

    // The wall is built in three vertical bands rather than one solid sheet.
    // A single watertight extrude has nowhere for a window to be a real
    // opening - the glass previously placed against it just sat hidden
    // inside the solid silver, which is why the windows disappeared instead
    // of merely changing style when the bodyside became curved.
    car.add(extrudeBand(side, BODY_PROFILE[0][1], WINDOW_SILL_Y, segment.centre, segment.length));
    car.add(extrudeBand(
      side,
      WINDOW_HEAD_Y,
      BODY_PROFILE[BODY_PROFILE.length - 1][1],
      segment.centre,
      segment.length
    ));

    // Trim hangs off the curved surface, so each piece sits at the profile's
    // own half-width for the height it lives at.
    const stripeX = side * (outerHalfWidth(STRIPE_Y - FLOOR_Y) - 0.03);
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, STRIPE_HEIGHT, segment.length),
      materials.stripe
    );
    stripe.position.set(stripeX, STRIPE_Y, segment.centre);
    car.add(stripe);

    // Charcoal band along the bottom of the bodyside, below the silver.
    const skirtBand = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.34, segment.length),
      materials.skirt
    );
    skirtBand.position.set(side * (outerHalfWidth(0.17) - 0.03), FLOOR_Y + 0.17, segment.centre);
    car.add(skirtBand);

    // White band along the top of the bodyside.
    const cantrailY = 2.2;
    const cantrail = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.16, segment.length),
      materials.trim
    );
    cantrail.position.set(
      side * (outerHalfWidth(cantrailY) - 0.03),
      FLOOR_Y + cantrailY,
      segment.centre
    );
    car.add(cantrail);

    // Double-arrow decal on the pier nearest the cab end.
    if (segment.centre > HALF_LENGTH - 2.6) {
      const chevron = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.47), chevronMaterial());
      chevron.position.set(
        x + side * (WALL_THICKNESS / 2 + 0.012),
        STRIPE_Y + 0.36,
        segment.centre
      );
      chevron.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
      car.add(chevron);
    }

    // Inner face, so the interior does not read as raw livery colour.
    const lining = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, INTERIOR_HEIGHT * 0.9, segment.length - 0.05),
      materials.interiorWall
    );
    lining.position.set(x - side * WALL_THICKNESS * 0.6, FLOOR_Y + INTERIOR_HEIGHT * 0.45, segment.centre);
    car.add(lining);

    // Window band: real openings with mullions between them, not glass boxes
    // laid against a solid sheet. The piers are about 2.3m wide, which is why
    // two or three windows fit between each door pair rather than one.
    if (segment.length > 1.5) {
      const panes = Math.max(1, Math.round(segment.length / 1.15));
      const spacing = segment.length / panes;
      const openingHalfWidth = spacing * 0.41;

      const openings = [];
      for (let i = 0; i < panes; i++) {
        const zc = segStart + spacing * (i + 0.5);
        openings.push([zc - openingHalfWidth, zc + openingHalfWidth]);
      }

      // Solid mullions fill everything in the window band that is not an
      // opening: before the first window, between each pair, and after the
      // last one.
      let cursor = segStart;
      for (const [oStart, oEnd] of openings) {
        if (oStart - cursor > 0.02) {
          const mullionLength = oStart - cursor;
          car.add(
            extrudeBand(side, WINDOW_SILL_Y, WINDOW_HEAD_Y, cursor + mullionLength / 2, mullionLength)
          );
        }
        cursor = oEnd;
      }
      if (segEnd - cursor > 0.02) {
        const mullionLength = segEnd - cursor;
        car.add(
          extrudeBand(side, WINDOW_SILL_Y, WINDOW_HEAD_Y, cursor + mullionLength / 2, mullionLength)
        );
      }

      // Frame and glass sit in the actual opening, which now has nothing
      // behind it - a real hole rather than a hidden pane.
      for (const [oStart, oEnd] of openings) {
        const z = (oStart + oEnd) / 2;
        const width = oEnd - oStart;

        const surround = new THREE.Mesh(
          new THREE.BoxGeometry(0.12, WINDOW_HEAD_Y - WINDOW_SILL_Y + 0.12, width + 0.06),
          materials.windowFrame
        );
        const glassX = side * (outerHalfWidth(WINDOW_CENTRE_Y) - 0.04);
        surround.position.set(glassX, FLOOR_Y + WINDOW_CENTRE_Y, z);
        car.add(surround);

        const pane = new THREE.Mesh(
          new THREE.BoxGeometry(0.12, WINDOW_HEAD_Y - WINDOW_SILL_Y - 0.08, width - 0.1),
          materials.glass
        );
        pane.position.set(side * (outerHalfWidth(WINDOW_CENTRE_Y) - 0.02), FLOOR_Y + WINDOW_CENTRE_Y, z);
        car.add(pane);
      }
    } else {
      // Too narrow for a window - solid pier the full segment length.
      car.add(extrudeBand(side, WINDOW_SILL_Y, WINDOW_HEAD_Y, segment.centre, segment.length));
    }
  }

  {
    // Header above each doorway. The wall opening runs the full height of the
    // car but the leaves only reach DOOR_HEIGHT, so without this you can see
    // daylight over the top of the doors.
    for (const centre of DOOR_CENTRES) {
      const headerHeight = CAR_HEIGHT - DOOR_HEIGHT;

      const header = new THREE.Mesh(
        new THREE.BoxGeometry(WALL_THICKNESS, headerHeight, DOOR_HALF_WIDTH * 2),
        materials.body
      );
      header.position.set(x, FLOOR_Y + DOOR_HEIGHT + headerHeight / 2, centre);
      header.castShadow = true;
      car.add(header);

      const headerLining = new THREE.Mesh(
        new THREE.BoxGeometry(0.03, headerHeight, DOOR_HALF_WIDTH * 2 - 0.04),
        materials.interiorWall
      );
      headerLining.position.set(
        x - side * WALL_THICKNESS * 0.6,
        FLOOR_Y + DOOR_HEIGHT + headerHeight / 2,
        centre
      );
      car.add(headerLining);
    }

    // White pillars either side of every doorway, and a white header band -
    // on the real thing the door surrounds stand proud of the silver bodyside.
    for (const centre of DOOR_CENTRES) {
      for (const edge of [-1, 1]) {
        const pillar = new THREE.Mesh(
          new THREE.BoxGeometry(WALL_THICKNESS + 0.09, CAR_HEIGHT, 0.3),
          materials.trim
        );
        pillar.position.set(
          x,
          FLOOR_Y + CAR_HEIGHT / 2,
          centre + edge * (DOOR_HALF_WIDTH + 0.13)
        );
        car.add(pillar);
      }

      const lintel = new THREE.Mesh(
        new THREE.BoxGeometry(WALL_THICKNESS + 0.09, 0.2, DOOR_HALF_WIDTH * 2 + 0.56),
        materials.trim
      );
      lintel.position.set(x, FLOOR_Y + CAR_HEIGHT - 0.07, centre);
      car.add(lintel);
    }

    // Two sliding leaves per doorway, parting towards the ends of the car.
    for (const centre of DOOR_CENTRES) {
      for (const direction of [-1, 1]) {
        const leaf = new THREE.Mesh(
          new THREE.BoxGeometry(WALL_THICKNESS * 0.8, DOOR_HEIGHT, DOOR_HALF_WIDTH),
          materials.door
        );
        const closedZ = centre + (direction * DOOR_HALF_WIDTH) / 2;
        leaf.position.set(x + side * 0.03, FLOOR_Y + DOOR_HEIGHT / 2, closedZ);
        leaf.castShadow = true;
        car.add(leaf);

        // Stripe segment parented to the leaf, so it slides with the door
        // instead of hanging in the opening.
        const leafStripe = new THREE.Mesh(
          new THREE.BoxGeometry(WALL_THICKNESS * 0.9, STRIPE_HEIGHT, DOOR_HALF_WIDTH),
          materials.stripe
        );
        leafStripe.position.set(side * 0.02, STRIPE_Y - (FLOOR_Y + DOOR_HEIGHT / 2), 0);
        leaf.add(leafStripe);

        const window = new THREE.Mesh(
          new THREE.BoxGeometry(WALL_THICKNESS * 0.9, 0.7, DOOR_HALF_WIDTH * 0.6),
          materials.glass
        );
        window.position.set(x + side * 0.03, FLOOR_Y + 1.35, closedZ);
        car.add(window);

        doorLeaves.push({ leaf, window, closedZ, direction });
      }
    }
  }
}

function addInterior(car) {
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(CAR_WIDTH - WALL_THICKNESS, 0.08, CAR_LENGTH),
    materials.floor
  );
  floor.position.y = FLOOR_Y - 0.04;
  floor.receiveShadow = true;
  car.add(floor);

  const ceiling = new THREE.Mesh(
    new THREE.BoxGeometry(CAR_WIDTH - WALL_THICKNESS, 0.08, CAR_LENGTH),
    materials.ceiling
  );
  ceiling.position.y = CEILING_Y;
  car.add(ceiling);

  // Lighting strip down the centre of the ceiling.
  const strip = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.05, CAR_LENGTH - 1.4),
    materials.strip
  );
  strip.position.y = CEILING_Y - 0.06;
  car.add(strip);

  // End walls, with a gangway opening wide and tall enough to walk through.
  for (const side of [-1, 1]) {
    for (const offset of [-1, 1]) {
      const panel = new THREE.Mesh(
        new THREE.BoxGeometry(0.95, INTERIOR_HEIGHT, WALL_THICKNESS),
        materials.interiorWall
      );
      panel.position.set(offset * 0.92, FLOOR_Y + INTERIOR_HEIGHT / 2, side * HALF_LENGTH);
      car.add(panel);
    }

    // Header sits above head height - the opening clears GANGWAY_HEIGHT.
    const header = new THREE.Mesh(
      new THREE.BoxGeometry(CAR_WIDTH, INTERIOR_HEIGHT - GANGWAY_HEIGHT, WALL_THICKNESS),
      materials.interiorWall
    );
    header.position.set(
      0,
      FLOOR_Y + GANGWAY_HEIGHT + (INTERIOR_HEIGHT - GANGWAY_HEIGHT) / 2,
      side * HALF_LENGTH
    );
    car.add(header);
  }

  // Saloon lighting. The emissive ceiling strip looks lit but casts nothing,
  // so without these the interior is a cave once the roof blocks the sun.
  for (const z of [-5.5, 5.5]) {
    const light = new THREE.PointLight(0xfff4e0, 22, 17, 1.6);
    light.position.set(0, CEILING_Y - 0.25, z);
    car.add(light);
  }

  // Longitudinal bench seating along the piers between the doorways, as on
  // metro stock. Driving it off wallSegments() means the seats follow the door
  // layout automatically instead of needing to be repositioned by hand.
  for (const segment of wallSegments()) {
    if (segment.length < 1.6) continue;
    const benchLength = segment.length - 0.25;

    for (const side of [-1, 1]) {
      const x = side * (INNER_HALF_WIDTH - 0.28);

      const cushion = new THREE.Mesh(
        new THREE.BoxGeometry(0.52, 0.1, benchLength),
        materials.seat
      );
      cushion.position.set(x, FLOOR_Y + 0.45, segment.centre);
      cushion.castShadow = true;
      car.add(cushion);

      const back = new THREE.Mesh(
        new THREE.BoxGeometry(0.09, 0.5, benchLength),
        materials.seatBack
      );
      back.position.set(side * (INNER_HALF_WIDTH - 0.03), FLOOR_Y + 0.76, segment.centre);
      car.add(back);

      const plinth = new THREE.Mesh(
        new THREE.BoxGeometry(0.48, 0.4, benchLength),
        materials.under
      );
      plinth.position.set(x, FLOOR_Y + 0.2, segment.centre);
      car.add(plinth);
    }
  }

  // Grab poles beside each doorway.
  const poleGeometry = new THREE.CylinderGeometry(0.035, 0.035, INTERIOR_HEIGHT, 8);
  for (const centre of DOOR_CENTRES) {
    for (const offset of [-1, 1]) {
      const pole = new THREE.Mesh(poleGeometry, materials.pole);
      pole.position.set(
        INNER_HALF_WIDTH - 0.5,
        FLOOR_Y + INTERIOR_HEIGHT / 2,
        centre + offset * (DOOR_HALF_WIDTH + 0.35)
      );
      car.add(pole);
    }
  }
}

function addRunningGear(car, wheels) {
  const wheelGeometry = new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, 0.13, 16);

  for (const bogieZ of [-HALF_LENGTH + 3.2, HALF_LENGTH - 3.2]) {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.42, 3.4), materials.under);
    frame.position.set(0, AXLE_Y + 0.18, bogieZ);
    frame.castShadow = true;
    car.add(frame);

    for (const axleZ of [-1.1, 1.1]) {
      for (const side of [-1, 1]) {
        const wheel = new THREE.Mesh(wheelGeometry, materials.wheel);
        // Cylinders stand up the Y axis; lay it over so the axle runs across
        // the track. Spinning is then a rotation about the wheel's local Y.
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set((side * TRACK_GAUGE) / 2, AXLE_Y, bogieZ + axleZ);
        wheel.castShadow = true;
        car.add(wheel);
        wheels.push(wheel);
      }
    }
  }

  const skirt = new THREE.Mesh(
    new THREE.BoxGeometry(CAR_WIDTH - 0.2, 0.5, CAR_LENGTH - 1),
    materials.under
  );
  skirt.position.y = FLOOR_Y - 0.3;
  car.add(skirt);
}

// Roof equipment, and a pantograph on the motor car. An EMU roof is rarely
// bare, and the raised pantograph is a big part of the silhouette.
function addRoofGear(car, withPantograph) {
  for (const z of [-7.4, -2.2, 6.6]) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.2, 2.0), materials.roofGear);
    box.position.set(0, ROOF_TOP - 0.04, z);
    box.castShadow = true;
    car.add(box);
  }

  if (!withPantograph) return;

  const panto = new THREE.Group();
  panto.position.set(0, ROOF_TOP, 2.4);

  for (const x of [-0.62, 0.62]) {
    for (const z of [-0.7, 0.7]) {
      const insulator = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 0.22, 8),
        materials.under
      );
      insulator.position.set(x, 0.11, z);
      panto.add(insulator);
    }
  }

  const base = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 1.7), materials.roofGear);
  base.position.y = 0.26;
  panto.add(base);

  // Two arms folded into the usual Z, with the contact strip on top.
  const lower = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 1.6), materials.roofGear);
  lower.position.set(0, 0.62, -0.38);
  lower.rotation.x = 0.72;
  panto.add(lower);

  const upper = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 1.4), materials.roofGear);
  upper.position.set(0, 1.06, 0.34);
  upper.rotation.x = -0.88;
  panto.add(upper);

  const pan = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.05, 0.16), materials.roofGear);
  pan.position.set(0, 1.36, 0.74);
  pan.castShadow = true;
  panto.add(pan);

  car.add(panto);
}

function createCarriage({ cabEnd = 0 }, doorLeaves, wheels, cabs) {
  const car = new THREE.Group();

  addRunningGear(car, wheels);
  addInterior(car);
  addRoofGear(car, cabEnd === -1);
  addSideWall(car, 1, doorLeaves);
  addSideWall(car, -1, doorLeaves);

  // Roof shell, extruded from the same cross-section family as the sides so
  // the two actually meet instead of a cylinder sitting on a box.
  const roofGeometry = new THREE.ExtrudeGeometry(roofShape(), {
    depth: CAR_LENGTH,
    bevelEnabled: false,
    curveSegments: 14,
  });
  roofGeometry.translate(0, 0, -CAR_LENGTH / 2);

  const roof = new THREE.Mesh(roofGeometry, materials.roof);
  roof.castShadow = true;
  car.add(roof);

  // A driving cab at one end. The unit is double-ended, so this is built
  // twice - once facing +Z, once facing -Z - and never needs turning.
  let board = null;

  if (cabEnd !== 0) {
    const endZ = cabEnd * HALF_LENGTH;

    // The yellow cab face the "Yellowhead" nickname comes from.
    const front = new THREE.Mesh(
      new THREE.BoxGeometry(CAR_WIDTH, CAR_HEIGHT, 0.3),
      materials.cabYellow
    );
    front.position.set(0, FLOOR_Y + CAR_HEIGHT / 2, endZ + cabEnd * 0.15);
    front.castShadow = true;
    car.add(front);

    // Yellow wraps a short way down both bodysides at the cab end.
    for (const side of [-1, 1]) {
      const wrap = new THREE.Mesh(
        new THREE.BoxGeometry(WALL_THICKNESS + 0.06, CAR_HEIGHT, 1.5),
        materials.cabYellow
      );
      wrap.position.set(
        side * (CAR_WIDTH / 2 - WALL_THICKNESS / 2),
        FLOOR_Y + CAR_HEIGHT / 2,
        endZ - cabEnd * 0.75
      );
      car.add(wrap);
    }

    // Black surround, then the windscreen sitting proud of it.
    const surround = new THREE.Mesh(
      new THREE.BoxGeometry(CAR_WIDTH - 0.16, 1.28, 0.1),
      materials.cabBlack
    );
    surround.position.set(0, FLOOR_Y + CAR_HEIGHT * 0.72, endZ + cabEnd * 0.3);
    car.add(surround);

    // Two windscreen panes with a centre pillar between them.
    for (const paneSide of [-1, 1]) {
      const pane = new THREE.Mesh(
        new THREE.BoxGeometry((CAR_WIDTH - 0.62) / 2, 1.0, 0.12),
        materials.glass
      );
      pane.position.set(
        paneSide * (CAR_WIDTH - 0.5) / 4,
        FLOOR_Y + CAR_HEIGHT * 0.72,
        endZ + cabEnd * 0.33
      );
      car.add(pane);
    }

    // Black band across the cab face around the screens, and round the corners.
    const band = new THREE.Mesh(
      new THREE.BoxGeometry(CAR_WIDTH + 0.02, 1.32, 0.1),
      materials.cabBlack
    );
    band.position.set(0, FLOOR_Y + CAR_HEIGHT * 0.72, endZ + cabEnd * 0.29);
    car.add(band);

    for (const bandSide of [-1, 1]) {
      const wrap = new THREE.Mesh(
        new THREE.BoxGeometry(WALL_THICKNESS + 0.08, 1.32, 0.5),
        materials.cabBlack
      );
      wrap.position.set(
        bandSide * (CAR_WIDTH / 2 - WALL_THICKNESS / 2),
        FLOOR_Y + CAR_HEIGHT * 0.72,
        endZ - cabEnd * 0.24
      );
      car.add(wrap);
    }

    const centrePillar = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 1.06, 0.14),
      materials.cabYellow
    );
    centrePillar.position.set(0, FLOOR_Y + CAR_HEIGHT * 0.72, endZ + cabEnd * 0.34);
    car.add(centrePillar);

    // Charcoal skirt across the bottom of the cab, matching the bodyside.
    const cabSkirt = new THREE.Mesh(
      new THREE.BoxGeometry(CAR_WIDTH, 0.34, 0.34),
      materials.skirt
    );
    cabSkirt.position.set(0, FLOOR_Y + 0.17, endZ + cabEnd * 0.16);
    car.add(cabSkirt);

    // Route indicator box on the roofline, with two red marker lamps.
    const indicator = new THREE.Mesh(
      new THREE.BoxGeometry(1.28, 0.4, 0.16),
      materials.cabBlack
    );
    indicator.position.set(0, FLOOR_Y + CAR_HEIGHT - 0.02, endZ + cabEnd * 0.3);
    car.add(indicator);

    // Destination board set into the indicator box.
    board = createDestinationBoard(1.15, 0.3);
    board.mesh.position.set(0, FLOOR_Y + CAR_HEIGHT - 0.02, endZ + cabEnd * 0.39);
    board.mesh.rotation.y = cabEnd > 0 ? 0 : Math.PI;
    car.add(board.mesh);

    for (const side of [-1, 1]) {
      const marker = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.16, 0.08),
        new THREE.MeshStandardMaterial({
          color: 0xd8241c,
          emissive: 0xff2a1a,
          emissiveIntensity: 1.1,
        })
      );
      marker.position.set(side * 0.22, FLOOR_Y + CAR_HEIGHT - 0.02, endZ + cabEnd * 0.37);
      car.add(marker);
    }

    // Driving desk, visible through the windscreen.
    const desk = new THREE.Mesh(
      new THREE.BoxGeometry(CAR_WIDTH - 0.9, 0.12, 0.6),
      materials.under
    );
    desk.position.set(0, FLOOR_Y + 0.95, endZ - cabEnd * 0.5);
    car.add(desk);

    // Marker lamps get their own material per cab so the leading end can show
    // white while the trailing end shows red.
    const lamps = [];
    for (const side of [-1, 1]) {
      const material = new THREE.MeshStandardMaterial({
        color: 0xfff6de,
        emissive: 0xffe9b0,
        emissiveIntensity: 1.4,
      });
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.16, 0.1), material);
      lamp.position.set(side * 0.85, FLOOR_Y + 0.45, endZ + cabEnd * 0.32);
      car.add(lamp);
      lamps.push(lamp);
    }

    cabs.push({ end: cabEnd, lamps, board });
  }

  return car;
}

// Bellows connection spanning the gap between the two cars, so walking
// through the gangway is enclosed rather than open to the sky.
function createGangway() {
  const gangway = new THREE.Group();
  gangway.name = 'gangway';

  const bellows = new THREE.MeshStandardMaterial({ color: 0x2b2b2e, roughness: 0.95 });

  // Ribbed sleeve around the opening.
  for (let i = 0; i < 4; i++) {
    const z = -CAR_GAP / 2 + CAR_GAP * ((i + 0.5) / 4);

    for (const side of [-1, 1]) {
      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, GANGWAY_HEIGHT, CAR_GAP / 5),
        bellows
      );
      wall.position.set(side * (GANGWAY_HALF_WIDTH + 0.06), FLOOR_Y + GANGWAY_HEIGHT / 2, z);
      gangway.add(wall);
    }

    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(GANGWAY_HALF_WIDTH * 2 + 0.24, 0.1, CAR_GAP / 5),
      bellows
    );
    roof.position.set(0, FLOOR_Y + GANGWAY_HEIGHT, z);
    gangway.add(roof);
  }

  // Plate bridging the floor gap between the cars.
  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(GANGWAY_HALF_WIDTH * 2, 0.08, CAR_GAP + 0.3),
    new THREE.MeshStandardMaterial({ color: 0x4a4d52, roughness: 0.7, metalness: 0.4 })
  );
  plate.position.set(0, FLOOR_Y - 0.04, 0);
  gangway.add(plate);

  return gangway;
}

export class Train {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'train';

    this.doorLeaves = [];
    this.wheels = [];
    this.cabs = [];

    // Double-ended unit: a cab at each extremity of the formation, so it can
    // run either way down the line without ever being turned.
    const front = createCarriage({ cabEnd: 1 }, this.doorLeaves, this.wheels, this.cabs);
    front.position.z = (CAR_LENGTH + CAR_GAP) / 2;
    this.group.add(front);

    const rear = createCarriage({ cabEnd: -1 }, this.doorLeaves, this.wheels, this.cabs);
    rear.position.z = -(CAR_LENGTH + CAR_GAP) / 2;
    this.group.add(rear);

    this.group.add(createGangway());

    this.stationIndex = 0;
    this.step = 1; // which way along the STATIONS list we are working
    this.targetIndex = 1;
    this.speed = 0;
    this.doorOpen = 1; // 0 shut, 1 fully open
    this.state = 'dwell';
    this.timer = DWELL_SECONDS;

    this.group.position.z = STATIONS[this.stationIndex].z;

    // Which way the unit is currently working: +1 towards +Z, -1 towards -Z.
    this.direction = Math.sign(STATIONS[this.targetIndex].z - this.group.position.z) || -1;

    this.applyDoors();
    this.applyLights();
    this.updateDestinationBoards();
  }

  // White at the leading cab, red at the trailing one. Because the unit is
  // double-ended this swaps over at each terminus rather than turning.
  applyLights() {
    for (const cab of this.cabs) {
      const leading = cab.end === this.direction;
      for (const lamp of cab.lamps) {
        lamp.material.color.setHex(leading ? 0xfff6de : 0x6b1414);
        lamp.material.emissive.setHex(leading ? 0xffe9b0 : 0xd11a1a);
        lamp.material.emissiveIntensity = leading ? 1.4 : 1.1;
      }
    }
  }

  get currentStation() {
    return STATIONS[this.stationIndex];
  }

  get nextStation() {
    return STATIONS[this.targetIndex];
  }

  // Where this leg ends. A crossing beyond this point is not our problem yet.
  get targetZ() {
    return STATIONS[this.targetIndex].z;
  }

  // What the blinds show: the far end of the line in the direction of travel,
  // not the next stop. `step` already flips on arrival at a terminus, so the
  // board reads the return destination while the train sits there.
  get destination() {
    return this.step > 0 ? STATIONS[STATIONS.length - 1] : STATIONS[0];
  }

  updateDestinationBoards() {
    const text = this.destination.name;
    if (text === this.shownDestination) return;
    this.shownDestination = text;
    for (const cab of this.cabs) {
      if (cab.board) cab.board.set(text);
    }
  }

  applyDoors() {
    const travel = this.doorOpen * (DOOR_HALF_WIDTH * 0.96);
    for (const { leaf, window, closedZ, direction } of this.doorLeaves) {
      leaf.position.z = closedZ + direction * travel;
      window.position.z = leaf.position.z;
    }
  }

  // Half-extent of the whole unit along Z, used for the "am I aboard" test.
  get halfLength() {
    return CAR_LENGTH + CAR_GAP / 2;
  }

  update(delta) {
    const previousZ = this.group.position.z;

    switch (this.state) {
      case 'dwell':
        this.doorOpen = Math.min(1, this.doorOpen + delta / DOOR_SECONDS);
        this.timer -= delta;
        if (this.timer <= 0) this.state = 'closing';
        break;

      case 'closing':
        this.doorOpen = Math.max(0, this.doorOpen - delta / DOOR_SECONDS);
        if (this.doorOpen === 0) this.state = 'running';
        break;

      case 'running': {
        const target = STATIONS[this.targetIndex].z;
        const remaining = target - this.group.position.z;
        const distance = Math.abs(remaining);
        const stoppingDistance = (this.speed * this.speed) / (2 * DECELERATION);

        if (distance <= stoppingDistance) {
          this.speed = Math.max(0, this.speed - DECELERATION * delta);
        } else {
          this.speed = Math.min(MAX_SPEED, this.speed + ACCELERATION * delta);
        }

        // Never stall short of the platform.
        if (distance > 0.3 && this.speed < 0.4) this.speed = 0.4;

        this.group.position.z += Math.sign(remaining) * this.speed * delta;

        if (Math.abs(target - this.group.position.z) < 0.3 && this.speed < 0.6) {
          this.group.position.z = target;
          this.speed = 0;
          this.stationIndex = this.targetIndex;

          // Work down the line calling at each stop, then reverse at the
          // terminus and work back - rather than wrapping round to the far end.
          if (this.stationIndex + this.step < 0 ||
              this.stationIndex + this.step >= STATIONS.length) {
            this.step = -this.step;
          }
          this.targetIndex = this.stationIndex + this.step;

          this.state = 'opening';
        }
        break;
      }

      case 'opening':
        this.doorOpen = Math.min(1, this.doorOpen + delta / DOOR_SECONDS);
        if (this.doorOpen === 1) {
          this.state = 'dwell';
          this.timer = DWELL_SECONDS;
        }
        break;
    }

    this.applyDoors();

    this.updateDestinationBoards();

    // Swap the marker lights over when the unit changes ends at a terminus.
    const heading = Math.sign(STATIONS[this.targetIndex].z - this.group.position.z);
    if (heading !== 0 && heading !== this.direction) {
      this.direction = heading;
      this.applyLights();
    }

    // Roll the wheels at whatever speed we are actually doing.
    if (this.speed > 0) {
      const spin = (this.speed * delta) / WHEEL_RADIUS;
      for (const wheel of this.wheels) wheel.rotateY(spin);
    }

    // How far the whole train moved this frame - anyone aboard rides along.
    return this.group.position.z - previousZ;
  }

  // True when a world-space point is inside the saloon. The X range reaches
  // out to the platform edge so stepping across the gap does not drop you.
  contains(x, z) {
    const localZ = z - this.group.position.z;
    return (
      x > -INNER_HALF_WIDTH &&
      x < 1.6 &&
      Math.abs(localZ) < this.halfLength
    );
  }

  // Solid parts of the bodyshell, in train-local Z. The offset() closure keeps
  // them attached as the unit runs, and the doorways only become solid once
  // the doors are most of the way shut.
  colliders() {
    const boxes = [];
    const offset = () => this.group.position.z;
    const top = FLOOR_Y + CAR_HEIGHT;
    const outer = CAR_WIDTH / 2;
    const inner = outer - WALL_THICKNESS - 0.08;

    for (const carCentre of [(CAR_LENGTH + CAR_GAP) / 2, -(CAR_LENGTH + CAR_GAP) / 2]) {
      // Doors on both sides now, so both get the same door-aware wall
      // segmentation and door-opening colliders, mirrored left/right.
      for (const side of [-1, 1]) {
        const minX = side > 0 ? inner : -outer;
        const maxX = side > 0 ? outer : -inner;

        for (const segment of wallSegments()) {
          boxes.push({
            minX, maxX,
            minZ: carCentre + segment.centre - segment.length / 2,
            maxZ: carCentre + segment.centre + segment.length / 2,
            minY: FLOOR_Y, maxY: top, offset,
          });
        }

        for (const doorCentre of DOOR_CENTRES) {
          boxes.push({
            minX, maxX,
            minZ: carCentre + doorCentre - DOOR_HALF_WIDTH,
            maxZ: carCentre + doorCentre + DOOR_HALF_WIDTH,
            minY: FLOOR_Y, maxY: FLOOR_Y + DOOR_HEIGHT, offset,
            active: () => this.doorOpen < 0.55,
          });
        }
      }

      // Both ends of each car. The two inner ends face each other across the
      // gangway, so they get a gap you can walk through; the outer ends of the
      // formation stay solid.
      for (const end of [-1, 1]) {
        const endZ = carCentre + end * HALF_LENGTH;
        const isInner = Math.abs(endZ) < HALF_LENGTH;

        const spans = isInner
          ? [[-outer, -GANGWAY_HALF_WIDTH], [GANGWAY_HALF_WIDTH, outer]]
          : [[-outer, outer]];

        for (const [minX, maxX] of spans) {
          boxes.push({
            minX, maxX,
            minZ: endZ - 0.14, maxZ: endZ + 0.14,
            minY: FLOOR_Y, maxY: top, offset,
          });
        }
      }
    }

    return boxes;
  }

  status() {
    switch (this.state) {
      case 'dwell':
        return `${this.currentStation.name} — doors open, departing in ${Math.ceil(this.timer)}s — next stop ${this.nextStation.name}`;
      case 'closing':
        return 'Doors closing — stand clear';
      case 'running':
        return `Next stop: ${this.nextStation.name} — ${Math.round(this.speed * 2.237)} mph`;
      case 'opening':
        return `Arriving at ${this.currentStation.name}`;
      default:
        return '';
    }
  }
}
