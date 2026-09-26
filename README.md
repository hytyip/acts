# acts
Book of Acts

## From Jerusalem to the Nations

A 3D interactive site that traces how the gospel spread from Jews to Gentiles
across the book of Acts — from Pentecost in Jerusalem to Paul's arrival in Rome.

**Open [index.html](index.html) directly in a browser** — no build step or
server required. A modern browser with WebGL and an internet connection is
required: Three.js loads from a CDN via plain `<script>` tags, and fonts load
from Google Fonts. This is not a fully offline app.

- Drag to rotate the globe, scroll or pinch to zoom.
- Use the timeline bar (or arrow keys) to step through 16 key events. The
  opening move drops the camera in close to the map; after that it travels
  from city to city at whatever zoom you are sitting at. Going backward also
  rewinds the crowds, spreading light and routes to the selected event.
- Every city holds an illustrative crowd of figures. They stand
  gray and shifting on their feet until their event is reached, then
  take colour, raise their hands and wave — blue (Jewish), purple
  (Samaritan/God-fearer), gold (Gentile). Each person moves on their own
  beat, so a crowd turns in a ripple rather than all at once. Figure counts
  and light are symbolic, not population estimates or conversion totals.
- A soft wash of the same colour spreads over the land beneath them, held
  to the coastline so the sea stays dark. It carries the story at globe
  zoom, where individual figures are too small to read.
- At each selected city, a soft circle of light grows along the globe's
  surface, then fades into the lasting land glow. Its feathered edge and
  luminous center replace the traveling yellow dot and hard ripple ring.
- A city visited more than once keeps its earlier crowd and rings the new
  arrivals around it, so Jerusalem visibly grows outward.
- On a phone the account sits at the top under the title and the globe takes
  the rest of the screen, with the camera aimed a little high so the city
  being described lands in the clear space below the text.
- Place names come in two layers, switched from the key: **Acts era** names
  the Roman provinces the text itself uses (Asia, Macedonia, Galatia, Judea),
  **Today** names the modern countries in the same places. Minor names appear
  only once you are zoomed in close enough for them not to crowd each other.
- Glowing arcs connect the selected events; they do not reconstruct every
  stop or the exact routes of individual missionary journeys.
- Hit play to auto-advance through the whole narrative. At the last event,
  play starts again from the beginning. Reset restores the first event and
  its default camera zoom. Switching away from the tab pauses playback.
- Keyboard users can Tab through the controls, use Left/Right to move between
  events, and use the slider's native arrow/Home/End controls. Escape closes
  the mobile legend. Event changes are announced to screen readers.
- The system's reduced-motion preference disables camera flights, cloud
  drift and animated figures, and shows the light circle at its full size.
  Static scenes render only when needed.
- **Christian population** opens a worldwide view with searchable country
  estimates. Each country is drawn as a scatter of dots, one per 250,000
  people, spread across its territory — so a population reads as the ground it
  covers, not as a single marker. Selecting a country brightens its dots and
  dims the rest. **Back to Acts** (or Escape) restores your previous timeline
  step and camera view. Playback stays paused.

Files: `index.html`, `style.css`, `data.js` (the 16 Acts events/coordinates),
`textures.js` (the Earth imagery), `worldmap.js` (coastline outline),
`main.js` (the Three.js scene and timeline logic), `population.js` (the
worldwide view), `population-data.js` (embedded population estimates), and
`population-dots.js` (the dot positions for those estimates).

The globe uses embedded 4K NASA Blue Marble satellite imagery (public domain).
The surface uses physically based lighting, with matte land, smoother oceans,
terrain normals and anisotropic filtering. Correct sRGB decoding and filmic
tone mapping keep highlights controlled while revealing surface detail.
Drifting clouds cast subtle texture-based shadows and fade back at close zoom
so the geography stays readable. A sunlit blue atmospheric edge and grazing
haze give the globe depth; the atmosphere is a visual approximation, not a
physical scattering simulation. The sun follows the camera, so whichever city
the account has reached is in daylight. Cities sit at their true
latitude/longitude on real geography. These effects use the existing embedded
images and do not require additional texture downloads.

The imagery is embedded in `textures.js` as data URIs rather than kept as
image files. Browsers refuse to load image files into WebGL from a `file://`
page, so inlining them is what lets you open `index.html` by double-click with
no server. Coastline polygons (Natural Earth 1:50m, via `world-atlas`) are
kept only to hold the spreading light to the land.

Narrative references are listed with each event. The descriptions of the
Jerusalem total, the Ethiopian official, and Cornelius follow
[Acts 4:4](https://bible.usccb.org/bible/acts/4),
[Acts 8:26–39](https://bible.usccb.org/bible/acts/8), and
[Acts 10:1–48](https://bible.usccb.org/bible/acts/10).

## Christian population data

The worldwide view uses Pew Research Center's **2020 estimates**, published
June 9, 2025 and retrieved September 25, 2026. It does not project or relabel
them as 2026 populations. The source covers **201 countries and territories**;
locations outside that coverage have no estimate in this view. “Christian”
means religious affiliation across ages and traditions, not active religious
practice. The 2026 update to Pew's interactive added diversity rankings;
the population estimates still describe 2020.

Source: Hackett, Conrad, Marcin Stonawski, Yunping Tong, Stephanie Kramer,
Anne Fengyan Shi and Nick Zanetti. 2025.
[“Religious Composition by Country, 2010–2020.” Pew Research Center](https://www.pewresearch.org/religion/feature/religious-composition-by-country-2010-2020/).
DOI: [10.58094/5shf-2d69](https://doi.org/10.58094/5shf-2d69).
See the [methodology](https://www.pewresearch.org/religion/2025/06/09/global-religious-change-methodology/).

Country counts are rounded to the nearest 10,000; smaller values are shown
as **<10,000**, never zero or a made-up exact count. Percentages are rounded
to one decimal place, with <0.1% and >99.9% bounds preserved. The global total
comes from the source's global estimate, not the sum of rounded country rows.

Each country is drawn as one dot per 250,000 Christians, with at least one
dot per country. The dots are spread **evenly across a country's area**, so
they show the size of a population and the ground it covers — they are not a
map of where within a country Christians actually live, and a dense-looking
country is a populous one, not necessarily a more Christian one. Read the
percentage for that.

Label points come from [Natural Earth](https://www.naturalearthdata.com/)
1:10m countries and map units (public domain); the dot scatter uses the 1:50m
country outlines. French overseas territories use their own map-unit
locations; the Channel Islands point is midway between the Jersey and
Guernsey labels, and its dots come from both islands. The source's country
and territory groupings are preserved.

The embedded snapshot works without additional requests when opening the
app. To regenerate it using Node 22.19+ or 24+:

```sh
node --use-system-ca scripts/update-population-data.cjs
node --use-system-ca scripts/build-population-dots.cjs
```

The first downloads the estimates; the second reads them back and scatters the
dots inside Natural Earth's country outlines. The scatter is seeded per
country, so re-running it reproduces the same file rather than churning the
diff. Both parse JSON without executing external scripts, and the importer
validates the coverage and records the source URL and SHA-256 digest. A future population data year requires reviewing the importer
and its labels; refreshing this snapshot does not create new-year estimates.

## Checks

The app itself needs no tools or installation. To run the dependency-free
regression suite, install Node.js 20 or later and run:

```sh
node --test tests/app.test.cjs
```

The tests exercise the actual application script with DOM and renderer
stand-ins: rewind/replay/reset, keyboard handling, accessible state, reduced
motion, background playback, startup failures and asset integrity. They do
not verify actual GPU rendering or browser layout. Population checks cover
mode switching, search, map clicks versus drags, source bounds, coverage and
restoring the timeline.

For a visual check, open `index.html` at desktop and phone sizes, advance to
Rome and rewind, try the three label layers, drag/zoom, and check the legend
in portrait and landscape. Also try the system's reduced-motion preference.
If the map cannot load its library/images or loses its WebGL context, it
displays an explanation with a **Try again** button.
