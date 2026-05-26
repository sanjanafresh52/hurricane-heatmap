#!/usr/bin/env node
/**
 * build-state-risk.js
 *
 * Downloads the latest NOAA HURDAT2 Atlantic best-track file, parses it,
 * filters to tropical/subtropical track points in months 7-9 (Jul-Sep),
 * and counts the number of distinct storms whose tracks pass within
 * BUFFER_KM of each US state polygon.  Writes ../state_risk.json which
 * the dashboard fetches at load time.
 *
 * Run:  cd scripts && npm install && npm run build
 */

const fs = require("fs");
const path = require("path");
const https = require("https");
const turf = require("@turf/turf");
const topojson = require("topojson-client");

const HURDAT2_INDEX = "https://www.nhc.noaa.gov/data/hurdat/";
const HURDAT2_PATTERN = /hurdat2-1851-\d{4}-\d+\.txt/g;
const US_ATLAS_URL = "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json";
const BUFFER_KM = 150;
const MONTHS = new Set([7, 8, 9]);
const STATUSES = new Set(["HU", "TS", "TD", "SS", "SD"]); // tropical & subtropical
const OUT_FILE = path.resolve(__dirname, "..", "state_risk.json");

const STATE_FIPS_TO_USPS = {
  "01":"AL","02":"AK","04":"AZ","05":"AR","06":"CA","08":"CO","09":"CT","10":"DE","11":"DC",
  "12":"FL","13":"GA","15":"HI","16":"ID","17":"IL","18":"IN","19":"IA","20":"KS","21":"KY",
  "22":"LA","23":"ME","24":"MD","25":"MA","26":"MI","27":"MN","28":"MS","29":"MO","30":"MT",
  "31":"NE","32":"NV","33":"NH","34":"NJ","35":"NM","36":"NY","37":"NC","38":"ND","39":"OH",
  "40":"OK","41":"OR","42":"PA","44":"RI","45":"SC","46":"SD","47":"TN","48":"TX","49":"UT",
  "50":"VT","51":"VA","53":"WA","54":"WV","55":"WI","56":"WY",
};

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "hurricane-heatmap/1.0" } }, (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          return fetchText(new URL(res.headers.location, url).toString()).then(resolve, reject);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`${url}: HTTP ${res.statusCode}`));
        }
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve(data));
      })
      .on("error", reject);
  });
}

async function findLatestHurdatUrl() {
  const html = await fetchText(HURDAT2_INDEX);
  const matches = Array.from(new Set(html.match(HURDAT2_PATTERN) || []));
  if (!matches.length) throw new Error("No HURDAT2 Atlantic files found in directory listing");
  matches.sort(); // lexicographic sort works because the embedded year is fixed-width
  const latest = matches[matches.length - 1];
  return new URL(latest, HURDAT2_INDEX).toString();
}

function parseHurdat2(text) {
  const lines = text.split(/\r?\n/);
  const storms = [];
  let current = null;
  for (const line of lines) {
    if (!line.trim()) continue;
    const parts = line.split(",").map((s) => s.trim());
    if (/^AL\d{6}$/.test(parts[0])) {
      current = { id: parts[0], name: parts[1], points: [] };
      storms.push(current);
    } else if (current && /^\d{8}$/.test(parts[0])) {
      const month = parseInt(parts[0].slice(4, 6), 10);
      const status = parts[3];
      if (!MONTHS.has(month)) continue;
      if (!STATUSES.has(status)) continue;
      const lat = parts[4];
      const lng = parts[5];
      const latNum = parseFloat(lat) * (lat.endsWith("S") ? -1 : 1);
      const lngNum = parseFloat(lng) * (lng.endsWith("W") ? -1 : 1);
      if (isFinite(latNum) && isFinite(lngNum)) {
        current.points.push({ lat: latNum, lng: lngNum });
      }
    }
  }
  return storms;
}

async function main() {
  console.log("Discovering latest HURDAT2 file…");
  const url = await findLatestHurdatUrl();
  console.log("  ->", url);

  console.log("Downloading HURDAT2…");
  const text = await fetchText(url);
  console.log(`  bytes: ${text.length.toLocaleString()}`);

  const storms = parseHurdat2(text).filter((s) => s.points.length > 0);
  console.log(`Storms with Jul-Sep tropical/subtropical points: ${storms.length}`);

  console.log("Fetching us-atlas (states-10m.json)…");
  const topo = JSON.parse(await fetchText(US_ATLAS_URL));
  const fc = topojson.feature(topo, topo.objects.states);

  console.log(`Buffering ${fc.features.length} states by ${BUFFER_KM} km…`);
  const buffered = [];
  for (const f of fc.features) {
    const fips = String(f.id).padStart(2, "0");
    const usps = STATE_FIPS_TO_USPS[fips];
    if (!usps) continue;
    if (usps === "AK" || usps === "HI") continue; // Atlantic basin only
    try {
      const geom = turf.buffer(f, BUFFER_KM, { units: "kilometers" });
      if (!geom) continue;
      const bbox = turf.bbox(geom);
      buffered.push({ usps, name: f.properties && f.properties.name, geom, bbox });
    } catch (e) {
      console.warn(`  buffer failed for ${usps}: ${e.message}`);
    }
  }
  console.log(`  buffered: ${buffered.length} states`);

  console.log("Intersecting storm tracks with buffered states…");
  const counts = {};
  for (const s of buffered) counts[s.usps] = new Set();

  let pointCount = 0;
  for (const storm of storms) {
    for (const p of storm.points) {
      pointCount++;
      const pt = turf.point([p.lng, p.lat]);
      for (const sb of buffered) {
        // bbox prefilter — skip the majority of state checks for each point
        if (p.lng < sb.bbox[0] || p.lng > sb.bbox[2] || p.lat < sb.bbox[1] || p.lat > sb.bbox[3]) continue;
        if (turf.booleanPointInPolygon(pt, sb.geom)) {
          counts[sb.usps].add(storm.id);
        }
      }
    }
  }
  console.log(`  tested ${pointCount.toLocaleString()} track points`);

  let max = 0;
  for (const u of Object.keys(counts)) max = Math.max(max, counts[u].size);

  const scores = {};
  const rawCounts = {};
  for (const u of Object.keys(counts)) {
    const n = counts[u].size;
    rawCounts[u] = n;
    if (n > 0 && max > 0) scores[u] = +(n / max).toFixed(3);
  }

  const out = {
    generated_at: new Date().toISOString(),
    source_url: url,
    buffer_km: BUFFER_KM,
    months: [7, 8, 9],
    statuses: Array.from(STATUSES),
    note: "scores = (count of distinct storms passing within buffer_km of state, Jul-Sep, tropical+subtropical) / max_count",
    max_count: max,
    counts: rawCounts,
    scores,
  };

  fs.writeFileSync(OUT_FILE, JSON.stringify(out, null, 2));
  console.log(`Wrote ${OUT_FILE}`);
  console.log(`  max_count=${max}, states_with_score=${Object.keys(scores).length}`);

  // Top 10 preview
  const top = Object.entries(scores).sort((a, b) => b[1] - a[1]).slice(0, 10);
  console.log("Top 10:", top.map(([k, v]) => `${k}=${v}`).join("  "));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
