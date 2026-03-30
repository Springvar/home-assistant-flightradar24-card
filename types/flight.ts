export interface Flight {
    /** Index signature to allow dynamic property access in templates and sort functions */
    [key: string]: unknown;
    id: string;
    flight_number?: string;
    callsign?: string;
    aircraft_registration?: string;
    aircraft_model?: string;
    aircraft_code?: string;
    airline?: string;
    airline_short?: string;
    airline_iata?: string;
    airline_icao?: string;
    airport_origin_name?: string;
    airport_origin_code_iata?: string;
    airport_origin_code_icao?: string;
    airport_origin_country_name?: string;
    airport_origin_country_code?: string;
    airport_destination_name?: string;
    airport_destination_code_iata?: string;
    airport_destination_code_icao?: string;
    airport_destination_country_name?: string;
    airport_destination_country_code?: string;
    latitude: number;
    longitude: number;
    altitude: number;
    vertical_speed: number;
    ground_speed: number;
    heading: number;
    aircraft_photo_small?: string;
    time_scheduled_departure?: number;

    // Computed fields (added by card)
    _timestamp?: number;
    distance_to_tracker?: number;
    heading_from_tracker?: number;
    cardinal_direction_from_tracker?: string;
    is_approaching?: boolean;
    is_receding?: boolean;
    closest_passing_distance?: number;
    eta_to_closest_distance?: number;
    heading_from_tracker_to_closest_passing?: number;
    is_landing?: boolean;
    landed?: boolean;

    // Rendered fields
    origin_flag?: string;
    destination_flag?: string;
    climb_descend_indicator?: string;
    alt_in_unit?: string;
    spd_in_unit?: string;
    dist_in_unit?: string;
    approach_indicator?: string;
    direction_info?: string;
}

export interface Position {
    lat: number;
    lon: number;
}

// Extended flight with all computed fields populated
export interface ExtendedFlight extends Flight {
    _timestamp?: number;
    landed?: boolean;
    is_landing?: boolean;
}
