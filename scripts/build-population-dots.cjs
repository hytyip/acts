// Spread each country's Christian estimate over its territory as a set of
// dots, so the globe shows how much ground a population covers rather than
// marking it with a single point.
//
// Reads the estimates already in population-data.js and takes country outlines
// from Natural Earth. Run with Node 22.19+ / 24+:
//   node --use-system-ca scripts/build-population-dots.cjs
// No downloaded JavaScript is executed. Only its JSON data is parsed.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const geographyBase = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/';
const PEOPLE_PER_DOT = 250000;

const normalize = value => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

// Pew's country names against Natural Earth's, same list the estimates use.
const aliases = {
  'Cape Verde': 'Cabo Verde', 'Czech Republic': 'Czechia',
  'Palestinian territories': 'Palestine', 'St. Lucia': 'Saint Lucia',
  'St. Vincent and the Grenadines': 'Saint Vincent and the Grenadines',
  'U.S. Virgin Islands': 'United States Virgin Islands', 'United States': 'United States of America'
};
// Territories Pew reports on their own that Natural Earth folds into a parent.
const splitTerritories = { 'Channel Islands': ['Jersey', 'Guernsey'] };

async function download(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} fetching ${url}`);
  return response.text();
}

function loadEstimates() {
  const file = path.join(__dirname, '../population-data.js');
  const context = { };
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), context);
  if (!context.CHRISTIAN_POPULATION) throw new Error('population-data.js did not define CHRISTIAN_POPULATION');
  return context.CHRISTIAN_POPULATION;
}

// Deterministic, so re-running the script does not churn the output.
function seededRandom(seed) {
  let state = 0;
  for (const character of seed) state = (state * 31 + character.charCodeAt(0)) >>> 0;
  state = state || 1;
  return () => {
    state ^= state << 13; state >>>= 0;
    state ^= state >> 17;
    state ^= state << 5; state >>>= 0;
    return state / 4294967296;
  };
}

function ringBox(ring) {
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const [lon, lat] of ring) {
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return { minLon, maxLon, minLat, maxLat };
}

// Planar shoelace, narrowed by latitude — only ever compared against other
// polygons of the same country, so an approximation is enough.
function ringArea(ring) {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    sum += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  }
  const box = ringBox(ring);
  return Math.abs(sum / 2) * Math.cos((box.minLat + box.maxLat) / 2 * Math.PI / 180);
}

function inRing(lon, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function polygonsOf(feature) {
  const geometry = feature.geometry;
  const raw = geometry.type === 'Polygon' ? [geometry.coordinates]
    : geometry.type === 'MultiPolygon' ? geometry.coordinates : [];
  return raw.map(rings => ({ rings, box: ringBox(rings[0]), area: ringArea(rings[0]) }))
    .filter(polygon => polygon.area > 0);
}

// Uniform over the sphere: longitude is even, latitude is even in sin(lat),
// otherwise dots bunch toward the poles.
function samplePolygon(polygon, random) {
  const { minLon, maxLon, minLat, maxLat } = polygon.box;
  const sinLow = Math.sin(minLat * Math.PI / 180), sinHigh = Math.sin(maxLat * Math.PI / 180);
  for (let attempt = 0; attempt < 400; attempt++) {
    const lon = minLon + random() * (maxLon - minLon);
    const lat = Math.asin(sinLow + random() * (sinHigh - sinLow)) * 180 / Math.PI;
    if (!inRing(lon, lat, polygon.rings[0])) continue;
    let inHole = false;
    for (let i = 1; i < polygon.rings.length; i++) if (inRing(lon, lat, polygon.rings[i])) { inHole = true; break; }
    if (!inHole) return [lat, lon];
  }
  return null;
}

function scatter(polygons, wanted, random, fallback) {
  const total = polygons.reduce((sum, polygon) => sum + polygon.area, 0);
  const dots = [];
  for (let i = 0; i < wanted; i++) {
    let choice = polygons[0];
    let target = random() * total;
    for (const polygon of polygons) {
      target -= polygon.area;
      if (target <= 0) { choice = polygon; break; }
    }
    dots.push(samplePolygon(choice, random) || fallback);
  }
  return dots;
}

async function main() {
  const data = loadEstimates();
  const [countriesJson, unitsJson] = await Promise.all([
    download(geographyBase + 'ne_50m_admin_0_countries.geojson'),
    download(geographyBase + 'ne_50m_admin_0_map_units.geojson')
  ]);
  const features = [...JSON.parse(countriesJson).features, ...JSON.parse(unitsJson).features];
  const byName = new Map();
  for (const feature of features) {
    for (const key of ['NAME', 'ADMIN', 'GEOUNIT', 'NAME_LONG']) {
      const value = feature.properties[key];
      if (value && !byName.has(normalize(value))) byName.set(normalize(value), feature);
    }
  }

  const round = value => Math.round(value * 100) / 100;
  const output = {};
  let totalDots = 0, withoutOutline = [];

  for (const country of data.countries) {
    const names = splitTerritories[country.name] || [aliases[country.name] || country.name];
    const polygons = names.flatMap(name => {
      const feature = byName.get(normalize(name));
      return feature ? polygonsOf(feature) : [];
    });
    const wanted = Math.max(1, Math.round(country.count / PEOPLE_PER_DOT));
    const fallback = [country.lat, country.lon];
    const random = seededRandom(country.name);
    const dots = polygons.length ? scatter(polygons, wanted, random, fallback)
      : Array.from({ length: wanted }, () => fallback);
    if (!polygons.length) withoutOutline.push(country.name);
    output[country.name] = dots.flatMap(([lat, lon]) => [round(lat), round(lon)]);
    totalDots += dots.length;
  }

  const body = Object.entries(output)
    .map(([name, coords]) => '  ' + JSON.stringify(name) + ': [' + coords.join(',') + ']')
    .join(',\n');
  const file = '/* Dot positions for the Christian population layer, one dot per '
    + PEOPLE_PER_DOT.toLocaleString('en-US') + ' people\n'
    + '   (every country gets at least one). Dots are spread evenly across each\n'
    + '   country\'s area, so they show the size of a population and the ground it\n'
    + '   covers - not where within a country people actually live.\n'
    + '   Outlines: Natural Earth 1:50m (public domain). Counts: see population-data.js.\n'
    + '   Generated by scripts/build-population-dots.cjs. */\n'
    + 'var CHRISTIAN_POPULATION_DOTS = {\n  perDot: ' + PEOPLE_PER_DOT + ',\n  countries: {\n'
    + body + '\n  }\n};\n';
  fs.writeFileSync(path.join(__dirname, '../population-dots.js'), file);

  console.log(`Wrote ${totalDots.toLocaleString('en-US')} dots for ${data.countries.length} countries `
    + `at 1 per ${PEOPLE_PER_DOT.toLocaleString('en-US')}.`);
  if (withoutOutline.length) console.log(`No outline found, placed on the label point: ${withoutOutline.join(', ')}`);
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
