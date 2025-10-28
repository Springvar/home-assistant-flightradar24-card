import { getLocation } from "../utils/location.js";


/**
 * Ensures Leaflet CSS/JS are loaded into shadowRoot *if needed*.
 * Only loads if cardState wants a map background.
 */
export function ensureLeafletLoadedIfNeeded(cardState, shadowRoot, onReady) {
  if (
    cardState.radar &&
    cardState.radar.background_map &&
    cardState.radar.background_map !== "none"
  ) {
    if (window.L) {
      onReady();
      return;
    }
    if (!shadowRoot.querySelector("#leaflet-css-loader")) {
      const link = document.createElement("link");
      link.id = "leaflet-css-loader";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet/dist/leaflet.css";
      shadowRoot.appendChild(link);
    }
    if (!shadowRoot.querySelector("#leaflet-js-loader")) {
      const script = document.createElement("script");
      script.id = "leaflet-js-loader";
      script.src = "https://unpkg.com/leaflet/dist/leaflet.js";
      script.async = true;
      script.defer = true;
      script.onload = onReady;
      script.onerror = () => script.remove();
      shadowRoot.appendChild(script);
    } else {
      // Script loading: poll for window.L
      const poll = setInterval(() => {
        if (window.L) {
          clearInterval(poll);
          onReady();
        }
      }, 50);
    }
  } else {
    // Radar map not needed: call onReady immediately (no Leaflet required)
    onReady();
  }
}

/**
 * Sets up or updates the radar map background and Leaflet map.
 * Expects Leaflet to be loaded (window.L)
 */
export function setupRadarMapBg(cardState, radarScreen) {
  const { config, dimensions } = cardState;
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

  let opacity =
    typeof config.radar.background_map_opacity === "number"
      ? Math.max(0, Math.min(1, config.radar.background_map_opacity))
      : 1;

  let mapBg = radarScreen.querySelector("#radar-map-bg");
  if (!mapBg) {
    mapBg = document.createElement("div");
    mapBg.id = "radar-map-bg";
    mapBg.style.position = "absolute";
    mapBg.style.top = "0";
    mapBg.style.left = "0";
    mapBg.style.width = "100%";
    mapBg.style.height = "100%";
    mapBg.style.zIndex = "0";
    mapBg.style.pointerEvents = "none";
    mapBg.style.opacity = opacity;
    radarScreen.appendChild(mapBg);
  } else {
    mapBg.style.opacity = opacity;
  }

  const location = getLocation(cardState);
  const radarRange = Math.max(dimensions.range, 1);
  const zoom = 10 + Math.floor(Math.log2(35 / radarRange));
  const type = config.radar.background_map || "bw";
  let [tileUrl, tileOpts] = TILE_LAYERS[type] || TILE_LAYERS.bw;
  if ("api_key" in tileOpts && config.radar.background_map_api_key) {
    tileUrl =
      tileUrl +
      tileOpts.api_key +
      encodeURIComponent(config.radar.background_map_api_key);
  }

  // Only run if window.L is available
  if (window.L) {
    if (!cardState._leafletMap) {
      cardState._leafletMap = window.L.map(mapBg, {
        center: [location.latitude || 0, location.longitude || 0],
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
    } else {
      cardState._leafletMap.setView(
        [location.latitude || 0, location.longitude || 0],
        zoom
      );
      cardState._leafletMap.eachLayer((layer) => {
        cardState._leafletMap.removeLayer(layer);
      });
    }
    window.L.tileLayer(tileUrl, tileOpts).addTo(cardState._leafletMap);
  }

  return mapBg;
}