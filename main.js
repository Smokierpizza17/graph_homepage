const svg = document.getElementById('graph');
const edgesGroup = document.getElementById('edges');
const nodesGroup = document.getElementById('nodes');

const NS = 'http://www.w3.org/2000/svg';

// Each setting defines its default value and the range of its slider.
const settingsConfig = {
  centering:    { label: 'Centering',     value: 0.003, min: 0.0005,  max: 0.02,  step: 0.0005 },
  repulsion:    { label: 'Repulsion',     value: 10000, min: 500,  max: 50000, step: 500 },
  linkStrength: { label: 'Link strength', value: 0.05,  min: 0.002,  max: 0.3,   step: 0.002 },
  linkLength:   { label: 'Link length',   value: 100,   min: 10, max: 400,   step: 5 },
  damping:      { label: 'Damping',       value: 0.25,  min: 0.01,  max: 1,     step: 0.01 },
  speed:        { label: 'Speed',         value: 50,    min: 1,  max: 100,   step: 1 },
  temperature:  { label: 'Temperature',   value: 0.05,    min: 0,  max: 20, step: 0.05},
};

// Current values, read by the simulation. Updated by the sliders.
const settings = Object.fromEntries(
  Object.entries(settingsConfig).map(([key, cfg]) => [key, cfg.value])
);

// --- Settings panel: one slider per entry in settingsConfig ---
const settingsPanel = document.getElementById('settings');
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

// --- Sample data. Replace with real content later. ---
const nodes = [
  { id: 'a', label: 'Node A', x: -100, y:  -100, vx: -70, vy: 70  },
  { id: 'b', label: 'Node B', x:   50, y: -125, vx: -50, vy: 0   },
  { id: 'c', label: 'Node C', x:    0, y:   75, vx: 0, vy: 0     },
  { id: 'd', label: 'Node D', x:  200, y:   25, vx: 50, vy: -200 },
  { id: 'e', label: 'Node E', x: -250, y:  125, vx: -100, vy: 0  },
];

const edges = [
  { source: 'a', target: 'b' },
  { source: 'a', target: 'c' },
  { source: 'b', target: 'd' },
  { source: 'c', target: 'd' },
  { source: 'c', target: 'e' },
];

// --- Build a lookup so edges can find node positions by id ---
const nodeById = Object.fromEntries(nodes.map(n => [n.id, n]));

// --- Render edges as <line> elements ---
const edgeElements = edges.map(edge => {
  const line = document.createElementNS(NS, 'line');
  line.classList.add('edge');
  edgesGroup.appendChild(line);
  return { edge, el: line };
});

// --- Render nodes as <circle> + <text> pairs, grouped in <g> ---
const nodeElements = nodes.map(node => {
  const g = document.createElementNS(NS, 'g');

  const circle = document.createElementNS(NS, 'circle');
  circle.classList.add('node');
  circle.setAttribute('r', 18);

  const text = document.createElementNS(NS, 'text');
  text.classList.add('label');
  text.setAttribute('text-anchor', 'middle');
  text.setAttribute('dy', -24); // label above the node
  text.textContent = node.label;

  g.appendChild(circle);
  g.appendChild(text);
  nodesGroup.appendChild(g);

  return { node, g, circle, text };
});

// --- Edge colour by strain: compressed -> blue, at rest -> grey, stretched -> red ---
const COMPRESSED_COLOR = [70, 130, 230];
const REST_COLOR       = [85, 85, 85];
const STRETCHED_COLOR  = [230, 70, 70];

// --- Edge thickness by |strain|: REST_WIDTH at rest, MAX_WIDTH at full strain ---
const REST_WIDTH = 1;
const MAX_WIDTH  = 3;

function mixColor(a, b, t) {
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(', ')})`;
}

// strain = relative change in length, clamped to [-1, 1]
// (-1 = fully collapsed, 1 = stretched to double the rest length)
function edgeStrain(dist) {
  return Math.max(-1, Math.min(1, (dist - settings.linkLength) / settings.linkLength));
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
    const strain = edgeStrain(Math.hypot(t.x - s.x, t.y - s.y));
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
// mouse tracking since SVG doesn't have a native drag API.

let dragTarget = null;

function toSVGCoords(evt) {
  const pt = svg.createSVGPoint();
  pt.x = evt.clientX;
  pt.y = evt.clientY;
  return pt.matrixTransform(svg.getScreenCTM().inverse());
}

nodeElements.forEach(({ node, g, circle }) => {
  circle.addEventListener('mousedown', () => {
    dragTarget = node;
    circle.classList.add('dragging');
  });
});

window.addEventListener('mousemove', (evt) => {
  if (!dragTarget) return;
  const { x, y } = toSVGCoords(evt);
  dragTarget.x = x;
  dragTarget.y = y;
  render();
});

window.addEventListener('mouseup', () => {
  if (!dragTarget) return;
  document.querySelectorAll('.node.dragging').forEach(el => el.classList.remove('dragging'));
  dragTarget = null;
});

// Standard normal sample (mean 0, std 1)
function randn() {
  const u = 1 - Math.random(); // (0, 1], avoids log(0)
  const v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function applyForces(nodes, edges, dt) {
  for (const node of nodes) {
    // dampening (F~v)
    node.vx += - settings.damping * node.vx * dt;
    node.vy += - settings.damping * node.vy * dt;

    // temperature (Langevin thermostat)
    const kick = Math.sqrt(2 * settings.damping * settings.temperature * dt);
    node.vx += kick * randn();
    node.vy += kick * randn();

    // centering force (F~r)
    node.vx += - settings.centering * node.x * dt;
    node.vy += - settings.centering * node.y * dt;

    // node-node repulsion (~r^2)
    for (const other of nodes) {
      if (other === node) continue;
      const dx = node.x - other.x;
      const dy = node.y - other.y;
      const distSq = dx * dx + dy * dy || 0.01; // avoid divide-by-zero when overlapping
      const dist = Math.sqrt(distSq);
      const force = settings.repulsion / distSq;
      node.vx += force * (dx / dist) * dt;
      node.vy += force * (dy / dist) * dt;
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
    const force = - settings.linkStrength * (dist - settings.linkLength);
    nodeA.vx += force * (dx / dist) * dt;
    nodeA.vy += force * (dy / dist) * dt;
    nodeB.vx += - force * (dx / dist) * dt;
    nodeB.vy += - force * (dy / dist) * dt;
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
  render();
  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);