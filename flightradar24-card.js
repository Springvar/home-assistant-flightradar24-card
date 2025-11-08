import { renderStatic } from './render/static.js';
import { renderFlag } from './render/flag.js';
import { renderRadarScreen } from './render/radarScreen.js';
import { renderRadar } from './render/radar.js';
import { haversine, calculateBearing, calculateNewPosition, calculateClosestPassingPoint, getCardinalDirection, areHeadingsAligned } from './utils/geometric.js';
import { applyFilter, applyConditions } from './utils/filter.js';
import { parseTemplate, resolvePlaceholders } from './utils/template.js';
import { setupZoomHandlers } from './utils/zoom.js';
import { getLocation } from './utils/location.js';
import { ensureLeafletLoadedIfNeeded } from './render/map.js';
import { Flightradar24CardState } from './flightradar24-card-state.js';

class Flightradar24Card extends HTMLElement {
    _radarResizeObserver;
    _zoomCleanup;
    _updateRequired = true;
    _timer = null;

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.cardState = new Flightradar24CardState();
        this.cardState.setRenderDynamic(() => this.renderDynamic());
    }

    setConfig(config) {
        if (!config) throw new Error('Configuration is missing.');
        this.cardState.setConfig(config);
        renderStatic(this.cardState, this);
        this.observeRadarResize();
    }

    set hass(hass) {
        this.cardState.hass = hass;
        this.subscribeToStateChanges(hass);
        if (this._updateRequired) {
            this._updateRequired = false;
            this.fetchFlightsData();
            this.updateCardDimensions();
            ensureLeafletLoadedIfNeeded(this.cardState, this.shadowRoot, () => {
                renderRadarScreen(this.cardState);
                renderRadar(this.cardState);
            });
            this.renderDynamic();
        }
    }

    connectedCallback() {
        this.observeRadarResize();
    }

    disconnectedCallback() {
        if (this._radarResizeObserver) {
            this._radarResizeObserver.disconnect();
            this._radarResizeObserver = null;
        }
        if (this.cardState._leafletMap && this.cardState._leafletMap.remove) {
            this.cardState._leafletMap.remove();
            this.cardState._leafletMap = null;
        }
        if (this._zoomCleanup) {
            this._zoomCleanup();
            this._zoomCleanup = null;
        }
    }

    updateCardDimensions() {
        const radarElem = this.shadowRoot.getElementById('radar');
        const width = radarElem?.clientWidth || 400;
        const height = radarElem?.clientHeight || 400;
        const range = this.cardState.radar.range;
        const scaleFactor = width / (range * 2);
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

    observeRadarResize() {
        const radar = this.shadowRoot.getElementById('radar');
        if (!radar) return;
        if (this._radarResizeObserver) this._radarResizeObserver.disconnect();
        this._radarResizeObserver = new ResizeObserver(() => {
            this.updateCardDimensions();
        });
        this._radarResizeObserver.observe(radar);
        const radarOverlay = this.shadowRoot.getElementById('radar-overlay');
        if (this._zoomCleanup) this._zoomCleanup();
        this._zoomCleanup = setupZoomHandlers(this.cardState, radarOverlay);
    }

    renderDynamic() {
        const flightsContainer = this.shadowRoot.getElementById('flights');
        if (!flightsContainer) return;
        flightsContainer.innerHTML = '';

        if (this.cardState.list && this.cardState.list.hide === true) {
            flightsContainer.style.display = 'none';
            return;
        } else {
            flightsContainer.style.display = '';
        }

        const filter = this.cardState.config.filter
            ? this.cardState.selectedFlights && this.cardState.selectedFlights.length > 0
                ? [
                      {
                          type: 'OR',
                          conditions: [
                              {
                                  field: 'id',
                                  comparator: 'oneOf',
                                  value: this.cardState.selectedFlights
                              },
                              { type: 'AND', conditions: this.cardState.config.filter }
                          ]
                      }
                  ]
                : this.cardState.config.filter
            : undefined;

        const flightsTotal = this.cardState.flights.length;
        const flightsFiltered = filter ? applyFilter(this.cardState, filter) : this.cardState.flights;
        const flightsShown = flightsFiltered.length;

        flightsFiltered.sort(this.cardState.sortFn);

        if (this.cardState.radar.hide !== true) {
            requestAnimationFrame(() => {
                renderRadar(this.cardState);
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
                (joinWith) =>
                    (...elements) =>
                        elements?.filter((e) => e).join(joinWith || ' ')
            );
            flightsContainer.appendChild(listStatusDiv);
        }

        if (flightsShown === 0) {
            if (this.cardState.config.no_flights_message !== '') {
                const noFlightsMessage = document.createElement('div');
                noFlightsMessage.className = 'no-flights-message';
                noFlightsMessage.textContent = this.cardState.config.no_flights_message;
                flightsContainer.appendChild(noFlightsMessage);
            }
        } else {
            flightsFiltered.forEach((flight, idx) => {
                const flightElement = this.renderFlight(flight);
                if (idx === 0) {
                    flightElement.className += ' first';
                }
                flightsContainer.appendChild(flightElement);
            });
        }
    }

    updateRadarRange(delta) {
        const minRange = this.cardState.radar.min_range || 1;
        const maxRange = this.cardState.radar.max_range || Math.max(100, this.cardState.radar.initialRange);
        let newRange = this.cardState.radar.range + delta;
        if (newRange < minRange) newRange = minRange;
        if (newRange > maxRange) newRange = maxRange;
        this.cardState.radar.range = newRange;
        this.updateCardDimensions();
        if (this.cardState.renderDynamicOnRangeChange && this.cardState.config.updateRangeFilterOnTouchEnd !== true) {
            this.renderDynamic();
        }
    }

    renderFlight(_flight) {
        const flight = Object.assign({}, _flight);
        [
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
        ].forEach((field) => (flight[field] = this.flightField(flight, field)));
        flight.origin_flag = flight.airport_origin_country_code ? renderFlag(flight.airport_origin_country_code, flight.airport_origin_country_name).outerHTML : '';
        flight.destination_flag = flight.airport_destination_country_code
            ? renderFlag(flight.airport_destination_country_code, flight.airport_destination_country_name).outerHTML
            : '';

        flight.climb_descend_indicator = Math.abs(flight.vertical_speed) > 100 ? (flight.vertical_speed > 100 ? '↑' : '↓') : '';
        flight.alt_in_unit =
            flight.altitude >= 17750
                ? `FL${Math.round(flight.altitude / 1000) * 10}`
                : flight.altitude > 0
                ? this.cardState.units.altitude === 'm'
                    ? `${Math.round(flight.altitude * 0.3048)} m`
                    : `${Math.round(flight.altitude)} ft`
                : undefined;

        flight.spd_in_unit =
            flight.ground_speed > 0
                ? this.cardState.units.speed === 'kmh'
                    ? `${Math.round(flight.ground_speed * 1.852)} km/h`
                    : this.cardState.units.speed === 'mph'
                    ? `${Math.round(flight.ground_speed * 1.15078)} mph`
                    : `${Math.round(flight.ground_speed)} kts`
                : undefined;

        flight.approach_indicator = flight.ground_speed > 70 ? (flight.is_approaching ? '↓' : flight.is_receding ? '↑' : '') : '';
        flight.dist_in_unit = `${Math.round(flight.distance_to_tracker)} ${this.cardState.units.distance}`;
        flight.direction_info = `${Math.round(flight.heading_from_tracker)}° ${flight.cardinal_direction_from_tracker}`;

        const flightElement = document.createElement('div');
        flightElement.style.clear = 'both';
        flightElement.className = 'flight';

        if (this.cardState.selectedFlights && this.cardState.selectedFlights.includes(flight.id)) {
            flightElement.className += ' selected';
        }

        flightElement.innerHTML = parseTemplate(
            this.cardState,
            'flight_element',
            flight,
            (joinWith) =>
                (...elements) =>
                    elements?.filter((e) => e).join(joinWith || ' ')
        );
        flightElement.addEventListener('click', () => this.cardState.toggleSelectedFlight(flight));

        return flightElement;
    }

    flightField(flight, field) {
        let text = flight[field];
        if (this.cardState.config.annotate) {
            const f = Object.assign({}, flight);
            this.cardState.config.annotate
                .filter((a) => a.field === field)
                .forEach((a) => {
                    if (
                        applyConditions(flight, a.conditions, (value, defaultValue) =>
                            resolvePlaceholders(value, this.cardState.defines, this.cardState.config, this.cardState.radar, this.cardState.selectedFlights, defaultValue, (v) => {
                                this.cardState.renderDynamicOnRangeChange = v;
                            })
                        )
                    ) {
                        f[field] = a.render.replace(/\$\{([^}]*)\}/g, (_, p1) => f[p1]);
                    }
                });
            text = f[field];
        }
        return text;
    }

    subscribeToStateChanges(hass) {
        if (!this.cardState.config.test && this.cardState.config.update !== false) {
            hass.connection.subscribeEvents((event) => {
                if (event.data.entity_id === this.cardState.config.flights_entity || event.data.entity_id === this.cardState.config.location_tracker) {
                    this._updateRequired = true;
                }
            }, 'state_changed');
        }
    }

    fetchFlightsData() {
        this._timer = clearInterval(this._timer);
        const entityState = this.cardState.hass.states[this.cardState.config.flights_entity];
        if (entityState) {
            try {
                this.cardState.flights = parseFloat(entityState.state) > 0 && entityState.attributes.flights ? JSON.parse(JSON.stringify(entityState.attributes.flights)) : [];
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
                clearInterval(this._timer);
                this._timer = setInterval(() => {
                    if (this.cardState.hass) {
                        const { projected } = this.calculateFlightData();
                        if (projected) {
                            this.renderDynamic();
                        }
                    }
                }, this.cardState.config.projection_interval * 1000);
            } else if (!moving) {
                clearInterval(this._timer);
            }
        }
    }

    calculateFlightData() {
        let projected = false;
        let moving = false;
        const currentTime = Date.now() / 1000;
        const location = getLocation(this.cardState);
        if (location) {
            const refLat = location.latitude;
            const refLon = location.longitude;

            this.cardState.flights.forEach((flight) => {
                if (!flight._timestamp) {
                    flight._timestamp = currentTime;
                }

                moving = moving || flight.ground_speed > 0;

                const timeElapsed = currentTime - flight._timestamp;
                if (timeElapsed > 1) {
                    projected = true;

                    flight._timestamp = currentTime;

                    const newPosition = calculateNewPosition(flight.latitude, flight.longitude, flight.heading, ((flight.ground_speed * 1.852) / 3600) * timeElapsed);

                    flight.latitude = newPosition.lat;
                    flight.longitude = newPosition.lon;
                    const newAltitude = Math.max(flight.altitude + (timeElapsed / 60) * flight.vertical_speed, 0);
                    if (flight.landed || (newAltitude !== flight.altitude && newAltitude === 0)) {
                        flight.landed = true;
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

                    flight.closest_passing_distance = Math.round(haversine(refLat, refLon, closestPassingLatLon.lat, closestPassingLatLon.lon, this.cardState.units.distance));
                    const eta_to_closest_distance = this.calculateETA(flight.latitude, flight.longitude, closestPassingLatLon.lat, closestPassingLatLon.lon, flight.ground_speed);
                    flight.eta_to_closest_distance = Math.round(eta_to_closest_distance);

                    if (flight.vertical_speed < 0 && flight.altitude > 0) {
                        const timeToTouchdown = flight.altitude / Math.abs(flight.vertical_speed);
                        const touchdownLatLon = calculateNewPosition(flight.latitude, flight.longitude, flight.heading, (flight.ground_speed * timeToTouchdown) / 60);
                        const touchdownDistance = haversine(refLat, refLon, touchdownLatLon.lat, touchdownLatLon.lon, this.cardState.units.distance);

                        if (timeToTouchdown < eta_to_closest_distance) {
                            flight.is_landing = true;
                            flight.closest_passing_distance = Math.round(touchdownDistance);
                            flight.eta_to_closest_distance = Math.round(timeToTouchdown);
                            closestPassingLatLon = touchdownLatLon;
                        }
                    }

                    flight.heading_from_tracker_to_closest_passing = Math.round(calculateBearing(refLat, refLon, closestPassingLatLon.lat, closestPassingLatLon.lon));
                } else {
                    delete flight.closest_passing_distance;
                    delete flight.eta_to_closest_distance;
                    delete flight.heading_from_tracker_to_closest_passing;
                    delete flight.is_landing;
                }
            });
        } else {
            console.error('Tracker state is undefined. Make sure the location tracker entity ID is correct.');
        }

        return { projected, moving };
    }

    calculateETA(fromLat, fromLon, toLat, toLon, groundSpeed) {
        const distance = haversine(fromLat, fromLon, toLat, toLon, this.cardState.units.distance);
        if (groundSpeed === 0) {
            return Infinity;
        }

        const groundSpeedDistanceUnitsPrMin = (groundSpeed * (this.cardState.units.distance === 'km' ? 1.852 : 1.15078)) / 60;
        const eta = distance / groundSpeedDistanceUnitsPrMin;
        return eta;
    }

    toggleSelectedFlight(flight) {
        if (!this.cardState.selectedFlights) this.cardState.selectedFlights = [];
        if (!this.cardState.selectedFlights.includes(flight.id)) {
            this.cardState.selectedFlights.push(flight.id);
        } else {
            this.cardState.selectedFlights = this.cardState.selectedFlights.filter((id) => id !== flight.id);
        }
        this.renderDynamic();
    }

    get hass() {
        return this.cardState.hass;
    }
}

customElements.define('flightradar24-card', Flightradar24Card);
