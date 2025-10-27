import { unitsConfig } from "./config/unitsConfig.js";
import { templateConfig } from "./config/templateConfig.js";
import { sortConfig } from "./config/sortConfig.js";
import { renderStatic } from "./render/static.js";
import { renderFlag } from "./render/flag.js";
import {
  haversine,
  calculateBearing,
  calculateNewPosition,
  calculateClosestPassingPoint,
  getCardinalDirection,
  areHeadingsAligned,
} from "./utils/geometric.js";
import { applyFilter, applyConditions } from "./utils/filter.js";
import { getSortFn } from "./utils/sort.js";

class Flightradar24Card extends HTMLElement {
  _hass;
  _flightsData = [];
  _updateRequired = true;
  radarConfig = undefined;
  _radarResizeObserver;
  _leafletMap;

  constructor() {
    super();

    this.attachShadow({ mode: "open" });
    this._updateRequired = true;
    this._flightsData = [];
    this.config = null;
    this._hass = null;
  }

  setConfig(config) {
    if (!config) {
      throw new Error("Configuration is missing.");
    }
    this.config = Object.assign({}, config);
    this.config.flights_entity =
      config.flights_entity ?? "sensor.flightradar24_current_in_area";
    this.config.projection_interval = config.projection_interval ?? 5;
    this.config.no_flights_message =
      config.no_flights_message ??
      "No flights are currently visible. Please check back later.";

    this.list = Object.assign({ hide: false }, config.list);
    this.units = Object.assign({}, unitsConfig, config.units);
    this.radar = Object.assign(
      {
        range: this.units.distance === "km" ? 35 : 25,
        background_map: config.radar?.background_map || "none",
        background_map_opacity: config.radar?.background_map_opacity || 1,
        background_map_api_key: config.radar?.background_map_api_key || "",
      },
      config.radar
    );
    this.radar.initialRange = this.radar.range;
    this.defines = Object.assign({}, config.defines);
    this.sortFn = getSortFn(
      config.sort ?? sortConfig,
      this.resolvePlaceholders.bind(this)
    );
    this.templates = Object.assign({}, templateConfig, config.templates);

    renderStatic(this);
    this.observeRadarResize();
  }

  set hass(hass) {
    const oldHass = this._hass;
    this._hass = hass;

    if (!oldHass) {
      this.subscribeToStateChanges(hass);
    }

    if (this._updateRequired) {
      this._updateRequired = false;
      this.fetchFlightsData();
      this.renderRadarScreen();
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
    if (this._leafletMap && this._leafletMap.remove) {
      this._leafletMap.remove();
      this._leafletMap = null;
    }
  }

  observeRadarResize() {
    const radar = this.shadowRoot.getElementById("radar");
    if (!radar) return;

    if (this._radarResizeObserver) {
      this._radarResizeObserver.disconnect();
    }
    this._radarResizeObserver = new ResizeObserver(() => {
      this.renderRadarScreen();
      this.renderRadar(this._flightsData);
    });
    this._radarResizeObserver.observe(radar);
  }

  renderDynamic() {
    const flightsContainer = this.shadowRoot.getElementById("flights");
    if (!flightsContainer) return;
    flightsContainer.innerHTML = "";

    if (this.list && this.list.hide === true) {
      flightsContainer.style.display = "none";
      return;
    } else {
      flightsContainer.style.display = "";
    }

    const filter = this.config.filter
      ? this._selectedFlights && this._selectedFlights.length > 0
        ? [
            {
              type: "OR",
              conditions: [
                {
                  field: "id",
                  comparator: "oneOf",
                  value: this._selectedFlights,
                },
                { type: "AND", conditions: this.config.filter },
              ],
            },
          ]
        : this.config.filter
      : undefined;

    const flightsTotal = this._flightsData.length;
    const flightsFiltered = filter
      ? applyFilter(
          this._flightsData,
          filter,
          this.resolvePlaceholders.bind(this)
        )
      : this._flightsData;
    const flightsShown = flightsFiltered.length;

    flightsFiltered.sort(this.sortFn);

    if (this.radar.hide !== true) {
      requestAnimationFrame(() => {
        this.renderRadar(
          this.radar.filter === true
            ? flightsFiltered
            : this.radar.filter && typeof this.radar.filter === "object"
            ? applyFilter(
                this._flightsData,
                this.radar.filter,
                this.resolvePlaceholders.bind(this)
              )
            : this._flightsData
        );
      });
    }

    if (this.list && this.list.showListStatus === true) {
      this.flightsContext = {
        shown: flightsShown,
        total: flightsTotal,
        filtered: flightsFiltered.length,
      };
      const listStatusDiv = document.createElement("div");
      listStatusDiv.className = "list-status";
      listStatusDiv.innerHTML = this.parseTemplate("list_status");
      flightsContainer.appendChild(listStatusDiv);
    }

    if (flightsShown === 0) {
      if (this.config.no_flights_message !== "") {
        const noFlightsMessage = document.createElement("div");
        noFlightsMessage.className = "no-flights-message";
        noFlightsMessage.textContent = this.config.no_flights_message;
        flightsContainer.appendChild(noFlightsMessage);
      }
    } else {
      flightsFiltered.forEach((flight, idx) => {
        const flightElement = this.renderFlight(flight);
        if (idx === 0) {
          flightElement.className += " first";
        }
        flightsContainer.appendChild(flightElement);
      });
    }
  }

  renderRadarScreen() {
    const radarInfoDisplay = this.shadowRoot.getElementById("radar-info");
    if (radarInfoDisplay) {
      const infoElements = [
        this.config.radar?.hide_range !== true
          ? this.parseTemplate("radar_range")
          : "",
      ].filter((el) => el);
      radarInfoDisplay.innerHTML = infoElements.join("<br />");
    }

    const radarScreen = this.shadowRoot.getElementById("radar-screen");
    if (radarScreen) {
      radarScreen.innerHTML = "";

      const TILE_LAYERS = {
        bw: [
          "https://tiles.stadiamaps.com/tiles/stamen_toner/{z}/{x}/{y}.png",
          {
            api_key: "?api_key=",
            attribution:
              "Map tiles by Stamen Design, CC BY 3.0 — Map data © OpenStreetMap",
            subdomains: [],
          },
        ],
        color: [
          "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
          {
            attribution: "&copy; OpenStreetMap contributors",
            subdomains: ["a", "b", "c"],
          },
        ],
        dark: [
          "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
          { attribution: "&copy; CartoDB" },
        ],
        outlines: [
          "https://tiles.stadiamaps.com/tiles/stamen_toner_lines/{z}/{x}/{y}.png",
          {
            api_key: "?api_key=",
            attribution:
              "Map tiles by Stamen Design, hosted by Stadia Maps; Data by OpenStreetMap",
            subdomains: [],
          },
        ],
      };

      if (
        window.L &&
        this.radar.background_map &&
        Object.keys(TILE_LAYERS).includes(this.radar.background_map)
      ) {
        if (this._leafletMap && this._leafletMap.remove) {
          this._leafletMap.remove();
        }
        const mapBg = document.createElement("div");
        mapBg.id = "radar-map-bg";
        mapBg.style.position = "absolute";
        mapBg.style.top = "0";
        mapBg.style.left = "0";
        mapBg.style.width = "100%";
        mapBg.style.height = "100%";
        mapBg.style.zIndex = "0";
        mapBg.style.pointerEvents = "none";
        let opacity = 1;
        if (
          this.radar.background_map_opacity !== undefined &&
          typeof this.radar.background_map_opacity === "number"
        ) {
          opacity = Math.max(0, Math.min(1, this.radar.background_map_opacity));
        }
        mapBg.style.opacity = opacity;
        radarScreen.appendChild(mapBg);

        let range = Math.max(this.radar.range, 1);
        let zoom = 10 + Math.floor(Math.log2(35 / range));
        const location = this.getLocation();

        const type = this.radar.background_map || "bw";
        let [tileUrl, tileOpts] = TILE_LAYERS[type] || TILE_LAYERS.bw;

        if ("api_key" in tileOpts && this.radar.background_map_api_key) {
          tileUrl =
            tileUrl +
            tileOpts["api_key"] +
            encodeURIComponent(this.radar.background_map_api_key);
        }

        setTimeout(() => {
          this._leafletMap = window.L.map(mapBg, {
            center: [location.latitude, location.longitude],
            zoom: zoom,
            attributionControl: false,
            zoomControl: false,
            dragging: false,
            scrollWheelZoom: false,
            boxZoom: false,
            doubleClickZoom: false,
            keyboard: false,
            touchZoom: false,
            pointerEvents: false,
          });
          window.L.tileLayer(tileUrl, tileOpts).addTo(this._leafletMap);
        }, 0);
      } else {
        const radarScreenBackground = document.createElement('div');
        radarScreenBackground.id = 'radar-screen-background';
        radarScreen.appendChild(radarScreenBackground);
      }

      const radarWidth = this.shadowRoot.getElementById("radar").clientWidth;
      const radarHeight = this.shadowRoot.getElementById("radar").clientHeight;
      const radarRange = this.radar.range;

      const scaleFactor = radarWidth / (radarRange * 2);
      const clippingRange = radarRange * 1.15;

      const radarCenterX = radarWidth / 2;
      const radarCenterY = radarHeight / 2;

      const ringDistance = this.radar.ring_distance ?? 10;
      const ringCount = Math.floor(radarRange / ringDistance);

      for (let i = 1; i <= ringCount; i++) {
        const radius = i * ringDistance * scaleFactor;
        const ring = document.createElement("div");
        ring.className = "ring";
        ring.style.width = ring.style.height = radius * 2 + "px";
        ring.style.top = Math.floor(radarCenterY - radius) + "px";
        ring.style.left = Math.floor(radarCenterX - radius) + "px";
        radarScreen.appendChild(ring);
      }
      for (let angle = 0; angle < 360; angle += 45) {
        const line = document.createElement("div");
        line.className = "dotted-line";
        line.style.transform = `rotate(${angle - 90}deg)`;
        radarScreen.appendChild(line);
      }

      if (this.radar.local_features && this.hass) {
        const location = this.getLocation();
        if (location) {
          const refLat = location.latitude;
          const refLon = location.longitude;

          this.radar.local_features.forEach((feature) => {
            if (
              feature.max_range !== undefined &&
              feature.max_range <= this.radar.range
            )
              return;
            if (
              feature.type === "outline" &&
              feature.points &&
              feature.points.length > 1
            ) {
              for (let i = 0; i < feature.points.length - 1; i++) {
                const start = feature.points[i];
                const end = feature.points[i + 1];
                const startDistance = haversine(
                  refLat,
                  refLon,
                  start.lat,
                  start.lon,
                  this.units.distance
                );
                const endDistance = haversine(
                  refLat,
                  refLon,
                  end.lat,
                  end.lon,
                  this.units.distance
                );
                if (
                  startDistance <= clippingRange ||
                  endDistance <= clippingRange
                ) {
                  const startBearing = calculateBearing(
                    refLat,
                    refLon,
                    start.lat,
                    start.lon
                  );
                  const endBearing = calculateBearing(
                    refLat,
                    refLon,
                    end.lat,
                    end.lon
                  );

                  const startX =
                    radarCenterX +
                    Math.cos(((startBearing - 90) * Math.PI) / 180) *
                      startDistance *
                      scaleFactor;
                  const startY =
                    radarCenterY +
                    Math.sin(((startBearing - 90) * Math.PI) / 180) *
                      startDistance *
                      scaleFactor;
                  const endX =
                    radarCenterX +
                    Math.cos(((endBearing - 90) * Math.PI) / 180) *
                      endDistance *
                      scaleFactor;
                  const endY =
                    radarCenterY +
                    Math.sin(((endBearing - 90) * Math.PI) / 180) *
                      endDistance *
                      scaleFactor;

                  const outlineLine = document.createElement("div");
                  outlineLine.className = "outline-line";
                  outlineLine.style.width =
                    Math.hypot(endX - startX, endY - startY) + "px";
                  outlineLine.style.height = "1px";
                  outlineLine.style.top = startY + "px";
                  outlineLine.style.left = startX + "px";
                  outlineLine.style.transformOrigin = "0 0";
                  outlineLine.style.transform = `rotate(${
                    Math.atan2(endY - startY, endX - startX) * (180 / Math.PI)
                  }deg)`;

                  radarScreen.appendChild(outlineLine);
                }
              }
            } else {
              const { lat: featLat, lon: featLon } = feature.position;

              const distance = haversine(
                refLat,
                refLon,
                featLat,
                featLon,
                this.units.distance
              );

              if (distance <= clippingRange) {
                const bearing = calculateBearing(
                  refLat,
                  refLon,
                  featLat,
                  featLon
                );

                const featureX =
                  radarCenterX +
                  Math.cos(((bearing - 90) * Math.PI) / 180) *
                    distance *
                    scaleFactor;
                const featureY =
                  radarCenterY +
                  Math.sin(((bearing - 90) * Math.PI) / 180) *
                    distance *
                    scaleFactor;

                if (feature.type === "runway") {
                  const heading = feature.heading;
                  const lengthFeet = feature.length;

                  const lengthUnit =
                    this.units.distance === "km"
                      ? lengthFeet * 0.0003048
                      : lengthFeet * 0.00018939;

                  const runway = document.createElement("div");
                  runway.className = "runway";
                  runway.style.width = lengthUnit * scaleFactor + "px";
                  runway.style.height = "1px";
                  runway.style.top = featureY + "px";
                  runway.style.left = featureX + "px";
                  runway.style.transformOrigin = "0 50%";
                  runway.style.transform = `rotate(${heading - 90}deg)`;

                  radarScreen.appendChild(runway);
                }
                if (feature.type === "location") {
                  const locationDot = document.createElement("div");
                  locationDot.className = "location-dot";
                  locationDot.title = feature.label ?? "Location";
                  locationDot.style.top = featureY + "px";
                  locationDot.style.left = featureX + "px";
                  radarScreen.appendChild(locationDot);

                  if (feature.label) {
                    const label = document.createElement("div");
                    label.className = "location-label";
                    label.textContent = feature.label || "Location";
                    radarScreen.appendChild(label);

                    const labelRect = label.getBoundingClientRect();
                    const labelWidth = labelRect.width;
                    const labelHeight = labelRect.height;

                    label.style.top = featureY - labelHeight - 4 + "px";
                    label.style.left = featureX - labelWidth / 2 + "px";
                  }
                }
              }
            }
          });
        }
      }
    }
  }

  renderRadar(flightsData) {
    const planesContainer = this.shadowRoot.getElementById("planes");
    planesContainer.innerHTML = "";

    const radar = this.shadowRoot.getElementById("radar");
    if (radar) {
      const radarWidth = radar.clientWidth;
      const radarHeight = radar.clientHeight;
      const radarRange = this.radar.range;

      const scaleFactor = radarWidth / (radarRange * 2);
      const clippingRange = radarRange * 1.15;

      const radarCenterX = radarWidth / 2;
      const radarCenterY = radarHeight / 2;

      flightsData
        .slice()
        .reverse()
        .forEach((flight) => {
          const distance = flight.distance_to_tracker;

          if (distance <= clippingRange) {
            const plane = document.createElement("div");
            plane.className = "plane";

            const x =
              radarCenterX +
              Math.cos(((flight.heading_from_tracker - 90) * Math.PI) / 180) *
                distance *
                scaleFactor;
            const y =
              radarCenterY +
              Math.sin(((flight.heading_from_tracker - 90) * Math.PI) / 180) *
                distance *
                scaleFactor;

            plane.style.top = y + "px";
            plane.style.left = x + "px";

            const arrow = document.createElement("div");
            arrow.className = "arrow";

            arrow.style.transform = `rotate(${flight.heading}deg)`;

            plane.appendChild(arrow);

            const label = document.createElement("div");
            label.className = "callsign-label";
            label.textContent =
              flight.callsign ?? flight.aircraft_registration ?? "n/a";

            planesContainer.appendChild(label);

            const labelRect = label.getBoundingClientRect();
            const labelWidth = labelRect.width + 3;
            const labelHeight = labelRect.height + 6;

            label.style.top = y - labelHeight + "px";
            label.style.left = x - labelWidth + "px";

            if (flight.altitude <= 0) {
              plane.classList.add("plane-small");
            } else {
              plane.classList.add("plane-medium");
            }
            if (
              this._selectedFlights &&
              this._selectedFlights.includes(flight.id)
            ) {
              plane.classList.add("selected");
            }

            plane.addEventListener("click", () =>
              this.toggleSelectedFlight(flight)
            );
            label.addEventListener("click", () =>
              this.toggleSelectedFlight(flight)
            );

            planesContainer.appendChild(plane);
          }
        });
    }
  }

  updateRadarRange(delta) {
    const minRange = this.radar.min_range || 1;
    const maxRange =
      this.radar.max_range || Math.max(100, this.radar.initialRange);
    let newRange = this.radar.range + delta;

    if (newRange < minRange) newRange = minRange;
    if (newRange > maxRange) newRange = maxRange;

    this.radar.range = newRange;

    this.renderRadarScreen();

    if (
      this.renderDynamicOnRangeChange &&
      this.config.updateRangeFilterOnTouchEnd !== true
    ) {
      this.renderDynamic();
    } else {
      this.renderRadar(
        this.radar.filter === true
          ? applyFilter(
              this._flightsData,
              this.config.filter,
              this.resolvePlaceholders.bind(this)
            )
          : this.radar.filter && typeof this.radar.filter === "object"
          ? applyFilter(
              this._flightsData,
              this.radar.filter,
              this.resolvePlaceholders.bind(this)
            )
          : this._flightsData
      );
    }
  }

  renderFlight(_flight) {
    const flight = Object.assign({}, _flight);
    [
      "flight_number",
      "callsign",
      "aircraft_registration",
      "aircraft_model",
      "aircraft_model",
      "aircraft_code",
      "airline",
      "airline_short",
      "airline_iata",
      "airline_icao",
      "airport_origin_name",
      "airport_origin_code_iata",
      "airport_origin_code_icao",
      "airport_origin_country_name",
      "airport_origin_country_code",
      "airport_destination_name",
      "airport_destination_code_iata",
      "airport_destination_code_icao",
      "airport_destination_country_name",
      "airport_destination_country_code",
    ].forEach((field) => (flight[field] = this.flightField(flight, field)));
    flight.origin_flag = flight.airport_origin_country_code
      ? renderFlag(
          flight.airport_origin_country_code,
          flight.airport_origin_country_name
        ).outerHTML
      : "";
    flight.destination_flag = flight.airport_destination_country_code
      ? renderFlag(
          flight.airport_destination_country_code,
          flight.airport_destination_country_name
        ).outerHTML
      : "";

    flight.climb_descend_indicator =
      Math.abs(flight.vertical_speed) > 100
        ? flight.vertical_speed > 100
          ? "↑"
          : "↓"
        : "";
    flight.alt_in_unit =
      flight.altitude >= 17750
        ? `FL${Math.round(flight.altitude / 1000) * 10}`
        : flight.altitude > 0
        ? this.units.altitude === "m"
          ? `${Math.round(flight.altitude * 0.3048)} m`
          : `${Math.round(flight.altitude)} ft`
        : undefined;

    flight.spd_in_unit =
      flight.ground_speed > 0
        ? this.units.speed === "kmh"
          ? `${Math.round(flight.ground_speed * 1.852)} km/h`
          : this.units.speed === "mph"
          ? `${Math.round(flight.ground_speed * 1.15078)} mph`
          : `${Math.round(flight.ground_speed)} kts`
        : undefined;

    flight.approach_indicator =
      flight.ground_speed > 70
        ? flight.is_approaching
          ? "↓"
          : flight.is_receding
          ? "↑"
          : ""
        : "";
    flight.dist_in_unit = `${Math.round(flight.distance_to_tracker)} ${
      this.units.distance
    }`;
    flight.direction_info = `${Math.round(flight.heading_from_tracker)}° ${
      flight.cardinal_direction_from_tracker
    }`;

    const flightElement = document.createElement("div");
    flightElement.style.clear = "both";
    flightElement.className = "flight";

    if (this._selectedFlights && this._selectedFlights.includes(flight.id)) {
      flightElement.className += " selected";
    }

    flightElement.innerHTML = this.parseTemplate("flight_element", flight);
    flightElement.addEventListener("click", () =>
      this.toggleSelectedFlight(flight)
    );

    return flightElement;
  }

  flightField(flight, field) {
    let text = flight[field];
    if (this.config.annotate) {
      const f = Object.assign({}, flight);
      this.config.annotate
        .filter((a) => a.field === field)
        .forEach((a) => {
          if (
            applyConditions(
              flight,
              a.conditions,
              this.resolvePlaceholders.bind(this)
            )
          ) {
            f[field] = a.render.replace(/\$\{([^}]*)\}/g, (_, p1) => f[p1]);
          }
        });
      text = f[field];
    }
    return text;
  }

  compileTemplate(templates, templateId, trace = []) {
    if (trace.includes(templateId)) {
      console.error(
        "Circular template dependencies detected. " +
          trace.join(" -> ") +
          " -> " +
          templateId
      );
      return "";
    }

    if (templates["compiled_" + templateId]) {
      return templates["compiled_" + templateId];
    }

    let template = templates[templateId];
    if (template === undefined) {
      console.error("Missing template reference: " + templateId);
      return "";
    }

    const tplRegex = /tpl\.([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
    let tplMatch;
    const compiledTemplates = {};

    while ((tplMatch = tplRegex.exec(template)) !== null) {
      const innerTemplateId = tplMatch[1];
      if (!compiledTemplates[innerTemplateId]) {
        compiledTemplates[innerTemplateId] = this.compileTemplate(
          templates,
          innerTemplateId,
          [...trace, templateId]
        );
      }
      template = template.replace(
        `tpl.${innerTemplateId}`,
        "(`" +
          compiledTemplates[innerTemplateId] +
          '`).replace(/^undefined$/, "")'
      );
    }

    templates["compiled_" + templateId] = template;

    return template;
  }

  parseTemplate(templateId, flight) {
    const joinList =
      (joinWith) =>
      (...elements) =>
        elements?.filter((e) => e).join(joinWith || " ");
    const compiledTemplate = this.compileTemplate(this.templates, templateId);
    try {
      let context = flight;
      const parsedTemplate = new Function(
        "flights",
        "flight",
        "tpl",
        "units",
        "radar_range",
        "joinList",
        `return \`${compiledTemplate.replace(
          /\${(.*?)}/g,
          (_, expr) => `\${${expr}}`
        )}\``
      )(
        this.flightsContext,
        context,
        {},
        this.units,
        Math.round(this.radar.range),
        joinList
      );
      return parsedTemplate !== "undefined" ? parsedTemplate : "";
    } catch (e) {
      console.error("Error when rendering: " + compiledTemplate, e);
      return "";
    }
  }

  resolvePlaceholders(value, defaultValue) {
    if (
      typeof value === "string" &&
      value.startsWith("${") &&
      value.endsWith("}")
    ) {
      const key = value.slice(2, -1);
      if (key === "selectedFlights") {
        return this._selectedFlights;
      } else if (key === "radar_range") {
        this.renderDynamicOnRangeChange = true;
        return this.radar.range;
      } else if (key in this.defines) {
        return this.defines[key];
      } else if (key in this.config.toggles) {
        return this.config.toggles[key].default;
      } else {
        if (defaultValue !== undefined) {
          return defaultValue;
        } else {
          console.error("Unresolved placeholder: " + key);
          console.debug("Defines", this.defines);
        }
      }
    }

    return value;
  }

  getLocation() {
    if (
      this.config.location_tracker &&
      this.config.location_tracker in this._hass.states
    ) {
      return this._hass.states[this.config.location_tracker].attributes;
    } else if (this.config.location) {
      return {
        latitude: this.config.location.lat,
        longitude: this.config.location.lon,
      };
    } else {
      return {
        latitude: this._hass.config.latitude,
        longitude: this._hass.config.longitude,
      };
    }
  }

  subscribeToStateChanges(hass) {
    if (!this.config.test && this.config.update !== false) {
      hass.connection.subscribeEvents((event) => {
        if (
          event.data.entity_id === this.config.flights_entity ||
          event.data.entity_id === this.config.location_tracker
        ) {
          this._updateRequired = true;
        }
      }, "state_changed");
    }
  }

  fetchFlightsData() {
    this._timer = clearInterval(this._timer);
    const entityState = this.hass.states[this.config.flights_entity];
    if (entityState) {
      try {
        this._flightsData =
          parseFloat(entityState.state) > 0 && entityState.attributes.flights
            ? JSON.parse(JSON.stringify(entityState.attributes.flights))
            : [];
      } catch (error) {
        console.error("Error fetching or parsing flight data:", error);
        this._flightsData = [];
      }
    } else {
      throw new Error(
        "Flights entity state is undefined. Check the configuration."
      );
    }

    const { moving } = this.calculateFlightData();
    if (this.config.projection_interval) {
      if (moving && !this._timer) {
        clearInterval(this._timer);
        this._timer = setInterval(() => {
          if (this._hass) {
            const { projected } = this.calculateFlightData();
            if (projected) {
              this.renderDynamic();
            }
          }
        }, this.config.projection_interval * 1000);
      } else if (!moving) {
        clearInterval(this._timer);
      }
    }
  }

  calculateFlightData() {
    let projected = false;
    let moving = false;
    const currentTime = Date.now() / 1000;
    const location = this.getLocation();
    if (location) {
      const refLat = location.latitude;
      const refLon = location.longitude;

      this._flightsData.forEach((flight) => {
        if (!flight._timestamp) {
          flight._timestamp = currentTime;
        }

        moving = moving || flight.ground_speed > 0;

        const timeElapsed = currentTime - flight._timestamp;
        if (timeElapsed > 1) {
          projected = true;

          flight._timestamp = currentTime;

          const newPosition = calculateNewPosition(
            flight.latitude,
            flight.longitude,
            flight.heading,
            ((flight.ground_speed * 1.852) / 3600) * timeElapsed
          );

          flight.latitude = newPosition.lat;
          flight.longitude = newPosition.lon;
          const newAltitude = Math.max(
            flight.altitude + (timeElapsed / 60) * flight.vertical_speed,
            0
          );
          if (
            flight.landed ||
            (newAltitude !== flight.altitude && newAltitude === 0)
          ) {
            flight.landed = true;
            flight.ground_speed = Math.max(
              flight.ground_speed - 15 * timeElapsed,
              15
            );
          }
          flight.altitude = newAltitude;
        }

        flight.distance_to_tracker = haversine(
          refLat,
          refLon,
          flight.latitude,
          flight.longitude,
          this.units.distance
        );

        flight.heading_from_tracker = calculateBearing(
          refLat,
          refLon,
          flight.latitude,
          flight.longitude
        );
        flight.cardinal_direction_from_tracker = getCardinalDirection(
          flight.heading_from_tracker
        );
        const heading_to_tracker = (flight.heading_from_tracker + 180) % 360;
        flight.is_approaching = areHeadingsAligned(
          heading_to_tracker,
          flight.heading
        );
        flight.is_receding = areHeadingsAligned(
          flight.heading_from_tracker,
          flight.heading
        );

        if (flight.is_approaching) {
          let closestPassingLatLon = calculateClosestPassingPoint(
            refLat,
            refLon,
            flight.latitude,
            flight.longitude,
            flight.heading
          );

          flight.closest_passing_distance = Math.round(
            haversine(
              refLat,
              refLon,
              closestPassingLatLon.lat,
              closestPassingLatLon.lon,
              this.units.distance
            )
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
            const timeToTouchdown =
              flight.altitude / Math.abs(flight.vertical_speed);
            const touchdownLatLon = calculateNewPosition(
              flight.latitude,
              flight.longitude,
              flight.heading,
              (flight.ground_speed * timeToTouchdown) / 60
            );
            const touchdownDistance = haversine(
              refLat,
              refLon,
              touchdownLatLon.lat,
              touchdownLatLon.lon,
              this.units.distance
            );

            if (timeToTouchdown < eta_to_closest_distance) {
              flight.is_landing = true;
              flight.closest_passing_distance = Math.round(touchdownDistance);
              flight.eta_to_closest_distance = Math.round(timeToTouchdown);
              closestPassingLatLon = touchdownLatLon;
            }
          }

          flight.heading_from_tracker_to_closest_passing = Math.round(
            calculateBearing(
              refLat,
              refLon,
              closestPassingLatLon.lat,
              closestPassingLatLon.lon
            )
          );
        } else {
          delete flight.closest_passing_distance;
          delete flight.eta_to_closest_distance;
          delete flight.heading_from_tracker_to_closest_passing;
          delete flight.is_landing;
        }
      });
    } else {
      console.error(
        "Tracker state is undefined. Make sure the location tracker entity ID is correct."
      );
    }

    return { projected, moving };
  }

  calculateETA(fromLat, fromLon, toLat, toLon, groundSpeed) {
    const distance = haversine(
      fromLat,
      fromLon,
      toLat,
      toLon,
      this.units.distance
    );
    if (groundSpeed === 0) {
      return Infinity;
    }

    const groundSpeedDistanceUnitsPrMin =
      (groundSpeed * (this.units.distance === "km" ? 1.852 : 1.15078)) / 60;
    const eta = distance / groundSpeedDistanceUnitsPrMin;
    return eta;
  }

  attachEventListeners() {
    if (!this._boundEventHandlers) {
      this._boundEventHandlers = {
        handleWheel: this.handleWheel.bind(this),
        handleTouchStart: this.handleTouchStart.bind(this),
        handleTouchMove: this.handleTouchMove.bind(this),
        handleTouchEnd: this.handleTouchEnd.bind(this),
      };
    }

    const radarOverlay = this.shadowRoot.getElementById("radar-overlay");
    if (radarOverlay) {
      radarOverlay.addEventListener(
        "wheel",
        this._boundEventHandlers.handleWheel,
        { passive: false }
      );
      radarOverlay.addEventListener(
        "touchstart",
        this._boundEventHandlers.handleTouchStart,
        { passive: true }
      );
      radarOverlay.addEventListener(
        "touchmove",
        this._boundEventHandlers.handleTouchMove,
        { passive: false }
      );
      radarOverlay.addEventListener(
        "touchend",
        this._boundEventHandlers.handleTouchEnd,
        { passive: true }
      );
      radarOverlay.addEventListener(
        "touchcancel",
        this._boundEventHandlers.handleTouchEnd,
        { passive: true }
      );
    }
  }

  toggleSelectedFlight(flight) {
    if (this._selectedFlights === undefined) {
      this._selectedFlights = [];
    }

    if (!this._selectedFlights.includes(flight.id)) {
      this._selectedFlights.push(flight.id);
    } else {
      this._selectedFlights = this._selectedFlights.filter(
        (id) => id !== flight.id
      );
    }
    this.renderDynamic();
  }

  get hass() {
    return this._hass;
  }

  handleWheel(event) {
    event.preventDefault();
    const delta = Math.sign(event.deltaY);
    this.updateRadarRange(delta * 5);
  }
  handleTouchStart(event) {
    if (event.touches.length === 2) {
      this._initialPinchDistance = this.getPinchDistance(event.touches);
      this._initialRadarRange = this.radar.range;
    }
  }
  handleTouchMove(event) {
    if (event.touches.length === 2) {
      event.preventDefault();
      const currentPinchDistance = this.getPinchDistance(event.touches);
      if (currentPinchDistance > 0 && this._initialPinchDistance > 0) {
        const pinchRatio = currentPinchDistance / this._initialPinchDistance;
        const newRadarRange = this._initialRadarRange / pinchRatio;
        this.updateRadarRange(newRadarRange - this.radar.range);
      }
    }
  }
  handleTouchEnd() {
    this._initialPinchDistance = null;
    this._initialRadarRange = null;
    if (
      this.renderDynamicOnRangeChange &&
      this.config.updateRangeFilterOnTouchEnd
    ) {
      this.renderDynamic();
    }
  }
  getPinchDistance(touches) {
    const [touch1, touch2] = touches;
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }
}

customElements.define("flightradar24-card", Flightradar24Card);
