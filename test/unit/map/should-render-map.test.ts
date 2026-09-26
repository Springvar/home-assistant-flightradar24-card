import { describe, it, expect, vi } from 'vitest';
import { shouldRenderRadarBackgroundMap, ensureLeafletLoadedIfNeeded } from '../../../render/map';
import { createMockCardState } from '../../fixtures/cardState';

const render = (overrides: { config?: Record<string, any>; radar?: Record<string, any> } = {}): boolean =>
    shouldRenderRadarBackgroundMap(createMockCardState(overrides as any) as never);

const fakeShadowRoot = { querySelector: () => null, appendChild: (el: unknown) => el } as unknown as ShadowRoot;

describe('shouldRenderRadarBackgroundMap (tile background gate)', () => {
    it('renders no tiles in radar view when no background map is configured', () => {
        expect(render({ radar: { view: 'radar' } })).toBe(false);
    });

    it('renders no tiles in radar view when none is explicitly chosen', () => {
        expect(render({ config: { radar: { background_map: 'none' } }, radar: { view: 'radar' } })).toBe(false);
    });

    it('renders tiles in radar view when a valid map is configured', () => {
        expect(render({ config: { radar: { background_map: 'color' } }, radar: { view: 'radar', background_map: 'color' } })).toBe(true);
    });

    it('renders tiles in radar view when system is configured', () => {
        expect(render({ config: { radar: { background_map: 'system' } }, radar: { view: 'radar', background_map: 'system' } })).toBe(true);
    });

    it('renders tiles in map view when nothing is configured (system fallback)', () => {
        expect(render({ radar: { view: 'map' } })).toBe(true);
    });

    it('renders no tiles in map view when none is explicitly chosen', () => {
        expect(render({ config: { radar: { background_map: 'none' } }, radar: { view: 'map', background_map: 'none' } })).toBe(false);
    });

    it('renders tiles in map view when a valid map is configured', () => {
        expect(render({ config: { radar: { background_map: 'satellite' } }, radar: { view: 'map', background_map: 'satellite' } })).toBe(true);
    });

    it('renders tiles in map view when system is configured', () => {
        expect(render({ config: { radar: { background_map: 'system' } }, radar: { view: 'map', background_map: 'system' } })).toBe(true);
    });

    it('renders no tiles when the radar is hidden', () => {
        expect(render({ config: { radar: { background_map: 'color' } }, radar: { view: 'radar', hide: true, background_map: 'color' } })).toBe(false);
    });
});

describe('ensureLeafletLoadedIfNeeded', () => {
    it('renders the map screen immediately when none is selected in map view (map area with overlays still shows)', () => {
        const cardState = createMockCardState({
            config: { radar: { background_map: 'none' } },
            radar: { view: 'map', background_map: 'none' }
        });
        const onReady = vi.fn();
        ensureLeafletLoadedIfNeeded(cardState as never, fakeShadowRoot, onReady);
        expect(onReady).toHaveBeenCalledTimes(1);
    });

    it('does not render the map screen when the radar is hidden', () => {
        const cardState = createMockCardState({
            config: { radar: { background_map: 'none' } },
            radar: { view: 'map', hide: true, background_map: 'none' }
        });
        const onReady = vi.fn();
        ensureLeafletLoadedIfNeeded(cardState as never, fakeShadowRoot, onReady);
        expect(onReady).not.toHaveBeenCalled();
    });
});