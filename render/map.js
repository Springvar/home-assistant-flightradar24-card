import { getLocation } from '../utils/location.js';
import { haversine } from '../utils/geometric.js';

/**
 * Ensures Leaflet CSS/JS are loaded into shadowRoot *if needed*.
 * Only loads if cardState wants a map background.
 */
export function ensureLeafletLoadedIfNeeded(cardState, shadowRoot, onReady) {
    if (cardState.radar && cardState.radar.background_map && cardState.radar.background_map !== 'none') {
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
    } else {
        onReady();
    }
}

/**
 * Sets up or updates the radar map background and Leaflet map.
 * Expects Leaflet to be loaded (window.L)
 */
export function setupRadarMapBg(cardState, radarScreen) {
    const { config, dimensions } = cardState;
    const TILE_LAYERS = {
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

    let opacity = typeof config.radar.background_map_opacity === 'number' ? Math.max(0, Math.min(1, config.radar.background_map_opacity)) : 1;

    let mapBg = radarScreen.querySelector('#radar-map-bg');
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
        mapBg.style.opacity = opacity;
        radarScreen.appendChild(mapBg);
    } else {
        mapBg.style.opacity = opacity;
    }

    // Make sure there are no transformation before applying "clean map"
    mapBg.style.transform = '';

    const location = getLocation(cardState);
    const radarRange = Math.max(dimensions.range, 1);
    const rangeKm = config.units === 'mi' ? radarRange * 1.60934 : radarRange;

    const lat = location.latitude || 0;
    const lon = location.longitude || 0;

    const rad = Math.PI / 180;
    const km_per_deg_lat = 111.13209 - 0.56605 * Math.cos(2 * lat * rad) + 0.0012 * Math.cos(4 * lat * rad);
    const km_per_deg_lon = 111.32 * Math.cos(lat * rad) - 0.094 * Math.cos(3 * lat * rad);
    const deltaLat = rangeKm / km_per_deg_lat;
    const deltaLon = rangeKm / km_per_deg_lon;
    const bounds = [
        [lat - deltaLat, lon - deltaLon],
        [lat + deltaLat, lon + deltaLon]
    ];
    let type = config.radar.background_map || 'bw';
    if (type === 'system') {
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        let haDark = false;
        try {
            haDark = window.parent && window.parent.document && window.parent.document.body.classList.contains('dark');
        } catch (e) {}
        if (haDark || prefersDark) {
            type = 'dark';
        } else {
            type = 'color';
        }
    }
    let [tileUrl, tileOpts] = TILE_LAYERS[type] || TILE_LAYERS.bw;
    if (tileOpts && 'api_key' in tileOpts && config.radar.background_map_api_key) {
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
                cardState._leafletMap.removeLayer(layer);
            });
        }
        window.L.tileLayer(tileUrl, tileOpts).addTo(cardState._leafletMap);

        cardState._leafletMap.fitBounds(bounds, { animate: false, padding: [0, 0] });

        const mapContainer = cardState._leafletMap.getContainer();
        const heightPx = mapContainer.offsetHeight;
        const widthPx = mapContainer.offsetWidth;

        const pixelLeft = window.L.point(0, heightPx / 2);
        const pixelRight = window.L.point(widthPx, heightPx / 2);

        const latLngLeft = cardState._leafletMap.containerPointToLatLng(pixelLeft);
        const latLngRight = cardState._leafletMap.containerPointToLatLng(pixelRight);

        let kmAcross = haversine(latLngLeft.lat, latLngLeft.lng, latLngRight.lat, latLngRight.lng, 'km');
        const desiredKmAcross = rangeKm * 2;

        const scaleCorrection = kmAcross / desiredKmAcross;
        mapBg.style.transform = `scale(${scaleCorrection})`;
    }
    return mapBg;
}
