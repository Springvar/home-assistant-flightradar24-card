import { renderFlag } from './flag';
import { parseTemplate } from '../utils/template';
import { applyConditions } from '../utils/filter';
import type { Flight, ExtendedFlight } from '../types/flight';
import type { AnnotationConfig } from '../types/config';
import type { CardState } from '../types/cardState';

function flightField(cardState: CardState, flight: Flight, field: string): string {
    try {
        let text = (flight as unknown as Record<string, string>)[field];
        if (cardState.config.annotate) {
            const f = Object.assign({}, flight) as unknown as Record<string, unknown>;
            cardState.config.annotate
                .filter((a: AnnotationConfig) => a.field === field)
                .forEach((a: AnnotationConfig) => {
                    if (applyConditions(cardState, flight, a.conditions)) {
                        f[field] = a.render.replace(/\$\{([^}]*)\}/g, (_, p1) => String(f[p1] || ''));
                    }
                });
            text = String(f[field] || '');
        }
        return text;
    } catch (e) {
        console.error(`[FR24Card] flightField error for field '${field}':`, e);
        return '';
    }
}

export function renderFlight(cardState: CardState, _flight: Flight): HTMLDivElement {
    try {
        const flight = Object.assign({}, _flight) as ExtendedFlight;
        const stringFields = [
            'flight_number',
            'callsign',
            'aircraft_registration',
            'aircraft_model',
            'aircraft_code',
            'airline',
            'airline_short',
            'airline_iata',
            'airline_icao',
            'airport_origin_name',
            'airport_origin_code_iata',
            'airport_origin_code_icao',
            'airport_origin_country_name',
            'airport_origin_country_code',
            'airport_destination_name',
            'airport_destination_code_iata',
            'airport_destination_code_icao',
            'airport_destination_country_name',
            'airport_destination_country_code'
        ] as const;

        stringFields.forEach((field) => {
            (flight as unknown as Record<string, unknown>)[field] = flightField(cardState, flight, field);
        });

        flight.origin_flag =
            flight.airport_origin_country_code ? renderFlag(flight.airport_origin_country_code, flight.airport_origin_country_name || '').outerHTML : '';
        flight.destination_flag =
            flight.airport_destination_country_code ?
                renderFlag(flight.airport_destination_country_code, flight.airport_destination_country_name || '').outerHTML
            :   '';

        flight.climb_descend_indicator =
            Math.abs(flight.vertical_speed) > 100 ?
                flight.vertical_speed > 100 ?
                    '↑'
                :   '↓'
            :   '';
        flight.alt_in_unit =
            flight.altitude >= 17750 ? `FL${Math.round(flight.altitude / 1000) * 10}`
            : flight.altitude > 0 ?
                cardState.units.altitude === 'm' ?
                    `${Math.round(flight.altitude * 0.3048)} m`
                :   `${Math.round(flight.altitude)} ft`
            :   undefined;

        flight.spd_in_unit =
            flight.ground_speed > 0 ?
                cardState.units.speed === 'kmh' ? `${Math.round(flight.ground_speed * 1.852)} km/h`
                : cardState.units.speed === 'mph' ? `${Math.round(flight.ground_speed * 1.15078)} mph`
                : `${Math.round(flight.ground_speed)} kts`
            :   undefined;

        flight.approach_indicator =
            flight.ground_speed > 70 ?
                flight.is_approaching ? '↓'
                : flight.is_receding ? '↑'
                : ''
            :   '';
        flight.dist_in_unit = `${Math.round(flight.distance_to_tracker || 0)} ${cardState.units.distance}`;
        flight.direction_info = `${Math.round(flight.heading_from_tracker || 0)}° ${flight.cardinal_direction_from_tracker || ''}`;

        const flightElement = document.createElement('div');
        flightElement.style.clear = 'both';
        flightElement.className = 'flight';

        if (cardState.selectedFlights && cardState.selectedFlights.includes(flight.id)) {
            flightElement.className += ' selected';
        }

        flightElement.innerHTML = parseTemplate(
            cardState,
            'flight_element',
            flight,
            (joinWith: string) =>
                (...elements: (string | undefined)[]) =>
                    elements?.filter((e) => e).join(joinWith || ' ')
        );
        flightElement.addEventListener('click', () => cardState.toggleSelectedFlight(flight));

        return flightElement;
    } catch (e) {
        console.error('[FR24Card] renderFlight error:', e);
        const errorElem = document.createElement('div');
        errorElem.className = 'flight error';
        errorElem.textContent = `Error rendering flight: ${e}`;
        return errorElem;
    }
}
