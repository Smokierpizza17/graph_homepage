// Background stars: faint dots that turn slowly with the rotation setting.
// They follow pan and zoom at a fraction of the graph's movement (parallax), so they
// feel far away. The stars fill one square tile, repeated 3x3; panning shifts the
// tiles by the offset modulo the tile size, so the field never runs out.

const STAR_COUNT = 230;              // stars per tile
const STAR_ROTATION_PARALLAX = 0.2;  // stars turn at this fraction of the graph's rotation
const STAR_PAN_PARALLAX = 0.2;       // ...move at this fraction of the pan
const STAR_ZOOM_PARALLAX = 0.3;      // ...and zoom by the graph's zoom to this power

// One screen diagonal per tile: the 3x3 block then covers the screen at any rotation,
// down to a star zoom of 0.5 (the minimum zoom 0.2 gives 0.2^0.3 ≈ 0.62)
const STAR_TILE = Math.hypot(screen.width, screen.height);

const starsGroup = document.getElementById('stars');
const starTiles = svgElement('g');
let starAngle = 0; // radians

function buildStars() {
  const tile = svgElement('g', { id: 'star-tile' });
  for (let i = 0; i < STAR_COUNT; i++) {
    tile.appendChild(svgElement('circle', {
      cx: (Math.random() - 0.5) * STAR_TILE,
      cy: (Math.random() - 0.5) * STAR_TILE,
      r: 0.4 + Math.random(),
      opacity: 0.2 + Math.random() * 0.3,
    }, 'star'));
  }
  starTiles.appendChild(tile);
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      if (i === 0 && j === 0) continue;
      starTiles.appendChild(svgElement('use', { href: '#star-tile', x: i * STAR_TILE, y: j * STAR_TILE }));
    }
  }
  starsGroup.appendChild(starTiles);
}
buildStars();

// Wrap v into [-STAR_TILE / 2, STAR_TILE / 2)
function wrapToTile(v) {
  return ((v + STAR_TILE / 2) % STAR_TILE + STAR_TILE) % STAR_TILE - STAR_TILE / 2;
}

// Turn the stars on by dt and place them for the current pan and zoom
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
  starsGroup.setAttribute('transform', `rotate(${starAngle * 180 / Math.PI}) scale(${k})`);
  starTiles.setAttribute('transform', `translate(${tx}, ${ty})`);
}
