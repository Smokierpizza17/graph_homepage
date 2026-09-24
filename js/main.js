// Entry point: scatter the nodes, then run the simulation every frame.

let lastTime = 0;

function tick(currentTime) {
  const dt = settings.speed * Math.min((currentTime - lastTime) / 1000, 0.05); // seconds since last frame, scaled
  lastTime = currentTime;
  step(dt);
  updateStars(dt);
  render();
  requestAnimationFrame(tick);
}

randomizePositions(svg.clientWidth, svg.clientHeight);
render();
requestAnimationFrame(tick);
