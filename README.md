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
- Cities sit dim until the gospel reaches them. As it arrives, coloured
  light blooms out across the surrounding land — blue (Jewish), purple
  (Samaritan/God-fearer), gold (Gentile) — and neighbouring regions run
  together, so the lit part of the map grows as the account moves outward.
  The light is held to the coastline, so the sea stays dark.
- Glowing arcs trace the missionary journeys between stops.
- Hit play to auto-advance through the whole narrative.

Files: `index.html`, `style.css`, `data.js` (the 16 Acts events/coordinates),
`worldmap.js` (coastlines, rivers and lakes), `main.js` (the Three.js scene,
globe texture, and timeline logic).

Geography is Natural Earth 1:50m, public domain: land polygons via the
`world-atlas` project, rivers and lakes via `natural-earth-vector`. The globe
texture is drawn at runtime — coastlines, river network, lakes, climate
banding and a relief bump map — so every city sits at its true
latitude/longitude on real terrain.
