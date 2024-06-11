# Flightradar24 Integration Card

Custom card to use with <a href="https://github.com/AlexandrErohin/home-assistant-flightradar24">Flightradar24 integration</a> for Home Assistant.

<img src="https://raw.githubusercontent.com/Springvar/home-assistant-flightradar24-card/master/card.png" width="35%">

## Table of Contents

1. [Introduction](#introduction)
2. [Installation](#installation)
3. [Configuration](#configuration)
   - [Basic Configuration](#basic-configuration)
   - [Advanced Configuration](#advanced-configuration)
     - [Filter](#filter-configuration)
     - [Radar](#radar-configuration)
        - [Radar features](#radar-features)
     - [Annotations](#annotation-configuration)
     - [Toggles](#toggles-configuration)
     - [Defines](#defines-configuration)
     - [Templates](#templates-configuration)
4. [Usage](#usage)
   - [Features](#features)
   - [Examples](#examples)
5. [Support](#support)

## Introduction

The Flightradar24 Integration Card allows you to display flight data from Flightradar24 in your Home Assistant dashboard. You can track flights near your location, view details about specific aircraft, and customize the display to fit your needs.

## Installation

### Prerequisites

This card is designed to work with sensor data provided by <a href="https://github.com/AlexandrErohin/home-assistant-flightradar24">Flightradar24 integration</a>.

### HACS (recommended)

Have [HACS](https://hacs.xyz/) installed, this will allow you to update easily.

[![Install quickly via a HACS link](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=Springvar&repository=home-assistant-flightradar24-card&category=plugin)

1. Go to **HACS** -> **Integrations**.
2. Add this repository ([https://github.com/Springvar/home-assistant-flightradar24-card](https://github.com/Springvar/home-assistant-flightradar24-card)) as a [custom repository](https://hacs.xyz/docs/faq/custom_repositories/)
3. Click on `+ Explore & Download Repositories`, search for `Flightradar24 Card`. 
4. Search for and select `Flightradar24 Card`. 
5. Press `DOWNLOAD` and in the next window also press `DOWNLOAD`. 
6. After download, restart Home Assistant.

### Manual

To install the card, follow these steps:

1. **Download the Card**:
   - Download the latest release from the [GitHub repository](https://github.com/your-repo/home-assistant-flightradar24-card/releases).

2. **Add to Home Assistant**:
   - Place the downloaded files in a `flightradar24` directory under your `www` directory inside your Home Assistant configuration directory.

3. **Add the Custom Card to Lovelace**:
   - Edit your Lovelace dashboard and add the custom card:
     ```yaml
     resources:
       - url: /local/flightradar24/flightradar24-card.js
         type: module
     ```

## Configuration

### Basic Configuration

To use the card, add the following configuration to your Lovelace dashboard:

```yaml
type: custom:flightradar24-card
location_tracker: device_tracker.your_device_tracker
flights_entity: sensor.flightradar24_current_in_area
projection_interval: 3
```
or
```yaml
type: custom:flightradar24-card
location:
  lat: 00.000000
  lon: 00.000000
flights_entity: sensor.flightradar24_current_in_area
projection_interval: 3
```

| Name                  | Description                                                                               | Default Value | Constraints                              |
|-----------------------|-------------------------------------------------------------------------------------------|---------------|------------------------------------------|
| `location_tracker`    | Entity ID for the location tracker device.                                                | None          | Must be a valid device_tracker entity ID |
| `location`            | Latitude and longitude of the observer. Will be used as fallback if tracker is unavailable or not provided. | None      | Must have both lat and lon |
| `flights_entity`      | Entity ID for the Flightradar24 sensor.                                                   | None          | Must be a valid sensor entity ID         |
| `projection_interval` | Interval in seconds for when to recalculate projected positions and altitude.             | None          | Number (seconds)                         |

*Note:* If location is configured, this must be within the area fetched by the (Flightradar24 Integration)["https://github.com/AlexandrErohin/home-assistant-flightradar24"]. The location would normally be the same given to the integration.

#### Units

To customize units for altitude, speed, and distance, use the units configuration option.

```yaml
units:
  altitude: m # m or ft (default ft - always FL above 17750 ft)
  speed: kmh # kmh or kts (default kts)
  distance: km # km or miles
```

| Name      | Description                         | Default Value | Constraints                |
|-----------|-------------------------------------|---------------|----------------------------|
| `altitude`| Unit for altitude                   | `ft`          | Must be `m` or `ft`        |
| `speed`   | Unit for speed                      | `kts`         | Must be `kmh` or `kts`     |
| `distance`| Unit for distance                   | `km`          | Must be `km` or `miles`    |

### Advanced Configuration

#### Filter Configuration

To filter the displayed flights, use the filter option.

```
filter:
   - type: OR
     conditions:
       - field: distance_to_tracker
         comparator: lte
         value: 15
       - type: AND
         conditions:
           - field: closest_passing_distance
             comparator: lte
             value: 15
           - field: is_approaching
             comparator: eq
             value: true
       - field: altitude
         comparator: lte
         value: 2500
```

##### Group conditions

| Name                  | Description                                  | Default Value | Constraints                         |
|-----------------------|----------------------------------------------|---------------|-------------------------------------|
| `type`                | Logical operator for the filter conditions   | None          | Must be `OR` or `AND`               |
| `conditions`          | List of filter conditions                    | None          | Must be a list of condition objects |

##### Negative condition

| Name                  | Description                                  | Default Value | Constraints               |
|-----------------------|----------------------------------------------|---------------|---------------------------|
| `type`                | Logical operator for the filter conditions   | None          | Must be `NOT`             |
| `condition`           | Condition to negate                          | None          | Must be a valid condition |

##### Field comparision condition

| Name                 | Description                                   | Default Value | Constraints                                                     |
|----------------------|-----------------------------------------------|---------------|-----------------------------------------------------------------|
| `field` or `defined` | Flight field or defined value to filter on    | None          | Must be a valid field name or defined property                  |
| `comparator`         | Comparator for the filter condition           | None          | Can be 'eq', 'lt', 'lte', 'gt', 'gte', 'oneOf', 'containsOneOf' |
| `value`              | Value to compare against                      | None          | Must be a valid value or list of values                         |

#### Radar Configuration

Configure radar settings with the radar option.

```yaml
radar:
  range: 35
  primary-color: rgb(0,200,100) // Default colors defined by theme
  feature-color: rgb(0,100,20)
```

To hide the radar:
```yaml
radar:
  hide: true
```

| Name                  | Description                                      | Default Value | Constraints               |
|-----------------------|--------------------------------------------------|---------------|---------------------------|
| `range`               | Range of the radar in kilometers                 | None          | Must be a positive number | 
| `primary-color`       | Primary color for the radar display              | None          | Must be a valid CSS color |
| `accent-color`        | Accent Color for the radar display               | None          | Must be a valid CSS color |
| `feature-color`       | Color for radar features                         | None          | Must be a valid CSS color |
| `callsign-label-color`| Color for callsign labels                        | None          | Must be a valid CSS color |
| `hide`                | Option to hide the radar                         | `false`       | Must be `true` or `false` |

##### Radar Features

###### Locations

Add locations to the radar.

```yaml
radar:
  local_features:
    - type: location
      label: Trondheim
      position:
        lat: 63.430472
        lon: 10.394964
```

| Name       | Description                                 | Default Value | Constraints                    |
|------------|---------------------------------------------|---------------|--------------------------------|
| `type`     | Type of the radar feature                   | None          | Must be `location`             |
| `label`    | Label for the location                      | None          | Must be a string               |
| `position` | Position of the location                    | None          | Must be a valid lat/lon object |

Position object:

| Name | Description               | Default Value | Constraints               |
|------|---------------------------|---------------|---------------------------|
| `lat`| Latitude of the position  | None          | Must be a valid latitude  |
| `lon`| Longitude of the position | None          | Must be a valid longitude |

###### Runways

Add runways to the radar.

```yaml
radar:
  local_features:
    - type: runway
      position:
        lat: 63.457647
        lon: 10.894486
      heading: 86.7
      length: 9052
```

| Name       | Description                                      | Default Value | Constraints                    |
|------------|--------------------------------------------------|---------------|--------------------------------|
| `type`     | Type of the radar feature                        | None          | Must be `runway`               |
| `position` | Position of the runway (one end of the rwy)      | None          | Must be a valid lat/lon object |
| `heading`  | Heading of the runway in degrees (from position) | None          | Must be a valid number         |
| `length`   | Length of the runway in feet                     | None          | Must be a positive number      |

##### Outlines

Add geographic outlines to the radar.

```yaml
radar:
  local_features:
    - type: outline
      points:
        - lat: 63.642064
          lon: 9.713992
        - lat: 63.443223
          lon: 9.974975
        - lat: 63.353184
          lon: 9.912988
```

| Name     | Description                                 | Default Value | Constraints                       |
|----------|---------------------------------------------|---------------|-----------------------------------|
| `type`   | Type of the radar feature                   | None          | Must be `outline`                 |
| `points` | List of points defining the outline         | None          | Must be a list of lat/lon objects |

#### Annotation Configuration

Control how single fields are rendered based on conditions. Add annotations to highlight certain flights based on custom criteria.

```yaml
annotate:
  - field: aircraft_registration
    render: <i>${aircraft_registration}</i>
    conditions:
      - field: aircraft_registration
        comparator: oneOf
        value: [LN-NIE,PH-EXV]
```

| Name        | Description                           | Default Value | Constraints                                |
|-------------|---------------------------------------|---------------|--------------------------------------------|
| `field`     | Flight field to be annotated          | None          | Must be a valid flight field name          |
| `render`    | Template for rendering the annotation | None          | Must be a valid javascript template string |
| `conditions`| List of conditions for annotation     | None          | Must be a list of condition objects        |

#### Toggles Configuration

Toggle buttons control flags which can be used by the filters. Add toggle buttons to dynamically control your filters.

```yaml
toggles:
  list_all:
    label: List all
    default: false
filter:
  - type: OR
    conditions:
      - defined: list_all
        defaultValue: false
        comparator: eq
        value: true
      - type: OR
        conditions:
          - field: distance_to_tracker
            comparator: lte
            value: 15
          - type: AND
            conditions:
              - field: closest_passing_distance
                comparator: lte
                value: 15
              - field: is_approaching
                comparator: eq
                value: true
          - field: altitude
            comparator: lte
            value: 2500
```

| Name        | Description                                            | Default Value | Constraints                |
|-------------|--------------------------------------------------------|---------------|----------------------------|
| `[key]:`    | key: Name of the property to be defined by this toggle | None          | Must be a string           |
|   `label`   | Label for the toggle button                            | None          | Must be a string           |
|   `default` | Default state of the toggle                            | `false`       | Must be `true` or `false`  |

#### Defines Configuration

Use the defines option to create reusable condition values.

```yaml
defines:
  aircraftsOfDisinterest:
    - Helicopter
    - LocalPilot1
filter:
  - type: NOT
    condition:
      type: OR
      conditions:
        - field: aircraft_model
          comparator: containsOneOf
          value: ${aircraftsOfDisinterest}
        - field: callsign
          comparator: containsOneOf
          value: ${aircraftsOfDisinterest}
 ```

| Name             | Description                               | Default Value | Constraints      |
|------------------|-------------------------------------------|---------------|------------------|
| `[key]: [value]` | key: Name of the property to be defined   | None          | Must be a string |
|                  | value: The value for the defined property | None          | None             |

#### Templates Configuration

The `templates` configuration option allows you to customize the HTML templates used for rendering various parts of the flight information displayed on the card. You can define your own HTML templates for different elements such as icons, flight information, aircraft information, departure and arrival details, route information, flight status, position status, and proximity information.

By default, the card comes with predefined templates for each element. However, you can override these defaults or add new templates according to your preferences.

| Template Name          | Description                                                                                 | Default Value                                                                                              |
|------------------------|---------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------|
| `img_element`          | HTML template for rendering the image element of the aircraft.                              | `<img style="float: right; width: 120px; height: auto; marginLeft: 8px; border: 1px solid black;" src="${flight.aircraft_photo_small}" />` |
| `icon`                 | Template for defining the icon to be displayed based on flight altitude and vertical speed. | `${flight.altitude > 0 ? (flight.vertical_speed > 100 ? "airplane-takeoff" : flight.vertical_speed < -100 ? "airplane-landing" : "airplane") : "airport"}` |
| `icon_element`         | HTML template for rendering the icon element.                                               | `<ha-icon style="float: left;" icon="mdi:${tpl.icon}"></ha-icon>`                                          |
| `flight_info`          | Template for displaying basic flight information like airline, flight number, and callsign. | `${[flight.airline_short, flight.flight_number, flight.callsign !== flight.flight_number ? flight.callsign : ""].filter((el) => el).join(" - ")}` |
| `flight_info_element`  | HTML template for rendering the flight information element.                                 | `<div style="font-weight: bold; padding-left: 5px; padding-top: 5px;">${tpl.flight_info}</div>`            |
| `header`               | HTML template for rendering the header section of the flight card.                          | `<div>${tpl.img_element}${tpl.icon_element}${tpl.flight_info_element}</div>`                               |
| `aircraft_info`        | Template for displaying aircraft registration and model information.                        | `${[flight.aircraft_registration, flight.aircraft_model].filter((el) => el).join(" - ")}`                  |
| `aircraft_info_element`| HTML template for rendering the aircraft information element.                               | ``${tpl.aircraft_info ? `<div style="clear: left;">${tpl.aircraft_info}</div>` : ""}``                     |
| `departure_info`       | Template for displaying departure time information.                                         | ``${flight.altitude === 0 && flight.time_scheduled_departure ? ` (${new Date(flight.time_scheduled_departure * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})` : ""}`` |
| `origin_info`          | Template for displaying origin airport information.                                         | `${[flight.airport_origin_code_iata, tpl.departure_info, flight.origin_flag].filter((el) => el).join("")}` |
| `arrival_info`         | Template for displaying arrival airport information.                                        |                                                                                                            |
| `destination_info`     | Template for displaying destination airport information.                                    | `${[flight.airport_destination_code_iata, tpl.arrival_info, flight.destination_flag].filter((el) => el).join(" ")}` |
| `route_info`           | Template for displaying the flight route information.                                       | `${[tpl.origin_info, tpl.destination_info].filter((el) => el).join(" -> ")}`                               |
| `route_element`        | HTML template for rendering the route information element.                                  | `<div>${tpl.route_info}</div>`                                                                             |
| `flight_status`        | Template for displaying flight status information like altitude, speed, and heading.        | `<div>${[flight.alt_info, flight.spd_info, flight.hdg_info].filter((el) => el).join(" - ")}</div>`         |
| `position_status`      | Template for displaying flight position status information like distance and direction.     | `<div>${[flight.dist_info, flight.direction_info].filter((el) => el).join(" - ")}</div>`                   |
| `proximity_info`       | Template for displaying proximity information when the flight is approaching.               | `<div style="font-weight: bold; font-style: italic;">${flight.is_approaching && flight.ground_speed > 70 && flight.closest_passing_distance < 15 ? `Closest Distance: ${Math.round(flight.closest_passing_distance)} ${units.distance}, ETA: ${Math.round(flight.eta_to_closest_distance)} min` : ""}</div>` |
| `flight_element`       | HTML template for rendering the complete flight element.                                    | `${tpl.header}${tpl.aircraft_info_element}${tpl.route_element}${tpl.flight_status}${tpl.position_status}${tpl.proximity_info}`|

**IMPORTANT**: The templates are evaluated in the order they appear. You can reference the result of rendered templates as `tpl.[name of template]` as long as they are defined before the template using them.

You can customize each template by providing your own HTML structure and using placeholders like `${flight.property}` to dynamically insert flight data into the template. For example, `${flight.aircraft_photo_small}` will be replaced with the URL of the small aircraft photo. Refer to the [Flightradar24 integration documentation](https://github.com/AlexandrErohin/home-assistant-flightradar24?tab=readme-ov-file#flight-fields) for a list of valid flight fields.

In addition you will find these fields defined

| Field | Description |
|-------|-------------|
| origin_flag | |
| destination_flag | |
| climb_descend_indicator | Arrow pointing up or down to indicate vertical speed exceeding 100 ft/minute |
| alt_info | Altitude given in the configured altitude unit |
| spd_info | Speed given in the configured speed unit |
| hdg_info | Rounded heading value with degree symbol |
| heading_from_tracker | Heading from tracker to flight |
| cardinal_direction_from_tracker | Cardinal direction (N, NW, W, SW, S, SE, E, NE) from tracker to flight |
| is_approaching | Boolean to indicate if the aircraft is approaching the tracker |
| approach_indicator | Arrow pointing up or down to indicate if the aircraft is approaching the tracker |
| closest_passing_distance  | Distance from tracker to calculated closest point between tracker and flight (available if is_approaching is true) in configured distance unit |
| eta_to_closest_distance   | Time until flight reaches calculated closest point between tracker and flight in minutes  |
| heading_from_tracker_to_closest_passing | Heading from tracker to calculated closest point between tracker and flight |
| is_landing   | True if the flight is approaching and has a projected landing point before closest point between tracker and flight, in which case closest_passing_distance, eta_to_closest_distance and heading_from_tracker_to_closest_passing will be calculated based on the projected landing point |

## Usage

### Features

The Flightradar24 Integration Card offers the following features:

* Display real-time flight data from Flightradar24.
* Customizable radar view with range, projection interval, and colors.
* Add custom locations, runways, and geographic outlines.
* Filter flights based on various criteria.
* Annotate specific flights with custom conditions.
* Toggle options to control flight visibility.

### Examples

**lists all aircraft in the air with a toggle button to also display aircraft on the ground (altitude <= 0)**
```yaml
type: custom:flightradar24-card
location_tracker: device_tracker.your_device_tracker
flights_entity: sensor.flightradar24_current_in_area
projection_interval: 3
toggles:
  show_on_ground:
    label: Show aircraft on the ground
    default: false
filter:
  - type: OR
    conditions:
      - field: altitude
        comparator: gt
        value: 0
      - defined: show_on_ground
        comparator: eq
        value: true
```

**lists all aircraft from a given airline ("Delta" in this example), with no radar**
```yaml
type: custom:flightradar24-card
location_tracker: device_tracker.your_device_tracker
flights_entity: sensor.flightradar24_current_in_area
projection_interval: 3
filter:
  - field: airline_short
    comparator: eq
    value: Delta
radar:
  hide: true
```

**list all approaching and overhead B747 or A380s with toggles to show/hide each of them**
```yaml
type: custom:flightradar24-card
location_tracker: device_tracker.your_device_tracker
flights_entity: sensor.flightradar24_current_in_area
projection_interval: 3
defines:
  boeing_747_icao_codes:
    - B741
    - B742
    - B743
    - BLCF
    - B74S
    - B74R
    - B748
    - B744
    - B748
toggles:
  show_b747s:
    label: Show Boeing 747s
    default: true
  show_a380s:
    label: Show A380s
    default: true
filter:
  - type: AND
    conditions:
      - type: OR
        conditions:
          - type: AND
            conditions:
              - field: aircraft_code
                comparator: oneOf
                value: ${boeing_747_icao_codes}
              - defined: show_b747s
                comparator: eq
                value: true
          - type: AND
            conditions:
              - field: aircraft_code
                comparator: eq
                value: A388
              - defined: show_a380s
                comparator: eq
                value: true
  - type: OR
    conditions:
      - field: is_approaching
        comparator: eq
        value: true
      - field: distance_to_tracker
        comparator: lt
        value: 10
```

## Support
For support, you can:

* Open an issue on the GitHub repository.
* Join the Home Assistant community forums and ask for help in the relevant threads.
* Check the documentation for more details and troubleshooting tips.

Feel free to reach out if you encounter any issues or have suggestions for improvements. Your feedback is highly appreciated!
