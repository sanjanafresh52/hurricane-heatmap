# hurricane-heatmap

Standalone single-file HTML dashboard for refrigerated-trucking hurricane risk.
Open `index.html` directly in a browser — no build step.

## Design system

### Typography
- **Headings:** Montserrat (700 primary, 600 primary, 500 secondary)
- **Body / labels / tooltips / axis text:** Open Sans (400 regular, 600 emphasis)
- **Numeric callouts:** Open Sans with tabular figures — `font-feature-settings: "tnum"` so digits align vertically
- Both fonts are loaded from Google Fonts.

### Color system

**Data ramp** — green, low → high hurricane risk:

| Stop      | Hex        | Use                                  |
|-----------|------------|--------------------------------------|
| Low tint  | `#e8f1de`  | Lowest risk fill                     |
| Mid       | `#4a8b2c`  | Mid-risk (Olive Drab)                |
| High      | `#1d3711`  | High risk (Gulf Coast, FL inland)    |
| Highest   | `#16290d`  | Highest risk (coastal Gulf/FL)       |

**Accent — `#ec7700` (Mango Tango)**: reserved for active / selected states ONLY.
- The outline of an active NHC storm cone
- A selected or flagged reefer lane
- Never used as a default fill or chrome color.

**Neutral / empty state** — grayscale, not beige:
- `#f4f4f4` — lowest neutral fill (states with no/minimal data)
- `#e5e5e5` — neutral borders
- `#9a9a9a` — neutral text

**Canvas:** white or `#fafafa`.

**Tooltip:** `#1a1a1a` background, white text, Open Sans.

## Data sources
- **State risk seed** — placeholder counts in `STATE_RISK_SEED`, intended to be replaced by counts derived from NOAA HURDAT2 (Jul–Sep, all years, storms whose track passed within N km of each state polygon).
- **Live storm cones** — polled from NOAA NHC's tropical REST service at `mapservices.weather.noaa.gov`.
- **US state geometry** — `us-atlas` TopoJSON from a CDN.

## Library loading
Leaflet and Turf are each loaded with a chain of fallback CDNs (unpkg → jsdelivr → cdnjs). The app boots only after both libraries report ready, so a single blocked CDN does not break the page.

## Editing
- **Lanes:** edit the `LANES` array near the top of `index.html`.
- **State risk seed:** edit the `STATE_RISK_SEED` table; the comment above it documents the HURDAT2 replacement.
