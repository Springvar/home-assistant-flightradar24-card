import type { Flight } from './flight';

export interface HassEntityState {
    state: string;
    attributes: {
        flights?: Flight[];
        latitude?: number;
        longitude?: number;
        [key: string]: unknown;
    };
    entity_id: string;
    last_changed: string;
    last_updated: string;
}

export interface HassConfig {
    latitude: number;
    longitude: number;
    elevation: number;
    unit_system: {
        length: string;
        mass: string;
        temperature: string;
        volume: string;
    };
    location_name: string;
    time_zone: string;
    components: string[];
    version: string;
}

export interface HassConnection {
    subscribeEvents: (
        callback: (event: HassEvent) => void,
        eventType: string
    ) => Promise<() => void>;
}

export interface HassEvent {
    event_type: string;
    data: {
        entity_id: string;
        new_state?: HassEntityState;
        old_state?: HassEntityState;
    };
}

export interface Hass {
    states: Record<string, HassEntityState>;
    config: HassConfig;
    connection: HassConnection;
    callService: (domain: string, service: string, data?: Record<string, unknown>) => Promise<void>;
}
