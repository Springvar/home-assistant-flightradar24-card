import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Flightradar24CardState } from '../../../flightradar24-card-state';
import { createMockFlight } from '../../fixtures/flights';

describe('Flightradar24CardState', () => {
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    describe('constructor', () => {
        it('initializes with default values', () => {
            const state = new Flightradar24CardState();

            expect(state.hass).toBeNull();
            expect(state.config).toEqual({});
            expect(state.radar).toEqual({ range: 35 });
            expect(state.list).toEqual({});
            expect(state.templates).toEqual({});
            expect(state.defines).toEqual({});
            expect(state.units).toEqual({ altitude: 'ft', speed: 'kts', distance: 'km' });
            expect(state.flightsContext).toEqual({});
            expect(state.dimensions).toEqual({});
            expect(state.flights).toEqual([]);
            expect(state.selectedFlights).toEqual([]);
            expect(state.renderDynamicOnRangeChange).toBe(false);
            expect(state._leafletMap).toBeNull();
        });

        it('initializes sortFn as no-op function', () => {
            const state = new Flightradar24CardState();
            const flightA = createMockFlight({ id: 'a' });
            const flightB = createMockFlight({ id: 'b' });
            expect(state.sortFn(flightA, flightB)).toBe(0);
        });
    });

    describe('setConfig', () => {
        it('throws error when config is missing', () => {
            const state = new Flightradar24CardState();
            expect(() => state.setConfig(undefined as any)).toThrow('Configuration is missing.');
        });

        it('sets default flights_entity', () => {
            const state = new Flightradar24CardState();
            state.setConfig({});

            expect(state.config.flights_entity).toBe('sensor.flightradar24_current_in_area');
        });

        it('uses custom flights_entity from config', () => {
            const state = new Flightradar24CardState();
            state.setConfig({ flights_entity: 'sensor.custom_flights' });

            expect(state.config.flights_entity).toBe('sensor.custom_flights');
        });

        it('sets default projection_interval', () => {
            const state = new Flightradar24CardState();
            state.setConfig({});

            expect(state.config.projection_interval).toBe(5);
        });

        it('sets default no_flights_message', () => {
            const state = new Flightradar24CardState();
            state.setConfig({});

            expect(state.config.no_flights_message).toBe('No flights are currently visible. Please check back later.');
        });

        it('merges list config with defaults', () => {
            const state = new Flightradar24CardState();
            state.setConfig({ list: { hide: true } });

            expect(state.list).toEqual({ hide: true, showListStatus: true });
        });

        it('merges units config with defaults', () => {
            const state = new Flightradar24CardState();
            state.setConfig({ units: { altitude: 'm' } });

            expect(state.units).toEqual({ altitude: 'm', speed: 'kts', distance: 'km' });
        });

        it('sets radar range based on distance unit', () => {
            const state = new Flightradar24CardState();
            state.setConfig({ units: { distance: 'miles' } });

            expect(state.radar.range).toBe(25);
        });

        it('sets radar range to 35 for km', () => {
            const state = new Flightradar24CardState();
            state.setConfig({ units: { distance: 'km' } });

            expect(state.radar.range).toBe(35);
        });

        it('merges radar config', () => {
            const state = new Flightradar24CardState();
            state.setConfig({
                radar: {
                    range: 50,
                    background_map: 'dark'
                }
            });

            expect(state.radar.range).toBe(50);
            expect(state.radar.background_map).toBe('dark');
        });

        it('sets initialRange from range', () => {
            const state = new Flightradar24CardState();
            state.setConfig({ radar: { range: 50 } });

            expect(state.radar.initialRange).toBe(50);
        });

        it('merges defines config', () => {
            const state = new Flightradar24CardState();
            state.setConfig({ defines: { myVar: true } });

            expect(state.defines).toEqual({ myVar: true });
        });

        it('merges templates config', () => {
            const state = new Flightradar24CardState();
            state.setConfig({ templates: { custom: 'Custom template' } });

            expect(state.templates.custom).toBe('Custom template');
        });

        it('sets up sortFn from sort config', () => {
            const state = new Flightradar24CardState();
            state.setConfig({
                sort: [{ field: 'altitude', order: 'asc' }]
            });

            // Test that sortFn was set (not the default no-op)
            const a = createMockFlight({ id: 'a', altitude: 30000 });
            const b = createMockFlight({ id: 'b', altitude: 35000 });
            expect(state.sortFn(a, b)).toBeLessThan(0);
        });
    });

    describe('toggleSelectedFlight', () => {
        it('adds flight to selectedFlights', () => {
            const state = new Flightradar24CardState();
            const flight = createMockFlight({ id: 'flight1' });

            state.toggleSelectedFlight(flight);

            expect(state.selectedFlights).toContain('flight1');
        });

        it('removes flight from selectedFlights if already selected', () => {
            const state = new Flightradar24CardState();
            const flight = createMockFlight({ id: 'flight1' });
            state.selectedFlights = ['flight1'];

            state.toggleSelectedFlight(flight);

            expect(state.selectedFlights).not.toContain('flight1');
        });

        it('initializes selectedFlights if undefined', () => {
            const state = new Flightradar24CardState();
            (state as any).selectedFlights = undefined;
            const flight = createMockFlight({ id: 'flight1' });

            state.toggleSelectedFlight(flight);

            expect(state.selectedFlights).toContain('flight1');
        });

        it('calls renderDynamicFn when set', () => {
            const state = new Flightradar24CardState();
            const renderFn = vi.fn();
            state.setRenderDynamic(renderFn);
            const flight = createMockFlight({ id: 'flight1' });

            state.toggleSelectedFlight(flight);

            expect(renderFn).toHaveBeenCalled();
        });

        it('does not throw when renderDynamicFn is not set', () => {
            const state = new Flightradar24CardState();
            const flight = createMockFlight({ id: 'flight1' });

            expect(() => state.toggleSelectedFlight(flight)).not.toThrow();
        });
    });

    describe('setRenderDynamic', () => {
        it('sets renderDynamicFn', () => {
            const state = new Flightradar24CardState();
            const renderFn = vi.fn();

            state.setRenderDynamic(renderFn);

            expect(state.renderDynamicFn).toBe(renderFn);
        });
    });

    describe('setToggleValue', () => {
        it('sets define value to true for truthy values', () => {
            const state = new Flightradar24CardState();
            state.setConfig({ toggles: { showLabels: { label: 'Show Labels' } } });

            state.setToggleValue('showLabels', true);
            expect(state.defines.showLabels).toBe(true);

            state.setToggleValue('showLabels', 'true');
            expect(state.defines.showLabels).toBe(true);

            state.setToggleValue('showLabels', 1);
            expect(state.defines.showLabels).toBe(true);
        });

        it('sets define value to false for falsy values', () => {
            const state = new Flightradar24CardState();
            state.setConfig({ toggles: { showLabels: { label: 'Show Labels' } } });

            state.setToggleValue('showLabels', false);
            expect(state.defines.showLabels).toBe(false);

            state.setToggleValue('showLabels', 0);
            expect(state.defines.showLabels).toBe(false);
        });

        it('calls renderDynamicFn when set', () => {
            const state = new Flightradar24CardState();
            state.setConfig({ toggles: { showLabels: { label: 'Show Labels' } } });
            const renderFn = vi.fn();
            state.setRenderDynamic(renderFn);

            state.setToggleValue('showLabels', true);

            expect(renderFn).toHaveBeenCalled();
        });

        it('does nothing when config has no toggles', () => {
            const state = new Flightradar24CardState();
            state.setConfig({});

            expect(() => state.setToggleValue('showLabels', true)).not.toThrow();
        });
    });
});
