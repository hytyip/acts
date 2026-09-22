# acts
Book of Acts

## From Jerusalem to the Nations

A 3D interactive site that traces how the gospel spread from Jews to Gentiles
across the book of Acts — from Pentecost in Jerusalem to Paul's arrival in Rome.

**Open [index.html](index.html) directly in a browser** — no build step or
server required (Three.js loads from a CDN via plain `<script>` tags).

- Drag to rotate the globe, scroll to zoom.
- Use the timeline bar (or arrow keys) to step through 16 key events. The
  opening move drops the camera in close to the map; after that it travels
  from city to city at whatever zoom you are sitting at.
- Every city holds a crowd of figures, one per unit of response. They stand
  gray and shifting on their feet until the gospel reaches that place, then
  take colour, raise their hands and wave — blue (Jewish), purple
  (Samaritan/God-fearer), gold (Gentile). Each person moves on their own
  beat, so a crowd turns in a ripple rather than all at once.
- A soft wash of the same colour spreads over the land beneath them, held
  to the coastline so the sea stays dark. It carries the story at globe
  zoom, where individual figures are too small to read.
- A city visited more than once keeps its earlier crowd and rings the new
  arrivals around it, so Jerusalem visibly grows outward.
- Place names come in two layers, switched from the key: **Acts era** names
  the Roman provinces the text itself uses (Asia, Macedonia, Galatia, Judea),
  **Today** names the modern countries in the same places. Minor names appear
  only once you are zoomed in close enough for them not to crowd each other.
- Glowing arcs trace the missionary journeys between stops.
- Hit play to auto-advance through the whole narrative.

Files: `index.html`, `style.css`, `data.js` (the 16 Acts events/coordinates),
`textures.js` (the Earth imagery), `worldmap.js` (coastline outline),
`main.js` (the Three.js scene and timeline logic).

The globe is NASA Blue Marble satellite imagery (public domain) with a water
mask for ocean sheen, a normal map for terrain relief, a drifting cloud layer
and an atmosphere rim. The sun follows the camera, so whichever city the
account has reached is in daylight. Cities sit at their true
latitude/longitude on real geography.

The imagery is embedded in `textures.js` as data URIs rather than kept as
image files. Browsers refuse to load image files into WebGL from a `file://`
page, so inlining them is what lets you open `index.html` by double-click with
no server. Coastline polygons (Natural Earth 1:50m, via `world-atlas`) are
kept only to hold the spreading light to the land.
