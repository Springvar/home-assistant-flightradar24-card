import type { Flight } from './flight';
import type { Hass } from './hass';
import type { CardConfig, RadarConfig, ListConfig, UnitsConfig } from './config';

export interface Dimensions {
    width?: number;
    height?: number;
    range?: number;
    scaleFactor?: number;
    centerX?: number;
    centerY?: number;
}

export interface FlightsContext {
    shown?: number;
    total?: number;
    filtered?: number;
}

export interface DomRefs {
    toggleContainer?: HTMLElement;
    planesContainer?: HTMLElement;
    radar?: HTMLElement;
    radarScreen?: HTMLElement;
    radarInfoDisplay?: HTMLElement;
    radarContainer?: HTMLElement;
    shadowRoot?: ShadowRoot;
}

export interface MainCard extends HTMLElement {
    shadowRoot: ShadowRoot;
    observeRadarResize: () => void;
    updateRadarRange: (delta: number) => void;
    renderDynamic: () => void;
}

export interface LeafletMap {
    remove(): void;
    getContainer(): HTMLElement;
    eachLayer(fn: (layer: unknown) => void): void;
    removeLayer(layer: unknown): void;
    fitBounds(bounds: [[number, number], [number, number]], options: { animate: boolean; padding: [number, number] }): void;
    containerPointToLatLng(point: { x: number; y: number }): { lat: number; lng: number };
}

/**
 * Core card state interface used across all render and utility functions.
 * This represents the Flightradar24CardState class structure.
 * Many properties are optional to support partial states in utility functions and tests.
 */
export interface CardState {
    // Core state
    hass?: Hass | null;
    config: CardConfig;
    radar: RadarConfig & { range: number; initialRange?: number };
    list?: ListConfig;
    units: UnitsConfig;

    // Flight data
    flights: Flight[];
    flightsFiltered?: Flight[];
    selectedFlights: string[];
    flightsContext?: FlightsContext;

    // Rendering state
    templates?: Record<string, string>;
    defines?: Record<string, unknown>;
    dimensions: Dimensions;
    dom?: DomRefs;
    mainCard?: MainCard;

    // Internal state
    renderDynamicOnRangeChange: boolean;
    _leafletMap?: LeafletMap | null;
    _currentMapConfig?: { type: string; apiKey?: string };
    sortFn: (a: Flight, b: Flight) => number;
    renderDynamicFn?: () => void;

    // Methods
    toggleSelectedFlight: (flight: Flight) => void;
    setToggleValue?: (key: string, value: boolean) => void;
}

/**
 * Partial CardState for use in tests and utility functions that don't need all properties.
 */
export type PartialCardState = Partial<CardState> & {
    flights?: Flight[];
    defines?: Record<string, unknown>;
    config?: Partial<CardConfig>;
    radar?: Partial<RadarConfig> & { range?: number };
    selectedFlights?: string[];
};
