class NearbyFlightsCard extends HTMLElement {
  _hass
  _flightsData = []
  _updateRequired = true

  radarConfig = undefined

  constructor() {
    super()

    this.attachShadow({ mode: 'open' })

    this._updateRequired = true
    this._flightsData = []
    this.config = null
    this._hass = null
  }

  setConfig(config) {
    if (!config) {
      throw new Error('Configuration is missing.')
    }

    if (!config.location_tracker) {
      throw new Error('Location tracker is missing in the configuration.')
    }

    if (!config.flights_entity) {
      throw new Error('Flights entity is missing in the configuration.')
    }

    this.config = config
    this.radar = Object.assign({}, config.radar)
    this.renderStatic()
  }

  set hass(hass) {
    const oldHass = this._hass
    this._hass = hass

    if (!oldHass) {
      this.subscribeToStateChanges(hass)
    }

    if (this._updateRequired) {
      this._updateRequired = false
      this.fetchFlightsData()
      this.renderRadarScreen()
      this.renderDynamic()
    }
  }

  renderStatic() {
    this.shadowRoot.innerHTML = ''

    this.renderStyle()

    const card = document.createElement('ha-card')
    card.id = 'flights-card'

    if (this.radar && this.radar.show !== false) {
      const radarContainer = document.createElement('div')
      radarContainer.id = 'radar-container'

      const radarInfoDisplay = document.createElement('div')
      radarInfoDisplay.id = 'radar-info'

      radarContainer.appendChild(radarInfoDisplay)

      const radar = document.createElement('div')
      radar.id = 'radar'
      radar.addEventListener('wheel', this.handleWheel.bind(this), { passive: false })
      radar.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: true })
      radar.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false })
      radar.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: true })
      radar.addEventListener('touchcancel', this.handleTouchEnd.bind(this), { passive: true })

      const radarScreen = document.createElement('div')
      radarScreen.id = 'radar-screen'
      radar.appendChild(radarScreen)

      const tracker = document.createElement('div')
      tracker.id = 'tracker'
      radar.appendChild(tracker)

      const planesContainer = document.createElement('div')
      planesContainer.id = 'planes'
      radar.appendChild(planesContainer)

      radarContainer.appendChild(radar)
      card.appendChild(radarContainer)

      requestAnimationFrame(() => {
        this.renderRadarScreen()
      })
    }

    const flightsContainer = document.createElement('div')
    flightsContainer.id = 'flights'

    card.appendChild(flightsContainer)

    this.shadowRoot.appendChild(card)
  }

  renderDynamic() {
    const flightsContainer = this.shadowRoot.getElementById('flights')
    if (!flightsContainer) return

    if (this.radar && this.radar.show !== false) {
      const radarInfoDisplay = this.shadowRoot.getElementById('radar-info')
      const radar = this.shadowRoot.getElementById('radar')
      if (radar) {
        const radarRange = this.radar.range ?? 35
        radarInfoDisplay.textContent = `Range: ${Math.round(radarRange)}km`

        requestAnimationFrame(() => {
          this.renderRadar(this._flightsData)
        })
      }
    }

    flightsContainer.innerHTML = ''
    const flightsData = this.config.filter ? this.applyFilter(this._flightsData, this.config.filter) : this._flightsData
    if (flightsData.length === 0) {
      const noFlightsMessage = document.createElement('div')
      noFlightsMessage.className = 'no-flights-message'
      noFlightsMessage.textContent = 'No flights are currently visible. Please check back later.'
      flightsContainer.appendChild(noFlightsMessage)
    } else {
      flightsData.forEach((flight) => {
        const flightElement = this.renderFlight(flight)
        flightsContainer.appendChild(flightElement)
      })
    }
  }

  renderRadarScreen() {
    const radarScreen = this.shadowRoot.getElementById('radar-screen')
    radarScreen.innerHTML = ''

    const radar = this.shadowRoot.getElementById('radar')
    if (radar) {
      const radarWidth = radar.clientWidth
      const radarHeight = radar.clientHeight
      const radarRange = this.radar.range

      const scaleFactor = radarWidth / (radarRange * 2) // Adjust based on the radar width

      const radarCenterX = radarWidth / 2
      const radarCenterY = radarHeight / 2

      const radarScreenBackground = document.createElement('div')
      radarScreenBackground.id = 'radar-screen-background'
      radarScreen.appendChild(radarScreenBackground)

      const ringDistance = 10 // Distance between rings in km
      const ringCount = Math.floor(radarRange / ringDistance)

      for (let i = 1; i <= ringCount; i++) {
        const radius = i * ringDistance * scaleFactor
        const ring = document.createElement('div')
        ring.className = 'ring'
        ring.style.width = ring.style.height = radius * 2 + 'px'
        ring.style.top = Math.floor(radarCenterY - radius) + 'px'
        ring.style.left = Math.floor(radarCenterX - radius) + 'px'
        radarScreen.appendChild(ring)
      }

      for (let angle = 0; angle < 360; angle += 45) {
        const line = document.createElement('div')
        line.className = 'dotted-line'
        line.style.transform = `rotate(${angle - 90}deg)`
        radarScreen.appendChild(line)
      }

      if (this.radar.local_features && this.hass) {
        const trackerState = this.config.test ? this.getTestTracker() : this.hass.states[this.config.location_tracker]
        if (trackerState) {
          const refLat = trackerState.attributes.latitude
          const refLon = trackerState.attributes.longitude

          this.radar.local_features.forEach((feature) => {
            if (feature.type === 'outline' && feature.points && feature.points.length > 1) {
              for (let i = 0; i < feature.points.length - 1; i++) {
                const start = feature.points[i]
                const end = feature.points[i + 1]

                const startDistance = this.haversine(refLat, refLon, start.lat, start.lon)
                const startBearing = this.calculateBearing(refLat, refLon, start.lat, start.lon)
                const endDistance = this.haversine(refLat, refLon, end.lat, end.lon)
                const endBearing = this.calculateBearing(refLat, refLon, end.lat, end.lon)

                const startX = radarCenterX + Math.cos(((startBearing - 90) * Math.PI) / 180) * startDistance * scaleFactor
                const startY = radarCenterY + Math.sin(((startBearing - 90) * Math.PI) / 180) * startDistance * scaleFactor
                const endX = radarCenterX + Math.cos(((endBearing - 90) * Math.PI) / 180) * endDistance * scaleFactor
                const endY = radarCenterY + Math.sin(((endBearing - 90) * Math.PI) / 180) * endDistance * scaleFactor

                const outlineLine = document.createElement('div')
                outlineLine.className = 'outline-line'
                outlineLine.style.width = Math.hypot(endX - startX, endY - startY) + 'px'
                outlineLine.style.height = '1px'
                outlineLine.style.top = startY + 'px'
                outlineLine.style.left = startX + 'px'
                outlineLine.style.transformOrigin = '0 0'
                outlineLine.style.transform = `rotate(${Math.atan2(endY - startY, endX - startX) * (180 / Math.PI)}deg)`

                radarScreen.appendChild(outlineLine)
              }
            } else {
              const { lat: featLat, lon: featLon } = feature.position

              const distance = this.haversine(refLat, refLon, featLat, featLon)
              const bearing = this.calculateBearing(refLat, refLon, featLat, featLon)

              const featureX = radarCenterX + Math.cos(((bearing - 90) * Math.PI) / 180) * distance * scaleFactor
              const featureY = radarCenterY + Math.sin(((bearing - 90) * Math.PI) / 180) * distance * scaleFactor

              if (feature.type === 'runway') {
                const heading = feature.heading
                const lengthFeet = feature.length

                const lengthKm = lengthFeet * 0.0003048

                const runway = document.createElement('div')
                runway.className = 'runway'
                runway.style.width = lengthKm * scaleFactor + 'px'
                runway.style.height = '1px'
                runway.style.top = featureY + 'px'
                runway.style.left = featureX + 'px'
                runway.style.transform = `rotate(${heading - 90}deg)`

                radarScreen.appendChild(runway)
              }
              if (feature.type === 'location') {
                const locationDot = document.createElement('div')
                locationDot.className = 'location-dot'
                locationDot.title = feature.label ?? 'Location'
                locationDot.style.top = featureY + 'px'
                locationDot.style.left = featureX + 'px'
                radarScreen.appendChild(locationDot)

                if (feature.label) {
                  const label = document.createElement('div')
                  label.className = 'location-label'
                  label.textContent = feature.label || 'Location'
                  radarScreen.appendChild(label)

                  const labelRect = label.getBoundingClientRect()
                  const labelWidth = labelRect.width
                  const labelHeight = labelRect.height

                  label.style.top = featureY - labelHeight - 4 + 'px'
                  label.style.left = featureX - labelWidth / 2 + 'px'
                }
              }
            }
          })
        }
      }
    }
  }

  renderRadar(flightsData) {
    const planesContainer = this.shadowRoot.getElementById('planes')
    planesContainer.innerHTML = ''

    const radar = this.shadowRoot.getElementById('radar')
    if (radar) {
      const radarWidth = radar.clientWidth
      const radarHeight = radar.clientHeight
      const radarRange = this.radar.range

      const scaleFactor = radarWidth / (radarRange * 2) // Adjust based on the radar width

      const radarCenterX = radarWidth / 2
      const radarCenterY = radarHeight / 2

      flightsData
        .slice()
        .reverse()
        .forEach((flight) => {
          const plane = document.createElement('div')
          plane.className = 'plane'

          const distance = flight.distance_to_tracker

          const x = radarCenterX + Math.cos(((flight.heading_from_tracker - 90) * Math.PI) / 180) * distance * scaleFactor
          const y = radarCenterY + Math.sin(((flight.heading_from_tracker - 90) * Math.PI) / 180) * distance * scaleFactor

          plane.style.top = y + 'px'
          plane.style.left = x + 'px'

          const arrow = document.createElement('div')
          arrow.className = 'arrow'

          arrow.style.transform = `rotate(${flight.heading}deg)` // Rotate arrow based on flight heading

          plane.appendChild(arrow)

          const label = document.createElement('div')
          label.className = 'callsign-label'
          label.textContent = flight.callsign ?? flight.aircraft_registration ?? 'n/a'

          planesContainer.appendChild(label)

          const labelRect = label.getBoundingClientRect()
          const labelWidth = labelRect.width + 3
          const labelHeight = labelRect.height + 6

          label.style.top = y - labelHeight + 'px' // Offset by the label's height
          label.style.left = x - labelWidth + 'px' // Offset by the label's width

          if (flight.altitude <= 0) {
            plane.classList.add('plane-small')
          } else {
            plane.classList.add('plane-medium')
          }

          planesContainer.appendChild(plane)
        })
    }
  }

  updateRadarRange(delta) {
    const minRange = this.radar.min_range || 1
    const maxRange = this.radar.max_range || 100
    let newRange = (this.radar.range ?? 35) + delta

    if (newRange < minRange) newRange = minRange
    if (newRange > maxRange) newRange = maxRange

    this.radar.range = newRange

    requestAnimationFrame(() => {
      this.renderRadarScreen()
    })

    this.renderDynamic()
  }

  renderFlight(flight) {
    const flightElement = document.createElement('div')
    flightElement.style.clear = 'both'
    flightElement.className = 'flight'

    const flightDetails = document.createElement('span')
    flightDetails.className = 'flight-details'

    const header = document.createElement('div')
    flightDetails.appendChild(header)

    if (flight.aircraft_photo_small) {
      const imgElement = document.createElement('img')
      imgElement.src = flight.aircraft_photo_small
      imgElement.style.float = 'right'
      imgElement.style.width = '120px'
      imgElement.style.height = 'auto'
      imgElement.style.marginLeft = '8px'
      imgElement.style.marginBottom = '8px'
      imgElement.style.border = '1px solid black'
      header.appendChild(imgElement)
    }

    const iconElement = document.createElement('ha-icon')
    iconElement.style.float = 'left'
    const iconSuffix = flight.altitude > 0 ? (flight.vertical_speed > 100 ? 'plane-takeoff' : flight.vertical_speed < -100 ? 'plane-landing' : 'plane') : 'port'
    iconElement.setAttribute('icon', `mdi:air${iconSuffix}`)
    header.appendChild(iconElement)

    const airlineInfo = document.createElement('div')
    airlineInfo.style.fontWeight = 'bold'
    airlineInfo.style.paddingLeft = '5px'
    airlineInfo.style.paddingTop = '5px'
    airlineInfo.innerHTML = [
      this.flightField(flight, 'airline_short'),
      this.flightField(flight, 'flight_number'),
      flight.callsign !== flight.flight_number ? this.flightField(flight, 'callsign') : '',
    ]
      .filter((el) => el && el !== '')
      .join(' - ')
    header.appendChild(airlineInfo)

    const aircraftInfo = document.createElement('div')
    aircraftInfo.style.clear = 'left'
    aircraftInfo.innerHTML = [this.flightField(flight, 'aircraft_registration'), this.flightField(flight, 'aircraft_model')].filter((el) => el && el !== '').join(' - ')
    flightDetails.appendChild(aircraftInfo)

    if (flight.airport_origin_city || flight.airport_destination_city) {
      const routeInfo = document.createElement('div')
      if (flight.airport_origin_city) {
        const originInfo = document.createElement('span')
        originInfo.textContent = `${flight.airport_origin_code_iata || ''}`
        if (flight.time_scheduled_departure && flight.altitude === 0) {
          originInfo.textContent += ` (${new Date(flight.time_scheduled_departure * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`
        }
        const originFlag = this.createFlagElement(flight.airport_origin_country_code, flight.airport_origin_country_name)
        routeInfo.appendChild(originInfo)
        routeInfo.appendChild(originFlag)
      }

      if (flight.airport_destination_country_code) {
        const destinationInfo = document.createElement('span')
        destinationInfo.textContent = ` -> ${flight.airport_destination_code_iata || ''}`
        const destinationFlag = this.createFlagElement(flight.airport_destination_country_code, flight.airport_destination_country_name)
        routeInfo.appendChild(destinationInfo)
        routeInfo.appendChild(destinationFlag)
      }
      flightDetails.appendChild(routeInfo)
    }

    if (flight.altitude > 0 || flight.ground_speed > 0) {
      const altSpdHdgInfo = []
      const climbDescendIndicator = Math.abs(flight.vertical_speed) > 100 ? (flight.vertical_speed > 100 ? '↑' : '↓') : ''

      if (flight.altitude >= 17750) {
        altSpdHdgInfo.push(`Alt: FL${Math.round(flight.altitude / 1000) * 10}${climbDescendIndicator}`)
      } else if (flight.altitude > 0) {
        if (this.config.units && this.config.units.altitude === 'm') {
          altSpdHdgInfo.push(`Alt: ${Math.round(flight.altitude * 0.3048)} m${climbDescendIndicator}`)
        } else {
          altSpdHdgInfo.push(`Alt: ${Math.round(flight.altitude)} ft${climbDescendIndicator}`)
        }
      }
      if (flight.ground_speed > 0) {
        if (this.config.units && this.config.units.speed === 'kmh') {
          altSpdHdgInfo.push(`Spd: ${Math.round(flight.ground_speed * 1.852)} km/h`)
        } else {
          altSpdHdgInfo.push(`Spd: ${Math.round(flight.ground_speed)} kts`)
        }
      }
      if (flight.heading !== undefined) {
        altSpdHdgInfo.push(`Hdg: ${Math.round(flight.heading)}°`)
      }
      const altSpdHdgElement = document.createElement('div')
      altSpdHdgElement.textContent = altSpdHdgInfo.join(' - ')
      flightDetails.appendChild(altSpdHdgElement)
    }

    const distanceInfo = document.createElement('div')
    distanceInfo.textContent = `Dist: ${Math.round(flight.distance_to_tracker)}${flight.ground_speed > 70 ? (flight.is_approaching ? '↓' : '↑') : ''} km - ${Math.round(
      flight.heading_from_tracker
    )}° ${flight.cardinal_direction_from_tracker}`
    const mapLink = document.createElement('a')
    mapLink.href = `https://www.google.com/maps?q=${flight.latitude},${flight.longitude}`
    mapLink.target = 'map'
    mapLink.textContent = '🔗'
    distanceInfo.appendChild(mapLink)
    flightDetails.appendChild(distanceInfo)

    if (flight.is_approaching && flight.ground_speed > 70 && flight.closest_passing_distance < 15) {
      const approachingInfo = document.createElement('div')
      approachingInfo.style.fontWeight = 'bold'
      approachingInfo.style.fontStyle = 'italic'
      approachingInfo.textContent = `Closest Distance: ${Math.round(flight.closest_passing_distance)} km, ETA: ${Math.round(flight.eta_to_closest_distance)} min`
      flightDetails.appendChild(approachingInfo)
    }

    flightElement.appendChild(flightDetails)
    return flightElement
  }

  flightField(flight, field) {
    let text = flight[field]
    if (this.config.annotate) {
      const f = Object.assign({}, flight)
      this.config.annotate
        .filter((a) => a.field === field)
        .forEach((a) => {
          if (this.applyConditions(flight, a.conditions)) {
            f[field] = a.render.replace(/\$\{([^}]*)\}/g, (_, p1) => f[p1])
          }
        })
      text = f[field]
    }
    return text
  }

  createFlagElement(countryCode, countryName) {
    const flagElement = document.createElement('img')
    flagElement.setAttribute('src', `https://flagsapi.com/${countryCode}/shiny/16.png`)
    flagElement.setAttribute('title', `${countryName}`)
    flagElement.style.position = 'relative'
    flagElement.style.top = '3px'
    flagElement.style.left = '2px'
    return flagElement
  }

  renderStyle() {
    const style = document.createElement('style')
    style.textContent = `
      #flights-card {
        padding: 16px;
      }
      #flights {
        padding: 0px;
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
      #radar-info {
        width: 15%;
        text-align: left;
        font-size: 0.9em;
        padding: 0;
        margin: 0;
      }
      #radar {
        position: relative;
        width: 70%;
        height: 0;
        margin: 0 15% 0 0;
        padding-bottom: 70%; /* Maintain aspect ratio (1:1) */
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
        background-color: var(--dark-primary-color);
        opacity: 0.05;
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
        z-index: 1;
      }
      .plane {
        position: absolute;
        translate: -50% -50%;
        z-index: 3;
      }
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
        border-bottom: 6px solid var(--accent-color);
      }
      .plane.plane-medium .arrow {
        border-left: 3px solid transparent;
        border-right: 3px solid transparent;
        border-bottom: 8px solid var(--accent-color);
      }
      .plane.plane-large .arrow {
        border-left: 4px solid transparent;
        border-right: 4px solid transparent;
        border-bottom: 16px solid var(--accent-color);
      }
      .callsign-label {
        position: absolute;
        background-color: var(--primary-background-color);
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
        border: 1px dashed var(--dark-primary-color);
        border-radius: 50%;
        pointer-events: none;
      }
      .dotted-line {
        position: absolute;
        top: 50%;
        left: 50%;
        border-bottom: 1px dotted var(--dark-primary-color);
        width: 50%;
        height: 0px;
        transform-origin: 0 0;
        pointer-events: none;
      }
      .runway {
        position: absolute;
        background-color: var(--secondary-text-color);
        height: 2px;
      }
      .location-dot {
        position: absolute;
        width: 4px;
        height: 4px;
        background-color: var(--secondary-text-color);
        border-radius: 50%;
        z-index: 1;
      }
      .location-label {
        position: absolute;
        background: none;
        line-height: 0;
        border: none;
        padding: 0px;
        font-size: 10px;
        color: var(--disabled-text-color);
        z-index: 1;
      }
      .outline-line {
        position: absolute;
        background-color: var(--dark-primary-color);
        opacity: 0.4;
      }
    `
    this.shadowRoot.appendChild(style)
  }

  getTestTracker() {
    return {
      attributes: {
        latitude: 40.697354, // Model Airplane Field, Queens, NY
        longitude: -73.868253, // Model Airplane Field, Queens, NY
      },
    }
  }

  get hass() {
    return this._hass
  }

  subscribeToStateChanges(hass) {
    if (!this.config.test && this.config.update !== false) {
      hass.connection.subscribeEvents((event) => {
        if (event.data.entity_id === this.config.flights_entity || event.data.entity_id === this.config.location_tracker) {
          this._updateRequired = true
        }
      }, 'state_changed')
    }
  }

  applyFilter(flights, filter) {
    return flights.filter((flight) => this.applyConditions(flight, filter))
  }

  applyConditions(flight, conditions) {
    if (Array.isArray(conditions)) {
      return conditions.every((condition) => this.applyCondition(flight, condition))
    } else {
      return this.applyCondition(flight, conditions)
    }
  }

  applyCondition(flight, condition) {
    const { field, _, comparator } = condition
    const value = this.resolvePlaceholders(condition.value)

    if (condition.type === 'AND') {
      return condition.conditions.every((cond) => this.applyCondition(flight, cond))
    } else if (condition.type === 'OR') {
      return condition.conditions.some((cond) => this.applyCondition(flight, cond))
    } else if (condition.type === 'NOT') {
      return !this.applyCondition(flight, condition.condition)
    } else {
      if (!(field in flight)) return false
      switch (comparator) {
        case 'eq':
          return flight[field] === value
        case 'lt':
          return flight[field] < value
        case 'lte':
          return flight[field] <= value
        case 'gt':
          return flight[field] > value
        case 'gte':
          return flight[field] >= value
        case 'oneOf': {
          const valuesArray = value !== undefined ? (Array.isArray(value) ? value : value.split(',').map((v) => v.trim())) : []
          return valuesArray.includes(flight[field])
        }
        case 'containsOneOf': {
          const valuesArray = value !== undefined ? (Array.isArray(value) ? value : value.split(',').map((v) => v.trim())) : []
          console.log("Field",field)
          console.log("Values",valuesArray)
          console.log("ContainsOneOf",valuesArray.some((val) => flight[field] && flight[field].includes(val)))
          return flight[field] && valuesArray.some((val) => flight[field].includes(val))
        }
        default:
          return false
      }
    }
  }

  resolvePlaceholders(value) {
    if (typeof value === 'string' && value.startsWith('${') && value.endsWith('}')) {
      const key = value.slice(2, -1)
      if (key in this.config.defines) {
        return this.config.defines[key]
      } else {
        console.error('Unresolved placeholder: ' + key)
        console.debug('Defines', this.config.defines)
      }
    }
    return value
  }

  fetchFlightsData() {
    if (this.config.test) {
      this._flightsData = this.getTestFlightsData()
    } else {
      this._timer = clearInterval(this._timer)
      const entityState = this.hass.states[this.config.flights_entity]
      if (entityState) {
        try {
          this._flightsData = entityState.attributes.flights ? JSON.parse(JSON.stringify(entityState.attributes.flights)) : []
        } catch (error) {
          console.error('Error fetching or parsing flight data:', error)
        }
      } else {
        console.error('Flights entity state is undefined. Check the configuration.')
      }
    }

    const { moving } = this.calculateFlightData()
    if (this.config.interpolate_interval) {
      if (moving && !this._timer) {
        clearInterval(this._timer)
        this._timer = setInterval(() => {
          if (this._hass) {
            const { interpolated } = this.calculateFlightData()
            if (interpolated) {
              this.renderDynamic()
            }
          }
        }, this.config.interpolate_interval * 1000)
      } else if (!moving) {
        clearInterval(this._timer)
      }
    }
  }

  calculateFlightData() {
    let interpolated = false
    let moving = false
    const currentTime = Date.now() / 1000

    const trackerState = this.config.test ? this.getTestTracker() : this.hass.states[this.config.location_tracker]
    if (trackerState) {
      const refLat = trackerState.attributes.latitude
      const refLon = trackerState.attributes.longitude

      this._flightsData.forEach((flight) => {
        if (!flight._timestamp) {
          flight._timestamp = currentTime
        }

        moving = moving || flight.ground_speed > 0

        const timeElapsed = currentTime - flight._timestamp
        if (timeElapsed > 1) {
          interpolated = true

          flight._timestamp = currentTime

          const newPosition = this.calculateNewPosition(flight.latitude, flight.longitude, flight.heading, ((flight.ground_speed * 1.852) / 3600) * timeElapsed)

          flight.latitude = newPosition.lat
          flight.longitude = newPosition.lon
          const newAltitude = Math.max(flight.altitude + (timeElapsed / 60) * flight.vertical_speed, 0)
          if (flight.landed || (newAltitude !== flight.altitude && newAltitude === 0)) {
            flight.landed = true
            // Assume breaking after landing
            flight.ground_speed = Math.max(flight.ground_speed - 15 * timeElapsed, 15)
          }
          flight.altitude = newAltitude
        }

        flight.distance_to_tracker = this.haversine(refLat, refLon, flight.latitude, flight.longitude)

        flight.heading_from_tracker = this.calculateBearing(refLat, refLon, flight.latitude, flight.longitude)
        flight.cardinal_direction_from_tracker = this.getCardinalDirection(flight.heading_from_tracker)
        const heading_to_tracker = (flight.heading_from_tracker + 180) % 360
        flight.is_approaching = this.isApproaching(heading_to_tracker, flight.heading)

        if (flight.is_approaching) {
          let closestPassingLatLon = this.calculateClosestPassingPoint(refLat, refLon, flight.latitude, flight.longitude, flight.heading)

          flight.closest_passing_distance = this.haversine(refLat, refLon, closestPassingLatLon.lat, closestPassingLatLon.lon)
          flight.eta_to_closest_distance = this.calculateETA(flight.latitude, flight.longitude, closestPassingLatLon.lat, closestPassingLatLon.lon, flight.ground_speed)

          // If the plane is descending, calculate time to touchdown
          if (flight.vertical_speed < 0 && flight.altitude > 0) {
            const timeToTouchdown = flight.altitude / Math.abs(flight.vertical_speed)
            const touchdownLatLon = this.calculateNewPosition(flight.latitude, flight.longitude, flight.heading, (flight.ground_speed * timeToTouchdown) / 60)
            const touchdownDistance = this.haversine(refLat, refLon, touchdownLatLon.lat, touchdownLatLon.lon)

            if (timeToTouchdown < flight.eta_to_closest_distance) {
              flight.is_landing = true
              flight.eta_to_closest_distance = timeToTouchdown
              flight.closest_passing_distance = touchdownDistance
              closestPassingLatLon = touchdownLatLon
            }
          }

          // Calculate heading from tracker to closest passing point
          flight.heading_from_tracker_to_closest_passing = Math.round(this.calculateBearing(refLat, refLon, closestPassingLatLon.lat, closestPassingLatLon.lon))
        }
      })

      this._flightsData.sort((a, b) => {
        // Check if either flight has altitude 0
        if (a.altitude === 0 && b.altitude !== 0) {
          return 1 // Move a to the end
        }
        if (a.altitude !== 0 && b.altitude === 0) {
          return -1 // Move b to the end
        }

        // If both flights have the same altitude (either both 0 or both non-zero), sort by distance
        const distanceA = a.closest_passing_distance ?? a.distance_to_tracker
        const distanceB = b.closest_passing_distance ?? b.distance_to_tracker

        return distanceA - distanceB
      })
    } else {
      console.error('Tracker state is undefined. Make sure the location tracker entity ID is correct.')
    }

    return { interpolated, moving }
  }

  haversine(lat1, lon1, lat2, lon2) {
    const R = 6371.0 // Radius of the Earth in kilometers
    const dLat = this.toRadians(lat2 - lat1)
    const dLon = this.toRadians(lon2 - lon1)
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c // Distance in kilometers
  }

  calculateBearing(lat1, lon1, lat2, lon2) {
    const dLon = this.toRadians(lon2 - lon1)
    const y = Math.sin(dLon) * Math.cos(this.toRadians(lat2))
    const x = Math.cos(this.toRadians(lat1)) * Math.sin(this.toRadians(lat2)) - Math.sin(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) * Math.cos(dLon)
    const bearing = Math.atan2(y, x)
    return (this.toDegrees(bearing) + 360) % 360 // Normalize to 0-360
  }

  toRadians(degrees) {
    return degrees * (Math.PI / 180)
  }

  toDegrees(radians) {
    return radians * (180 / Math.PI)
  }

  getCardinalDirection(bearing) {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
    const index = Math.round(bearing / 45) % 8
    return directions[index]
  }

  isApproaching(direction_to_tracker, heading) {
    const diff = Math.abs(direction_to_tracker - heading)
    return diff <= 45 || diff >= 315
  }

  calculateNewPosition(lat, lon, bearing, distance) {
    const R = 6371.0 // Radius of the Earth in kilometers
    const bearingRad = this.toRadians(bearing)
    const latRad = this.toRadians(lat)
    const lonRad = this.toRadians(lon)
    const distanceRad = distance / R

    const newLatRad = Math.asin(Math.sin(latRad) * Math.cos(distanceRad) + Math.cos(latRad) * Math.sin(distanceRad) * Math.cos(bearingRad))
    const newLonRad = lonRad + Math.atan2(Math.sin(bearingRad) * Math.sin(distanceRad) * Math.cos(latRad), Math.cos(distanceRad) - Math.sin(latRad) * Math.sin(newLatRad))

    const newLat = this.toDegrees(newLatRad)
    const newLon = this.toDegrees(newLonRad)

    return { lat: newLat, lon: newLon }
  }

  calculateClosestPassingPoint(refLat, refLon, flightLat, flightLon, heading) {
    const trackBearing = this.calculateBearing(flightLat, flightLon, refLat, refLon)
    const angle = Math.abs((heading - trackBearing + 360) % 360)

    const distanceToFlight = this.haversine(refLat, refLon, flightLat, flightLon)
    const distanceAlongPath = distanceToFlight * Math.cos(this.toRadians(angle))

    return this.calculateNewPosition(flightLat, flightLon, heading, distanceAlongPath)
  }

  calculateETA(fromLat, fromLon, toLat, toLon, groundSpeed) {
    const distance = this.haversine(fromLat, fromLon, toLat, toLon)
    if (groundSpeed === 0) {
      return Infinity
    }

    const groundSpeedKmPerMin = (groundSpeed * 1.852) / 60 // Convert knots to km/h to km/min
    const eta = distance / groundSpeedKmPerMin // ETA in minutes

    return eta
  }

  handleWheel(event) {
    event.preventDefault()
    const delta = Math.sign(event.deltaY)
    this.updateRadarRange(delta * 5)
  }
  handleTouchStart(event) {
    if (event.touches.length === 2) {
      this._initialPinchDistance = this.getPinchDistance(event.touches)
      this._initialRadarRange = this.radar.range ?? 35
    }
  }
  handleTouchMove(event) {
    if (event.touches.length === 2) {
      event.preventDefault()
      const currentPinchDistance = this.getPinchDistance(event.touches)
      if (currentPinchDistance > 0 && this._initialPinchDistance > 0) {
        const pinchRatio = currentPinchDistance / this._initialPinchDistance
        const newRadarRange = this._initialRadarRange / pinchRatio
        this.updateRadarRange(newRadarRange - (this.radar.range ?? 35))
      }
    }
  }
  handleTouchEnd() {
    this._initialPinchDistance = null
    this._initialRadarRange = null
  }
  getPinchDistance(touches) {
    const [touch1, touch2] = touches
    const dx = touch1.clientX - touch2.clientX
    const dy = touch1.clientY - touch2.clientY
    return Math.sqrt(dx * dx + dy * dy)
  }

  getTestFlightsData() {
    return [
      {
        // Flight approaching and descending but landing before passing the tracker
        callsign: 'TEST1',
        aircraft_registration: 'N12345',
        aircraft_model: 'Boeing 737',
        latitude: 40.59867, // South East of JFK
        longitude: -73.66,
        altitude: 1600,
        ground_speed: 140,
        vertical_speed: -500,
        heading: 305, // Heading northwest towards JFK runway 31R
        airline_short: 'TestAir',
        flight_number: 'TA123',
        airport_origin_city: 'Boston',
        airport_origin_country_code: 'US',
        airport_origin_country_name: 'United States',
        airport_destination_city: 'New York',
        airport_destination_country_code: 'US',
        airport_destination_country_name: 'United States',
        time_scheduled_departure: Math.floor(Date.now() / 1000) - 3600,
      },
      {
        // Flight approaching and descending but landing after passing the tracker
        callsign: 'TEST2',
        aircraft_registration: 'N67890',
        aircraft_model: 'Airbus A320',
        latitude: 40.7684, // North of JFK
        longitude: -73.8984,
        altitude: 3000,
        ground_speed: 200,
        vertical_speed: -400,
        heading: 120, // Heading southeast towards JFK
        airline_short: 'TestAir',
        flight_number: 'TA456',
        airport_origin_city: 'Philadelphia',
        airport_origin_country_code: 'US',
        airport_origin_country_name: 'United States',
        airport_destination_city: 'New York',
        airport_destination_country_code: 'US',
        airport_destination_country_name: 'United States',
        time_scheduled_departure: Math.floor(Date.now() / 1000) - 1800,
      },
      {
        // Flight leaving the tracker and ascending
        callsign: 'TEST3',
        aircraft_registration: 'N54321',
        aircraft_model: 'Cessna 172',
        latitude: 40.6413, // JFK Airport
        longitude: -73.7781,
        altitude: 1000,
        ground_speed: 120,
        vertical_speed: 400,
        heading: 45, // Heading northeast
        airline_short: 'TestAir',
        flight_number: 'TA789',
        airport_origin_city: 'New York',
        airport_origin_country_code: 'US',
        airport_origin_country_name: 'United States',
        airport_destination_city: 'Boston',
        airport_destination_country_code: 'US',
        airport_destination_country_name: 'United States',
        time_scheduled_departure: Math.floor(Date.now() / 1000) - 900,
      },
      {
        // Flight approaching and passing close at high altitude
        callsign: 'TEST4',
        aircraft_registration: 'N98765',
        aircraft_model: 'Gulfstream G550',
        latitude: 40.7831, // North of NYC
        longitude: -73.9712,
        altitude: 35000,
        ground_speed: 500,
        vertical_speed: 0,
        heading: 120, // Heading southeast
        airline_short: 'TestAir',
        flight_number: 'TA101',
        airport_origin_city: 'Miami',
        airport_origin_country_code: 'US',
        airport_origin_country_name: 'United States',
        airport_destination_city: 'Boston',
        airport_destination_country_code: 'US',
        airport_destination_country_name: 'United States',
        time_scheduled_departure: Math.floor(Date.now() / 1000) - 7200,
      },
    ]
  }
}

customElements.define('nearby-flights-card', NearbyFlightsCard)
