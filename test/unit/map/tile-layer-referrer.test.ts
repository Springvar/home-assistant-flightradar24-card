import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupRadarMapBg } from '../../../render/map';
import { createMockCardState } from '../../fixtures/cardState';

// Home Assistant serves the frontend with <meta name="referrer" content="same-origin">,
// which strips the Referer header from cross-origin requests. OSM's tile servers reject
// tile requests without a Referer with "403 Access Blocked (Referer required)", so the
// tile layer must opt back in via Leaflet's referrerPolicy option.
const EXPECTED_POLICY = 'strict-origin-when-cross-origin';

let tileLayerMock: ReturnType<typeof vi.fn>;
let originalL: unknown;

function installFakeLeaflet(container: HTMLElement) {
    const fakeMap = {
        getContainer: () => container,
        getZoom: () => 11,
        fitBounds: vi.fn(),
        containerPointToLatLng: vi.fn(() => ({ lat: 0, lng: 0 })),
        eachLayer: vi.fn(),
        removeLayer: vi.fn(),
        remove: vi.fn()
    };
    (window as any).L = {
        map: vi.fn(() => fakeMap),
        tileLayer: tileLayerMock,
        point: vi.fn((x: number, y: number) => ({ x, y }))
    };
    return fakeMap;
}

function run(overrides: Record<string, any>) {
    const cardState = createMockCardState(overrides as any);
    const radarScreen = document.createElement('div');
    // jsdom reports 0 for offsetWidth/Height, so skip the bounds-refit path.
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, value: 400 });
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 400 });
    installFakeLeaflet(radarScreen);
    setupRadarMapBg(cardState as never, radarScreen);
    return radarScreen;
}

beforeEach(() => {
    tileLayerMock = vi.fn((_url: string, _opts: unknown) => ({ addTo: () => ({}) }));
});

afterEach(() => {
    originalL = (window as any).L;
    delete (window as any).L;
    vi.restoreAllMocks();
});

describe('tile layer referrerPolicy', () => {
    it('sets a referrerPolicy that survives cross-origin so OSM tiles are not blocked', () => {
        run({ config: { radar: { background_map: 'color' } }, radar: { view: 'radar', background_map: 'color' } });

        expect(tileLayerMock).toHaveBeenCalledTimes(1);
        expect(tileLayerMock.mock.calls[0][1]).toMatchObject({ referrerPolicy: EXPECTED_POLICY });
    });

    it('sets a referrerPolicy for every provider, not just OSM', () => {
        for (const type of ['color', 'satellite', 'topo', 'light', 'dark', 'voyager']) {
            tileLayerMock.mockClear();
            run({ config: { radar: { background_map: type, background_map_api_key: 'k' } }, radar: { view: 'radar', background_map: type } });
            expect(tileLayerMock.mock.calls[0][1]).toMatchObject({ referrerPolicy: EXPECTED_POLICY });
        }
    });

    it('keeps attribution and subdomains alongside the referrerPolicy', () => {
        run({ config: { radar: { background_map: 'color' } }, radar: { view: 'radar', background_map: 'color' } });

        const opts = tileLayerMock.mock.calls[0][1];
        expect(opts).toMatchObject({
            attribution: '&copy; OpenStreetMap contributors',
            subdomains: ['a', 'b', 'c']
        });
    });
});
