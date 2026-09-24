// Input for the camera in view.js. Pan with a left drag on the background, a middle
// drag anywhere, or one finger on the background; zoom with the wheel (or trackpad
// pinch) or a two-finger pinch. Double click / double tap, Space or H reset the view.

const WHEEL_ZOOM_SPEED = 0.0015;  // zoom factor per wheel pixel
const PINCH_WHEEL_BOOST = 5;      // trackpad pinch sends small deltas; scale them up
const DOUBLE_TAP_TIME = 300;      // ms between taps to count as a double tap
const DOUBLE_TAP_DISTANCE = 30;   // px the second tap may land from the first

// --- Pan and pinch ---
// Pointers currently panning, by pointerId -> latest screen point.
// With one pointer the graph point under it stays under it; with two or more the
// graph point under their centroid does, and their spread sets the zoom.
const pan = {
  pointers: new Map(),
  anchor: null,     // graph point pinned under the centroid
  baseSpread: 0,    // pointer spread when the anchor was set
  baseZoom: 1,      // zoom when the anchor was set
  start: null,      // first pointer's start, to tell a pan from a click
  moved: false,
};

function panCentroid() {
  let x = 0, y = 0;
  for (const p of pan.pointers.values()) { x += p.x; y += p.y; }
  return { x: x / pan.pointers.size, y: y / pan.pointers.size };
}

function panSpread(c) {
  let sum = 0;
  for (const p of pan.pointers.values()) sum += Math.hypot(p.x - c.x, p.y - c.y);
  return sum / pan.pointers.size;
}

// Re-pin whenever a finger is added or lifted, so the view doesn't jump
function resetPanAnchor() {
  if (pan.pointers.size === 0) { pan.anchor = null; return; }
  const c = panCentroid();
  pan.anchor = graphPoint(c);
  pan.baseSpread = panSpread(c);
  pan.baseZoom = view.k;
}

svg.addEventListener('pointerdown', (evt) => {
  const onNode = evt.target.classList.contains('node');
  const isMiddle = evt.pointerType === 'mouse' && evt.button === 1;
  if (!isMiddle && (evt.button !== 0 || onNode)) return; // left presses on nodes are node drags
  evt.preventDefault(); // no middle-click autoscroll, no text selection
  stopViewAnimation();
  if (pan.pointers.size === 0) {
    pan.start = { x: evt.clientX, y: evt.clientY };
    pan.moved = false;
  }
  pan.pointers.set(evt.pointerId, screenPoint(evt));
  resetPanAnchor();
  svg.classList.add('panning');
});

window.addEventListener('pointermove', (evt) => {
  if (!pan.pointers.has(evt.pointerId)) return;
  if (!pan.moved) {
    if (!movedPastThreshold(pan.start, evt)) return;
    pan.moved = true;
  }
  pan.pointers.set(evt.pointerId, screenPoint(evt));
  const c = panCentroid();
  const k = pan.pointers.size > 1 && pan.baseSpread > 0
    ? clampZoom(pan.baseZoom * panSpread(c) / pan.baseSpread)
    : view.k;
  zoomAround(k, c, pan.anchor);
});

function endPan(evt) {
  if (!pan.pointers.delete(evt.pointerId)) return;
  resetPanAnchor();
  if (pan.pointers.size === 0) svg.classList.remove('panning');
}
window.addEventListener('pointerup', endPan);
window.addEventListener('pointercancel', endPan);

// A middle-drag that started on a link shouldn't also open it in a new tab
svg.addEventListener('auxclick', (evt) => {
  if (pan.moved) evt.preventDefault();
});

// --- Wheel zoom, around the cursor. Trackpad pinch arrives as a wheel event with ctrlKey ---
svg.addEventListener('wheel', (evt) => {
  evt.preventDefault();
  const pixels = evt.deltaMode === 1 ? evt.deltaY * 16 : evt.deltaY; // lines -> pixels
  const speed = WHEEL_ZOOM_SPEED * (evt.ctrlKey ? PINCH_WHEEL_BOOST : 1);
  zoomTowards(Math.exp(-pixels * speed), screenPoint(evt));
}, { passive: false });

// --- Double click / double tap anywhere resets the view ---
// Detected by hand rather than with dblclick, which mobile browsers don't fire reliably.
let tapStart = null;
let lastTap = null; // { time, x, y } of the previous tap

svg.addEventListener('pointerdown', (evt) => {
  if (evt.isPrimary && evt.button === 0) tapStart = { x: evt.clientX, y: evt.clientY };
});

window.addEventListener('pointerup', (evt) => {
  if (!evt.isPrimary || !tapStart) return;
  const moved = movedPastThreshold(tapStart, evt);
  tapStart = null;
  if (moved) { lastTap = null; return; }
  const now = performance.now();
  if (lastTap && now - lastTap.time < DOUBLE_TAP_TIME &&
      Math.hypot(evt.clientX - lastTap.x, evt.clientY - lastTap.y) < DOUBLE_TAP_DISTANCE) {
    resetView();
    lastTap = null;
  } else {
    lastTap = { time: now, x: evt.clientX, y: evt.clientY };
  }
});

// --- Space or H resets the view ---
window.addEventListener('keydown', (evt) => {
  if (evt.ctrlKey || evt.metaKey || evt.altKey) return;
  if (evt.key === ' ' || evt.key === 'h' || evt.key === 'H') {
    evt.preventDefault();
    resetView();
  }
});
