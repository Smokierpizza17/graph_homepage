const svg = document.getElementById('graph');
const edgesGroup = document.getElementById('edges');
const nodesGroup = document.getElementById('nodes');

const NS = 'http://www.w3.org/2000/svg';

// Each setting defines its default value and the range of its slider.
const settingsConfig = {
  centering:    { label: 'Centering',     value: 0.05,    min: 0.005,  max: 0.2,   step: 0.005  },
  rotation:     { label: 'Rotation',      value: 0.0005,  min: -0.01,  max: 0.01,  step: 0.0005 },
  repulsion:    { label: 'Repulsion',     value: 10000,   min: 0,      max: 50000, step: 500     },
  linkStrength: { label: 'Link strength', value: 0.05,    min: 0.002,  max: 0.3,   step: 0.002   },
  linkLength:   { label: 'Link length',   value: 100,     min: 10,     max: 400,   step: 5       },
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
// Scattered over a disc covering the whole screen, so rotating never shows a gap.
const starsGroup = document.getElementById('stars');
const STAR_COUNT = 150;
const STAR_PARALLAX = 0.2; // stars turn at this fraction of the graph's rotation
let starAngle = 0;         // radians

const starRadius = Math.hypot(screen.width, screen.height) / 2;
for (let i = 0; i < STAR_COUNT; i++) {
  const r = starRadius * Math.sqrt(Math.random()); // sqrt gives uniform density over the disc
  const angle = Math.random() * 2 * Math.PI;
  const star = document.createElementNS(NS, 'circle');
  star.classList.add('star');
  star.setAttribute('cx', r * Math.cos(angle));
  star.setAttribute('cy', r * Math.sin(angle));
  star.setAttribute('r', 0.4 + Math.random());
  star.setAttribute('opacity', 0.1 + Math.random() * 0.3);
  starsGroup.appendChild(star);
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

function toSVGCoords(evt) {
  const pt = svg.createSVGPoint();
  pt.x = evt.clientX;
  pt.y = evt.clientY;
  return pt.matrixTransform(svg.getScreenCTM().inverse());
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
  starsGroup.setAttribute('transform', `rotate(${starAngle * 180 / Math.PI})`);
  render();
  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);