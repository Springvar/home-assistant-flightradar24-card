export function renderRadar(cardState) {
    const { flights, radar, selectedFlights, dimensions, dom } = cardState;

    let flightsToRender;
    if (radar && radar.filter === true) {
        flightsToRender = cardState.flightsFiltered || flights;
    } else if (radar && radar.filter && typeof radar.filter === 'object') {
        flightsToRender = applyFilter(cardState, radar.filter);
    } else {
        flightsToRender = flights;
    }

    const planesContainer = dom?.planesContainer || (cardState.mainCard?.shadowRoot && cardState.mainCard.shadowRoot.getElementById('planes'));
    if (!planesContainer) return;
    planesContainer.innerHTML = '';

    const { range: radarRange, scaleFactor, centerX: radarCenterX, centerY: radarCenterY } = dimensions;
    const clippingRange = radarRange * 1.15;

    flightsToRender
        .slice()
        .reverse()
        .forEach((flight) => {
            const distance = flight.distance_to_tracker;
            if (distance <= clippingRange) {
                const plane = document.createElement('div');
                plane.className = 'plane';

                const x = radarCenterX + Math.cos(((flight.heading_from_tracker - 90) * Math.PI) / 180) * distance * scaleFactor;
                const y = radarCenterY + Math.sin(((flight.heading_from_tracker - 90) * Math.PI) / 180) * distance * scaleFactor;

                plane.style.top = y + 'px';
                plane.style.left = x + 'px';

                const arrow = document.createElement('div');
                arrow.className = 'arrow';
                arrow.style.transform = `rotate(${flight.heading}deg)`;
                plane.appendChild(arrow);

                const label = document.createElement('div');
                label.className = 'callsign-label';
                label.textContent = flight.callsign ?? flight.aircraft_registration ?? 'n/a';
                planesContainer.appendChild(label);

                const labelRect = label.getBoundingClientRect();
                const labelWidth = labelRect.width + 3;
                const labelHeight = labelRect.height + 6;

                label.style.top = y - labelHeight + 'px';
                label.style.left = x - labelWidth + 'px';

                if (flight.altitude <= 0) {
                    plane.classList.add('plane-small');
                } else {
                    plane.classList.add('plane-medium');
                }
                if (selectedFlights && selectedFlights.includes(flight.id)) {
                    plane.classList.add('selected');
                }

                plane.addEventListener('click', () => cardState.toggleSelectedFlight(flight));
                label.addEventListener('click', () => cardState.toggleSelectedFlight(flight));
                planesContainer.appendChild(plane);
            }
        });
}
