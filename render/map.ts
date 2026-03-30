import { getLocation } from '../utils/location';
import { haversine } from '../utils/geometric';
import type { CardState, LeafletMap } from '../types/cardState';

declare global {
    interface Window {
        L: LeafletStatic;
    }
}

interface LeafletStatic {
    map(element: HTMLElement, options: LeafletMapOptions): LeafletMap;
    tileLayer(url: string, options: TileLayerOptions): TileLayer;
    point(x: number, y: number): LeafletPoint;
}

interface LeafletMapOptions {
    attributionControl: boolean;
    zoomControl: boolean;
    dragging: boolean;
    scrollWheelZoom: boolean;
    boxZoom: boolean;
    doubleClickZoom: boolean;
    keyboard: boolean;
    touchZoom: boolean;
    pointerEvents: boolean;
}

interface TileLayer {
    addTo(map: LeafletMap): TileLayer;
}

interface TileLayerOptions {
    api_key?: string;
    attribution?: string;
    subdomains?: string[];
}

interface LeafletPoint {
    x: number;
    y: number;
}

type LatLngBoundsLiteral = [[number, number], [number, number]];

type BackgroundMapType = 'none' | 'system' | 'bw' | 'color' | 'dark' | 'outlines';

const VALID_MAPS = new Set<string>(['bw', 'color', 'dark', 'outlines', 'system']);

export function shouldRenderRadarBackgroundMap(cardState: CardState): boolean {
    const radar = cardState?.radar;
    if (!radar || radar.hide === true) return false;
    if (!radar.background_map || !VALID_MAPS.has(radar.background_map)) return false;
    return true;
}

/**
 * Ensures Leaflet CSS/JS are loaded into shadowRoot if needed.
 * Only loads if cardState wants a map background and radar is shown.
 */
export function ensureLeafletLoadedIfNeeded(cardState: CardState, shadowRoot: ShadowRoot, onReady: () => void): void {
    if (!shouldRenderRadarBackgroundMap(cardState)) {
        return;
    }
    if (window.L) {
        onReady();
        return;
    }
    if (!shadowRoot.querySelector('#leaflet-css-loader')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css-loader';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet/dist/leaflet.css';
        shadowRoot.appendChild(link);
    }
    if (!shadowRoot.querySelector('#leaflet-js-loader')) {
        const script = document.createElement('script');
        script.id = 'leaflet-js-loader';
        script.src = 'https://unpkg.com/leaflet/dist/leaflet.js';
        script.async = true;
        script.defer = true;
        script.onload = onReady;
        script.onerror = () => script.remove();
        shadowRoot.appendChild(script);
    } else {
        const poll = setInterval(() => {
            if (window.L) {
                clearInterval(poll);
                onReady();
            }
        }, 50);
    }
}

interface TileConfig {
    api_key?: string;
    attribution?: string;
    subdomains?: string[];
}

type TileLayerConfig = [string, TileConfig];

/**
 * Sets up or updates the radar map background and Leaflet map.
 * Expects Leaflet to be loaded (window.L)
 */
export function setupRadarMapBg(cardState: CardState, radarScreen: HTMLElement): HTMLElement | undefined {
    const { config, dimensions } = cardState;

    if (!shouldRenderRadarBackgroundMap(cardState)) {
        // Remove Leaflet map if it exists
        if (cardState._leafletMap) {
            cardState._leafletMap.remove();
            cardState._leafletMap = null;
        }
        // Remove map background DOM node if it exists
        const oldMapBg = radarScreen.querySelector('#radar-map-bg');
        if (oldMapBg) {
            oldMapBg.remove();
        }
        return;
    }

    const type = config?.radar?.background_map as BackgroundMapType | undefined;

    const TILE_LAYERS: Record<string, TileLayerConfig | null> = {
        bw: [
            'https://tiles.stadiamaps.com/tiles/stamen_toner/{z}/{x}/{y}.png',
            {
                api_key: '?api_key=',
                attribution: 'Map tiles by Stamen Design, CC BY 3.0 — Map data © OpenStreetMap',
                subdomains: []
            }
        ],
        color: [
            'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
            {
                attribution: '&copy; OpenStreetMap contributors',
                subdomains: ['a', 'b', 'c']
            }
        ],
        dark: [
            'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
            {
                attribution: '&copy; CartoDB'
            }
        ],
        outlines: [
            'https://tiles.stadiamaps.com/tiles/stamen_toner_lines/{z}/{x}/{y}.png',
            {
                api_key: '?api_key=',
                attribution: 'Map tiles by Stamen Design, hosted by Stadia Maps; Data by OpenStreetMap',
                subdomains: []
            }
        ],
        system: null
    };

    const opacity = typeof config?.radar?.background_map_opacity === 'number' ? Math.max(0, Math.min(1, config.radar.background_map_opacity)) : 1;

    let mapBg = radarScreen.querySelector('#radar-map-bg') as HTMLDivElement | null;
    if (!mapBg) {
        mapBg = document.createElement('div');
        mapBg.id = 'radar-map-bg';
        mapBg.style.position = 'absolute';
        mapBg.style.top = '0';
        mapBg.style.left = '0';
        mapBg.style.width = '100%';
        mapBg.style.height = '100%';
        mapBg.style.zIndex = '0';
        mapBg.style.pointerEvents = 'none';
        mapBg.style.opacity = String(opacity);
        radarScreen.appendChild(mapBg);
    } else {
        mapBg.style.opacity = String(opacity);
    }

    mapBg.style.transform = '';

    if (cardState._leafletMap && cardState._leafletMap.getContainer() !== mapBg) {
        cardState._leafletMap.remove();
        cardState._leafletMap = null;
    }

    const location = getLocation(cardState);
    const radarRange = Math.max(dimensions?.range || 1, 1);
    const rangeKm = cardState.units?.distance === 'miles' ? radarRange * 1.60934 : radarRange;

    const lat = location?.latitude || 0;
    const lon = location?.longitude || 0;

    const rad = Math.PI / 180;
    const km_per_deg_lat = 111.13209 - 0.56605 * Math.cos(2 * lat * rad) + 0.0012 * Math.cos(4 * lat * rad);
    const km_per_deg_lon = 111.32 * Math.cos(lat * rad) - 0.094 * Math.cos(3 * lat * rad);
    const deltaLat = rangeKm / km_per_deg_lat;
    const deltaLon = rangeKm / km_per_deg_lon;
    const bounds: LatLngBoundsLiteral = [
        [lat - deltaLat, lon - deltaLon],
        [lat + deltaLat, lon + deltaLon]
    ];
    let resolvedType = type;
    if (type === 'system') {
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        let haDark = false;
        try {
            haDark = !!(window.parent && window.parent.document && window.parent.document.body.classList.contains('dark'));
        } catch (_e) {
            // Cross-origin access may fail, ignore
        }
        if (haDark || prefersDark) {
            resolvedType = 'dark';
        } else {
            resolvedType = 'color';
        }
    }
    const tileLayerConfig = TILE_LAYERS[resolvedType || 'bw'] || TILE_LAYERS.bw;
    if (!tileLayerConfig) return mapBg;

    let [tileUrl, tileOpts] = tileLayerConfig; // eslint-disable-line prefer-const
    if (tileOpts && 'api_key' in tileOpts && config?.radar?.background_map_api_key) {
        tileUrl = tileUrl + tileOpts.api_key + encodeURIComponent(config.radar.background_map_api_key);
    }

    if (window.L) {
        if (!cardState._leafletMap) {
            cardState._leafletMap = window.L.map(mapBg, {
                attributionControl: false,
                zoomControl: false,
                dragging: false,
                scrollWheelZoom: false,
                boxZoom: false,
                doubleClickZoom: false,
                keyboard: false,
                touchZoom: false,
                pointerEvents: false
            });
        } else {
            cardState._leafletMap.eachLayer((layer) => {
                cardState._leafletMap!.removeLayer(layer);
            });
        }
        window.L.tileLayer(tileUrl, tileOpts as TileLayerOptions).addTo(cardState._leafletMap);

        cardState._leafletMap.fitBounds(bounds, { animate: false, padding: [0, 0] });

        const mapContainer = cardState._leafletMap.getContainer();
        const heightPx = mapContainer.offsetHeight;
        const widthPx = mapContainer.offsetWidth;

        const pixelLeft = window.L.point(0, heightPx / 2);
        const pixelRight = window.L.point(widthPx, heightPx / 2);

        const latLngLeft = cardState._leafletMap.containerPointToLatLng(pixelLeft);
        const latLngRight = cardState._leafletMap.containerPointToLatLng(pixelRight);

        const kmAcross = haversine(latLngLeft.lat, latLngLeft.lng, latLngRight.lat, latLngRight.lng, 'km');
        const desiredKmAcross = rangeKm * 2;

        const scaleCorrection = kmAcross / desiredKmAcross;
        mapBg.style.transform = `scale(${scaleCorrection})`;
    }
    return mapBg;
}
