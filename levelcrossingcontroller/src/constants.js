// Shared tunables. World is a flat XZ plane: the railway runs along X
// (trains travel east/west), the road runs along Z (cars travel north/south),
// and they cross at the origin.

export const WORLD_HALF_X = 90; // visible extent of the track
export const WORLD_HALF_Z = 55; // visible extent of the road

export const ROAD_HALF_WIDTH = 3.2; // the road's own half-width - also the
// danger zone's half-extent along X, since that is exactly how far a train
// has to clear to be off the road
export const TRACK_HALF_WIDTH = 1.3; // the single track's half-width - the
// danger zone's half-extent along Z, for the same reason in the other axis

export const LANE_OFFSET = 1.6; // each direction of road traffic gets its
// own lane, offset either side of the track centreline

export const CAR_LENGTH = 2.6;
export const CAR_WIDTH = 1.5;
export const CAR_SPEED = 9; // units/s
export const CAR_MIN_GAP = 1.4; // bumper-to-bumper clearance in a queue

// How far short of the danger zone a queued car's *centre* stops. Must
// clear the car's own half-length or its front bumper would already be
// overlapping the danger zone - and therefore already "committed" (see
// Car.occupiesZone() in entities.js / Game.advanceLane() in game.js) -
// before it ever reaches the stop line the barrier is supposed to hold it
// at. Comfortably bigger than CAR_LENGTH / 2 (1.3) on purpose.
export const STOP_LINE_MARGIN = 1.6;

export const TRAIN_WIDTH = 2.4;
export const TRAIN_MIN_LENGTH = 10;
export const TRAIN_MAX_LENGTH = 16;
export const TRAIN_MIN_SPEED = 14;
export const TRAIN_MAX_SPEED = 22;

export const BARRIER_SECONDS = 1.6; // time for a boom to travel fully up/down
export const FLASH_INTERVAL = 0.5; // lamp alternation while the barrier is active

// How long before a train reaches the danger zone the warning (lights +
// bell) starts - has to comfortably exceed BARRIER_SECONDS or a perfectly
// timed player still could not get the barrier down in time.
export const WARNING_LEAD_TIME = 5.5;

// Difficulty ramps from *_START down to *_MIN over RAMP_SECONDS of play,
// then holds at the minimum - trains and cars both get more frequent.
//
// TRAIN_INTERVAL_MIN has to stay comfortably above WARNING_LEAD_TIME (5.5s):
// a 600s soak test (auto-toggling the barrier on/off with warningActive)
// showed that at 3.2s, back-to-back warnings kept the barrier down almost
// permanently once the ramp finished, backing traffic up to 500+
// simultaneous cars - not a fun late game, and a real framerate risk since
// cars are not instanced (see MAX_CARS below, added as a hard backstop for
// exactly this). Raised further, to 8s (from an original fix of 5s), simply
// because trains that frequent even with a working barrier felt relentless.
export const RAMP_SECONDS = 100;
export const TRAIN_INTERVAL_START = 13;
export const TRAIN_INTERVAL_MIN = 8;
export const CAR_INTERVAL_START = 3.2;
export const CAR_INTERVAL_MIN = 1.6;

// A hard ceiling on simultaneous cars, regardless of how the spawn/warning
// tuning above balances out. A 600s soak test (constant spawning, an
// auto-controller reacting instantly and optimally to every warning) still
// backed traffic up into the hundreds once the crossing fell behind even a
// little - spawning is simply skipped past this count rather than adding to
// an already-overwhelmed queue, which is what a real road would do (traffic
// backed up out of sight) and, just as importantly, keeps a runaway queue
// from ever tanking the framerate (cars are not instanced).
export const MAX_CARS = 40;
