import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';

export default defineConfig({
    test: {
        include: ['test/browser/**/*.test.ts'],
        browser: {
            enabled: true,
            provider: playwright({ launch: { headless: true } }),
            instances: [{ browser: 'chromium' }]
        }
    }
});
