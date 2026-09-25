// Dragging nodes, and highlighting the edges of the hovered or dragged node.
// Hover styling is plain CSS (:hover); dragging needs manual pointer tracking since
// SVG has no native drag API. Pointer events cover mouse, touch and pen alike.

// A touch held still this long on a linked node counts as a long press: it reveals
// the link hint (see graph.css's `peek` rules) instead of navigating, so touch gets
// the same "check before you click" that :hover gives a mouse.
const PEEK_HOLD_TIME = 350; // ms

const drag = {
  node: null,       // node being dragged
  g: null,          // ...and its <a> group, so a peek's `peek` class can be removed again
  circle: null,     // ...and its circle
  pointerId: null,  // which pointer (finger/mouse) is dragging, so a second finger is ignored
  start: null,      // pointer position at pointerdown, in client pixels
  moved: false,     // true once the pointer moved far enough to count as a drag
  peekTimer: null,  // setTimeout id for the long-press peek, while it's still pending
  peeked: false,    // true once the peek has shown; the following click shouldn't navigate
};
let hoveredNode = null;

// The dragged node wins, so the highlight stays put while the pointer lags behind it
function updateEdgeHighlight() {
  highlightEdgesOf(drag.node || hoveredNode);
}

for (const { node, g, circle, hint } of nodeElements) {
  circle.addEventListener('pointerdown', (evt) => {
    if (evt.button !== 0) return; // leave middle-click etc. to the browser
    if (drag.node) return;        // already dragging with another finger
    evt.preventDefault();
    Object.assign(drag, {
      node, g, circle, pointerId: evt.pointerId, start: { x: evt.clientX, y: evt.clientY },
      moved: false, peekTimer: null, peeked: false,
    });
    node.fixed = true;
    circle.classList.add('dragging');
    updateEdgeHighlight();

    // Touch only: mouse/pen already get the hint on hover. If this press is still
    // sitting still (not a drag) once the hold time passes, peek instead of nothing.
    if (node.link && evt.pointerType === 'touch') {
      drag.peekTimer = setTimeout(() => {
        drag.peekTimer = null;
        drag.peeked = true;
        g.classList.add('peek');
        scrambleHint(hint);
      }, PEEK_HOLD_TIME);
    }
  });

  // Mouse and pen only: on touchscreens the drag highlight covers it.
  // Also skip this while any node is being dragged: the dragged circle trails
  // one pointermove behind the cursor (it only catches up once render() runs),
  // so a fast drag can outrun its own radius and fire spurious enter/leave
  // pairs here, each of which would restart the hint's scramble-in animation.
  circle.addEventListener('pointerenter', (evt) => {
    if (evt.pointerType === 'touch') return;
    if (drag.node) return;
    hoveredNode = node;
    updateEdgeHighlight();
    scrambleHint(hint);
  });
  circle.addEventListener('pointerleave', () => {
    if (hoveredNode !== node) return;
    hoveredNode = null;
    updateEdgeHighlight();
  });

  // Stop the browser's native link drag
  g.addEventListener('dragstart', (evt) => evt.preventDefault());

  // A press that turned into a drag, or already showed its peek, shouldn't also follow the link
  g.addEventListener('click', (evt) => {
    if (drag.moved || drag.peeked) evt.preventDefault();
  });
}

window.addEventListener('pointermove', (evt) => {
  if (!drag.node || evt.pointerId !== drag.pointerId) return;
  if (!drag.moved) {
    if (!movedPastThreshold(drag.start, evt)) return;
    drag.moved = true;
    // This is a drag, not a still press - cancel the pending peek, if any
    if (drag.peekTimer !== null) {
      clearTimeout(drag.peekTimer);
      drag.peekTimer = null;
    }
  }
  const { x, y } = graphPoint(screenPoint(evt));
  drag.node.x = x;
  drag.node.y = y;
  render();
});

function endDrag(evt) {
  if (!drag.node || evt.pointerId !== drag.pointerId) return;
  if (drag.peekTimer !== null) clearTimeout(drag.peekTimer);
  drag.g.classList.remove('peek'); // hide the hint again once the finger lifts
  drag.node.fixed = false;
  drag.circle.classList.remove('dragging');
  drag.node = drag.g = drag.circle = drag.pointerId = drag.peekTimer = null; // drag.moved/peeked stay set for the click that follows
  updateEdgeHighlight();
}
window.addEventListener('pointerup', endDrag);
window.addEventListener('pointercancel', endDrag); // e.g. the browser took over the touch
