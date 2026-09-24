# Graph Homepage

A personal homepage drawn as a live, force-directed graph of links. Nodes float in a slowly turning star field; click one to open its link, drag it around, and pan and zoom the whole graph.

It's plain HTML, CSS and JavaScript with no build step and no dependencies.

## Getting started

1. Create your own data folder by copying the example:

   ```sh
   cp -r example-data data
   ```

   `data/` is gitignored, so your personal links stay out of the repository.

2. Open `index.html` in a browser. It works straight from the file system (`file://`), from any static web server, or as your browser's homepage / new tab page.

3. Edit the three files in `data/` to make the graph your own (see below).

## Your graph: the `data/` folder

| File | What it holds |
| --- | --- |
| `data/nodes.js` | The nodes: names, links, styles and sizes |
| `data/edges.js` | The connections between nodes |
| `data/customstyles.css` | Colours and looks for node and edge styles |

After editing, reload the page.

### Nodes (`data/nodes.js`)

```js
const NODES = [
  { id: 'index', name: 'Index', style: 'index', size: 1.5, centering: 1 },
  { id: 'socials', name: 'Socials', style: 'first' },
  { id: 'github', name: 'GitHub', link: 'https://github.com/', style: 'second' },
];
```

| Field | Required | Default | Description |
| --- | --- | --- | --- |
| `id` | yes | | A unique key that edges use to refer to the node. |
| `name` | yes | | The label shown above the node. |
| `link` | no | none | The URL opened when the node is clicked. Leave it out for nodes that only organise others. They can still be dragged. |
| `style` | no | none | Adds the CSS class `style-<style>` to the node, so you can colour it in `customstyles.css`. |
| `size` | no | `1` | Scales the node's circle and label. It also acts as the node's mass: bigger nodes are heavier and respond more slowly to forces. |
| `centering` | no | `0` | How strongly this node is pulled towards the centre of the screen. Give it to one root node, such as `1` on `index`, to keep the graph in view. Give one node in each disconnected group some `centering` so that group doesn't drift away. |

### Edges (`data/edges.js`)

```js
const EDGES = [
  { source: 'index', target: 'socials', length: 1.5 },
  { source: 'socials', target: 'github' },
  { source: 'github', target: 'project_a', length: 3, strength: 0.7 },
];
```

| Field | Required | Default | Description |
| --- | --- | --- | --- |
| `source`, `target` | yes | | The `id`s of the two nodes to connect. An edge with an unknown id is skipped, and a warning is logged to the browser console. |
| `length` | no | `1` | Multiplies the edge's rest length (the *Link length* setting). |
| `strength` | no | `1` | Multiplies the spring force. `0` makes the edge purely decorative: it's drawn but doesn't pull. |
| `style` | no | none | Adds the CSS class `edge-<style>` to the edge. |
| `behind` | no | `false` | Draws the edge underneath all other edges. |
| `curve` | no | `0` | Bends the edge outward, away from the centre. `0` is straight; `0.2` bulges by a fifth of its length. |

Edges are colour-coded by strain: cyan when compressed, slate at rest and coral when stretched. They also get thicker the further they are from their rest length. Hovering over or dragging a node highlights its edges.

Since the data files are plain JavaScript, you can share options between edges:

```js
// Dashed, curved crosslinks that don't pull on the layout
const CROSS = { length: 3, strength: 0, style: 'cross', behind: true, curve: 0.1 };

const EDGES = [
  // ...
  { source: 'gh_myProject', target: 'myProject', ...CROSS },
];
```

### Styles (`data/customstyles.css`)

A node with `style: 'foo'` gets the class `style-foo` on its group. Set `--node-color` to colour the circle and its glow, and target `.style-foo .label` for the label:

```css
.style-index        { --node-color: var(--color-sun); }
.style-index .label { font-weight: 700; }
.style-first        { --node-color: var(--color-violet); }
```

These are the palette colours, defined in `css/theme.css`:

| Variable | Colour |
| --- | --- |
| `--color-sun` | `#f6b94a` |
| `--color-violet` | `#9d8cf5` |
| `--color-cyan` | `#5ccfe6` (the default for nodes without a style) |
| `--color-green` | `#a8e08a` |
| `--color-silver` | `#cfd5e0` |

Any other CSS colour works too, e.g. `--node-color: hotpink;`.

An edge with `style: 'foo'` gets the class `edge-foo`. Its stroke colour and width come from the strain colouring and can't be changed, but opacity, dashes and animation can:

```css
.edge-cross { stroke-dasharray: 3 6; opacity: 0.6; animation: edge-flow 0.9s linear infinite; }

/* Dashes flow from source to target; use +9 to flow the other way */
@keyframes edge-flow { to { stroke-dashoffset: -9; } }

@media (prefers-reduced-motion: reduce) {
  .edge-cross { animation: none; }
}
```

## Controls

| Action | Mouse / trackpad | Touch |
| --- | --- | --- |
| Open a node's link | Click the node | Tap the node |
| Move a node | Drag the node | Drag the node |
| Pan | Drag the background, or middle-drag anywhere | Drag the background with one finger |
| Zoom | Scroll wheel or trackpad pinch | Two-finger pinch |
| Reset the view | Double-click, <kbd>Space</kbd> or <kbd>H</kbd> | Double-tap |

A node that you drag doesn't also open its link.

## Simulation settings

The **Settings** panel in the top-right corner has a slider for each setting. **Reset!** restores the defaults and **Random!** scatters the nodes so the graph settles again from scratch. Slider changes last until the page is reloaded.

| Setting | Default | Range | Effect |
| --- | --- | --- | --- |
| Centering | `0.05` | 0.005 – 0.2 | The pull towards the centre on nodes with a `centering` value. |
| Rotation | `0.0005` | −0.01 – 0.01 | How fast the graph and stars turn. Negative values turn it the other way; `0` stops it. |
| Repulsion | `7000` | 0 – 50000 | How strongly nodes push each other apart. |
| Link strength | `0.05` | 0.002 – 0.3 | The stiffness of the edges. |
| Link length | `130` | 10 – 400 | The rest length of an edge, in pixels. Each edge's `length` multiplies it. |
| Damping | `0.25` | 0.01 – 1 | Friction. Higher values settle faster; lower values bounce and wobble more. |
| Speed | `50` | 1 – 100 | How fast the simulation runs. |
| Temperature | `0` | 0 – 20 | Random jiggle. Above `0`, nodes never quite stop moving. |

To change the defaults or ranges permanently, edit `settingsConfig` in `js/settings.js`.

## Changing the look further

- **Colours:** every colour on the page is a variable in `css/theme.css`, including the background gradient, stars, labels, the edge strain colours (`--edge-rest`, `--edge-compressed`, `--edge-stretched`) and the settings panel.
- **Stars:** the number and parallax of the background stars are constants at the top of `js/stars.js`.
- **Node size and label position:** `NODE_RADIUS` and `LABEL_OFFSET` at the top of `js/render.js`.
- **Node glow:** `NODE_GLOW` in `js/render.js`. The default, `'gradient'`, is cheap to draw; `'filter'` uses a CSS `drop-shadow` instead, which costs more because every moving node's blur is redone each frame.
- **Zoom limits:** `MIN_ZOOM` and `MAX_ZOOM` in `js/view.js`.

## Project layout

```
index.html            page skeleton; loads everything in order
data/                 your graph (gitignored; copied from example-data/)
example-data/         a small example graph to start from
css/
  theme.css           palette and page background
  graph.css           nodes, edges, labels and stars
  panel.css           settings panel
js/
  util.js             shared helpers
  settings.js         simulation settings and their defaults
  graph.js            reads the data files and fills in defaults
  physics.js          force simulation
  view.js             camera: pan, zoom and coordinates
  stars.js            background star field
  render.js           SVG elements, drawing and edge colouring
  nodeDrag.js         dragging and hovering over nodes
  viewControls.js     mouse, touch and keyboard input for the camera
  panel.js            settings panel UI
  main.js             starts the animation loop
```

The scripts are plain `<script>` tags rather than ES modules, so that the page also works from `file://`. They share one global scope, and each script uses only what the scripts before it define. Keep that order in `index.html` when adding a new file.

A large chunk of the code was primarily written by Claude Code.