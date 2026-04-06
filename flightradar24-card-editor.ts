import type { CardConfig, Condition, FieldCondition, GroupCondition, NotCondition, SortCriterion, ToggleConfig, AnnotationConfig, RadarFeature, LocationFeature, RunwayFeature, OutlineFeature, UnitsConfig, RadarConfig, ListConfig } from './types/config';
import { searchRunways } from './utils/runwayLookup';
import { templateConfig } from './config/templateConfig';

export class Flightradar24CardEditor extends HTMLElement {
    private _config: CardConfig = {};
    public hass: any;
    private _shadowRoot: ShadowRoot;
    private _openSections: Set<string> = new Set(['basic-settings']); // Track which sections are open
    private _openConditions: Set<string> = new Set(); // Track which conditions are expanded
    private _openFeatures: Set<string> = new Set(); // Track which local features are expanded
    private _openAnnotations: Set<string> = new Set(); // Track which annotations are expanded
    private _mapModal: { type: 'location' | 'outline'; index: number; map?: any; marker?: any; polygon?: any; points?: Array<{ lat: number; lon: number }>; markers?: any[] } | null = null;
    private _internalUpdate = false; // Track when updates come from internal changes

    constructor() {
        super();
        this._shadowRoot = this.attachShadow({ mode: 'open' });
    }

    setConfig(config: CardConfig) {
        this._config = { ...config };
        // Only re-render if this is an external config change, not from our own input events
        if (!this._internalUpdate) {
            this._render();
        }
        this._internalUpdate = false;
    }

    private get availableFlightEntities(): string[] {
        if (!this.hass) return [];
        return Object.keys(this.hass.states)
            .filter(eid => eid.includes('flightradar'))
            .sort();
    }

    private get availableTrackerEntities(): string[] {
        if (!this.hass) return [];
        return Object.keys(this.hass.states)
            .filter(eid => eid.startsWith('device_tracker.') || eid.startsWith('person.') || eid.startsWith('zone.'))
            .sort();
    }

    private get availableFlightFields(): { value: string; label: string; group?: string }[] {
        return [
            { value: 'id', label: 'ID', group: 'Basic' },
            { value: 'flight_number', label: 'Flight Number', group: 'Basic' },
            { value: 'callsign', label: 'Callsign', group: 'Basic' },
            { value: 'aircraft_registration', label: 'Aircraft Registration', group: 'Aircraft' },
            { value: 'aircraft_model', label: 'Aircraft Model', group: 'Aircraft' },
            { value: 'aircraft_code', label: 'Aircraft Code', group: 'Aircraft' },
            { value: 'airline', label: 'Airline Name', group: 'Airline' },
            { value: 'airline_short', label: 'Airline Short', group: 'Airline' },
            { value: 'airline_iata', label: 'Airline IATA', group: 'Airline' },
            { value: 'airline_icao', label: 'Airline ICAO', group: 'Airline' },
            { value: 'airport_origin_name', label: 'Origin Airport', group: 'Origin' },
            { value: 'airport_origin_code_iata', label: 'Origin IATA', group: 'Origin' },
            { value: 'airport_origin_country_name', label: 'Origin Country', group: 'Origin' },
            { value: 'airport_origin_country_code', label: 'Origin Country Code', group: 'Origin' },
            { value: 'airport_destination_name', label: 'Destination Airport', group: 'Destination' },
            { value: 'airport_destination_code_iata', label: 'Destination IATA', group: 'Destination' },
            { value: 'airport_destination_country_name', label: 'Destination Country', group: 'Destination' },
            { value: 'airport_destination_country_code', label: 'Destination Country Code', group: 'Destination' },
            { value: 'latitude', label: 'Latitude', group: 'Position' },
            { value: 'longitude', label: 'Longitude', group: 'Position' },
            { value: 'altitude', label: 'Altitude', group: 'Position' },
            { value: 'vertical_speed', label: 'Vertical Speed', group: 'Movement' },
            { value: 'ground_speed', label: 'Ground Speed', group: 'Movement' },
            { value: 'heading', label: 'Heading', group: 'Movement' },
            { value: 'distance_to_tracker', label: 'Distance to Tracker', group: 'Tracking' },
            { value: 'heading_from_tracker', label: 'Heading from Tracker', group: 'Tracking' },
            { value: 'cardinal_direction_from_tracker', label: 'Cardinal Direction', group: 'Tracking' },
            { value: 'is_approaching', label: 'Is Approaching', group: 'Tracking' },
            { value: 'is_receding', label: 'Is Receding', group: 'Tracking' },
            { value: 'closest_passing_distance', label: 'Closest Passing Distance', group: 'Approach' },
            { value: 'eta_to_closest_distance', label: 'ETA to Closest', group: 'Approach' },
            { value: 'heading_from_tracker_to_closest_passing', label: 'Heading to Closest', group: 'Approach' },
        ];
    }

    private _mapTypeRequiresApiKey(mapType?: string): boolean {
        // Stadia Maps tiles (bw and outlines) require an API key
        return mapType === 'bw' || mapType === 'outlines';
    }

    private _render() {
        if (!this.hass) return;

        // Save the current open/closed state of all details elements
        this._saveOpenSections();

        this._shadowRoot.innerHTML = `
            <style>
                ${this._getStyles()}
            </style>
            <div class="editor-container">
                ${this._renderBasicSettings()}
                ${this._renderAdvancedSettings()}
                ${this._renderRadarConfig()}
                ${this._renderListConfig()}
                ${this._renderTogglesAndDefinesConfig()}
                ${this._renderTemplatesConfig()}
            </div>
        `;

        this._attachEventListeners();
        this._restoreOpenSections();
    }

    private _saveOpenSections() {
        // Save which sections are currently open before re-rendering
        this._shadowRoot.querySelectorAll('details').forEach(details => {
            const id = details.getAttribute('data-section-id');
            if (id) {
                if (details.open) {
                    this._openSections.add(id);
                } else {
                    this._openSections.delete(id);
                }
            }

            // Also save condition open states
            const conditionPath = details.getAttribute('data-condition-path');
            if (conditionPath) {
                if (details.open) {
                    this._openConditions.add(conditionPath);
                } else {
                    this._openConditions.delete(conditionPath);
                }
            }

            // Also save feature open states
            const featureId = details.getAttribute('data-feature-id');
            if (featureId) {
                if (details.open) {
                    this._openFeatures.add(featureId);
                } else {
                    this._openFeatures.delete(featureId);
                }
            }

            // Also save annotation open states
            const annotationId = details.getAttribute('data-annotation-id');
            if (annotationId) {
                if (details.open) {
                    this._openAnnotations.add(annotationId);
                } else {
                    this._openAnnotations.delete(annotationId);
                }
            }
        });
    }

    private _restoreOpenSections() {
        // Restore the open state after re-rendering
        this._shadowRoot.querySelectorAll('details').forEach(details => {
            const id = details.getAttribute('data-section-id');
            if (id && this._openSections.has(id)) {
                details.open = true;
            }

            // Also restore condition open states
            const conditionPath = details.getAttribute('data-condition-path');
            if (conditionPath && this._openConditions.has(conditionPath)) {
                details.open = true;
            }

            // Also restore feature open states
            const featureId = details.getAttribute('data-feature-id');
            if (featureId && this._openFeatures.has(featureId)) {
                details.open = true;
            }

            // Also restore annotation open states
            const annotationId = details.getAttribute('data-annotation-id');
            if (annotationId && this._openAnnotations.has(annotationId)) {
                details.open = true;
            }
        });
    }

    private _getStyles(): string {
        return `
            .editor-container {
                position: relative;
                z-index: 1000;
                background: var(--card-background-color, #fff);
            }
            details {
                margin-bottom: 12px;
                border: 1px solid var(--divider-color, #ccc);
                border-radius: 4px;
                padding: 6px;
            }
            summary {
                cursor: pointer;
                user-select: none;
                font-weight: bold;
                padding: 6px;
                margin: -6px;
            }
            summary:hover {
                background: var(--secondary-background-color, #f0f0f0);
            }
            h3 {
                display: inline;
                margin: 0;
            }
            h4 {
                margin: 12px 0 6px 0;
                font-size: 0.95em;
                font-weight: 600;
                color: var(--secondary-text-color, #666);
            }
            summary h4 {
                display: inline;
                margin: 0;
            }
            h5 {
                margin: 8px 0 4px 0;
                font-size: 0.9em;
                font-weight: 600;
                color: var(--secondary-text-color, #666);
            }
            summary h5 {
                display: inline;
                margin: 0;
            }
            details details {
                margin-bottom: 8px;
                border: 1px solid var(--divider-color, #e0e0e0);
                background: var(--secondary-background-color, #f5f5f5);
            }
            details details summary {
                padding: 4px;
                margin: -4px;
            }
            details details .section-content {
                padding: 8px 6px 6px 6px;
            }
            .subsection {
                margin-bottom: 12px;
                padding: 8px;
                border: 1px solid var(--divider-color, #e0e0e0);
                border-radius: 4px;
            }
            .subsection legend {
                padding: 0 6px;
                font-size: 0.95em;
                font-weight: 600;
                color: var(--secondary-text-color, #666);
            }
            .section-content {
                padding: 12px 6px 6px 6px;
            }
            .form-row {
                display: flex;
                flex-direction: column;
                gap: 4px;
                margin-bottom: 10px;
            }
            .form-row label {
                font-weight: 500;
                font-size: 0.9em;
                color: var(--secondary-text-color, #666);
            }
            input[type="text"],
            input[type="number"],
            input[type="color"],
            select,
            textarea {
                padding: 6px 8px;
                border: 1px solid var(--divider-color, #ccc);
                border-radius: 4px;
                font-family: inherit;
                font-size: 14px;
                width: 100%;
                box-sizing: border-box;
            }
            input[type="number"] {
                max-width: 120px;
            }
            input[type="checkbox"] {
                width: 18px;
                height: 18px;
            }
            .full-width {
                width: 100%;
            }
            textarea.full-width {
                min-height: 60px;
            }
            .help-text {
                color: var(--secondary-text-color, #666);
                font-size: 0.85em;
                margin: 2px 0;
                line-height: 1.3;
            }
            .item-box {
                border: 1px solid var(--divider-color, #ccc);
                border-radius: 4px;
                padding: 0;
                margin-bottom: 8px;
                background: var(--secondary-background-color, #f5f5f5);
            }
            .item-box summary.item-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px;
                margin: 0;
                font-weight: bold;
                cursor: pointer;
                user-select: none;
                list-style: none;
                font-size: 0.9em;
            }
            .item-box summary.item-header::-webkit-details-marker {
                display: none;
            }
            .item-box summary.item-header::before {
                content: '▶';
                font-size: 9px;
                margin-right: 6px;
                transition: transform 0.2s;
            }
            .item-box[open] summary.item-header::before {
                transform: rotate(90deg);
            }
            .item-box summary.item-header:hover {
                background: rgba(0, 0, 0, 0.03);
            }
            .item-box .section-content {
                padding: 0 8px 8px 8px;
            }
            .button-group {
                display: flex;
                gap: 4px;
                flex-wrap: wrap;
            }
            button {
                padding: 5px 10px;
                border: 1px solid var(--divider-color, #ccc);
                border-radius: 4px;
                background: var(--card-background-color, #fff);
                cursor: pointer;
                font-size: 13px;
            }
            button:hover {
                background: var(--secondary-background-color, #f0f0f0);
            }
            .add-button {
                background: var(--primary-color, #03a9f4);
                color: white;
                border: none;
            }
            .add-button:hover {
                background: var(--dark-primary-color, #0288d1);
            }
            .remove-button {
                background: var(--error-color, #f44336);
                color: white;
                border: none;
            }
            .remove-button:hover {
                background: #d32f2f;
            }
            .small-button {
                font-size: 11px;
                padding: 3px 6px;
            }
            .icon-button {
                padding: 3px 6px;
                font-weight: bold;
            }
            .condition-box {
                border-left: 3px solid var(--primary-color, #03a9f4);
                padding: 0;
                margin: 6px 0;
                background: var(--card-background-color, #fff);
                border-radius: 4px;
                border: 1px solid var(--divider-color, #e0e0e0);
            }
            .condition-box[open] {
                padding-bottom: 8px;
            }
            .condition-group {
                background: var(--secondary-background-color, #f5f5f5);
                border-left: 3px solid var(--accent-color, #ff9800);
            }
            .condition-not {
                background: #fff3e0;
                border-left: 3px solid #fb8c00;
            }
            .condition-summary {
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 8px;
                cursor: pointer;
                user-select: none;
                list-style: none;
                font-size: 0.9em;
            }
            .condition-summary::-webkit-details-marker {
                display: none;
            }
            .condition-summary::before {
                content: '▶';
                font-size: 9px;
                transition: transform 0.2s;
                flex-shrink: 0;
            }
            .condition-box[open] > .condition-summary::before {
                transform: rotate(90deg);
            }
            .condition-summary:hover {
                background: rgba(0, 0, 0, 0.02);
            }
            .condition-type-badge {
                background: var(--primary-color, #03a9f4);
                color: white;
                padding: 2px 6px;
                border-radius: 3px;
                font-size: 10px;
                font-weight: bold;
                text-transform: uppercase;
                flex-shrink: 0;
            }
            .condition-group .condition-type-badge {
                background: var(--accent-color, #ff9800);
            }
            .condition-not .condition-type-badge {
                background: #fb8c00;
            }
            .condition-description {
                flex: 1;
                font-size: 13px;
                color: var(--secondary-text-color, #666);
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                font-family: 'Courier New', monospace;
            }
            .condition-content {
                padding: 0 8px 0 8px;
            }
            .condition-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 8px;
            }
            .conditions-list {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            .empty-state {
                color: var(--secondary-text-color, #999);
                font-style: italic;
                text-align: center;
                padding: 12px;
                font-size: 0.9em;
            }
            .map-modal-overlay {
                display: none;
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.7);
                z-index: 10000;
                align-items: center;
                justify-content: center;
            }
            .map-modal-overlay.open {
                display: flex;
            }
            .map-modal {
                background: var(--card-background-color, #fff);
                border-radius: 8px;
                width: 90%;
                max-width: 800px;
                height: 80%;
                max-height: 600px;
                display: flex;
                flex-direction: column;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            }
            .map-modal-header {
                padding: 16px;
                border-bottom: 1px solid var(--divider-color, #e0e0e0);
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .map-modal-header h3 {
                margin: 0;
            }
            .map-modal-body {
                flex: 1;
                position: relative;
                overflow: hidden;
            }
            .map-modal-map {
                width: 100%;
                height: 100%;
                position: absolute;
                top: 0;
                left: 0;
            }
            .map-modal-footer {
                padding: 16px;
                border-top: 1px solid var(--divider-color, #e0e0e0);
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .map-modal-instructions {
                color: var(--secondary-text-color, #666);
                font-size: 0.9em;
            }
            .runway-dropdown {
                position: absolute;
                top: 100%;
                left: 0;
                right: 0;
                background: var(--card-background-color, #fff);
                border: 1px solid var(--divider-color, #ccc);
                border-radius: 4px;
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
                max-height: 300px;
                overflow-y: auto;
                z-index: 1000;
                margin-top: 4px;
            }
            .runway-dropdown-item {
                padding: 8px 12px;
                cursor: pointer;
                border-bottom: 1px solid var(--divider-color, #f0f0f0);
            }
            .runway-dropdown-item:last-child {
                border-bottom: none;
            }
            .runway-dropdown-item:hover {
                background: var(--secondary-background-color, #f5f5f5);
            }
            .runway-dropdown-loading {
                padding: 12px;
                text-align: center;
                color: var(--secondary-text-color, #666);
                font-style: italic;
            }
            .runway-dropdown-empty {
                padding: 12px;
                text-align: center;
                color: var(--secondary-text-color, #666);
                font-style: italic;
            }
            .template-button-container {
                position: relative;
            }
            .template-dropdown-button {
                display: flex;
                align-items: center;
                justify-content: space-between;
                width: 100%;
            }
            .template-dropdown-button::after {
                content: '▼';
                font-size: 10px;
                margin-left: 8px;
            }
            .template-dropdown {
                display: none;
                position: absolute;
                top: 100%;
                left: 0;
                right: 0;
                background: var(--card-background-color, #fff);
                border: 1px solid var(--divider-color, #ccc);
                border-radius: 4px;
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
                max-height: 300px;
                overflow-y: auto;
                z-index: 1000;
                margin-top: 4px;
            }
            .template-dropdown.open {
                display: block;
            }
            .template-dropdown-header {
                padding: 8px 12px;
                font-weight: 600;
                font-size: 0.85em;
                color: var(--secondary-text-color, #666);
                background: var(--secondary-background-color, #f5f5f5);
                border-bottom: 1px solid var(--divider-color, #e0e0e0);
            }
            .template-dropdown-item {
                padding: 8px 12px;
                cursor: pointer;
                border-bottom: 1px solid var(--divider-color, #f0f0f0);
            }
            .template-dropdown-item:last-child {
                border-bottom: none;
            }
            .template-dropdown-item:hover {
                background: var(--secondary-background-color, #f5f5f5);
            }

            /* Responsive adjustments for narrow editor panes (typical HA editor width ~460px) */
            .button-group {
                flex-wrap: wrap;
            }
            .condition-field-type {
                flex: 1;
                min-width: 100px;
            }

            /* Aircraft marker size selector */
            .marker-size-selector {
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
            }
            .marker-size-option {
                position: relative;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 10px;
                border: 2px solid transparent;
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.2s;
                min-width: 50px;
                min-height: 50px;
                overflow: hidden;
            }
            .marker-size-option:hover {
                border-color: var(--primary-color, #03a9f4);
            }
            .marker-size-option.selected {
                border-color: var(--primary-color, #03a9f4);
                box-shadow: 0 0 0 1px var(--primary-color, #03a9f4);
            }
            .marker-button-background {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                pointer-events: none;
            }
            .marker-preview {
                width: 30px;
                height: 30px;
                display: flex;
                align-items: center;
                justify-content: center;
                position: relative;
                z-index: 1;
            }
        `;
    }

    private _renderBasicSettings(): string {
        return `
            <details data-section-id="basic-settings">
                <summary><h3>Basic</h3></summary>
                <div class="section-content">
                    <div class="form-row">
                        <label>Flights Entity:</label>
                        <select class="full-width" id="flights-entity" data-config="flights_entity">
                            <option value="">Select entity...</option>
                            ${this.availableFlightEntities.map(eid =>
                                `<option value="${eid}" ${this._config.flights_entity === eid ? 'selected' : ''}>${eid}</option>`
                            ).join('')}
                        </select>
                    </div>

                    <div class="form-row">
                        <label>Location Tracker:</label>
                        <select class="full-width" id="location-tracker" data-config="location_tracker">
                            <option value="">Manual coordinates...</option>
                            ${this.availableTrackerEntities.map(eid =>
                                `<option value="${eid}" ${this._config.location_tracker === eid ? 'selected' : ''}>${eid}</option>`
                            ).join('')}
                        </select>
                    </div>

                    ${!this._config.location_tracker ? `
                        <div class="form-row">
                            <label>Latitude:</label>
                            <input type="number" step="0.0001" id="location-lat"
                                value="${this._config.location?.lat ?? ''}" placeholder="63.4041" />
                        </div>
                        <div class="form-row">
                            <label>Longitude:</label>
                            <input type="number" step="0.0001" id="location-lon"
                                value="${this._config.location?.lon ?? ''}" placeholder="10.4301" />
                        </div>
                    ` : ''}

                    <fieldset class="subsection">
                        <legend>Units</legend>
                        <div class="form-row">
                            <label>Altitude:</label>
                            <select id="unit-altitude" data-unit="altitude">
                                <option value="ft" ${(this._config.units?.altitude || 'ft') === 'ft' ? 'selected' : ''}>Feet (ft)</option>
                                <option value="m" ${(this._config.units?.altitude || 'ft') === 'm' ? 'selected' : ''}>Meters (m)</option>
                            </select>
                        </div>
                        <div class="form-row">
                            <label>Speed:</label>
                            <select id="unit-speed" data-unit="speed">
                                <option value="kts" ${(this._config.units?.speed || 'kts') === 'kts' ? 'selected' : ''}>Knots (kts)</option>
                                <option value="kmh" ${(this._config.units?.speed || 'kts') === 'kmh' ? 'selected' : ''}>Km/h</option>
                                <option value="mph" ${(this._config.units?.speed || 'kts') === 'mph' ? 'selected' : ''}>Mph</option>
                            </select>
                        </div>
                        <div class="form-row">
                            <label>Distance:</label>
                            <select id="unit-distance" data-unit="distance">
                                <option value="km" ${(this._config.units?.distance || 'km') === 'km' ? 'selected' : ''}>Kilometers (km)</option>
                                <option value="miles" ${(this._config.units?.distance || 'km') === 'miles' ? 'selected' : ''}>Miles</option>
                            </select>
                        </div>
                    </fieldset>

                    <div class="form-row">
                        <label>Max Flights:</label>
                        <input type="number" min="1" step="1" id="max-flights"
                            value="${this._config.max_flights ?? ''}" placeholder="unlimited" />
                    </div>
                </div>
            </details>
        `;
    }

    private _renderAdvancedSettings(): string {
        const annotate = this._config.annotate || [];
        const annotateJsonValue = JSON.stringify(annotate, null, 2);
        const filters = this._config.filter || [];

        return `
            <details data-section-id="advanced-settings">
                <summary><h3>Advanced</h3></summary>
                <div class="section-content">
                    <div class="form-row">
                        <label>Projection Interval (ms):</label>
                        <input type="number" min="100" step="100" id="projection-interval"
                            value="${this._config.projection_interval ?? 1000}" />
                        <span class="help-text">Flight position update frequency</span>
                    </div>
                    <div class="form-row">
                        <label>Scale:</label>
                        <input type="number" min="0.5" max="2" step="0.1" id="scale"
                            value="${this._config.scale ?? 1}" />
                        <span class="help-text">Card zoom level - Use with caution: values > 1 may cause the card to overflow and break page layout</span>
                    </div>

                    <details data-section-id="advanced-filter">
                        <summary><h4>Filter</h4></summary>
                        <div class="section-content">
                            <p class="help-text">Filter which flights are displayed. All top-level conditions must match (implicit AND).</p>
                            <div id="filter-conditions">
                                ${filters.length > 0 ? this._renderConditionsList(filters, 'filter') : '<p class="empty-state">No filters defined</p>'}
                            </div>
                            <div class="button-group" style="margin-top: 12px;">
                                <button class="add-button" data-action="add-filter-condition">Add Value Condition</button>
                                <button class="add-button" data-action="add-filter-group">Add AND/OR Group</button>
                                <button class="add-button" data-action="add-filter-not">Add NOT Condition</button>
                            </div>
                        </div>
                    </details>

                    <details data-section-id="advanced-sort">
                        <summary><h4>Sort</h4></summary>
                        <div class="section-content">
                            <p class="help-text">Define how flights are sorted in the list</p>
                            <div id="sort-list">
                                ${(this._config.sort || []).map((criterion, idx) => `
                                    <div class="item-box">
                                        <div class="item-header">
                                            <span>Sort ${idx + 1}</span>
                                            <button class="remove-button" data-action="remove-sort" data-index="${idx}">Remove</button>
                                        </div>
                                        <div class="form-row">
                                            <label>Field:</label>
                                            <input type="text" value="${criterion.field}" data-sort-prop="${idx}:field" placeholder="distance, altitude, speed, etc." />
                                        </div>
                                        <div class="form-row">
                                            <label>Order:</label>
                                            <select data-sort-prop="${idx}:order">
                                                <option value="asc" ${(criterion.order || 'asc') === 'asc' ? 'selected' : ''}>Ascending</option>
                                                <option value="desc" ${criterion.order === 'desc' ? 'selected' : ''}>Descending</option>
                                            </select>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                            <button class="add-button" data-action="add-sort">Add Sort Criterion</button>
                        </div>
                    </details>

                    <details data-section-id="advanced-annotations">
                        <summary><h4>Annotations</h4></summary>
                        <div class="section-content">
                            <p class="help-text">Conditional rendering with custom templates for specific flight fields</p>
                            <div id="annotations-list">
                                ${annotate.length > 0 ? annotate.map((annotation, idx) => this._renderAnnotation(annotation, idx)).join('') : '<p class="empty-state">No annotations defined</p>'}
                            </div>
                            <button class="add-button" data-action="add-annotation">Add Annotation</button>
                        </div>
                    </details>
                </div>
            </details>
        `;
    }

    private _renderRadarConfig(): string {
        const radar = this._config.radar || {};
        const distanceUnit = this._config.units?.distance || 'km';
        const unitLabel = distanceUnit === 'miles' ? 'miles' : 'km';

        return `
            <details data-section-id="radar-config">
                <summary><h3>Radar</h3></summary>
                <div class="section-content">
                    <div class="form-row">
                        <label>
                            <input type="checkbox" id="radar-show" ${radar.hide !== true ? 'checked' : ''} />
                            Show Radar
                        </label>
                    </div>

                    <details data-section-id="radar-range">
                        <summary><h4>Range</h4></summary>
                        <div class="section-content">
                            <div class="form-row">
                                <label>Default Range (${unitLabel}):</label>
                                <input type="number" min="1" step="1" id="radar-range" value="${radar.range ?? 50}" />
                            </div>
                            <div class="form-row">
                                <label>Min Range (${unitLabel}):</label>
                                <input type="number" min="1" step="1" id="radar-min-range" value="${radar.min_range ?? 5}" />
                            </div>
                            <div class="form-row">
                                <label>Max Range (${unitLabel}):</label>
                                <input type="number" min="1" step="1" id="radar-max-range" value="${radar.max_range ?? 100}" />
                            </div>
                            <div class="form-row">
                                <label>Ring Distance (${unitLabel}):</label>
                                <input type="number" min="1" step="1" id="radar-ring-distance" value="${radar.ring_distance ?? 10}" />
                            </div>
                        </div>
                    </details>

                    <details data-section-id="radar-colors">
                        <summary><h4>Colors</h4></summary>
                        <div class="section-content">
                            <div class="form-row">
                                <label>Background Color:</label>
                                <input type="color" id="radar-background-color" value="${radar['background-color'] ?? radar['primary-color'] ?? '#ffffff'}" />
                            </div>
                            <div class="form-row">
                                <label>Background Opacity:</label>
                                <input type="number" min="0" max="1" step="0.05" id="radar-background-opacity" value="${radar['background-opacity'] ?? 0.05}" />
                            </div>
                            <div class="form-row">
                                <label>Aircraft Marker:</label>
                                <input type="color" id="radar-aircraft-color" value="${radar['aircraft-color'] ?? radar['accent-color'] ?? '#ff0000'}" />
                            </div>
                            <div class="form-row">
                                <label>Aircraft Marker (Selected):</label>
                                <input type="color" id="radar-aircraft-selected-color" value="${radar['aircraft-selected-color'] ?? radar['aircraft-color'] ?? radar['accent-color'] ?? '#ff6600'}" />
                            </div>
                            <div class="form-row">
                                <label>Radar Grid:</label>
                                <input type="color" id="radar-grid-color" value="${radar['radar-grid-color'] ?? radar['feature-color'] ?? '#888888'}" />
                            </div>
                            <div class="form-row">
                                <label>Local Features:</label>
                                <input type="color" id="radar-local-features-color" value="${radar['local-features-color'] ?? radar['feature-color'] ?? radar['radar-grid-color'] ?? '#888888'}" />
                            </div>
                        </div>
                    </details>

                    <details data-section-id="radar-aircraft-marker">
                        <summary><h4>Aircraft Marker</h4></summary>
                        <div class="section-content">
                            <div class="form-row">
                                <label>Marker Size:</label>
                                <div class="marker-size-selector">
                                    ${['small', 'normal', 'large', 'x-large', 'xx-large'].map(size => {
                                        const selected = (radar['aircraft-marker-size'] || 'normal') === size;
                                        const scales: Record<string, number> = { small: 0.7, normal: 1.0, large: 1.4, 'x-large': 2.0, 'xx-large': 2.8 };
                                        const scale = scales[size];
                                        // Use the same color resolution as render/style.ts
                                        const backgroundColor = radar['background-color'] || radar['primary-color'] || '#1a1a1a';
                                        const aircraftColor = radar['aircraft-color'] || radar['accent-color'] || '#ff0000';
                                        const backgroundOpacity = radar['background-opacity'] ?? 0.05;
                                        return `
                                            <button class="marker-size-option ${selected ? 'selected' : ''}" data-size="${size}">
                                                <div class="marker-button-background" style="background-color: ${backgroundColor}; opacity: ${backgroundOpacity};"></div>
                                                <div class="marker-preview">
                                                    <div class="preview-arrow" style="
                                                        width: 0;
                                                        height: 0;
                                                        border-left: ${3 * scale}px solid transparent;
                                                        border-right: ${3 * scale}px solid transparent;
                                                        border-bottom: ${8 * scale}px solid ${aircraftColor};
                                                        transform: rotate(45deg);
                                                    "></div>
                                                </div>
                                            </button>
                                        `;
                                    }).join('')}
                                </div>
                            </div>
                        </div>
                    </details>

                    <details data-section-id="radar-background-map">
                        <summary><h4>Background Map</h4></summary>
                        <div class="section-content">
                            <div class="form-row">
                                <label>Background Map:</label>
                                <select id="radar-background-map">
                                    <option value="none" ${(radar.background_map || 'none') === 'none' ? 'selected' : ''}>None</option>
                                    <option value="system" ${radar.background_map === 'system' ? 'selected' : ''}>System (auto dark/light)</option>
                                    <option value="bw" ${radar.background_map === 'bw' ? 'selected' : ''}>Black & White (requires API key)</option>
                                    <option value="light" ${radar.background_map === 'light' ? 'selected' : ''}>Light</option>
                                    <option value="color" ${radar.background_map === 'color' ? 'selected' : ''}>Color</option>
                                    <option value="dark" ${radar.background_map === 'dark' ? 'selected' : ''}>Dark</option>
                                    <option value="voyager" ${radar.background_map === 'voyager' ? 'selected' : ''}>Voyager</option>
                                    <option value="satellite" ${radar.background_map === 'satellite' ? 'selected' : ''}>Satellite</option>
                                    <option value="topo" ${radar.background_map === 'topo' ? 'selected' : ''}>Topographic</option>
                                    <option value="outlines" ${radar.background_map === 'outlines' ? 'selected' : ''}>Outlines (requires API key)</option>
                                </select>
                            </div>
                            ${this._mapTypeRequiresApiKey(radar.background_map) ? `
                                <div class="form-row">
                                    <label>Stadia Maps API Key:</label>
                                    <input type="text" class="full-width" id="radar-background-map-api-key"
                                        value="${radar.background_map_api_key || ''}" placeholder="Get free key at stadiamaps.com" />
                                    <span class="help-text">Required for Black & White and Outlines map types. <a href="https://stadiamaps.com/" target="_blank" rel="noopener noreferrer">Get a free API key</a></span>
                                </div>
                            ` : ''}
                            <div class="form-row">
                                <label>Map Opacity:</label>
                                <input type="number" min="0" max="1" step="0.1" id="radar-background-map-opacity"
                                    value="${radar.background_map_opacity ?? 0.3}" />
                            </div>
                        </div>
                    </details>

                    <details data-section-id="radar-local-features">
                        <summary><h4>Local Features</h4></summary>
                        <div class="section-content">
                            <p class="help-text">Add custom locations, runways, and outlines to the radar</p>
                            <div id="local-features-list">
                                ${(radar.local_features || []).map((feature, idx) =>
                                    this._renderLocalFeature(feature, idx)
                                ).join('')}
                            </div>
                            <div class="button-group" style="margin-top: 12px;">
                                <button class="add-button small-button" data-action="add-local-feature-location">+ Location</button>
                                <button class="add-button small-button" data-action="add-local-feature-runway">+ Runway</button>
                                <button class="add-button small-button" data-action="add-local-feature-outline">+ Outline</button>
                            </div>
                        </div>
                    </details>
                </div>
            </details>
        `;
    }

    private _renderListConfig(): string {
        const list = this._config.list || {};
        return `
            <details data-section-id="list-config">
                <summary><h3>Flight List</h3></summary>
                <div class="section-content">
                    <div class="form-row">
                        <label>
                            <input type="checkbox" id="list-show" ${list.hide !== true ? 'checked' : ''} />
                            Show Flight List
                        </label>
                    </div>
                    <div class="form-row">
                        <label>
                            <input type="checkbox" id="list-show-status" ${list.showListStatus !== false ? 'checked' : ''} />
                            Show List Status
                        </label>
                    </div>
                    <div class="form-row">
                        <label>No Flights Message:</label>
                        <input type="text" class="full-width" id="no-flights-message"
                            value="${this._config.no_flights_message ?? ''}" placeholder="No flights in range" />
                    </div>
                </div>
            </details>
        `;
    }

    private _renderTogglesAndDefinesConfig(): string {
        const defines = this._config.defines || {};
        const toggles = this._config.toggles || {};

        return `
            <details data-section-id="toggles-defines-config">
                <summary><h3>Toggles & Defines</h3></summary>
                <div class="section-content">
                    <details data-section-id="toggles-section">
                        <summary><h4>Toggles</h4></summary>
                        <div class="section-content">
                            <p class="help-text">UI buttons that set define values dynamically</p>
                            <div id="toggles-list">
                                ${Object.entries(toggles).map(([key, toggle]) => `
                                    <div class="item-box">
                                        <div class="form-row">
                                            <label>Name:</label>
                                            <input type="text" value="${key}" readonly />
                                        </div>
                                        <div class="form-row">
                                            <label>Label:</label>
                                            <input type="text" class="full-width" value="${toggle.label}" data-toggle-label="${key}" />
                                        </div>
                                        <div class="form-row">
                                            <label>
                                                <input type="checkbox" ${toggle.default ? 'checked' : ''} data-toggle-default="${key}" />
                                                Default State
                                            </label>
                                        </div>
                                        <button class="remove-button" data-action="remove-toggle" data-key="${key}">Remove</button>
                                    </div>
                                `).join('')}
                            </div>
                            <button class="add-button" data-action="add-toggle">Add Toggle</button>
                        </div>
                    </details>

                    <details data-section-id="defines-section">
                        <summary><h4>Defines</h4></summary>
                        <div class="section-content">
                            <p class="help-text">Reusable values referenced as \${defineName} in filters and sort</p>
                            <div id="defines-list">
                                ${Object.entries(defines).map(([key, value]) => `
                                    <div class="item-box">
                                        <div class="form-row">
                                            <label>Name:</label>
                                            <input type="text" value="${key}" data-define-oldkey="${key}" readonly />
                                        </div>
                                        <div class="form-row">
                                            <label>Value:</label>
                                            <input type="text" class="full-width" value="${String(value)}" data-define-value="${key}" />
                                        </div>
                                        <button class="remove-button" data-action="remove-define" data-key="${key}">Remove</button>
                                    </div>
                                `).join('')}
                            </div>
                            <button class="add-button" data-action="add-define">Add Define</button>
                        </div>
                    </details>
                </div>
            </details>
        `;
    }

    private _renderTemplatesConfig(): string {
        const templates = this._config.templates || {};

        // Define main templates that are directly used by renderers
        const mainTemplates = ['flight_element', 'radar_range', 'list_status'];

        // Get list of default templates that haven't been overridden
        const availableDefaults = Object.keys(templateConfig).filter(key => !(key in templates));

        // Separate main templates from helper templates
        const availableMainTemplates = availableDefaults.filter(key => mainTemplates.includes(key));
        const availableHelperTemplates = availableDefaults.filter(key => !mainTemplates.includes(key));

        return `
            <details data-section-id="templates-config">
                <summary><h3>Templates</h3></summary>
                <div class="section-content">
                    <p class="help-text">Customize HTML templates for flight list items using \${flight.field} placeholders. Main templates are used directly by renderers; helper templates are used by other templates.</p>
                    <div id="templates-list">
                        ${Object.entries(templates).map(([key, template]) => {
                            const isMain = mainTemplates.includes(key);
                            const badge = isMain ? '<span style="background: var(--primary-color, #03a9f4); color: white; padding: 2px 6px; border-radius: 3px; font-size: 10px; margin-left: 8px; font-weight: bold;">MAIN</span>' : '';
                            return `
                            <div class="item-box">
                                <div class="form-row">
                                    <label>Template Name:</label>
                                    <div style="display: flex; align-items: center;">
                                        <input type="text" value="${key}" readonly style="flex: 1;" />
                                        ${badge}
                                    </div>
                                </div>
                                <div class="form-row">
                                    <label>Template:</label>
                                    <textarea class="full-width" rows="3" data-template-value="${key}">${this._escapeHtml(template)}</textarea>
                                </div>
                                <button class="remove-button" data-action="remove-template" data-key="${key}">Remove</button>
                            </div>
                        `}).join('')}
                    </div>
                    <div class="template-button-container" style="margin-top: 12px;">
                        <button class="add-button template-dropdown-button" id="add-template-button">
                            <span>Add Template</span>
                        </button>
                        <div class="template-dropdown" id="template-dropdown">
                            <div class="template-dropdown-item" data-template-key="__custom__">New custom template...</div>
                            ${availableMainTemplates.length > 0 ? `
                                <div class="template-dropdown-header">Main Templates (used by renderers)</div>
                                ${availableMainTemplates.map(key => `
                                    <div class="template-dropdown-item" data-template-key="${key}"><strong>${key}</strong></div>
                                `).join('')}
                            ` : ''}
                            ${availableHelperTemplates.length > 0 ? `
                                <div class="template-dropdown-header">Helper Templates (used by other templates)</div>
                                ${availableHelperTemplates.map(key => `
                                    <div class="template-dropdown-item" data-template-key="${key}">${key}</div>
                                `).join('')}
                            ` : ''}
                        </div>
                    </div>
                </div>
            </details>
        `;
    }

    private _renderLocalFeature(feature: RadarFeature, idx: number): string {
        if (feature.type === 'location') {
            const loc = feature as LocationFeature;
            return `
                <details class="item-box" data-feature-id="feature-${idx}">
                    <summary class="item-header">
                        <span>Location: ${loc.label || 'Unnamed'}</span>
                        <button class="remove-button small-button" data-action="remove-local-feature" data-index="${idx}">Remove</button>
                    </summary>
                    <div class="section-content">
                        <div class="form-row">
                            <label>Label:</label>
                            <input type="text" class="full-width" value="${loc.label || ''}" data-feature-prop="${idx}:label" placeholder="Airport, Tower, etc." />
                        </div>
                        <div class="form-row">
                            <label>Latitude:</label>
                            <input type="number" step="0.0001" value="${loc.position.lat}" data-feature-prop="${idx}:lat" />
                            <button class="small-button" data-action="select-location-on-map" data-index="${idx}" style="margin-left: 8px;">Select on Map</button>
                        </div>
                        <div class="form-row">
                            <label>Longitude:</label>
                            <input type="number" step="0.0001" value="${loc.position.lon}" data-feature-prop="${idx}:lon" />
                        </div>
                        <div class="form-row">
                            <label>Max Range (optional):</label>
                            <input type="number" min="0" step="1" value="${loc.max_range ?? ''}" data-feature-prop="${idx}:max_range" placeholder="Show only within range" />
                        </div>
                    </div>
                </details>
            `;
        } else if (feature.type === 'runway') {
            const runway = feature as RunwayFeature;
            return `
                <details class="item-box" data-feature-id="feature-${idx}">
                    <summary class="item-header">
                        <span>Runway (${runway.heading}°)</span>
                        <button class="remove-button small-button" data-action="remove-local-feature" data-index="${idx}">Remove</button>
                    </summary>
                    <div class="section-content">
                        <div class="form-row" style="gap: 4px; position: relative;">
                            <label>Lookup Runway:</label>
                            <div style="position: relative; flex: 1;">
                                <input type="text" id="runway-lookup-${idx}" placeholder="Start typing airport name or code..." style="width: 100%;" data-runway-index="${idx}" />
                                <div id="runway-dropdown-${idx}" class="runway-dropdown" style="display: none;"></div>
                            </div>
                        </div>
                        <div id="runway-lookup-status-${idx}" style="margin: 8px 0; font-size: 0.9em;"></div>
                        <p class="help-text">Position is the endpoint at the given runway heading</p>
                        <p class="help-text" style="font-size: 0.85em; font-style: italic;">Runway data from <a href="https://ourairports.com/data/" target="_blank" rel="noopener noreferrer">OurAirports</a></p>
                        <div class="form-row">
                            <label>Latitude:</label>
                            <input type="number" step="0.0001" value="${runway.position.lat}" data-feature-prop="${idx}:lat" />
                        </div>
                        <div class="form-row">
                            <label>Longitude:</label>
                            <input type="number" step="0.0001" value="${runway.position.lon}" data-feature-prop="${idx}:lon" />
                        </div>
                        <div class="form-row">
                            <label>Heading (degrees):</label>
                            <input type="number" min="0" max="359" step="1" value="${runway.heading}" data-feature-prop="${idx}:heading" />
                        </div>
                        <div class="form-row">
                            <label>Length (feet):</label>
                            <input type="number" min="0" step="1" value="${runway.length}" data-feature-prop="${idx}:length" />
                        </div>
                        <div class="form-row">
                            <label>Max Range (optional):</label>
                            <input type="number" min="0" step="1" value="${runway.max_range ?? ''}" data-feature-prop="${idx}:max_range" placeholder="Show only within range" />
                        </div>
                    </div>
                </details>
            `;
        } else if (feature.type === 'outline') {
            const outline = feature as OutlineFeature;
            const pointsJson = JSON.stringify(outline.points);
            return `
                <details class="item-box" data-feature-id="feature-${idx}">
                    <summary class="item-header">
                        <span>Outline (${outline.points.length} points)</span>
                        <button class="remove-button small-button" data-action="remove-local-feature" data-index="${idx}">Remove</button>
                    </summary>
                    <div class="section-content">
                        <div class="form-row">
                            <label>Points (JSON):</label>
                            <textarea class="full-width" rows="4" style="font-family: 'Courier New', monospace;" data-feature-prop="${idx}:points" placeholder='[{"lat": 63.4, "lon": 10.4}, ...]'>${this._escapeHtml(pointsJson)}</textarea>
                            <button class="small-button" data-action="draw-outline-on-map" data-index="${idx}" style="margin-top: 4px;">Draw on Map</button>
                        </div>
                        <p class="help-text">Array of {"lat": number, "lon": number} objects</p>
                        <div class="form-row">
                            <label>Max Range (optional):</label>
                            <input type="number" min="0" step="1" value="${outline.max_range ?? ''}" data-feature-prop="${idx}:max_range" placeholder="Show only within range" />
                        </div>
                    </div>
                </details>
            `;
        }
        return '';
    }

    private _renderAnnotation(annotation: AnnotationConfig, idx: number): string {
        const conditions = annotation.conditions || [];
        return `
            <details class="item-box" data-annotation-id="annotation-${idx}">
                <summary class="item-header">
                    <span>Annotation: ${annotation.field || 'Unnamed'}</span>
                    <button class="remove-button small-button" data-action="remove-annotation" data-index="${idx}">Remove</button>
                </summary>
                <div class="section-content">
                    <div class="form-row">
                        <label>Field:</label>
                        <select class="full-width" data-annotation-prop="${idx}:field">
                            <option value="">Select field...</option>
                            ${(() => {
                                const grouped = this.availableFlightFields.reduce((acc, field) => {
                                    const group = field.group || 'Other';
                                    if (!acc[group]) acc[group] = [];
                                    acc[group].push(field);
                                    return acc;
                                }, {} as Record<string, typeof this.availableFlightFields>);

                                return Object.entries(grouped).map(([group, fields]) => `
                                    <optgroup label="${group}">
                                        ${fields.map(f => `<option value="${f.value}" ${annotation.field === f.value ? 'selected' : ''}>${f.label}</option>`).join('')}
                                    </optgroup>
                                `).join('');
                            })()}
                        </select>
                    </div>
                    <div class="form-row">
                        <label>Render Template:</label>
                        <textarea class="full-width" rows="3" data-annotation-prop="${idx}:render" placeholder="HTML template with \${flight.field} placeholders">${this._escapeHtml(annotation.render || '')}</textarea>
                    </div>

                    <details data-section-id="annotation-${idx}-conditions" style="margin-top: 12px;">
                        <summary><h5>Conditions</h5></summary>
                        <div class="section-content">
                            <p class="help-text">Define when this annotation should be displayed. All conditions must match (implicit AND).</p>
                            <div id="annotation-${idx}-conditions">
                                ${conditions.length > 0 ? this._renderConditionsList(conditions, `annotate:${idx}`) : '<p class="empty-state">No conditions defined</p>'}
                            </div>
                            <div class="button-group" style="margin-top: 12px;">
                                <button class="add-button" data-action="add-annotation-condition" data-index="${idx}">Add Value Condition</button>
                                <button class="add-button" data-action="add-annotation-group" data-index="${idx}">Add AND/OR Group</button>
                                <button class="add-button" data-action="add-annotation-not" data-index="${idx}">Add NOT Condition</button>
                            </div>
                        </div>
                    </details>
                </div>
            </details>
        `;
    }

    private _renderConditionsList(conditions: Condition[], path: string): string {
        return conditions.map((condition, idx) =>
            this._renderCondition(condition, `${path}:${idx}`)
        ).join('');
    }

    private _renderCondition(condition: Condition, path: string): string {
        if ('type' in condition) {
            if (condition.type === 'NOT') {
                return this._renderNotCondition(condition as NotCondition, path);
            } else {
                return this._renderGroupCondition(condition as GroupCondition, path);
            }
        } else {
            return this._renderFieldCondition(condition as FieldCondition, path);
        }
    }

    private _renderFieldCondition(condition: FieldCondition, path: string): string {
        const description = this._getConditionDescription(condition);
        const usesDefinedField = !!condition.defined;
        const fieldType = usesDefinedField ? 'defined' : 'field';
        // Include both defines and toggles in the available defines list
        const defineKeys = Object.keys(this._config.defines || {});
        const toggleKeys = Object.keys(this._config.toggles || {});
        const availableDefines = [...defineKeys, ...toggleKeys];

        // Determine if value uses a define reference (starts with ${)
        const valueStr = this._formatValue(condition.value);
        const usesDefinedValue = typeof condition.value === 'string' && condition.value.startsWith('${') && condition.value.endsWith('}');
        const definedValueName = usesDefinedValue ? (condition.value as string).slice(2, -1) : '';

        return `
            <details class="condition-box" data-condition-path="${path}">
                <summary class="condition-summary">
                    <span class="condition-type-badge">Value</span>
                    <span class="condition-description">${description}</span>
                    <button class="remove-button" data-action="remove-condition" data-path="${path}"
                        onclick="event.preventDefault(); event.stopPropagation();">Remove</button>
                </summary>
                <div class="condition-content">
                <div class="form-row">
                    <select class="condition-field-type" data-path="${path}" data-target="field">
                        <option value="field" ${!usesDefinedField ? 'selected' : ''}>Flight Field</option>
                        <option value="defined" ${usesDefinedField ? 'selected' : ''}>Defined Value</option>
                    </select>
                    ${usesDefinedField ? (
                        availableDefines.length > 0 ? `
                            <select class="full-width condition-field" data-path="${path}" data-prop="defined">
                                <option value="">Select a define...</option>
                                ${availableDefines.map(def => {
                                    const isToggle = this._config.toggles && def in this._config.toggles;
                                    const displayValue = isToggle
                                        ? `toggle: ${this._config.toggles![def].label}`
                                        : this._formatValueForDisplay(this._config.defines![def]);
                                    return `<option value="${def}" ${condition.defined === def ? 'selected' : ''}>${def} (${displayValue})</option>`;
                                }).join('')}
                            </select>
                        ` : `
                            <input type="text" class="full-width condition-field" data-path="${path}" data-prop="defined"
                                value="${condition.defined || ''}" placeholder="e.g., max_altitude" />
                        `
                    ) : `
                        <select class="full-width condition-field" data-path="${path}" data-prop="field">
                            <option value="">Select a field...</option>
                            ${this.availableFlightFields.map((field, idx, arr) => {
                                const prevGroup = idx > 0 ? arr[idx - 1].group : null;
                                const groupHeader = field.group && field.group !== prevGroup ?
                                    `<option disabled style="font-weight: bold; font-style: italic;">— ${field.group} —</option>` : '';
                                return `${groupHeader}<option value="${field.value}" ${condition.field === field.value ? 'selected' : ''}>${field.label}</option>`;
                            }).join('')}
                        </select>
                    `}
                </div>
                <div class="form-row">
                    <label>Comparator:</label>
                    <select class="condition-field" data-path="${path}" data-prop="comparator">
                        <option value="eq" ${condition.comparator === 'eq' ? 'selected' : ''}>Equals (eq)</option>
                        <option value="lt" ${condition.comparator === 'lt' ? 'selected' : ''}>Less Than (lt)</option>
                        <option value="lte" ${condition.comparator === 'lte' ? 'selected' : ''}>Less Than or Equal (lte)</option>
                        <option value="gt" ${condition.comparator === 'gt' ? 'selected' : ''}>Greater Than (gt)</option>
                        <option value="gte" ${condition.comparator === 'gte' ? 'selected' : ''}>Greater Than or Equal (gte)</option>
                        <option value="oneOf" ${condition.comparator === 'oneOf' ? 'selected' : ''}>One Of (array)</option>
                        <option value="containsOneOf" ${condition.comparator === 'containsOneOf' ? 'selected' : ''}>Contains One Of (array)</option>
                    </select>
                </div>
                <div class="form-row">
                    <select class="condition-field-type" data-path="${path}" data-target="value">
                        <option value="direct" ${!usesDefinedValue ? 'selected' : ''}>Value</option>
                        <option value="defined" ${usesDefinedValue ? 'selected' : ''}>Defined Value</option>
                    </select>
                    ${usesDefinedValue && availableDefines.length > 0 ? `
                        <select class="full-width condition-field-value-defined" data-path="${path}">
                            <option value="" ${definedValueName === '' ? 'selected' : ''}>Select a define...</option>
                            ${availableDefines.map(def => {
                                const isToggle = this._config.toggles && def in this._config.toggles;
                                const displayValue = isToggle
                                    ? `toggle: ${this._config.toggles![def].label}`
                                    : this._formatValueForDisplay(this._config.defines![def]);
                                return `<option value="${def}" ${definedValueName === def ? 'selected' : ''}>${def} (${displayValue})</option>`;
                            }).join('')}
                        </select>
                    ` : `
                        <input type="text" class="full-width condition-field" data-path="${path}" data-prop="value"
                            value="${usesDefinedValue ? definedValueName : this._formatValue(condition.value)}" placeholder="Value or comma-separated list" />
                    `}
                </div>
                ${condition.defaultValue !== undefined ? `
                    <div class="form-row">
                        <label>Default Value:</label>
                        <input type="text" class="full-width condition-field" data-path="${path}" data-prop="defaultValue"
                            value="${this._formatValue(condition.defaultValue)}" />
                    </div>
                ` : ''}
                </div>
            </details>
        `;
    }

    private _renderGroupCondition(condition: GroupCondition, path: string): string {
        const description = this._getConditionDescription(condition);
        return `
            <details class="condition-box condition-group" data-condition-path="${path}">
                <summary class="condition-summary">
                    <span class="condition-type-badge">${condition.type}</span>
                    <span class="condition-description">${description}</span>
                    <button class="remove-button" data-action="remove-condition" data-path="${path}"
                        onclick="event.preventDefault(); event.stopPropagation();">Remove</button>
                </summary>
                <div class="condition-content">
                    <div class="form-row" style="margin-bottom: 12px;">
                        <label>Logic Type:</label>
                        <select class="condition-field" data-path="${path}" data-prop="type">
                            <option value="AND" ${condition.type === 'AND' ? 'selected' : ''}>AND (all must match)</option>
                            <option value="OR" ${condition.type === 'OR' ? 'selected' : ''}>OR (any can match)</option>
                        </select>
                    </div>
                <div class="conditions-list" style="margin-left: 16px;">
                    ${condition.conditions.length > 0
                        ? this._renderConditionsList(condition.conditions, path)
                        : '<p class="empty-state">No conditions in this group</p>'
                    }
                </div>
                <div class="button-group" style="margin-top: 8px; margin-left: 16px;">
                    <button class="small-button add-button" data-action="add-group-condition" data-path="${path}">+ Value</button>
                    <button class="small-button add-button" data-action="add-group-group" data-path="${path}">+ Group</button>
                    <button class="small-button add-button" data-action="add-group-not" data-path="${path}">+ NOT</button>
                </div>
                </div>
            </details>
        `;
    }

    private _renderNotCondition(condition: NotCondition, path: string): string {
        const description = this._getConditionDescription(condition.condition);
        return `
            <details class="condition-box condition-not" data-condition-path="${path}">
                <summary class="condition-summary">
                    <span class="condition-type-badge">NOT</span>
                    <span class="condition-description">${description}</span>
                    <button class="remove-button" data-action="remove-condition" data-path="${path}"
                        onclick="event.preventDefault(); event.stopPropagation();">Remove</button>
                </summary>
                <div class="condition-content" style="margin-left: 16px;">
                    ${this._renderCondition(condition.condition, path)}
                </div>
            </details>
        `;
    }

    private _getConditionDescription(condition: Condition): string {
        if ('type' in condition) {
            if (condition.type === 'NOT') {
                return this._getConditionDescription((condition as NotCondition).condition);
            } else {
                const group = condition as GroupCondition;
                const count = group.conditions.length;
                if (count === 0) {
                    return '(empty group)';
                }

                // Show first few conditions as preview
                const previews = group.conditions.slice(0, 2).map(c => {
                    const desc = this._getConditionDescription(c);
                    return desc.length > 30 ? desc.substring(0, 27) + '...' : desc;
                });

                const moreCount = count - previews.length;
                const preview = previews.join(` ${group.type} `);
                return moreCount > 0 ? `${preview} + ${moreCount} more` : preview;
            }
        } else {
            const field = condition as FieldCondition;
            const fieldName = field.defined ? `\${${field.defined}}` : (field.field || '(no field)');
            const op = this._getComparatorSymbol(field.comparator);
            const value = this._formatValueForDisplay(field.value);
            return `${fieldName} ${op} ${value}`;
        }
    }

    private _getComparatorSymbol(comparator: string): string {
        switch (comparator) {
            case 'eq': return '=';
            case 'lt': return '<';
            case 'lte': return '≤';
            case 'gt': return '>';
            case 'gte': return '≥';
            case 'oneOf': return 'in';
            case 'containsOneOf': return 'contains';
            default: return comparator;
        }
    }

    private _formatValueForDisplay(value: unknown): string {
        if (Array.isArray(value)) {
            if (value.length > 2) {
                return `[${value.slice(0, 2).join(', ')}, +${value.length - 2}]`;
            }
            return `[${value.join(', ')}]`;
        }
        const str = String(value ?? '');
        // Handle ${} placeholder (no define selected)
        if (str === '${}') {
            return '(select define)';
        }
        return str.length > 20 ? str.substring(0, 17) + '...' : str;
    }

    private _formatValue(value: unknown): string {
        if (Array.isArray(value)) {
            return value.join(', ');
        }
        return String(value ?? '');
    }

    private _attachEventListeners() {
        const root = this._shadowRoot;

        // Basic settings
        const flightsEntity = root.getElementById('flights-entity') as HTMLSelectElement;
        if (flightsEntity) {
            flightsEntity.addEventListener('change', (e) => {
                this._config = { ...this._config, flights_entity: (e.target as HTMLSelectElement).value };
                this._emitConfigChanged();
            });
        }

        const locationTracker = root.getElementById('location-tracker') as HTMLSelectElement;
        if (locationTracker) {
            locationTracker.addEventListener('change', (e) => {
                const value = (e.target as HTMLSelectElement).value;
                this._config = { ...this._config, location_tracker: value || undefined };
                if (value) {
                    const { location, ...rest } = this._config;
                    this._config = rest;
                }
                this._emitConfigChanged();
                this._render();
            });
        }

        // Location coords
        ['lat', 'lon'].forEach(coord => {
            const input = root.getElementById(`location-${coord}`) as HTMLInputElement;
            if (input) {
                input.addEventListener('input', (e) => {
                    const value = parseFloat((e.target as HTMLInputElement).value);
                    if (!isNaN(value)) {
                        const location = this._config.location || { lat: 0, lon: 0 };
                        this._config = { ...this._config, location: { ...location, [coord]: value } };
                        this._emitConfigChanged();
                    }
                });
            }
        });

        // Units
        ['altitude', 'speed', 'distance'].forEach(unit => {
            const select = root.getElementById(`unit-${unit}`) as HTMLSelectElement;
            if (select) {
                select.addEventListener('change', (e) => {
                    const units = this._config.units || {};
                    this._config = { ...this._config, units: { ...units, [unit]: (e.target as HTMLSelectElement).value } };
                    this._emitConfigChanged();
                    // Re-render when distance unit changes to update radar labels
                    if (unit === 'distance') {
                        this._render();
                    }
                });
            }
        });

        // Other basic settings
        const projectionInterval = root.getElementById('projection-interval') as HTMLInputElement;
        if (projectionInterval) {
            projectionInterval.addEventListener('input', (e) => {
                this._config = { ...this._config, projection_interval: parseInt((e.target as HTMLInputElement).value) };
                this._emitConfigChanged();
            });
        }

        const scale = root.getElementById('scale') as HTMLInputElement;
        if (scale) {
            scale.addEventListener('input', (e) => {
                this._config = { ...this._config, scale: parseFloat((e.target as HTMLInputElement).value) };
                this._emitConfigChanged();
            });
        }

        const maxFlights = root.getElementById('max-flights') as HTMLInputElement;
        if (maxFlights) {
            maxFlights.addEventListener('input', (e) => {
                const value = (e.target as HTMLInputElement).value;
                const parsed = parseInt(value);
                // Set to undefined if empty or invalid, otherwise use the parsed value
                this._config = { ...this._config, max_flights: (!value || isNaN(parsed) || parsed <= 0) ? undefined : parsed };
                this._emitConfigChanged();
            });
        }

        // Radar settings
        const radarShow = root.getElementById('radar-show') as HTMLInputElement;
        if (radarShow) {
            radarShow.addEventListener('change', (e) => {
                const radar = this._config.radar || {};
                const checked = (e.target as HTMLInputElement).checked;
                // Default is shown (hide = undefined/false), so only set hide when unchecked (hidden)
                const hide = checked ? undefined : true;
                this._config = { ...this._config, radar: { ...radar, hide } };
                this._emitConfigChanged();
            });
        }

        ['range', 'min-range', 'max-range', 'ring-distance'].forEach(prop => {
            const input = root.getElementById(`radar-${prop}`) as HTMLInputElement;
            if (input) {
                input.addEventListener('input', (e) => {
                    const radar = this._config.radar || {};
                    const key = prop.replace(/-/g, '_');
                    this._config = { ...this._config, radar: { ...radar, [key]: parseFloat((e.target as HTMLInputElement).value) } };
                    this._emitConfigChanged();
                });
            }
        });

        // Radar colors (new properties)
        ['background-color', 'aircraft-color', 'aircraft-selected-color', 'radar-grid-color', 'local-features-color'].forEach(prop => {
            const input = root.getElementById(`radar-${prop}`) as HTMLInputElement;
            if (input) {
                input.addEventListener('input', (e) => {
                    const radar = this._config.radar || {};
                    // Remove old property names when setting new ones for migration
                    const configCopy = { ...this._config };
                    if (prop === 'background-color' && configCopy.radar) delete configCopy.radar['primary-color'];
                    if (prop === 'aircraft-color' && configCopy.radar) delete configCopy.radar['accent-color'];
                    if ((prop === 'radar-grid-color' || prop === 'local-features-color') && configCopy.radar) delete configCopy.radar['feature-color'];
                    this._config = { ...configCopy, radar: { ...radar, [prop]: (e.target as HTMLInputElement).value } };
                    this._emitConfigChanged();
                    // Re-render if background or aircraft color changed (updates marker preview buttons)
                    if (prop === 'background-color' || prop === 'aircraft-color') {
                        this._render();
                    }
                });
            }
        });

        // Radar background opacity
        const radarBackgroundOpacity = root.getElementById('radar-background-opacity') as HTMLInputElement;
        if (radarBackgroundOpacity) {
            radarBackgroundOpacity.addEventListener('input', (e) => {
                const radar = this._config.radar || {};
                this._config = { ...this._config, radar: { ...radar, 'background-opacity': parseFloat((e.target as HTMLInputElement).value) } };
                this._emitConfigChanged();
                // Re-render to update marker preview buttons
                this._render();
            });
        }

        // Aircraft marker size selector
        root.querySelectorAll('.marker-size-option').forEach(button => {
            button.addEventListener('click', (e) => {
                const size = (e.currentTarget as HTMLElement).getAttribute('data-size');
                const radar = this._config.radar || {};
                // Only set if not 'normal' (which is the default)
                this._config = { ...this._config, radar: { ...radar, 'aircraft-marker-size': size === 'normal' ? undefined : size as any } };
                this._emitConfigChanged();
                this._render();
            });
        });

        // Radar background map
        const radarBackgroundMap = root.getElementById('radar-background-map') as HTMLSelectElement;
        if (radarBackgroundMap) {
            radarBackgroundMap.addEventListener('change', (e) => {
                const radar = this._config.radar || {};
                this._config = { ...this._config, radar: { ...radar, background_map: (e.target as HTMLSelectElement).value as any } };
                this._emitConfigChanged();
                // Re-render to show/hide API key field
                this._render();
            });
        }

        const radarBackgroundMapApiKey = root.getElementById('radar-background-map-api-key') as HTMLInputElement;
        if (radarBackgroundMapApiKey) {
            radarBackgroundMapApiKey.addEventListener('input', (e) => {
                const radar = this._config.radar || {};
                const value = (e.target as HTMLInputElement).value;
                // Only set the key if it's not empty, otherwise omit it
                this._config = { ...this._config, radar: { ...radar, background_map_api_key: value || undefined } };
                this._emitConfigChanged();
            });
        }

        const radarBackgroundMapOpacity = root.getElementById('radar-background-map-opacity') as HTMLInputElement;
        if (radarBackgroundMapOpacity) {
            radarBackgroundMapOpacity.addEventListener('input', (e) => {
                const radar = this._config.radar || {};
                this._config = { ...this._config, radar: { ...radar, background_map_opacity: parseFloat((e.target as HTMLInputElement).value) } };
                this._emitConfigChanged();
            });
        }

        // List settings
        const listShow = root.getElementById('list-show') as HTMLInputElement;
        if (listShow) {
            listShow.addEventListener('change', (e) => {
                const list = this._config.list || {};
                const checked = (e.target as HTMLInputElement).checked;
                // Default is shown (hide = undefined/false), so only set hide when unchecked (hidden)
                const hide = checked ? undefined : true;
                this._config = { ...this._config, list: { ...list, hide } };
                this._emitConfigChanged();
            });
        }

        const listShowStatus = root.getElementById('list-show-status') as HTMLInputElement;
        if (listShowStatus) {
            listShowStatus.addEventListener('change', (e) => {
                const list = this._config.list || {};
                const checked = (e.target as HTMLInputElement).checked;
                // Default is true (show status), so only set when unchecked (false)
                const showListStatus = checked ? undefined : false;
                this._config = { ...this._config, list: { ...list, showListStatus } };
                this._emitConfigChanged();
            });
        }

        const noFlightsMessage = root.getElementById('no-flights-message') as HTMLInputElement;
        if (noFlightsMessage) {
            noFlightsMessage.addEventListener('input', (e) => {
                this._config = { ...this._config, no_flights_message: (e.target as HTMLInputElement).value };
                this._emitConfigChanged();
            });
        }

        // Template dropdown button and menu
        const addTemplateButton = root.getElementById('add-template-button') as HTMLButtonElement;
        const templateDropdown = root.getElementById('template-dropdown') as HTMLElement;

        if (addTemplateButton && templateDropdown) {
            // Toggle dropdown on button click
            addTemplateButton.addEventListener('click', (e) => {
                e.stopPropagation();
                const isOpen = templateDropdown.classList.contains('open');

                // Close all other dropdowns first
                root.querySelectorAll('.template-dropdown').forEach(dd => dd.classList.remove('open'));

                if (!isOpen) {
                    templateDropdown.classList.add('open');
                }
            });

            // Handle dropdown item clicks
            templateDropdown.querySelectorAll('.template-dropdown-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const selectedKey = (e.target as HTMLElement).getAttribute('data-template-key');
                    if (!selectedKey) return;

                    const templates = this._config.templates || {};

                    if (selectedKey === '__custom__') {
                        // Create a new custom template
                        let counter = 1;
                        while (templates[`template${counter}`]) counter++;
                        this._config = { ...this._config, templates: { ...templates, [`template${counter}`]: '' } };
                    } else {
                        // Add the selected default template for overriding
                        const defaultValue = templateConfig[selectedKey];
                        this._config = { ...this._config, templates: { ...templates, [selectedKey]: defaultValue } };
                    }

                    this._emitConfigChanged();
                    this._render();

                    // Close dropdown
                    templateDropdown.classList.remove('open');
                });
            });

            // Close dropdown when clicking outside
            document.addEventListener('click', () => {
                templateDropdown.classList.remove('open');
            });
        }

        // Action buttons
        root.querySelectorAll('[data-action]').forEach(button => {
            button.addEventListener('click', (e) => {
                const action = (e.target as HTMLElement).getAttribute('data-action');
                const index = (e.target as HTMLElement).getAttribute('data-index');
                const key = (e.target as HTMLElement).getAttribute('data-key');

                if (action === 'add-sort') {
                    const sort = this._config.sort || [];
                    this._config = { ...this._config, sort: [...sort, { field: 'distance', order: 'asc' }] };
                    this._emitConfigChanged();
                    this._render();
                } else if (action === 'remove-sort' && index) {
                    const sort = [...(this._config.sort || [])];
                    sort.splice(parseInt(index), 1);
                    this._config = { ...this._config, sort: sort.length > 0 ? sort : undefined };
                    this._emitConfigChanged();
                    this._render();
                } else if (action === 'add-define') {
                    const defines = this._config.defines || {};
                    let counter = 1;
                    while (defines[`define${counter}`]) counter++;
                    this._config = { ...this._config, defines: { ...defines, [`define${counter}`]: '' } };
                    this._emitConfigChanged();
                    this._render();
                } else if (action === 'remove-define' && key) {
                    const defines = { ...this._config.defines };
                    delete defines[key];
                    this._config = { ...this._config, defines: Object.keys(defines).length > 0 ? defines : undefined };
                    this._emitConfigChanged();
                    this._render();
                } else if (action === 'add-toggle') {
                    const toggles = this._config.toggles || {};
                    let counter = 1;
                    while (toggles[`toggle${counter}`]) counter++;
                    this._config = { ...this._config, toggles: { ...toggles, [`toggle${counter}`]: { label: 'Toggle', default: false } } };
                    this._emitConfigChanged();
                    this._render();
                } else if (action === 'remove-toggle' && key) {
                    const toggles = { ...this._config.toggles };
                    delete toggles[key];
                    this._config = { ...this._config, toggles: Object.keys(toggles).length > 0 ? toggles : undefined };
                    this._emitConfigChanged();
                    this._render();
                } else if (action === 'remove-template' && key) {
                    const templates = { ...this._config.templates };
                    delete templates[key];
                    this._config = { ...this._config, templates: Object.keys(templates).length > 0 ? templates : undefined };
                    this._emitConfigChanged();
                    this._render();
                } else if (action === 'add-filter-condition') {
                    const filters = this._config.filter || [];
                    const newIndex = filters.length;
                    this._config = { ...this._config, filter: [...filters, { field: '', comparator: 'eq', value: '' }] };
                    this._openConditions.add(`filter:${newIndex}`);
                    this._emitConfigChanged();
                    this._render();
                } else if (action === 'add-filter-group') {
                    const filters = this._config.filter || [];
                    const newIndex = filters.length;
                    this._config = { ...this._config, filter: [...filters, { type: 'AND', conditions: [] }] };
                    this._openConditions.add(`filter:${newIndex}`);
                    this._emitConfigChanged();
                    this._render();
                } else if (action === 'add-filter-not') {
                    const filters = this._config.filter || [];
                    const newIndex = filters.length;
                    this._config = { ...this._config, filter: [...filters, { type: 'NOT', condition: { field: '', comparator: 'eq', value: '' } }] };
                    this._openConditions.add(`filter:${newIndex}`);
                    this._emitConfigChanged();
                    this._render();
                } else if (action === 'remove-condition') {
                    const path = (e.target as HTMLElement).getAttribute('data-path');
                    if (path) {
                        this._removeConditionAtPath(path);
                        this._emitConfigChanged();
                        this._render();
                    }
                } else if (action === 'add-group-condition') {
                    const path = (e.target as HTMLElement).getAttribute('data-path');
                    if (path) {
                        const newPath = this._addConditionToGroup(path, { field: '', comparator: 'eq', value: '' });
                        if (newPath) this._openConditions.add(newPath);
                        this._emitConfigChanged();
                        this._render();
                    }
                } else if (action === 'add-group-group') {
                    const path = (e.target as HTMLElement).getAttribute('data-path');
                    if (path) {
                        const newPath = this._addConditionToGroup(path, { type: 'AND', conditions: [] });
                        if (newPath) this._openConditions.add(newPath);
                        this._emitConfigChanged();
                        this._render();
                    }
                } else if (action === 'add-group-not') {
                    const path = (e.target as HTMLElement).getAttribute('data-path');
                    if (path) {
                        const newPath = this._addConditionToGroup(path, { type: 'NOT', condition: { field: '', comparator: 'eq', value: '' } });
                        if (newPath) this._openConditions.add(newPath);
                        this._emitConfigChanged();
                        this._render();
                    }
                } else if (action === 'add-local-feature-location') {
                    const radar = this._config.radar || {};
                    const local_features = radar.local_features || [];
                    const newIndex = local_features.length;
                    this._config = { ...this._config, radar: { ...radar, local_features: [...local_features, { type: 'location', label: '', position: { lat: 0, lon: 0 } }] } };
                    this._openFeatures.add(`feature-${newIndex}`);
                    this._emitConfigChanged();
                    this._render();
                } else if (action === 'add-local-feature-runway') {
                    const radar = this._config.radar || {};
                    const local_features = radar.local_features || [];
                    const newIndex = local_features.length;
                    this._config = { ...this._config, radar: { ...radar, local_features: [...local_features, { type: 'runway', position: { lat: 0, lon: 0 }, heading: 0, length: 0 }] } };
                    this._openFeatures.add(`feature-${newIndex}`);
                    this._emitConfigChanged();
                    this._render();
                } else if (action === 'add-local-feature-outline') {
                    const radar = this._config.radar || {};
                    const local_features = radar.local_features || [];
                    const newIndex = local_features.length;
                    this._config = { ...this._config, radar: { ...radar, local_features: [...local_features, { type: 'outline', points: [] }] } };
                    this._openFeatures.add(`feature-${newIndex}`);
                    this._emitConfigChanged();
                    this._render();
                } else if (action === 'remove-local-feature' && index) {
                    const radar = this._config.radar || {};
                    const local_features = [...(radar.local_features || [])];
                    local_features.splice(parseInt(index), 1);
                    this._config = { ...this._config, radar: { ...radar, local_features: local_features.length > 0 ? local_features : undefined } };
                    this._emitConfigChanged();
                    this._render();
                } else if (action === 'select-location-on-map' && index) {
                    this._openMapModal('location', parseInt(index));
                } else if (action === 'draw-outline-on-map' && index) {
                    this._openMapModal('outline', parseInt(index));
                } else if (action === 'add-annotation') {
                    const annotate = this._config.annotate || [];
                    const newIndex = annotate.length;
                    this._config = { ...this._config, annotate: [...annotate, { field: '', render: '', conditions: [] }] };
                    this._openAnnotations.add(`annotation-${newIndex}`);
                    this._emitConfigChanged();
                    this._render();
                } else if (action === 'remove-annotation' && index) {
                    const annotate = [...(this._config.annotate || [])];
                    annotate.splice(parseInt(index), 1);
                    this._config = { ...this._config, annotate: annotate.length > 0 ? annotate : undefined };
                    this._emitConfigChanged();
                    this._render();
                } else if (action === 'add-annotation-condition' && index) {
                    const annotate = [...(this._config.annotate || [])];
                    const idx = parseInt(index);
                    if (annotate[idx]) {
                        const newConditionIndex = (annotate[idx].conditions || []).length;
                        annotate[idx] = { ...annotate[idx], conditions: [...(annotate[idx].conditions || []), { field: '', comparator: 'eq', value: '' }] };
                        this._config = { ...this._config, annotate };
                        this._openConditions.add(`annotate:${idx}:${newConditionIndex}`);
                        this._emitConfigChanged();
                        this._render();
                    }
                } else if (action === 'add-annotation-group' && index) {
                    const annotate = [...(this._config.annotate || [])];
                    const idx = parseInt(index);
                    if (annotate[idx]) {
                        const newConditionIndex = (annotate[idx].conditions || []).length;
                        annotate[idx] = { ...annotate[idx], conditions: [...(annotate[idx].conditions || []), { type: 'AND', conditions: [] }] };
                        this._config = { ...this._config, annotate };
                        this._openConditions.add(`annotate:${idx}:${newConditionIndex}`);
                        this._emitConfigChanged();
                        this._render();
                    }
                } else if (action === 'add-annotation-not' && index) {
                    const annotate = [...(this._config.annotate || [])];
                    const idx = parseInt(index);
                    if (annotate[idx]) {
                        const newConditionIndex = (annotate[idx].conditions || []).length;
                        annotate[idx] = { ...annotate[idx], conditions: [...(annotate[idx].conditions || []), { type: 'NOT', condition: { field: '', comparator: 'eq', value: '' } }] };
                        this._config = { ...this._config, annotate };
                        this._openConditions.add(`annotate:${idx}:${newConditionIndex}`);
                        this._emitConfigChanged();
                        this._render();
                    }
                }
            });
        });

        // Runway typeahead search
        root.querySelectorAll('[data-runway-index]').forEach(input => {
            const idx = parseInt((input as HTMLElement).getAttribute('data-runway-index') as string);
            const dropdownEl = root.getElementById(`runway-dropdown-${idx}`);
            const statusEl = root.getElementById(`runway-lookup-status-${idx}`);
            let searchTimeout: number;

            input.addEventListener('input', (e) => {
                const query = (e.target as HTMLInputElement).value.trim();

                clearTimeout(searchTimeout);

                if (!query || query.length < 2) {
                    if (dropdownEl) {
                        dropdownEl.style.display = 'none';
                    }
                    if (statusEl) {
                        statusEl.textContent = '';
                    }
                    return;
                }

                // Show loading state
                if (dropdownEl) {
                    dropdownEl.innerHTML = '<div class="runway-dropdown-loading">⏳ Searching runways...</div>';
                    dropdownEl.style.display = 'block';
                }

                // Debounce search
                searchTimeout = window.setTimeout(() => {
                    searchRunways(query)
                        .then(results => {
                            if (!dropdownEl) return;

                            if (results.length === 0) {
                                dropdownEl.innerHTML = '<div class="runway-dropdown-empty">No runways found</div>';
                            } else {
                                dropdownEl.innerHTML = results.map(result =>
                                    `<div class="runway-dropdown-item" data-runway-result='${JSON.stringify(result.data)}'>${result.displayText}</div>`
                                ).join('');

                                // Add click handlers to dropdown items
                                dropdownEl.querySelectorAll('.runway-dropdown-item').forEach(item => {
                                    item.addEventListener('click', () => {
                                        const runwayData = JSON.parse((item as HTMLElement).getAttribute('data-runway-result') as string);

                                        // Update the runway feature
                                        const radar = this._config.radar || {};
                                        const local_features = [...(radar.local_features || [])];
                                        const feature = { ...local_features[idx] } as RunwayFeature;

                                        feature.position = { lat: runwayData.latitude, lon: runwayData.longitude };
                                        feature.heading = Math.round(runwayData.heading);
                                        feature.length = Math.round(runwayData.length);

                                        local_features[idx] = feature;
                                        this._config = { ...this._config, radar: { ...radar, local_features } };
                                        this._emitConfigChanged();

                                        // Update UI
                                        (input as HTMLInputElement).value = `${runwayData.airportCode} ${runwayData.runwayDesignator}`;
                                        dropdownEl.style.display = 'none';

                                        if (statusEl) {
                                            statusEl.style.color = 'var(--success-color, #43a047)';
                                            statusEl.textContent = `✓ ${runwayData.airportCode} RWY${runwayData.runwayDesignator} - ${Math.round(runwayData.length)}ft`;
                                        }

                                        // Re-render to show updated values
                                        this._render();
                                    });
                                });
                            }
                        })
                        .catch(error => {
                            if (dropdownEl) {
                                dropdownEl.innerHTML = `<div class="runway-dropdown-empty">Error: ${error.message}</div>`;
                            }
                            if (statusEl) {
                                statusEl.style.color = 'var(--error-color, #f44336)';
                                statusEl.textContent = `❌ ${error.message}`;
                            }
                        });
                }, 300);
            });

            // Close dropdown on blur (with small delay to allow click on dropdown item)
            input.addEventListener('blur', () => {
                setTimeout(() => {
                    if (dropdownEl) {
                        dropdownEl.style.display = 'none';
                    }
                }, 200);
            });
        });

        // Condition field type selector (field vs defined)
        root.querySelectorAll('.condition-field-type').forEach(select => {
            const path = (select as HTMLElement).getAttribute('data-path');
            const target = (select as HTMLElement).getAttribute('data-target');
            if (path) {
                select.addEventListener('change', (e) => {
                    const newType = (e.target as HTMLSelectElement).value;
                    if (target === 'value') {
                        this._switchConditionValueType(path, newType);
                    } else {
                        this._switchConditionFieldType(path, newType);
                    }
                    this._emitConfigChanged();
                    this._render();
                });
            }
        });

        // Condition field updates
        root.querySelectorAll('.condition-field').forEach(input => {
            const path = (input as HTMLElement).getAttribute('data-path');
            const prop = (input as HTMLElement).getAttribute('data-prop');
            if (path && prop) {
                // Update config on input (for immediate YAML update)
                input.addEventListener('input', (e) => {
                    this._updateConditionAtPath(path, prop, (e.target as HTMLInputElement | HTMLSelectElement).value);
                    this._emitConfigChanged();
                });

                // Re-render inline descriptions on blur/change (when done editing)
                const updateDescriptions = () => {
                    this._render();
                };

                if (input.tagName === 'SELECT') {
                    // Selects update immediately since they don't have typing
                    input.addEventListener('change', updateDescriptions);
                } else {
                    // Text/number inputs update on blur (when focus leaves)
                    input.addEventListener('blur', updateDescriptions);
                }
            }
        });

        // Condition value defined dropdown
        root.querySelectorAll('.condition-field-value-defined').forEach(select => {
            const path = (select as HTMLElement).getAttribute('data-path');
            if (path) {
                select.addEventListener('change', (e) => {
                    const defineName = (e.target as HTMLSelectElement).value;
                    // Set to ${defineName} if selected, or ${} if empty option selected
                    const newValue = defineName ? `\${${defineName}}` : '${}';
                    this._updateConditionAtPath(path, 'value', newValue);
                    this._emitConfigChanged();
                    this._render();
                });
            }
        });

        // Dynamic properties
        root.querySelectorAll('[data-define-value]').forEach(input => {
            input.addEventListener('input', (e) => {
                const key = (e.target as HTMLInputElement).getAttribute('data-define-value') as string;
                const defines = { ...this._config.defines };
                defines[key] = (e.target as HTMLInputElement).value;
                this._config = { ...this._config, defines };
                this._emitConfigChanged();
            });
        });

        root.querySelectorAll('[data-toggle-label]').forEach(input => {
            input.addEventListener('input', (e) => {
                const key = (e.target as HTMLInputElement).getAttribute('data-toggle-label') as string;
                const toggles = { ...this._config.toggles };
                toggles[key] = { ...toggles[key], label: (e.target as HTMLInputElement).value };
                this._config = { ...this._config, toggles };
                this._emitConfigChanged();
            });
        });

        root.querySelectorAll('[data-toggle-default]').forEach(input => {
            input.addEventListener('change', (e) => {
                const key = (e.target as HTMLInputElement).getAttribute('data-toggle-default') as string;
                const toggles = { ...this._config.toggles };
                const checked = (e.target as HTMLInputElement).checked;
                // Default is false (unchecked), so only set when checked (true)
                const defaultValue = checked ? true : undefined;
                toggles[key] = { ...toggles[key], default: defaultValue };
                this._config = { ...this._config, toggles };
                this._emitConfigChanged();
            });
        });

        root.querySelectorAll('[data-template-value]').forEach(textarea => {
            textarea.addEventListener('input', (e) => {
                const key = (e.target as HTMLTextAreaElement).getAttribute('data-template-value') as string;
                const templates = { ...this._config.templates };
                templates[key] = (e.target as HTMLTextAreaElement).value;
                this._config = { ...this._config, templates };
                this._emitConfigChanged();
            });
        });

        root.querySelectorAll('[data-sort-prop]').forEach(input => {
            input.addEventListener('input', (e) => {
                const [idx, prop] = ((e.target as HTMLElement).getAttribute('data-sort-prop') as string).split(':');
                const sort = [...(this._config.sort || [])];
                sort[parseInt(idx)] = { ...sort[parseInt(idx)], [prop]: (e.target as HTMLInputElement | HTMLSelectElement).value };
                this._config = { ...this._config, sort };
                this._emitConfigChanged();
            });
        });

        // Local features property updates
        root.querySelectorAll('[data-feature-prop]').forEach(input => {
            const attr = (input as HTMLElement).getAttribute('data-feature-prop') as string;
            const [idx, prop] = attr.split(':');

            input.addEventListener('input', (e) => {
                const radar = this._config.radar || {};
                const local_features = [...(radar.local_features || [])];
                const feature = { ...local_features[parseInt(idx)] };

                if (prop === 'label') {
                    (feature as LocationFeature).label = (e.target as HTMLInputElement).value;
                } else if (prop === 'lat') {
                    if ('position' in feature) {
                        feature.position = { ...feature.position, lat: parseFloat((e.target as HTMLInputElement).value) || 0 };
                    }
                } else if (prop === 'lon') {
                    if ('position' in feature) {
                        feature.position = { ...feature.position, lon: parseFloat((e.target as HTMLInputElement).value) || 0 };
                    }
                } else if (prop === 'heading') {
                    (feature as RunwayFeature).heading = parseFloat((e.target as HTMLInputElement).value) || 0;
                } else if (prop === 'length') {
                    (feature as RunwayFeature).length = parseFloat((e.target as HTMLInputElement).value) || 0;
                } else if (prop === 'max_range') {
                    const val = (e.target as HTMLInputElement).value;
                    feature.max_range = val ? parseFloat(val) : undefined;
                } else if (prop === 'points') {
                    try {
                        (feature as OutlineFeature).points = JSON.parse((e.target as HTMLTextAreaElement).value);
                    } catch (err) {
                        // Invalid JSON, ignore for now
                        return;
                    }
                }

                local_features[parseInt(idx)] = feature;
                this._config = { ...this._config, radar: { ...radar, local_features } };
                this._emitConfigChanged();
            });

            // Re-render on blur for label updates
            if (prop === 'label') {
                input.addEventListener('blur', () => {
                    this._render();
                });
            }
        });

        // Annotation property updates
        root.querySelectorAll('[data-annotation-prop]').forEach(input => {
            const attr = (input as HTMLElement).getAttribute('data-annotation-prop') as string;
            const [idx, prop] = attr.split(':');

            input.addEventListener('input', (e) => {
                const annotate = [...(this._config.annotate || [])];
                const annotation = { ...annotate[parseInt(idx)] };

                if (prop === 'field') {
                    annotation.field = (e.target as HTMLSelectElement).value;
                } else if (prop === 'render') {
                    annotation.render = (e.target as HTMLTextAreaElement).value;
                }

                annotate[parseInt(idx)] = annotation;
                this._config = { ...this._config, annotate };
                this._emitConfigChanged();
            });

            // Re-render on blur for field updates to update the header
            if (prop === 'field') {
                input.addEventListener('blur', () => {
                    this._render();
                });
            }
        });
    }

    private _emitConfigChanged() {
        // Set flag to prevent re-render when Home Assistant calls setConfig with the same config
        this._internalUpdate = true;
        this.dispatchEvent(new CustomEvent('config-changed', {
            detail: { config: this._config },
            bubbles: true,
            composed: true,
        }));
    }

    // Condition tree navigation helpers
    private _getConditionAtPath(path: string): { parent: Condition[] | NotCondition; index?: number; condition?: Condition } | null {
        const parts = path.split(':');
        const rootType = parts[0];

        let current: Condition[] | null = null;

        if (rootType === 'filter') {
            if (!this._config.filter) return null;
            current = this._config.filter;
        } else if (rootType === 'annotate') {
            if (!this._config.annotate || parts.length < 2) return null;
            const annotateIdx = parseInt(parts[1]);
            if (!this._config.annotate[annotateIdx]) return null;
            current = this._config.annotate[annotateIdx].conditions || [];
            // Skip the annotation index for navigation
            parts.splice(1, 1);
        } else {
            return null;
        }

        let parent: Condition[] | NotCondition = current;

        // Navigate to the parent of the target condition
        for (let i = 1; i < parts.length - 1; i++) {
            if (!current) return null;
            const idx = parseInt(parts[i]);
            const cond: Condition = current[idx];

            if (!cond) return null;

            if ('type' in cond) {
                if (cond.type === 'NOT') {
                    parent = cond;
                    current = [cond.condition];
                } else {
                    parent = current;
                    current = (cond as GroupCondition).conditions;
                }
            } else {
                return null; // Can't navigate into a field condition
            }
        }

        const lastIndex = parseInt(parts[parts.length - 1]);
        return {
            parent,
            index: lastIndex,
            condition: Array.isArray(parent) ? parent[lastIndex] : (parent as NotCondition).condition
        };
    }

    private _updateConditionAtPath(path: string, prop: string, value: string) {
        const result = this._getConditionAtPath(path);
        if (!result || !result.condition) return;

        const condition = result.condition;

        if (prop === 'type' && 'type' in condition && condition.type !== 'NOT') {
            // Update group type
            (condition as GroupCondition).type = value as 'AND' | 'OR';
        } else if (!('type' in condition)) {
            // Update field condition
            const fieldCondition = condition as FieldCondition;
            if (prop === 'field' || prop === 'defined') {
                fieldCondition[prop] = value || undefined;
            } else if (prop === 'comparator') {
                fieldCondition.comparator = value as any;
            } else if (prop === 'value' || prop === 'defaultValue') {
                fieldCondition[prop] = this._parseValue(value);
            }
        }

        // Update the config to trigger reactivity
        this._updateConditionsConfig(path);
    }

    private _updateConditionsConfig(path: string) {
        const parts = path.split(':');
        const rootType = parts[0];

        if (rootType === 'filter') {
            this._config = { ...this._config, filter: [...(this._config.filter || [])] };
        } else if (rootType === 'annotate') {
            this._config = { ...this._config, annotate: [...(this._config.annotate || [])] };
        }
    }

    private _removeConditionAtPath(path: string) {
        const result = this._getConditionAtPath(path);
        if (!result) return;

        if (Array.isArray(result.parent) && result.index !== undefined) {
            result.parent.splice(result.index, 1);
        } else if ('type' in result.parent && result.parent.type === 'NOT') {
            // Can't remove the condition from a NOT - remove the NOT itself
            // This is handled by the parent removal
            return;
        }

        // Clean up empty arrays
        const parts = path.split(':');
        const rootType = parts[0];

        if (rootType === 'filter') {
            if (this._config.filter?.length === 0) {
                const { filter, ...rest } = this._config;
                this._config = rest;
            } else {
                this._config = { ...this._config, filter: [...(this._config.filter || [])] };
            }
        } else if (rootType === 'annotate') {
            this._config = { ...this._config, annotate: [...(this._config.annotate || [])] };
        }
    }

    private _addConditionToGroup(path: string, newCondition: Condition): string | null {
        const result = this._getConditionAtPath(path);
        if (!result || !result.condition) return null;

        const condition = result.condition;

        if ('type' in condition && condition.type !== 'NOT') {
            // Add to group
            const groupCondition = condition as GroupCondition;
            const newIndex = groupCondition.conditions.length;
            groupCondition.conditions.push(newCondition);
            this._updateConditionsConfig(path);
            return `${path}:${newIndex}`;
        }
        return null;
    }

    private _switchConditionFieldType(path: string, newType: string) {
        const result = this._getConditionAtPath(path);
        if (!result || !result.condition) return;

        const condition = result.condition as FieldCondition;

        if (newType === 'defined') {
            // Switching from field to defined
            condition.defined = condition.field || '';
            delete condition.field;
        } else {
            // Switching from defined to field
            condition.field = condition.defined || '';
            delete condition.defined;
        }

        this._updateConditionsConfig(path);
    }

    private _switchConditionValueType(path: string, newType: string) {
        const result = this._getConditionAtPath(path);
        if (!result || !result.condition) return;

        const condition = result.condition as FieldCondition;
        const currentValue = condition.value;

        if (newType === 'defined') {
            // Switching from direct value to defined value
            // If current value is already in ${...} format, keep it
            if (typeof currentValue === 'string' && currentValue.startsWith('${') && currentValue.endsWith('}')) {
                // Already in defined format, keep as-is
                return;
            }
            // Set to ${} placeholder so it renders as defined mode (user will select from dropdown)
            condition.value = '${}';
        } else {
            // Switching from defined value to direct value
            // If value is in ${defineName} format, extract the define's actual value
            if (typeof currentValue === 'string' && currentValue.startsWith('${') && currentValue.endsWith('}')) {
                const defineName = currentValue.slice(2, -1);
                const defines = this._config.defines || {};
                // Use the define's value if it exists, otherwise use empty string
                condition.value = defines[defineName] !== undefined ? defines[defineName] : '';
            }
            // Otherwise, keep current value as-is
        }

        this._updateConditionsConfig(path);
    }

    private _parseValue(val: string): unknown {
        if (!val) return '';
        if (val.includes(',')) {
            return val.split(',').map(v => v.trim()).filter(v => v);
        }
        const num = parseFloat(val);
        if (!isNaN(num) && val === String(num)) return num;
        if (val === 'true') return true;
        if (val === 'false') return false;
        return val;
    }

    private _escapeHtml(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    private _getLocation(): { latitude: number; longitude: number } {
        const config = this._config;
        if (config.location_tracker && this.hass && this.hass.states && config.location_tracker in this.hass.states) {
            const attrs = this.hass.states[config.location_tracker].attributes;
            return {
                latitude: attrs.latitude as number,
                longitude: attrs.longitude as number
            };
        } else if (config.location) {
            return {
                latitude: config.location.lat,
                longitude: config.location.lon
            };
        } else if (this.hass && this.hass.config) {
            return {
                latitude: this.hass.config.latitude,
                longitude: this.hass.config.longitude
            };
        }
        return { latitude: 0, longitude: 0 };
    }

    private _openMapModal(type: 'location' | 'outline', index: number) {
        this._mapModal = { type, index, points: [] };

        // Render modal first so the container exists
        this._renderModalOverlay();

        // Ensure Leaflet CSS is loaded in shadow root
        if (!this._shadowRoot.getElementById('leaflet-css-shadow')) {
            const leafletCss = document.createElement('link');
            leafletCss.id = 'leaflet-css-shadow';
            leafletCss.rel = 'stylesheet';
            leafletCss.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
            this._shadowRoot.appendChild(leafletCss);
        }

        // Ensure Leaflet JS is loaded
        if (!(window as any).L) {
            if (!document.getElementById('leaflet-css')) {
                const leafletCssDoc = document.createElement('link');
                leafletCssDoc.id = 'leaflet-css';
                leafletCssDoc.rel = 'stylesheet';
                leafletCssDoc.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
                document.head.appendChild(leafletCssDoc);
            }

            if (!document.getElementById('leaflet-js')) {
                const leafletJs = document.createElement('script');
                leafletJs.id = 'leaflet-js';
                leafletJs.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
                leafletJs.onload = () => this._initializeMap();
                document.head.appendChild(leafletJs);
            } else {
                // Script tag exists but Leaflet not loaded yet, wait for it
                const poll = setInterval(() => {
                    if ((window as any).L) {
                        clearInterval(poll);
                        this._initializeMap();
                    }
                }, 50);
            }
        } else {
            // Use requestAnimationFrame to ensure modal is fully rendered
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    this._initializeMap();
                });
            });
        }
    }

    private _initializeMap() {
        const modal = this._shadowRoot.querySelector('.map-modal-map') as HTMLElement;
        if (!modal || !(window as any).L || !this._mapModal) return;

        // Ensure the modal container has dimensions
        const rect = modal.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
            // Modal not fully rendered yet, try again
            setTimeout(() => this._initializeMap(), 100);
            return;
        }

        // Clear any existing map instance
        modal.innerHTML = '';
        modal.removeAttribute('data-leaflet-id'); // Clear Leaflet's internal tracking

        const location = this._getLocation();
        const radar = this._config.radar || {};
        const range = radar.range || 50;

        // Create map
        const map = (window as any).L.map(modal, {
            center: [location.latitude, location.longitude],
            zoom: this._calculateZoomLevel(range),
            zoomControl: true,
            attributionControl: false
        });

        // Add tile layer
        (window as any).L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19
        }).addTo(map);

        // Add center marker
        (window as any).L.circleMarker([location.latitude, location.longitude], {
            radius: 6,
            color: '#2196f3',
            fillColor: '#2196f3',
            fillOpacity: 0.8
        }).addTo(map);

        // Add range circle
        (window as any).L.circle([location.latitude, location.longitude], {
            radius: range * 1000,
            color: '#2196f3',
            fillColor: '#2196f3',
            fillOpacity: 0.1,
            weight: 2
        }).addTo(map);

        this._mapModal.map = map;

        // Set up interactions based on type
        if (this._mapModal.type === 'location') {
            this._setupLocationSelection(map);
        } else if (this._mapModal.type === 'outline') {
            this._setupOutlineDrawing(map);
        }

        // Force map to recalculate dimensions
        setTimeout(() => map.invalidateSize(), 10);
    }

    private _calculateZoomLevel(rangeKm: number): number {
        // Rough approximation: zoom 13 ≈ 10km, zoom 11 ≈ 40km, zoom 10 ≈ 80km
        if (rangeKm <= 10) return 13;
        if (rangeKm <= 25) return 12;
        if (rangeKm <= 50) return 11;
        if (rangeKm <= 100) return 10;
        return 9;
    }

    private _setupLocationSelection(map: any) {
        const radar = this._config.radar || {};
        const features = radar.local_features || [];
        const feature = features[this._mapModal!.index] as LocationFeature;

        // Add existing marker if coordinates exist
        if (feature && feature.position.lat !== 0 && feature.position.lon !== 0) {
            this._mapModal!.marker = (window as any).L.circleMarker([feature.position.lat, feature.position.lon], {
                radius: 10,
                color: '#ff9800',
                fillColor: '#ff9800',
                fillOpacity: 0.8,
                weight: 3,
                draggable: true
            }).addTo(map);

            this._mapModal!.marker.on('dragend', () => {
                const pos = this._mapModal!.marker.getLatLng();
                this._updateLocationCoordinates(pos.lat, pos.lng);
            });
        }

        // Click to place/move marker
        map.on('click', (e: any) => {
            const lat = e.latlng.lat;
            const lon = e.latlng.lng;

            if (this._mapModal!.marker) {
                this._mapModal!.marker.setLatLng([lat, lon]);
            } else {
                this._mapModal!.marker = (window as any).L.circleMarker([lat, lon], {
                    radius: 10,
                    color: '#ff9800',
                    fillColor: '#ff9800',
                    fillOpacity: 0.8,
                    weight: 3,
                    draggable: true
                }).addTo(map);

                this._mapModal!.marker.on('dragend', () => {
                    const pos = this._mapModal!.marker.getLatLng();
                    this._updateLocationCoordinates(pos.lat, pos.lng);
                });
            }

            this._updateLocationCoordinates(lat, lon);
        });
    }

    private _setupOutlineDrawing(map: any) {
        const radar = this._config.radar || {};
        const features = radar.local_features || [];
        const feature = features[this._mapModal!.index] as OutlineFeature;

        // Initialize markers array
        this._mapModal!.markers = [];

        // Load existing outline if present
        if (feature && feature.points && feature.points.length > 0) {
            this._mapModal!.points = [...feature.points];
            this._updateOutlinePolyline(map);
        }

        // Click to add points
        map.on('click', (e: any) => {
            // Don't add point if clicking on a marker
            if (e.originalEvent.target.classList?.contains('leaflet-marker-icon') ||
                e.originalEvent.target.closest('.leaflet-marker-icon')) {
                return;
            }

            const lat = e.latlng.lat;
            const lon = e.latlng.lng;

            this._mapModal!.points!.push({ lat, lon });
            this._updateOutlinePolyline(map);
        });
    }

    private _updateLocationCoordinates(lat: number, lon: number) {
        const instructions = this._shadowRoot.querySelector('.map-modal-instructions');
        if (instructions) {
            instructions.textContent = `Location: ${lat.toFixed(4)}, ${lon.toFixed(4)} - Click "Apply" to save`;
        }
    }

    private _updateOutlinePolyline(map: any) {
        // Remove old polyline
        if (this._mapModal!.polygon) {
            this._mapModal!.polygon.remove();
        }

        // Remove old markers
        if (this._mapModal!.markers) {
            this._mapModal!.markers.forEach(m => m.remove());
            this._mapModal!.markers = [];
        }

        const points = this._mapModal!.points!;

        // Draw polyline if we have points
        if (points.length > 0) {
            const latLngs = points.map(p => [p.lat, p.lon]);
            this._mapModal!.polygon = (window as any).L.polyline(latLngs, {
                color: '#ff9800',
                weight: 3
            }).addTo(map);

            // Add draggable circle markers for each point
            points.forEach((point, idx) => {
                const marker = (window as any).L.circleMarker([point.lat, point.lon], {
                    radius: 8,
                    color: '#ff9800',
                    fillColor: '#fff',
                    fillOpacity: 1,
                    weight: 3,
                    draggable: true
                }).addTo(map);

                // Handle drag
                marker.on('drag', () => {
                    const pos = marker.getLatLng();
                    this._mapModal!.points![idx] = { lat: pos.lat, lon: pos.lng };

                    // Update polyline
                    const latLngs = this._mapModal!.points!.map(p => [p.lat, p.lon]);
                    this._mapModal!.polygon.setLatLngs(latLngs);
                });

                // Handle right-click to remove
                marker.on('contextmenu', (e: any) => {
                    e.originalEvent.preventDefault();
                    this._removeOutlinePoint(idx);
                });

                this._mapModal!.markers!.push(marker);
            });
        }

        const instructions = this._shadowRoot.querySelector('.map-modal-instructions');
        if (instructions) {
            instructions.textContent = `${points.length} points - Click to add, drag to move, right-click to remove, "Clear Last" to undo`;
        }
    }

    private _removeOutlinePoint(index: number) {
        if (this._mapModal && this._mapModal.points && index >= 0 && index < this._mapModal.points.length) {
            this._mapModal.points.splice(index, 1);
            this._updateOutlinePolyline(this._mapModal.map);
        }
    }

    private _clearLastOutlinePoint() {
        if (this._mapModal && this._mapModal.points && this._mapModal.points.length > 0) {
            this._mapModal.points.pop();
            this._updateOutlinePolyline(this._mapModal.map);
        }
    }

    private _applyMapSelection() {
        if (!this._mapModal) return;

        const radar = this._config.radar || {};
        const local_features = [...(radar.local_features || [])];
        const idx = this._mapModal.index;

        if (this._mapModal.type === 'location' && this._mapModal.marker) {
            const pos = this._mapModal.marker.getLatLng();
            const feature = { ...local_features[idx] } as LocationFeature;
            feature.position = { lat: pos.lat, lon: pos.lng };
            local_features[idx] = feature;
        } else if (this._mapModal.type === 'outline' && this._mapModal.points && this._mapModal.points.length > 0) {
            const feature = { ...local_features[idx] } as OutlineFeature;
            feature.points = [...this._mapModal.points];
            local_features[idx] = feature;
        }

        this._config = { ...this._config, radar: { ...radar, local_features } };
        this._emitConfigChanged();
        this._closeMapModal();
        this._render();
    }

    private _closeMapModal() {
        if (this._mapModal && this._mapModal.map) {
            this._mapModal.map.remove();
        }
        this._mapModal = null;
        const overlay = this._shadowRoot.querySelector('.map-modal-overlay') as HTMLElement;
        if (overlay) {
            overlay.classList.remove('open');
        }
    }

    private _renderModalOverlay() {
        let overlay = this._shadowRoot.querySelector('.map-modal-overlay') as HTMLElement;
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'map-modal-overlay';
            overlay.innerHTML = `
                <div class="map-modal">
                    <div class="map-modal-header">
                        <h3>${this._mapModal?.type === 'location' ? 'Select Location' : 'Draw Outline'}</h3>
                        <button class="small-button" data-action="close-map-modal">Close</button>
                    </div>
                    <div class="map-modal-body">
                        <div class="map-modal-map"></div>
                    </div>
                    <div class="map-modal-footer">
                        <div class="map-modal-instructions">
                            ${this._mapModal?.type === 'location' ? 'Click on the map to select a location' : 'Click on the map to add points to the outline'}
                        </div>
                        <div style="display: flex; gap: 8px;">
                            ${this._mapModal?.type === 'outline' ? '<button class="small-button" data-action="clear-last-point">Clear Last</button>' : ''}
                            <button class="small-button" data-action="close-map-modal">Cancel</button>
                            <button class="add-button small-button" data-action="apply-map-selection">Apply</button>
                        </div>
                    </div>
                </div>
            `;
            this._shadowRoot.appendChild(overlay);

            // Stop clicks inside modal from closing it
            const modal = overlay.querySelector('.map-modal') as HTMLElement;
            modal.addEventListener('click', (e) => e.stopPropagation());

            // Close on overlay click
            overlay.addEventListener('click', () => this._closeMapModal());

            // Button handlers
            overlay.querySelectorAll('[data-action]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const action = (e.target as HTMLElement).getAttribute('data-action');
                    if (action === 'close-map-modal') {
                        this._closeMapModal();
                    } else if (action === 'apply-map-selection') {
                        this._applyMapSelection();
                    } else if (action === 'clear-last-point') {
                        this._clearLastOutlinePoint();
                    }
                });
            });
        }

        overlay.classList.add('open');

        // Update UI based on current type
        const header = overlay.querySelector('.map-modal-header h3');
        if (header) {
            header.textContent = this._mapModal?.type === 'location' ? 'Select Location' : 'Draw Outline';
        }

        const instructions = overlay.querySelector('.map-modal-instructions');
        if (instructions) {
            instructions.textContent = this._mapModal?.type === 'location'
                ? 'Click on the map to select a location'
                : 'Click on the map to add points to the outline';
        }

        // Update footer buttons
        const footer = overlay.querySelector('.map-modal-footer > div:last-child');
        if (footer) {
            footer.innerHTML = `
                ${this._mapModal?.type === 'outline' ? '<button class="small-button" data-action="clear-last-point">Clear Last</button>' : ''}
                <button class="small-button" data-action="close-map-modal">Cancel</button>
                <button class="add-button small-button" data-action="apply-map-selection">Apply</button>
            `;

            // Re-attach button handlers for new buttons
            footer.querySelectorAll('[data-action]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const action = (e.target as HTMLElement).getAttribute('data-action');
                    if (action === 'close-map-modal') {
                        this._closeMapModal();
                    } else if (action === 'apply-map-selection') {
                        this._applyMapSelection();
                    } else if (action === 'clear-last-point') {
                        this._clearLastOutlinePoint();
                    }
                });
            });
        }
    }
}

customElements.define('flightradar24-card-editor', Flightradar24CardEditor);
