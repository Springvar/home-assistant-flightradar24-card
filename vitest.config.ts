import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'jsdom',
        include: ['test/**/*.test.ts'],
        coverage: {
            provider: 'v8',
            include: [
                'utils/**/*.{js,ts}',
                'config/**/*.{js,ts}',
                'flightradar24-card-state.{js,ts}'
            ],
            exclude: ['render/**/*', 'node_modules/**', 'dist/**'],
            thresholds: {
                lines: 80,
                functions: 80,
                branches: 80,
                statements: 80
            }
        }
    }
});
