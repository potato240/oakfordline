# Oakford Line

A first-person passenger train game. The player walks around a railway
environment on foot and catches trains — arriving at stations, reading the
departure boards, finding the right platform, and boarding before the train
leaves.

The name is always written **Oakford** as one word. Never "Oak Ford".

## Current state

Early scaffold. What exists today:

- A ground plane and a gradient sky.
- First-person movement: WASD (or arrow keys) to walk, mouse to look, Shift to
  run. Pointer lock is entered by clicking "Click to play".
- A grey box standing in for a station platform.

Everything beyond that — trains, timetables, stations, boarding — is not built
yet.

## Stack

- **Vite** for dev server and bundling.
- **Three.js** for rendering. Addons are imported via the `three/addons/*`
  subpath (e.g. `PointerLockControls`), not from a relative `examples/jsm` path.
- Vanilla JavaScript, ES modules. No framework, no TypeScript.

## Layout

| Path             | Purpose                                                     |
| ---------------- | ----------------------------------------------------------- |
| `index.html`     | Vite entry point; canvas, start overlay, crosshair.          |
| `src/main.js`    | Renderer, camera, pointer-lock wiring, animation loop.       |
| `src/world.js`   | Scene construction — sky, ground, lights, platform.          |
| `src/player.js`  | First-person controller: input, acceleration, damping.       |
| `src/style.css`  | Overlay and canvas styling.                                  |
| `vite.config.js` | Dev server on `0.0.0.0:5173`, build to `dist/`.              |

## Commands

```bash
npm install
npm run dev
npm run build
```

## Conventions

- Keep world geometry in `src/world.js` behind small `create*()` factory
  functions that return a mesh or group, and add them in `buildWorld()`.
- Movement is framerate independent — velocity is integrated against `delta`
  and damped exponentially. Keep new movement code on the same footing rather
  than applying per-frame constants.
- The animation loop clamps `delta` to 0.1s so a backgrounded tab does not
  teleport the player on return.
- The player is currently pinned to eye height (1.7) with no collision or
  gravity. The platform box is not solid — you walk through it. Adding
  collision is a deliberate future step, not an oversight to patch ad hoc.

## Deployment

Deployed via Coolify, which runs `npm run build` and serves `dist/`.
