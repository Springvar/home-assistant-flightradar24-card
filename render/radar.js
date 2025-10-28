export function renderRadar(cardState, toggleSelectedFlight) {
  const { flights, dimensions, selectedFlights, dom } = cardState;
  const planesContainer = dom?.planesContainer || document.getElementById("planes");
  planesContainer.innerHTML = "";

  const {
    width: radarWidth,
    height: radarHeight,
    range: radarRange,
    scaleFactor,
    centerX: radarCenterX,
    centerY: radarCenterY,
  } = dimensions;
    const clippingRange = radarRange * 1.15;

  flights
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
        if (selectedFlights && selectedFlights.includes(flight.id)) {
            plane.classList.add("selected");
          }

        plane.addEventListener("click", () => toggleSelectedFlight(flight));
        label.addEventListener("click", () => toggleSelectedFlight(flight));
          planesContainer.appendChild(plane);
        }
      });
  }
