# Oakford Line

A first-person passenger train game — walk around a railway environment and
catch trains.

Built with [Vite](https://vite.dev) and [Three.js](https://threejs.org).

## Running locally

```bash
npm install
npm run dev
```

Then open the printed local URL and click **Click to play**.

## Controls

| Input       | Action     |
| ----------- | ---------- |
| `W A S D`   | Walk       |
| Mouse       | Look       |
| `Shift`     | Run        |
| `Esc`       | Release the cursor |

If the browser refuses pointer lock (some embedded/preview browsers do), the
game falls back automatically: hold the left mouse button and drag to look.

## Building

```bash
npm run build
```

Output goes to `dist/`.
