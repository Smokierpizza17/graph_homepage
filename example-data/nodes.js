// Nodes of the graph.
//   id    - unique key, referenced by edges.js
//   name  - label shown above the node
//   link  - optional; URL opened when the node is clicked. Omit for purely organisational nodes
//   style - optional; adds the CSS class `style-<style>` to the node (see customstyles.css)
const NODES = [
  { id: 'index', name: 'Index', style: 'index' },
  { id: 'socials', name: 'Socials', style: 'first' },

  { id: 'github', name: 'GitHub', link: 'https://github.com/', style: 'second' },
  { id: 'mastodon', name: 'Mastodon', link: 'https://joinmastodon.org/', style: 'second' },

  { id: 'projects', name: 'Projects', style: 'first' },
  { id: 'project_a', name: 'Project A', link: 'https://example.com/', style: 'second' },
  { id: 'project_b', name: 'Project B', link: 'https://example.org/', style: 'second' },
];
