// Edges of the graph: each entry connects two node ids from nodes.js.
// optional length property multiplies with default length.

const EDGES = [
  { source: 'index', target: 'socials', length: 1.5 },
  { source: 'index', target: 'projects', length: 1.5  },

  { source: 'socials', target: 'github' },
  { source: 'socials', target: 'mastodon' },

  { source: 'projects', target: 'project_a' },
  { source: 'projects', target: 'project_b' },
];
