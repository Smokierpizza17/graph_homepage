// Drawing the graph: SVG elements for nodes and edges, and render() to move them
// to the current node positions.

const NODE_RADIUS = 18;   // at size 1
const LABEL_OFFSET = 24;  // label height above the node's centre, at size 1

// --- Nodes: a <circle> + <text> pair, grouped in an <a> link ---
// The node's style becomes a `style-<name>` class on the group, so CSS can
// target both the circle and its label.
const nodeElements = nodes.map(node => {
  const g = svgElement('a', { tabindex: -1 }, node.style && `style-${node.style}`); // tabindex: keep Tab from cycling through the nodes
  if (node.link) g.setAttribute('href', node.link); // without href it's just a draggable node

  const circle = svgElement('circle', { r: node.size * NODE_RADIUS }, 'node');
  const text = svgElement('text', { 'text-anchor': 'middle', dy: node.size * -LABEL_OFFSET }, 'label');
  text.textContent = node.name;

  g.append(circle, text);
  document.getElementById('nodes').appendChild(g);
  return { node, g, circle };
});

// --- Node glow ---
// 'gradient': a circle behind each node, filled with a radial gradient that fades
//   out like a blur would. About as cheap to draw as the node itself.
// 'filter': a CSS drop-shadow on the node (see .glow-filter in css/graph.css). The
//   same look, but every moving node's blur is recomputed every frame.
// Hover and drag glows are drop-shadow filters either way; only one node has them.
const NODE_GLOW = 'gradient';

const GLOW_BLUR = 5; // px, like drop-shadow(0 0 5px); the blur's standard deviation
// Opacity of a blurred straight edge by distance outside it, in units of GLOW_BLUR
// (the Gaussian tail, 1 - Φ(d)). Linear between stops, so they're close together.
const GLOW_FALLOFF = [
  [0, 0.5], [0.25, 0.401], [0.5, 0.309], [0.75, 0.227], [1, 0.159], [1.25, 0.106],
  [1.5, 0.067], [1.75, 0.040], [2, 0.023], [2.5, 0.006], [3, 0],
];

// One gradient per node: a gradient's colour can't come from the element using it,
// so each one gets its node's --node-color baked in
function addGlow({ node, g }, i, defs) {
  const radius = node.size * NODE_RADIUS;
  const outer = radius + GLOW_FALLOFF.at(-1)[0] * GLOW_BLUR;
  const color = getComputedStyle(g).getPropertyValue('--node-color').trim();
  const gradient = svgElement('radialGradient', { id: `glow-${i}`, gradientUnits: 'userSpaceOnUse', cx: 0, cy: 0, r: outer });
  for (const [x, edgeOpacity] of GLOW_FALLOFF) {
    const distance = x * GLOW_BLUR;
    const offset = (radius + distance) / outer;
    // A round node's glow thins out faster than a straight edge's, as it spreads
    // over a growing circumference
    const opacity = edgeOpacity * Math.sqrt(radius / (radius + distance));
    gradient.appendChild(svgElement('stop', { offset, 'stop-color': color, 'stop-opacity': opacity }));
  }
  defs.appendChild(gradient);
  g.prepend(svgElement('circle', { r: outer, fill: `url(#glow-${i})` }, 'glow'));
}

if (NODE_GLOW === 'gradient') {
  const defs = svgElement('defs');
  svg.prepend(defs);
  nodeElements.forEach((nodeElement, i) => addGlow(nodeElement, i, defs));
} else {
  svg.classList.add('glow-filter');
}

// --- Edges: a <path>, so they can be straight or curved ---
// The edge's style becomes an `edge-<name>` class, like node styles.
const edgeElements = edges.map(edge => {
  const el = svgElement('path', {}, 'edge', edge.style && `edge-${edge.style}`);
  document.getElementById(edge.behind ? 'edges-behind' : 'edges').appendChild(el);
  return { edge, el, bendSign: 1 };
});

// Path data for a curved edge bulges outward (away from the centre) by edge.curve
// times its length. The side only flips once the midpoint is clearly on the other
// side, so an edge that passes near the centre doesn't flicker between the two.
const BEND_FLIP_THRESHOLD = 0.2;

function edgePath(edgeElement) {
  const { source: s, target: t, curve } = edgeElement.edge;
  if (!curve) return `M ${s.x} ${s.y} L ${t.x} ${t.y}`;
  const dx = t.x - s.x;
  const dy = t.y - s.y;
  const mx = (s.x + t.x) / 2;
  const my = (s.y + t.y) / 2;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len; // unit normal to the edge
  const ny =  dx / len;
  const outward = (nx * mx + ny * my) / (Math.hypot(mx, my) || 1); // -1..1, how far n points away from the centre
  if (outward * edgeElement.bendSign < -BEND_FLIP_THRESHOLD) edgeElement.bendSign *= -1;
  // A quadratic curve's apex sits halfway to its control point, hence the 2
  const offset = 2 * curve * len * edgeElement.bendSign;
  return `M ${s.x} ${s.y} Q ${mx + nx * offset} ${my + ny * offset} ${t.x} ${t.y}`;
}

// --- Edge colour and thickness by strain ---
// Compressed -> cyan, at rest -> slate, stretched -> coral, using the --edge-*
// colours from the theme (as #rrggbb hex). Thicker the more strained.
function cssColor(name) {
  const hex = getComputedStyle(document.documentElement).getPropertyValue(name).trim().slice(1);
  return [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));
}
const COMPRESSED_COLOR = cssColor('--edge-compressed');
const REST_COLOR       = cssColor('--edge-rest');
const STRETCHED_COLOR  = cssColor('--edge-stretched');

const REST_WIDTH = 1;
const MAX_WIDTH  = 3;
const STRAIN_REFERENCE_STRENGTH = 0.05; // link strength at which strain isn't scaled up or down

function mixColor(a, b, t) {
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(', ')})`;
}

// Relative change in length, clamped to [-1, 1] (-1 = fully collapsed, 1 = stretched
// to double the rest length), scaled by how stiff the edge is
function edgeStrain(edge) {
  const restLength = edge.length * settings.linkLength;
  const stiffness = edge.strength * settings.linkStrength / STRAIN_REFERENCE_STRENGTH;
  const dist = Math.hypot(edge.target.x - edge.source.x, edge.target.y - edge.source.y);
  return stiffness * clamp((dist - restLength) / restLength, -1, 1);
}

function strainColor(strain) {
  return strain < 0
    ? mixColor(REST_COLOR, COMPRESSED_COLOR, -strain)
    : mixColor(REST_COLOR, STRETCHED_COLOR, strain);
}

// --- Position everything according to current node.x / node.y ---
function render() {
  for (const edgeElement of edgeElements) {
    const { edge, el } = edgeElement;
    const strain = edgeStrain(edge);
    el.setAttribute('d', edgePath(edgeElement));
    el.style.stroke = el.style.color = strainColor(strain); // color feeds currentColor in the highlight glow
    el.style.strokeWidth = REST_WIDTH + (MAX_WIDTH - REST_WIDTH) * Math.abs(strain);
  }
  for (const { node, g } of nodeElements) {
    g.setAttribute('transform', `translate(${node.x}, ${node.y})`);
  }
}

// --- Edge highlight: the edges of one node get the `highlight` class ---
const edgeElementsByNode = new Map(nodes.map(n => [n, []]));
for (const edgeElement of edgeElements) {
  edgeElementsByNode.get(edgeElement.edge.source).push(edgeElement);
  edgeElementsByNode.get(edgeElement.edge.target).push(edgeElement);
}

let highlightedNode = null;

// Highlight the edges of `node`, or none if it's null
function highlightEdgesOf(node) {
  if (node === highlightedNode) return;
  if (highlightedNode) edgeElementsByNode.get(highlightedNode).forEach(({ el }) => el.classList.remove('highlight'));
  if (node) edgeElementsByNode.get(node).forEach(({ el }) => el.classList.add('highlight'));
  highlightedNode = node;
}
