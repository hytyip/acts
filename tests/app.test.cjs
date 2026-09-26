const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createApp, root } = require('./helpers/app.cjs');

test('loading waits for the images and initializes the first event', () => {
  const app = createApp();
  assert.equal(app.elements.get('loading').classList.contains('hidden'), false);
  assert.equal(app.frames.size, 0);
  app.ready();
  assert.deepEqual(app.errors, []);
  assert.equal(app.elements.get('loading').classList.contains('hidden'), true);
  assert.equal(app.elements.get('info-place').textContent, 'Jerusalem');
  assert.equal(app.elements.get('btn-prev').disabled, true);
  assert.equal(app.instances.controls.enablePan, false);
  assert.equal(app.timeouts.size, 0);
});

test('rewinding clears later cities, crowds and routes, including shared cities', () => {
  const app = createApp(); app.ready(); app.select(15); app.frame();
  const scene = app.instances.scene.children;
  const labels = scene.filter(o => o.element?.classList.contains('city-label')).map(o => o.element);
  const routes = scene.filter(o => o instanceof app.THREE.Line);
  const sprites = scene.filter(o => o instanceof app.THREE.Sprite);
  const grey = new app.THREE.Color(0x555a66).convertSRGBToLinear();
  assert.ok(labels.every(l => l.classList.contains('reached')));
  app.select(0); app.frame();
  assert.deepEqual(labels.filter(l => l.classList.contains('reached')).map(l => l.textContent), ['Jerusalem']);
  assert.ok(routes.every(r => r.material.opacity === 0));
  // Only the initial crowd (42) and its city node remain non-grey.
  assert.equal(sprites.filter(s => s.visible && s.material.color && ['r', 'g', 'b'].some(k => s.material.color[k] !== grey[k])).length, 43);
  app.select(5); app.frame();
  const reached = labels.filter(l => l.classList.contains('reached')).map(l => l.textContent);
  assert.ok(reached.includes('Caesarea'));
  assert.ok(!reached.includes('Rome'));
  assert.equal(labels.filter(l => l.textContent === 'Jerusalem').length, 1);
});

test('play stops on the final event and restarts from the beginning', () => {
  const app = createApp(); app.ready(); app.select(14); app.click('btn-play');
  assert.equal(app.intervals.size, 1);
  assert.equal(app.elements.get('btn-play').getAttribute('aria-label'), 'Pause timeline');
  app.tick();
  assert.equal(app.step, 15);
  assert.equal(app.intervals.size, 0);
  assert.equal(app.elements.get('btn-play').getAttribute('aria-pressed'), 'false');
  app.click('btn-play');
  assert.equal(app.step, 0);
  app.tick(); assert.equal(app.step, 1);
  app.select(4); assert.equal(app.intervals.size, 0);
});

test('reset restores the first event and its default zoom', () => {
  const app = createApp(); app.ready(); app.select(8); app.frame();
  app.instances.camera.position.normalize().multiplyScalar(10);
  app.click('btn-reset'); app.frame();
  assert.equal(app.step, 0);
  assert.ok(Math.abs(app.instances.camera.position.length() - 3.15) < 1e-10);
});

test('arrow shortcuts preserve native slider behavior and modifier shortcuts', () => {
  const app = createApp(); app.ready();
  const slider = app.elements.get('timeline-slider');
  app.select(1); // Native range input has already advanced one step.
  const native = app.window.emit('keydown', { key: 'ArrowRight', target: slider });
  assert.equal(app.step, 1); assert.ok(!native.defaultPrevented);
  const next = app.window.emit('keydown', { key: 'ArrowRight', target: app.elements.get('btn-next') });
  assert.equal(app.step, 2); assert.equal(next.defaultPrevented, true);
  app.window.emit('keydown', { key: 'ArrowLeft', altKey: true });
  assert.equal(app.step, 2);
});

test('accessible control state follows the selected event, era and legend', () => {
  const app = createApp(); app.ready();
  app.elements.get('info-panel').scrollTop = 100;
  app.select(3);
  assert.equal(app.elements.get('info-panel').scrollTop, 0);
  assert.match(app.elements.get('timeline-slider').getAttribute('aria-valuetext'), /Step 4 of 16: Gaza Road/);
  assert.match(app.elements.get('event-status').textContent, /Ethiopian Official/);
  app.elements.get('era-switch').emit('click', { target: app.eraButtons[1] });
  assert.deepEqual(app.eraButtons.map(b => b.getAttribute('aria-pressed')), ['false', 'true', 'false']);
  app.click('legend-toggle');
  assert.equal(app.elements.get('legend-toggle').getAttribute('aria-expanded'), 'true');
  app.window.emit('keydown', { key: 'Escape', target: app.elements.get('legend-toggle') });
  assert.equal(app.elements.get('legend-toggle').getAttribute('aria-expanded'), 'false');
  assert.equal(app.elements.get('legend-toggle').focused, true);
});

test('reduced motion uses static scenes and responds to preference changes', () => {
  const app = createApp(); app.ready();
  assert.equal(app.frames.size, 0);
  assert.equal(app.instances.controls.enabled, true);
  app.select(2); assert.equal(app.frames.size, 1); app.frame();
  assert.equal(app.frames.size, 0);
  app.preference.emit('change', { matches: false }); app.frame();
  assert.equal(app.frames.size, 1);
  app.select(4); app.preference.emit('change', { matches: true }); app.frame();
  assert.equal(app.frames.size, 0);
  assert.equal(app.instances.controls.enabled, true);
});

test('hidden tabs stop playback and rendering without advancing on return', () => {
  const app = createApp({ reducedMotion: false }); app.ready(); app.click('btn-play');
  app.document.hidden = true; app.document.emit('visibilitychange');
  assert.equal(app.frames.size, 0); assert.equal(app.intervals.size, 0);
  app.tick(); assert.equal(app.step, 0);
  app.document.hidden = false; app.document.emit('visibilitychange');
  assert.equal(app.frames.size, 1); assert.equal(app.intervals.size, 0);
});

test('cloud shadows follow cloud motion, pause with reduced motion, and fade near cities', () => {
  const app = createApp(); app.ready();
  const objects = app.instances.scene.children;
  const earth = objects.find(object => object.material?.onBeforeCompile);
  const clouds = objects.find(object => object.material?.alphaMap);
  const shader = { uniforms: {}, fragmentShader: '#include <map_fragment>\n#include <roughnessmap_fragment>' };
  earth.material.onBeforeCompile(shader);
  assert.equal(clouds.rotation.y, 0);
  assert.equal(shader.uniforms.cloudRotation.value, 0);
  const closeOpacity = clouds.material.opacity;
  app.instances.camera.position.normalize().multiplyScalar(9);
  app.instances.controls.emit('change'); app.frame();
  assert.ok(clouds.material.opacity > closeOpacity);
  assert.equal(shader.uniforms.cloudStrength.value, clouds.material.opacity);
  app.preference.emit('change', { matches: false }); app.frame();
  assert.ok(clouds.rotation.y > 0);
  assert.equal(shader.uniforms.cloudRotation.value, clouds.rotation.y / (Math.PI * 2));
  const rotation = clouds.rotation.y;
  app.preference.emit('change', { matches: true }); app.frame();
  assert.equal(clouds.rotation.y, rotation);
  assert.equal(app.frames.size, 0);
});

test('the arrival light expands in place, fades once, and restarts when rewinding', () => {
  const app = createApp({ reducedMotion: false }); app.ready();
  const light = app.instances.scene.children.find(object => object.name === 'gospel-light-circle');
  app.select(5); app.frame(100);
  const uniforms = light.material.uniforms;
  const initialRadius = uniforms.radius.value;
  const center = uniforms.cityDirection.value.clone();
  assert.equal(light.visible, true);
  app.frame(800);
  assert.ok(uniforms.radius.value > initialRadius);
  assert.deepEqual(uniforms.cityDirection.value, center);
  app.frame(4000);
  const fullRadius = uniforms.radius.value;
  assert.equal(light.visible, false);
  app.frame(5000);
  assert.equal(light.visible, false); // no repeating pulse or traveling dot
  assert.equal(uniforms.radius.value, fullRadius);
  app.select(0); app.frame(100);
  assert.equal(light.visible, true);
  assert.ok(uniforms.radius.value < fullRadius);
  assert.notDeepEqual(uniforms.cityDirection.value, center);
});

test('reduced motion displays a stable light circle without scheduling animation', () => {
  const app = createApp(); app.ready(); app.select(5); app.frame();
  const light = app.instances.scene.children.find(object => object.name === 'gospel-light-circle');
  const radius = light.material.uniforms.radius.value;
  assert.equal(light.visible, true);
  app.instances.controls.emit('change'); app.frame(10000);
  assert.equal(light.material.uniforms.radius.value, radius);
  assert.equal(light.visible, true);
  assert.equal(app.frames.size, 0);
});

test('population mode pauses Acts and restores the step, camera, and controls', () => {
  const app = createApp(); app.ready(); app.select(6); app.frame();
  const previousCamera = app.instances.camera.position.clone();
  app.click('btn-play');
  app.click('population-toggle'); app.frame();
  assert.equal(app.intervals.size, 0);
  assert.equal(app.step, 6);
  assert.equal(app.elements.get('timeline-bar').hidden, true);
  assert.equal(app.elements.get('info-panel').hidden, true);
  assert.equal(app.elements.get('population-panel').hidden, false);
  assert.equal(app.elements.get('population-toggle').getAttribute('aria-expanded'), 'true');
  assert.equal(app.elements.get('population-list').children.length, 201);
  assert.match(app.elements.get('population-year').textContent, /2020 estimates.*2025/);
  app.window.emit('keydown', { key: 'ArrowRight', target: app.elements.get('population-toggle') });
  assert.equal(app.step, 6);
  app.window.emit('keydown', { key: 'Escape', target: app.elements.get('population-search') }); app.frame();
  assert.equal(app.elements.get('population-panel').hidden, true);
  assert.equal(app.elements.get('timeline-bar').hidden, false);
  assert.equal(app.elements.get('info-place').textContent, 'Antioch');
  assert.deepEqual(app.instances.camera.position, previousCamera);
  assert.equal(app.intervals.size, 0);
  assert.ok(app.instances.scene.children.filter(o => o.name?.startsWith('population-')).every(o => !o.visible));
});

test('population search selects a country and preserves source bounds and years', () => {
  const app = createApp(); app.ready(); app.click('population-toggle'); app.frame();
  const search = app.elements.get('population-search');
  search.value = 'afghanistan'; search.emit('input');
  const list = app.elements.get('population-list');
  assert.equal(list.children.length, 1);
  list.children[0].emit('click'); app.frame();
  assert.equal(app.elements.get('population-place').textContent, 'Afghanistan');
  assert.equal(app.elements.get('population-count').textContent, '<10,000');
  assert.match(app.elements.get('population-share').textContent, /^<0\.1%.*2020/);
  assert.equal(list.children[0].getAttribute('aria-pressed'), 'true');
  search.value = 'sao'; search.emit('input');
  assert.equal(list.children.length, 1); // diacritics do not prevent searching
  search.value = 'no matching place'; search.emit('input');
  assert.equal(list.children.length, 0);
  assert.match(app.elements.get('population-results').textContent, /No matching/);
  app.click('population-toggle'); app.click('population-toggle'); app.frame();
  assert.equal(search.value, '');
  assert.equal(app.elements.get('population-place').textContent, 'Worldwide');
  assert.equal(list.children.length, 201);
});

test('map clicks select visible population lights while drags do not', () => {
  const app = createApp(); app.ready(); app.click('population-toggle'); app.frame();
  const cloud = app.instances.scene.children.find(o => o.name === 'population-dots');
  assert.equal(cloud.visible, true);
  // the dot cloud is one object, so a hit identifies its country by index
  const france = app.population.countries.find(c => c.name === 'France');
  const order = [...app.population.countries].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  let index = 0;
  for (const country of order) {
    if (country === france) break;
    index += app.populationDots.countries[country.name].length / 2;
  }
  const canvas = app.instances.renderer.domElement;
  app.instances.raycaster.hits = [{ object: cloud, index }];
  canvas.emit('pointerdown', { button: 0, clientX: 600, clientY: 400, pointerId: 1 });
  canvas.emit('pointerup', { clientX: 640, clientY: 400, pointerId: 1 });
  assert.equal(app.elements.get('population-place').textContent, 'Worldwide');
  canvas.emit('pointerdown', { button: 0, clientX: 600, clientY: 400, pointerId: 1 });
  canvas.emit('pointerup', { clientX: 601, clientY: 400, pointerId: 1 });
  assert.equal(app.elements.get('population-place').textContent, 'France');
});

test('missing population data leaves the Acts timeline usable', () => {
  const app = createApp({ missingPopulationData: true }); app.ready();
  assert.equal(app.elements.get('population-toggle').disabled, true);
  app.click('btn-next');
  assert.equal(app.step, 1);
  assert.equal(app.elements.get('loading').classList.contains('hidden'), true);
});

test('population dataset has complete source coverage, rounded estimates, and valid map points', () => {
  const app = createApp();
  const data = app.population;
  assert.equal(data.year, 2020);
  assert.equal(data.published, '2025-06-09');
  assert.match(data.sourceUrl, /^https:\/\/www\.pewresearch\.org\//);
  assert.equal(data.countries.length, 201);
  assert.equal(new Set(data.countries.map(row => row.name)).size, 201);
  for (const row of data.countries) {
    assert.ok(Number.isFinite(row.lat) && Math.abs(row.lat) <= 90);
    assert.ok(Number.isFinite(row.lon) && Math.abs(row.lon) <= 180);
    assert.ok(row.count > 0 && row.count % 10000 === 0);
    assert.ok(row.percent >= 0.1 && row.percent <= 99.9);
    assert.ok(['', '<', '>'].includes(row.percentBound));
    if (row.countBelow) assert.equal(row.count, 10000);
  }
  const guiana = data.countries.find(row => row.name === 'French Guiana');
  assert.ok(guiana.lon < -50 && guiana.lat < 6); // not plotted in mainland France
  assert.equal(data.world.percent, 28.8);
});

test('population dots cover each country in proportion to its estimate', () => {
  const app = createApp();
  const dots = app.populationDots;
  assert.equal(dots.perDot, 250000);
  for (const row of app.population.countries) {
    const coords = dots.countries[row.name];
    assert.ok(coords, `${row.name} has no dots`);
    assert.equal(coords.length % 2, 0);
    assert.equal(coords.length / 2, Math.max(1, Math.round(row.count / dots.perDot)));
    for (let i = 0; i < coords.length; i += 2) {
      assert.ok(Number.isFinite(coords[i]) && Math.abs(coords[i]) <= 90);
      assert.ok(Number.isFinite(coords[i + 1]) && Math.abs(coords[i + 1]) <= 180);
    }
  }
  // a large country spreads across its territory rather than stacking on one point
  const nigeria = dots.countries.Nigeria;
  const lats = nigeria.filter((_, i) => i % 2 === 0), lons = nigeria.filter((_, i) => i % 2 === 1);
  assert.ok(lats.length > 300);
  assert.ok(Math.max(...lats) - Math.min(...lats) > 5);
  assert.ok(Math.max(...lons) - Math.min(...lons) > 5);
  assert.ok(Math.min(...lats) > 3 && Math.max(...lats) < 15);   // stays inside Nigeria
  assert.ok(Math.min(...lons) > 2 && Math.max(...lons) < 15);
});

test('the population layer draws every dot in one cloud and hides it with Acts', () => {
  const app = createApp(); app.ready();
  const cloud = app.instances.scene.children.find(o => o.name === 'population-dots');
  const expected = Object.values(app.populationDots.countries).reduce((sum, c) => sum + c.length / 2, 0);
  assert.equal(cloud.geometry.attributes.position.array.length / 3, expected);
  assert.equal(cloud.geometry.attributes.color.array.length / 3, expected);
  assert.equal(cloud.visible, false);
  app.click('population-toggle'); app.frame();
  assert.equal(cloud.visible, true);
  app.click('population-toggle'); app.frame();
  assert.equal(cloud.visible, false);
});

for (const [option, message] of [
  ['missingLibrary', /internet connection/], ['missingData', /files are missing/], ['webglFailure', /WebGL/]
]) {
  test(`${option} shows a recoverable error`, () => {
    const app = createApp({ [option]: true });
    assert.match(app.elements.get('loading-message').textContent, message);
    assert.equal(app.elements.get('btn-retry').hidden, false);
    assert.equal(app.timeouts.size, 0);
    app.click('btn-retry'); assert.equal(app.reloads, 1);
  });
}

test('failed or stalled image loads cannot be hidden by a later load callback', () => {
  for (const fail of [app => app.instances.manager.onError(), app => [...app.timeouts.values()][0]()]) {
    const app = createApp(); fail(app); app.instances.manager.onLoad();
    assert.equal(app.elements.get('loading').classList.contains('hidden'), false);
    assert.equal(app.elements.get('btn-retry').hidden, false);
    assert.equal(app.frames.size, 0);
  }
});

test('WebGL context loss stops playback and exposes the recovery message', () => {
  const app = createApp({ reducedMotion: false }); app.ready(); app.click('btn-play');
  const event = app.instances.renderer.domElement.emit('webglcontextlost');
  assert.equal(event.defaultPrevented, true);
  assert.equal(app.frames.size, 0); assert.equal(app.intervals.size, 0);
  assert.equal(app.elements.get('loading').getAttribute('aria-hidden'), null);
  assert.match(app.elements.get('loading-message').textContent, /graphics connection/);
});

test('all narrative entries reference valid coordinates, categories and growth levels', () => {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(root, 'data.js'), 'utf8'), context);
  const { events, categories, growth, regions } = vm.runInContext('({ events: EVENTS, categories: CATEGORIES, growth: GROWTH, regions: REGIONS })', context);
  for (const event of events) {
    for (const key of ['place', 'subtitle', 'verse', 'text', 'believers']) assert.ok(event[key]?.trim());
    assert.ok(categories[event.category]); assert.ok(growth[event.growth]);
    assert.ok(Math.abs(event.lat) <= 90 && Math.abs(event.lon) <= 180);
  }
  for (const region of regions) {
    assert.ok(['roman', 'modern'].includes(region.era));
    assert.ok([1, 2].includes(region.rank));
    assert.ok(Math.abs(region.lat) <= 90 && Math.abs(region.lon) <= 180);
  }
});

test('embedded image and coastline assets are well formed', () => {
  const context = vm.createContext({});
  for (const file of ['textures.js', 'worldmap.js']) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context);
  assert.deepEqual(Object.keys(context.TEXTURES).sort(), ['clouds', 'earth', 'normal', 'specular']);
  for (const uri of Object.values(context.TEXTURES)) {
    assert.match(uri, /^data:image\/jpeg;base64,/);
    const bytes = Buffer.from(uri.split(',')[1], 'base64');
    assert.equal(bytes.readUInt16BE(0), 0xffd8);
    assert.equal(bytes.readUInt16BE(bytes.length - 2), 0xffd9);
  }
  for (const polygon of context.WORLD_LAND) for (const ring of polygon) {
    assert.ok(ring.length >= 6 && ring.length % 2 === 0);
    for (let i = 0; i < ring.length; i += 2) {
      assert.ok(Math.abs(ring[i]) <= 180 && Math.abs(ring[i + 1]) <= 90);
    }
  }
});
