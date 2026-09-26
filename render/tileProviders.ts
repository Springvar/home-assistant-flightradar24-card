/**
 * Tile provider store.
 *
 * Central place describing every background-map provider the card can render.
 * Each entry carries the URL template, whether/how an API key is appended,
 * provider-specific help text (including the key request link), and the values
 * used by both the renderer and the editor. Keeping this data here means the
 * renderer and the editor never have to hard-code provider quirks.
 */

export type TileProviderGroup = 'keyless' | 'keyed';

export interface TileProvider {
    /** Config value, e.g. `radar.background_map: 'light'`. */
    id: string;
    /** Human-readable label shown in the card editor. */
    label: string;
    /** Whether this provider needs no key (keyless) or does (keyed). */
    group: TileProviderGroup;
    /** Leaflet tile URL template. */
    url: string;
    /**
     * Query parameter used to append the API key, e.g. '?key=' (CARTO) or
     * '?api_key=' (Stadia). Present means the provider requires a key.
     */
    apiKeyParam?: string;
    /** Optional HTML help text shown in the editor when this provider is selected. */
    apiKeyHelp?: string;
    /** Map attribution. */
    attribution: string;
    /** Tile server subdomains. */
    subdomains: string[];
}

export const TILE_PROVIDERS: TileProvider[] = [
    // --- Keyless ---
    {
        id: 'color',
        label: 'Color (OpenStreetMap)',
        group: 'keyless',
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '&copy; OpenStreetMap contributors',
        subdomains: ['a', 'b', 'c']
    },
    {
        id: 'satellite',
        label: 'Satellite',
        group: 'keyless',
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attribution: '&copy; Esri, Maxar, Earthstar Geographics',
        subdomains: []
    },
    {
        id: 'topo',
        label: 'Topographic',
        group: 'keyless',
        url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
        attribution: '&copy; OpenTopoMap, &copy; OpenStreetMap contributors',
        subdomains: ['a', 'b', 'c']
    },
    // --- Keyed: CARTO (appended as ?key=) ---
    {
        id: 'light',
        label: 'Light (CARTO)',
        group: 'keyed',
        url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
        apiKeyParam: '?key=',
        apiKeyHelp: 'Required for Light, Dark and Voyager. <a href="https://carto.com/basemaps/apikey" target="_blank" rel="noopener noreferrer">Request a free CARTO key</a>.',
        attribution: '&copy; CartoDB, &copy; OpenStreetMap contributors',
        subdomains: ['a', 'b', 'c', 'd']
    },
    {
        id: 'dark',
        label: 'Dark (CARTO)',
        group: 'keyed',
        url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        apiKeyParam: '?key=',
        apiKeyHelp: 'Required for Light, Dark and Voyager. <a href="https://carto.com/basemaps/apikey" target="_blank" rel="noopener noreferrer">Request a free CARTO key</a>.',
        attribution: '&copy; CartoDB, &copy; OpenStreetMap contributors',
        subdomains: ['a', 'b', 'c', 'd']
    },
    {
        id: 'voyager',
        label: 'Voyager (CARTO)',
        group: 'keyed',
        url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
        apiKeyParam: '?key=',
        apiKeyHelp: 'Required for Light, Dark and Voyager. <a href="https://carto.com/basemaps/apikey" target="_blank" rel="noopener noreferrer">Request a free CARTO key</a>.',
        attribution: '&copy; CartoDB, &copy; OpenStreetMap contributors',
        subdomains: ['a', 'b', 'c', 'd']
    },
    // --- Keyed: Stadia Maps (appended as ?api_key=) ---
    {
        id: 'bw',
        label: 'Black &amp; White (Stadia)',
        group: 'keyed',
        url: 'https://tiles.stadiamaps.com/tiles/stamen_toner/{z}/{x}/{y}.png',
        apiKeyParam: '?api_key=',
        apiKeyHelp: 'Required for Black &amp; White and Outlines. <a href="https://stadiamaps.com/" target="_blank" rel="noopener noreferrer">Get a free Stadia Maps key</a>.',
        attribution: 'Map tiles by Stamen Design, CC BY 3.0 — Map data © OpenStreetMap',
        subdomains: []
    },
    {
        id: 'outlines',
        label: 'Outlines (Stadia)',
        group: 'keyed',
        url: 'https://tiles.stadiamaps.com/tiles/stamen_toner_lines/{z}/{x}/{y}.png',
        apiKeyParam: '?api_key=',
        apiKeyHelp: 'Required for Black &amp; White and Outlines. <a href="https://stadiamaps.com/" target="_blank" rel="noopener noreferrer">Get a free Stadia Maps key</a>.',
        attribution: 'Map tiles by Stamen Design, hosted by Stadia Maps; Data by OpenStreetMap',
        subdomains: []
    }
];

const BY_ID = new Map<string, TileProvider>(TILE_PROVIDERS.map((p) => [p.id, p]));

/** All valid selectable background map ids (excludes special 'none'/'system'). */
export const VALID_MAPS = new Set<string>(TILE_PROVIDERS.map((p) => p.id));

export function getTileProvider(id?: string): TileProvider | undefined {
    if (!id) return undefined;
    return BY_ID.get(id);
}

export function requiresApiKey(id?: string): boolean {
    return !!getTileProvider(id)?.apiKeyParam;
}

export function getTileProviderHelp(id?: string): string {
    return getTileProvider(id)?.apiKeyHelp || '';
}

/** Build the tile-provider URL, appending the API key where the provider requires one. */
export function buildTileUrl(id: string, apiKey?: string): string {
    const provider = getTileProvider(id);
    if (!provider) return '';
    if (provider.apiKeyParam && apiKey && apiKey.trim().length > 0) {
        return provider.url + provider.apiKeyParam + encodeURIComponent(apiKey.trim());
    }
    return provider.url;
}
