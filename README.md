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
```

| Name              | Description                                      | Default Value | Constraints                              |
|-------------------|--------------------------------------------------|---------------|------------------------------------------|
| `location_tracker`| Entity ID for the location tracker device.       | None          | Must be a valid device_tracker entity ID |
| `flights_entity`  | Entity ID for the Flightradar24 sensor.          | None          | Must be a valid sensor entity ID         |

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
  projection_interval: 3
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
| `projection_interval` | Interval for radar projection updates in seconds | None          | Must be a positive number |
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

## Usage

### Features

The Flightradar24 Integration Card offers the following features:

* Display real-time flight data from Flightradar24.
* Customizable radar view with range, projection interval, and colors.
* Add custom locations, runways, and geographic outlines.
* Filter flights based on various criteria.
* Annotate specific flights with custom conditions.
* Toggle options to control flight visibility.

## Support
For support, you can:

* Open an issue on the GitHub repository.
* Join the Home Assistant community forums and ask for help in the relevant threads.
* Check the documentation for more details and troubleshooting tips.

Feel free to reach out if you encounter any issues or have suggestions for improvements. Your feedback is highly appreciated!
