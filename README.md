# hurricane-heatmap

Single-file HTML dashboard that visualizes **hurricane risk for refrigerated-trucking lanes** across the United States. Open `index.html` directly in a browser — no build step, no server required.

## What it shows

1. **US state-level risk heatmap** (Jul–Sep tropical-cyclone window), shaded with a green data ramp from light (`#e8f1de`) to very dark (`#16290d`). Gulf Coast and Florida are darkest; states with no/minimal data render in grayscale neutral.
2. **Live NHC storm cones.** The page polls NOAA's National Hurricane Center tropical REST service every 5 minutes and outlines active forecast cones in the accent color `#ec7700`.
3. **Reefer lane alerts.** A small editable set of trucking lanes is rendered as polylines. Each lane is tested against every active cone polygon using turf.js (`booleanIntersects`); any lane that crosses a cone is flagged in `#ec7700`.

## Design

See [`CLAUDE.md`](./CLAUDE.md) for the full design system (typography, color ramp, tooltip styling, neutral state). Headings use Montserrat; body and numeric callouts use Open Sans with tabular figures.

## Data sources

| Layer                  | Source                                                                                                | Notes                                                                                                                                                                                  |
|------------------------|--------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| State risk heatmap     | **NOAA HURDAT2** (Atlantic best-track database)                                                       | Real counts derived by `scripts/build-state-risk.js` and committed as `state_risk.json` — the dashboard fetches that at boot. Falls back to an in-file seed table if the JSON is missing. |
| Active forecast cones  | **NOAA NHC** tropical REST service at `mapservices.weather.noaa.gov`, layer `4` of `NHC_tropical_weather` | Returns active Atlantic storms' forecast-cone polygons as GeoJSON. Polled every 5 minutes.                                                                                             |
| US state geometry      | `us-atlas` TopoJSON via jsDelivr (`states-10m.json`)                                                  | Decoded with `topojson-client`.                                                                                                                                                        |
| Basemap tiles          | CARTO `light_all`                                                                                     | Free positron-style tiles; OpenStreetMap attribution preserved.                                                                                                                        |

### Regenerating `state_risk.json` from HURDAT2

The repo ships with `state_risk.json` already built (committed). To refresh it from the latest HURDAT2:

```sh
cd scripts
npm install
npm run build
```

The script (`scripts/build-state-risk.js`):

1. Scrapes `https://www.nhc.noaa.gov/data/hurdat/` for the most recent `hurdat2-1851-YYYY-*.txt` Atlantic file.
2. Parses the HURDAT2 multi-line format; keeps points in months **7, 8, 9** with tropical/subtropical status (`HU`, `TS`, `TD`, `SS`, `SD`).
3. Loads `us-atlas` `states-10m.json`, buffers each state polygon by **150 km** with `turf.buffer`.
4. For every track point, tests which buffered states contain it (bbox prefilter for speed) and records `(state, storm_id)` pairs.
5. Counts distinct storm IDs per state, normalizes by the historical max, and writes `state_risk.json` with `{ generated_at, source_url, buffer_km, months, statuses, max_count, counts, scores }`.

Current snapshot top-10 (Atlantic, 1851–2025, Jul–Sep, ≤150 km from state):

| State | Distinct storms | Normalized score |
|-------|----------------:|-----------------:|
| FL    | 244             | 1.000            |
| NC    | 195             | 0.799            |
| LA    | 178             | 0.730            |
| GA    | 163             | 0.668            |
| SC    | 153             | 0.627            |
| TX    | 149             | 0.611            |
| AL    | 147             | 0.602            |
| MS    | 137             | 0.561            |
| VA    | 129             | 0.529            |
| MD    | 79              | 0.324            |

## CORS caveat

`mapservices.weather.noaa.gov` does not always send permissive CORS headers, especially when called from `file://` origins. Symptoms:

- The page loads but the **Active storms** panel says *"No active cones from NHC (none in season, or CORS-blocked)"*, and lanes never flag.
- DevTools console shows a CORS or `net::ERR_FAILED` error against the NHC URL.

Workarounds:

- **Serve over HTTP/HTTPS** instead of opening the file directly. Any static server works (`python -m http.server`, `npx serve`, GitHub Pages).
- **Proxy the NHC endpoint** through a tiny same-origin worker if you deploy this. The endpoint is documented in `index.html` near `NHC_CONE_URL`.
- During hurricane off-season the service legitimately returns zero features; an empty list does not necessarily mean CORS is broken.

The state heatmap and lane geometry work fully offline of NHC; only the live cone overlay and lane flagging depend on that feed.

## Editing lanes

Edit the `LANES` array near the top of `index.html`. Each entry is `{ id, name, ports, waypoints: [[lat, lng], …] }`. Waypoints define the polyline; turf treats the polyline as a `LineString` for intersection tests.

## Library loading & resilience

Leaflet, Turf, and topojson-client are each loaded with a chain of fallback CDNs (unpkg → jsDelivr → cdnjs). The app boots only once Leaflet and Turf both report ready, so a single blocked CDN does not break the page.

## License

The code in this repo is provided as-is for demonstration purposes. Map and data attributions belong to their respective providers (NOAA, OpenStreetMap, CARTO, us-atlas).
