import type { CardState } from '../types/cardState';

export function renderStyle(cardState: CardState, shadowRoot: ShadowRoot): void {
    const oldStyle = shadowRoot.querySelector('style[data-fr24-style]');
    if (oldStyle) oldStyle.remove();

    const radar = cardState.radar;
    // Backwards compatibility: use new properties, fall back to old ones
    const backgroundColor = radar['background-color'] || radar['primary-color'] || 'var(--dark-primary-color)';
    const aircraftColor = radar['aircraft-color'] || radar['accent-color'] || 'var(--accent-color)';
    const aircraftSelectedColor = radar['aircraft-selected-color'] || radar['aircraft-color'] || radar['accent-color'] || 'var(--accent-color)';
    const radarGridColor = radar['radar-grid-color'] || radar['feature-color'] || 'var(--secondary-text-color)';
    const localFeaturesColor = radar['local-features-color'] || radar['feature-color'] || radar['radar-grid-color'] || 'var(--secondary-text-color)';
    const callsignLabelColor = radar['callsign-label-color'] || 'var(--primary-background-color)';
    const backgroundOpacity = radar['background-opacity'] !== undefined ? Math.max(0, Math.min(1, radar['background-opacity'])) : 0.05;
    const radarSize = radar['radar_size'] !== undefined ? Math.max(30, Math.min(90, radar['radar_size'])) : 70;
    const radarMargin = (100 - radarSize) / 2;
    const scale = cardState.config.scale !== undefined ? Math.max(0.5, Math.min(3, cardState.config.scale)) : 1;

    const style = document.createElement('style');
    style.setAttribute('data-fr24-style', '1');
    style.textContent = `
    :host {
      --radar-background-color: ${backgroundColor};
      --radar-aircraft-color: ${aircraftColor};
      --radar-aircraft-selected-color: ${aircraftSelectedColor};
      --radar-grid-color: ${radarGridColor};
      --radar-local-features-color: ${localFeaturesColor};
      --radar-callsign-label-color: ${callsignLabelColor};
    }
    #flights-card {
      padding: 16px;
      transform: scale(${scale});
      transform-origin: top center;
    }
    #flights {
      padding: 0px;
    }
    #flights .flight {
      margin-top: 16px;
      margin-bottom: 16px;
    }
    #flights .flight.first {
      margin-top: 0px;
    }
    #flights .flight.selected {
      margin-left: -3px;
      margin-right: -3px;
      padding: 3px;
      background-color: var(--primary-background-color);
      border: 1px solid var(--fc-border-color);
      border-radius: 4px;
    }
    #flights .flight {
      margin-top: 16px;
      margin-bottom: 16px;
    }
    #flights > :first-child {
      margin-top: 0px;
    }
    #flights > :last-child {
      margin-bottom: 0px;
    }
    #flights .flight a {
      text-decoration: none;
      font-size: 0.8em;
      margin-left: 0.2em;
    }
    #flights .description {
      flex-grow: 1;
    }
    #flights .no-flights-message {
      text-align: center;
      font-size: 1.2em;
      color: gray;
      margin-top: 20px;
    }
    #radar-container {
      display: flex;
      justify-content: space-between;
    }
    #radar-overlay {
      position: absolute;
      width: ${radarSize}%;
      left: ${radarMargin}%;
      padding: 0 0 ${radarSize}% 0;
      margin-bottom: 5%;
      z-index: 1;
      opacity: 0;
      pointer-events: auto;
      border-radius: 50%;
      overflow: hidden;
    }
    #radar-info {
      position: absolute;
      width: 30%;
      text-align: left;
      font-size: 0.9em;
      padding: 0;
      margin: 0;
    }
    #toggle-container {
      position: absolute;
      right: 0;
      width: 25%;
      text-align: left;
      font-size: 0.9em;
      padding: 0;
      margin: 0 15px;
    }
    .toggle {
      display: flex;
      align-items: center;
      margin-bottom: 5px;
    }
    .toggle label {
      margin-right: 10px;
      flex: 1;
    }
    #radar {
      position: relative;
      width: ${radarSize}%;
      height: 0;
      margin: 0 ${radarMargin}%;
      padding-bottom: ${radarSize}%;
      margin-bottom: 5%;
      border-radius: 50%;
      overflow: hidden;
    }
    #radar-screen {
      position: absolute;
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0%;
    }
    #radar-screen-background {
      position: absolute;
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0%;
      background-color: var(--radar-background-color);
      opacity: ${backgroundOpacity};
    }
    #tracker {
      position: absolute;
      width: 3px;
      height: 3px;
      background-color: var(--info-color);
      border-radius: 50%;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
    }
    .plane {
      position: absolute;
      translate: -50% -50%;
      z-index: 2;
      --marker-base-scale: 1.0;
      --selected-scale: 1.0;
      scale: calc(var(--marker-base-scale) * var(--selected-scale));
    }
    .plane.marker-size-small { --marker-base-scale: 0.7; }
    .plane.marker-size-large { --marker-base-scale: 1.4; }
    .plane.marker-size-x-large { --marker-base-scale: 2.0; }
    .plane.marker-size-xx-large { --marker-base-scale: 2.8; }
    .plane.plane-small {
      width: 4px;
      height: 6px;
    }
    .plane.plane-medium {
      width: 6px;
      height: 8px;
    }
    .plane.plane-large {
      width: 8px;
      height: 16px;
    }
    .plane .arrow {
      position: absolute;
      width: 0;
      height: 0;
      transform-origin: center center;
    }
    .plane.plane-small .arrow {
      border-left: 2px solid transparent;
      border-right: 2px solid transparent;
      border-bottom: 6px solid var(--radar-aircraft-color);
    }
    .plane.plane-medium .arrow {
      border-left: 3px solid transparent;
      border-right: 3px solid transparent;
      border-bottom: 8px solid var(--radar-aircraft-color);
    }
    .plane.plane-large .arrow {
      border-left: 4px solid transparent;
      border-right: 4px solid transparent;
      border-bottom: 16px solid var(--radar-aircraft-color);
    }
    .plane.selected {
      z-index: 3;
      --selected-scale: 1.2;
    }
    .plane.selected .arrow {
      border-bottom-color: var(--radar-aircraft-selected-color);
    }
    .callsign-label {
      position: absolute;
      background-color: var(--radar-callsign-label-color);
      opacity: 0.7;
      border: 1px solid lightgray;
      line-height: 1em;
      padding: 0px;
      margin: 0px;
      border-radius: 3px;
      font-size: 9px;
      color: var(--primary-text-color);
      z-index: 2;
    }
    .ring {
      position: absolute;
      border: 1px dashed var(--radar-grid-color);
      border-radius: 50%;
      pointer-events: none;
    }
    .dotted-line {
      position: absolute;
      top: 50%;
      left: 50%;
      border-bottom: 1px dotted var(--radar-grid-color);
      width: 50%;
      height: 0px;
      transform-origin: 0 0;
      pointer-events: none;
    }
    .runway {
      position: absolute;
      background-color: var(--radar-local-features-color);
      height: 2px;
    }
    .location-dot {
      position: absolute;
      width: 4px;
      height: 4px;
      background-color: var(--radar-local-features-color);
      border-radius: 50%;
    }
    .location-label {
      position: absolute;
      background: none;
      line-height: 0;
      border: none;
      padding: 0px;
      font-size: 10px;
      color: var(--radar-local-features-color);
      opacity: 0.5;
    }
    .outline-line {
      position: absolute;
      background-color: var(--radar-local-features-color);
      opacity: 0.35;
    }
  `;
    shadowRoot.appendChild(style);
}
