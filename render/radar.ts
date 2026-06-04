import { applyFilter } from '../utils/filter';
import { handleFlightTap } from '../utils/action';
import type { Flight } from '../types/flight';
import type { Condition, AircraftMarkerEntry } from '../types/config';
import type { CardState } from '../types/cardState';

function parseMarkerCenter(center: string | undefined): [number, number] {
    if (!center) return [0, 0];
    const parts = center.split(',').map(Number);
    return [parts[0] || 0, parts[1] || 0];
}

function createCustomMarker(entry: AircraftMarkerEntry, heading: number): HTMLDivElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'custom-marker';

    const url = entry['aircraft-marker-url'];
    const overlayColor = entry['aircraft-marker-color-overlay'];

    if (overlayColor) {
        const color = overlayColor.startsWith('var(')
            ? (getComputedStyle(wrapper).getPropertyValue(overlayColor.slice(4, -1).trim()).trim() || overlayColor)
            : overlayColor;
        const canvas = document.createElement('canvas');
        canvas.className = 'custom-marker-canvas';
        wrapper.appendChild(canvas);
        const img = new Image();
        img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(img, 0, 0);
            ctx.globalCompositeOperation = 'source-atop';
            ctx.fillStyle = color;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        };
        img.src = url;
    } else {
        const img = document.createElement('img');
        img.src = url;
        img.draggable = false;
        wrapper.appendChild(img);
    }

    const rotation = entry['aircraft-marker-rotation'] ?? 0;
    const scale = entry['aircraft-marker-scale'] ?? 1;
    const [centerX, centerY] = parseMarkerCenter(entry['aircraft-marker-center']);

    wrapper.style.transform = `rotate(${heading + rotation}deg) scale(${scale})`;
    wrapper.style.transformOrigin = `calc(50% + ${centerX}px) calc(50% + ${centerY}px)`;

    return wrapper;
}

export function renderRadar(cardState: CardState): void {
    const { flights, radar, selectedFlights, dimensions, dom } = cardState;

    let flightsToRender: Flight[];
    if (radar && radar.filter === true) {
        flightsToRender = cardState.flightsFiltered || flights;
    } else if (radar && radar.filter && typeof radar.filter === 'object') {
        flightsToRender = applyFilter(cardState, radar.filter as Condition[]);
    } else {
        flightsToRender = flights;
    }

    const planesContainer = dom?.planesContainer || (cardState.mainCard?.shadowRoot && cardState.mainCard.shadowRoot.getElementById('planes'));
    if (!planesContainer) return;
    planesContainer.innerHTML = '';

    const { range: radarRange, scaleFactor, centerX: radarCenterX, centerY: radarCenterY } = dimensions;
    if (!radarRange || !scaleFactor || radarCenterX === undefined || radarCenterY === undefined) return;

    const clippingRange = radarRange * 1.15;
    const aircraftMarkerConfig = radar?.['aircraft-marker'];
    const defaultMarkerEntry = aircraftMarkerConfig?.default;

    flightsToRender
        .slice()
        .reverse()
        .forEach((flight) => {
            const distance = flight.distance_to_tracker;
            if (distance !== undefined && distance <= clippingRange) {
                const plane = document.createElement('div');
                plane.className = 'plane';

                const headingFromTracker = flight.heading_from_tracker ?? 0;
                const x = radarCenterX + Math.cos(((headingFromTracker - 90) * Math.PI) / 180) * distance * scaleFactor;
                const y = radarCenterY + Math.sin(((headingFromTracker - 90) * Math.PI) / 180) * distance * scaleFactor;

                plane.style.top = y + 'px';
                plane.style.left = x + 'px';

                if (defaultMarkerEntry?.['aircraft-marker-url']) {
                    const marker = createCustomMarker(defaultMarkerEntry, flight.heading ?? 0);
                    plane.appendChild(marker);
                } else {
                    const arrow = document.createElement('div');
                    arrow.className = 'arrow';
                    arrow.style.transform = `rotate(${flight.heading}deg)`;
                    plane.appendChild(arrow);

                    if ((flight.altitude ?? 0) <= 0) {
                        plane.classList.add('plane-small');
                    } else {
                        plane.classList.add('plane-medium');
                    }
                }

                const label = document.createElement('div');
                label.className = 'callsign-label';
                label.textContent = flight.callsign ?? flight.aircraft_registration ?? 'n/a';
                planesContainer.appendChild(label);

                const labelRect = label.getBoundingClientRect();
                const labelWidth = labelRect.width + 3;
                const labelHeight = labelRect.height + 6;

                label.style.top = y - labelHeight + 'px';
                label.style.left = x - labelWidth + 'px';

                const markerSize = radar['aircraft-marker-size'];
                if (markerSize && markerSize !== 'normal') {
                    plane.classList.add(`marker-size-${markerSize}`);
                }

                if (selectedFlights && selectedFlights.includes(flight.id)) {
                    plane.classList.add('selected');
                }

                plane.addEventListener('click', (e) => { e.stopPropagation(); handleFlightTap(cardState, flight); });
                label.addEventListener('click', (e) => { e.stopPropagation(); handleFlightTap(cardState, flight); });
                planesContainer.appendChild(plane);
            }
        });
}
