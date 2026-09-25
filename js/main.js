// Entry point: scatter the nodes, then run the simulation every frame.

let lastTime = 0;

function tick(currentTime) {
  const realDt = Math.min((currentTime - lastTime) / 1000, 0.05); // seconds since last frame, unscaled
  const dt = settings.speed * realDt;
  lastTime = currentTime;
  step(dt);
  updateStars(dt);
  updateHints(realDt); // a hover animation, not physics - shouldn't speed up/pause with the simulation
  render();
  requestAnimationFrame(tick);
}

randomizePositions(svg.clientWidth, svg.clientHeight);
render();
requestAnimationFrame(tick);
