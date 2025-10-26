import { renderStyle } from "./style.js";
import { renderToggles } from "./toggles.js";

export function renderStatic(instance) {
  instance.shadowRoot.innerHTML = '';

  if (!instance.shadowRoot.getElementById('leaflet-css')) {
    const leafletCss = document.createElement('link');
    leafletCss.id = 'leaflet-css';
    leafletCss.rel = 'stylesheet';
    leafletCss.href = 'https://unpkg.com/leaflet/dist/leaflet.css';
    instance.shadowRoot.appendChild(leafletCss);
  }
  if (!instance.shadowRoot.getElementById('leaflet-js')) {
    const leafletJs = document.createElement('script');
    leafletJs.id = 'leaflet-js';
    leafletJs.src = 'https://unpkg.com/leaflet/dist/leaflet.js';
    leafletJs.defer = true;
    leafletJs.onload = () => {
      if (instance.renderRadarScreen) instance.renderRadarScreen();
    };
    instance.shadowRoot.appendChild(leafletJs);
  }

  renderStyle(instance);
  const card = document.createElement('ha-card');
  card.id = 'flights-card';

  if (instance.radar.hide !== true) {
    const radarContainer = document.createElement('div');
    radarContainer.id = 'radar-container';
    const radarOverlay = document.createElement('div');
    radarOverlay.id = 'radar-overlay';
    radarContainer.appendChild(radarOverlay);

    const radarInfoDisplay = document.createElement('div');
    radarInfoDisplay.id = 'radar-info';
    radarContainer.appendChild(radarInfoDisplay);

    const toggleContainer = document.createElement('div');
    toggleContainer.id = 'toggle-container';
    radarContainer.appendChild(toggleContainer);
    const radar = document.createElement('div');
    radar.id = 'radar';
    const radarScreen = document.createElement('div');
    radarScreen.id = 'radar-screen';
    radar.appendChild(radarScreen);

    const tracker = document.createElement('div');
    tracker.id = 'tracker';
    radar.appendChild(tracker);

    const planesContainer = document.createElement('div');
    planesContainer.id = 'planes';
    radar.appendChild(planesContainer);

    radarContainer.appendChild(radar);
    card.appendChild(radarContainer);

    requestAnimationFrame(() => {
      instance.renderRadarScreen();
      instance.observeRadarResize();
    });
  }

  const flightsContainer = document.createElement('div');
  flightsContainer.id = 'flights';

  if (instance.list && instance.list.hide === true) {
    flightsContainer.style.display = 'none';
  }

  card.appendChild(flightsContainer);

  instance.shadowRoot.appendChild(card);

  instance.attachEventListeners();
  renderToggles(instance);
}

