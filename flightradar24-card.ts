import { renderStatic } from './render/static';
import { renderRadarScreen } from './render/radarScreen';
import { renderRadar } from './render/radar';
import { renderFlight } from './render/flight';
import {
    haversine,
    calculateBearing,
    calculateNewPosition,
    calculateClosestPassingPoint,
    getCardinalDirection,
    areHeadingsAligned
} from './utils/geometric';
import { applyFilter } from './utils/filter';
import { parseTemplate } from './utils/template';
import { setupZoomHandlers } from './utils/zoom';
import { getLocation } from './utils/location';
import { ensureLeafletLoadedIfNeeded } from './render/map';
import { Flightradar24CardState } from './flightradar24-card-state';
import type { Flight, ExtendedFlight } from './types/flight';
import type { Hass, HassConnection } from './types/hass';
import type { CardConfig, Condition } from './types/config';
import type { MainCard } from './types/cardState';

const FR24_CARD_VERSION = '___CARD_VERSION___';
if (FR24_CARD_VERSION !== '___CARD_VERSION___') {
    console.info(`%cFLIGHTRADAR24-CARD%c v${FR24_CARD_VERSION} `, 'color: #236597; font-weight: bold', 'color: inherit; font-weight: normal');
}

class Flightradar24Card extends HTMLElement implements MainCard {
    _radarResizeObserver: ResizeObserver | null = null;
    _zoomCleanup: (() => void) | null = null;
    _updateRequired = true;
    _timer: ReturnType<typeof setInterval> | null = null;
    _unsubStateChangesPromise: Promise<() => void> | null = null;
    cardState: Flightradar24CardState;
    shadowRoot!: ShadowRoot;

    constructor() {
        super();
        try {
            this.attachShadow({ mode: 'open' });
            this.cardState = new Flightradar24CardState();
            this.cardState.setRenderDynamic(() => this.renderDynamic());
        } catch (e) {
            console.error('[FR24Card] constructor error:', e);
            this.cardState = new Flightradar24CardState();
        }
    }

    setConfig(config: CardConfig): void {
        try {
            if (!config) throw new Error('Configuration is missing.');
            this.cardState.setConfig(config);
            renderStatic(this.cardState, this);
            this.observeRadarResize();
        } catch (e) {
            console.error('[FR24Card] setConfig error:', e);
        }
    }

    set hass(hass: Hass) {
        try {
            this.cardState.hass = hass;

            if (!this._unsubStateChangesPromise) {
                this._unsubStateChangesPromise = this.subscribeToStateChanges(hass);
            }

            if (this._updateRequired) {
                this._updateRequired = false;

                // Defer data fetching and heavy operations to avoid long task flagging
                setTimeout(() => {
                    this.fetchFlightsData();
                    requestAnimationFrame(() => {
                        this.updateCardDimensions();

                        ensureLeafletLoadedIfNeeded(this.cardState, this.shadowRoot, () => {
                            try {
                                renderRadarScreen(this.cardState);
                                renderRadar(this.cardState);
                            } catch (e) {
                                console.error('[FR24Card] Leaflet render error:', e);
                            }
                        });

                        requestAnimationFrame(() => {
                            this.renderDynamic();
                        });
                    });
                }, 0);
            }
        } catch (e) {
            console.error('[FR24Card] set hass error:', e);
        }
    }

    connectedCallback(): void {
        try {
            this.observeRadarResize();
        } catch (e) {
            console.error('[FR24Card] connectedCallback error:', e);
        }
    }

    disconnectedCallback(): void {
        try {
            if (this._radarResizeObserver) {
                this._radarResizeObserver.disconnect();
                this._radarResizeObserver = null;
            }
            if (this.cardState._leafletMap) {
                this.cardState._leafletMap.remove();
                this.cardState._leafletMap = null;
            }
            if (this._zoomCleanup) {
                this._zoomCleanup();
                this._zoomCleanup = null;
            }
            if (this._unsubStateChangesPromise) {
                this._unsubStateChangesPromise.then((unsub) => unsub());
                this._unsubStateChangesPromise = null;
            }
        } catch (e) {
            console.error('[FR24Card] disconnectedCallback error:', e);
        }
    }

    updateCardDimensions(): void {
        try {
            const radarElem = this.shadowRoot?.getElementById('radar');
            const width = radarElem?.clientWidth || 400;
            const height = radarElem?.clientHeight || 400;
            const range = this.cardState.radar.range;
            const scaleFactor = width / (range * 2);
            if (
                width !== this.cardState.dimensions.width ||
                height !== this.cardState.dimensions.height ||
                range !== this.cardState.dimensions.range ||
                scaleFactor !== this.cardState.dimensions.scaleFactor
            ) {
                this.cardState.dimensions = {
                    width,
                    height,
                    range,
                    scaleFactor,
                    centerX: width / 2,
                    centerY: height / 2
                };
                if (this.cardState.radar.hide !== true) {
                    renderRadarScreen(this.cardState);
                    renderRadar(this.cardState);
                }
            }
        } catch (e) {
            console.error('[FR24Card] updateCardDimensions error:', e);
        }
    }

    observeRadarResize(): void {
        try {
            const radar = this.shadowRoot?.getElementById('radar');
            if (!radar) return;
            if (this._radarResizeObserver) this._radarResizeObserver.disconnect();
            this._radarResizeObserver = new ResizeObserver(() => {
                try {
                    this.updateCardDimensions();
                } catch (e) {
                    console.error('[FR24Card] ResizeObserver error:', e);
                }
            });
            this._radarResizeObserver.observe(radar);
            const radarOverlay = this.shadowRoot?.getElementById('radar-overlay') || null;
            if (this._zoomCleanup) this._zoomCleanup();
            this._zoomCleanup = setupZoomHandlers(this.cardState as Parameters<typeof setupZoomHandlers>[0], radarOverlay);
        } catch (e) {
            console.error('[FR24Card] observeRadarResize error:', e);
        }
    }

    renderDynamic(): void {
        try {
            const flightsContainer = this.shadowRoot?.getElementById('flights');
            if (!flightsContainer) return;

            const fragment = document.createDocumentFragment();
            if (this.cardState.list && this.cardState.list.hide === true) {
                flightsContainer.style.display = 'none';
                return;
            } else {
                flightsContainer.style.display = '';
            }

            const filter: Condition[] | undefined =
                this.cardState.config.filter ?
                    this.cardState.selectedFlights && this.cardState.selectedFlights.length > 0 ?
                        [
                            {
                                type: 'OR' as const,
                                conditions: [
                                    {
                                        field: 'id',
                                        comparator: 'oneOf' as const,
                                        value: this.cardState.selectedFlights
                                    },
                                    { type: 'AND' as const, conditions: this.cardState.config.filter }
                                ]
                            }
                        ]
                    :   this.cardState.config.filter
                :   undefined;
            const flightsTotal = this.cardState.flights.length;
            const flightsFiltered = filter ? applyFilter(this.cardState, filter) : this.cardState.flights;
            const flightsShown = flightsFiltered.length;

            flightsFiltered.sort(this.cardState.sortFn);
            if (this.cardState.radar.hide !== true) {
                requestAnimationFrame(() => {
                    try {
                        renderRadar(this.cardState);
                    } catch (e) {
                        console.error('[FR24Card] requestAnimationFrame renderRadar error:', e);
                    }
                });
            }

            if (this.cardState.list && this.cardState.list.showListStatus === true && flightsTotal > 0) {
                this.cardState.flightsContext = {
                    shown: flightsShown,
                    total: flightsTotal,
                    filtered: flightsFiltered.length
                };
                const listStatusDiv = document.createElement('div');
                listStatusDiv.className = 'list-status';
                listStatusDiv.innerHTML = parseTemplate(
                    this.cardState,
                    'list_status',
                    null,
                    (joinWith: string) =>
                        (...elements: (string | undefined)[]) =>
                            elements?.filter((e) => e).join(joinWith || ' ')
                );
                fragment.appendChild(listStatusDiv);
            }

            if (flightsShown === 0) {
                if (this.cardState.config.no_flights_message !== '') {
                    const noFlightsMessage = document.createElement('div');
                    noFlightsMessage.className = 'no-flights-message';
                    noFlightsMessage.textContent = this.cardState.config.no_flights_message || '';
                    fragment.appendChild(noFlightsMessage);
                }
            } else {
                const maxFlights = this.cardState.config.max_flights;
                const flightsToRender = maxFlights && maxFlights > 0 ? flightsFiltered.slice(0, maxFlights) : flightsFiltered;

                flightsToRender.forEach((flight, idx) => {
                    const flightElement = renderFlight(this.cardState, flight);
                    if (idx === 0) {
                        flightElement.className += ' first';
                    }
                    fragment.appendChild(flightElement);
                });
            }

            flightsContainer.innerHTML = '';
            flightsContainer.appendChild(fragment);
        } catch (e) {
            console.error('[FR24Card] renderDynamic error:', e);
        }
    }

    updateRadarRange(delta: number): void {
        try {
            const minRange = this.cardState.radar.min_range || 1;
            const maxRange = this.cardState.radar.max_range || Math.max(100, this.cardState.radar.initialRange || 35);
            let newRange = this.cardState.radar.range + delta;
            if (newRange < minRange) newRange = minRange;
            if (newRange > maxRange) newRange = maxRange;
            this.cardState.radar.range = newRange;
            this.updateCardDimensions();
            if (this.cardState.renderDynamicOnRangeChange && this.cardState.config.updateRangeFilterOnTouchEnd !== true) {
                this.renderDynamic();
            }
        } catch (e) {
            console.error('[FR24Card] updateRadarRange error:', e);
        }
    }

    subscribeToStateChanges(hass: Hass): Promise<() => void> {
        try {
            if (!this.cardState.config.test && this.cardState.config.update !== false) {
                return (hass.connection as HassConnection).subscribeEvents((event: { data: { entity_id: string } }) => {
                    try {
                        if (event.data.entity_id === this.cardState.config.flights_entity || event.data.entity_id === this.cardState.config.location_tracker) {
                            this._updateRequired = true;
                        }
                    } catch (e) {
                        console.error('[FR24Card] subscribeEvents callback error:', e);
                    }
                }, 'state_changed');
            }
        } catch (e) {
            console.error('[FR24Card] subscribeToStateChanges error:', e);
        }
        return Promise.resolve(() => {});
    }

    fetchFlightsData(): void {
        try {
            if (this._timer) {
                clearInterval(this._timer);
                this._timer = null;
            }
            const entityState = this.cardState.hass?.states[this.cardState.config.flights_entity || ''];
            if (entityState) {
                try {
                    this.cardState.flights =
                        parseFloat(entityState.state) > 0 && entityState.attributes.flights ? JSON.parse(JSON.stringify(entityState.attributes.flights)) : [];
                } catch (error) {
                    console.error('Error fetching or parsing flight data:', error);
                    this.cardState.flights = [];
                }
            } else {
                throw new Error('Flights entity state is undefined. Check the configuration.');
            }

            const { moving } = this.calculateFlightData();
            if (this.cardState.config.projection_interval) {
                if (moving && !this._timer) {
                    this._timer = setInterval(() => {
                        try {
                            if (this.cardState.hass) {
                                const { projected } = this.calculateFlightData();
                                if (projected) {
                                    this.renderDynamic();
                                }
                            }
                        } catch (e) {
                            console.error('[FR24Card] projectionInterval setInterval error:', e);
                        }
                    }, this.cardState.config.projection_interval * 1000);
                } else if (!moving && this._timer) {
                    clearInterval(this._timer);
                    this._timer = null;
                }
            }
        } catch (e) {
            console.error('[FR24Card] fetchFlightsData error:', e);
        }
    }

    calculateFlightData(): { projected: boolean; moving: boolean } {
        try {
            let projected = false;
            let moving = false;
            const currentTime = Date.now() / 1000;
            const location = getLocation(this.cardState);
            if (location) {
                const refLat = location.latitude;
                const refLon = location.longitude;

                this.cardState.flights.forEach((flight) => {
                    if (!(flight as ExtendedFlight)._timestamp) {
                        (flight as ExtendedFlight)._timestamp = currentTime;
                    }

                    moving = moving || flight.ground_speed > 0;

                    const timeElapsed = currentTime - ((flight as ExtendedFlight)._timestamp || currentTime);
                    if (timeElapsed > 1) {
                        projected = true;

                        (flight as ExtendedFlight)._timestamp = currentTime;

                        const newPosition = calculateNewPosition(
                            flight.latitude,
                            flight.longitude,
                            flight.heading,
                            ((flight.ground_speed * 1.852) / 3600) * timeElapsed
                        );

                        flight.latitude = newPosition.lat;
                        flight.longitude = newPosition.lon;
                        const newAltitude = Math.max(flight.altitude + (timeElapsed / 60) * flight.vertical_speed, 0);
                        if ((flight as ExtendedFlight).landed || (newAltitude !== flight.altitude && newAltitude === 0)) {
                            (flight as ExtendedFlight).landed = true;
                            flight.ground_speed = Math.max(flight.ground_speed - 15 * timeElapsed, 15);
                        }
                        flight.altitude = newAltitude;
                    }

                    flight.distance_to_tracker = haversine(refLat, refLon, flight.latitude, flight.longitude, this.cardState.units.distance);

                    flight.heading_from_tracker = calculateBearing(refLat, refLon, flight.latitude, flight.longitude);
                    flight.cardinal_direction_from_tracker = getCardinalDirection(flight.heading_from_tracker);
                    const heading_to_tracker = (flight.heading_from_tracker + 180) % 360;
                    flight.is_approaching = areHeadingsAligned(heading_to_tracker, flight.heading);
                    flight.is_receding = areHeadingsAligned(flight.heading_from_tracker, flight.heading);

                    if (flight.is_approaching) {
                        let closestPassingLatLon = calculateClosestPassingPoint(refLat, refLon, flight.latitude, flight.longitude, flight.heading);

                        flight.closest_passing_distance = Math.round(
                            haversine(refLat, refLon, closestPassingLatLon.lat, closestPassingLatLon.lon, this.cardState.units.distance)
                        );
                        const eta_to_closest_distance = this.calculateETA(
                            flight.latitude,
                            flight.longitude,
                            closestPassingLatLon.lat,
                            closestPassingLatLon.lon,
                            flight.ground_speed
                        );
                        flight.eta_to_closest_distance = Math.round(eta_to_closest_distance);

                        if (flight.vertical_speed < 0 && flight.altitude > 0) {
                            const timeToTouchdown = flight.altitude / Math.abs(flight.vertical_speed);
                            const touchdownLatLon = calculateNewPosition(
                                flight.latitude,
                                flight.longitude,
                                flight.heading,
                                (flight.ground_speed * timeToTouchdown) / 60
                            );
                            const touchdownDistance = haversine(refLat, refLon, touchdownLatLon.lat, touchdownLatLon.lon, this.cardState.units.distance);

                            if (timeToTouchdown < eta_to_closest_distance) {
                                (flight as ExtendedFlight).is_landing = true;
                                flight.closest_passing_distance = Math.round(touchdownDistance);
                                flight.eta_to_closest_distance = Math.round(timeToTouchdown);
                                closestPassingLatLon = touchdownLatLon;
                            }
                        }

                        flight.heading_from_tracker_to_closest_passing = Math.round(
                            calculateBearing(refLat, refLon, closestPassingLatLon.lat, closestPassingLatLon.lon)
                        );
                    } else {
                        delete flight.closest_passing_distance;
                        delete flight.eta_to_closest_distance;
                        delete flight.heading_from_tracker_to_closest_passing;
                        delete (flight as ExtendedFlight).is_landing;
                    }
                });
            } else {
                console.error('Tracker state is undefined. Make sure the location tracker entity ID is correct.');
            }

            return { projected, moving };
        } catch (e) {
            console.error('[FR24Card] calculateFlightData error:', e);
            return { projected: false, moving: false };
        }
    }

    calculateETA(fromLat: number, fromLon: number, toLat: number, toLon: number, groundSpeed: number): number {
        try {
            const distance = haversine(fromLat, fromLon, toLat, toLon, this.cardState.units.distance);
            if (groundSpeed === 0) {
                return Infinity;
            }
            const groundSpeedDistanceUnitsPrMin = (groundSpeed * (this.cardState.units.distance === 'km' ? 1.852 : 1.15078)) / 60;
            const eta = distance / groundSpeedDistanceUnitsPrMin;
            return eta;
        } catch (e) {
            console.error('[FR24Card] calculateETA error:', e);
            return Infinity;
        }
    }

    toggleSelectedFlight(flight: Flight): void {
        try {
            if (!this.cardState.selectedFlights) this.cardState.selectedFlights = [];
            if (!this.cardState.selectedFlights.includes(flight.id)) {
                this.cardState.selectedFlights.push(flight.id);
            } else {
                this.cardState.selectedFlights = this.cardState.selectedFlights.filter((id) => id !== flight.id);
            }
            this.renderDynamic();
        } catch (e) {
            console.error('[FR24Card] toggleSelectedFlight error:', e);
        }
    }

    get hass(): Hass | null {
        return this.cardState.hass;
    }
}

customElements.define('flightradar24-card', Flightradar24Card);
