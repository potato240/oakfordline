import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// Resolves a path relative to this config file - the ESM equivalent of
// path.resolve(__dirname, ...), which isn't available directly since this
// file runs as a module ("type": "module" in package.json).
const here = (path) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  build: {
    outDir: 'dist',
    // A second, unrelated page lives at levelcrossingcontroller/ - see its
    // own section in CLAUDE.md. Vite's dev server finds any HTML file under
    // the project root automatically, but a production build only bundles
    // entries listed here, so this second one has to be named explicitly or
    // `npm run build` would silently drop it.
    rollupOptions: {
      input: {
        main: here('./index.html'),
        levelcrossingcontroller: here('./levelcrossingcontroller/index.html'),
      },
    },
  },
});
