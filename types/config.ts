export type Comparator = 'eq' | 'lt' | 'lte' | 'gt' | 'gte' | 'oneOf' | 'containsOneOf';
export type SortOrder = 'asc' | 'desc' | 'ASC' | 'DESC';
export type ConditionType = 'AND' | 'OR' | 'NOT';

export interface SortCriterion {
    field: string;
    order?: SortOrder;
    comparator?: Comparator;
    value?: unknown;
}

export interface FieldCondition {
    field?: string;
    defined?: string;
    comparator: Comparator;
    value: unknown;
    defaultValue?: unknown;
}

export interface GroupCondition {
    type: 'AND' | 'OR';
    conditions: Condition[];
}

export interface NotCondition {
    type: 'NOT';
    condition: Condition;
}

export type Condition = FieldCondition | GroupCondition | NotCondition;

export type AircraftMarkerConfig = Record<string, AircraftMarkerEntry>;

export interface RadarFeatureBase {
    max_range?: number;
}

export interface LocationFeature extends RadarFeatureBase {
    type: 'location';
    label: string;
    position: { lat: number; lon: number };
}

export interface RunwayFeature extends RadarFeatureBase {
    type: 'runway';
    position: { lat: number; lon: number };
    heading: number;
    length: number;
}

export interface OutlineFeature extends RadarFeatureBase {
    type: 'outline';
    points: Array<{ lat: number; lon: number }>;
}

export type RadarFeature = LocationFeature | RunwayFeature | OutlineFeature;

export interface AircraftMarkerEntry {
    'aircraft-marker-url': string;
    'aircraft-marker-rotation'?: number;
    'aircraft-marker-center'?: string;
    'aircraft-marker-scale'?: number;
    'aircraft-marker-color-overlay'?: string;
    'aircraft-marker-outline-width'?: number;
    'aircraft-marker-outline-color'?: string;
    'aircraft-marker-shadow'?: string;
}

export type RadarView = 'radar' | 'map';

export interface RadarConfig {
    range?: number;
    initialRange?: number;
    min_range?: number;
    max_range?: number;
    ring_distance?: number;
    // Display mode: 'radar' = circular radar screen (default), 'map' = square full-bleed map
    view?: RadarView;
    // Whether to draw the radar grid rings / bearing lines. Defaults to on for
    // the circular 'radar' view and off for the square 'map' view. Set explicitly
    // to override.
    rings?: boolean;
    filter?: boolean | Condition[];
    // Old color properties (kept for backwards compatibility)
    'primary-color'?: string;
    'accent-color'?: string;
    'feature-color'?: string;
    // New color properties
    'background-color'?: string;
    'background-opacity'?: number;
    'aircraft-color'?: string;
    'aircraft-selected-color'?: string;
    'radar-grid-color'?: string;
    'local-features-color'?: string;
    'callsign-label-color'?: string;
    'aircraft-marker-size'?: 'small' | 'normal' | 'large' | 'x-large' | 'xx-large';
    'aircraft-marker'?: Record<string, AircraftMarkerEntry>;
    hide?: boolean;
    hide_range?: boolean;
    radar_size?: number;
    local_features?: RadarFeature[];
    background_map?: 'none' | 'system' | 'bw' | 'light' | 'color' | 'dark' | 'voyager' | 'satellite' | 'topo' | 'outlines';
    background_map_opacity?: number;
    background_map_api_key?: string;
}

export type ListPosition = 'below' | 'left' | 'right';

export interface ListConfig {
    hide?: boolean;
    showListStatus?: boolean;
    // Position of the flight list relative to the radar/map.
    // Falls back to 'below' when the card is too narrow (see README).
    position?: ListPosition;
}

export interface UnitsConfig {
    altitude: 'm' | 'ft';
    speed: 'kmh' | 'mph' | 'kts';
    distance: 'km' | 'miles';
}

export interface ToggleConfig {
    label: string;
    default?: boolean;
}

export interface AnnotationConfig {
    field: string;
    render: string;
    conditions: Condition[];
}

export interface CardConfig {
    flights_entity?: string;
    location_tracker?: string;
    location?: { lat: number; lon: number };
    projection_interval?: number;
    units?: Partial<UnitsConfig>;
    no_flights_message?: string;
    scale?: number;
    max_flights?: number;
    radar?: RadarConfig;
    list?: ListConfig;
    filter?: Condition[];
    sort?: SortCriterion[];
    defines?: Record<string, unknown>;
    toggles?: Record<string, ToggleConfig>;
    annotate?: AnnotationConfig[];
    templates?: Record<string, string>;
    updateRangeFilterOnTouchEnd?: boolean;
    tap_action?: string;
    flight_tap_action?: string;
    test?: boolean;
    update?: boolean;
}
