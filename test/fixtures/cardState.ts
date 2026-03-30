import type { Hass } from '../../types/hass';
import type { Flight } from '../../types/flight';
import type { CardConfig, RadarConfig, ListConfig, UnitsConfig } from '../../types/config';

export interface CardState {
    hass: Hass | null;
    config: CardConfig;
    radar: RadarConfig & { range: number; initialRange: number };
    list: ListConfig;
    templates: Record<string, string>;
    defines: Record<string, unknown>;
    units: UnitsConfig;
    flightsContext: { shown?: number; total?: number; filtered?: number };
    dimensions: {
        width?: number;
        height?: number;
        range?: number;
        scaleFactor?: number;
        centerX?: number;
        centerY?: number;
    };
    flights: Flight[];
    selectedFlights: string[];
    renderDynamicOnRangeChange: boolean;
    _leafletMap: unknown;
    sortFn: (a: Flight, b: Flight) => number;
    renderDynamicFn?: () => void;
}

export interface MockCardStateOptions {
    hass?: Hass | null;
    config?: Partial<CardConfig>;
    radar?: Partial<RadarConfig>;
    list?: Partial<ListConfig>;
    units?: Partial<UnitsConfig>;
    defines?: Record<string, unknown>;
    templates?: Record<string, string>;
    flights?: Flight[];
    selectedFlights?: string[];
}

export function createMockCardState(options: MockCardStateOptions = {}): CardState {
    const {
        hass = null,
        config = {},
        radar = {},
        list = {},
        units = {},
        defines = {},
        templates = {},
        flights = [],
        selectedFlights = []
    } = options;

    return {
        hass,
        config: {
            flights_entity: 'sensor.flightradar24_current_in_area',
            projection_interval: 5,
            no_flights_message: 'No flights are currently visible.',
            ...config
        },
        radar: {
            range: 35,
            initialRange: 35,
            background_map: 'none',
            background_map_opacity: 0,
            background_map_api_key: '',
            ...radar
        },
        list: {
            hide: false,
            showListStatus: true,
            ...list
        },
        templates,
        defines,
        units: {
            altitude: 'ft',
            speed: 'kts',
            distance: 'km',
            ...units
        },
        flightsContext: {},
        dimensions: {
            width: 400,
            height: 400,
            range: 35,
            scaleFactor: 400 / 70,
            centerX: 200,
            centerY: 200
        },
        flights,
        selectedFlights,
        renderDynamicOnRangeChange: false,
        _leafletMap: null,
        sortFn: (a, b) => (a.distance_to_tracker ?? 0) - (b.distance_to_tracker ?? 0)
    };
}
