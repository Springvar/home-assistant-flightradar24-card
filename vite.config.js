import { defineConfig } from 'vite';

// This config is only used for the dev server (yarn dev)
// Production builds use Rollup directly (yarn build)
export default defineConfig({
    root: '.',
    server: {
        port: 5173,
        open: '/test/index.html',
        watch: {
            // Watch src files and trigger rebuild via rollup watch
            ignored: ['**/node_modules/**', '**/test/**']
        }
    },
    build: {
        // This config is not used - we use rollup.config.js for builds
        // This section is just here to prevent accidental vite builds
        outDir: 'dist-vite-unused'
    }
});
