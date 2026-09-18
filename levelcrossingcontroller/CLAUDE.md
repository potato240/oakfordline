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

A complete, playable MVP, now with customisation:

- Fixed top-down-ish camera over a single crossing (never orbits or pans -
  only dollies in/out, via scroll or +/-, see "Zoom" below). Track runs
  along X (trains), road runs along Z (cars), they cross at the origin.
- Trains spawn off one edge, cross, and despawn off the other - random
  direction, length and speed each time, `TRAIN_INTERVAL_MIN`-`_MAX` (30-120s)
  apart, picked uniformly at random each time with no ramp - deliberately
  unpredictable rather than a rhythm the player can just learn. On more than
  one track (see Customisation), each spawn picks one of the tracks at
  random too.
- Cars spawn on the road in two lanes (one per direction, right-hand
  traffic), queue behind each other with a fixed minimum gap, and stop at
  the barrier when it is down.
- A shared barrier (one gate per approach, whichever style is selected) the
  player raises and lowers with Space or the on-screen button. Takes
  `BARRIER_SECONDS` to travel, so it has to be commanded down with enough
  lead time, not slammed shut on arrival.
- Lights and a bell (`playWarningDing()`) start automatically
  `WARNING_LEAD_TIME` seconds before any train would reach the crossing -
  the player's cue to act, not an autopilot; the barrier does not move on
  its own.
- Cars ramp up over `RAMP_SECONDS`, getting more frequent down to a floor
  (`CAR_INTERVAL_MIN`). Trains do not ramp - see above.
- Score: +1 per car that clears the crossing, +2 per train. Collision ends
  the run with a game-over screen, a same-settings restart, and a link back
  to the settings screen.
- A small "Next train" box (top right) counting down to the next train's
  arrival - see `Game.nextTrainETA()` below.
- **Customisation**, chosen on the start screen and persisted to
  `localStorage`: barrier style (full boom / half barrier / double barrier /
  swing gate / trolley gate / none), light style (default / UK / America /
  France / Sweden / the Netherlands / none), track count (1-4), and
  surroundings (default / city / town / farm / village / rural). See
  "Customisation" below - a settings
  *change* only takes effect on a fresh `Game`, since the scene it builds is
  not something an existing one can rebuild in place.

Not built yet: no sound files (everything in `audio.js` is synthesised, the
same approach Oakford Line uses), no persistent high score.

## Layout

| Path | Purpose |
| ---- | ------- |
| `index.html` | Entry point - canvas, HUD, warning banner, start/settings/game-over overlays. |
| `src/main.js` | Renderer, resize handling, settings UI, the animation loop. |
| `src/settings.js` | The option lists (barrier/light/track/surroundings), defaults, `localStorage` load/save. |
| `src/constants.js` | Every tunable - world size, speeds, timings, difficulty ramp. Edit here first. |
| `src/scene.js` | Orchestrates the static scene per current settings: ground, road, track, protection units, surroundings. |
| `src/protection.js` | Barrier + light styles - `buildProtectionUnit()`, one per approach. |
| `src/track.js` | The (possibly multi-track) railway corridor geometry. |
| `src/surroundings.js` | The six surroundings presets' decorative props. |
| `src/entities.js` | `Train` and `Car` classes - geometry plus their own movement/zone math. |
| `src/game.js` | `Game` - owns all live state, spawning, the barrier state machine, collision detection, scoring. |
| `src/audio.js` | Synthesised warning ding / crash / car-pass tones. No audio files. |
| `src/style.css` | HUD, banner, overlays, settings panel. |

## The danger zone, and how collision actually works

With `TRACK_COUNT` now selectable (1-4), "the danger zone" is really two
things at once:

- **Per-track**, for collision: each track has its own narrow band,
  `X ∈ [-ROAD_HALF_WIDTH, ROAD_HALF_WIDTH]`,
  `Z ∈ [trackZ - TRACK_HALF_WIDTH, trackZ + TRACK_HALF_WIDTH]` - a train on
  one track can only ever be hit by a car whose body overlaps *that* band,
  not any other track's.
- **Combined**, for the stop line and for a car's own "have I committed"
  check: the union of every track's band,
  `Z ∈ [-combinedHalfWidth, combinedHalfWidth]`
  (`settings.combinedTrackHalfWidth(trackCount)`) - a car has to clear the
  *whole* multi-track corridor before it is genuinely safe, not just one
  track of it.

`Train.occupiesZone(halfWidth)` is an X-only check (unaffected by track
count - it is about the *road's* width, not which track). `Car` exposes the
more general `overlapsBand(centerZ, halfWidth)`, a standard interval-overlap
test against an arbitrary band, so it can serve both roles:

```js
// Game.checkCollision() - per train, against that train's own track band
for (const train of this.trains) {
  if (!train.occupiesZone(ROAD_HALF_WIDTH)) continue;
  if (this.cars.some((c) => c.overlapsBand(train.trackZ, TRACK_HALF_WIDTH))) {
    this.gameOver = true; ...
  }
}
```

There is no separate "is the barrier down" check here at all - and that is
on purpose, not an oversight. The barrier's only job is to stop cars from
*physically entering* the zone in the first place (see below); if it does
that correctly, a car and a train can never overlap. If the player is too
slow, a car ends up in the zone anyway, and *then* a train arriving is a
real geometric overlap, not a rules violation - the simplest possible model
of "what actually happens" rather than a scripted "you lose" condition
layered on top of it. Verified directly: a train and a car placed on
*different* tracks of a 3-track crossing, both already technically "in the
zone", do not collide; moved onto the *same* track, they do.

## Cars: commit or stop, never both

**Which side of the road each direction drives on** is decided once, in
`Game.spawnCar()`: `laneX = direction > 0 ? -LANE_OFFSET : LANE_OFFSET`. The
fixed camera looks from +Z toward -Z with world +X as screen-right
(`camera.lookAt(0, 0, -4)` from a +Z eye position, `scene.js`), so a car
heading +Z (south, toward the camera) has its own right-hand side toward
world -X, and one heading -Z (north) has its own right toward world +X -
right-hand traffic, the same rule real roads use, just derived from this
scene's specific axis/camera convention rather than assumed. Getting the
sign backwards here silently produces left-hand traffic instead - there is
no visual crash to catch it, only two lanes that still work but pass each
other on the wrong side, so if `LANE_OFFSET`, the camera position, or the
world's Z convention ever change, re-derive this rather than guessing.

Every frame, `Game.advanceLane()` walks one lane's cars (ordered lead-car
first) and clamps each one's desired position by, at most, two things:

1. **The car ahead** - a fixed minimum gap, always enforced, regardless of
   the barrier.
2. **The gate** - only if the car has not yet `committed`, and only while
   the barrier is closing or closed (`this.lowered > 0.12`).

`committed` is set, permanently, the moment a car's own
`overlapsBand(0, combinedHalfWidth)` first turns true - once a car's body has
started overlapping the (combined, multi-track) danger zone, it no longer
stops for the barrier and just drives straight through and out the other
side, exactly like a real driver would rather than slamming on the brakes
mid-crossing. This is what makes closing the barrier *late* genuinely
dangerous rather than merely rude: a car already committed when the gates
come down carries on regardless.

**This is also where two real bugs lived**, both worth knowing about if the
zone or car dimensions ever change:

1. The danger zone's edge sits at `combinedHalfWidth`, but a car's overlap
   check is about its *body*, not its centre point - it turns true once the
   car's front bumper (its centre plus `CAR_LENGTH / 2`) reaches the zone
   edge, not once its centre does. `STOP_LINE_MARGIN` (how far out the gate
   itself stands from that edge) was originally `1.0`, smaller than
   `CAR_LENGTH / 2` (`1.3`) - so a queueing car's front bumper crossed into
   the danger zone, and so became permanently `committed`, *before* its
   centre ever reached the gate. Cars sailed straight through a fully
   lowered barrier without ever stopping. Fixed by making `STOP_LINE_MARGIN`
   (`1.6`) comfortably bigger than `CAR_LENGTH / 2`.
2. Fixing that revealed a second, related one: the clamp stopped a car's
   *centre* exactly at the gate's own Z position, which still leaves the
   car's front half-length hanging *past* the gate line - the car visibly
   stopped inside the barrier rather than in front of it. Fixed by clamping
   the front bumper instead: `centre = gateZ - direction * (car.halfLength +
   GATE_CLEARANCE)`, so the car's body stops `GATE_CLEARANCE` (`0.35`) short
   of the gate, not straddling it. Verified with a scripted test across
   1/2/4 tracks: the front bumper sits exactly `0.35` short of the gate line
   in every case, and (separately) a car placed 40 units out with the
   barrier commanded down immediately still stops cleanly and a train
   passes clean through the zone with zero overlap.

## Lights come on before the barrier actually moves

Real crossings never slam the gate the same instant the lights come on -
there is always a short lights-only warning first. `Game.updateBarrier()`
decouples "lights on" from "gate physically moving" to match: the lights
(`lightsOn = this.barrierTarget === 1 || this.lowered > 0.02`) key off the
player's *command*, not `this.lowered` alone, while the gate itself is held
at `this.lowered = 0` for `BARRIER_CLOSE_DELAY` (2s) after a fresh close
command before it is allowed to start moving:

```js
if (this.barrierTarget === 1) {
  if (!this.waitingToClose && this.lowered === 0) {
    this.waitingToClose = true;
    this.closeDelayTimer = BARRIER_CLOSE_DELAY;
  }
} else {
  this.waitingToClose = false;
}
```

The delay only ever starts fresh from a fully raised gate (`this.lowered ===
0`) - re-commanding close while already mid-close, or already mid-delay,
does not restart it. It also only applies to closing: raising
(`barrierTarget` back to `0`) is immediate, the same as before this change,
since there is no equivalent safety reason to delay a gate opening back up.
This is independent of, and can run concurrently with, `uk`'s own amber
lead-in below - a UK crossing can be in the middle of its 3s amber phase
while the gate is still separately sitting through its own 2s
`BARRIER_CLOSE_DELAY`, exactly as two independent real systems would.
Verified with a scripted run: lamps light within one frame of the command,
`lowered` stays exactly `0` until just past 2.0s, then reaches fully closed
by 3.6s (`BARRIER_CLOSE_DELAY` + `BARRIER_SECONDS`); commanding the gate
back open afterwards decreases `lowered` from the very first following
frame, confirming raising has no equivalent delay.

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

## "Next train" is not just the spawn timer

`Game.trainTimer` is seconds until the *next spawn*, not seconds until a
train actually reaches the crossing - a train that has already spawned and
is en route arrives sooner than that, and is the number a player actually
cares about once one is on its way. `Game.nextTrainETA()` (the HUD box in
`main.js`, formatted as `Ns` or `M:SS` once it is a minute or more out)
returns the smaller of the two: `trainTimer` as a fallback estimate when
nothing is live yet, or the soonest live train's own `distanceToZone(...) /
speed` once one has spawned - `0` outright if a train already occupies the
zone. Verified directly: with no live trains it reads exactly `trainTimer`;
a train placed 5s out overrides a 45s `trainTimer`; a train already in the
zone reads `0`; and a train that has already passed falls back to
`trainTimer` again rather than getting stuck, the same "already cleared, not
a threat" distinction `updateWarning()` relies on above.

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

## Zoom

Scroll, or `+`/`-`, dollies the fixed camera along its own existing view
line (`main.js`) - it moves closer to or further from the same fixed point,
`lookAtTarget = (0, 0, -4)` (matching every `camera.lookAt()` in
`scene.js`), rather than changing FOV, so the perspective itself never
distorts, only how close the viewpoint sits. `zoom` is a multiplier on
whatever distance the *current* camera was actually built at - captured
fresh into `homePosition` every time a new `Game` is constructed
(`captureZoomHome()`), because `scene.js` itself moves the camera back a
bit per extra track (`camera.position.set(0, 62 + extraTracks * 6, 78 +
extraTracks * 6)`), so "zoomed all the way out" has to mean something
different at 4 tracks than at 1, not a fixed absolute distance.

The chosen zoom level itself is **not** reset by a settings change or a
restart - `beginGame()` calls `captureZoomHome()` then immediately
`applyZoom()` again on the new camera, so picking a new surroundings preset
mid-session does not also throw away how far in the player had zoomed.
Verified directly: zoomed to the minimum (`ZOOM_MIN = 0.45`) at 4 tracks
(camera Z = 41), then switching to 1 track (a different built-in camera
distance) landed at exactly the value `-4 + 0.45 * (78 - -4)` predicts
(32.9) - the same relative zoom, correctly rescaled to the new baseline,
not the old absolute distance carried over verbatim.

## Customisation

Four independent settings, chosen on the start screen
(`{barrierType, lightStyle, trackCount, surroundings}`, `settings.js`) and
passed into `new Game(settings)`. **A settings change requires a whole new
`Game`** - `main.js`'s `beginGame()` always constructs one fresh, discarding
whatever `Game` existed before, rather than trying to mutate an existing
scene's track count or gate style in place. `Game.reset()` (used by "Try
Again") deliberately does *not* touch settings or rebuild the scene - it
only clears live state (trains, cars, score) for a same-settings replay,
which is why "Try Again" and "Change Settings" are two different buttons on
the game-over screen with two different effects.

**Barrier and light style are purely visual** - every combination plays
identically underneath. `Game`'s own `barrierTarget`/`lowered` state (what
the *player* commands) is what stops traffic in every case; `barrierType`
only controls what geometry represents that state, right down to
`barrierType: 'none'` still having a fully functional (if invisible) gate
the player commands via the same toggle. This was a deliberate scope
decision, not an oversight: making `'none'` remove the player's actual
ability to stop traffic would mean cars could never be stopped at all in
that mode, which is a much bigger design change (an entirely different
"drivers must decide for themselves" traffic model) than "customise how the
gate looks." If that distinction ever turns out to matter for real gameplay
balance, it belongs in `Game.advanceLane()`'s stop-line clamp, not in
`protection.js`.

**`protection.js`** builds one `{group, apply(lowered)}` per approach via
`buildProtectionUnit()`, regardless of which gate kind was picked - a boom
pivots about a horizontal (Z) axis (`default`/`half`, differing only in
`boomLength`), a `swing` gate pivots about a *vertical* (Y) axis instead
(open = parallel to the road, closed = swung across it), and a `trolley`
gate translates sideways along an overhead rail rather than rotating at all.
`Game.updateBarrier()` does not need to know which: it just calls
`unit.apply(this.lowered)` for each approach every frame.

**`double` is modelled on a real UK "MCB-OD" crossing, not just given a
second arm.** A real double-barrier crossing does not use one arm spanning
the whole road from a single edge - it stands a separate post on *each*
side, with a shorter lattice-mesh arm from each closing in toward the
middle until they overlap there. An earlier version got this wrong: it put
two solid arms one above the other on the *same* single post, with a skirt
panel hanging below - a "second boom for its own sake" that doesn't match
how any real double-barrier crossing is actually built. `buildLatticeArm()`
builds one post's worth (a striped top rail, a plain lower rail, and a row
of pickets between them forming the mesh infill, pivoting about Z exactly
like `buildBoomGate()`'s single arm); `buildDoubleBarrierGate()` calls it
twice - once reusing the *existing* light post's position
(`postX`/`reachDirection`, same signature every other gate builder takes),
once for a new post at the mirrored position on the opposite edge, with the
opposite reach direction. Verified against a reference photo of a real UK
double-barrier crossing: two posts, two arms closing from opposite edges
with a small overlap in the middle, not two arms on one post.

Light styles
(`buildLamps()`) differ in shape (round/square), arrangement (side-by-side/
stacked), and flash behaviour (alternating/in-phase) - **stylised,
simplified homages, not accurate reproductions of any real country's actual
signalling standard, except `uk` and `america` (deliberate exceptions, see
below) and `france` (two confirmed real details, see below)**.
`lightStyle: 'none'` suppresses `playWarningDing()` entirely, not
just the lamp mesh - it represents no warning *system*, audio included, not
merely invisible lamps that still ring a bell.

**`uk` is modelled on the real sequence, not just given a different look.**
Real UK level crossing road signals show a single steady amber lamp for a
few seconds *before* the usual pair of alternately flashing reds ever
lights - every other style here (and most other countries' crossings) skips
straight to flashing red the instant the lights come on. `buildLamps()`
adds a third lamp, tagged `phase: 'amber'` with its own `onColor`/`offColor`
(`buildRoundLamp()`'s `options` argument, added for exactly this), positioned
above the usual pair. `Game.updateBarrier()` tracks `ukAmberActive` and
`ukAmberTimer`: the instant the lights turn on from off
(`lightsOn && !this.wasLightsOn`) with `lightStyle === 'uk'`, it starts a
fresh `UK_AMBER_SECONDS` (3s) countdown, holding the reds dark and the amber
lit steady; once it elapses, `ukAmberActive` clears and the normal
`flashState`-driven alternation (shared with every other style) takes over.
`Game.setLamps()` has one extra branch for this: a lamp with `phase ===
'amber'` is lit purely by `ukAmberActive`, never by `flashState`, so it can
never accidentally join the reds' alternation. The UK post is also
deliberately left plain - a banded post was never a real UK feature (an
earlier version had one; removed, along with banding for every style, once
it became clear it wasn't accurate anywhere), the amber-then-red sequence is
what actually distinguishes it. Verified with a scripted run: amber lights
within one frame of the barrier starting to lower and stays lit steady for
exactly `UK_AMBER_SECONDS`, the reds stay dark the entire time, and only
then do they start alternating (confirmed genuinely alternating, never both
lit together) - and every other light style is unaffected (`ukAmberActive`
never becomes `true` unless `lightStyle` is `'uk'`).

**`america` is a real crossbuck signal, not a crossbuck with lamps floating
beside it at the same height.** A real US crossing's pair of alternately
flashing red lamps mount on the signal mast *below* the crossbuck board, not
spread out either side of it - an earlier version put them at the same
height as the crossbuck, which reads as decorative rather than as one
recognisable assembly. `buildLamps()`'s `'america'` branch now places them
at `y = 1.55`, half a metre below the crossbuck's own `y = 2.05`, close
together (`±0.3` apart, not `±0.35` spread either side of the post).

**`france` has two confirmed real details, not a full verified sequence
like `uk`/`america`**: the crossbuck ("croix de Saint-André") is red, not
white with black lettering like the US one (`buildCrossbuck()` gained a
`material` parameter for exactly this, defaulting to white so `america`/
`netherlands` are unchanged); and a real French crossing signal is a
*single* flashing light, not an alternating pair - every other lit style
here uses two. **This one shipped wrong the first time**: the initial
version gave `france` the same two-lamp side-by-side arrangement as
`america`, on the mistaken assumption every crossbuck-style country's
signal works the same way. Corrected to exactly one `buildRoundLamp()` call,
centred (`postX`, not `postX ± offset`), `phase: 0` - it flashes on/off on
the ordinary `flashState` rhythm rather than alternating with a partner
that no longer exists. Verified directly: the crossing now has exactly one
lamp per approach (two total, one per post, each independently flashing in
sync since both are phase 0), and it genuinely toggles between lit and dark
over time rather than always-on or one of a pair.

Also sized up: `buildRoundLamp()` gained a `radius` option (`0.16` default,
matching its previous hard-coded size everywhere else) so `france` could use
a bigger one (`0.26`) without touching any other style. Being the crossing's
*only* light rather than one of a pair made it read as undersized at the
default size - a single lamp needs to carry the whole signal on its own.

**Track count widens the danger corridor, not the train spawn rate.**
`TRACK_COUNTS` is 1-4; `Game`'s constructor lays `trackZs` out centred on
`Z = 0` (`TRACK_SPACING` apart) and computes `combinedHalfWidth` from them.
Trains still spawn on the same single, overall timer regardless of count -
each spawn just also picks one of the `trackZs` at random - so more tracks
makes the crossing itself more dangerous (a wider corridor takes a car
longer to clear, and the stop line sits further back) without also just
multiplying how often trains show up. `track.js` renders every track inside
one continuous ballast bed (a real multi-track railway is one corridor, not
several separate strips with gaps between them), with one rail pair per
track. Verified directly: `combinedHalfWidth` for 1/2/4 tracks is
1.3/2.75/5.65, and a car's own stop position matches
`combinedHalfWidth + STOP_LINE_MARGIN` exactly in every case (2.9/4.35/7.25).

**Surroundings** (`surroundings.js`) scatter decorative props (trees,
towers, cottages, a barn/silo/hay bales/fences for farm, etc.) via the same
deterministic-random-plus-rejection-sampling idea Oakford Line's own tree
placement uses. `scatter()`'s clearance check has to reject *two full-length
strips* - the road runs the entire Z length of the world at
`|x| <= clearHalfX`, and the track the entire X length at
`|z| <= clearHalfZ` - not just a box around the crossing itself, so a
candidate is only clear once it is outside **both** strips at once (`&&`).
**A real bug lived here**: an earlier version used `||`, which only rejects
the small box where the two strips overlap near the crossing, leaving a
building free to land anywhere else along the road (any `x` inside
`clearHalfX`, however far away in `z`) or along the track (any `z` inside
`clearHalfZ`, however far away in `x`) - exactly how buildings ended up
sitting on the road. Both `clearHalfX`/`clearHalfZ` are sized from the
*current* `combinedHalfWidth`, so a 4-track crossing with a dense `city`
preset never spawns a tower on top of the extra tracks just because it was
tuned against the 1-track case. `surroundings: 'default'` deliberately
returns nothing - the bare look the game always had before this setting
existed. Verified by checking every scattered prop's actual world position
across all five non-default presets: 0 violations out of 284 meshes against
a 3-track-wide corridor (the old `||` logic, re-run the same way for
comparison, put 16 out of 200 sample points on the road or track).

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
already inside `occupiesZone()`/`overlapsBand()` before the first `update()`
call, not to guess at relative timing.

For settings specifically: `new Game(settings)` (headless - `node -e` with
`global.window = { innerWidth, innerHeight }` stubbed, since `scene.js`
reads those for the camera's aspect ratio and there is otherwise no DOM
dependency) is enough to construct and run every barrier×light×track×
surroundings combination without a browser at all, which is how all 36
combinations got smoke-tested (construct, run 200 steps, toggle the
barrier, run 200 more, confirm nothing throws) before ever loading a page.
Live-browser checks after that were for the things a headless run can't
show: that each gate style actually reads as visually distinct, that the
settings `<select>`s populate and round-trip through "Change Settings"
correctly, and that a screenshot of e.g. the swing gate over a 3-track
crossing with farm scenery looks like what the code claims it builds.
