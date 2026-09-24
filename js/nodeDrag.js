// Dragging nodes, and highlighting the edges of the hovered or dragged node.
// Hover styling is plain CSS (:hover); dragging needs manual pointer tracking since
// SVG has no native drag API. Pointer events cover mouse, touch and pen alike.

const drag = {
  node: null,       // node being dragged
  circle: null,     // ...and its circle
  pointerId: null,  // which pointer (finger/mouse) is dragging, so a second finger is ignored
  start: null,      // pointer position at pointerdown, in client pixels
  moved: false,     // true once the pointer moved far enough to count as a drag
};
let hoveredNode = null;

// The dragged node wins, so the highlight stays put while the pointer lags behind it
function updateEdgeHighlight() {
  highlightEdgesOf(drag.node || hoveredNode);
}

for (const { node, g, circle } of nodeElements) {
  circle.addEventListener('pointerdown', (evt) => {
    if (evt.button !== 0) return; // leave middle-click etc. to the browser
    if (drag.node) return;        // already dragging with another finger
    evt.preventDefault();
    Object.assign(drag, { node, circle, pointerId: evt.pointerId, start: { x: evt.clientX, y: evt.clientY }, moved: false });
    node.fixed = true;
    circle.classList.add('dragging');
    updateEdgeHighlight();
  });

  // Mouse and pen only: on touchscreens the drag highlight covers it
  circle.addEventListener('pointerenter', (evt) => {
    if (evt.pointerType === 'touch') return;
    hoveredNode = node;
    updateEdgeHighlight();
  });
  circle.addEventListener('pointerleave', () => {
    if (hoveredNode !== node) return;
    hoveredNode = null;
    updateEdgeHighlight();
  });

  // Stop the browser's native link drag
  g.addEventListener('dragstart', (evt) => evt.preventDefault());

  // A press that turned into a drag shouldn't also follow the link
  g.addEventListener('click', (evt) => {
    if (drag.moved) evt.preventDefault();
  });
}

window.addEventListener('pointermove', (evt) => {
  if (!drag.node || evt.pointerId !== drag.pointerId) return;
  if (!drag.moved) {
    if (!movedPastThreshold(drag.start, evt)) return;
    drag.moved = true;
  }
  const { x, y } = graphPoint(screenPoint(evt));
  drag.node.x = x;
  drag.node.y = y;
  render();
});

function endDrag(evt) {
  if (!drag.node || evt.pointerId !== drag.pointerId) return;
  drag.node.fixed = false;
  drag.circle.classList.remove('dragging');
  drag.node = drag.circle = drag.pointerId = null; // drag.moved stays set for the click that follows
  updateEdgeHighlight();
}
window.addEventListener('pointerup', endDrag);
window.addEventListener('pointercancel', endDrag); // e.g. the browser took over the touch
