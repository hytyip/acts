/* Book of Acts — 3D interactive gospel-spread globe
   Built with three.js r128 (classic global build, no bundler needed). */

(function () {
  "use strict";

  var GLOBE_R = 2;
  var GRAY = new THREE.Color(0x555a66);

  // ---------- helpers ----------
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function easeInOutCubic(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function easeOutQuad(t) { return 1 - (1 - t) * (1 - t); }

  function latLonToVector3(lat, lon, radius) {
    var phi = (90 - lat) * Math.PI / 180;
    var theta = (lon + 180) * Math.PI / 180;
    return new THREE.Vector3(
      -radius * Math.sin(phi) * Math.cos(theta),
       radius * Math.cos(phi),
       radius * Math.sin(phi) * Math.sin(theta)
    );
  }

  function seededRandom(seed) {
    var s = seed;
    return function () { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  }

  // ---------- world texture from real coastlines ----------
  // WORLD_LAND: Natural Earth 1:50m land polygons, see worldmap.js
  function buildEarthTexture() {
    var W = 3072, H = 1536;
    var canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext("2d");

    var oceanGrad = ctx.createLinearGradient(0, 0, 0, H);
    oceanGrad.addColorStop(0, "#071526");
    oceanGrad.addColorStop(0.5, "#0c2742");
    oceanGrad.addColorStop(1, "#071526");
    ctx.fillStyle = oceanGrad;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "#3b3521";
    ctx.strokeStyle = "#6a5e3b";
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";

    WORLD_LAND.forEach(function (poly) {
      ctx.beginPath();
      poly.forEach(function (ring) {
        for (var i = 0; i < ring.length; i += 2) {
          var x = ((ring[i] + 180) / 360) * W;
          var y = ((90 - ring[i + 1]) / 180) * H;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
      });
      ctx.fill("evenodd");
      ctx.stroke();
    });

    // graticule over the whole map
    ctx.strokeStyle = "rgba(160, 190, 220, 0.10)";
    ctx.lineWidth = 1.5;
    for (var lon = -180; lon <= 180; lon += 15) {
      var px = ((lon + 180) / 360) * W;
      ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, H); ctx.stroke();
    }
    for (var lat = -75; lat <= 75; lat += 15) {
      var py = ((90 - lat) / 180) * H;
      ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(W, py); ctx.stroke();
    }
    ctx.strokeStyle = "rgba(190, 210, 235, 0.16)";
    ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke();

    var tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return tex;
  }

  // ---------- scene setup ----------
  var container = document.getElementById("scene-container");
  var labelLayer = document.getElementById("label-layer");

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.set(0, 1.7, 7.0);

  var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.appendChild(renderer.domElement);

  var labelRenderer = new THREE.CSS2DRenderer();
  labelRenderer.setSize(window.innerWidth, window.innerHeight);
  labelRenderer.domElement.style.position = "absolute";
  labelRenderer.domElement.style.top = "0";
  labelRenderer.domElement.style.left = "0";
  labelRenderer.domElement.style.pointerEvents = "none";
  labelLayer.appendChild(labelRenderer.domElement);

  var controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 2.4;
  controls.maxDistance = 14;
  controls.rotateSpeed = 0.5;
  controls.target.set(0, 0, 0);

  // lighting
  scene.add(new THREE.AmbientLight(0x4a5570, 1.05));
  var sun = new THREE.DirectionalLight(0xfff0d6, 0.95);
  sun.position.set(6, 4, 5);
  scene.add(sun);
  var rim = new THREE.DirectionalLight(0x3a5fa0, 0.5);
  rim.position.set(-6, -2, -4);
  scene.add(rim);

  // starfield
  (function buildStars() {
    var count = 1800;
    var positions = new Float32Array(count * 3);
    for (var i = 0; i < count; i++) {
      var r = 30 + Math.random() * 40;
      var theta = Math.random() * Math.PI * 2;
      var phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi);
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    var mat = new THREE.PointsMaterial({ color: 0xaab4cc, size: 0.05, sizeAttenuation: true, transparent: true, opacity: 0.7 });
    scene.add(new THREE.Points(geo, mat));
  })();

  // glow halo behind globe
  (function buildGlow() {
    var c = document.createElement("canvas");
    c.width = c.height = 256;
    var gctx = c.getContext("2d");
    var g = gctx.createRadialGradient(128, 128, 40, 128, 128, 128);
    g.addColorStop(0, "rgba(224,165,68,0.35)");
    g.addColorStop(0.5, "rgba(90,120,180,0.12)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    gctx.fillStyle = g;
    gctx.fillRect(0, 0, 256, 256);
    var tex = new THREE.CanvasTexture(c);
    var sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    sprite.scale.set(GLOBE_R * 3.6, GLOBE_R * 3.6, 1);
    scene.add(sprite);
  })();

  // globe
  var globeGeo = new THREE.SphereGeometry(GLOBE_R, 64, 64);
  var globeMat = new THREE.MeshPhongMaterial({ map: buildEarthTexture(), shininess: 4, specular: 0x101820 });
  var globe = new THREE.Mesh(globeGeo, globeMat);
  scene.add(globe);

  var atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(GLOBE_R * 1.015, 48, 48),
    new THREE.MeshBasicMaterial({ color: 0x6fa8ff, transparent: true, opacity: 0.06, side: THREE.BackSide })
  );
  scene.add(atmosphere);

  // ---------- markers ----------
  var markers = [];
  var arcs = [];

  // shared so dot size can track camera distance in one place
  var dotMaterial = new THREE.PointsMaterial({
    size: GLOBE_R * 0.026, vertexColors: THREE.VertexColors,
    transparent: true, opacity: 0.95, depthWrite: false, sizeAttenuation: true
  });

  EVENTS.forEach(function (ev, i) {
    var basePos = latLonToVector3(ev.lat, ev.lon, GLOBE_R);
    var normal = basePos.clone().normalize();
    var up = Math.abs(normal.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    var tangentA = new THREE.Vector3().crossVectors(normal, up).normalize();
    var tangentB = new THREE.Vector3().crossVectors(normal, tangentA).normalize();

    var growth = GROWTH[ev.growth];
    var catColor = new THREE.Color(CATEGORIES[ev.category].color);
    var discR = GLOBE_R * 0.018 * Math.sqrt(growth.scale);
    var count = growth.count;

    var positions = new Float32Array(count * 3);
    var colors = new Float32Array(count * 3);
    var delays = new Float32Array(count);
    var rnd = seededRandom(i * 131 + 7);
    for (var p = 0; p < count; p++) {
      var ang = rnd() * Math.PI * 2;
      var rad = Math.sqrt(rnd()) * discR;
      var offset = tangentA.clone().multiplyScalar(Math.cos(ang) * rad)
        .add(tangentB.clone().multiplyScalar(Math.sin(ang) * rad));
      var pos = basePos.clone().add(normal.clone().multiplyScalar(0.012)).add(offset);
      positions[p * 3] = pos.x; positions[p * 3 + 1] = pos.y; positions[p * 3 + 2] = pos.z;
      colors[p * 3] = GRAY.r; colors[p * 3 + 1] = GRAY.g; colors[p * 3 + 2] = GRAY.b;
      delays[p] = rnd() * 0.9;
    }

    var geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    var colorAttr = new THREE.BufferAttribute(colors, 3);
    geo.setAttribute("color", colorAttr);
    var points = new THREE.Points(geo, dotMaterial);
    scene.add(points);

    // pulse ring
    var ring = new THREE.Mesh(
      new THREE.RingGeometry(0.88, 1, 56),
      new THREE.MeshBasicMaterial({ color: catColor, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })
    );
    ring.position.copy(basePos.clone().add(normal.clone().multiplyScalar(0.02)));
    ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    var baseRingScale = GLOBE_R * 0.05 * (0.8 + growth.scale);
    scene.add(ring);

    // label
    var div = document.createElement("div");
    div.className = "city-label";
    div.textContent = ev.place;
    var labelObj = new THREE.CSS2DObject(div);
    labelObj.position.copy(basePos.clone().add(normal.clone().multiplyScalar(0.03)));
    scene.add(labelObj);

    markers.push({
      basePos: basePos, normal: normal,
      cluster: { colorAttr: colorAttr, colors: colors, delays: delays, count: count, targetColor: catColor, triggered: false, done: false, startTime: 0 },
      ring: { mesh: ring, baseScale: baseRingScale, triggered: false, startTime: 0 },
      label: { div: div }
    });

    if (i > 0) {
      var prev = EVENTS[i - 1];
      var samePlace = Math.abs(prev.lat - ev.lat) < 0.001 && Math.abs(prev.lon - ev.lon) < 0.001;
      if (!samePlace) {
        var startP = markers[i - 1].basePos;
        var endP = basePos;
        var angleBetween = startP.clone().normalize().angleTo(endP.clone().normalize());
        var mid = startP.clone().add(endP).multiplyScalar(0.5).normalize()
          .multiplyScalar(GLOBE_R * (1 + 0.18 + angleBetween * 0.22));
        var curve = new THREE.QuadraticBezierCurve3(startP.clone(), mid, endP.clone());
        var curvePts = curve.getPoints(64);
        var lineGeo = new THREE.BufferGeometry().setFromPoints(curvePts);
        var lineMat = new THREE.LineBasicMaterial({
          color: catColor.clone().lerp(new THREE.Color(0xffffff), 0.4),
          transparent: true, opacity: 0
        });
        var line = new THREE.Line(lineGeo, lineMat);
        scene.add(line);

        var travel = new THREE.Mesh(
          new THREE.SphereGeometry(GLOBE_R * 0.02, 12, 12),
          new THREE.MeshBasicMaterial({ color: 0xfff3d6 })
        );
        travel.visible = false;
        scene.add(travel);

        arcs[i] = { curve: curve, line: line, travel: travel, triggered: false, startTime: 0 };
      }
    }
  });

  // ---------- reveal / timeline state ----------
  var currentStep = 0;
  var maxRevealed = -1;
  var isPlaying = false;
  var playTimer = null;
  var camTween = null;

  function revealStep(i) {
    var m = markers[i];
    var now = performance.now();
    if (!m.cluster.triggered) { m.cluster.triggered = true; m.cluster.done = false; m.cluster.startTime = now; }
    if (!m.ring.triggered) { m.ring.triggered = true; m.ring.startTime = now; }
    m.label.div.classList.add("reached");
    if (arcs[i] && !arcs[i].triggered) { arcs[i].triggered = true; arcs[i].startTime = now; arcs[i].travel.visible = true; }
    if (i > maxRevealed) maxRevealed = i;
  }

  function revealUpTo(i) { for (var k = 0; k <= i; k++) revealStep(k); }

  function unrevealAll() {
    markers.forEach(function (m) {
      m.cluster.triggered = false; m.cluster.done = false;
      for (var p = 0; p < m.cluster.count; p++) {
        m.cluster.colors[p * 3] = GRAY.r; m.cluster.colors[p * 3 + 1] = GRAY.g; m.cluster.colors[p * 3 + 2] = GRAY.b;
      }
      m.cluster.colorAttr.needsUpdate = true;
      m.ring.triggered = false; m.ring.mesh.material.opacity = 0;
      m.label.div.classList.remove("reached", "current");
    });
    arcs.forEach(function (a) { if (!a) return; a.triggered = false; a.line.material.opacity = 0; a.travel.visible = false; });
    maxRevealed = -1;
  }

  // ---------- info panel / UI ----------
  var elCategory = document.getElementById("info-category");
  var elStep = document.getElementById("info-step");
  var elPlace = document.getElementById("info-place");
  var elSubtitle = document.getElementById("info-subtitle");
  var elVerse = document.getElementById("info-verse");
  var elText = document.getElementById("info-text");
  var elBelievers = document.getElementById("info-believers");
  var slider = document.getElementById("timeline-slider");
  var timelineLabel = document.getElementById("timeline-label");
  var btnPrev = document.getElementById("btn-prev");
  var btnNext = document.getElementById("btn-next");
  var btnPlay = document.getElementById("btn-play");
  var btnReset = document.getElementById("btn-reset");
  var legendToggle = document.getElementById("legend-toggle");
  var legend = document.getElementById("legend");

  slider.max = String(EVENTS.length - 1);

  function updateInfoPanel(i) {
    var ev = EVENTS[i];
    var cat = CATEGORIES[ev.category];
    elCategory.textContent = cat.label;
    elCategory.style.background = "rgba(255,255,255,0.08)";
    elCategory.style.color = "#" + cat.color.toString(16).padStart(6, "0");
    elCategory.style.border = "1px solid " + "#" + cat.color.toString(16).padStart(6, "0") + "55";
    elStep.textContent = "Step " + (i + 1) + " / " + EVENTS.length;
    elPlace.textContent = ev.place;
    elSubtitle.textContent = ev.subtitle;
    elVerse.textContent = ev.verse;
    elText.textContent = ev.text;
    elBelievers.textContent = ev.believers;
  }

  function updateTimelineUI() {
    slider.value = String(currentStep);
    timelineLabel.textContent = "Step " + (currentStep + 1) + " of " + EVENTS.length;
    btnPrev.disabled = currentStep === 0;
    btnNext.disabled = currentStep === EVENTS.length - 1;
  }

  function updateCurrentLabelClass() {
    markers.forEach(function (m, idx) {
      m.label.div.classList.toggle("current", idx === currentStep);
    });
  }

  var STEP_ZOOM_R = 3.15; // close enough to read the map around each city

  function flyCameraTo(targetPos) {
    var fromDir = camera.position.clone().normalize();
    var toDir = targetPos.clone().normalize();
    var travel = fromDir.angleTo(toDir);
    camTween = {
      fromDir: fromDir,
      toDir: toDir,
      fromR: camera.position.length(),
      toR: STEP_ZOOM_R,
      // pull back mid-flight so the journey stays visible, then settle in close
      bump: Math.min(0.35 + travel * 2.2, 2.6),
      start: performance.now(),
      duration: 1000 + travel * 900
    };
    controls.enabled = false;
  }

  function goToStep(i) {
    i = clamp(i, 0, EVENTS.length - 1);
    currentStep = i;
    revealUpTo(i);
    updateInfoPanel(i);
    updateTimelineUI();
    updateCurrentLabelClass();
    flyCameraTo(markers[i].basePos);
  }

  function stopPlaying() {
    isPlaying = false;
    btnPlay.innerHTML = "&#9654;";
    if (playTimer) { clearInterval(playTimer); playTimer = null; }
  }

  function startPlaying() {
    isPlaying = true;
    btnPlay.innerHTML = "&#10074;&#10074;";
    playTimer = setInterval(function () {
      if (currentStep >= EVENTS.length - 1) { stopPlaying(); return; }
      goToStep(currentStep + 1);
    }, 4200);
  }

  btnPrev.addEventListener("click", function () { stopPlaying(); goToStep(currentStep - 1); });
  btnNext.addEventListener("click", function () { stopPlaying(); goToStep(currentStep + 1); });
  btnPlay.addEventListener("click", function () { isPlaying ? stopPlaying() : startPlaying(); });
  btnReset.addEventListener("click", function () { stopPlaying(); unrevealAll(); goToStep(0); });
  slider.addEventListener("input", function () { stopPlaying(); goToStep(parseInt(slider.value, 10)); });
  legendToggle.addEventListener("click", function () { legend.classList.toggle("open"); });

  window.addEventListener("keydown", function (e) {
    if (e.key === "ArrowRight") { stopPlaying(); goToStep(currentStep + 1); }
    if (e.key === "ArrowLeft") { stopPlaying(); goToStep(currentStep - 1); }
  });

  // ---------- resize ----------
  window.addEventListener("resize", function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
  });

  // ---------- animation loop ----------
  var clock = new THREE.Clock();

  function updateClusters(now) {
    markers.forEach(function (m) {
      var c = m.cluster;
      if (!c.triggered || c.done) return;
      var allDone = true;
      var elapsedBase = now - c.startTime;
      for (var p = 0; p < c.count; p++) {
        var pElapsed = elapsedBase - c.delays[p] * 900;
        var t;
        if (pElapsed <= 0) { t = 0; allDone = false; }
        else { t = Math.min(1, pElapsed / 650); if (t < 1) allDone = false; }
        var te = easeInOutCubic(t);
        var r = GRAY.r + (c.targetColor.r - GRAY.r) * te;
        var g = GRAY.g + (c.targetColor.g - GRAY.g) * te;
        var b = GRAY.b + (c.targetColor.b - GRAY.b) * te;
        c.colors[p * 3] = r; c.colors[p * 3 + 1] = g; c.colors[p * 3 + 2] = b;
      }
      c.colorAttr.needsUpdate = true;
      if (allDone) c.done = true;
    });
  }

  // dots and rings are sized in world units, so they are rescaled as the
  // camera closes in — otherwise a single marker swallows the screen
  var zoomRingFactor = 1;

  function updateZoomScale() {
    var alt = Math.max(camera.position.length() - GLOBE_R, 0.25);
    dotMaterial.size = clamp(alt * 0.0085, 0.005, 0.05);
    zoomRingFactor = clamp(0.30 + alt * 0.14, 0.30, 1);
  }

  function updateRings(now) {
    markers.forEach(function (m) {
      var r = m.ring;
      if (!r.triggered) return;
      var period = 2200;
      var age = now - r.startTime;
      var fadeIn = clamp(age / 500, 0, 1);
      var phase = (age % period) / period;
      var pe = easeOutQuad(phase);
      var scale = r.baseScale * (0.4 + pe * 1.7) * zoomRingFactor;
      r.mesh.scale.setScalar(scale);
      r.mesh.material.opacity = (1 - pe) * 0.8 * fadeIn;
    });
  }

  function updateArcs(now) {
    arcs.forEach(function (a) {
      if (!a || !a.triggered) return;
      var fadeAge = now - a.startTime;
      a.line.material.opacity = clamp(fadeAge / 700, 0, 1) * 0.8;
      var travelT = clamp(fadeAge / 1300, 0, 1);
      if (travelT < 1) {
        var pt = a.curve.getPoint(easeInOutCubic(travelT));
        a.travel.position.copy(pt);
        a.travel.visible = true;
      } else {
        a.travel.visible = false;
      }
    });
  }

  function updateCameraTween(now) {
    if (!camTween) return;
    var t = clamp((now - camTween.start) / camTween.duration, 0, 1);
    var te = easeInOutCubic(t);
    var refAxis = new THREE.Vector3(0, 0, 1);
    var qFrom = new THREE.Quaternion().setFromUnitVectors(refAxis, camTween.fromDir);
    var qTo = new THREE.Quaternion().setFromUnitVectors(refAxis, camTween.toDir);
    var qCur = qFrom.clone().slerp(qTo, te);
    var dir = refAxis.clone().applyQuaternion(qCur);
    var radius = camTween.fromR + (camTween.toR - camTween.fromR) * te
      + Math.sin(te * Math.PI) * camTween.bump;
    camera.position.copy(dir.multiplyScalar(radius));
    camera.lookAt(0, 0, 0);
    if (t >= 1) { camTween = null; controls.enabled = true; }
  }

  function animate() {
    requestAnimationFrame(animate);
    var now = performance.now();
    clock.getDelta();

    updateZoomScale();
    updateClusters(now);
    updateRings(now);
    updateArcs(now);
    updateCameraTween(now);

    if (!camTween) { camera.lookAt(controls.target); controls.update(); }

    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
  }

  // ---------- boot ----------
  updateInfoPanel(0);
  updateTimelineUI();
  updateCurrentLabelClass();
  goToStep(0);

  animate();

  var loading = document.getElementById("loading");
  requestAnimationFrame(function () {
    setTimeout(function () { loading.classList.add("hidden"); }, 300);
  });
})();
