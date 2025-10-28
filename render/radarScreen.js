/**
 * Renders the radar screen for the Flightradar24CardState object
 * @param {Object} cardState - Flightradar24Card state/context object
 */
import { haversine, calculateBearing } from "../utils/geometric.js";
import { setupRadarMapBg } from "./map.js";
import { parseTemplate } from "../utils/template.js";
import { getLocation } from "../utils/location.js";

/**
 * Renders the radar screen for the Flightradar24CardState object
 * @param {Object} cardState - Flightradar24Card state/context object
 */
export function renderRadarScreen(cardState) {
  const { units, radar, dom, dimensions, hass } = cardState;

  // Use cardState.dom references if available
  const radarInfoDisplay =
    dom?.radarInfoDisplay ||
    (dom && dom.radarContainer?.querySelector("#radar-info"));
  if (radarInfoDisplay) {
    const infoElements = [
      radar?.hide_range !== true
        ? parseTemplate(cardState, "radar_range", null, null)
        : "",
    ].filter((el) => el);
    radarInfoDisplay.innerHTML = infoElements.join("<br />");
  }

  const radarScreen =
    dom?.radarScreen ||
    (dom && dom.radarContainer?.querySelector("#radar-screen")) ||
    document.getElementById("radar-screen");
  if (!radarScreen) return;

  // Only remove overlays, not the background map div
  Array.from(radarScreen.childNodes).forEach((child) => {
    // Preserve Leaflet map bg
    if (!(child.id === "radar-map-bg")) {
      radarScreen.removeChild(child);
    }
  });

  setupRadarMapBg(cardState, radarScreen);

  // All geometry from cardState.dimensions
  // Dimensions must provide: width, height, range, scaleFactor, centerX, centerY
  const {
    width: radarWidth,
    height: radarHeight,
    range: radarRange,
    scaleFactor,
    centerX: radarCenterX,
    centerY: radarCenterY,
  } = dimensions || {};

  if (
    !radarWidth ||
    !radarHeight ||
    !radarRange ||
    !scaleFactor ||
    radarCenterX == null ||
    radarCenterY == null
  )
    return;

  const clippingRange = radarRange * 1.15;

  const ringDistance = radar?.ring_distance ?? 10;
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

  const location = getLocation(cardState);
  if (radar?.local_features && hass) {
    if (location) {
      const refLat = location.latitude;
      const refLon = location.longitude;
      radar.local_features.forEach((feature) => {
        if (feature.max_range && feature.max_range <= radar.range) return;
        if (feature.type === "outline" && feature.points?.length > 1) {
          for (let i = 0; i < feature.points.length - 1; i++) {
            const start = feature.points[i];
            const end = feature.points[i + 1];
            const startDistance = haversine(
              refLat,
              refLon,
              start.lat,
              start.lon,
              units.distance
            );
            const endDistance = haversine(
              refLat,
              refLon,
              end.lat,
              end.lon,
              units.distance
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
        } else if (feature.position) {
          const { lat: featLat, lon: featLon } = feature.position;
          const distance = haversine(
            refLat,
            refLon,
            featLat,
            featLon,
            units.distance
          );
          if (distance <= clippingRange) {
            const bearing = calculateBearing(refLat, refLon, featLat, featLon);
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
                units.distance === "km"
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
