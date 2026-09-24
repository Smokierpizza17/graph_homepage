const svg = document.getElementById('graph');
const edgesGroup = document.getElementById('edges');
const nodesGroup = document.getElementById('nodes');
const viewportGroup = document.getElementById('viewport');

const NS = 'http://www.w3.org/2000/svg';

// Each setting defines its default value and the range of its slider.
const settingsConfig = {
  centering:    { label: 'Centering',     value: 0.05,    min: 0.005,  max: 0.2,   step: 0.005  },
  rotation:     { label: 'Rotation',      value: 0.0005,  min: -0.01,  max: 0.01,  step: 0.0005 },
  repulsion:    { label: 'Repulsion',     value: 7000,    min: 0,      max: 50000, step: 500     },
  linkStrength: { label: 'Link strength', value: 0.05,    min: 0.002,  max: 0.3,   step: 0.002   },
  linkLength:   { label: 'Link length',   value: 130,     min: 10,     max: 400,   step: 5       },
  damping:      { label: 'Damping',       value: 0.25,    min: 0.01,   max: 1,     step: 0.01    },
  speed:        { label: 'Speed',         value: 50,      min: 1,      max: 100,   step: 1       },
  temperature:  { label: 'Temperature',   value: 0,       min: 0,      max: 20,    step: 0.05    },
};

// Current values, read by the simulation. Updated by the sliders.
const settings = Object.fromEntries(
  Object.entries(settingsConfig).map(([key, cfg]) => [key, cfg.value])
);

// --- Settings panel: one slider per entry in settingsConfig ---
const settingsPanel = document.getElementById('settings');
settingsPanel.open = false;
const sliderControls = []; // { key, slider, output } per setting, used by the Reset! button
for (const [key, cfg] of Object.entries(settingsConfig)) {
  const row = document.createElement('label');
  row.classList.add('setting');

  const name = document.createElement('span');
  name.classList.add('setting-name');
  name.textContent = cfg.label;

  const output = document.createElement('span');
  output.classList.add('setting-value');
  output.textContent = cfg.value;

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = cfg.min;
  slider.max = cfg.max;
  slider.step = cfg.step;
  slider.value = cfg.value;
  slider.addEventListener('input', () => {
    settings[key] = Number(slider.value);
    output.textContent = slider.value;
  });

  row.append(name, output, slider);
  settingsPanel.appendChild(row);
  sliderControls.push({ key, slider, output });
}

// Put every setting and its slider back to the default value
function resetSettings() {
  for (const { key, slider, output } of sliderControls) {
    const value = settingsConfig[key].value;
    settings[key] = value;
    slider.value = value;
    output.textContent = value;
  }
}

// --- Centre the coordinate system: (0, 0) is the middle of the screen ---
// The viewBox matches the element's pixel size, so 1 unit = 1 pixel.
function updateViewBox() {
  const w = svg.clientWidth;
  const h = svg.clientHeight;
  svg.setAttribute('viewBox', `${-w / 2} ${-h / 2} ${w} ${h}`);
}
updateViewBox();
window.addEventListener('resize', updateViewBox);

// --- Background stars: faint dots that turn slowly with the rotation setting ---
// They follow pan and zoom at a fraction of the graph's movement (parallax), so they
// feel far away. The stars fill one square tile, repeated 3x3; panning shifts the
// tiles by the offset modulo the tile size, so the field never runs out.
const starsGroup = document.getElementById('stars');
const STAR_COUNT = 380;              // stars per tile
const STAR_PARALLAX = 0.2;           // stars turn at this fraction of the graph's rotation
const STAR_PAN_PARALLAX = 0.2;       // ...move at this fraction of the pan
const STAR_ZOOM_PARALLAX = 0.3;      // ...and zoom by the graph's zoom to this power
let starAngle = 0;                   // radians

// One screen diagonal per tile: the 3x3 block then covers the screen at any rotation,
// down to a star zoom of 0.5 (the graph's minimum zoom 0.2 gives 0.2^0.3 ≈ 0.62)
const STAR_TILE = Math.hypot(screen.width, screen.height);

const starTiles = document.createElementNS(NS, 'g');
const starTile = document.createElementNS(NS, 'g');
starTile.id = 'star-tile';
for (let i = 0; i < STAR_COUNT; i++) {
  const star = document.createElementNS(NS, 'circle');
  star.classList.add('star');
  star.setAttribute('cx', (Math.random() - 0.5) * STAR_TILE);
  star.setAttribute('cy', (Math.random() - 0.5) * STAR_TILE);
  star.setAttribute('r', 0.4 + Math.random());
  star.setAttribute('opacity', 0.2 + Math.random() * 0.3);
  starTile.appendChild(star);
}
starTiles.appendChild(starTile);
for (let i = -1; i <= 1; i++) {
  for (let j = -1; j <= 1; j++) {
    if (i === 0 && j === 0) continue;
    const copy = document.createElementNS(NS, 'use');
    copy.setAttribute('href', '#star-tile');
    copy.setAttribute('x', i * STAR_TILE);
    copy.setAttribute('y', j * STAR_TILE);
    starTiles.appendChild(copy);
  }
}
starsGroup.appendChild(starTiles);

// Wrap v into [-STAR_TILE / 2, STAR_TILE / 2)
function wrapStar(v) {
  return ((v + STAR_TILE / 2) % STAR_TILE + STAR_TILE) % STAR_TILE - STAR_TILE / 2;
}

// Place the star field for the current rotation, pan and zoom (view is defined below)
function updateStars() {
  const k = view.k ** STAR_ZOOM_PARALLAX;
  // The screen shift we want, turned back into the rotated, scaled star space
  const dx = view.x * STAR_PAN_PARALLAX / k;
  const dy = view.y * STAR_PAN_PARALLAX / k;
  const cos = Math.cos(starAngle);
  const sin = Math.sin(starAngle);
  const tx = wrapStar( cos * dx + sin * dy);
  const ty = wrapStar(-sin * dx + cos * dy);
  starsGroup.setAttribute('transform', `rotate(${starAngle * 180 / Math.PI}) scale(${k})`);
  starTiles.setAttribute('transform', `translate(${tx}, ${ty})`);
}

// --- Graph data, loaded from data/nodes.js and data/edges.js ---
const nodes = NODES.map(({ id, name, link, style, size = 1, centering = 0 }) => ({ id, name, link, style, size, centering }));

// Scatter nodes randomly across the screen and stop them moving;
// the simulation then pulls them back into shape.
function randomizePositions(nodes) {
  for (const node of nodes) {
    node.x = (Math.random() - 0.5) * svg.clientWidth;
    node.y = (Math.random() - 0.5) * svg.clientHeight;
    node.vx = 0;
    node.vy = 0;
  }
}
randomizePositions(nodes);

const randomButton = document.createElement('button');
randomButton.classList.add('settings-button');
randomButton.textContent = 'Random!';
randomButton.addEventListener('click', () => randomizePositions(nodes));

const resetButton = document.createElement('button');
resetButton.classList.add('settings-button');
resetButton.textContent = 'Reset!';
resetButton.addEventListener('click', resetSettings);

// Reset! and Random! side by side, half the width each
const buttonRow = document.createElement('div');
buttonRow.classList.add('settings-buttons');
buttonRow.append(resetButton, randomButton);
settingsPanel.appendChild(buttonRow);

// The settings never take focus, so Tab skips them and keyboard shortcuts
// (Space, H) keep working after touching a slider or button.
for (const el of settingsPanel.querySelectorAll('summary, input, button')) {
  el.setAttribute('tabindex', '-1');
}
settingsPanel.addEventListener('focusin', (evt) => evt.target.blur());

// --- Build a lookup so edges can find node positions by id ---
const nodeById = Object.fromEntries(nodes.map(n => [n.id, n]));

// Skip edges that reference a missing id instead of crashing the render loop
const edges = EDGES
  .filter(edge => {
    const ok = edge.source in nodeById && edge.target in nodeById;
    if (!ok) console.warn('Skipping edge with unknown node id:', edge);
    return ok;
  })
  .map(({ source, target, length = 1 }) => ({ source, target, length }));

// --- Render edges as <line> elements ---
const edgeElements = edges.map(edge => {
  const line = document.createElementNS(NS, 'line');
  line.classList.add('edge');
  edgesGroup.appendChild(line);
  return { edge, el: line };
});

// --- Render nodes as <circle> + <text> pairs, grouped in an <a> link ---
// The node's style becomes a `style-<name>` class on the group, so CSS can
// target both the circle and its label.
const nodeElements = nodes.map(node => {
  const g = document.createElementNS(NS, 'a');
  if (node.link) g.setAttribute('href', node.link); // without href it's just a draggable node
  g.setAttribute('tabindex', '-1'); // keep Tab from cycling through the nodes
  if (node.style) g.classList.add(`style-${node.style}`);

  const circle = document.createElementNS(NS, 'circle');
  circle.classList.add('node');
  circle.setAttribute('r', node.size * 18);

  const text = document.createElementNS(NS, 'text');
  text.classList.add('label');
  text.setAttribute('text-anchor', 'middle');
  text.setAttribute('dy', node.size * -24); // label above the node
  text.textContent = node.name;

  g.appendChild(circle);
  g.appendChild(text);
  nodesGroup.appendChild(g);

  return { node, g, circle, text };
});

// --- Edge colour by strain: compressed -> cyan, at rest -> slate, stretched -> coral ---
// The colours come from the --edge-* variables in style.css (as #rrggbb hex).
function cssColor(name) {
  const hex = getComputedStyle(document.documentElement).getPropertyValue(name).trim().slice(1);
  return [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));
}
const COMPRESSED_COLOR = cssColor('--edge-compressed');
const REST_COLOR       = cssColor('--edge-rest');
const STRETCHED_COLOR  = cssColor('--edge-stretched');

// --- Edge thickness by |strain|: REST_WIDTH at rest, MAX_WIDTH at full strain ---
const REST_WIDTH = 1;
const MAX_WIDTH  = 3;

function mixColor(a, b, t) {
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(', ')})`;
}

// strain = relative change in length, clamped to [-1, 1]
// (-1 = fully collapsed, 1 = stretched to double the rest length)
function edgeStrain(naturalLength, dist) {
  return Math.max(-1, Math.min(1, (dist - naturalLength) / naturalLength));
}

function strainColor(strain) {
  return strain < 0
    ? mixColor(REST_COLOR, COMPRESSED_COLOR, -strain)
    : mixColor(REST_COLOR, STRETCHED_COLOR, strain);
}

// --- Position everything according to current node.x / node.y ---
function render() {
  for (const { edge, el } of edgeElements) {
    const s = nodeById[edge.source];
    const t = nodeById[edge.target];
    el.setAttribute('x1', s.x);
    el.setAttribute('y1', s.y);
    el.setAttribute('x2', t.x);
    el.setAttribute('y2', t.y);
    const strain = edgeStrain(edge.length * settings.linkLength, Math.hypot(t.x - s.x, t.y - s.y));
    el.style.stroke = strainColor(strain);
    el.style.strokeWidth = REST_WIDTH + (MAX_WIDTH - REST_WIDTH) * Math.abs(strain);
  }

  for (const { node, g } of nodeElements) {
    g.setAttribute('transform', `translate(${node.x}, ${node.y})`);
  }
}

render();

// --- Dragging ---
// Hover is handled entirely by CSS (:hover). Dragging needs manual
// pointer tracking since SVG doesn't have a native drag API.
// Pointer events cover mouse, touch and pen alike.

let dragTarget = null;
let dragPointerId = null; // which pointer (finger/mouse) is dragging, so a second finger is ignored
let dragStart = null; // pointer position at pointerdown, in screen pixels
let didDrag = false;  // true once the pointer moved far enough to count as a drag

const DRAG_THRESHOLD = 4; // pixels of movement before a press becomes a drag

// Screen position -> graph coordinates, taking the current pan and zoom into account
function toSVGCoords(evt) {
  const pt = svg.createSVGPoint();
  pt.x = evt.clientX;
  pt.y = evt.clientY;
  return pt.matrixTransform(viewportGroup.getScreenCTM().inverse());
}

nodeElements.forEach(({ node, g, circle }) => {
  circle.addEventListener('pointerdown', (evt) => {
    if (evt.button !== 0) return; // leave middle-click etc. to the browser
    if (dragTarget) return;       // already dragging with another finger
    evt.preventDefault();
    dragTarget = node;
    dragPointerId = evt.pointerId;
    dragStart = { x: evt.clientX, y: evt.clientY };
    didDrag = false;
    circle.classList.add('dragging');
  });

  // Stop the browser's native link drag
  g.addEventListener('dragstart', (evt) => evt.preventDefault());

  // A press that turned into a drag shouldn't also follow the link
  g.addEventListener('click', (evt) => {
    if (didDrag) evt.preventDefault();
  });
});

window.addEventListener('pointermove', (evt) => {
  if (!dragTarget || evt.pointerId !== dragPointerId) return;
  if (!didDrag) {
    const moved = Math.hypot(evt.clientX - dragStart.x, evt.clientY - dragStart.y);
    if (moved < DRAG_THRESHOLD) return;
    didDrag = true;
  }
  const { x, y } = toSVGCoords(evt);
  dragTarget.x = x;
  dragTarget.y = y;
  render();
});

function endDrag(evt) {
  if (!dragTarget || evt.pointerId !== dragPointerId) return;
  document.querySelectorAll('.node.dragging').forEach(el => el.classList.remove('dragging'));
  dragTarget = null;
  dragPointerId = null;
}
window.addEventListener('pointerup', endDrag);
window.addEventListener('pointercancel', endDrag); // e.g. the browser took over the touch

// --- Pan and zoom ---
// The view is a translate + scale on the #viewport group. Pan with a left drag
// on the background, a middle drag anywhere, or one finger on the background;
// zoom with the wheel (or trackpad pinch) or a two-finger pinch.
// Double click / double tap, Space or H put the view back.

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 5;
const WHEEL_ZOOM_SPEED = 0.0015;  // zoom factor per wheel pixel
const WHEEL_ZOOM_SMOOTHING = 80;  // ms time constant for easing towards the wheel's target zoom
const DOUBLE_TAP_TIME = 300;      // ms between taps to count as a double tap
const DOUBLE_TAP_DISTANCE = 30;   // px the second tap may land from the first
const RESET_DURATION = 300;       // ms for the reset animation

const view = { x: 0, y: 0, k: 1 }; // pan offset in screen pixels, zoom factor
let resetAnimation = null;        // requestAnimationFrame id while resetting
let zoomAnimation = null;         // requestAnimationFrame id while easing a wheel zoom
let zoomTarget = null;            // { k, s }: zoom to ease towards, and the screen point to keep fixed

function clampZoom(k) {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, k));
}

function applyView() {
  viewportGroup.setAttribute('transform', `translate(${view.x}, ${view.y}) scale(${view.k})`);
}

// Screen position relative to the centre of the SVG, i.e. in the viewBox's units
function screenPoint(evt) {
  const rect = svg.getBoundingClientRect();
  return { x: evt.clientX - rect.left - rect.width / 2, y: evt.clientY - rect.top - rect.height / 2 };
}

// Screen point -> graph point under it
function graphPoint(s) {
  return { x: (s.x - view.x) / view.k, y: (s.y - view.y) / view.k };
}

// Stop any reset or wheel-zoom easing, e.g. because the user grabbed the view
function stopViewAnimation() {
  if (resetAnimation !== null) cancelAnimationFrame(resetAnimation);
  if (zoomAnimation !== null) cancelAnimationFrame(zoomAnimation);
  resetAnimation = null;
  zoomAnimation = null;
  zoomTarget = null;
}

// Ease back to no pan, zoom 1
function resetView() {
  stopViewAnimation();
  const from = { ...view };
  const start = performance.now();
  function step(now) {
    const t = Math.min((now - start) / RESET_DURATION, 1);
    const ease = 1 - (1 - t) ** 3; // ease-out cubic
    view.x = from.x * (1 - ease);
    view.y = from.y * (1 - ease);
    view.k = from.k + (1 - from.k) * ease;
    applyView();
    resetAnimation = t < 1 ? requestAnimationFrame(step) : null;
  }
  resetAnimation = requestAnimationFrame(step);
}

// Pointers currently panning, by pointerId -> latest screen point.
// With one pointer the graph point under it stays under it; with two or more the
// graph point under their centroid does, and their spread sets the zoom.
const panPointers = new Map();
let panAnchor = null;   // graph point pinned under the centroid
let panBaseSpread = 0;  // pointer spread when the anchor was set
let panBaseZoom = 1;    // zoom when the anchor was set
let panStart = null;    // first pointer's start, to tell a pan from a click
let didPan = false;

function panCentroid() {
  let x = 0, y = 0;
  for (const p of panPointers.values()) { x += p.x; y += p.y; }
  return { x: x / panPointers.size, y: y / panPointers.size };
}

function panSpread(c) {
  let sum = 0;
  for (const p of panPointers.values()) sum += Math.hypot(p.x - c.x, p.y - c.y);
  return sum / panPointers.size;
}

// Re-pin whenever a finger is added or lifted, so the view doesn't jump
function resetPanAnchor() {
  if (panPointers.size === 0) { panAnchor = null; return; }
  const c = panCentroid();
  panAnchor = graphPoint(c);
  panBaseSpread = panSpread(c);
  panBaseZoom = view.k;
}

svg.addEventListener('pointerdown', (evt) => {
  const onNode = evt.target.classList.contains('node');
  const isMiddle = evt.pointerType === 'mouse' && evt.button === 1;
  if (!isMiddle && (evt.button !== 0 || onNode)) return; // left presses on nodes are node drags
  evt.preventDefault(); // no middle-click autoscroll, no text selection
  stopViewAnimation();
  if (panPointers.size === 0) {
    panStart = { x: evt.clientX, y: evt.clientY };
    didPan = false;
  }
  panPointers.set(evt.pointerId, screenPoint(evt));
  resetPanAnchor();
  svg.classList.add('panning');
});

window.addEventListener('pointermove', (evt) => {
  if (!panPointers.has(evt.pointerId)) return;
  if (!didPan) {
    if (Math.hypot(evt.clientX - panStart.x, evt.clientY - panStart.y) < DRAG_THRESHOLD) return;
    didPan = true;
  }
  panPointers.set(evt.pointerId, screenPoint(evt));
  const c = panCentroid();
  if (panPointers.size > 1 && panBaseSpread > 0) {
    view.k = clampZoom(panBaseZoom * panSpread(c) / panBaseSpread);
  }
  view.x = c.x - panAnchor.x * view.k;
  view.y = c.y - panAnchor.y * view.k;
  applyView();
});

function endPan(evt) {
  if (!panPointers.delete(evt.pointerId)) return;
  resetPanAnchor();
  if (panPointers.size === 0) svg.classList.remove('panning');
}
window.addEventListener('pointerup', endPan);
window.addEventListener('pointercancel', endPan);

// A middle-drag that started on a link shouldn't also open it in a new tab
svg.addEventListener('auxclick', (evt) => {
  if (didPan) evt.preventDefault();
});

// Wheel zooms around the cursor. Trackpad pinch arrives as a wheel event with ctrlKey.
// Each wheel event moves a target zoom; the view eases towards it every frame,
// keeping the graph point under the cursor fixed, so mouse wheel notches don't jump.
let lastZoomFrame = 0;

function zoomStep(now) {
  const dt = Math.min(now - lastZoomFrame, 50);
  lastZoomFrame = now;
  const { k: targetK, s } = zoomTarget;
  const g = graphPoint(s);
  // Ease in log space so zooming in and out feel the same
  const ease = 1 - Math.exp(-dt / WHEEL_ZOOM_SMOOTHING);
  const done = Math.abs(Math.log(targetK / view.k)) < 0.001;
  view.k = done ? targetK : view.k * (targetK / view.k) ** ease;
  view.x = s.x - g.x * view.k;
  view.y = s.y - g.y * view.k;
  applyView();
  if (done) {
    zoomAnimation = null;
    zoomTarget = null;
  } else {
    zoomAnimation = requestAnimationFrame(zoomStep);
  }
}

svg.addEventListener('wheel', (evt) => {
  evt.preventDefault();
  if (resetAnimation !== null) stopViewAnimation();
  const pixels = evt.deltaMode === 1 ? evt.deltaY * 16 : evt.deltaY; // lines -> pixels
  const fromK = zoomTarget ? zoomTarget.k : view.k;
  zoomTarget = {
    k: clampZoom(fromK * Math.exp(-pixels * WHEEL_ZOOM_SPEED * (evt.ctrlKey ? 5 : 1))),
    s: screenPoint(evt),
  };
  if (zoomAnimation === null) {
    lastZoomFrame = performance.now();
    zoomAnimation = requestAnimationFrame(zoomStep);
  }
}, { passive: false });

// Double click / double tap anywhere resets the view. Detected by hand rather than
// with dblclick, which mobile browsers don't fire reliably.
let tapStart = null;
let lastTap = null; // { time, x, y } of the previous tap
svg.addEventListener('pointerdown', (evt) => {
  if (evt.isPrimary && evt.button === 0) tapStart = { x: evt.clientX, y: evt.clientY };
});
window.addEventListener('pointerup', (evt) => {
  if (!evt.isPrimary || !tapStart) return;
  const moved = Math.hypot(evt.clientX - tapStart.x, evt.clientY - tapStart.y);
  tapStart = null;
  if (moved >= DRAG_THRESHOLD) { lastTap = null; return; }
  const now = performance.now();
  if (lastTap && now - lastTap.time < DOUBLE_TAP_TIME &&
      Math.hypot(evt.clientX - lastTap.x, evt.clientY - lastTap.y) < DOUBLE_TAP_DISTANCE) {
    resetView();
    lastTap = null;
  } else {
    lastTap = { time: now, x: evt.clientX, y: evt.clientY };
  }
});

// Space or H resets the view
window.addEventListener('keydown', (evt) => {
  if (evt.ctrlKey || evt.metaKey || evt.altKey) return;
  if (evt.key === ' ' || evt.key === 'h' || evt.key === 'H') {
    evt.preventDefault();
    resetView();
  }
});

// Standard normal sample (mean 0, std 1)
function randn() {
  const u = 1 - Math.random(); // (0, 1], avoids log(0)
  const v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function applyForces(nodes, edges, dt) {
  for (const node of nodes) {
    // // dampening (F~v)
    // node.vx += - settings.damping * node.vx * dt;
    // node.vy += - settings.damping * node.vy * dt;

    // // gentle rotation (v~r)
    // node.vx -= settings.rotation * node.y * dt;
    // node.vy += settings.rotation * node.x * dt;

    // drag toward a gently rotating fluid (F ~ v_fluid - v)
    const fluidVx = -settings.rotation * node.y;
    const fluidVy =  settings.rotation * node.x;
    node.vx += - settings.damping * (node.vx - fluidVx) * dt / node.size;
    node.vy += - settings.damping * (node.vy - fluidVy) * dt / node.size;

    // temperature (Langevin thermostat)
    const kick = Math.sqrt(2 * settings.damping * settings.temperature * dt / node.size);
    node.vx += kick * randn();
    node.vy += kick * randn();

    // centering force (F~r)
    node.vx += - node.centering * settings.centering * node.x * dt / node.size;
    node.vy += - node.centering * settings.centering * node.y * dt / node.size;

    // node-node repulsion (~r^2)
    for (const other of nodes) {
      if (other === node) continue;
      const dx = node.x - other.x;
      const dy = node.y - other.y;
      const distSq = dx * dx + dy * dy || 0.01; // avoid divide-by-zero when overlapping
      const dist = Math.sqrt(distSq);
      const force = settings.repulsion / distSq;
      node.vx += force * (dx / dist) * dt / node.size;
      node.vy += force * (dy / dist) * dt / node.size;
    }
  }

  // edge elasticity (~r)
  for (const edge of edges) {
    const nodeA = nodeById[edge.source];
    const nodeB = nodeById[edge.target];
    const dx = nodeA.x - nodeB.x;
    const dy = nodeA.y - nodeB.y;
    const distSq = dx * dx + dy * dy || 0.01; // avoid divide-by-zero when overlapping
    const dist = Math.sqrt(distSq);
    const force = - settings.linkStrength * (dist - settings.linkLength * edge.length);
    nodeA.vx += force * (dx / dist) * dt / nodeA.size;
    nodeA.vy += force * (dy / dist) * dt / nodeA.size;
    nodeB.vx += - force * (dx / dist) * dt / nodeB.size;
    nodeB.vy += - force * (dy / dist) * dt / nodeB.size;
  }
}


let lastTime = 0;

function tick(currentTime) {
  const dt = settings.speed * Math.min((currentTime - lastTime) / 1000, 0.05); // seconds since last frame
  lastTime = currentTime;
  
  applyForces(nodes, edges, dt);
  for (const node of nodes) {
    if (node === dragTarget) {
      node.vx = 0;
      node.vy = 0;
      continue;
    }
    node.x += node.vx * dt;
    node.y += node.vy * dt;
  }
  starAngle += settings.rotation * STAR_PARALLAX * dt;
  updateStars();
  render();
  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);