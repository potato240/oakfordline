# Oakford Line

A first-person passenger train game. The player walks around a railway
environment on foot and catches trains — arriving at stations, reading the
departure boards, finding the right platform, and boarding before the train
leaves.

The name is always written **Oakford** as one word. Never "Oak Ford".

## Current state

Early scaffold. What exists today:

- Oakford station: platform deck with coping stones, tactile strip and yellow
  safety line, a canopy on columns, benches, lamps, name boards and a small
  brick station house.
- A running line beside it: trapezoidal ballast, instanced sleepers, and rails
  at standard gauge.
- A working two-car train in **KCR "Yellowhead" livery** — silver bodyside,
  white door pillars and cantrail band, a low red stripe, and a yellow cab face
  with black windscreen surround and red marker lamps. A red double-arrow decal
  sits on each bodyside near the cab, and a live destination board on each cab
  face shows the terminus it is working towards — with a full interior — floor,
  ceiling with a lit strip, lined walls, seating bays, grab poles — that you
  can walk into and ride. It is **double-ended**: a cab at each extremity, so
  it never turns; marker lights show white at the leading end, red at the
  trailing one, and swap over at each terminus.
- Seven level crossings on the line, with lowering booms, alternately flashing
  red lamps, and a bell synthesised at runtime.
- Three pairs of sliding doors on **both** sides of each car. Only the side
  matching the current station's platform actually opens - which side that
  is comes from `STATIONS[].platformSide`, not a fixed side, so a future
  station can have its platform on the other side and the correct doors
  will open there. An orange light above each door goes steady while it is
  open or opening, flashes red while it is closing (with a matching
  "beepbeepbeep"), and goes dark once shut.
- Sittable bench seats along the saloon. Walk up to one and press `E`.
- An eight-stop line, each stop 280m apart over 1.96km: **Oakford**, **Bramley
  Halt**, **Wexley**, **Marsden Cross**, **Kingsford**, **Ashcombe**,
  **Thornleigh**, **Portmead**. The train calls at each in turn, reverses at
  the terminus and works back. A round trip is about eleven minutes.
- A second, branch line, leaving the main line on its own new platform at
  **Marsden Cross** and its own new platform at **Kingsford**, then curving
  away out to two stops the main line never reaches: **Fenwick Bridge** and
  **Redgate**. Its own two-car railcar unit (green/cream livery, real
  see-through window openings, a gangway between the cars) shuttles the
  branch independently of the main train. See "The branch line" below.
- Landscape: instanced trees, horizon hills, telegraph poles along the line.
- First-person movement: WASD (or arrow keys) to walk, mouse to look, Shift to
  run. The player stands on the platform deck, or on the saloon floor.
- A visible first-person body in the style of PEAK: **just** two hands and two
  boots, no arms, legs or torso.
- A drag-to-look fallback for browsers that reject pointer lock (see below).
- A teleport menu (`T`, or the "Teleport" button, top right) listing every
  named stop on both lines. Picking one instantly relocates the player to
  that platform.

- Solid collision: the bodyshell, canopy columns, station house, benches,
  lamps, crossing posts and lowered booms all block you. Doorways are only
  passable while the doors are open, so you cannot board a train that has
  already shut its doors.

Not built yet: no timetable or schedule beyond the shuttle loop, and no reason
to catch a particular train. There is no gravity — you step up onto surfaces
rather than falling onto them.

## Stack

- **Vite** for dev server and bundling.
- **Three.js** for rendering. Addons come from the `three/addons/*` subpath
  (e.g. `PointerLockControls`), not a relative `examples/jsm` path.
- Vanilla JavaScript, ES modules. No framework, no TypeScript.

## Layout

| Path             | Purpose                                                |
| ---------------- | ------------------------------------------------------ |
| `index.html`     | Vite entry point; canvas, start overlay, crosshair.    |
| `src/main.js`    | Renderer, camera, pointer-lock wiring, animation loop. |
| `src/world.js`   | Scene assembly — sky, ground, lights, height lookup.   |
| `src/layout.js`  | Shared dimensions everything aligns to. Edit here.     |
| `src/track.js`   | Ballast, sleepers, rails; `createTrackAlongPath()` for the curved branch. |
| `src/station.js` | Platform, canopy, benches, lamps, signs, house.        |
| `src/train.js`   | Two-car unit: bodies, bogies, wheels, glazing.         |
|                  | Bodyside cross-section (tumblehome) lives in `BODY_PROFILE`. |
| `src/branchLayout.js` | Branch route: waypoints, stops, the `RailPath` curve-distance helper. |
| `src/branchTrain.js`  | Two-car branch railcar unit: geometry and its own running state machine. |
| `src/scenery.js` | Trees, hills, telegraph poles.                         |
| `src/crossing.js`| Level crossing: road, booms, lamps, bell trigger.      |
| `src/audio.js`   | Runtime-synthesised sound. No audio files.             |
| `src/collision.js`| Axis-aligned box colliders; circle-vs-box resolution.  |
| `src/body.js`    | Visible first-person body and its walk cycle.          |
| `src/player.js`  | First-person controller: input, acceleration, damping. |
| `src/style.css`  | Overlay and canvas styling.                            |
| `vite.config.js` | Dev server on `0.0.0.0:5173`, build to `dist/`.        |
| `Dockerfile`     | Two-stage production build. See Deployment.            |
| `nginx.conf`     | Static serving config used by the runtime image.       |


## Commands

```bash
npm install
npm run dev
npm run build
```

## Conventions

- World geometry lives in its own module per subject (`track`, `station`,
  `train`, `scenery`), each exporting one `create*()` that returns a group.
  `buildWorld()` only assembles them.
- Anything that has to line up between modules - rail height, platform edge,
  gauge - belongs in `src/layout.js`, not re-derived locally. The train's
  wheels sit on `RAIL_TOP_Y` by construction.
- `DOOR_CENTRES` drives far more than the doors: the bodyside panels, the
  glazing, the seating and the door colliders are all derived from it, so
  changing the door layout re-works the whole car. Watch for size assumptions
  when you do - going from two doors to five shrank the piers to 2.3m and
  silently killed the glazing, which tested for panels longer than 3m.
- Repeated props (sleepers, trees) use `InstancedMesh`; the whole scene is
  about 410 draw calls and 33k triangles, so keep new props instanced.
- Movement is framerate independent — velocity integrates against `delta` and
  damps exponentially. Keep new movement code on the same footing rather than
  applying per-frame constants.
- The animation loop clamps `delta` to 0.1s so a backgrounded tab does not
  teleport the player on return.
- `buildWorld()` returns `{ scene, heightAt, train, branchTrain, crossings, colliders, seats }`.
  `heightAt(x, z)` is the standing surface under the player; `colliders` is
  what stops them walking through things. The two are separate on purpose:
  height handles what you stand *on*, collision handles what you bump *into*.
- Colliders are axis-aligned boxes resolved against the player as a circle.
  A box may carry `offset()` (so the train's walls travel with it) and
  `active()` (so a doorway is only solid while its doors are shut). Add new
  solid objects by returning boxes from the module that builds the geometry,
  so positions cannot drift apart.

## The train

`Train` (in `src/train.js`) owns both the geometry and the running. Its
`update(delta)` drives a four-state loop and **returns how far the train moved
this frame**:

```
dwell (doors open, 14s) -> closing -> running -> opening -> dwell
```

`running` is a braking-distance model, not a scripted animation: it accelerates
towards `MAX_SPEED` until the remaining distance drops below `v^2 / 2a`, then
brakes. Change the stops in `STATIONS` and it just works out the run.

**Riding.** The animation loop in `main.js` tests `train.contains(x, z)`
*before* calling `update`, then adds the returned distance to the player's `z`.
Testing first matters — order it the other way and a passenger is left a frame
behind the floor they are standing on, which reads as sliding down the carriage.

`train.contains()` deliberately extends to `x < 1.6` (the platform edge) rather
than stopping at the inner wall, so stepping across the platform gap never
drops the player to ground level mid-stride.

Doors are two leaves per opening, positioned from `doorOpen` (0 shut, 1 open)
in `applyDoors()`. They are visual only — nothing blocks a player walking
through a shut door yet.

## The branch line

The main line is dead straight along Z, so it only ever needed a scalar
distance (`STATIONS[].z`, or `train.group.position.z`) to describe where
anything is. The branch actually curves, which the rest of the codebase has
no concept of - so it gets its own small path abstraction rather than
stretching the main line's assumptions to cover it.

**`src/branchLayout.js`** is the single source of truth for the route:

- `BRANCH_WAYPOINTS` — the route as a polyline. There is no spline library in
  this project; a "curve" is just several short straight segments meeting at
  slightly different headings, matching the low-poly style everything else
  here already uses (`createTrackAlongPath()` in `track.js` builds real track
  geometry the same way).
- The curve itself is a **reverse S** — a quarter-turn one way immediately
  followed by an equal quarter-turn back — not a single bend to a new
  heading. That is deliberate: an S-curve returns to exactly the heading it
  started at (due south, `dirX=0, dirZ=-1`), so the branch hands back onto a
  plain Z-aligned straight before it reaches Fenwick Bridge or Redgate.
  Z-aligned stations can reuse `station.js` completely unmodified (see
  below) - no rotated geometry, and no need to extend the collision system
  (`collision.js`) to handle rotated boxes for something that only ever sits
  still.
- `BRANCH_X = 70` (the parallel section's distance out from the main line) is
  not an aesthetic choice - it is the smallest value that clears every
  existing road crossing's `ROAD_HALF_LENGTH = 60` in `crossing.js`,
  regardless of which crossing the branch happens to run near in Z. Anything
  smaller would clip a crossing's road deck somewhere along the route.
- **`class RailPath`** turns the waypoint list into the same role
  `STATIONS[i].z` plays for the main line, generalised to a curve:
  `positionAt(distance)` returns `{x, z, heading}`, `distanceAt(waypoint)`
  finds a station's distance along the route, and `distanceToPoint(x, z)`
  gives the shortest distance from any point to the path — this last one is
  what makes "keep the corridor clear" possible on a curve at all, see below.
  `BRANCH_PATH` is the ready-made instance everything else imports.

**Trees and hills near the curve.** The main line's scenery clearance in
`scenery.js` is a single "how far from `x = 0`" formula, which only works
because the main line is straight. That cannot tell whether a point is clear
of a *curved* corridor, so `createTrees()` and `createHills()` additionally
reject any candidate with `BRANCH_PATH.distanceToPoint(x, z)` closer than the
branch's own clearance - rejection sampling (a handful of retries per prop,
falling back to hiding a tree far below ground rather than skipping its
`InstancedMesh` slot, since every slot needs *some* matrix or it renders as a
ghost prop at the world origin). This is the literal implementation of
"always remove trees and mountains in the way of track" for a route whose
"in the way" changes shape along its length, not just a straight-line offset.

**`src/branchTrain.js`** is a second, independent train — a two-car,
double-ended railcar unit in a distinct green/cream livery, deliberately
simpler than the main EMU (no tumblehome bodyside, no interior seating
hooked into the sit-down system). Each car's window band is a real opening —
a solid lower band, an open glazed middle band, a solid header band, nothing
opaque placed inside the middle band on either side of the car — the same
idea as the main EMU's "windows are real, not glass boxes on a solid sheet"
(see that section below), just without the mullions. The two cars connect
through an open gangway (`addGangwayEnd()`) rather than being cab-to-cab; a
cab face (`addCabFace()`) only sits at the two true outer ends of the unit.
It reuses the shape of `Train`'s state machine (`dwell -> closing -> running
-> opening`, a braking-distance run, reversal at each end) but generalised
from "a scalar Z" to "a scalar distance along `BRANCH_PATH`", and every frame
sets

```js
const { x, z, heading } = BRANCH_PATH.positionAt(this.distance);
this.group.position.set(x, 0, z);
this.group.rotation.y = heading;
```

`BranchTrain.contains(x, z)` cannot compare world X/Z directly the way the
main `Train` does, because the branch train's heading actually changes along
the curve - it rotates the query point into the train's own local frame
first (`atan2`/`cos`/`sin` inverse of `rotation.y`) before testing it against
the saloon's local bounds.

**Riding and collision on a train that turns.** `main.js` tests
`branchTrain.contains(x, z)` before calling `branchTrain.update(delta)`, same
ordering as the main train, but carries the rider by the **{dx, dz}** the
train actually moved this frame rather than a single Z delta, since the
branch train moves in both axes while on the curve. Its wall colliders extend
`collision.js` with a new `offsetX()` closure (alongside the existing
`offset()` for Z), so a branch-train collider can translate in X as the train
runs - but `offsetX()` still only **translates** a box, it cannot rotate one.
That is an accepted, deliberate simplification: collision is exact at every
station and on every straight section, and only approximate for the short
stretch of actual curve, where the train's visible body banks into the turn
but its collision boxes stay axis-aligned. Nothing else in the scene uses
`offsetX()`, so it is a no-op everywhere except the branch train.

**Branch stations reuse `station.js` unmodified.** `createStation({name, z})`
and `stationColliders(z)` are both built entirely around the module-level
`PLATFORM_CENTRE_X`, on the assumption the track sits at `x = 0` — they never
take an X position at all. Rather than teach `station.js` about a second
track, `world.js` wraps each of `BRANCH_STATIONS`' four stops by setting
`group.position.x = station.x` on the returned group, and shifting the
matching colliders' `minX`/`maxX` by that same `station.x`. This only works
because every branch station sits on the Z-aligned sections of the route (the
whole reason for the reverse-S curve above) — a station on the curve itself
would need rotated geometry this trick cannot provide.

## Window openings are real, not glass boxes on a solid sheet

The bodyside is built as three vertical bands (`extrudeBand()` in
`src/train.js`), not one solid extrusion:

```
upper band   (WINDOW_HEAD_Y -> cantrail)   solid, full pier length
window band  (WINDOW_SILL_Y -> WINDOW_HEAD_Y)  mullions + real gaps
lower band   (solebar -> WINDOW_SILL_Y)    solid, full pier length
```

The middle band is NOT one solid piece with glass placed against it. It is
solid mullions with true gaps between them, and the glass sits in the gap.
This matters: when the bodyside was first switched to a curved tumblehome
profile, it was built as a single watertight extrude with no opening for a
window at all - the glass panes were still being positioned as before, but
now they were hidden inside/behind solid silver, which is why the windows
appeared to vanish rather than merely change style. Verified by raycasting
from outside the car: a ray at a window's centre hits glass first with
interior geometry behind it; the same ray shifted to the mullion between two
windows hits solid silver.

If you change `WINDOW_SILL_Y` / `WINDOW_HEAD_Y` or the window count, the
mullion math derives from the same opening list used to place the glass, so
they cannot drift out of sync with each other - but they can still drift out
of sync with the *header* geometry above the doorways, which is untouched by
this and still assumes a flat wall thickness at a fixed x.

### The glass being "transparent" was not enough on its own

A real opening plus a transparent material still is not see-through if
something opaque sits directly behind the pane. Two separate things were
doing exactly that, independently of each other and of the opacity value:

1. **The interior lining.** `addLining()` used to be one flat opaque panel
   spanning the full pier height, including the entire window band. It now
   follows the same lower/upper band split as the bodyshell, plus one lining
   piece per mullion - never one across an actual opening.
2. **The window frame.** `surround` used to be a single solid box the same
   size as the opening, positioned slightly further into the car than the
   pane along the ray from outside - an opaque backing plate directly behind
   the glass. It is now four thin bars (`addFrameBar()`) forming an open ring
   around the edge, with nothing solid across the middle.

Bumping `materials.glass.opacity` down (it went from 0.42 to 0.16) looked
like the fix at first, but re-testing at the same spot gave an unchanged
pixel - because the ray was never reaching open air in the first place, no
matter how transparent the pane was. Confirmed the fix properly by
raycasting through a real pane's exact world position (queried live from the
scene, not computed by hand - hand-computed window centres kept landing on
mullions instead) and checking the full hit list: near pane -> far-side pane
-> sky, with nothing opaque between them.

## Doors on both sides, opened per-station

Both sides of the car have real, working door leaves - `addSideWall()` builds
and registers both, tagged with `side`. Only one side actually moves at any
given stop:

```js
// applyDoors() - Train
const platformSide = this.currentStation.platformSide;
const travel = leaf.side === platformSide ? this.doorOpen * maxTravel : 0;
```

The other side's leaves are driven to zero travel every frame regardless of
`doorOpen` - they are never "permanently shut" in code, they are just always
on the wrong side for wherever the train currently is. `Train.colliders()`
mirrors the exact same condition (`this.doorOpen < 0.55 || currentStation.platformSide !== side`)
so collision can never disagree with what the doors look like.

`STATIONS[].platformSide` (`layout.js`) is `1` or `-1` per stop. All current
stations are `1`. Setting one to `-1` correctly opens the other side's doors -
verified by flipping it at runtime and confirming boarding swaps sides - but
`station.js` still always builds the platform deck on +X, so an actual `-1`
station would open the right doors onto empty ballast until the platform
geometry is mirrored too. That mirroring is separate, not-yet-done work.

### Door status lights

One small emissive fixture per door, mounted on the underside of the header
inside the saloon, in `Train.doorLights` (built alongside the leaves in
`addSideWall()`, tagged with `side` the same way). `Train.updateDoorLights()`
drives them from `this.state`:

```
'opening' or 'dwell'  -> orange, steady   (door open or opening)
'closing'             -> red, flashing at DOOR_LIGHT_FLASH_INTERVAL
anything else         -> off              (door shut)
```

Gating is identical to `applyDoors()`/`colliders()`: a light only ever lights
up on the side matching `currentStation.platformSide`, so the side that never
opens at this stop stays dark regardless of `state`. Verified by flipping
`platformSide` at runtime - the same six fixtures that were lit went dark and
the other six lit up, matching which doors actually move.

The doors-closing beep (`playDoorBeep()` in `audio.js`) rides on the exact
same flash toggle: one beep on every rising edge of `doorLightFlashOn`, which
is what turns it into a repeated "beepbeepbeep" for the whole closing
sequence rather than one long tone. It only fires when `Train.update()` is
given a player position (`train.update(delta, playerPosition)`); `main.js`
passes `player.object.position` for exactly this reason. Distance falloff
uses the same shape as the crossing bell's, just with a much shorter
`DOOR_BEEP_AUDIBLE_RANGE` since it should read as coming from right there in
the carriage, not across the whole map.

## Sitting

`Train.seats` (built alongside the seating in `addInterior()`) stores each
spot as `{ car, x, eyeY, localZ }` - car-local data, because a car only ever
moves in Z and `car.position.z` already carries that offset once the Train
constructor sets it. `world.js` wraps each one in `{ x, eyeY, getWorldZ() }`,
where `getWorldZ()` reads `train.group.position.z + car.position.z + localZ`
live - so a seat's world position tracks the moving train with no extra
per-frame bookkeeping anywhere else.

`Player.sitAt(seat)` / `standUp()` toggle `this.seat`. While seated,
`update()` returns immediately after pinning position to
`(seat.x, seat.eyeY, seat.getWorldZ())`, skipping velocity and collision
entirely - mouse look still works normally since `PointerLockControls`
drives the camera's rotation independently of position. Pressing any
movement key while seated stands the player up first, then falls through to
normal movement the same frame, rather than requiring `E` twice.

`main.js` finds the nearest seat within `SEAT_REACH` each frame (skipped
entirely while already seated) and drives the `#interact` prompt and the
`KeyE` handler from it. Verified directly against `Player`: sitting pins
position exactly to the seat's expected `(x, eyeY, z)`; moving the train
afterwards changes the seated position to match `getWorldZ()`'s new value
with no drift; pressing `W` while seated stands the player up.

## Level crossings and sound

`Crossing` (in `src/crossing.js`) protects a point on the line. Each frame it
takes the train and the player position and decides whether to warn:

```
on the current leg && approaching && distance < 150m  ->  warn
distance < 34m                                        ->  stay down until clear
```

**"On the current leg" matters.** A crossing must lie between the train and the
station it is running to. Without that test, a train braking into a station
brings the crossing *beyond* that station inside the 150m warning range and
drops its booms - even though the train is about to stop short of it and sit
there for a fourteen second dwell. With stops 280m apart and crossings midway,
that fired on almost every arrival.

Booms take 3.2s to travel, which is why the warning starts 150m out — the
barriers are fully down long before the train arrives. Booms pivot about the
post: the geometry is translated so its origin sits at the pivot end, then the
whole pivot rotates 90 degrees.

**All audio is synthesised — there are no sound files in this repo.**
`src/audio.js` builds the bell from four *inharmonic* partials
(1 : 2.76 : 5.4 : 8.93) over a fast exponential decay. Those ratios are what
make it read as struck metal; a plain sine at the same pitch just sounds like
a beep.

Browsers refuse to start an `AudioContext` without a user gesture, so
`startAudio()` is called from the start button's click handler. Calling it from
anywhere else leaves the context `suspended` and the game silent. Bell volume
falls off with the player's distance from the crossing.

## The visible body

Hands and boots only, no connecting limbs. The two halves live in **different
spaces on purpose**:

- **Hands** are children of the camera, so they hold the same screen position
  however you turn your head - a held viewmodel. Verified: identical NDC at
  every pitch. Each is a **flat extruded outline**
  (`THREE.Shape` -> `ExtrudeGeometry`), not an assembly of primitives: fingers
  are shallow scallops along the top edge rather than protruding digits, and
  the material is mostly self-lit so the hand reads as a near-flat colour. The
  whole effect is the silhouette, so anything that adds 3D shading works
  against it.
- **Boots** are world space, following position and **yaw only**. Parent them
  to the camera and they swing into the sky when you look up.

Both `HAND_FORWARD` and `BOOT_FORWARD` are **negative**, because the camera
looks down -Z and the body shares its yaw. A positive `BOOT_FORWARD` puts the
boots behind the player, permanently out of shot - which is exactly what
happened first time.

Their distance in front matters as well as their sign: at 0.26 the boots sat 81
degrees below horizontal, past the bottom edge of the frame even when looking
straight down. At 0.6 they are about 70 degrees, so they appear when you look
down and stay out of the way when you look ahead.

The stride advances on **distance actually travelled**, not on time, so it stays
in step at any framerate and stops dead when you do. `main.js` measures that
distance *after* any ride on the train, so standing in a moving carriage does
not make you march on the spot.

## The sky dome

The dome is re-centred on the camera every frame, and its gradient runs off
**object space** (`normalize(position)` in the vertex shader) rather than world
position, so moving it does not skew the gradient.

This is not cosmetic. A fixed dome of radius R is up to R + (how far you have
walked) away from you, and once that exceeds the camera's far plane the sky is
**clipped to the clear colour** - which reads as an enormous black hole sitting
in the middle of the screen and tracking wherever you look. With stops spread
over 1.96km that happened as soon as you left the first station.

Keep `camera.far` comfortably above the dome radius as well, as a second line
of defence.

## Teleporting between stations

`T` (or clicking the "Teleport" button, always visible top-right once the
game has started) opens a station list built in `main.js` from both
`STATIONS` (`layout.js`) and `BRANCH_STATIONS` (`branchLayout.js`) - a main
line stop's platform sits at `PLATFORM_CENTRE_X`, a branch stop's at
`station.x + PLATFORM_CENTRE_X`, matching exactly how `world.js` positions
the real platform geometry for each. Picking one calls
`Player.teleportTo(x, z)`, which sets position directly (and its height
immediately, from the same `heightAt()` the normal per-frame update already
uses) rather than waiting a frame for gravity/collision to catch up.

**Why the menu unlocks the pointer lock itself, rather than just showing a
panel over the game.** Pointer lock hides the OS cursor and freezes its
reported position, so a genuinely locked player has no way to click a menu
button at all - `openTeleportMenu()` calls `player.controls.unlock()` first
to get a real, clickable cursor back, and `closeTeleportMenu()` calls
`player.lock()` to resume. That unlock is not the player pausing, though -
the existing `'unlock'` listener (which brings up the *start* overlay,
`main.js`) is guarded with a `teleportMenuOpen` flag so opening the teleport
menu never also pops the "Click to play" screen underneath it. Drag-look
never locks the pointer in the first place, so for that fallback the menu
just opens directly over the game with no lock/unlock cycle at all.

## Pointer lock

`controls.lock()` fails **asynchronously** — there is no exception to catch.
Some embedded browsers (including Claude Code's preview pane) reject it with
`WrongDocumentError`, which previously made the start button look dead. So
`main.js` listens for `pointerlockerror` and falls back to hold-left-drag
looking. Movement gates on `player.isActive` (locked **or** drag-look), never
on `isLocked` alone.

## Deployment

Deployed on Coolify via **Dockerfile build pack** at
`https://oakfordline.stevens-hall.com`.

The Dockerfile is two-stage: node runs `vite build`, then nginx serves *only*
`dist/`. Source, `node_modules`, and repo files never reach the runtime image.

Two things in there exist because of real failures — do not remove them
casually:

1. **`apk add curl` in the runtime stage.** Coolify's default health check runs
   `curl` inside the container. `nginx:alpine` does not ship curl, so without
   this the container is permanently unhealthy and the deploy never goes live
   while the previous version keeps serving.
2. **`listen [::]:80` in nginx.conf.** In Alpine, `localhost` resolves to `::1`
   first. An IPv4-only socket makes health checks fail with "can't connect to
   remote host" even though nginx is serving fine.

There is deliberately **no `HEALTHCHECK` instruction** in the Dockerfile —
Coolify runs its own, and a failing container-level check blocks the deploy.
`/health` returns a plain `200` as a dependency-free check target.

Symptom to recognise: if the live site renders as unstyled serif text with a
console error `Failed to resolve module specifier "three"`, the server is
handing out raw source instead of the build — i.e. it is serving the repo root,
not `dist/`.
