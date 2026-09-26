/* Book of Acts — 3D interactive gospel-spread globe
   Built with three.js r128 (classic global build, no bundler needed). */

(function () {
  "use strict";

  var loading = document.getElementById("loading");
  var loadingMessage = document.getElementById("loading-message");
  var retryButton = document.getElementById("btn-retry");
  var app = document.getElementById("app");
  var startupFailed = false;
  var sceneReady = false;
  var populationActive = false;
  var populationView = null;

  function showFailure(message) {
    startupFailed = true;
    sceneReady = false;
    app.inert = true;
    clearTimeout(loadingTimeout);
    loading.classList.remove("hidden");
    loading.removeAttribute("aria-hidden");
    loading.setAttribute("role", "alert");
    loadingMessage.textContent = message;
    retryButton.hidden = false;
  }

  retryButton.addEventListener("click", function () { window.location.reload(); });
  var loadingTimeout = setTimeout(function () {
    showFailure("The map could not finish loading. Please reload to try again.");
  }, 20000);

  if (typeof THREE === "undefined" || !THREE.OrbitControls || !THREE.CSS2DRenderer) {
    showFailure("The map library could not load. Check your internet connection, then try again.");
    return;
  }
  if (typeof EVENTS === "undefined" || !EVENTS.length || typeof CATEGORIES === "undefined"
      || typeof GROWTH === "undefined" || typeof REGIONS === "undefined"
      || typeof WORLD_LAND === "undefined" || typeof TEXTURES === "undefined") {
    showFailure("Some map files are missing. Keep all project files together, then reload.");
    return;
  }

  var GLOBE_R = 2;
  var GRAY = linearColor(0x555a66);
  var motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
  var reducedMotion = motionPreference.matches;
  var animationFrame = null;

  // ---------- helpers ----------
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function easeInOutCubic(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function easeOutQuad(t) { return 1 - (1 - t) * (1 - t); }
  function linearColor(hex) { return new THREE.Color(hex).convertSRGBToLinear(); }

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

  // ---------- coastline outline ----------
  // The globe itself is satellite imagery; these polygons only supply the
  // mask that keeps the spreading light on land. WORLD_LAND: Natural Earth
  // 1:50m, see worldmap.js. Built directly in glow-texture pixel space.
  var GLOW_W = 1024, GLOW_H = 512;

  function buildLandPath() {
    var path = new Path2D();
    WORLD_LAND.forEach(function (poly) {
      poly.forEach(function (ring) {
        for (var i = 0; i < ring.length; i += 2) {
          var x = ((ring[i] + 180) / 360) * GLOW_W;
          var y = ((90 - ring[i + 1]) / 180) * GLOW_H;
          if (i === 0) path.moveTo(x, y); else path.lineTo(x, y);
        }
        path.closePath();
      });
    });
    return path;
  }

  // ---------- scene setup ----------
  var container = document.getElementById("scene-container");
  var labelLayer = document.getElementById("label-layer");

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.set(0, 1.7, 7.0);

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  } catch (error) {
    showFailure("The 3D map could not start. Try a browser with WebGL enabled, then reload.");
    console.error("WebGL initialization failed:", error);
    return;
  }
  // r128 uses `encoding` rather than the newer `colorSpace` API. Decode
  // imagery before lighting, then tone-map and encode the finished frame.
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.setClearColor(0x030710, 1);
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
  controls.enableDamping = !reducedMotion;
  controls.enablePan = false; // navigation assumes the globe stays at the origin
  controls.dampingFactor = 0.08;
  controls.minDistance = 2.4;
  controls.maxDistance = 14;
  controls.rotateSpeed = 0.5;
  controls.target.set(0, 0, 0);
  controls.addEventListener("change", requestRender);

  renderer.domElement.addEventListener("webglcontextlost", function (e) {
    e.preventDefault();
    stopPlaying();
    cancelAnimationFrame(animationFrame);
    animationFrame = null;
    showFailure("The graphics connection was interrupted. Reload to restore the map.");
  });

  // lighting. The sun trails the camera rather than sitting fixed in space,
  // so whichever city the account has reached is in daylight; the offset
  // keeps a terminator near the limb instead of flattening everything.
  scene.add(new THREE.AmbientLight(linearColor(0xc4d6ef), 0.22));
  var sun = new THREE.DirectionalLight(linearColor(0xfff5e6), 1.55);
  scene.add(sun);
  var rim = new THREE.DirectionalLight(linearColor(0x759bdb), 0.28);
  rim.position.set(-6, -2, -4);
  scene.add(rim);

  var SUN_AXIS = new THREE.Vector3(0, 1, 0);
  var sunDirection = new THREE.Vector3();
  function updateSun() {
    sunDirection.copy(camera.position).normalize().applyAxisAngle(SUN_AXIS, 0.6);
    sunDirection.y += 0.3;
    sunDirection.normalize();
    sun.position.copy(sunDirection).multiplyScalar(12);
  }

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
    // Soft points keep the backdrop quiet behind the geography.
    var starCanvas = document.createElement("canvas");
    starCanvas.width = starCanvas.height = 32;
    var starCtx = starCanvas.getContext("2d");
    var starGlow = starCtx.createRadialGradient(16, 16, 0, 16, 16, 16);
    starGlow.addColorStop(0, "rgba(255,255,255,1)");
    starGlow.addColorStop(0.2, "rgba(255,255,255,0.8)");
    starGlow.addColorStop(1, "rgba(255,255,255,0)");
    starCtx.fillStyle = starGlow;
    starCtx.fillRect(0, 0, 32, 32);
    var mat = new THREE.PointsMaterial({
      map: new THREE.CanvasTexture(starCanvas), color: linearColor(0xaab4cc),
      size: 0.075, sizeAttenuation: true, transparent: true, opacity: 0.6,
      depthWrite: false, toneMapped: false
    });
    scene.add(new THREE.Points(geo, mat));
  })();

  // The existing 4K imagery has more detail than the old lighting revealed.
  // Keep all four embedded textures so double-click launch still works.
  var textureManager = new THREE.LoadingManager();
  textureManager.onLoad = startScene;
  textureManager.onError = function () {
    showFailure("An Earth image could not load. Reload to try again.");
  };
  var texLoader = new THREE.TextureLoader(textureManager);
  var landPath = buildLandPath();

  var anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  function loadSurfaceTexture(source, isColor) {
    var texture = texLoader.load(source);
    texture.encoding = isColor ? THREE.sRGBEncoding : THREE.LinearEncoding;
    texture.anisotropy = anisotropy;
    texture.wrapS = THREE.RepeatWrapping;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    return texture;
  }

  var earthMap = loadSurfaceTexture(TEXTURES.earth, true);
  var waterMask = loadSurfaceTexture(TEXTURES.specular, false);
  var normalMap = loadSurfaceTexture(TEXTURES.normal, false);
  var cloudMap = loadSurfaceTexture(TEXTURES.clouds, false);
  var cloudRotation = { value: 0 };
  var cloudStrength = { value: 0.45 };

  var earthMaterial = new THREE.MeshStandardMaterial({
    map: earthMap,
    normalMap: normalMap,
    normalScale: new THREE.Vector2(0.65, 0.65),
    color: 0xffffff,
    roughness: 0.92,
    metalness: 0,
    dithering: true
  });
  // Ocean pixels get a broad, soft reflection; dry land stays matte. The
  // cloud shadow uses the same drifting map as the visible cloud layer.
  earthMaterial.onBeforeCompile = function (shader) {
    shader.uniforms.oceanMask = { value: waterMask };
    shader.uniforms.cloudMask = { value: cloudMap };
    shader.uniforms.cloudRotation = cloudRotation;
    shader.uniforms.cloudStrength = cloudStrength;
    shader.fragmentShader = [
      "uniform sampler2D oceanMask;",
      "uniform sampler2D cloudMask;",
      "uniform float cloudRotation;",
      "uniform float cloudStrength;",
      shader.fragmentShader
    ].join("\n").replace("#include <roughnessmap_fragment>", [
      "#include <roughnessmap_fragment>",
      "float ocean = texture2D(oceanMask, vUv).r;",
      "roughnessFactor = mix(0.92, 0.3, ocean);"
    ].join("\n")).replace("#include <map_fragment>", [
      "#include <map_fragment>",
      "vec2 shadowUv = vec2(vUv.x - cloudRotation + 0.0015, vUv.y);",
      "float cloudCover = texture2D(cloudMask, shadowUv).g;",
      "diffuseColor.rgb *= 1.0 - cloudCover * cloudStrength * 0.3;"
    ].join("\n"));
  };
  earthMaterial.customProgramCacheKey = function () { return "acts-earth-surface-v1"; };

  var globe = new THREE.Mesh(
    new THREE.SphereGeometry(GLOBE_R, 192, 128),
    earthMaterial
  );
  scene.add(globe);

  // A separate cloud shell gives the clouds depth and a softly lit edge.
  var clouds = new THREE.Mesh(
    new THREE.SphereGeometry(GLOBE_R * 1.006, 128, 96),
    new THREE.MeshStandardMaterial({
      alphaMap: cloudMap, bumpMap: cloudMap, bumpScale: 0.003,
      color: 0xffffff, transparent: true, opacity: cloudStrength.value,
      roughness: 1, metalness: 0, depthWrite: false, dithering: true
    })
  );
  clouds.renderOrder = 1;
  scene.add(clouds);

  // Two thin layers: grazing-angle haze on the surface and a soft halo
  // beyond the silhouette. Both follow the sun instead of tinting the globe
  // uniformly. This is a visual approximation of atmospheric scattering.
  function buildAtmosphere(outer) {
    var radius = GLOBE_R * (outer ? 1.028 : 1.0007);
    var material = new THREE.ShaderMaterial({
      uniforms: {
        sunDirection: { value: sunDirection },
        atmosphereColor: { value: linearColor(0x6ab6ff) },
        globeRadius: { value: GLOBE_R },
        atmosphereRadius: { value: radius }
      },
      defines: outer ? { OUTER_ATMOSPHERE: 1 } : {},
      vertexShader: [
        "varying vec3 vWorldPosition;",
        "void main() {",
        "  vec4 world = modelMatrix * vec4(position, 1.0);",
        "  vWorldPosition = world.xyz;",
        "  gl_Position = projectionMatrix * viewMatrix * world;",
        "}"
      ].join("\n"),
      fragmentShader: [
        "uniform vec3 sunDirection;",
        "uniform vec3 atmosphereColor;",
        "uniform float globeRadius;",
        "uniform float atmosphereRadius;",
        "varying vec3 vWorldPosition;",
        "void main() {",
        "  vec3 normal = normalize(vWorldPosition);",
        "  vec3 viewDir = normalize(cameraPosition - vWorldPosition);",
        "  float daylight = smoothstep(-0.3, 0.65, dot(normal, sunDirection));",
        "  float density;",
        "  #ifdef OUTER_ATMOSPHERE",
        "    float impact = length(cross(vWorldPosition, viewDir));",
        "    float height = clamp((impact - globeRadius) / (atmosphereRadius - globeRadius), 0.0, 1.0);",
        "    density = exp(-height * 3.5) * (1.0 - smoothstep(0.65, 1.0, height)) * 0.55;",
        "  #else",
        "    float grazing = 1.0 - clamp(dot(normal, viewDir), 0.0, 1.0);",
        "    density = pow(grazing, 4.0) * 0.28;",
        "  #endif",
        "  gl_FragColor = vec4(atmosphereColor, density * mix(0.12, 1.0, daylight));",
        "  #include <encodings_fragment>",
        "}"
      ].join("\n"),
      side: outer ? THREE.BackSide : THREE.FrontSide,
      transparent: true, blending: THREE.AdditiveBlending,
      depthWrite: false, toneMapped: false
    });
    var mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 128, 96), material);
    scene.add(mesh);
  }
  buildAtmosphere(false);
  buildAtmosphere(true);

  // ---------- the spreading light ----------
  // A transparent shell over the globe. Each city that hears the gospel
  // blooms a coloured glow into the land around it; neighbouring blooms
  // run together, so the lit region grows as the account moves outward.
  var glowCanvas = document.createElement("canvas");
  glowCanvas.width = GLOW_W; glowCanvas.height = GLOW_H;
  var glowCtx = glowCanvas.getContext("2d");
  var glowTex = new THREE.CanvasTexture(glowCanvas);
  glowTex.encoding = THREE.sRGBEncoding;
  glowTex.anisotropy = anisotropy;
  var glowDirty = true;

  var glowShell = new THREE.Mesh(
    new THREE.SphereGeometry(GLOBE_R * 1.0015, 96, 96),
    new THREE.MeshBasicMaterial({
      // tints the imagery rather than adding to it — added light barely
      // registers on bright desert and snow
      map: glowTex, transparent: true, depthWrite: false, toneMapped: false
    })
  );
  glowShell.renderOrder = 2;
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
      grad.addColorStop(0, "rgba(" + b.rgb + "," + (0.22 * a) + ")");
      grad.addColorStop(0.35, "rgba(" + b.rgb + "," + (0.15 * a) + ")");
      grad.addColorStop(0.7, "rgba(" + b.rgb + "," + (0.07 * a) + ")");
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
    glowCtx.fill(landPath, "evenodd");
    glowCtx.globalCompositeOperation = "source-over";

    glowTex.needsUpdate = true;
  }

  // ---------- people ----------
  // Five poses. 0/1 are an idle pair for a crowd that has not heard yet,
  // 2 is the arms coming up, 3/4 alternate as hands raised and waving.
  var PERSON_POSES = [
    [[46, 80], [82, 80]],
    [[40, 74], [88, 74]],
    [[26, 54], [102, 54]],
    [[34, 14], [94, 14]],
    [[22, 6], [106, 6]]
  ];

  function buildPersonTexture(pose) {
    var c = document.createElement("canvas");
    c.width = c.height = 128;
    var g = c.getContext("2d");
    g.lineCap = "round";
    g.lineJoin = "round";
    var arms = PERSON_POSES[pose];

    function figure() {
      g.beginPath(); g.arc(64, 20, 13, 0, Math.PI * 2); g.fill();
      g.beginPath();
      g.moveTo(64, 34); g.lineTo(64, 76);   // torso
      g.moveTo(64, 76); g.lineTo(50, 122);  // legs
      g.moveTo(64, 76); g.lineTo(78, 122);
      g.moveTo(64, 44); g.lineTo(arms[0][0], arms[0][1]);
      g.moveTo(64, 44); g.lineTo(arms[1][0], arms[1][1]);
      g.stroke();
    }

    // dark halo first so a figure reads against pale desert or dark sea
    g.strokeStyle = "rgba(0,0,0,0.6)";
    g.fillStyle = "rgba(0,0,0,0.6)";
    g.lineWidth = 20;
    figure();

    g.strokeStyle = "#ffffff";
    g.fillStyle = "#ffffff";
    g.lineWidth = 12;
    figure();

    var tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    return tex;
  }

  var PERSON_FRAMES = PERSON_POSES.map(function (_, i) { return buildPersonTexture(i); });

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

  // A single growing light circle follows the selected city. It lies on a
  // spherical shell, so it hugs the Earth instead of floating over the map.
  var SPREAD_DURATION = 2400;
  var lightCircle = {
    startTime: 0,
    uniforms: {
      cityDirection: { value: new THREE.Vector3(0, 1, 0) },
      lightColor: { value: linearColor(0xffe2a1) },
      radius: { value: 0.001 },
      strength: { value: 0 }
    }
  };
  lightCircle.mesh = new THREE.Mesh(
    new THREE.SphereGeometry(GLOBE_R * 1.0025, 128, 96),
    new THREE.ShaderMaterial({
      uniforms: lightCircle.uniforms,
      vertexShader: [
        "varying vec3 vSurfacePosition;",
        "void main() {",
        "  vSurfacePosition = position;",
        "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
        "}"
      ].join("\n"),
      fragmentShader: [
        "uniform vec3 cityDirection;",
        "uniform vec3 lightColor;",
        "uniform float radius;",
        "uniform float strength;",
        "varying vec3 vSurfacePosition;",
        "void main() {",
        // Chord distance gives a circular footprint on the curved surface.
        "  float distanceFromCity = length(normalize(vSurfacePosition) - cityDirection);",
        "  float feather = max(0.003, radius * 0.16);",
        "  float edgeDistance = (distanceFromCity - radius) / feather;",
        "  float edge = exp(-edgeDistance * edgeDistance);",
        "  float core = 1.0 - smoothstep(0.0, radius + feather, distanceFromCity);",
        "  float alpha = (edge * 0.6 + core * 0.22) * strength;",
        "  if (alpha < 0.002) discard;",
        "  gl_FragColor = vec4(lightColor, alpha);",
        "  #include <encodings_fragment>",
        "}"
      ].join("\n"),
      transparent: true, blending: THREE.AdditiveBlending,
      depthWrite: false, toneMapped: false
    })
  );
  lightCircle.mesh.name = "gospel-light-circle";
  lightCircle.mesh.visible = false;
  lightCircle.mesh.renderOrder = 2;
  scene.add(lightCircle.mesh);

  // ---------- markers ----------
  var markers = [];
  var arcs = [];
  // Jerusalem and Caesarea each carry several events; one marker and one
  // label per place, or they stack into a bright smear and doubled text
  var placeMarks = {};
  var nodeSprites = [];
  var crowdSoFar = {};

  EVENTS.forEach(function (ev, i) {
    var basePos = latLonToVector3(ev.lat, ev.lon, GLOBE_R);
    var normal = basePos.clone().normalize();

    var growth = GROWTH[ev.growth];
    var catHex = CATEGORIES[ev.category].color;
    var catColor = linearColor(catHex);

    // how far the light carries is set by the scale of the response
    var bloom = {
      lat: ev.lat, lon: ev.lon,
      radius: (2.4 + growth.scale * 3.6) * (GLOW_W / 360),
      // Canvas colors stay in sRGB; material colors above are linear.
      rgb: [catHex >> 16 & 255, catHex >> 8 & 255, catHex & 255].join(","),
      progress: 0, triggered: false, startTime: 0
    };

    var up = Math.abs(normal.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    var tangentA = new THREE.Vector3().crossVectors(normal, up).normalize();
    var tangentB = new THREE.Vector3().crossVectors(normal, tangentA).normalize();

    // The crowd: one figure per unit of response. A city visited more than
    // once keeps its earlier crowd and rings the new arrivals around it, so
    // Jerusalem grows outward instead of piling 90 figures on one spot.
    var count = growth.count;
    var crowdKey = ev.lat.toFixed(3) + "," + ev.lon.toFixed(3);
    var prior = crowdSoFar[crowdKey] || 0;
    crowdSoFar[crowdKey] = prior + count;
    var spacing = GLOBE_R * 0.0075;
    var rInner = spacing * Math.sqrt(prior);
    var rOuter = spacing * Math.sqrt(prior + count);

    var people = [];
    var rnd = seededRandom(i * 131 + 7);
    for (var p = 0; p < count; p++) {
      var ang = rnd() * Math.PI * 2;
      // even density across the ring, not bunched at its inner edge
      var rad = Math.sqrt(rInner * rInner + rnd() * (rOuter * rOuter - rInner * rInner));
      var ground = basePos.clone()
        .add(normal.clone().multiplyScalar(0.008))
        .add(tangentA.clone().multiplyScalar(Math.cos(ang) * rad))
        .add(tangentB.clone().multiplyScalar(Math.sin(ang) * rad));

      var pMat = new THREE.SpriteMaterial({
        map: PERSON_FRAMES[0], color: GRAY.clone(),
        transparent: true, depthWrite: false, toneMapped: false
      });
      var pSprite = new THREE.Sprite(pMat);
      pSprite.center.set(0.5, 0); // pivot at the feet, so they stand and lean
      pSprite.position.copy(ground);
      pSprite.renderOrder = 3;
      scene.add(pSprite);

      people.push({
        sprite: pSprite, mat: pMat, ground: ground, frame: 0,
        delay: rnd() * 0.9,                  // stagger so a crowd turns in a ripple
        phase: rnd() * Math.PI * 2,          // everyone moves on their own beat
        speed: 0.7 + rnd() * 0.8,
        sway: 0.05 + rnd() * 0.07,
        waveRate: 3.4 + rnd() * 2.6
      });
    }

    var key = ev.lat.toFixed(3) + "," + ev.lon.toFixed(3);
    var mark = placeMarks[key];
    if (!mark) {
      // city marker: dim until the gospel arrives, then lit in its colour
      var nodeMat = new THREE.SpriteMaterial({
        map: NODE_TEX, color: GRAY.clone(), transparent: true,
        opacity: 0.55, depthWrite: false, toneMapped: false
      });
      var node = new THREE.Sprite(nodeMat);
      node.position.copy(basePos.clone().add(normal.clone().multiplyScalar(0.006)));
      node.renderOrder = 3;
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

    markers.push({
      basePos: basePos, normal: normal,
      bloom: bloom,
      crowd: { people: people, targetColor: catColor, triggered: false, startTime: 0 },
      node: { mat: mark.nodeMat, targetColor: catColor },
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
          transparent: true, opacity: 0, toneMapped: false
        });
        var line = new THREE.Line(lineGeo, lineMat);
        line.renderOrder = 3;
        scene.add(line);

        arcs[i] = { line: line, triggered: false, startTime: 0 };
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
    if (!m.crowd.triggered) { m.crowd.triggered = true; m.crowd.startTime = now; }
    m.label.div.classList.add("reached");
    if (arcs[i] && !arcs[i].triggered) { arcs[i].triggered = true; arcs[i].startTime = now; }
    if (i > maxRevealed) maxRevealed = i;
  }

  function revealUpTo(i) { for (var k = 0; k <= i; k++) revealStep(k); }

  function unrevealAfter(i) {
    markers.forEach(function (m, index) {
      if (index <= i) return;
      m.bloom.triggered = false; m.bloom.progress = 0;
      m.crowd.triggered = false;
      m.crowd.people.forEach(function (person) {
        person.mat.color.copy(GRAY);
        person.colourDone = false;
      });
    });
    // Several events share a city. Rebuild its state from the retained events.
    Object.keys(placeMarks).forEach(function (key) {
      var mark = placeMarks[key];
      mark.nodeMat.color.copy(GRAY);
      mark.nodeMat.opacity = 0.55;
      mark.div.classList.remove("reached", "current");
    });
    for (var k = 0; k <= i; k++) markers[k].label.div.classList.add("reached");
    arcs.forEach(function (a, index) {
      if (!a || index <= i) return;
      a.triggered = false; a.line.material.opacity = 0;
    });
    maxRevealed = i;
    glowDirty = true;
  }

  function unrevealAll() { unrevealAfter(-1); }

  // ---------- region names ----------
  var regionLabels = [];
  REGIONS.forEach(function (r) {
    var div = document.createElement("div");
    div.className = "region-label"
      + (r.era === "modern" ? " modern" : "")
      + (r.rank === 2 ? " minor" : "");
    div.textContent = r.name;
    var obj = new THREE.CSS2DObject(div);
    var pos = latLonToVector3(r.lat, r.lon, GLOBE_R * 1.002);
    obj.position.copy(pos);
    scene.add(obj);
    regionLabels.push({ div: div, pos: pos, era: r.era, rank: r.rank });
  });

  var labelEra = "roman";
  var HORIZON = GLOBE_R * GLOBE_R;

  // CSS2D labels have no depth, so without this the far side of the globe
  // shows its names through the Earth
  function updateLabelVisibility() {
    var alt = camera.position.length() - GLOBE_R;
    var crowded = alt > 2.4;
    regionLabels.forEach(function (l) {
      var wanted = !populationActive && l.era === labelEra && (l.rank === 1 || !crowded);
      var front = l.pos.dot(camera.position) > HORIZON;
      l.div.classList.toggle("off", !(wanted && front));
    });
    markers.forEach(function (m) {
      m.label.div.classList.toggle("behind", m.basePos.dot(camera.position) <= HORIZON);
    });
  }

  var eraSwitch = document.getElementById("era-switch");
  eraSwitch.addEventListener("click", function (e) {
    var btn = e.target.closest("button[data-era]");
    if (!btn) return;
    labelEra = btn.getAttribute("data-era");
    Array.prototype.forEach.call(eraSwitch.querySelectorAll("button"), function (b) {
      b.classList.toggle("active", b === btn);
      b.setAttribute("aria-pressed", String(b === btn));
    });
    requestRender();
  });

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
  var eventStatus = document.getElementById("event-status");

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
    document.getElementById("info-panel").scrollTop = 0;
    eventStatus.textContent = "Step " + (i + 1) + " of " + EVENTS.length + ": "
      + ev.place + ". " + ev.subtitle + ". " + ev.verse;
  }

  function updateTimelineUI() {
    slider.value = String(currentStep);
    slider.setAttribute("aria-valuetext", "Step " + (currentStep + 1) + " of "
      + EVENTS.length + ": " + EVENTS[currentStep].place + ", " + EVENTS[currentStep].subtitle);
    timelineLabel.textContent = "Step " + (currentStep + 1) + " of " + EVENTS.length;
    btnPrev.disabled = currentStep === 0;
    btnNext.disabled = currentStep === EVENTS.length - 1;
  }

  function updateCurrentLabelClass() {
    // labels are shared between events at the same place, so clear first
    markers.forEach(function (m) { m.label.div.classList.remove("current"); });
    markers[currentStep].label.div.classList.add("current");
  }

  var STEP_ALT = 1.15; // close enough to read the map around each city
  var hasZoomedIn = false;

  // The camera's field of view is vertical, so a tall phone screen shows a far
  // narrower strip of ground than a desktop one. Pull back on portrait so the
  // region around each city still fits across the screen.
  function stepZoomRadius() {
    var widen = camera.aspect < 1 ? Math.min(1 / camera.aspect, 1.7) : 1;
    return GLOBE_R + STEP_ALT * widen;
  }

  function flyCameraTo(targetPos, radius) {
    var fromDir = camera.position.clone().normalize();
    var toDir = targetPos.clone().normalize();
    var travel = fromDir.angleTo(toDir);
    // only the opening move changes altitude; after that the camera just
    // travels across the map at whatever zoom the viewer is sitting at
    var toR = radius;
    if (toR === undefined) {
      toR = hasZoomedIn ? (camTween ? camTween.toR : camera.position.length()) : stepZoomRadius();
      hasZoomedIn = true;
    }
    // When the caller names a destination at the distance it wants, finish on
    // that exact vector. Rebuilding it through slerp drifts by an ulp, and
    // leaving population mode is supposed to put the Acts camera back exactly
    // where it was.
    var exact = Math.abs(targetPos.length() - toR) < 1e-9 ? targetPos.clone() : null;
    if (reducedMotion) {
      camera.position.copy(exact || toDir.multiplyScalar(toR));
      camTween = null;
      controls.enabled = true;
      return;
    }
    camTween = {
      exact: exact,
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
    if (populationActive) return;
    i = clamp(i, 0, EVENTS.length - 1);
    if (i === currentStep && maxRevealed >= 0) return;
    if (i < maxRevealed) unrevealAfter(i);
    currentStep = i;
    revealUpTo(i);
    updateInfoPanel(i);
    updateTimelineUI();
    updateCurrentLabelClass();
    flyCameraTo(markers[i].basePos);
    lightCircle.startTime = performance.now();
    lightCircle.uniforms.cityDirection.value.copy(markers[i].normal);
    lightCircle.uniforms.lightColor.value.copy(markers[i].crowd.targetColor)
      .lerp(new THREE.Color(0xffffff), 0.45);
    lightCircle.uniforms.strength.value = 0;
    lightCircle.mesh.visible = false;
    requestRender();
  }

  function stopPlaying() {
    isPlaying = false;
    btnPlay.textContent = "\u25b6";
    btnPlay.setAttribute("aria-label", "Play timeline");
    btnPlay.setAttribute("title", "Play timeline");
    btnPlay.setAttribute("aria-pressed", "false");
    if (playTimer) { clearInterval(playTimer); playTimer = null; }
  }

  function startPlaying() {
    if (isPlaying || !sceneReady || populationActive) return;
    if (currentStep === EVENTS.length - 1) {
      unrevealAll();
      goToStep(0);
    }
    isPlaying = true;
    btnPlay.textContent = "\u275a\u275a";
    btnPlay.setAttribute("aria-label", "Pause timeline");
    btnPlay.setAttribute("title", "Pause timeline");
    btnPlay.setAttribute("aria-pressed", "true");
    playTimer = setInterval(function () {
      if (currentStep >= EVENTS.length - 1) { stopPlaying(); return; }
      goToStep(currentStep + 1);
      if (currentStep === EVENTS.length - 1) stopPlaying();
    }, 2100);
  }

  btnPrev.addEventListener("click", function () { stopPlaying(); goToStep(currentStep - 1); });
  btnNext.addEventListener("click", function () { stopPlaying(); goToStep(currentStep + 1); });
  btnPlay.addEventListener("click", function () { isPlaying ? stopPlaying() : startPlaying(); });
  btnReset.addEventListener("click", function () {
    stopPlaying(); unrevealAll(); hasZoomedIn = false; goToStep(0);
  });
  slider.addEventListener("input", function () { stopPlaying(); goToStep(parseInt(slider.value, 10)); });
  legendToggle.addEventListener("click", function () {
    legendToggle.setAttribute("aria-expanded", String(legend.classList.toggle("open")));
  });

  window.addEventListener("keydown", function (e) {
    if (!sceneReady || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (populationActive) {
      if (e.key === "Escape") { e.preventDefault(); populationView.setActive(false); }
      return;
    }
    // Let native fields, especially the range input, handle their own arrows.
    if (e.target.closest("input, textarea, select, [contenteditable], [role='slider']")) return;
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      stopPlaying();
      goToStep(currentStep + (e.key === "ArrowRight" ? 1 : -1));
    }
    if (e.key === "Escape" && legend.classList.contains("open")) {
      legend.classList.remove("open");
      legendToggle.setAttribute("aria-expanded", "false");
      legendToggle.focus();
    }
  });

  // ---------- worldwide Christian population view ----------
  var savedActsCamera = null;
  if (typeof createPopulationView === "function") {
    populationView = createPopulationView({
      scene: scene, camera: camera, canvas: renderer.domElement, radius: GLOBE_R,
      position: latLonToVector3, color: linearColor, nodeTexture: NODE_TEX,
      requestRender: requestRender,
      onSelect: function (country) {
        var radius = GLOBE_R + (camera.aspect < 1 ? 3.2 : 2.3);
        flyCameraTo(latLonToVector3(country.lat, country.lon, GLOBE_R), radius);
      },
      onToggle: function (active) {
        stopPlaying();
        populationActive = active;
        if (active) savedActsCamera = camera.position.clone();
        camTween = null;
        controls.enabled = true;
        document.getElementById("info-panel").hidden = active;
        document.getElementById("timeline-bar").hidden = active;
        legend.hidden = active;
        legendToggle.hidden = active;
        glowShell.visible = !active;
        lightCircle.mesh.visible = false;
        markers.forEach(function (marker) {
          marker.crowd.people.forEach(function (person) { person.sprite.visible = !active; });
          marker.label.div.classList.toggle("off", active);
        });
        nodeSprites.forEach(function (node) { node.visible = !active; });
        arcs.forEach(function (arc) { if (arc) arc.line.visible = !active; });
        container.setAttribute("aria-label", active
          ? "Globe of Christian population estimates. Search countries or select a light for details."
          : "Globe showing the spread of the gospel. The current event is described below.");
        if (active) {
          flyCameraTo(latLonToVector3(20, 10, GLOBE_R), 7);
          eventStatus.textContent = "Christian population view. 2020 estimates from Pew Research Center.";
        } else {
          flyCameraTo(savedActsCamera, savedActsCamera.length());
          updateInfoPanel(currentStep);
        }
        updateLabelVisibility();
      }
    });
  } else {
    document.getElementById("population-toggle").disabled = true;
    document.getElementById("population-toggle").title = "Population view is unavailable. Keep population.js with the project.";
  }

  // ---------- resize ----------
  window.addEventListener("resize", function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
    requestRender();
  });

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      stopPlaying();
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
    } else {
      clock.getDelta();
      requestRender();
    }
  });

  motionPreference.addEventListener("change", function (e) {
    reducedMotion = e.matches;
    controls.enableDamping = !reducedMotion;
    if (reducedMotion && camTween) {
      camera.position.copy(camTween.toDir).multiplyScalar(camTween.toR);
      camTween = null;
      controls.enabled = true;
    }
    requestRender();
  });

  // ---------- animation loop ----------
  var clock = new THREE.Clock();

  // Everyone is always moving: a slow lean before the gospel arrives, then a
  // faster bob with hands waving once they believe. Each has their own phase,
  // so the crowd never moves as one block.
  function updatePeople(now) {
    var t = now * 0.001;
    markers.forEach(function (m) {
      var c = m.crowd;
      var elapsed = c.triggered ? now - c.startTime : -1;
      c.people.forEach(function (person) {
        var turn = reducedMotion ? (c.triggered ? 1 : 0) : c.triggered
          ? clamp((elapsed - person.delay * 900) / 650, 0, 1)
          : 0;
        var believer = turn >= 1;

        // colour only needs writing while it is still changing
        if (c.triggered && !person.colourDone) {
          person.mat.color.copy(GRAY).lerp(c.targetColor, easeInOutCubic(turn));
          if (believer) person.colourDone = true;
        }

        var beat = t * person.speed * (believer ? 2.1 : 1) + person.phase;
        person.mat.rotation = reducedMotion ? 0 : Math.sin(beat) * person.sway * (believer ? 1.5 : 1);

        var lift = believer ? 0.16 : 0.05;
        var bob = reducedMotion ? 0 : Math.abs(Math.sin(beat)) * lift;
        if (turn > 0 && turn < 1) bob += Math.sin(turn * Math.PI) * 0.35; // the hop as hands go up
        person.sprite.position.copy(person.ground)
          .addScaledVector(m.normal, bob * personHeight);

        var frame;
        if (reducedMotion) frame = believer ? 3 : 0;
        else if (turn === 0) frame = Math.sin(t * 0.55 * person.speed + person.phase) > 0 ? 0 : 1;
        else if (turn < 0.45) frame = 2;
        else if (turn < 1) frame = 3;
        else frame = Math.sin(t * person.waveRate + person.phase) > 0 ? 3 : 4;

        if (frame !== person.frame) {
          person.frame = frame;
          person.mat.map = PERSON_FRAMES[frame];
        }
      });
    });
  }

  function updateGlow(now) {
    var animating = false;
    markers.forEach(function (m) {
      var b = m.bloom;
      if (!b.triggered) return;
      var t = reducedMotion ? 1 : clamp((now - b.startTime) / SPREAD_DURATION, 0, 1);
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

  // Markers are sized in world units, so they are rescaled as the
  // camera closes in — otherwise a single marker swallows the screen
  var personHeight = 0.03;
  var lastAlt = -1;

  function updateZoomScale() {
    var alt = Math.max(camera.position.length() - GLOBE_R, 0.25);
    if (Math.abs(alt - lastAlt) < 0.002) return;
    lastAlt = alt;
    // Clouds stay legible from orbit, but recede when reading a city's map.
    cloudStrength.value = 0.2 + 0.3 * clamp((alt - 0.6) / 3, 0, 1);
    clouds.material.opacity = cloudStrength.value;
    var nodeSize = clamp(alt * 0.018, 0.011, 0.09);
    nodeSprites.forEach(function (s) { s.scale.set(nodeSize, nodeSize, 1); });

    personHeight = clamp(alt * 0.027, 0.016, 0.14);
    var w = personHeight * 0.8;
    markers.forEach(function (m) {
      m.crowd.people.forEach(function (person) {
        person.sprite.scale.set(w, personHeight, 1);
      });
    });
  }

  function updateLightCircle(now) {
    var age = Math.max(0, now - lightCircle.startTime);
    var progress = reducedMotion ? 1 : easeOutQuad(clamp(age / SPREAD_DURATION, 0, 1));
    // Match the circle's final reach to the enduring land bloom. Geographic
    // size stays fixed while zooming, so the light stays anchored to the city.
    var angle = markers[currentStep].bloom.radius / GLOW_W * Math.PI * 2;
    lightCircle.uniforms.radius.value = Math.max(0.001, 2 * Math.sin(angle * progress / 2));
    // Expand once, then fade gently into the lasting light on land.
    var fadeIn = easeOutQuad(clamp(age / 350, 0, 1));
    var fadeOut = 1 - easeInOutCubic(clamp((age - SPREAD_DURATION) / 1400, 0, 1));
    lightCircle.uniforms.strength.value = reducedMotion ? 0.22 : fadeIn * fadeOut;
    lightCircle.mesh.visible = lightCircle.uniforms.strength.value > 0.002;
  }

  function updateArcs(now) {
    arcs.forEach(function (a) {
      if (!a || !a.triggered) return;
      var fadeAge = reducedMotion ? 700 : now - a.startTime;
      a.line.material.opacity = clamp(fadeAge / 700, 0, 1) * 0.8;
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
    if (t >= 1) {
      if (camTween.exact) camera.position.copy(camTween.exact);
      camTween = null;
      controls.enabled = true;
    }
  }

  // On the phone layout the text covers the top of the screen, so aim a little
  // high and let the city being described sit in the clear space below it.
  // Applied after lookAt/controls.update, both of which reset the orientation.
  function applyViewTilt() {
    if (window.innerWidth > 760) return;
    camera.rotateX(0.13);
  }

  var CLOUD_DRIFT = 0.004; // radians per second

  function requestRender() {
    if (sceneReady && !document.hidden && animationFrame === null) {
      animationFrame = requestAnimationFrame(animate);
    }
  }

  function animate() {
    animationFrame = null;
    if (!sceneReady || document.hidden) return;
    var now = performance.now();
    var dt = Math.min(clock.getDelta(), 0.1);

    updateCameraTween(now);
    if (!camTween) { camera.lookAt(controls.target); controls.update(); }
    applyViewTilt();
    updateSun();
    if (!reducedMotion) clouds.rotation.y += CLOUD_DRIFT * dt;
    cloudRotation.value = clouds.rotation.y / (Math.PI * 2);

    updateZoomScale();
    updateLabelVisibility();
    if (populationActive) {
      populationView.update();
    } else {
      updatePeople(now);
      updateGlow(now);
      updateLightCircle(now);
      updateArcs(now);
    }
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
    if (!reducedMotion) requestRender();
  }

  // ---------- boot ----------
  function startScene() {
    if (startupFailed) return;
    sceneReady = true;
    app.inert = false;
    clearTimeout(loadingTimeout);
    goToStep(0);
    loading.classList.add("hidden");
    loading.setAttribute("aria-hidden", "true");
  }
})();
