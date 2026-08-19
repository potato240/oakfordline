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
- Three pairs of sliding doors on the platform side of each car, metro
  style, parting and closing on a timer.
- An eight-stop line, each stop 280m apart over 1.96km: **Oakford**, **Bramley
  Halt**, **Wexley**, **Marsden Cross**, **Kingsford**, **Ashcombe**,
  **Thornleigh**, **Portmead**. The train calls at each in turn, reverses at
  the terminus and works back. A round trip is about eleven minutes.
- Landscape: instanced trees, horizon hills, telegraph poles along the line.
- First-person movement: WASD (or arrow keys) to walk, mouse to look, Shift to
  run. The player stands on the platform deck, or on the saloon floor.
- A visible first-person body in the style of PEAK: **just** two hands and two
  boots, no arms, legs or torso.
- A drag-to-look fallback for browsers that reject pointer lock (see below).

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
| `src/track.js`   | Ballast, sleepers, rails.                              |
| `src/station.js` | Platform, canopy, benches, lamps, signs, house.        |
| `src/train.js`   | Two-car unit: bodies, bogies, wheels, glazing.         |
|                  | Bodyside cross-section (tumblehome) lives in `BODY_PROFILE`. |
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
- `buildWorld()` returns `{ scene, heightAt, train, crossings, colliders }`.
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
