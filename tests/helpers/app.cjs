// A small DOM/Three.js stand-in for exercising the real application script.
// These tests cover state and events; they do not validate WebGL rendering.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '../..');

class Target {
  listeners = new Map();
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }
  emit(type, event = {}) {
    event.target ??= this;
    event.preventDefault ??= () => { event.defaultPrevented = true; };
    for (const listener of this.listeners.get(type) || []) listener(event);
    return event;
  }
}

class Element extends Target {
  constructor(tag = 'div', attributes = '') {
    super();
    this.tagName = tag.toUpperCase();
    this.attributes = Object.fromEntries(
      [...attributes.matchAll(/([\w-]+)="([^"]*)"/g)].map(m => [m[1], m[2]])
    );
    this.className = this.attributes.class || '';
    this.value = this.attributes.value || '';
    this.hidden = /\bhidden(?:\s|$)/.test(attributes);
    this.children = [];
    this.style = {};
    this.textContent = '';
    this.scrollTop = 0;
    this.classList = {
      contains: name => this.className.split(/\s+/).includes(name),
      add: (...names) => names.forEach(name => this.classList.toggle(name, true)),
      remove: (...names) => names.forEach(name => this.classList.toggle(name, false)),
      toggle: (name, force) => {
        const names = new Set(this.className.split(/\s+/).filter(Boolean));
        const wanted = force ?? !names.has(name);
        if (wanted) names.add(name); else names.delete(name);
        this.className = [...names].join(' ');
        return wanted;
      }
    };
  }
  setAttribute(key, value) { this.attributes[key] = String(value); }
  getAttribute(key) { return this.attributes[key] ?? null; }
  removeAttribute(key) { delete this.attributes[key]; }
  appendChild(child) { this.children.push(child); }
  replaceChildren(...children) { this.children = children; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 1280, height: 800 }; }
  querySelectorAll() { return this.children; }
  closest(selector) {
    if (selector === 'button[data-era]') return this.attributes['data-era'] ? this : null;
    return /^(INPUT|TEXTAREA|SELECT)$/.test(this.tagName)
      || 'contenteditable' in this.attributes || this.attributes.role === 'slider' ? this : null;
  }
  focus() { this.focused = true; }
  getContext() {
    return new Proxy({}, { get: (_, key) => key === 'createRadialGradient'
      ? () => ({ addColorStop() {} }) : () => {} });
  }
}

class Vector {
  constructor(x = 0, y = 0, z = 0) { this.set(x, y, z); }
  set(x, y, z = 0) { Object.assign(this, { x, y, z }); return this; }
  setScalar(n) { return this.set(n, n, n); }
  copy(v) { return this.set(v.x, v.y, v.z); }
  clone() { return new Vector().copy(this); }
  add(v) { return this.set(this.x + v.x, this.y + v.y, this.z + v.z); }
  addScaledVector(v, n) { return this.add(v.clone().multiplyScalar(n)); }
  multiplyScalar(n) { return this.set(this.x * n, this.y * n, this.z * n); }
  length() { return Math.hypot(this.x, this.y, this.z); }
  normalize() { return this.multiplyScalar(1 / (this.length() || 1)); }
  dot(v) { return this.x * v.x + this.y * v.y + this.z * v.z; }
  angleTo(v) { return Math.acos(Math.max(-1, Math.min(1, this.dot(v) / (this.length() * v.length())))); }
  crossVectors(a, b) { return this.set(a.y*b.z-a.z*b.y, a.z*b.x-a.x*b.z, a.x*b.y-a.y*b.x); }
  applyAxisAngle() { return this; }
  applyQuaternion() { return this; }
}

class Quaternion {
  setFromUnitVectors() { return this; }
  clone() { return new Quaternion(); }
  slerp() { return this; }
}

class Color {
  constructor(hex = 0) { this.r = (hex >> 16 & 255) / 255; this.g = (hex >> 8 & 255) / 255; this.b = (hex & 255) / 255; }
  copy(c) { Object.assign(this, c); return this; }
  clone() { return new Color().copy(this); }
  lerp(c, t) { for (const k of ['r', 'g', 'b']) this[k] += (c[k] - this[k]) * t; return this; }
  convertSRGBToLinear() {
    for (const k of ['r', 'g', 'b']) this[k] = this[k] <= 0.04045 ? this[k] / 12.92 : ((this[k] + 0.055) / 1.055) ** 2.4;
    return this;
  }
}

class Object3D {
  constructor(geometry, material) {
    Object.assign(this, { geometry, material, visible: true, position: new Vector(),
      scale: new Vector(1, 1, 1), center: new Vector(), rotation: new Vector(), quaternion: new Quaternion() });
  }
  lookAt() {}
  rotateX() {}
  updateProjectionMatrix() {}
}
class Geometry {
  attributes = {};
  setAttribute(name, attribute) { this.attributes[name] = attribute; return this; }
  setFromPoints() { return this; }
}
class Attribute {
  constructor(array, itemSize) { Object.assign(this, { array, itemSize, count: array?.length / itemSize }); }
}
class Material { constructor(options) { Object.assign(this, options); } }

function createApp(options = {}) {
  const elements = new Map();
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  for (const [, tag, attributes, id] of html.matchAll(/<([\w-]+)\b([^>]*\bid="([^"]+)"[^>]*)>/g)) {
    elements.set(id, new Element(tag, attributes));
  }
  const eraButtons = [...html.matchAll(/<button\b([^>]*data-era="[^"]+"[^>]*)>/g)]
    .map(m => new Element('button', m[1]));
  elements.get('era-switch').children = eraButtons;
  const document = Object.assign(new Target(), {
    hidden: false,
    getElementById: id => elements.get(id),
    createElement: tag => new Element(tag)
  });
  const preference = Object.assign(new Target(), { matches: options.reducedMotion ?? true });
  let reloads = 0;
  const window = Object.assign(new Target(), {
    innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1,
    location: { reload: () => reloads++ }, matchMedia: () => preference
  });
  const frames = new Map(), intervals = new Map(), timeouts = new Map();
  let nextId = 1, now = 100;
  const instances = {}, errors = [];
  const THREE = {
    Color, Vector2: Vector, Vector3: Vector, Quaternion,
    Scene: class { constructor() { this.children = []; instances.scene = this; } add(child) { this.children.push(child); } },
    PerspectiveCamera: class extends Object3D { constructor(fov, aspect) { super(); this.aspect = aspect; instances.camera = this; } },
    WebGLRenderer: class {
      constructor() {
        if (options.webglFailure) throw new Error('WebGL unavailable');
        this.domElement = new Element('canvas');
        this.capabilities = { getMaxAnisotropy: () => 1 };
        instances.renderer = this;
      }
      setPixelRatio() {} setSize() {} setClearColor() {} render() {}
    },
    CSS2DRenderer: class { constructor() { this.domElement = new Element(); } setSize() {} render() {} },
    CSS2DObject: class extends Object3D { constructor(element) { super(); this.element = element; } },
    OrbitControls: class extends Target {
      constructor() { super(); this.target = new Vector(); instances.controls = this; }
      update() {}
    },
    Raycaster: class {
      constructor() { this.hits = []; this.params = { Points: { threshold: 1 } }; instances.raycaster = this; }
      setFromCamera() {}
      intersectObjects(objects) { return this.hits.filter(hit => objects.includes(hit.object)); }
    },
    AmbientLight: Object3D, DirectionalLight: Object3D, Points: Object3D,
    Mesh: class extends Object3D {}, Line: class extends Object3D {},
    Sprite: class extends Object3D { constructor(material) { super(null, material); } },
    BufferGeometry: Geometry, SphereGeometry: Geometry, RingGeometry: Geometry, BufferAttribute: Attribute,
    PointsMaterial: Material, SpriteMaterial: Material, MeshPhongMaterial: Material,
    MeshStandardMaterial: Material, ShaderMaterial: Material,
    MeshBasicMaterial: Material, LineBasicMaterial: Material,
    CanvasTexture: class { constructor(image) { this.image = image; } },
    LoadingManager: class { constructor() { instances.manager = this; } },
    TextureLoader: class { load() { return {}; } },
    QuadraticBezierCurve3: class { getPoints() { return []; } getPoint() { return new Vector(); } },
    Clock: class { getDelta() { return 0.016; } }
  };
  const sandbox = {
    document, window, THREE, console: { error: (...args) => errors.push(args) },
    performance: { now: () => now }, WORLD_LAND: [], TEXTURES: {},
    Path2D: class { moveTo() {} lineTo() {} closePath() {} },
    requestAnimationFrame: callback => { const id = nextId++; frames.set(id, callback); return id; },
    cancelAnimationFrame: id => frames.delete(id),
    setInterval: callback => { const id = nextId++; intervals.set(id, callback); return id; },
    clearInterval: id => intervals.delete(id),
    setTimeout: callback => { const id = nextId++; timeouts.set(id, callback); return id; },
    clearTimeout: id => timeouts.delete(id)
  };
  if (options.missingLibrary) delete sandbox.THREE;
  if (options.missingData) delete sandbox.WORLD_LAND;
  const context = vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(root, 'data.js'), 'utf8'), context);
  if (!options.missingPopulationData) {
    vm.runInContext(fs.readFileSync(path.join(root, 'population-data.js'), 'utf8'), context);
    if (!options.missingPopulationDots) vm.runInContext(fs.readFileSync(path.join(root, 'population-dots.js'), 'utf8'), context);
  }
  vm.runInContext(fs.readFileSync(path.join(root, 'population.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(root, 'main.js'), 'utf8'), context);
  const app = {
    elements, eraButtons, window, document, preference, instances, frames, intervals, timeouts, errors, THREE,
    get reloads() { return reloads; },
    get events() { return vm.runInContext('EVENTS', context); },
    get population() { return vm.runInContext('CHRISTIAN_POPULATION', context); },
    get populationDots() { return vm.runInContext('typeof CHRISTIAN_POPULATION_DOTS === "undefined" ? null : CHRISTIAN_POPULATION_DOTS', context); },
    get step() { return Number(elements.get('timeline-slider').value); },
    click: id => elements.get(id).emit('click'),
    select: step => { elements.get('timeline-slider').value = String(step); elements.get('timeline-slider').emit('input'); },
    frame: (elapsed = 2000) => {
      now += elapsed;
      const pending = [...frames.values()]; frames.clear();
      pending.forEach(callback => callback(now));
    },
    tick: () => { now += 2100; [...intervals.values()].forEach(callback => callback()); },
    ready: () => { instances.manager.onLoad(); app.frame(); }
  };
  return app;
}

module.exports = { createApp, root };
