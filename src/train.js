import * as THREE from 'three';
import { TRACK_GAUGE, RAIL_TOP_Y } from './layout.js';

const CAR_LENGTH = 19.5;
const CAR_WIDTH = 2.8;
const CAR_HEIGHT = 2.5;
const CAR_GAP = 0.7;

const WHEEL_RADIUS = 0.45;
// Wheels rest on the railhead, so their centres sit one radius above it.
const AXLE_Y = RAIL_TOP_Y + WHEEL_RADIUS;
const FLOOR_Y = AXLE_Y + 0.22;
const BODY_CENTRE_Y = FLOOR_Y + CAR_HEIGHT / 2;

const LIVERY_LOWER = 0x8c2b2b;
const LIVERY_UPPER = 0xe8e0cf;
const ROOF_COLOUR = 0x4a4a4d;
const GLASS_COLOUR = 0x16232b;

const bodyLower = new THREE.MeshStandardMaterial({
  color: LIVERY_LOWER,
  roughness: 0.45,
  metalness: 0.15,
});
const bodyUpper = new THREE.MeshStandardMaterial({
  color: LIVERY_UPPER,
  roughness: 0.5,
});
const roofMaterial = new THREE.MeshStandardMaterial({
  color: ROOF_COLOUR,
  roughness: 0.7,
});
const glassMaterial = new THREE.MeshStandardMaterial({
  color: GLASS_COLOUR,
  roughness: 0.15,
  metalness: 0.4,
});
const underMaterial = new THREE.MeshStandardMaterial({
  color: 0x232326,
  roughness: 0.9,
});

function createBogie(z) {
  const bogie = new THREE.Group();

  const frame = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.42, 3.4), underMaterial);
  frame.position.y = AXLE_Y + 0.18;
  frame.castShadow = true;
  bogie.add(frame);

  const wheelGeometry = new THREE.CylinderGeometry(
    WHEEL_RADIUS,
    WHEEL_RADIUS,
    0.13,
    16
  );
  const wheelMaterial = new THREE.MeshStandardMaterial({
    color: 0x3a3a3d,
    roughness: 0.5,
    metalness: 0.6,
  });

  for (const axleZ of [-1.1, 1.1]) {
    for (const side of [-1, 1]) {
      const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
      // Cylinders stand up the Y axis by default; lay it over so the axle
      // runs across the track.
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set((side * TRACK_GAUGE) / 2, AXLE_Y, axleZ);
      wheel.castShadow = true;
      bogie.add(wheel);
    }
  }

  bogie.position.z = z;
  return bogie;
}

function createCarriage({ cab = false } = {}) {
  const car = new THREE.Group();

  // Lower body in livery colour.
  const lower = new THREE.Mesh(
    new THREE.BoxGeometry(CAR_WIDTH, CAR_HEIGHT * 0.55, CAR_LENGTH),
    bodyLower
  );
  lower.position.y = FLOOR_Y + (CAR_HEIGHT * 0.55) / 2;
  lower.castShadow = true;
  lower.receiveShadow = true;
  car.add(lower);

  // Cream band above the waistline, inset very slightly so the join reads.
  const upper = new THREE.Mesh(
    new THREE.BoxGeometry(CAR_WIDTH - 0.02, CAR_HEIGHT * 0.45, CAR_LENGTH),
    bodyUpper
  );
  upper.position.y = FLOOR_Y + CAR_HEIGHT * 0.55 + (CAR_HEIGHT * 0.45) / 2;
  upper.castShadow = true;
  car.add(upper);

  // Curved roof.
  const roof = new THREE.Mesh(
    new THREE.CylinderGeometry(CAR_WIDTH / 2, CAR_WIDTH / 2, CAR_LENGTH, 16, 1, false, 0, Math.PI),
    roofMaterial
  );
  roof.rotation.z = Math.PI / 2;
  roof.rotation.y = Math.PI / 2;
  roof.scale.y = 0.34;
  roof.position.y = FLOOR_Y + CAR_HEIGHT;
  roof.castShadow = true;
  car.add(roof);

  // Side windows and doors.
  const windowGeometry = new THREE.BoxGeometry(CAR_WIDTH + 0.04, 0.85, 1.5);
  const doorGeometry = new THREE.BoxGeometry(CAR_WIDTH + 0.05, 1.95, 1.1);
  const doorMaterial = new THREE.MeshStandardMaterial({
    color: 0x6f2222,
    roughness: 0.5,
  });

  const windowY = FLOOR_Y + CAR_HEIGHT * 0.68;

  for (const z of [-6.4, -4.2, -2.0, 2.0, 4.2, 6.4]) {
    const pane = new THREE.Mesh(windowGeometry, glassMaterial);
    pane.position.set(0, windowY, z);
    car.add(pane);
  }

  for (const z of [-8.3, 8.3]) {
    const door = new THREE.Mesh(doorGeometry, doorMaterial);
    door.position.set(0, FLOOR_Y + 0.98, z);
    car.add(door);

    const doorGlass = new THREE.Mesh(
      new THREE.BoxGeometry(CAR_WIDTH + 0.07, 0.6, 0.8),
      glassMaterial
    );
    doorGlass.position.set(0, windowY, z);
    car.add(doorGlass);
  }

  car.add(createBogie(-CAR_LENGTH / 2 + 3.2));
  car.add(createBogie(CAR_LENGTH / 2 - 3.2));

  if (cab) {
    // Windscreen raked back over the driving end.
    const screen = new THREE.Mesh(
      new THREE.BoxGeometry(CAR_WIDTH - 0.25, 1.0, 0.5),
      glassMaterial
    );
    screen.position.set(0, FLOOR_Y + CAR_HEIGHT * 0.72, CAR_LENGTH / 2 - 0.15);
    screen.rotation.x = -0.22;
    car.add(screen);

    const headlight = new THREE.MeshStandardMaterial({
      color: 0xfff6de,
      emissive: 0xffe9b0,
      emissiveIntensity: 1.2,
    });

    for (const side of [-1, 1]) {
      const lamp = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, 0.16, 0.1),
        headlight
      );
      lamp.position.set(side * 0.85, FLOOR_Y + 0.45, CAR_LENGTH / 2 + 0.02);
      car.add(lamp);
    }
  }

  return car;
}

// A two-car unit standing at the platform.
export function createTrain() {
  const train = new THREE.Group();
  train.name = 'train';

  const front = createCarriage({ cab: true });
  front.position.z = (CAR_LENGTH + CAR_GAP) / 2;
  train.add(front);

  const rear = createCarriage();
  rear.position.z = -(CAR_LENGTH + CAR_GAP) / 2;
  train.add(rear);

  // Bodies are modelled around the track centreline already; just place the
  // whole unit along the platform.
  train.position.set(0, 0, -2);
  return train;
}

export { BODY_CENTRE_Y };
