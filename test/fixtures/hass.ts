import type { Hass, HassEntityState, HassConfig } from '../../types/hass';
import type { Flight } from '../../types/flight';

export interface MockHassOptions {
    flights?: Flight[];
    location?: { latitude: number; longitude: number };
    trackerEntity?: string;
    trackerState?: Partial<HassEntityState>;
    states?: Record<string, HassEntityState>;
    config?: HassConfig;
}

export function createMockHass(options: MockHassOptions = {}): Hass {
    const {
        flights = [],
        location = { latitude: 63.4041, longitude: 10.4301 },
        trackerEntity,
        trackerState,
        states: providedStates,
        config: providedConfig
    } = options;

    // If states are explicitly provided, use them directly
    let states: Record<string, HassEntityState>;
    if (providedStates) {
        states = providedStates;
    } else {
        states = {
            'sensor.flightradar24_current_in_area': {
                entity_id: 'sensor.flightradar24_current_in_area',
                state: flights.length.toString(),
                attributes: { flights },
                last_changed: new Date().toISOString(),
                last_updated: new Date().toISOString()
            }
        };

        if (trackerEntity && trackerState) {
            states[trackerEntity] = {
                entity_id: trackerEntity,
                state: 'home',
                attributes: {
                    latitude: location.latitude,
                    longitude: location.longitude,
                    ...trackerState.attributes
                },
                last_changed: new Date().toISOString(),
                last_updated: new Date().toISOString(),
                ...trackerState
            };
        }
    }

    const config: HassConfig = providedConfig || {
        latitude: location.latitude,
        longitude: location.longitude,
        elevation: 0,
        unit_system: {
            length: 'km',
            mass: 'kg',
            temperature: '°C',
            volume: 'L'
        },
        location_name: 'Home',
        time_zone: 'Europe/Oslo',
        components: [],
        version: '2024.3.0'
    };

    return {
        states,
        config,
        connection: {
            subscribeEvents: () => Promise.resolve(() => {})
        },
        callService: async () => {}
    };
}
