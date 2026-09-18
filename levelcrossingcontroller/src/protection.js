import * as THREE from 'three';
import { ROAD_HALF_WIDTH } from './constants.js';

// Everything that stands at one approach to the crossing: an optional post,
// an optional set of lamps, and an optional gate - each independently
// selectable (barrierType / lightStyle can each be 'none'). Built once per
// approach by buildProtectionUnit(); Game drives the result each frame via
// `apply(lowered)` and the shared `lamps` list, without needing to know
// which combination of gate/lamp style is actually in play.

const materials = {
  post: new THREE.MeshStandardMaterial({ color: 0xe8e4dc, roughness: 0.7 }),
  boomWhite: new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.6 }),
  boomRed: new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.6 }),
  rail: new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.6, metalness: 0.4 }),
};

// `onColor` is what Game.setLamps() switches the lamp's own base colour to
// while lit - defaulting to red, but the UK amber lamp below needs its own.
function unlitLampMaterial(offColor = 0x5c1512, emissive = 0xff2a1a) {
  return new THREE.MeshStandardMaterial({
    color: offColor,
    emissive,
    emissiveIntensity: 0,
    roughness: 0.4,
  });
}

function buildPost(postX, stopZ) {
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 2.4, 10), materials.post);
  post.position.set(postX, 1.2, stopZ);
  post.castShadow = true;
  return post;
}

function buildRoundLamp(x, y, z, phase, lamps, options = {}) {
  const { onColor = 0xff5544, offColor = 0x5c1512, emissive = 0xff2a1a, radius = 0.16 } = options;
  const lamp = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, radius * 0.56, 12),
    unlitLampMaterial(offColor, emissive)
  );
  lamp.rotation.z = Math.PI / 2;
  lamp.position.set(x, y, z);
  lamps.push({ mesh: lamp, phase, onColor, offColor });
  return lamp;
}

function buildSquareLamp(x, y, z, phase, lamps) {
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.1), unlitLampMaterial());
  lamp.position.set(x, y, z);
  lamps.push({ mesh: lamp, phase });
  return lamp;
}

// The classic mechanical American "wig-wag" signal, mostly retired now but
// visually distinct from every other style here in a way none of them are:
// a single red lens on an arm that physically pivots side to side (a
// pendulum, not two lamps flashing in place) while active. The lens itself
// stays continuously lit - the on/off sensation for an approaching driver
// comes entirely from the motion, not from the lamp switching on and off -
// so `phase: 'wigwag'` gets its own branch in Game.setLamps() (lit purely by
// `on`, never by `flashState`), and `swingPivot` is what Game.updateBarrier()
// actually rotates each frame; nothing else here has a lamp that moves.
function buildWigWagUnit(postX, stopZ, lamps) {
  const armLength = 0.85;

  // Mounted right at the top of the post, hanging straight down - a real
  // wig-wag's disc dangles from the mast top on a vertical arm and swings
  // side to side like a pendulum, it does not stick out horizontally.
  const pivot = new THREE.Group();
  pivot.position.set(postX, 2.4, stopZ);

  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.05, armLength, 0.05), materials.rail);
  arm.position.y = -armLength / 2;
  arm.castShadow = true;
  pivot.add(arm);

  // Cylinder axis rotated onto Z so the disc's flat face points down the
  // road, toward an approaching driver, rather than along the track.
  const lampMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, 0.12, 14),
    unlitLampMaterial()
  );
  lampMesh.rotation.x = Math.PI / 2;
  lampMesh.position.y = -armLength;
  lampMesh.castShadow = true;
  pivot.add(lampMesh);

  lamps.push({ mesh: lampMesh, phase: 'wigwag', onColor: 0xff5544, offColor: 0x5c1512, swingPivot: pivot });

  return pivot;
}

function buildCrossbuck(postX, stopZ, material = materials.boomWhite) {
  const group = new THREE.Group();
  for (const angle of [Math.PI / 4, -Math.PI / 4]) {
    const board = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.16, 0.05), material);
    board.position.set(postX, 2.05, stopZ);
    board.rotation.z = angle;
    board.castShadow = true;
    group.add(board);
  }
  return group;
}

// Each style differs in shape, arrangement and/or flash behaviour - not
// meant as an accurate reproduction of any real country's actual signalling
// standard, just a recognisably different look and feel per option.
function buildLamps(style, postX, stopZ, parent, lamps) {
  if (style === 'none') return;

  if (style === 'america') {
    // A real US crossbuck signal is the crossbuck board with the pair of
    // alternately-flashing red lamps mounted on the mast *below* it, close
    // together - not spread out either side of it at the same height,
    // which is what this used to do.
    parent.add(buildCrossbuck(postX, stopZ));
    for (const offset of [-0.3, 0.3]) {
      parent.add(buildRoundLamp(postX + offset, 1.55, stopZ, offset > 0 ? 1 : 0, lamps));
    }
    return;
  }

  if (style === 'netherlands') {
    parent.add(buildCrossbuck(postX, stopZ));
    // Stacked vertically rather than side by side, unlike every other style.
    for (const [i, offset] of [-0.22, 0.22].entries()) {
      parent.add(buildRoundLamp(postX, 2.55 + offset, stopZ, i, lamps));
    }
    return;
  }

  if (style === 'sweden') {
    // Square, and both flash together in phase 0 - the one style that does
    // not alternate - rather than shape alone doing all the distinguishing.
    for (const offset of [-0.3, 0.3]) {
      parent.add(buildSquareLamp(postX + offset, 2.25, stopZ, 0, lamps));
    }
    return;
  }

  if (style === 'france') {
    // Two real distinguishing French features, not a stylised guess: the
    // "croix de Saint-André" is red, not white with black lettering like
    // the US crossbuck, and a real French crossing signal is a single
    // flashing red light - not an alternating pair like every other lit
    // style here. One centred lamp, phase 0, flashing on the normal
    // FLASH_INTERVAL rhythm rather than alternating with a partner. Made
    // noticeably bigger than the paired lamps every other style uses -
    // it is the crossing's *only* light, so it reads as the signal on its
    // own rather than looking like a lamp missing its other half.
    parent.add(buildCrossbuck(postX, stopZ, materials.boomRed));
    parent.add(buildRoundLamp(postX, 1.55, stopZ, 0, lamps, { radius: 0.26 }));
    return;
  }

  if (style === 'wigwag') {
    parent.add(buildWigWagUnit(postX, stopZ, lamps));
    return;
  }

  if (style === 'uk') {
    // The genuinely distinguishing UK feature: a single steady amber lamp
    // above the pair of red ones, which lights *first* (Game.updateBarrier()
    // drives a UK_AMBER_SECONDS steady phase before the reds ever start
    // flashing) - the UK is the only one of these styles that warns with
    // amber before red at all, mirroring its road traffic lights generally,
    // rather than jumping straight to flashing red like every other style
    // here (and, in reality, most other countries' crossings).
    parent.add(
      buildRoundLamp(postX, 2.55, stopZ, 'amber', lamps, {
        onColor: 0xffb300,
        offColor: 0x4a3a12,
        emissive: 0xffa000,
      })
    );
    for (const offset of [-0.35, 0.35]) {
      parent.add(buildRoundLamp(postX + offset, 2.1, stopZ, offset > 0 ? 1 : 0, lamps));
    }
    return;
  }

  // 'default' - plain round lamps, alternating, straight to flashing red
  // with no lead-in phase.
  for (const offset of [-0.35, 0.35]) {
    parent.add(buildRoundLamp(postX + offset, 2.25, stopZ, offset > 0 ? 1 : 0, lamps));
  }
}

// A boom pivoting about a horizontal (Z) axis at the post, the same motion
// a real barrier makes - vertical when raised, horizontal across the road
// when lowered. `boomLength` is the only thing that differs between the
// full-width 'default' gate and the shorter 'half' one.
function buildBoomGate(postX, stopZ, reachDirection, boomLength) {
  const pivot = new THREE.Group();
  pivot.position.set(postX, 1.4, stopZ);

  const boomGeometry = new THREE.BoxGeometry(boomLength, 0.11, 0.11);
  boomGeometry.translate((reachDirection * boomLength) / 2, 0, 0);
  const boom = new THREE.Mesh(boomGeometry, materials.boomWhite);
  boom.castShadow = true;
  pivot.add(boom);

  const bandCount = Math.max(2, Math.round(boomLength / 1.6));
  for (let i = 0; i < bandCount; i++) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.13, 0.13), materials.boomRed);
    band.position.x = reachDirection * (0.8 + i * 1.6);
    pivot.add(band);
  }

  pivot.rotation.z = reachDirection * (Math.PI / 2); // raised, to start

  return {
    group: pivot,
    apply(lowered) {
      pivot.rotation.z = reachDirection * (1 - lowered) * (Math.PI / 2);
    },
  };
}

// One post plus one lattice-mesh arm pivoting about a horizontal (Z) axis,
// the same up/down boom motion as buildBoomGate() - but the arm itself is a
// diagonal striped rail with a second, lower rail and a row of pickets
// between them, closing the gap under the arm the way a real UK "MCB-OD"
// double-barrier crossing's wire mesh does, rather than a bare bar. Used in
// pairs by buildDoubleBarrierGate() below - one from each side of the road.
function buildLatticeArm(postX, stopZ, reachDirection, armLength) {
  const pivot = new THREE.Group();
  pivot.position.set(postX, 1.4, stopZ);

  const railGeometry = () => {
    const g = new THREE.BoxGeometry(armLength, 0.1, 0.1);
    g.translate((reachDirection * armLength) / 2, 0, 0);
    return g;
  };

  const topRail = new THREE.Mesh(railGeometry(), materials.boomWhite);
  topRail.castShadow = true;
  pivot.add(topRail);

  const bandCount = Math.max(2, Math.round(armLength / 1.4));
  for (let i = 0; i < bandCount; i++) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.12, 0.12), materials.boomRed);
    band.position.x = reachDirection * (0.6 + i * 1.4);
    pivot.add(band);
  }

  const bottomRailY = -0.55;
  const bottomRail = new THREE.Mesh(railGeometry(), materials.rail);
  bottomRail.position.y = bottomRailY;
  pivot.add(bottomRail);

  const picketCount = Math.max(5, Math.round(armLength / 0.35));
  for (let i = 0; i < picketCount; i++) {
    const picket = new THREE.Mesh(new THREE.BoxGeometry(0.03, Math.abs(bottomRailY), 0.03), materials.rail);
    picket.position.set(reachDirection * (i + 0.5) * (armLength / picketCount), bottomRailY / 2, 0);
    pivot.add(picket);
  }

  pivot.rotation.z = reachDirection * (Math.PI / 2); // raised, to start

  return {
    group: pivot,
    apply(lowered) {
      pivot.rotation.z = reachDirection * (1 - lowered) * (Math.PI / 2);
    },
  };
}

// A real UK-style "double barrier" (MCB-OD) crossing does not use one arm
// spanning the whole road from a single edge - it has a separate post on
// *each* side, with a shorter lattice arm from each closing in toward the
// middle, overlapping there once both are down. `postX`/`reachDirection`
// here describe the near side, matching every other gate builder's
// signature (`buildProtectionUnit()` already stands a light post there);
// the far side is this function's own mirror image, including its own post
// (nothing else builds one there).
function buildDoubleBarrierGate(postX, stopZ, reachDirection) {
  const armLength = ROAD_HALF_WIDTH + 0.6; // reaches just past the centreline

  const near = buildLatticeArm(postX, stopZ, reachDirection, armLength);

  const farPostX = -postX;
  const farReachDirection = -reachDirection;
  const far = buildLatticeArm(farPostX, stopZ, farReachDirection, armLength);
  const farPost = buildPost(farPostX, stopZ);

  const group = new THREE.Group();
  group.add(near.group, far.group, farPost);

  return {
    group,
    apply(lowered) {
      near.apply(lowered);
      far.apply(lowered);
    },
  };
}

// A lattice panel pivoting about a *vertical* (Y) axis at the post - open,
// it lies parallel to the road, tucked out of the way; closed, it swings
// round to block the road, the way a traditional swing gate works rather
// than a boom lowering onto it.
function buildSwingGate(postX, stopZ, reachDirection) {
  const panelLength = ROAD_HALF_WIDTH * 2 + 0.6;
  const pivot = new THREE.Group();
  pivot.position.set(postX, 0, stopZ);

  for (const y of [1.0, 1.9]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(panelLength, 0.06, 0.06), materials.boomWhite);
    rail.geometry.translate((reachDirection * panelLength) / 2, 0, 0);
    rail.position.y = y;
    rail.castShadow = true;
    pivot.add(rail);
  }

  const picketCount = 7;
  for (let i = 0; i < picketCount; i++) {
    const picket = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 1.0, 0.05),
      i % 2 === 0 ? materials.boomRed : materials.boomWhite
    );
    picket.position.set(reachDirection * (i + 0.5) * (panelLength / picketCount), 1.45, 0);
    picket.castShadow = true;
    pivot.add(picket);
  }

  pivot.rotation.y = reachDirection * (Math.PI / 2); // raised: parallel to the road, out of the way

  return {
    group: pivot,
    apply(lowered) {
      pivot.rotation.y = reachDirection * (1 - lowered) * (Math.PI / 2);
    },
  };
}

// A lattice panel that slides sideways along an overhead rail rather than
// swinging - parked entirely clear of the road when open, translated across
// it when closed.
function buildTrolleyGate(postX, stopZ, reachDirection) {
  const panelLength = ROAD_HALF_WIDTH * 2 + 0.6;
  const parkedCenterX = postX - reachDirection * (panelLength / 2 + 0.3);
  const closedCenterX = postX + reachDirection * (panelLength / 2);

  const group = new THREE.Group();

  const rail = new THREE.Mesh(
    new THREE.BoxGeometry(Math.abs(closedCenterX - parkedCenterX) + panelLength, 0.06, 0.06),
    materials.rail
  );
  rail.position.set((parkedCenterX + closedCenterX) / 2, 2.3, stopZ);
  rail.castShadow = true;
  group.add(rail);

  const panel = new THREE.Group();
  panel.position.set(parkedCenterX, 0, stopZ);
  group.add(panel);

  for (const y of [1.0, 2.0]) {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(panelLength, 0.06, 0.06), materials.boomWhite);
    frame.position.y = y;
    frame.castShadow = true;
    panel.add(frame);
  }
  const picketCount = 5;
  for (let i = 0; i < picketCount; i++) {
    const picket = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 1.0, 0.05),
      i % 2 === 0 ? materials.boomRed : materials.boomWhite
    );
    picket.position.set(-panelLength / 2 + (i + 0.5) * (panelLength / picketCount), 1.5, 0);
    picket.castShadow = true;
    panel.add(picket);
  }

  return {
    group,
    apply(lowered) {
      panel.position.x = THREE.MathUtils.lerp(parkedCenterX, closedCenterX, lowered);
    },
  };
}

function buildGate(type, postX, stopZ, reachDirection) {
  switch (type) {
    case 'default':
      return buildBoomGate(postX, stopZ, reachDirection, ROAD_HALF_WIDTH * 2 + 0.6);
    case 'half':
      return buildBoomGate(postX, stopZ, reachDirection, ROAD_HALF_WIDTH + 0.6);
    case 'double':
      return buildDoubleBarrierGate(postX, stopZ, reachDirection);
    case 'swing':
      return buildSwingGate(postX, stopZ, reachDirection);
    case 'trolley':
      return buildTrolleyGate(postX, stopZ, reachDirection);
    default:
      return null; // 'none'
  }
}

// One approach's worth of protection - post, lamps, gate, whichever of
// those the current settings actually call for. `lamps` is the crossing's
// shared list (Game.setLamps() flashes all of them together); this pushes
// this unit's lamps into it rather than returning its own list, so the
// crossing keeps acting as a single unit regardless of how many approaches
// have lamps.
export function buildProtectionUnit(stopZ, postSide, barrierType, lightStyle, lamps) {
  const group = new THREE.Group();
  const postX = postSide * (ROAD_HALF_WIDTH + 0.4);
  const reachDirection = -postSide;

  if (barrierType !== 'none' || lightStyle !== 'none') {
    group.add(buildPost(postX, stopZ));
  }

  buildLamps(lightStyle, postX, stopZ, group, lamps);

  let apply = () => {};
  const gate = buildGate(barrierType, postX, stopZ, reachDirection);
  if (gate) {
    group.add(gate.group);
    apply = gate.apply;
  }

  return { group, apply };
}
