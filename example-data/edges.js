// Edges of the graph: each entry connects two node ids from nodes.js.
//   source, target - node ids
//   length   - optional; multiplies the default rest length
//   strength - optional; multiplies the spring force (0 = purely decorative)
//   style    - optional; adds the CSS class `edge-<style>` (see customstyles.css)
//   behind   - optional; draws the edge underneath all other edges
//   curve    - optional; bends the edge outward, away from the centre
//              (0 = straight, 0.2 = bulges by a fifth of its length)

const EDGES = [
  { source: 'index', target: 'socials', length: 1.5 },
  { source: 'index', target: 'projects', length: 1.5 },

  { source: 'socials', target: 'github' },
  { source: 'socials', target: 'mastodon' },

  { source: 'projects', target: 'project_a' },
  { source: 'projects', target: 'project_b' },

  { source: 'github', target: 'project_a', length: 3, strength: 0.7 },
];
