import { applyFilter } from '../utils/filter';
import { handleFlightTap } from '../utils/action';
import type { Flight } from '../types/flight';
import type { Condition, AircraftMarkerEntry } from '../types/config';
import type { CardState } from '../types/cardState';

const DISPLAY_SIZE = 12;

const imgCache = new Map<string, Promise<HTMLImageElement>>();
const renderCache = new Map<string, Promise<HTMLCanvasElement>>();

function parseMarkerCenter(center: string | undefined): [number, number] {
    if (!center) return [0, 0];
    const parts = center.split(',').map(Number);
    return [parts[0] || 0, parts[1] || 0];
}

interface ParsedShadow {
    offsetX: number;
    offsetY: number;
    blur: number;
    color: string;
}

function parseShadow(shadow: string): ParsedShadow {
    const result: ParsedShadow = { offsetX: 0, offsetY: 0, blur: 0, color: 'rgba(0,0,0,0.5)' };
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

function loadImage(url: string): Promise<HTMLImageElement> {
    const cached = imgCache.get(url);
    if (cached) return cached;
    const promise = new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Failed to load marker image: ${url}`));
        img.src = url;
    });
    imgCache.set(url, promise);
    return promise;
}

function renderMarker(img: HTMLImageElement, entry: AircraftMarkerEntry): HTMLCanvasElement {
    const iw = img.width;
    const ih = img.height;
    const pxRatio = iw / DISPLAY_SIZE;

    const overlayColor = entry['aircraft-marker-color-overlay'];
    const outlineWidth = entry['aircraft-marker-outline-width'] ?? 0;
    const outlineColor = entry['aircraft-marker-outline-color'] || '#000000';
    const shadow = entry['aircraft-marker-shadow'] || '';

    const sp = parseShadow(shadow);
    const csOffX = Math.round(sp.offsetX * pxRatio);
    const csOffY = Math.round(sp.offsetY * pxRatio);
    const csBlur = Math.round(sp.blur * pxRatio);

    const csOutline = Math.ceil(outlineWidth * pxRatio);
    const outlineBlur = Math.max(1, Math.round(csOutline * 0.4));

    const pad = Math.ceil(Math.max(
        csOutline + outlineBlur * 2,
        Math.abs(csOffX) + csBlur * 2,
        Math.abs(csOffY) + csBlur * 2,
    ));
    const cw = iw + 2 * pad;
    const ch = ih + 2 * pad;

    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d')!;

    const bx = pad;
    const by = pad;

    // Layer 1: Shadow
    if (shadow && (csOffX !== 0 || csOffY !== 0 || csBlur > 0)) {
        const sc = document.createElement('canvas');
        sc.width = iw;
        sc.height = ih;
        const sctx = sc.getContext('2d')!;
        sctx.drawImage(img, 0, 0, iw, ih);
        sctx.globalCompositeOperation = 'source-atop';
        sctx.fillStyle = sp.color;
        sctx.fillRect(0, 0, iw, ih);

        ctx.save();
        if (csBlur > 0) ctx.filter = `blur(${csBlur}px)`;
        ctx.drawImage(sc, bx + csOffX, by + csOffY, iw, ih);
        ctx.restore();
    }

    // Layer 2: Outline
    if (csOutline > 0) {
        const oc = document.createElement('canvas');
        oc.width = cw;
        oc.height = ch;
        const octx = oc.getContext('2d')!;
        const sw = iw + 2 * csOutline;
        const sh = ih + 2 * csOutline;
        octx.save();
        octx.filter = `blur(${outlineBlur}px)`;
        octx.drawImage(img, bx - csOutline, by - csOutline, sw, sh);
        octx.filter = 'none';
        octx.globalCompositeOperation = 'source-atop';
        octx.fillStyle = outlineColor;
        octx.fillRect(0, 0, cw, ch);
        octx.restore();

        ctx.drawImage(oc, 0, 0);
    }

    // Layer 3: Main image
    ctx.drawImage(img, bx, by, iw, ih);
    if (overlayColor) {
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = overlayColor;
        ctx.fillRect(bx, by, iw, ih);
    }

    return canvas;
}

function markerCacheKey(entry: AircraftMarkerEntry): string {
    return `${entry['aircraft-marker-url']}|${entry['aircraft-marker-color-overlay']}|${entry['aircraft-marker-outline-width']}|${entry['aircraft-marker-outline-color']}|${entry['aircraft-marker-shadow']}`;
}

function getOrCreateRenderPromise(entry: AircraftMarkerEntry): Promise<HTMLCanvasElement> {
    const key = markerCacheKey(entry);
    const cached = renderCache.get(key);
    if (cached) return cached;
    const promise = loadImage(entry['aircraft-marker-url']).then(img => renderMarker(img, entry));
    renderCache.set(key, promise);
    return promise;
}

function createCustomMarker(entry: AircraftMarkerEntry, heading: number): HTMLDivElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'custom-marker';

    const transformEl = document.createElement('div');
    transformEl.className = 'custom-marker-transform';
    wrapper.appendChild(transformEl);

    const url = entry['aircraft-marker-url'];
    const overlayColor = entry['aircraft-marker-color-overlay'];
    const outlineWidth = entry['aircraft-marker-outline-width'] ?? 0;
    const outlineColor = entry['aircraft-marker-outline-color'] || '#000000';
    const shadow = entry['aircraft-marker-shadow'] || '';

    const hasEffects = overlayColor || outlineWidth > 0 || shadow.length > 0;

    if (hasEffects) {
        const canvas = document.createElement('canvas');
        transformEl.appendChild(canvas);

        getOrCreateRenderPromise(entry)
            .then(src => {
                canvas.width = src.width;
                canvas.height = src.height;
                canvas.getContext('2d')!.drawImage(src, 0, 0);
            })
            .catch(() => {});
    } else {
        const img = document.createElement('img');
        img.src = url;
        img.draggable = false;
        transformEl.appendChild(img);
    }

    const rotation = entry['aircraft-marker-rotation'] ?? 0;
    const scaleVal = entry['aircraft-marker-scale'] ?? 1;
    const [centerX, centerY] = parseMarkerCenter(entry['aircraft-marker-center']);

    transformEl.style.transform = `rotate(${heading + rotation}deg) scale(${scaleVal})`;
    transformEl.style.transformOrigin = `calc(50% + ${centerX}px) calc(50% + ${centerY}px)`;

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
