# Flightradar24 Integration Card

Custom card to use with Flightradar24 integration for Home Assistant.

## Table of Contents

1. [Introduction](#introduction)
2. [Installation](#installation)
3. [Configuration](#configuration)
   - [Basic Configuration](#basic-configuration)
   - [Advanced Configuration](#advanced-configuration)
     - [Filter](#filter-configuration)
     - [Radar](#radar-configuration)
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
type: custom:nearby-flights-card
location_tracker: device_tracker.your_device_tracker
flights_entity: sensor.flightradar24_current_in_area
```

### Advanced Configuration

#### Filter Configuration

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

#### Radar Configuration

```yaml
radar:
  show: true,
  range: 35
```

#### Annotation Configuration

```yaml
annotate:
  - field: aircraft_registration
    render: <i>${aircraft_registration}</i>
    conditions:
      - field: aircraft_registration
        comparator: oneOf
        value: [LN-NIE,PH-EXV]
```

#### Toggles Configuration

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

#### Defines Configuration

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

## Usage

## Support

