// Shared tunables. World is a flat XZ plane: the railway runs along X
// (trains travel east/west), the road runs along Z (cars travel north/south),
// and they cross at the origin.

export const WORLD_HALF_X = 90; // visible extent of the track
export const WORLD_HALF_Z = 55; // visible extent of the road

export const ROAD_HALF_WIDTH = 3.2; // the road's own half-width - also the
// danger zone's half-extent along X, since that is exactly how far a train
// has to clear to be off the road
export const TRACK_HALF_WIDTH = 1.3; // one track's own half-width
export const TRACK_SPACING = 2.9; // centre-to-centre distance between
// adjacent parallel tracks when TRACK_COUNT > 1 - see
// settings.combinedTrackHalfWidth(), which is what actually determines the
// danger zone's half-extent along Z (one track's own TRACK_HALF_WIDTH when
// TRACK_COUNT is 1, wider for more)

export const LANE_OFFSET = 1.6; // each direction of road traffic gets its
// own lane, offset either side of the track centreline

export const CAR_LENGTH = 2.6;
export const CAR_WIDTH = 1.5;
export const CAR_SPEED = 9; // units/s
export const CAR_MIN_GAP = 1.4; // bumper-to-bumper clearance in a queue

// How far out from the danger zone the gate itself stands - this is a gate
// position, not a stop line (see GATE_CLEARANCE below for the actual
// stopping point), but has to stay comfortably bigger than CAR_LENGTH / 2
// (1.3) regardless: a smaller value let a queueing car's front bumper reach
// all the way into the danger zone - and so become permanently "committed"
// (Car.overlapsBand() / Game.advanceLane()) - before the gate could ever
// hold it.
export const STOP_LINE_MARGIN = 1.6;

// A queued car's *front bumper*, not its centre, stops this far short of
// the gate - Game.advanceLane() clamps `centre = gateZ - direction *
// (car.halfLength + GATE_CLEARANCE)` specifically so the car's body stops
// visibly before the barrier rather than at it. Clamping the centre straight
// to gateZ (an earlier version did this) left the car's own half-length
// hanging past the gate line, reading as the car stopping *inside* the
// barrier rather than in front of it.
export const GATE_CLEARANCE = 0.35;

export const TRAIN_WIDTH = 2.4;
export const TRAIN_MIN_LENGTH = 10;
export const TRAIN_MAX_LENGTH = 16;
export const TRAIN_MIN_SPEED = 14;
export const TRAIN_MAX_SPEED = 22;

export const BARRIER_SECONDS = 1.6; // time for a boom to travel fully up/down
export const FLASH_INTERVAL = 0.5; // lamp alternation while the barrier is active

// Lights turn on the instant the barrier is commanded down, but the gate
// itself waits this long before it actually starts moving - "warn first,
// then act", real crossings never slam the gate the same instant the
// lights come on. Only applies to closing; raising is immediate, since
// there is no equivalent safety reason to delay that.
export const BARRIER_CLOSE_DELAY = 2;

// Real UK level crossing signals show a steady amber for this long before
// the red lamps start flashing - lightStyle: 'uk' only (protection.js /
// Game.updateBarrier()). Every other light style flashes red immediately.
export const UK_AMBER_SECONDS = 3;

// A real German Bü signal shows its yellow lamp steadily lit for this long
// before the red one starts flashing - lightStyle: 'germany' only, the same
// lead-in idea as UK_AMBER_SECONDS above but its own shorter duration
// (Game.updateBarrier() shares the one amber-lead-in state machine between
// both styles, keyed off `lightStyle`).
export const GERMANY_AMBER_SECONDS = 2;

// lightStyle: 'wigwag' only - how fast and how far the lamp's arm swings
// while active (Game.updateBarrier() drives `swingPivot.rotation.z` from
// these). PERIOD is seconds for one full back-and-forth cycle; AMPLITUDE is
// how far each way, in radians.
export const WIGWAG_SWING_PERIOD = 0.9;
export const WIGWAG_SWING_AMPLITUDE = Math.PI / 5; // ~36 degrees each way

// How long before a train reaches the danger zone the warning (lights +
// bell) starts - has to comfortably exceed BARRIER_SECONDS or a perfectly
// timed player still could not get the barrier down in time.
export const WARNING_LEAD_TIME = 10.5;

// Cars still ramp from *_START down to *_MIN over RAMP_SECONDS of play, then
// hold at the minimum, getting more frequent as a run goes on.
export const RAMP_SECONDS = 100;
export const CAR_INTERVAL_START = 3.2;
export const CAR_INTERVAL_MIN = 1.6;

// Trains do NOT ramp - every gap is picked uniformly at random between these
// two, the whole run through (Game.spawnTrain() sets the next trainTimer
// straight from THREE.MathUtils.lerp(TRAIN_INTERVAL_MIN, TRAIN_INTERVAL_MAX,
// Math.random()), no extra jitter multiplier on top - the range itself is
// the variation). TRAIN_INTERVAL_MIN only has to clear WARNING_LEAD_TIME
// (10.5s) comfortably, which 30s does many times over - the old ramp-based
// tuning existed specifically to avoid warnings/barriers getting stuck on
// back-to-back near a much lower floor (see git history), which is not a
// concern at these intervals.
export const TRAIN_INTERVAL_MIN = 30;
export const TRAIN_INTERVAL_MAX = 120;

// A hard ceiling on simultaneous cars, regardless of how the spawn/warning
// tuning above balances out. A 600s soak test (constant spawning, an
// auto-controller reacting instantly and optimally to every warning) still
// backed traffic up into the hundreds once the crossing fell behind even a
// little - spawning is simply skipped past this count rather than adding to
// an already-overwhelmed queue, which is what a real road would do (traffic
// backed up out of sight) and, just as importantly, keeps a runaway queue
// from ever tanking the framerate (cars are not instanced).
export const MAX_CARS = 40;
