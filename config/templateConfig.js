export const templateConfig = {
  img_element:
    '${flight.aircraft_photo_small ? `<img style="float: right; width: 120px; height: auto; marginLeft: 8px; border: 1px solid black;" src="${flight.aircraft_photo_small}" />` : ""}',
  icon: '${flight.altitude > 0 ? (flight.vertical_speed > 100 ? "airplane-takeoff" : flight.vertical_speed < -100 ? "airplane-landing" : "airplane") : "airport"}',
  icon_element: '<ha-icon style="float: left;" icon="mdi:${tpl.icon}"></ha-icon>',
  flight_info: '${joinList(" - ")(flight.airline_short, flight.flight_number, flight.callsign !== flight.flight_number ? flight.callsign : "")}',
  flight_info_element: '<div style="font-weight: bold; padding-left: 5px; padding-top: 5px;">${tpl.flight_info}</div>',
  header: '<div>${tpl.img_element}${tpl.icon_element}${tpl.flight_info_element}</div>',
  aircraft_info: '${joinList(" - ")(flight.aircraft_registration, flight.aircraft_model)}',
  aircraft_info_element: '${tpl.aircraft_info ? `<div>${tpl.aircraft_info}</div>` : ""}',
  departure_info:
    '${flight.altitude === 0 && flight.time_scheduled_departure ? ` (${new Date(flight.time_scheduled_departure * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})` : ""}',
  origin_info: '${joinList("")(flight.airport_origin_code_iata, tpl.departure_info, flight.origin_flag)}',
  arrival_info: '',
  destination_info: '${joinList("")(flight.airport_destination_code_iata, tpl.arrival_info, flight.destination_flag)}',
  route_info: '${joinList(" -> ")(tpl.origin_info, tpl.destination_info)}',
  route_element: '<div>${tpl.route_info}</div>',
  alt_info: '${flight.alt_in_unit ? "Alt: " + flight.alt_in_unit + flight.climb_descend_indicator : undefined}',
  spd_info: '${flight.spd_in_unit ? "Spd: " + flight.spd_in_unit : undefined}',
  hdg_info: '${flight.heading ? "Hdg: " + flight.heading + "°" : undefined}',
  dist_info: '${flight.dist_in_unit ? "Dist: " + flight.dist_in_unit + flight.approach_indicator : undefined}',
  flight_status: '<div>${joinList(" - ")(tpl.alt_info, tpl.spd_info, tpl.hdg_info)}</div>',
  position_status: '<div>${joinList(" - ")(tpl.dist_info, flight.direction_info)}</div>',
  proximity_info:
    '<div style="font-weight: bold; font-style: italic;">${flight.is_approaching && flight.ground_speed > 70 && flight.closest_passing_distance < 15 ? `Closest Distance: ${flight.closest_passing_distance} ${units.distance}, ETA: ${flight.eta_to_closest_distance} min` : ""}</div>',
  flight_element: '${tpl.header}${tpl.aircraft_info_element}${tpl.route_element}${tpl.flight_status}${tpl.position_status}${tpl.proximity_info}',
  radar_range: 'Range: ${radar_range} ${units.distance}'
};
