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

## Dummy Data

The test page includes realistic dummy flight data:
- Multiple aircraft with different routes and airlines
- Mock sensor entity for flightradar24 integration
- Home Assistant theming variables

You can modify the dummy data directly in `index.html` for testing different scenarios.
