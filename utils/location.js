export function getLocation(cardState) {
  if (!cardState || !cardState.config) {
    console.error("Config not set in getLocation");
    return { latitude: 0, longitude: 0 };
  }
  const { config, hass } = cardState;
  if (
    config.location_tracker &&
    hass &&
    hass.states &&
    config.location_tracker in hass.states
  ) {
    return hass.states[config.location_tracker].attributes;
  } else if (config.location) {
    return {
      latitude: config.location.lat,
      longitude: config.location.lon,
    };
  } else if (hass && hass.config) {
    return {
      latitude: hass.config.latitude,
      longitude: hass.config.longitude,
    };
  }
  return { latitude: 0, longitude: 0 };
}