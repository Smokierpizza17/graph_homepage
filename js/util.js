// Small helpers shared by the other scripts.

const SVG_NS = 'http://www.w3.org/2000/svg';

// Create an SVG element with the given attributes and classes
function svgElement(tag, attrs = {}, ...classes) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  el.classList.add(...classes.filter(Boolean));
  return el;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

// Standard normal sample (mean 0, std 1)
function randn() {
  const u = 1 - Math.random(); // (0, 1], avoids log(0)
  const v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// --- Telling a click from a drag ---
const DRAG_THRESHOLD = 4; // pixels of movement before a press becomes a drag

// Whether the pointer has moved past DRAG_THRESHOLD since `start` ({ x, y } in client pixels)
function movedPastThreshold(start, evt) {
  return Math.hypot(evt.clientX - start.x, evt.clientY - start.y) >= DRAG_THRESHOLD;
}
