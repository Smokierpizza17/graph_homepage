// The camera: pan and zoom, applied as a translate + scale on the #viewport group.
// The input handlers that drive it are in viewControls.js.

const svg = document.getElementById('graph');
const viewportGroup = document.getElementById('viewport');

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 5;
const WHEEL_ZOOM_SMOOTHING = 80;  // ms time constant for easing towards a wheel zoom target
const RESET_DURATION = 300;       // ms for the reset animation

const view = { x: 0, y: 0, k: 1 }; // pan offset in screen pixels, zoom factor

// Centre the coordinate system: (0, 0) is the middle of the screen.
// The viewBox matches the element's pixel size, so 1 unit = 1 pixel.
function updateViewBox() {
  const w = svg.clientWidth;
  const h = svg.clientHeight;
  svg.setAttribute('viewBox', `${-w / 2} ${-h / 2} ${w} ${h}`);
}
updateViewBox();
window.addEventListener('resize', updateViewBox);

function clampZoom(k) {
  return clamp(k, MIN_ZOOM, MAX_ZOOM);
}

function applyView() {
  viewportGroup.setAttribute('transform', `translate(${view.x}, ${view.y}) scale(${view.k})`);
}

// Pointer position relative to the centre of the SVG, i.e. in the viewBox's units
function screenPoint(evt) {
  const rect = svg.getBoundingClientRect();
  return { x: evt.clientX - rect.left - rect.width / 2, y: evt.clientY - rect.top - rect.height / 2 };
}

// Screen point -> graph point under it
function graphPoint(s) {
  return { x: (s.x - view.x) / view.k, y: (s.y - view.y) / view.k };
}

// Set the zoom to k while keeping graph point g under screen point s
function zoomAround(k, s, g) {
  view.k = k;
  view.x = s.x - g.x * k;
  view.y = s.y - g.y * k;
  applyView();
}

// --- Animations: at most one runs at a time ---
let viewAnimation = null; // requestAnimationFrame id
let zoomTarget = null;    // { k, s } while easing a wheel zoom: zoom to reach, screen point to keep fixed

// Stop any reset or wheel-zoom easing, e.g. because the user grabbed the view
function stopViewAnimation() {
  if (viewAnimation !== null) cancelAnimationFrame(viewAnimation);
  viewAnimation = null;
  zoomTarget = null;
}

function isResetting() {
  return viewAnimation !== null && zoomTarget === null;
}

// Ease back to no pan, zoom 1
function resetView() {
  stopViewAnimation();
  const from = { ...view };
  const start = performance.now();
  function frame(now) {
    // Clamped at 0 too: a frame's timestamp can be slightly earlier than performance.now()
    const t = clamp((now - start) / RESET_DURATION, 0, 1);
    const ease = 1 - (1 - t) ** 3; // ease-out cubic
    view.x = from.x * (1 - ease);
    view.y = from.y * (1 - ease);
    view.k = from.k + (1 - from.k) * ease;
    applyView();
    viewAnimation = t < 1 ? requestAnimationFrame(frame) : null;
  }
  viewAnimation = requestAnimationFrame(frame);
}

// Move the wheel-zoom target by `factor`, around screen point s. The view eases towards
// the target every frame, so mouse wheel notches don't jump.
function zoomTowards(factor, s) {
  if (isResetting()) stopViewAnimation();
  const fromK = zoomTarget ? zoomTarget.k : view.k;
  const easing = zoomTarget !== null;
  zoomTarget = { k: clampZoom(fromK * factor), s };
  if (easing) return;

  let lastFrame = performance.now();
  function frame(now) {
    const dt = clamp(now - lastFrame, 0, 50);
    lastFrame = Math.max(lastFrame, now);
    const { k: targetK, s } = zoomTarget;
    // Ease in log space so zooming in and out feel the same
    const ease = 1 - Math.exp(-dt / WHEEL_ZOOM_SMOOTHING);
    const done = Math.abs(Math.log(targetK / view.k)) < 0.001;
    zoomAround(done ? targetK : view.k * (targetK / view.k) ** ease, s, graphPoint(s));
    if (done) {
      viewAnimation = null;
      zoomTarget = null;
    } else {
      viewAnimation = requestAnimationFrame(frame);
    }
  }
  viewAnimation = requestAnimationFrame(frame);
}
