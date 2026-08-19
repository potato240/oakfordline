// Shared world dimensions. Everything that has to line up - rails, train
// bogies, platform edge, door openings - reads from here rather than
// re-deriving numbers locally.

export const TRACK_GAUGE = 1.435; // standard gauge, metres between rail inners
export const TRACK_LENGTH = 4600;

export const BALLAST_HEIGHT = 0.2;
export const SLEEPER_HEIGHT = 0.16;
export const RAIL_HEIGHT = 0.14;

// Top of the running rail - the surface train wheels sit on.
export const RAIL_TOP_Y = BALLAST_HEIGHT + SLEEPER_HEIGHT + RAIL_HEIGHT;

export const PLATFORM_HEIGHT = 1.0;
export const PLATFORM_WIDTH = 8;
export const PLATFORM_LENGTH = 64;
export const PLATFORM_CENTRE_X = 5.6;

// Inner edge of the platform, i.e. the side facing the track.
export const PLATFORM_EDGE_X = PLATFORM_CENTRE_X - PLATFORM_WIDTH / 2;

export const CANOPY_HEIGHT = 3.6;
export const CANOPY_LENGTH = 34;

// ---- rolling stock ----

export const CAR_LENGTH = 19.5;
export const CAR_WIDTH = 2.8;
export const CAR_HEIGHT = 2.5;
export const CAR_GAP = 0.7;
export const WALL_THICKNESS = 0.12;

export const WHEEL_RADIUS = 0.45;
export const AXLE_Y = RAIL_TOP_Y + WHEEL_RADIUS;

// Interior floor level, and the ceiling above it.
export const FLOOR_Y = AXLE_Y + 0.22;
export const INTERIOR_HEIGHT = 2.25;

// Doorway positions along the car, on both sides. Both sides are built and
// can open; which one actually does at a given stop is decided per-station
// by STATIONS[].platformSide, in Train.applyDoors() (train.js).
export const DOOR_CENTRES = [-6, 0, 6];
export const DOOR_HALF_WIDTH = 0.65;
export const DOOR_HEIGHT = 1.95;

// ---- the line ----

// The route runs along Z. The train works down the line calling at each stop
// in turn, then reverses at the terminus and works back.
// platformSide: which side of the train the platform is on at this stop
// (+1 or -1). The train opens doors on whichever side matches the station it
// has actually arrived at, rather than a fixed side - so a future station can
// set -1 and the correct doors will open there. Station geometry in
// station.js does not yet mirror for -1; that is separate work from the door
// logic and would need doing before any station actually uses it.
export const STATIONS = [
  { name: 'Oakford', z: 0, platformSide: 1 },
  { name: 'Bramley Halt', z: -280, platformSide: 1 },
  { name: 'Wexley', z: -560, platformSide: 1 },
  { name: 'Marsden Cross', z: -840, platformSide: 1 },
  { name: 'Kingsford', z: -1120, platformSide: 1 },
  { name: 'Ashcombe', z: -1400, platformSide: 1 },
  { name: 'Thornleigh', z: -1680, platformSide: 1 },
  { name: 'Portmead', z: -1960, platformSide: 1 },
];
