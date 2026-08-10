# Release Notes

## v0.3.0-pre.2

### Fixed

- The "By entity" card suggestion now returns the config with the full `custom:flightradar24-radar-card` type. Previously the prefix was missing, so picking the suggestion from the entity tab showed "Unknown type encountered".

## v0.3.0-pre.1

### Renamed card type to avoid conflict with the Flightradar24 integration

The Flightradar24 integration now ships a built-in card registered as `custom:flightradar24-card` — the same type this card used. Because a custom element name can only be registered once, the two cards could not coexist.

This card is now registered as **`custom:flightradar24-radar-card`** instead.

### Migration

Existing dashboards keep working **if the Flightradar24 integration is not installed** (the old `custom:flightradar24-card` type is kept as an alias when that name is not taken by another card).

If you **have the Flightradar24 integration installed**, the integration's card takes over the `custom:flightradar24-card` type. Update your cards to keep using this card:

1. In the dashboard editor, edit the card.
2. Change the card **Type** to `custom:flightradar24-radar-card`.
3. Or, in YAML, replace `type: custom:flightradar24-card` with `type: custom:flightradar24-radar-card`.

All other configuration options are unchanged.

### Other changes

- The card now appears in the Add card dialog's **"By entity"** suggestions for your Flightradar24 flights sensor.
- Added a preview in the **Add card** dialog (card is listed as "Flightradar24 Radar Card").
