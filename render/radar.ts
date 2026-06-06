import { applyFilter } from '../utils/filter';
import { handleFlightTap } from '../utils/action';
import type { Flight } from '../types/flight';
import type { Condition, AircraftMarkerEntry } from '../types/config';
import type { CardState } from '../types/cardState';

const DRAW_SIZE = 12;

function parseMarkerCenter(center: string | undefined): [number, number] {
    if (!center) return [0, 0];
    const parts = center.split(',').map(Number);
    return [parts[0] || 0, parts[1] || 0];
}

function parseShadow(shadow: string): { offsetX: number; offsetY: number; blur: number; color: string } {
    const result = { offsetX: 0, offsetY: 0, blur: 0, color: 'rgba(0,0,0,0.5)' };
    if (!shadow) return result;
    const parts = shadow.trim().split(/\s+/);
    if (parts.length < 2) return result;
    result.offsetX = parseFloat(parts[0]) || 0;
    result.offsetY = parseFloat(parts[1]) || 0;
    let ci = 2;
    if (parts.length > 2 && /^[\d.]+(?:px|em|rem|pt|cm|mm|in|pc|ex|ch|vw|vh|vmin|vmax)$/i.test(parts[2])) {
        result.blur = Math.max(0, parseFloat(parts[2]) || 0);
        ci = 3;
    }
    if (parts.length > ci) {
        result.color = parts.slice(ci).join(' ');
    }
    return result;
}

function createCustomMarker(entry: AircraftMarkerEntry, heading: number): HTMLDivElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'custom-marker';

    const url = entry['aircraft-marker-url'];
    const overlayColor = entry['aircraft-marker-color-overlay'];
    const outlineWidth = entry['aircraft-marker-outline-width'] ?? 0;
    const outlineColor = entry['aircraft-marker-outline-color'] || '#000000';
    const shadow = entry['aircraft-marker-shadow'] || '';

    const hasEffects = overlayColor || outlineWidth > 0 || shadow.length > 0;

    if (hasEffects) {
        const canvas = document.createElement('canvas');
        wrapper.appendChild(canvas);
        const img = new Image();
        img.onload = () => {
            const iw = img.width;
            const ih = img.height;
            const scale = iw / DRAW_SIZE;

            const csOutline = Math.ceil(outlineWidth * scale);
            const sp = parseShadow(shadow);
            const csOffX = sp.offsetX * scale;
            const csOffY = sp.offsetY * scale;
            const csBlur = sp.blur * scale;

            const pad = Math.ceil(Math.max(csOutline, Math.abs(csOffX) + csBlur, Math.abs(csOffY) + csBlur));
            const cw = iw + 2 * pad;
            const ch = ih + 2 * pad;
            canvas.width = cw;
            canvas.height = ch;
            const ctx = canvas.getContext('2d')!;

            const drawScaledFill = (
                fill: string | CanvasGradient | CanvasPattern,
                dx: number, dy: number, dw: number, dh: number,
                blur?: number,
            ) => {
                ctx.save();
                if (blur && blur > 0) ctx.filter = `blur(${blur}px)`;
                ctx.drawImage(img, dx, dy, dw, dh);
                ctx.filter = 'none';
                ctx.globalCompositeOperation = 'source-atop';
                ctx.fillStyle = fill;
                ctx.fillRect(dx, dy, dw, dh);
                ctx.restore();
            };

            const bx = pad;
            const by = pad;

            const sw = iw + 2 * csOutline;
            const sh = ih + 2 * csOutline;

            // 1. Drop shadow
            if (shadow && (csOffX !== 0 || csOffY !== 0 || csBlur > 0)) {
                drawScaledFill(sp.color, bx - csOutline + csOffX, by - csOutline + csOffY, sw, sh, csBlur || undefined);
            }

            // 2. Outline (scaled up image filled with outline color)
            if (csOutline > 0) {
                drawScaledFill(outlineColor, bx - csOutline, by - csOutline, sw, sh);
            }

            // 3. Main image with color overlay
            ctx.drawImage(img, bx, by, iw, ih);
            if (overlayColor) {
                ctx.globalCompositeOperation = 'source-atop';
                ctx.fillStyle = overlayColor;
                ctx.fillRect(bx, by, iw, ih);
            }
        };
        img.src = url;
    } else {
        const img = document.createElement('img');
        img.src = url;
        img.draggable = false;
        wrapper.appendChild(img);
    }

    const rotation = entry['aircraft-marker-rotation'] ?? 0;
    const scaleVal = entry['aircraft-marker-scale'] ?? 1;
    const [centerX, centerY] = parseMarkerCenter(entry['aircraft-marker-center']);

    wrapper.style.transform = `rotate(${heading + rotation}deg) scale(${scaleVal})`;
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
