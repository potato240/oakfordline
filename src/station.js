import * as THREE from 'three';
import {
  PLATFORM_HEIGHT,
  PLATFORM_WIDTH,
  PLATFORM_LENGTH,
  PLATFORM_CENTRE_X,
  PLATFORM_EDGE_X,
  CANOPY_HEIGHT,
  CANOPY_LENGTH,
} from './layout.js';

// Station name rendered to a canvas and used as a texture. Cheaper and
// sharper than geometry, and it makes the place feel named.
function createSignTexture(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;

  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0d2b4e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 18, canvas.width, 6);
  ctx.fillRect(0, canvas.height - 24, canvas.width, 6);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 130px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 6);

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 8;
  return texture;
}

function createPlatformDeck() {
  const group = new THREE.Group();

  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(PLATFORM_WIDTH, PLATFORM_HEIGHT, PLATFORM_LENGTH),
    new THREE.MeshStandardMaterial({ color: 0xa8a49b, roughness: 0.9 })
  );
  deck.position.set(PLATFORM_CENTRE_X, PLATFORM_HEIGHT / 2, 0);
  deck.castShadow = true;
  deck.receiveShadow = true;
  group.add(deck);

  // Yellow safety line, and the darker tactile strip outboard of it.
  const line = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.02, PLATFORM_LENGTH),
    new THREE.MeshStandardMaterial({ color: 0xe8c317, roughness: 0.7 })
  );
  line.position.set(PLATFORM_EDGE_X + 0.85, PLATFORM_HEIGHT + 0.01, 0);
  group.add(line);

  const tactile = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.02, PLATFORM_LENGTH),
    new THREE.MeshStandardMaterial({ color: 0x8c8880, roughness: 1 })
  );
  tactile.position.set(PLATFORM_EDGE_X + 0.35, PLATFORM_HEIGHT + 0.011, 0);
  group.add(tactile);

  // White edge coping stones along the platform lip.
  const coping = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, PLATFORM_HEIGHT + 0.02, PLATFORM_LENGTH),
    new THREE.MeshStandardMaterial({ color: 0xd8d4cc, roughness: 0.85 })
  );
  coping.position.set(PLATFORM_EDGE_X + 0.06, PLATFORM_HEIGHT / 2, 0);
  group.add(coping);

  return group;
}

function createCanopy() {
  const group = new THREE.Group();

  const columnGeometry = new THREE.CylinderGeometry(0.09, 0.09, CANOPY_HEIGHT, 10);
  const columnMaterial = new THREE.MeshStandardMaterial({
    color: 0x1f4c33,
    roughness: 0.6,
    metalness: 0.3,
  });

  for (let z = -CANOPY_LENGTH / 2; z <= CANOPY_LENGTH / 2; z += 6) {
    for (const x of [PLATFORM_CENTRE_X - 2.2, PLATFORM_CENTRE_X + 2.2]) {
      const column = new THREE.Mesh(columnGeometry, columnMaterial);
      column.position.set(x, PLATFORM_HEIGHT + CANOPY_HEIGHT / 2, z);
      column.castShadow = true;
      group.add(column);
    }
  }

  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(6.4, 0.18, CANOPY_LENGTH),
    new THREE.MeshStandardMaterial({ color: 0x2f5f45, roughness: 0.7 })
  );
  roof.position.set(PLATFORM_CENTRE_X, PLATFORM_HEIGHT + CANOPY_HEIGHT, 0);
  roof.castShadow = true;
  group.add(roof);

  // Valance boards hanging off both roof edges.
  for (const side of [-1, 1]) {
    const valance = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.34, CANOPY_LENGTH),
      new THREE.MeshStandardMaterial({ color: 0x264f39, roughness: 0.8 })
    );
    valance.position.set(
      PLATFORM_CENTRE_X + side * 3.2,
      PLATFORM_HEIGHT + CANOPY_HEIGHT - 0.22,
      0
    );
    group.add(valance);
  }

  return group;
}

function createBench(z) {
  const bench = new THREE.Group();

  const wood = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.85 });
  const metal = new THREE.MeshStandardMaterial({
    color: 0x1f4c33,
    roughness: 0.6,
    metalness: 0.3,
  });

  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 1.8), wood);
  seat.position.y = 0.45;
  seat.castShadow = true;
  bench.add(seat);

  const back = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 1.8), wood);
  back.position.set(0.22, 0.7, 0);
  back.castShadow = true;
  bench.add(back);

  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.45, 0.08), metal);
    leg.position.set(0, 0.22, side * 0.75);
    bench.add(leg);
  }

  bench.position.set(PLATFORM_CENTRE_X + 1.6, PLATFORM_HEIGHT, z);
  return bench;
}

function createLamp(z) {
  const lamp = new THREE.Group();

  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.08, 3.2, 8),
    new THREE.MeshStandardMaterial({ color: 0x1f4c33, roughness: 0.6, metalness: 0.3 })
  );
  post.position.y = 1.6;
  post.castShadow = true;
  lamp.add(post);

  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.14, 0.5),
    new THREE.MeshStandardMaterial({
      color: 0xfff4d0,
      emissive: 0xffe9b0,
      emissiveIntensity: 0.8,
      roughness: 0.4,
    })
  );
  head.position.y = 3.2;
  lamp.add(head);

  lamp.position.set(PLATFORM_CENTRE_X + 3.4, PLATFORM_HEIGHT, z);
  return lamp;
}

function createNameSign(z, name) {
  const sign = new THREE.Group();

  const board = new THREE.Mesh(
    new THREE.BoxGeometry(3.4, 0.85, 0.08),
    new THREE.MeshStandardMaterial({
      map: createSignTexture(name),
      roughness: 0.6,
    })
  );
  board.position.y = 2.1;
  board.castShadow = true;
  sign.add(board);

  const postMaterial = new THREE.MeshStandardMaterial({
    color: 0x1f4c33,
    roughness: 0.6,
    metalness: 0.3,
  });

  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 2.1, 8),
      postMaterial
    );
    post.position.set(side * 1.3, 1.05, 0);
    sign.add(post);
  }

  // Face the sign across the platform, towards an arriving passenger.
  sign.rotation.y = -Math.PI / 2;
  sign.position.set(PLATFORM_CENTRE_X + 2.6, PLATFORM_HEIGHT, z);
  return sign;
}

// Small brick building at the far end of the platform.
function createStationHouse() {
  const group = new THREE.Group();

  const walls = new THREE.Mesh(
    new THREE.BoxGeometry(6, 3.4, 9),
    new THREE.MeshStandardMaterial({ color: 0x8f5a45, roughness: 0.95 })
  );
  walls.position.y = 1.7;
  walls.castShadow = true;
  walls.receiveShadow = true;
  group.add(walls);

  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(5.2, 1.8, 4),
    new THREE.MeshStandardMaterial({ color: 0x3d3a38, roughness: 0.9 })
  );
  roof.position.y = 4.3;
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  group.add(roof);

  const doorway = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 2.1, 1.2),
    new THREE.MeshStandardMaterial({ color: 0x2b1d16, roughness: 0.9 })
  );
  doorway.position.set(-3.01, 1.05, 0);
  group.add(doorway);

  const windowMaterial = new THREE.MeshStandardMaterial({
    color: 0x1b2a33,
    roughness: 0.25,
    metalness: 0.1,
  });

  for (const z of [-2.6, 2.6]) {
    const pane = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.2, 1.4), windowMaterial);
    pane.position.set(-3.01, 1.9, z);
    group.add(pane);
  }

  group.position.set(PLATFORM_CENTRE_X + 1.2, PLATFORM_HEIGHT, -PLATFORM_LENGTH / 2 + 7);
  return group;
}

export function createStation({ name, z }) {
  const station = new THREE.Group();
  station.name = `station:${name}`;

  station.add(createPlatformDeck());
  station.add(createCanopy());
  station.add(createStationHouse());

  for (const benchZ of [-9, 1, 11]) station.add(createBench(benchZ));
  for (const lampZ of [-14, -2, 10, 22]) station.add(createLamp(lampZ));
  for (const signZ of [-6, 8]) station.add(createNameSign(signZ, name.toUpperCase()));

  station.position.z = z;
  return station;
}
