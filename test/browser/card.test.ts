import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('Flightradar24Card browser tests', () => {
    let consoleErrors: string[] = [];
    let originalConsoleError: typeof console.error;

    beforeEach(() => {
        consoleErrors = [];
        originalConsoleError = console.error;
        console.error = vi.fn((...args: unknown[]) => {
            consoleErrors.push(args.map(String).join(' '));
            originalConsoleError.apply(console, args);
        });
    });

    afterEach(() => {
        console.error = originalConsoleError;
        // Clean up any created elements
        const card = document.querySelector('flightradar24-card');
        if (card) {
            card.remove();
        }
    });

    it('should register custom element without errors', async () => {
        // Dynamically import the card module to register the custom element
        await import('../../flightradar24-card');

        expect(customElements.get('flightradar24-card')).toBeDefined();
        expect(consoleErrors).toHaveLength(0);
    });

    it('should create card element without throwing', async () => {
        await import('../../flightradar24-card');

        const card = document.createElement('flightradar24-card');
        document.body.appendChild(card);

        expect(card).toBeInstanceOf(HTMLElement);
        expect(card.shadowRoot).not.toBeNull();
    });

    it('should handle setConfig without errors', async () => {
        await import('../../flightradar24-card');

        const card = document.createElement('flightradar24-card') as HTMLElement & {
            setConfig: (config: Record<string, unknown>) => void;
        };
        document.body.appendChild(card);

        card.setConfig({
            entity: 'sensor.flightradar24_test',
            zone: 'zone.home'
        });

        // Filter out expected [FR24Card] errors that aren't critical
        const criticalErrors = consoleErrors.filter(
            (err) => !err.includes('[FR24Card]')
        );
        expect(criticalErrors).toHaveLength(0);
    });

    it('should render static content in shadow DOM', async () => {
        await import('../../flightradar24-card');

        const card = document.createElement('flightradar24-card') as HTMLElement & {
            setConfig: (config: Record<string, unknown>) => void;
        };
        document.body.appendChild(card);

        card.setConfig({
            entity: 'sensor.flightradar24_test',
            zone: 'zone.home'
        });

        // Check that shadow DOM has content
        expect(card.shadowRoot?.innerHTML).not.toBe('');
    });

    it('should not produce unhandled promise rejections', async () => {
        const rejections: PromiseRejectionEvent[] = [];
        const handler = (event: PromiseRejectionEvent) => {
            rejections.push(event);
        };

        window.addEventListener('unhandledrejection', handler);

        try {
            await import('../../flightradar24-card');

            const card = document.createElement('flightradar24-card') as HTMLElement & {
                setConfig: (config: Record<string, unknown>) => void;
            };
            document.body.appendChild(card);

            card.setConfig({
                entity: 'sensor.flightradar24_test',
                zone: 'zone.home'
            });

            // Wait a tick for any async operations
            await new Promise((resolve) => setTimeout(resolve, 100));

            expect(rejections).toHaveLength(0);
        } finally {
            window.removeEventListener('unhandledrejection', handler);
        }
    });
});
