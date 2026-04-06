# Build Scripts

## fetch-runway-data.js

Downloads runway data from [OurAirports](https://davidmegginson.github.io/ourairports-data/) during the build process.

**Source:** https://davidmegginson.github.io/ourairports-data/runways.csv

**Data includes:**
- Global airport runway information
- ICAO and IATA airport codes
- Runway endpoints with lat/lon coordinates
- Runway headings and lengths
- ~48,000 runway records (~3.8 MB)

**Usage:**
```bash
npm run fetch-runway-data
```

This script is automatically run as a `prebuild` hook, so it executes before every build.

**CSV Format:**
The CSV contains quoted fields with columns including:
- `airport_ident` - ICAO code (e.g., "ENVA")
- `le_ident` / `he_ident` - Runway designators (e.g., "09", "27")
- `le_latitude_deg` / `he_latitude_deg` - Endpoint coordinates
- `le_heading_degT` / `he_heading_degT` - True heading
- `length_ft` - Runway length in feet

**Why download during build?**
- Keeps the repository small (avoids committing 3.8 MB file)
- Ensures runway data is always up-to-date
- Allows fallback to remote fetch if local file unavailable
