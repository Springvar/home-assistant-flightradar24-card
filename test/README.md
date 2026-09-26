# Test Page

## Usage

1. Start the dev server:
   ```bash
   yarn dev
   ```
   This will:
   - Watch and rebuild the card automatically when sources change (Rollup)
   - Serve the test page at `http://localhost:5173/test/index.html` (Vite)
   - Automatically open the test page in your browser

Alternatively, for one-time builds:
```bash
yarn build      # Build once
```

## Configuration

The test page loads configuration from YAML files:

- **Default**: `config.yaml` - Basic configuration with default settings
- **Custom**: Create additional YAML files and load them with `?config=filename` (without .yaml extension)

Example: `http://localhost:5173/test/index.html?config=myconfig` loads `myconfig.yaml`

## Verifying background map tile loading

OpenStreetMap rejects tile requests that arrive without a `Referer` header. Home
Assistant serves its frontend with `<meta name="referrer" content="same-origin">`,
which strips that header from cross-origin requests, so tiles used to fail with
`403 Access Blocked (Referer required)`.

The test pages above do **not** set that policy, so a plain `yarn dev` run cannot
reproduce the failure. To check it:

```bash
yarn build                  # the check runs against the built bundle
yarn test:tile-referrer
```

This runs headless, so it works over SSH. It serves the card directory itself
rather than using `yarn dev`, because a long-running dev server will serve a
stale cached bundle and the check would then pass against code that no longer
contains the fix. It reports three things:

1. **Mechanism** — serves a page carrying HA's referrer policy and an image on a
   genuinely different origin, then reads the `Referer` the image server actually
   received. Confirms the policy strips the header and that `referrerPolicy`
   restores it. Needs no external network.
2. **Card** — loads this harness with HA's policy injected and checks the
   `referrerpolicy` attribute on every real Leaflet tile, comparing current code
   against a simulated pre-fix run. Exits non-zero if the attribute is missing.
3. **Live OSM** — informational only. OSM's block is temporary and self-resolving,
   so a run with no 403s is not by itself proof the fix works.

Needs a Chrome binary: `npx puppeteer browsers install chrome`.

The Puppeteer scripts in this directory (`inspect-*.js`, `diagnose-card.js`, etc.)
run against the same dev server on port 5173. They open a visible browser window
with devtools, so they need a graphical session and will not run headless.

## Dummy Data

The test page includes realistic dummy flight data:
- Multiple aircraft with different routes and airlines
- Mock sensor entity for flightradar24 integration
- Home Assistant theming variables

You can modify the dummy data directly in `index.html` for testing different scenarios.
