import { unitsConfig } from './config/unitsConfig.js';
import { sortConfig } from './config/sortConfig.js';
import { templateConfig } from './config/templateConfig.js';
import { getSortFn } from './utils/sort.js';
import { resolvePlaceholders } from './utils/template.js';

const defaults = {
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

export class Flightradar24CardState {
    constructor() {
        this.hass = null;

        this.config = {};
        this.radar = {};
        this.list = {};

        this.templates = {};
        this.defines = {};
        this.units = {};
        this.flightsContext = {};

        this.dimensions = {};

        this.flights = [];
        this.selectedFlights = [];

        this.renderDynamicOnRangeChange = false;
        this._leafletMap = null;
    }

    setConfig(config) {
        if (!config) throw new Error('Configuration is missing.');
        this.config = Object.assign({}, config);

        this.config.flights_entity = config.flights_entity ?? defaults.flights_entity;
        this.config.projection_interval = config.projection_interval ?? defaults.projection_interval;
        this.config.no_flights_message = config.no_flights_message ?? defaults.no_flights_message;

        this.list = Object.assign({}, defaults.list, config.list);
        this.units = Object.assign({}, defaults.units, config.units);
        this.radar = Object.assign(
            {},
            {
                range: this.units.distance === 'km' ? defaults.radar.range : 25,
                background_map: config.radar?.background_map ?? defaults.radar.background_map,
                background_map_opacity: config.radar?.background_map_opacity ?? defaults.radar.background_map_opacity,
                background_map_api_key: config.radar?.background_map_api_key ?? defaults.radar.background_map_api_key
            },
            config.radar
        );
        this.radar.initialRange = this.radar.range;
        this.defines = Object.assign({}, defaults.defines, config.defines);

        this.sortFn = getSortFn(config.sort ?? defaults.sort, (value, defaultValue) =>
            resolvePlaceholders(value, this.defines, this.config, this.radar, this.selectedFlights, defaultValue, (v) => {
                this.renderDynamicOnRangeChange = v;
            })
        );
        this.templates = Object.assign({}, defaults.templates, config.templates);
    }

    toggleSelectedFlight(flight) {
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

    setRenderDynamic(fn) {
        this.renderDynamicFn = fn;
    }

    setToggleValue(toggleKey, value) {
        if (this.config && this.config.toggles) {
            this.defines[toggleKey] = ['true', true, 1].includes(value);
            if (typeof this.renderDynamicFn === 'function') {
                this.renderDynamicFn();
            }
        }
    }
}
