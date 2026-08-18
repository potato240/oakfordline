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
- A stationary two-car train at the platform — red and cream, with bogies,
  wheels, doors, glazing and a driving cab.
- Landscape: instanced trees, horizon hills, telegraph poles along the line.
- First-person movement: WASD (or arrow keys) to walk, mouse to look, Shift to
  run. The player stands on the platform deck via a simple height lookup.
- A drag-to-look fallback for browsers that reject pointer lock (see below).

Not built yet: the train does not move, there are no timetables and no
boarding, and there is no real collision — you can still walk through the
train and the canopy columns.

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
| `src/scenery.js` | Trees, hills, telegraph poles.                         |
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
- Repeated props (sleepers, trees) use `InstancedMesh`; the whole scene is
  about 140 draw calls and 21k triangles, so keep new props instanced.
- Movement is framerate independent — velocity integrates against `delta` and
  damps exponentially. Keep new movement code on the same footing rather than
  applying per-frame constants.
- The animation loop clamps `delta` to 0.1s so a backgrounded tab does not
  teleport the player on return.
- `buildWorld()` returns `{ scene, heightAt }`. `heightAt(x, z)` is the
  standing surface under the player — currently just platform-or-ground, with
  no gravity. Real collision is a deliberate future step, not an oversight to
  patch ad hoc.

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
