const svg = document.getElementById('graph');
const edgesGroup = document.getElementById('edges');
const nodesGroup = document.getElementById('nodes');

const NS = 'http://www.w3.org/2000/svg';

// --- Sample data. Replace with real content later. ---
const nodes = [
  { id: 'a', label: 'Node A', x: 300, y: 200 },
  { id: 'b', label: 'Node B', x: 500, y: 150 },
  { id: 'c', label: 'Node C', x: 450, y: 350 },
  { id: 'd', label: 'Node D', x: 650, y: 300 },
  { id: 'e', label: 'Node E', x: 200, y: 400 },
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

// --- Position everything according to current node.x / node.y ---
function render() {
  for (const { edge, el } of edgeElements) {
    const s = nodeById[edge.source];
    const t = nodeById[edge.target];
    el.setAttribute('x1', s.x);
    el.setAttribute('y1', s.y);
    el.setAttribute('x2', t.x);
    el.setAttribute('y2', t.y);
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

// This is where your physics tick loop will go later, e.g.:
//
// function tick() {
//   applyForces(nodes, edges);
//   render();
//   requestAnimationFrame(tick);
// }
// tick();
