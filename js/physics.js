// Force simulation. Forces change velocities; step() then moves the nodes.
// Heavier (bigger) nodes accelerate less: every force is divided by node.size.

const MAX_STEP = 1000; // largest distance a node may move in one frame

function push(node, fx, fy, dt) {
  node.vx += fx * dt / node.size;
  node.vy += fy * dt / node.size;
}

// Unit vector from b to a and the distance between them
function separation(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dist = Math.sqrt(dx * dx + dy * dy || 0.01); // avoid divide-by-zero when overlapping
  return { ux: dx / dist, uy: dy / dist, dist };
}

function applyForces(dt) {
  for (const node of nodes) {
    // drag toward a gently rotating fluid (F ~ v_fluid - v)
    const fluidVx = -settings.rotation * node.y;
    const fluidVy =  settings.rotation * node.x;
    push(node, -settings.damping * (node.vx - fluidVx), -settings.damping * (node.vy - fluidVy), dt);

    // temperature (Langevin thermostat)
    const kick = Math.sqrt(2 * settings.damping * settings.temperature * dt / node.size);
    node.vx += kick * randn();
    node.vy += kick * randn();

    // centering force (F ~ r)
    const pull = -node.centering * settings.centering;
    push(node, pull * node.x, pull * node.y, dt);

    // node-node repulsion (F ~ 1/r^2)
    for (const other of nodes) {
      if (other === node) continue;
      const { ux, uy, dist } = separation(node, other);
      const force = settings.repulsion / (dist * dist);
      push(node, force * ux, force * uy, dt);
    }
  }

  // edge elasticity (F ~ r - rest length)
  for (const edge of edges) {
    const { ux, uy, dist } = separation(edge.source, edge.target);
    const force = -settings.linkStrength * edge.strength * (dist - settings.linkLength * edge.length);
    push(edge.source,  force * ux,  force * uy, dt);
    push(edge.target, -force * ux, -force * uy, dt);
  }
}

// Advance the simulation by dt. Fixed nodes (e.g. the one being dragged) stay put.
function step(dt) {
  applyForces(dt);
  for (const node of nodes) {
    if (node.fixed) {
      node.vx = 0;
      node.vy = 0;
      continue;
    }
    node.x += clamp(node.vx * dt, -MAX_STEP, MAX_STEP);
    node.y += clamp(node.vy * dt, -MAX_STEP, MAX_STEP);
  }
}
