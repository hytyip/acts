# acts
Book of Acts

## From Jerusalem to the Nations

A 3D interactive site that traces how the gospel spread from Jews to Gentiles
across the book of Acts — from Pentecost in Jerusalem to Paul's arrival in Rome.

**Open [index.html](index.html) directly in a browser** — no build step or
server required (Three.js loads from a CDN via plain `<script>` tags).

- Drag to rotate the globe, scroll to zoom.
- Use the timeline bar (or arrow keys) to step through 16 key events. The
  camera flies to each city and zooms in close enough to read the map.
- Each stop lights up a "population" of dots at that city, colored by who
  received the message: blue (Jewish), purple (Samaritan/God-fearer), or
  gold (Gentile). Dots stay gray until the gospel reaches that place.
- Glowing arcs trace the missionary journeys between stops.
- Hit play to auto-advance through the whole narrative.

Files: `index.html`, `style.css`, `data.js` (the 16 Acts events/coordinates),
`worldmap.js` (coastline geometry), `main.js` (the Three.js scene, globe
texture, and timeline logic).

Coastlines are Natural Earth 1:50m land polygons (public domain, via the
`world-atlas` project), drawn onto the globe texture at runtime — so every
city sits at its true latitude/longitude on real geography.
