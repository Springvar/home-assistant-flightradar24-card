# Release Notes

## v0.4.1

### Removed the `custom:flightradar24-card` backwards-compatible alias

Earlier versions kept a guarded alias that registered `custom:flightradar24-card` when that name was not yet taken. A custom element type can only be registered once, however, so the guard was a race: if this card loaded before the Flightradar24 integration's built-in card, the alias claimed the name and the integration's card failed to load with `Failed to execute 'define' on 'CustomElementRegistry': the name "flightradar24-card" has already been used` on every dashboard load.

The alias is now removed. The card only registers as **`custom:flightradar24-radar-card`** and no longer collides with the integration's card.

### Action required

Update any remaining `custom:flightradar24-card` cards on your dashboards to `custom:flightradar24-radar-card`. All other configuration options are unchanged.

## v0.3.0

### Breaking change: card type renamed to `custom:flightradar24-radar-card`

The Flightradar24 integration now ships its own built-in card registered as `custom:flightradar24-card` — the same type this card previously used. Since a custom element type can only be registered once, the two cards can no longer coexist under that name. This card is now registered as **`custom:flightradar24-radar-card`**.

### Updating your configuration

The Flightradar24 integration's built-in card now owns the `custom:flightradar24-card` type, so update every card on your dashboards to keep using this card:

The card **type** cannot be changed in the visual card editor — it has to be updated in the dashboard's raw YAML configuration:

1. Open the dashboard, click the edit (pencil) icon, then the three-dot menu (⋮) and select **Raw config editor** (or edit `ui-lovelace.yaml` directly if your dashboards use YAML mode).
2. Replace `type: custom:flightradar24-card` with `type: custom:flightradar24-radar-card`.

```yaml
type: custom:flightradar24-radar-card
```

That is the only change required — all other configuration options are unchanged.

### What's new

- Card is registered as `custom:flightradar24-radar-card`, with a guarded `custom:flightradar24-card` alias for backward compatibility.
- The card now appears in the Add card dialog's **"By entity"** suggestions for your Flightradar24 flights sensor.
- Added a live preview in the **Add card** dialog (listed as "Flightradar24 Radar Card").

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
