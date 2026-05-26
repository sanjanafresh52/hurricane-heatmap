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
| State risk heatmap     | **NOAA HURDAT2** (Atlantic best-track database)                                                       | The seed table in `index.html` (`STATE_RISK_SEED`) is a placeholder. Replace it with counts derived from HURDAT2 Jul–Sep tracks intersecting / buffered against each state polygon.    |
| Active forecast cones  | **NOAA NHC** tropical REST service at `mapservices.weather.noaa.gov`, layer `4` of `NHC_tropical_weather` | Returns active Atlantic storms' forecast-cone polygons as GeoJSON. Polled every 5 minutes.                                                                                             |
| US state geometry      | `us-atlas` TopoJSON via jsDelivr (`states-10m.json`)                                                  | Decoded with `topojson-client`.                                                                                                                                                        |
| Basemap tiles          | CARTO `light_all`                                                                                     | Free positron-style tiles; OpenStreetMap attribution preserved.                                                                                                                        |

### Replacing the risk seed with real HURDAT2 data

A documentation block above `STATE_RISK_SEED` in `index.html` walks through the pipeline:

1. Download the HURDAT2 Atlantic best-track file from NHC.
2. Filter track points to months **7, 8, 9** (Jul–Sep).
3. For each US state polygon, count distinct storm IDs whose tracks pass within ~150 km of the polygon (or intersect a buffered state shape).
4. Normalize counts to a 0..1 score against the historical max.
5. Drop the resulting `{ "FL": 1.00, "LA": 0.95, ... }` table into the file.

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
