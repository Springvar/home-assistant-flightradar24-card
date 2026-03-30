import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getLocation } from '../../../utils/location';
import { createMockHass } from '../../fixtures/hass';

describe('location', () => {
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    describe('getLocation', () => {
        it('returns default location when cardState is undefined', () => {
            const result = getLocation(undefined as any);
            expect(result).toEqual({ latitude: 0, longitude: 0 });
            expect(consoleErrorSpy).toHaveBeenCalledWith('Config not set in getLocation');
        });

        it('returns default location when config is undefined', () => {
            const result = getLocation({});
            expect(result).toEqual({ latitude: 0, longitude: 0 });
            expect(consoleErrorSpy).toHaveBeenCalledWith('Config not set in getLocation');
        });

        it('returns location from location_tracker entity', () => {
            const hass = createMockHass({
                trackerEntity: 'device_tracker.phone',
                trackerState: {
                    attributes: {
                        latitude: 51.5074,
                        longitude: -0.1278
                    }
                },
                location: { latitude: 51.5074, longitude: -0.1278 }
            });
            const cardState = {
                config: { location_tracker: 'device_tracker.phone' },
                hass
            };

            const result = getLocation(cardState);
            expect(result).toEqual({ latitude: 51.5074, longitude: -0.1278 });
        });

        it('returns configured location when location_tracker is not available', () => {
            const cardState = {
                config: {
                    location: { lat: 40.7128, lon: -74.006 }
                },
                hass: createMockHass()
            };

            const result = getLocation(cardState);
            expect(result).toEqual({ latitude: 40.7128, longitude: -74.006 });
        });

        it('returns hass config location as fallback', () => {
            const hass = createMockHass({
                location: { latitude: 48.8566, longitude: 2.3522 }
            });
            const cardState = {
                config: {},
                hass
            };

            const result = getLocation(cardState);
            expect(result).toEqual({ latitude: 48.8566, longitude: 2.3522 });
        });

        it('returns default when hass is not available', () => {
            const cardState = {
                config: {},
                hass: null
            };

            const result = getLocation(cardState);
            expect(result).toEqual({ latitude: 0, longitude: 0 });
        });

        it('prefers location_tracker over configured location', () => {
            const hass = createMockHass({
                trackerEntity: 'device_tracker.phone',
                trackerState: {
                    attributes: {
                        latitude: 51.5074,
                        longitude: -0.1278
                    }
                },
                location: { latitude: 51.5074, longitude: -0.1278 }
            });
            const cardState = {
                config: {
                    location_tracker: 'device_tracker.phone',
                    location: { lat: 40.7128, lon: -74.006 }
                },
                hass
            };

            const result = getLocation(cardState);
            expect(result).toEqual({ latitude: 51.5074, longitude: -0.1278 });
        });

        it('falls back to configured location when location_tracker entity not in states', () => {
            const cardState = {
                config: {
                    location_tracker: 'device_tracker.missing',
                    location: { lat: 40.7128, lon: -74.006 }
                },
                hass: createMockHass()
            };

            const result = getLocation(cardState);
            expect(result).toEqual({ latitude: 40.7128, longitude: -74.006 });
        });

        it('prefers configured location over hass config', () => {
            const hass = createMockHass({
                location: { latitude: 48.8566, longitude: 2.3522 }
            });
            const cardState = {
                config: {
                    location: { lat: 40.7128, lon: -74.006 }
                },
                hass
            };

            const result = getLocation(cardState);
            expect(result).toEqual({ latitude: 40.7128, longitude: -74.006 });
        });
    });
});
