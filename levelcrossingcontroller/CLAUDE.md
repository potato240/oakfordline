# Level Crossing Controller

A top-down arcade game: you are the signalman at a single road/rail level
crossing. Trains cross the road at random intervals from either direction;
cars queue up on the road from either direction. Lower the barrier before a
train arrives, raise it once the line is clear, and never leave a car
trapped on the tracks when a train comes through.

This game lives inside the Oakford Line repo purely to reuse its three.js
/ Vite install - it shares no code or design with Oakford Line. See
`CLAUDE.md` at the repo root for how the two are wired together as separate
Vite pages in one build. Don't reach into `../src/` for anything; this app
is meant to stay fully self-contained.

## Current state

A complete, playable MVP:

- Fixed top-down-ish camera over a single crossing. Track runs along X
  (trains), road runs along Z (cars), they cross at the origin.
- Trains spawn off one edge, cross, and despawn off the other - random
  direction, length and speed each time, `TRAIN_INTERVAL_MIN`-`_MAX` (30-120s)
  apart, picked uniformly at random each time with no ramp - deliberately
  unpredictable rather than a rhythm the player can just learn.
- Cars spawn on the road in two lanes (one per direction), queue behind each
  other with a fixed minimum gap, and stop at the barrier when it is down.
- One shared barrier (two gate arms, one per approach) the player raises and
  lowers with Space or the on-screen button. Takes `BARRIER_SECONDS` to
  travel, so it has to be commanded down with enough lead time, not
  slammed shut on arrival.
- Lights and a bell (`playWarningDing()`) start automatically
  `WARNING_LEAD_TIME` seconds before any train would reach the crossing -
  the player's cue to act, not an autopilot; the barrier does not move on
  its own.
- Cars ramp up over `RAMP_SECONDS`, getting more frequent down to a floor
  (`CAR_INTERVAL_MIN`). Trains do not ramp - see above.
- Score: +1 per car that clears the crossing, +2 per train. Collision ends
  the run with a game-over screen and a restart.

Not built yet: no sound files (everything in `audio.js` is synthesised, the
same approach Oakford Line uses), no visual variety beyond a few car
colours, no persistent high score.

## Layout

| Path | Purpose |
| ---- | ------- |
| `index.html` | Entry point - canvas, HUD, warning banner, start/game-over overlays. |
| `src/main.js` | Renderer, resize handling, UI wiring, the animation loop. |
| `src/constants.js` | Every tunable - world size, speeds, timings, difficulty ramp. Edit here first. |
| `src/scene.js` | Builds the static scene: ground, road, track, barrier assemblies. |
| `src/entities.js` | `Train` and `Car` classes - geometry plus their own movement/zone math. |
| `src/game.js` | `Game` - owns all live state, spawning, the barrier state machine, collision detection, scoring. |
| `src/audio.js` | Synthesised warning ding / crash / car-pass tones. No audio files. |
| `src/style.css` | HUD, banner, overlays. |

## The danger zone, and how collision actually works

The "danger zone" is simply the rectangle where the road and track
overlap: `X ∈ [-ROAD_HALF_WIDTH, ROAD_HALF_WIDTH]`,
`Z ∈ [-TRACK_HALF_WIDTH, TRACK_HALF_WIDTH]` (`constants.js`). Both `Train`
and `Car` expose `occupiesZone(halfWidth)` - a standard interval-overlap
test between the entity's own body and that rectangle. `Game.checkCollision()`
is deliberately almost nothing:

```js
const trainInZone = this.trains.some((t) => t.occupiesZone(ROAD_HALF_WIDTH));
const carInZone = this.cars.some((c) => c.occupiesZone(TRACK_HALF_WIDTH));
if (trainInZone && carInZone) { this.gameOver = true; ... }
```

There is no separate "is the barrier down" check here at all - and that is
on purpose, not an oversight. The barrier's only job is to stop cars from
*physically entering* the zone in the first place (see below); if it does
that correctly, a car and a train can never overlap. If the player is too
slow, a car ends up in the zone anyway, and *then* a train arriving is a
real geometric overlap, not a rules violation - the simplest possible model
of "what actually happens" rather than a scripted "you lose" condition
layered on top of it.

## Cars: commit or stop, never both

Every frame, `Game.advanceLane()` walks one lane's cars (ordered lead-car
first) and clamps each one's desired position by, at most, two things:

1. **The car ahead** - a fixed minimum gap, always enforced, regardless of
   the barrier.
2. **The stop line** - only if the car has not yet `committed`, and only
   while the barrier is closing or closed (`this.lowered > 0.12`).

`committed` is set, permanently, the moment a car's own `occupiesZone()`
first turns true - once a car's body has started overlapping the danger
zone, it no longer stops for the barrier and just drives straight through
and out the other side, exactly like a real driver would rather than
slamming on the brakes mid-crossing. This is what makes closing the barrier
*late* genuinely dangerous rather than merely rude: a car already committed
when the gates come down carries on regardless.

**This is also where a real bug lived**, worth knowing about if the zone or
car dimensions ever change: the stop line sits at
`TRACK_HALF_WIDTH + STOP_LINE_MARGIN` from the crossing centre, but a
car's `occupiesZone()` check is about its *body*, not its centre point - it
turns true once the car's front bumper (its centre plus
`CAR_LENGTH / 2`) reaches the zone edge, not once its centre does.
`STOP_LINE_MARGIN` was originally `1.0`, smaller than `CAR_LENGTH / 2`
(`1.3`) - so a queueing car's front bumper crossed into the danger zone,
and so became permanently `committed`, *before* its centre ever reached the
stop line the barrier clamp was supposed to hold it at. Cars sailed straight
through a fully lowered barrier without ever stopping. Fixed by making
`STOP_LINE_MARGIN` (`1.6`) comfortably bigger than `CAR_LENGTH / 2`, so a
stopped car's body never overlaps the zone in the first place. Verified with
a scripted test: a car placed 40 units out, with the barrier commanded down
immediately, now stops with its centre exactly at the stop line and a train
passes clean through the zone with zero overlap - `sawCollision: false`
across the whole run.

## The warning has to actually turn off again

`Train.distanceToZone()` returns the *signed* distance from a train's
leading edge to the zone's near edge - positive while still approaching,
negative once the train has already passed through. `Game.updateWarning()`
explicitly skips any train with `distance <= 0`:

```js
const distance = train.distanceToZone(ROAD_HALF_WIDTH);
if (distance <= 0) continue; // already cleared the zone - not a threat
if (distance / train.speed <= WARNING_LEAD_TIME) active = true;
```

An earlier version clamped `distanceToZone()` itself to `Math.max(0, ...)`,
so a train that had already passed through - now coasting the long distance
out to its own despawn point, well beyond the zone - read as permanently
"about to arrive" (distance stuck at exactly `0`) for that entire coast, not
just the brief instant it was genuinely near. That kept `warningActive` true
almost permanently, which (via a scripted auto-controller that lowers on
every warning and raises the instant it clears, used specifically to test
this) kept the barrier down almost continuously and cars backed up
unboundedly. A 600-second soak test with the fix landed at a steady 25
distinct warning-on events rather than 1, confirming the warning genuinely
toggles off between trains again.

## Traffic can still legitimately overwhelm the crossing - MAX_CARS caps it

Even with both fixes above, the same 600-second soak test (constant
spawning, the same instant-reaction auto-controller) showed car counts
climbing past 500 once the difficulty ramp reached its floor - the spawn
rate at `CAR_INTERVAL_MIN` can simply out-pace how much time the crossing
spends open, and once a queue is that far behind it never recovers. That is
a legitimate difficulty-balance question, not obviously a bug, and it is
only a first-pass tuning (`RAMP_SECONDS`, `CAR_INTERVAL_MIN`, etc. in
`constants.js` are all fair game to retune later) - but an *unbounded* car
count is also a straightforward frame-rate risk, since cars are plain
meshes, not instanced. `Game.spawnCar()` refuses to add another car past
`MAX_CARS` (40) regardless of how the timing tuning balances out, so a
backed-up crossing reads as "the road is jammed out of sight" rather than
degrading performance. Re-run with the cap in place: the same 600s soak test
holds steady at exactly 40 cars from ~t=200s onward, with score still
climbing the whole time - stable indefinitely, not just for a few minutes.

## Verifying changes here

Screenshots in this environment are frequently unreliable (the preview
pane's viewport can report 0x0). The approach that actually works, used
throughout the fixes above: drive `Game` directly from injected JS against
the live page (`window.game` is exposed in dev builds, `main.js`) - call
`game.update(delta)` in a tight loop with a fixed delta to advance
simulated time far faster and more deterministically than real time, push
entities into known positions to engineer a specific scenario (a queued
car, an imminent collision, a long soak test), and assert on the resulting
state. A collision needs a *genuine* time-overlap between a train's arrival
and a car's transit - it is easy to write a "collision test" that
accidentally isn't one because the car clears the zone long before the
train arrives; the reliable way to force one is to place both entities
already inside `occupiesZone()` before the first `update()` call, not to
guess at relative timing.
