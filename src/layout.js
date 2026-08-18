// Shared world dimensions. Everything that has to line up - rails, train
// bogies, platform edge, canopy - reads from here rather than re-deriving
// numbers locally.

export const TRACK_GAUGE = 1.435; // standard gauge, metres between rail inners
export const TRACK_LENGTH = 400;

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
