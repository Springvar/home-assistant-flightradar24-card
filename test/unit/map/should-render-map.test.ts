import { describe, it, expect } from 'vitest';
import { shouldRenderRadarBackgroundMap } from '../../../render/map';
import { createMockCardState } from '../../fixtures/cardState';

const render = (overrides: { config?: Record<string, any>; radar?: Record<string, any> } = {}): boolean =>
    shouldRenderRadarBackgroundMap(createMockCardState(overrides as any) as never);

describe('shouldRenderRadarBackgroundMap', () => {
    it('hides the map in radar view when no background map is configured', () => {
        expect(render({ radar: { view: 'radar' } })).toBe(false);
    });

    it('hides the map in radar view when none is explicitly chosen', () => {
        expect(render({ config: { radar: { background_map: 'none' } }, radar: { view: 'radar' } })).toBe(false);
    });

    it('shows the map in radar view when a valid map is configured', () => {
        expect(render({ config: { radar: { background_map: 'color' } }, radar: { view: 'radar', background_map: 'color' } })).toBe(true);
    });

    it('shows the map in radar view when system is configured', () => {
        expect(render({ config: { radar: { background_map: 'system' } }, radar: { view: 'radar', background_map: 'system' } })).toBe(true);
    });

    it('shows the map in map view when nothing is configured (system fallback)', () => {
        expect(render({ radar: { view: 'map' } })).toBe(true);
    });

    it('hides the map in map view when none is explicitly chosen', () => {
        expect(render({ config: { radar: { background_map: 'none' } }, radar: { view: 'map', background_map: 'none' } })).toBe(false);
    });

    it('shows the map in map view when a valid map is configured', () => {
        expect(render({ config: { radar: { background_map: 'satellite' } }, radar: { view: 'map', background_map: 'satellite' } })).toBe(true);
    });

    it('shows the map in map view when system is configured', () => {
        expect(render({ config: { radar: { background_map: 'system' } }, radar: { view: 'map', background_map: 'system' } })).toBe(true);
    });

    it('hides the map when the radar is hidden', () => {
        expect(render({ config: { radar: { background_map: 'color' } }, radar: { view: 'radar', hide: true, background_map: 'color' } })).toBe(false);
    });
});