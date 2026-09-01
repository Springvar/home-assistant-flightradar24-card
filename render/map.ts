import { getLocation } from '../utils/location';
import { haversine } from '../utils/geometric';
import {
    getTileProvider,
    buildTileUrl,
    requiresApiKey,
    VALID_MAPS
} from './tileProviders';
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

interface LeafletPoint {
    x: number;
    y: number;
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
    zoomSnap?: number;
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

type LatLngBoundsLiteral = [[number, number], [number, number]];

export function shouldRenderRadarBackgroundMap(cardState: CardState): boolean {
    const radar = cardState?.radar;
    if (!radar || radar.hide === true) return false;
    // Square map view always renders a map background
    if (radar.view === 'map') return true;
    if (!radar.background_map || radar.background_map === 'none') return false;
    return VALID_MAPS.has(radar.background_map) || radar.background_map === 'system';
}

/** Best-effort dark theme detection (Home Assistant parent theme, else OS preference). */
function isDarkTheme(): boolean {
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    let haDark = false;
    try {
        haDark = !!(window.parent && window.parent.document && window.parent.document.body.classList.contains('dark'));
    } catch (_e) {
        // Cross-origin access may fail, ignore
    }
    return haDark || prefersDark;
}

/**
 * Ensures Leaflet CSS/JS are loaded into shadowRoot if needed.
 * Only loads if cardState wants a map background and radar is shown.
 */
export function ensureLeafletLoadedIfNeeded(cardState: CardState, shadowRoot: ShadowRoot, onReady: () => void): void {
    if (!shouldRenderRadarBackgroundMap(cardState)) {
        return;
    }
    // Always ensure Leaflet CSS is present. renderStatic clears shadow DOM,
    // so the <link> must be re-created after every setConfig call.
    if (!shadowRoot.querySelector('#leaflet-css-loader')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css-loader';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet/dist/leaflet.css';
        shadowRoot.appendChild(link);
    }
    if (window.L) {
        onReady();
        return;
    }
    if (!shadowRoot.querySelector('#leaflet-js-loader')) {
        const script = document.createElement('script');
        script.id = 'leaflet-js-loader';
        script.src = 'https://unpkg.com/leaflet/dist/leaflet.js';
        script.async = true;
        script.onload = onReady;
        script.onerror = () => {
            script.remove();
            console.error('[FR24] Leaflet script load failed');
        };
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
        if (cardState._leafletMap) {
            cardState._leafletMap.remove();
            cardState._leafletMap = null;
        }
        const oldMapBg = radarScreen.querySelector('#radar-map-bg');
        if (oldMapBg) {
            oldMapBg.remove();
        }
        return;
    }

    const configuredType = config?.radar?.background_map as string | undefined;
    // In map view, always show a map. Fall back to the auto dark/light "system"
    // tiles when the user has not chosen an explicit background map.
    let mode = configuredType;
    if (cardState.radar?.view === 'map' && (!configuredType || configuredType === 'none' || !VALID_MAPS.has(configuredType))) {
        mode = 'system';
    }

    const mapView = cardState.radar?.view === 'map';
    const opacity = mapView
        ? 1
        : (typeof config?.radar?.background_map_opacity === 'number' ? Math.max(0, Math.min(1, config.radar.background_map_opacity)) : 1);

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

    // Clear any previous CSS transform on the map container
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
    // Resolve the effective map type and its API key.
    // - 'system' (auto dark/light) picks from the user's two configured maps,
    //   one for light theme and one for dark theme, each with its own key.
    // - an explicit provider id uses background_map + background_map_api_key
    //   (kept for backwards compatibility).
    let finalType: string;
    let effectiveApiKey: string | undefined;
    if (mode === 'system') {
        if (isDarkTheme()) {
            finalType = config?.radar?.background_map_dark || 'dark';
            effectiveApiKey = config?.radar?.background_map_dark_api_key || '';
        } else {
            finalType = config?.radar?.background_map_light || 'color';
            effectiveApiKey = config?.radar?.background_map_light_api_key || '';
        }
    } else {
        finalType = configuredType && VALID_MAPS.has(configuredType) ? configuredType : 'color';
        effectiveApiKey = config?.radar?.background_map_api_key || '';
    }

    const provider = getTileProvider(finalType);
    if (!provider) return mapBg;
    const tileUrl = buildTileUrl(finalType, effectiveApiKey);
    if (!tileUrl) return mapBg;
    const tileOpts = { attribution: provider.attribution, subdomains: provider.subdomains };

    // If this provider requires an API key and none is configured, show a notice.
    if (requiresApiKey(finalType)) {
        const hasApiKey = effectiveApiKey && effectiveApiKey.trim().length > 0;
        if (!hasApiKey) {
            if (cardState._leafletMap) {
                cardState._leafletMap.remove();
                cardState._leafletMap = null;
            }
            mapBg.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--secondary-text-color); text-align: center; padding: 20px; font-size: 0.9em;">API key required for this map type. Configure in Background Map settings.</div>';
            return mapBg;
        }
    }

    if (!cardState._leafletMap) {
        mapBg.innerHTML = '';
    }

    if (window.L) {
        const newMapConfig = { type: finalType, apiKey: effectiveApiKey };
        const mapConfigChanged = !cardState._currentMapConfig ||
            cardState._currentMapConfig.type !== newMapConfig.type ||
            cardState._currentMapConfig.apiKey !== newMapConfig.apiKey;

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
            window.L.tileLayer(tileUrl, tileOpts as TileLayerOptions).addTo(cardState._leafletMap);
            cardState._currentMapConfig = newMapConfig;
        } else if (mapConfigChanged) {
            cardState._leafletMap.eachLayer((layer) => {
                cardState._leafletMap!.removeLayer(layer);
            });
            window.L.tileLayer(tileUrl, tileOpts as TileLayerOptions).addTo(cardState._leafletMap);
            cardState._currentMapConfig = newMapConfig;
        }

        fitMapBoundsWithRetry(cardState._leafletMap, mapBg, bounds, rangeKm);

        // Store map center (rounded to 2 decimals) and zoom for template variable resolution
        cardState.mapCenter = { lat: Math.round(lat * 100) / 100, lon: Math.round(lon * 100) / 100 };
        cardState.mapZoom = Math.round(cardState._leafletMap.getZoom());
    }
    return mapBg;
}

/**
 * Fit bounds on the map, forcing reflow first and retrying if container has 0 dimensions.
 */
function fitMapBoundsWithRetry(map: LeafletMap, mapBg: HTMLElement, bounds: LatLngBoundsLiteral, rangeKm: number, retriesLeft = 15): void {
    // Force reflow so offsetWidth/offsetHeight are up to date
    void mapBg.offsetHeight;

    const container = map.getContainer();
    const widthPx = container.offsetWidth;
    const heightPx = container.offsetHeight;

    if (widthPx > 0 && heightPx > 0) {
        map.fitBounds(bounds, { animate: false, padding: [0, 0] });

        // CSS scale correction for integer zoom snapping
        const pixelLeft = window.L.point(0, heightPx / 2);
        const pixelRight = window.L.point(widthPx, heightPx / 2);
        const latLngLeft = map.containerPointToLatLng(pixelLeft);
        const latLngRight = map.containerPointToLatLng(pixelRight);
        const kmAcross = haversine(latLngLeft.lat, latLngLeft.lng, latLngRight.lat, latLngRight.lng, 'km');
        const desiredKmAcross = rangeKm * 2;
        const scaleCorrection = kmAcross / desiredKmAcross;
        mapBg.style.transform = `scale(${scaleCorrection})`;
    } else if (retriesLeft > 0) {
        setTimeout(() => {
            fitMapBoundsWithRetry(map, mapBg, bounds, rangeKm, retriesLeft - 1);
        }, 50);
    }
}

/**
 * Re-fit the Leaflet map to the current radar bounds.
 * Used when the container resizes (ResizeObserver path) to ensure
 * the map zoom / tile rendering stays correct.
 */
export function refitMapBounds(cardState: CardState): void {
    const map = cardState._leafletMap;
    if (!map) return;

    const location = getLocation(cardState);
    const radarRange = Math.max(cardState.dimensions?.range || 1, 1);
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

    const mapContainer = map.getContainer();
    void mapContainer.offsetHeight; // force reflow
    const widthPx = mapContainer.offsetWidth;
    const heightPx = mapContainer.offsetHeight;

    if (widthPx > 0 && heightPx > 0) {
        map.fitBounds(bounds, { animate: false, padding: [0, 0] });

        // CSS scale correction for integer zoom snapping
        const pixelLeft = window.L.point(0, heightPx / 2);
        const pixelRight = window.L.point(widthPx, heightPx / 2);
        const latLngLeft = map.containerPointToLatLng(pixelLeft);
        const latLngRight = map.containerPointToLatLng(pixelRight);
        const kmAcross = haversine(latLngLeft.lat, latLngLeft.lng, latLngRight.lat, latLngRight.lng, 'km');
        const desiredKmAcross = rangeKm * 2;
        const scaleCorrection = kmAcross / desiredKmAcross;
        mapContainer.style.transform = `scale(${scaleCorrection})`;
    }
}
