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

export interface RadarConfig {
    range?: number;
    initialRange?: number;
    min_range?: number;
    max_range?: number;
    ring_distance?: number;
    filter?: boolean | Condition[];
    'primary-color'?: string;
    'accent-color'?: string;
    'feature-color'?: string;
    'callsign-label-color'?: string;
    hide?: boolean;
    hide_range?: boolean;
    radar_size?: number;
    local_features?: RadarFeature[];
    background_map?: 'none' | 'system' | 'bw' | 'color' | 'dark' | 'outlines';
    background_map_opacity?: number;
    background_map_api_key?: string;
}

export interface ListConfig {
    hide?: boolean;
    showListStatus?: boolean;
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
    radar?: RadarConfig;
    list?: ListConfig;
    filter?: Condition[];
    sort?: SortCriterion[];
    defines?: Record<string, unknown>;
    toggles?: Record<string, ToggleConfig>;
    annotate?: AnnotationConfig[];
    templates?: Record<string, string>;
    updateRangeFilterOnTouchEnd?: boolean;
    test?: boolean;
    update?: boolean;
}
