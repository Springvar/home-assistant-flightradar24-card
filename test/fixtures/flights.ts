import type { Flight } from '../../types/flight';

export const mockFlights: Flight[] = [
    {
        id: 'TEST_NO01',
        flight_number: 'NO123',
        callsign: 'VAERNES01',
        aircraft_registration: 'LN001',
        aircraft_model: 'B737',
        aircraft_code: 'B737',
        airline: 'Norwegian',
        airline_short: 'NO',
        airline_iata: 'DY',
        airline_icao: 'NAX',
        airport_origin_name: 'Oslo Gardermoen',
        airport_origin_code_iata: 'OSL',
        airport_origin_country_name: 'Norway',
        airport_origin_country_code: 'NO',
        airport_destination_name: 'Trondheim Værnes',
        airport_destination_code_iata: 'TRD',
        airport_destination_country_name: 'Norway',
        airport_destination_country_code: 'NO',
        latitude: 63.4578,
        longitude: 10.452,
        altitude: 700,
        vertical_speed: -300,
        ground_speed: 145,
        heading: 92
    },
    {
        id: 'TEST_NO02',
        flight_number: 'NO456',
        callsign: 'ORLAND01',
        aircraft_registration: 'LN002',
        aircraft_model: 'F-16',
        aircraft_code: 'F16',
        airline: 'Norwegian Air Force',
        airline_short: 'NOAF',
        airline_iata: '',
        airline_icao: 'NOAF',
        airport_origin_name: 'Bodø',
        airport_origin_code_iata: 'BOO',
        airport_origin_country_name: 'Norway',
        airport_origin_country_code: 'NO',
        airport_destination_name: 'Ørland',
        airport_destination_code_iata: 'OLA',
        airport_destination_country_name: 'Norway',
        airport_destination_country_code: 'NO',
        latitude: 63.7,
        longitude: 9.61,
        altitude: 850,
        vertical_speed: -320,
        ground_speed: 170,
        heading: 150
    },
    {
        id: 'TEST_NO03',
        flight_number: 'NO789',
        callsign: 'TRANZIT01',
        aircraft_registration: 'LN003',
        aircraft_model: 'A320',
        aircraft_code: 'A320',
        airline: 'Scandinavian',
        airline_short: 'SK',
        airline_iata: 'SK',
        airline_icao: 'SAS',
        airport_origin_name: 'Tromsø',
        airport_origin_code_iata: 'TOS',
        airport_origin_country_name: 'Norway',
        airport_origin_country_code: 'NO',
        airport_destination_name: 'Amsterdam',
        airport_destination_code_iata: 'AMS',
        airport_destination_country_name: 'Netherlands',
        airport_destination_country_code: 'NL',
        latitude: 63.8,
        longitude: 10.97,
        altitude: 19800,
        vertical_speed: 0,
        ground_speed: 470,
        heading: 225
    }
];

export function createMockFlight(overrides: Partial<Flight> = {}): Flight {
    return {
        id: `TEST_${Math.random().toString(36).substr(2, 9)}`,
        latitude: 63.4,
        longitude: 10.4,
        altitude: 10000,
        vertical_speed: 0,
        ground_speed: 450,
        heading: 180,
        ...overrides
    };
}

export function createApproachingFlight(
    refLat: number,
    refLon: number,
    overrides: Partial<Flight> = {}
): Flight {
    // Create a flight that is approaching the reference point
    const heading = 180; // Flying south
    return createMockFlight({
        latitude: refLat + 0.1, // North of reference
        longitude: refLon,
        heading,
        ground_speed: 450,
        ...overrides
    });
}

export function createRecedingFlight(
    refLat: number,
    refLon: number,
    overrides: Partial<Flight> = {}
): Flight {
    // Create a flight that is moving away from the reference point
    const heading = 0; // Flying north
    return createMockFlight({
        latitude: refLat + 0.1, // North of reference
        longitude: refLon,
        heading,
        ground_speed: 450,
        ...overrides
    });
}
