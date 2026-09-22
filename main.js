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

  // ---------- world texture from real geography ----------
  // WORLD_LAND / WORLD_RIVERS / WORLD_LAKES: Natural Earth 1:50m, see worldmap.js
  var TEX_W = 3072, TEX_H = 1536;

  function px(lon) { return ((lon + 180) / 360) * TEX_W; }
  function py(lat) { return ((90 - lat) / 180) * TEX_H; }

  function buildLandPath() {
    var path = new Path2D();
    WORLD_LAND.forEach(function (poly) {
      poly.forEach(function (ring) {
        for (var i = 0; i < ring.length; i += 2) {
          if (i === 0) path.moveTo(px(ring[i]), py(ring[i + 1]));
          else path.lineTo(px(ring[i]), py(ring[i + 1]));
        }
        path.closePath();
      });
    });
    return path;
  }

  // smooth value noise: random pixels at low res, upscaled with interpolation
  function noiseCanvas(w, h, seed, lo, hi) {
    var c = document.createElement("canvas");
    c.width = w; c.height = h;
    var cx = c.getContext("2d");
    var img = cx.createImageData(w, h);
    var rnd = seededRandom(seed);
    for (var i = 0; i < w * h; i++) {
      var v = lo + rnd() * (hi - lo);
      img.data[i * 4] = v; img.data[i * 4 + 1] = v; img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    cx.putImageData(img, 0, 0);
    return c;
  }

  function drawTerrainNoise(ctx, octaves) {
    ctx.globalCompositeOperation = "overlay";
    octaves.forEach(function (o) {
      ctx.globalAlpha = o.alpha;
      ctx.drawImage(noiseCanvas(o.w, o.h, o.seed, o.lo, o.hi), 0, 0, TEX_W, TEX_H);
    });
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  function buildEarthTexture(landPath) {
    var canvas = document.createElement("canvas");
    canvas.width = TEX_W; canvas.height = TEX_H;
    var ctx = canvas.getContext("2d");

    var oceanGrad = ctx.createLinearGradient(0, 0, 0, TEX_H);
    oceanGrad.addColorStop(0, "#071526");
    oceanGrad.addColorStop(0.5, "#0c2742");
    oceanGrad.addColorStop(1, "#071526");
    ctx.fillStyle = oceanGrad;
    ctx.fillRect(0, 0, TEX_W, TEX_H);

    // land is built on its own transparent layer, then masked back to the
    // coastline so climate tint and terrain noise never bleed into the sea
    var landCv = document.createElement("canvas");
    landCv.width = TEX_W; landCv.height = TEX_H;
    var lc = landCv.getContext("2d");

    lc.fillStyle = "#3a3421";
    lc.fill(landPath, "evenodd");

    // climate banding: ice at the poles, temperate greens, arid sand belts
    var climate = lc.createLinearGradient(0, 0, 0, TEX_H);
    [[90, "rgba(196,206,216,0.30)"], [72, "rgba(150,165,175,0.16)"],
     [58, "rgba(96,112,64,0.13)"],   [44, "rgba(108,120,58,0.15)"],
     [33, "rgba(150,122,66,0.16)"],  [22, "rgba(164,132,70,0.20)"],
     [12, "rgba(120,124,58,0.13)"],  [0,  "rgba(78,104,50,0.16)"],
     [-14, "rgba(120,124,58,0.13)"], [-26, "rgba(160,130,70,0.19)"],
     [-40, "rgba(104,116,58,0.14)"], [-58, "rgba(150,165,175,0.16)"],
     [-90, "rgba(205,214,222,0.32)"]
    ].forEach(function (stop) {
      climate.addColorStop(clamp((90 - stop[0]) / 180, 0, 1), stop[1]);
    });
    lc.fillStyle = climate;
    lc.fillRect(0, 0, TEX_W, TEX_H);

    drawTerrainNoise(lc, [
      { w: 220, h: 110, seed: 29, lo: 112, hi: 158, alpha: 0.35 },
      { w: 620, h: 310, seed: 47, lo: 116, hi: 152, alpha: 0.28 }
    ]);

    // rivers, thicker for the major ones
    lc.lineCap = "round";
    lc.lineJoin = "round";
    lc.strokeStyle = "rgba(96,148,186,0.85)";
    WORLD_RIVERS.forEach(function (river) {
      var pts = river[1];
      lc.lineWidth = Math.max(1, 3.4 - river[0] * 0.3);
      lc.beginPath();
      for (var i = 0; i < pts.length; i += 2) {
        if (i === 0) lc.moveTo(px(pts[i]), py(pts[i + 1]));
        else lc.lineTo(px(pts[i]), py(pts[i + 1]));
      }
      lc.stroke();
    });

    lc.fillStyle = "#12395c";
    WORLD_LAKES.forEach(function (ring) {
      lc.beginPath();
      for (var i = 0; i < ring.length; i += 2) {
        if (i === 0) lc.moveTo(px(ring[i]), py(ring[i + 1]));
        else lc.lineTo(px(ring[i]), py(ring[i + 1]));
      }
      lc.closePath();
      lc.fill();
    });

    // clip everything drawn above back to the coastline
    lc.globalCompositeOperation = "destination-in";
    lc.fill(landPath, "evenodd");
    lc.globalCompositeOperation = "source-over";

    ctx.drawImage(landCv, 0, 0);

    ctx.strokeStyle = "rgba(126,112,72,0.9)";
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.stroke(landPath);

    // graticule over the whole map
    ctx.strokeStyle = "rgba(160, 190, 220, 0.09)";
    ctx.lineWidth = 1.5;
    for (var lon = -180; lon <= 180; lon += 15) {
      ctx.beginPath(); ctx.moveTo(px(lon), 0); ctx.lineTo(px(lon), TEX_H); ctx.stroke();
    }
    for (var lat = -75; lat <= 75; lat += 15) {
      ctx.beginPath(); ctx.moveTo(0, py(lat)); ctx.lineTo(TEX_W, py(lat)); ctx.stroke();
    }
    ctx.strokeStyle = "rgba(190, 210, 235, 0.15)";
    ctx.beginPath(); ctx.moveTo(0, py(0)); ctx.lineTo(TEX_W, py(0)); ctx.stroke();

    var tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return tex;
  }

  // relief: flat over the sea, rumpled over land, so the light picks out terrain
  function buildReliefTexture(landPath) {
    var canvas = document.createElement("canvas");
    canvas.width = TEX_W; canvas.height = TEX_H;
    var ctx = canvas.getContext("2d");
    ctx.fillStyle = "#808080";
    ctx.fillRect(0, 0, TEX_W, TEX_H);

    var bumpCv = document.createElement("canvas");
    bumpCv.width = TEX_W; bumpCv.height = TEX_H;
    var bc = bumpCv.getContext("2d");
    bc.fillStyle = "#808080";
    bc.fill(landPath, "evenodd");
    drawTerrainNoise(bc, [
      { w: 260, h: 130, seed: 71, lo: 96, hi: 168, alpha: 0.6 },
      { w: 700, h: 350, seed: 83, lo: 110, hi: 152, alpha: 0.45 }
    ]);
    bc.globalCompositeOperation = "destination-in";
    bc.fill(landPath, "evenodd");

    ctx.drawImage(bumpCv, 0, 0);

    var tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
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

  // glow halo behind globe — a halo from orbit, but pure haze up close,
  // so updateZoomScale fades it out as the camera drops toward the surface
  var glowSprite;
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
    glowSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    glowSprite.scale.set(GLOBE_R * 3.6, GLOBE_R * 3.6, 1);
    scene.add(glowSprite);
  })();

  // globe
  var globeGeo = new THREE.SphereGeometry(GLOBE_R, 96, 96);
  var landPath = buildLandPath();
  var globeMat = new THREE.MeshPhongMaterial({
    map: buildEarthTexture(landPath),
    bumpMap: buildReliefTexture(landPath),
    bumpScale: 0.009,
    shininess: 4,
    specular: 0x101820
  });
  var globe = new THREE.Mesh(globeGeo, globeMat);
  scene.add(globe);

  var atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(GLOBE_R * 1.015, 48, 48),
    new THREE.MeshBasicMaterial({ color: 0x6fa8ff, transparent: true, opacity: 0.06, side: THREE.BackSide })
  );
  scene.add(atmosphere);

  // ---------- the spreading light ----------
  // A transparent shell over the globe. Each city that hears the gospel
  // blooms a coloured glow into the land around it; neighbouring blooms
  // run together, so the lit region grows as the account moves outward.
  var GLOW_W = 1024, GLOW_H = 512;
  var glowCanvas = document.createElement("canvas");
  glowCanvas.width = GLOW_W; glowCanvas.height = GLOW_H;
  var glowCtx = glowCanvas.getContext("2d");
  var glowTex = new THREE.CanvasTexture(glowCanvas);
  var glowDirty = true;

  var glowShell = new THREE.Mesh(
    new THREE.SphereGeometry(GLOBE_R * 1.0015, 96, 96),
    new THREE.MeshBasicMaterial({
      map: glowTex, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false
    })
  );
  scene.add(glowShell);

  function paintGlow() {
    glowCtx.clearRect(0, 0, GLOW_W, GLOW_H);
    // painted oldest first with plain alpha, never additively: stacked blooms
    // would saturate to white, and the newest light should read on top
    markers.forEach(function (m) {
      var b = m.bloom;
      if (b.progress <= 0) return;
      var cx = ((b.lon + 180) / 360) * GLOW_W;
      var cy = ((90 - b.lat) / 180) * GLOW_H;
      var r = b.radius * b.progress;
      // equirectangular stretches east-west with latitude; undo it so the
      // glow stays circular on the globe instead of squashing toward the pole
      var stretch = 1 / Math.max(0.2, Math.cos(b.lat * Math.PI / 180));

      glowCtx.save();
      glowCtx.translate(cx, cy);
      glowCtx.scale(stretch, 1);
      var grad = glowCtx.createRadialGradient(0, 0, 0, 0, 0, r);
      var a = b.progress;
      grad.addColorStop(0, "rgba(" + b.rgb + "," + (0.40 * a) + ")");
      grad.addColorStop(0.35, "rgba(" + b.rgb + "," + (0.26 * a) + ")");
      grad.addColorStop(0.7, "rgba(" + b.rgb + "," + (0.12 * a) + ")");
      grad.addColorStop(1, "rgba(" + b.rgb + ",0)");
      glowCtx.fillStyle = grad;
      glowCtx.beginPath();
      glowCtx.arc(0, 0, r, 0, Math.PI * 2);
      glowCtx.fill();
      glowCtx.restore();
    });

    // keep the light on the land so the sea stays dark. The mask has to be a
    // solid fill — leaving the last bloom's gradient as fillStyle masks with
    // that gradient instead, which leaves ghost rings out over the water.
    glowCtx.globalCompositeOperation = "destination-in";
    glowCtx.fillStyle = "#ffffff";
    glowCtx.save();
    glowCtx.scale(GLOW_W / TEX_W, GLOW_H / TEX_H);
    glowCtx.fill(landPath, "evenodd");
    glowCtx.restore();
    glowCtx.globalCompositeOperation = "source-over";

    glowTex.needsUpdate = true;
  }

  // soft round marker for each city
  function buildNodeTexture() {
    var c = document.createElement("canvas");
    c.width = c.height = 64;
    var g = c.getContext("2d");
    var grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.35, "rgba(255,255,255,0.9)");
    grad.addColorStop(0.55, "rgba(255,255,255,0.35)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }
  var NODE_TEX = buildNodeTexture();

  // ---------- markers ----------
  var markers = [];
  var arcs = [];
  // Jerusalem and Caesarea each carry several events; one marker and one
  // label per place, or they stack into a bright smear and doubled text
  var placeMarks = {};
  var nodeSprites = [];

  EVENTS.forEach(function (ev, i) {
    var basePos = latLonToVector3(ev.lat, ev.lon, GLOBE_R);
    var normal = basePos.clone().normalize();

    var growth = GROWTH[ev.growth];
    var catColor = new THREE.Color(CATEGORIES[ev.category].color);

    // how far the light carries is set by the scale of the response
    var bloom = {
      lat: ev.lat, lon: ev.lon,
      radius: (2.4 + growth.scale * 3.6) * (GLOW_W / 360),
      rgb: [Math.round(catColor.r * 255), Math.round(catColor.g * 255),
            Math.round(catColor.b * 255)].join(","),
      progress: 0, triggered: false, startTime: 0
    };

    var key = ev.lat.toFixed(3) + "," + ev.lon.toFixed(3);
    var mark = placeMarks[key];
    if (!mark) {
      // city marker: dim until the gospel arrives, then lit in its colour
      var nodeMat = new THREE.SpriteMaterial({
        map: NODE_TEX, color: GRAY.clone(), transparent: true,
        opacity: 0.55, depthWrite: false
      });
      var node = new THREE.Sprite(nodeMat);
      node.position.copy(basePos.clone().add(normal.clone().multiplyScalar(0.006)));
      scene.add(node);

      var div = document.createElement("div");
      div.className = "city-label";
      div.textContent = ev.place;
      var labelObj = new THREE.CSS2DObject(div);
      labelObj.position.copy(basePos.clone().add(normal.clone().multiplyScalar(0.03)));
      scene.add(labelObj);

      mark = { node: node, nodeMat: nodeMat, div: div };
      placeMarks[key] = mark;
      nodeSprites.push(node);
    }

    // ripple marking arrival — additive so it reads as light on lit ground
    var ring = new THREE.Mesh(
      new THREE.RingGeometry(0.93, 1, 64),
      new THREE.MeshBasicMaterial({
        color: catColor, transparent: true, opacity: 0,
        side: THREE.DoubleSide, depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    ring.position.copy(basePos.clone().add(normal.clone().multiplyScalar(0.02)));
    ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    var baseRingScale = GLOBE_R * 0.038 * (0.8 + growth.scale);
    ring.scale.setScalar(0.001);
    ring.visible = false; // until this city is reached; a ring left at its
    ring.renderOrder = 2; // default scale is half a globe wide
    scene.add(ring);

    markers.push({
      basePos: basePos, normal: normal,
      bloom: bloom,
      node: { mat: mark.nodeMat, targetColor: catColor },
      ring: { mesh: ring, baseScale: baseRingScale, triggered: false, startTime: 0 },
      label: { div: mark.div }
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
    if (!m.bloom.triggered) { m.bloom.triggered = true; m.bloom.startTime = now; }
    if (!m.ring.triggered) { m.ring.triggered = true; m.ring.startTime = now; }
    m.label.div.classList.add("reached");
    if (arcs[i] && !arcs[i].triggered) { arcs[i].triggered = true; arcs[i].startTime = now; arcs[i].travel.visible = true; }
    if (i > maxRevealed) maxRevealed = i;
  }

  function revealUpTo(i) { for (var k = 0; k <= i; k++) revealStep(k); }

  function unrevealAll() {
    markers.forEach(function (m) {
      m.bloom.triggered = false; m.bloom.progress = 0;
      m.node.mat.color.copy(GRAY);
      m.node.mat.opacity = 0.55;
      m.ring.triggered = false; m.ring.mesh.material.opacity = 0; m.ring.mesh.visible = false;
      m.label.div.classList.remove("reached", "current");
    });
    arcs.forEach(function (a) { if (!a) return; a.triggered = false; a.line.material.opacity = 0; a.travel.visible = false; });
    maxRevealed = -1;
    glowDirty = true;
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
    // labels are shared between events at the same place, so clear first
    markers.forEach(function (m) { m.label.div.classList.remove("current"); });
    markers[currentStep].label.div.classList.add("current");
  }

  var STEP_ZOOM_R = 3.15; // close enough to read the map around each city
  var hasZoomedIn = false;

  function flyCameraTo(targetPos) {
    var fromDir = camera.position.clone().normalize();
    var toDir = targetPos.clone().normalize();
    var travel = fromDir.angleTo(toDir);
    // only the opening move changes altitude; after that the camera just
    // travels across the map at whatever zoom the viewer is sitting at
    var toR = STEP_ZOOM_R;
    if (hasZoomedIn) toR = camTween ? camTween.toR : camera.position.length();
    hasZoomedIn = true;
    camTween = {
      fromDir: fromDir,
      toDir: toDir,
      fromR: camera.position.length(),
      toR: toR,
      start: performance.now(),
      duration: 900 + travel * 1100
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

  function updateGlow(now) {
    var animating = false;
    markers.forEach(function (m) {
      var b = m.bloom;
      if (!b.triggered) return;
      var t = clamp((now - b.startTime) / 1600, 0, 1);
      var eased = easeOutQuad(t);
      if (eased !== b.progress) { b.progress = eased; animating = true; }

      // the city marker lights up with the land around it
      m.node.mat.color.copy(GRAY).lerp(m.node.targetColor, easeInOutCubic(clamp(t * 2.5, 0, 1)));
      m.node.mat.opacity = 0.55 + 0.45 * easeInOutCubic(clamp(t * 2.5, 0, 1));
    });
    if (animating || glowDirty) {
      paintGlow();
      glowDirty = false;
    }
  }

  // markers and rings are sized in world units, so they are rescaled as the
  // camera closes in — otherwise a single marker swallows the screen
  var zoomRingFactor = 1;
  var lastAlt = -1;

  function updateZoomScale() {
    var alt = Math.max(camera.position.length() - GLOBE_R, 0.25);
    zoomRingFactor = clamp(0.30 + alt * 0.14, 0.30, 1);
    if (Math.abs(alt - lastAlt) < 0.002) return;
    lastAlt = alt;
    glowSprite.material.opacity = clamp((alt - 1.1) / 2.8, 0, 1);
    var nodeSize = clamp(alt * 0.021, 0.013, 0.11);
    nodeSprites.forEach(function (s) { s.scale.set(nodeSize, nodeSize, 1); });
  }

  function updateRings(now) {
    markers.forEach(function (m, idx) {
      var r = m.ring;
      if (!r.triggered) return;
      // the ripple marks arrival and the city being spoken about; everywhere
      // else it settles down and leaves the spreading light to do the work
      // exactly one ripple at a time, on the city being described — several
      // at once read as grey smudges where they cross open water
      if (idx !== currentStep) { r.mesh.visible = false; return; }
      r.mesh.visible = true;
      var age = now - r.startTime;
      var phase = (age % 2200) / 2200;
      var pe = easeOutQuad(phase);
      r.mesh.scale.setScalar(r.baseScale * (0.4 + pe * 1.7) * zoomRingFactor);
      r.mesh.material.opacity = (1 - pe) * 0.75 * clamp(age / 500, 0, 1);
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
    var radius = camTween.fromR + (camTween.toR - camTween.fromR) * te;
    camera.position.copy(dir.multiplyScalar(radius));
    camera.lookAt(0, 0, 0);
    if (t >= 1) { camTween = null; controls.enabled = true; }
  }

  function animate() {
    requestAnimationFrame(animate);
    var now = performance.now();
    clock.getDelta();

    updateZoomScale();
    updateGlow(now);
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
