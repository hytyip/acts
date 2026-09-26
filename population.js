/* Country estimates and globe controls. Plain scripts retain file:// support. */
function createPopulationView(options) {
  "use strict";
  var toggle = document.getElementById("population-toggle");
  var panel = document.getElementById("population-panel");
  if (typeof CHRISTIAN_POPULATION === "undefined" || !CHRISTIAN_POPULATION.countries.length) {
    toggle.disabled = true;
    toggle.title = "Population data is unavailable. Keep population-data.js with the project.";
    return null;
  }
  var data = CHRISTIAN_POPULATION;
  var search = document.getElementById("population-search");
  var list = document.getElementById("population-list");
  var results = document.getElementById("population-results");
  var place = document.getElementById("population-place");
  var count = document.getElementById("population-count");
  var share = document.getElementById("population-share");
  var dotData = typeof CHRISTIAN_POPULATION_DOTS === "undefined" ? null : CHRISTIAN_POPULATION_DOTS;
  var active = false;
  var selected = null;
  var buttons = [];
  var raycaster = new THREE.Raycaster();
  var pointer = new THREE.Vector2();
  var pointerDown = null;
  var compactNumber = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
  var ordered = data.countries.slice().sort(function (a, b) { return b.count - a.count || a.name.localeCompare(b.name); });
  var gold = options.color(0xffc96b);
  var selectedColor = options.color(0xfff6de);
  var mutedColor = options.color(0x6d5730);   // other countries, once one is picked

  function formatCount(row, compact) {
    if (row.countBelow) return "<10,000";
    return "≈ " + (compact ? compactNumber.format(row.count) : row.count.toLocaleString("en-US"));
  }
  function formatShare(row) { return row.percentBound + row.percent.toFixed(1) + "%"; }
  function normalize(text) { return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim(); }

  document.getElementById("population-year").textContent = data.year + " estimates · Published " + data.published.slice(0, 4);
  document.getElementById("population-coverage").textContent = data.countries.length
    + " countries and territories covered. Other locations have no estimate in this dataset. Counts and percentages are rounded.";
  document.getElementById("population-source").href = data.sourceUrl;
  document.getElementById("population-methodology").href = data.methodologyUrl;
  document.getElementById("population-dot-note").textContent = dotData
    ? "One dot stands for " + dotData.perDot.toLocaleString("en-US") + " people, spread evenly across a "
      + "country, so the dots show the size of a population and the ground it covers — not where within a "
      + "country people live. Every country carries at least one dot. Select a dot or a country to explore."
    : "Each dot marks a country. Select a dot or a country to explore.";

  var label = document.createElement("div");
  label.className = "population-map-label off";
  var labelObject = new THREE.CSS2DObject(label);
  options.scene.add(labelObject);

  // One dot per fixed number of people, scattered across each country's
  // territory, so a population reads as the ground it covers rather than as a
  // single marker. All of them live in one geometry: nine thousand sprites
  // would be nine thousand draw calls.
  var dotCountry = [];   // dot index -> country row, for clicks and highlighting
  var dotColors = null;
  var dotCloud = null;

  (function buildDots() {
    var positions = [];
    ordered.forEach(function (country) {
      var coords = dotData && dotData.countries[country.name];
      if (!coords || !coords.length) coords = [country.lat, country.lon];
      for (var i = 0; i < coords.length; i += 2) {
        var point = options.position(coords[i], coords[i + 1], options.radius + 0.004);
        positions.push(point.x, point.y, point.z);
        dotCountry.push(country);
      }
    });

    var geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(positions), 3));
    dotColors = new THREE.BufferAttribute(new Float32Array(dotCountry.length * 3), 3);
    geometry.setAttribute("color", dotColors);

    dotCloud = new THREE.Points(geometry, new THREE.PointsMaterial({
      map: options.nodeTexture, vertexColors: true, transparent: true,
      opacity: 0.9, depthWrite: false, sizeAttenuation: true, size: 0.02
    }));
    dotCloud.name = "population-dots";
    dotCloud.visible = false;
    dotCloud.renderOrder = 3;
    options.scene.add(dotCloud);
    paintDots();
  })();

  // Every dot is the same size, so a chosen country has to stand out by
  // colour: it brightens and everywhere else falls back.
  function paintDots() {
    if (!dotColors) return;
    var array = dotColors.array;
    for (var i = 0; i < dotCountry.length; i++) {
      var tone = !selected ? gold : dotCountry[i] === selected ? selectedColor : mutedColor;
      array[i * 3] = tone.r; array[i * 3 + 1] = tone.g; array[i * 3 + 2] = tone.b;
    }
    dotColors.needsUpdate = true;
  }

  function updateSelectionButtons() {
    buttons.forEach(function (entry) {
      var chosen = selected === entry.country;
      entry.button.classList.toggle("selected", chosen);
      entry.button.setAttribute("aria-pressed", String(chosen));
    });
  }

  function selectCountry(country, navigate) {
    selected = country;
    var statistics = country || data.world;
    place.textContent = country ? country.name : "Worldwide";
    count.textContent = formatCount(statistics, false);
    share.textContent = formatShare(statistics) + (country ? " of this population" : " of the world population") + " · " + data.year;
    label.textContent = country ? country.name + " · " + formatCount(country, true) : "";
    if (country) labelObject.position.copy(options.position(country.lat, country.lon, options.radius + 0.05));
    paintDots();
    updateSelectionButtons();
    if (country && navigate) options.onSelect(country);
    update();
    options.requestRender();
  }

  function renderList() {
    var query = normalize(search.value);
    var filtered = ordered.filter(function (country) { return normalize(country.name).includes(query); });
    list.replaceChildren();
    buttons = [];
    filtered.forEach(function (country) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "population-row";
      button.setAttribute("aria-label", country.name + ": "
        + (country.countBelow ? "fewer than 10,000" : "approximately " + country.count.toLocaleString("en-US"))
        + " Christians, " + formatShare(country) + ", " + data.year);
      var name = document.createElement("span");
      name.textContent = country.name;
      var value = document.createElement("span");
      value.className = "population-row-value";
      value.textContent = formatCount(country, true) + " · " + formatShare(country);
      button.appendChild(name);
      button.appendChild(value);
      button.addEventListener("click", function () { selectCountry(country, true); });
      list.appendChild(button);
      buttons.push({ country: country, button: button });
    });
    results.textContent = filtered.length ? filtered.length + " of " + ordered.length + " locations · largest populations first"
      : "No matching countries or territories.";
    list.scrollTop = 0;
    updateSelectionButtons();
  }

  function update() {
    if (!active) { label.classList.add("off"); return; }
    // hold the dots at a roughly steady size on screen as the camera moves;
    // the globe itself hides the ones on the far side
    var altitude = Math.max(options.camera.position.length() - options.radius, 0.25);
    dotCloud.material.size = Math.max(0.009, Math.min(0.07, altitude * 0.013));
    var front = selected && labelObject.position.dot(options.camera.position) > options.radius * (options.radius + 0.05);
    label.classList.toggle("off", !front);
  }

  function setActive(value) {
    if (active === value) return;
    active = value;
    toggle.textContent = active ? "Back to Acts" : "Christian population in 2020";
    toggle.setAttribute("aria-expanded", String(active));
    toggle.setAttribute("aria-pressed", String(active));
    panel.hidden = !active;
    dotCloud.visible = active;
    if (active) { search.value = ""; renderList(); selectCountry(null, false); }
    else label.classList.add("off");
    options.onToggle(active);
    update();
    if (active) search.focus(); else toggle.focus();
    options.requestRender();
  }

  toggle.addEventListener("click", function () { setActive(!active); });
  search.addEventListener("input", renderList);
  options.canvas.addEventListener("pointerdown", function (event) {
    pointerDown = active && event.isPrimary !== false && event.button === 0
      ? { x: event.clientX, y: event.clientY, id: event.pointerId } : null;
  });
  options.canvas.addEventListener("pointercancel", function () { pointerDown = null; });
  options.canvas.addEventListener("pointerup", function (event) {
    var start = pointerDown;
    pointerDown = null;
    if (!active || !start || event.pointerId !== start.id || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6) return;
    var rect = options.canvas.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(pointer, options.camera);
    raycaster.params.Points.threshold = dotCloud.material.size * 0.8;
    var hits = raycaster.intersectObjects([dotCloud]).filter(function (hit) {
      // a ray through the globe also meets dots on the far side
      return hit.point === undefined || hit.point.dot(options.camera.position) > options.radius * options.radius;
    });
    var country = hits.length ? dotCountry[hits[0].index] : null;
    if (country) selectCountry(country, true);
  });
  return { setActive: setActive, update: update };
}
