import { defineConfig } from 'vite';

export default defineConfig({
    root: '.',
    server: {
        port: 5173,
        open: '/test/index.html'
    },
    build: {
        lib: {
            entry: 'flightradar24-card.ts',
            formats: ['es'],
            fileName: 'home-assistant-flightradar24-card'
        },
        outDir: 'dist',
        codeSplitting: false,
        rollupOptions: {
            external: [],
            output: {
                entryFileNames: 'home-assistant-flightradar24-card.js'
            }
        },
        minify: 'esbuild'
    }
});
