// Edges of the graph: each entry connects two node ids from nodes.js.
const EDGES = [
  { source: 'index', target: 'socials' },
  { source: 'index', target: 'projects' },

  { source: 'socials', target: 'github' },
  { source: 'socials', target: 'mastodon' },

  { source: 'projects', target: 'project_a' },
  { source: 'projects', target: 'project_b' },
];
