// Graph data from data/nodes.js and data/edges.js, with defaults filled in.
// Field meanings are documented at the top of those files.

const nodes = NODES.map(({ id, name, link, style, size = 1, centering = 0 }) =>
  ({ id, name, link, style, size, centering, x: 0, y: 0, vx: 0, vy: 0, fixed: false }));

const nodeById = Object.fromEntries(nodes.map(n => [n.id, n]));

// Skip edges that reference a missing id instead of crashing the render loop
const edges = EDGES
  .filter(edge => {
    const ok = edge.source in nodeById && edge.target in nodeById;
    if (!ok) console.warn('Skipping edge with unknown node id:', edge);
    return ok;
  })
  .map(({ source, target, length = 1, strength = 1, style, behind = false, curve = 0 }) =>
    ({ source: nodeById[source], target: nodeById[target], length, strength, style, behind, curve }));

// Scatter nodes randomly across a width x height area around the origin and stop
// them moving; the simulation then pulls them back into shape.
function randomizePositions(width, height) {
  for (const node of nodes) {
    node.x = (Math.random() - 0.5) * width;
    node.y = (Math.random() - 0.5) * height;
    node.vx = 0;
    node.vy = 0;
  }
}
