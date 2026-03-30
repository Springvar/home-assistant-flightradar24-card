import { unitsConfig } from './config/unitsConfig';
import { sortConfig } from './config/sortConfig';
import { templateConfig } from './config/templateConfig';
import { getSortFn } from './utils/sort';
import { resolvePlaceholders } from './utils/template';
import type { Flight } from './types/flight';
import type { Hass } from './types/hass';
import type { CardConfig, RadarConfig, ListConfig, UnitsConfig, SortCriterion } from './types/config';
import type { CardState, Dimensions, FlightsContext, DomRefs, MainCard, LeafletMap } from './types/cardState';

type BackgroundMapType = 'none' | 'system' | 'bw' | 'color' | 'dark' | 'outlines';

interface Defaults {
    flights_entity: string;
    projection_interval: number;
    no_flights_message: string;
    list: ListConfig;
    units: UnitsConfig;
    radar: {
        range: number;
        background_map: BackgroundMapType;
        background_map_opacity: number;
        background_map_api_key: string;
    };
    sort: SortCriterion[];
    templates: Record<string, string>;
    defines: Record<string, unknown>;
}

const defaults: Defaults = {
    flights_entity: 'sensor.flightradar24_current_in_area',
    projection_interval: 5,
    no_flights_message: 'No flights are currently visible. Please check back later.',
    list: { hide: false, showListStatus: true },
    units: unitsConfig,
    radar: {
        range: unitsConfig.distance === 'km' ? 35 : 25,
        background_map: 'none',
        background_map_opacity: 0,
        background_map_api_key: ''
    },
    sort: sortConfig,
    templates: templateConfig,
    defines: {}
};

export class Flightradar24CardState implements CardState {
    hass: Hass | null;
    config: CardConfig;
    radar: RadarConfig & { range: number; initialRange?: number };
    list: ListConfig;
    templates: Record<string, string>;
    defines: Record<string, unknown>;
    units: UnitsConfig;
    flightsContext: FlightsContext;
    dimensions: Dimensions;
    flights: Flight[];
    flightsFiltered?: Flight[];
    selectedFlights: string[];
    renderDynamicOnRangeChange: boolean;
    _leafletMap: LeafletMap | null;
    sortFn: (a: Flight, b: Flight) => number;
    renderDynamicFn?: () => void;
    dom?: DomRefs;
    mainCard?: MainCard;

    constructor() {
        this.hass = null;
        this.config = {};
        this.radar = { range: 35 };
        this.list = {};
        this.templates = {};
        this.defines = {};
        this.units = { altitude: 'ft', speed: 'kts', distance: 'km' };
        this.flightsContext = {};
        this.dimensions = {};
        this.flights = [];
        this.selectedFlights = [];
        this.renderDynamicOnRangeChange = false;
        this._leafletMap = null;
        this.sortFn = () => 0;
    }

    setConfig(config: CardConfig): void {
        if (!config) throw new Error('Configuration is missing.');
        this.config = { ...config };

        this.config.flights_entity = config.flights_entity ?? defaults.flights_entity;
        this.config.projection_interval = config.projection_interval ?? defaults.projection_interval;
        this.config.no_flights_message = config.no_flights_message ?? defaults.no_flights_message;

        this.list = { ...defaults.list, ...config.list };
        this.units = { ...defaults.units, ...config.units };
        this.radar = {
            range: this.units.distance === 'km' ? defaults.radar.range : 25,
            background_map: config.radar?.background_map ?? defaults.radar.background_map,
            background_map_opacity: config.radar?.background_map_opacity ?? defaults.radar.background_map_opacity,
            background_map_api_key: config.radar?.background_map_api_key ?? defaults.radar.background_map_api_key,
            ...config.radar
        };
        this.radar.initialRange = this.radar.range;
        this.defines = { ...defaults.defines, ...config.defines };

        this.sortFn = getSortFn(config.sort ?? defaults.sort, (value) =>
            resolvePlaceholders(this, value, undefined, (v: boolean) => {
                this.renderDynamicOnRangeChange = v;
            })
        );
        this.templates = { ...defaults.templates, ...config.templates };
    }

    toggleSelectedFlight(flight: Flight): void {
        if (!this.selectedFlights) this.selectedFlights = [];
        if (!this.selectedFlights.includes(flight.id)) {
            this.selectedFlights.push(flight.id);
        } else {
            this.selectedFlights = this.selectedFlights.filter((id) => id !== flight.id);
        }
        if (typeof this.renderDynamicFn === 'function') {
            this.renderDynamicFn();
        }
    }

    setRenderDynamic(fn: () => void): void {
        this.renderDynamicFn = fn;
    }

    setToggleValue(toggleKey: string, value: unknown): void {
        if (this.config && this.config.toggles) {
            this.defines[toggleKey] = ['true', true, 1].includes(value as string | boolean | number);
            if (typeof this.renderDynamicFn === 'function') {
                this.renderDynamicFn();
            }
        }
    }
}
