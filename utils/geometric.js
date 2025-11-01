export function toRadians(degrees) {
    return degrees * (Math.PI / 180);
}

export function toDegrees(radians) {
    return radians * (180 / Math.PI);
}

export function haversine(lat1, lon1, lat2, lon2, units = 'km') {
    const R = 6371.0; // Radius of the Earth in kilometers
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return units === 'km' ? R * c : (R * c) / 1.60934;
}

export function calculateBearing(lat1, lon1, lat2, lon2) {
    const dLon = toRadians(lon2 - lon1);
    const y = Math.sin(dLon) * Math.cos(toRadians(lat2));
    const x = Math.cos(toRadians(lat1)) * Math.sin(toRadians(lat2)) - Math.sin(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.cos(dLon);
    const bearing = Math.atan2(y, x);
    return (toDegrees(bearing) + 360) % 360; // Normalize to 0-360
}

export function calculateNewPosition(lat, lon, bearing, distanceKm) {
    const R = 6371.0; // Radius of the Earth in kilometers
    const bearingRad = toRadians(bearing);
    const latRad = toRadians(lat);
    const lonRad = toRadians(lon);
    const distanceRad = distanceKm / R;

    const newLatRad = Math.asin(Math.sin(latRad) * Math.cos(distanceRad) + Math.cos(latRad) * Math.sin(distanceRad) * Math.cos(bearingRad));
    const newLonRad = lonRad + Math.atan2(Math.sin(bearingRad) * Math.sin(distanceRad) * Math.cos(latRad), Math.cos(distanceRad) - Math.sin(latRad) * Math.sin(newLatRad));

    const newLat = toDegrees(newLatRad);
    const newLon = toDegrees(newLonRad);

    return { lat: newLat, lon: newLon };
}

export function calculateClosestPassingPoint(refLat, refLon, flightLat, flightLon, heading) {
    const trackBearing = calculateBearing(flightLat, flightLon, refLat, refLon);
    const angle = Math.abs((heading - trackBearing + 360) % 360);
    const distanceToFlight = haversine(refLat, refLon, flightLat, flightLon);
    const distanceAlongPath = distanceToFlight * Math.cos(toRadians(angle));
    return calculateNewPosition(flightLat, flightLon, heading, distanceAlongPath);
}

export function getCardinalDirection(bearing) {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(bearing / 45) % 8;
    return directions[index];
}

export function areHeadingsAligned(direction_to_tracker, heading, margin = 60) {
    const diff = Math.abs((direction_to_tracker - heading + 360) % 360);
    return diff <= margin || diff >= 360 - margin;
}
