// Background stars: faint dots that turn slowly with the rotation setting.
// They follow pan and zoom at a fraction of the graph's movement (parallax), so they
// feel far away. The stars are drawn once into a square tile; every frame that tile is
// painted as a repeating pattern onto a <canvas> behind the SVG. Keeping them out of
// the SVG means turning them doesn't force the whole graph to be repainted.

const STAR_COUNT = 230;              // stars per tile
const STAR_ROTATION_PARALLAX = 0.2;  // stars turn at this fraction of the graph's rotation
const STAR_PAN_PARALLAX = 0.2;       // ...move at this fraction of the pan
const STAR_ZOOM_PARALLAX = 0.3;      // ...and zoom by the graph's zoom to this power

// One screen diagonal per tile, so the repeat isn't noticeable
const STAR_TILE = Math.hypot(screen.width, screen.height);

const starCanvas = document.getElementById('stars');
const starContext = starCanvas.getContext('2d');
let starAngle = 0;       // radians
let starPattern = null;  // the tile as a repeating canvas pattern
let starTileScale = 0;   // device pixels per CSS pixel the tile was drawn at
let starPatternScale = 1;
let lastStarDraw = '';   // what was drawn last frame, to skip redrawing when nothing moved

// Positions in [0, STAR_TILE), radii in CSS pixels
const stars = Array.from({ length: STAR_COUNT }, () => ({
  x: Math.random() * STAR_TILE,
  y: Math.random() * STAR_TILE,
  r: 0.4 + Math.random(),
  opacity: 0.2 + Math.random() * 0.3,
}));

// Draw the tile at the screen's pixel density. Stars near an edge are drawn on the
// opposite edge too, so the tiles join seamlessly.
function buildStarTile(scale) {
  const tile = document.createElement('canvas');
  tile.width = tile.height = Math.round(STAR_TILE * scale);
  const ctx = tile.getContext('2d');
  ctx.scale(tile.width / STAR_TILE, tile.height / STAR_TILE);
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--star').trim();
  for (const { x, y, r, opacity } of stars) {
    ctx.globalAlpha = opacity;
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        ctx.beginPath();
        ctx.arc(x + i * STAR_TILE, y + j * STAR_TILE, r, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
  }
  starPattern = starContext.createPattern(tile, 'repeat');
  starTileScale = scale;
  starPatternScale = STAR_TILE / tile.width; // tile pixels -> CSS pixels, exact despite the rounding
}

// Match the canvas to its on-screen size in device pixels; redraw the tile if the
// pixel density changed (browser zoom, or the window moved to another screen)
function resizeStarCanvas() {
  const scale = devicePixelRatio;
  starCanvas.width = Math.round(starCanvas.clientWidth * scale);
  starCanvas.height = Math.round(starCanvas.clientHeight * scale);
  if (scale !== starTileScale) buildStarTile(scale);
  lastStarDraw = ''; // resizing cleared the canvas
}
resizeStarCanvas();
window.addEventListener('resize', resizeStarCanvas);

// Wrap v into [-STAR_TILE / 2, STAR_TILE / 2), keeping the pattern offset small
function wrapToTile(v) {
  return ((v + STAR_TILE / 2) % STAR_TILE + STAR_TILE) % STAR_TILE - STAR_TILE / 2;
}

// Turn the stars on by dt and draw them for the current pan and zoom
function updateStars(dt) {
  starAngle += settings.rotation * STAR_ROTATION_PARALLAX * dt;
  const k = view.k ** STAR_ZOOM_PARALLAX;
  // The screen shift we want, turned back into the rotated, scaled star space
  const dx = view.x * STAR_PAN_PARALLAX / k;
  const dy = view.y * STAR_PAN_PARALLAX / k;
  const cos = Math.cos(starAngle);
  const sin = Math.sin(starAngle);
  const tx = wrapToTile( cos * dx + sin * dy);
  const ty = wrapToTile(-sin * dx + cos * dy);

  const state = `${starAngle} ${k} ${tx} ${ty}`;
  if (state === lastStarDraw) return;
  lastStarDraw = state;

  const { width, height } = starCanvas;
  const scale = width / starCanvas.clientWidth || 1;
  starContext.setTransform(1, 0, 0, 1, 0, 0);
  starContext.clearRect(0, 0, width, height);
  // Origin at the centre of the screen, like the graph's viewBox
  starContext.setTransform(scale, 0, 0, scale, width / 2, height / 2);
  starContext.rotate(starAngle);
  starContext.scale(k, k);
  starPattern.setTransform(new DOMMatrix().translateSelf(tx, ty).scaleSelf(starPatternScale));
  starContext.fillStyle = starPattern;
  const reach = Math.hypot(width, height) / 2 / scale / k; // centre to screen corner, in star space
  starContext.fillRect(-reach, -reach, 2 * reach, 2 * reach);
}
