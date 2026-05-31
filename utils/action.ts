import { renderUrlPath } from './template';
import type { CardState } from '../types/cardState';
import type { Flight } from '../types/flight';

export function handleRadarTap(cardState: CardState, clientX: number, clientY: number): void {
    const urlPath = cardState.config?.tap_action;
    if (!urlPath) return;

    const radar = cardState.dom?.radar;
    if (!radar) {
        openUrl(renderUrlPath(urlPath, { map_lat: cardState.mapCenter?.lat, map_lon: cardState.mapCenter?.lon, zoom: cardState.mapZoom, radar_range: cardState.radar?.range, entity: getEntityState(cardState) }));
        return;
    }

    const rect = radar.getBoundingClientRect();
    const clickX = clientX - rect.left;
    const clickY = clientY - rect.top;
    const radarWidth = rect.width;
    const radarHeight = rect.height;

    const rangeKm = cardState.units?.distance === 'miles' ? (cardState.radar?.range || 1) * 1.60934 : (cardState.radar?.range || 1);
    const centerX = radarWidth / 2;
    const centerY = radarHeight / 2;
    const dx = clickX - centerX;
    const dy = clickY - centerY;
    const distancePx = Math.sqrt(dx * dx + dy * dy);
    const maxDistPx = Math.min(centerX, centerY);
    const fraction = distancePx / maxDistPx;
    const clickRangeKm = fraction * rangeKm;
    const bearing = (Math.atan2(dx, -dy) * (180 / Math.PI) + 360) % 360;

    const refLat = cardState.mapCenter?.lat || 0;
    const refLon = cardState.mapCenter?.lon || 0;
    const bearingRad = (bearing * Math.PI) / 180;
    const kmPerDegLat = 111.32;
    const kmPerDegLon = 111.32 * Math.cos(refLat * Math.PI / 180);
    const clickLat = Math.round((refLat + (clickRangeKm / kmPerDegLat) * Math.cos(bearingRad)) * 100) / 100;
    const clickLon = Math.round((refLon + (clickRangeKm / kmPerDegLon) * Math.sin(bearingRad)) * 100) / 100;

    openUrl(renderUrlPath(urlPath, {
        map_lat: cardState.mapCenter?.lat,
        map_lon: cardState.mapCenter?.lon,
        zoom: cardState.mapZoom,
        radar_range: cardState.radar?.range,
        click_lat: clickLat,
        click_lon: clickLon,
        entity: getEntityState(cardState)
    }));
}

export function handleFlightTap(cardState: CardState, flight: Flight): void {
    const action = cardState.config?.flight_tap_action || 'toggle';
    const parts = action.split('|').map(s => s.trim());
    const shouldToggle = parts.includes('toggle');
    const urlPart = parts.find(p => p !== 'toggle') || '';

    if (shouldToggle) {
        cardState.toggleSelectedFlight(flight);
    }

    if (urlPart) {
        openUrl(renderUrlPath(urlPart, {
            map_lat: cardState.mapCenter?.lat,
            map_lon: cardState.mapCenter?.lon,
            zoom: cardState.mapZoom,
            radar_range: cardState.radar?.range,
            flight,
            entity: getEntityState(cardState)
        }));
    }
}

function getEntityState(cardState: CardState): { state?: string } | undefined {
    const entityId = cardState.config?.flights_entity;
    if (!entityId || !cardState.hass?.states) return undefined;
    const entity = cardState.hass.states[entityId];
    if (!entity) return undefined;
    return entity as { state?: string };
}

function openUrl(url: string): void {
    if (!url) return;
    window.open(url, '_blank');
}
