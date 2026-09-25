// Link hint text scramble: instead of the hint just fading in (the opacity
// fade itself is CSS - see `.link-hint` in graph.css), its text resolves left
// to right behind a small band of scrambled characters that sweeps across it,
// like a decoded signal. Advanced from the main animation loop (updateHints(),
// called from main.js alongside step() and render()) rather than a timer of
// its own, since that loop is already running. nodeDrag.js starts one on
// hover (mouse/pen) and on a touch peek.

const SCRAMBLE_CHARS = '!<>-_\\/[]{}=+*^?#$%&';
const SCRAMBLE_BAND = 7;          // how many characters are garbled at once, at the sweep's leading edge
const SCRAMBLE_CHAR_TIME = 0.015; // seconds of sweep time per character, so longer hints take proportionally longer

const hintText = new WeakMap();    // hint element -> its real text, captured on first scramble
const activeScrambles = new Map(); // hint element -> { time, duration, chars }

function scrambleHint(hint) {
  if (!hint) return;
  if (!hintText.has(hint)) hintText.set(hint, hint.textContent);
  const final = hintText.get(hint);
  activeScrambles.set(hint, {
    time: 0,
    duration: (final.length + SCRAMBLE_BAND) * SCRAMBLE_CHAR_TIME, // sweep covers the string plus one band's runoff
    // each position's band glyph, picked once (lazily, below) and kept until
    // that position resolves - not re-rolled every frame
    chars: new Array(final.length),
  });
}

function updateHints(dt) {
  for (const [hint, state] of activeScrambles) {
    state.time += dt;
    const final = hintText.get(hint);
    if (state.time >= state.duration) {
      hint.textContent = final;
      activeScrambles.delete(hint);
      continue;
    }
    // The sweep runs a full band past the end, so the last few characters get
    // their turn in the band instead of jumping straight from blank to resolved.
    // Capping the band's end at `front` (rather than always spanning the full
    // SCRAMBLE_BAND width) makes it grow in from nothing at the start too.
    const front = Math.floor((state.time / state.duration) * (final.length + SCRAMBLE_BAND));
    const revealed = Math.min(final.length, Math.max(0, front - SCRAMBLE_BAND));
    const bandEnd = Math.min(revealed + SCRAMBLE_BAND, front);
    hint.textContent = [...final]
      .map((ch, i) => {
        if (i < revealed) return ch; // already resolved
        if (i >= bandEnd) return ' '; // not reached yet
        // in the band: pick this position's glyph once, then hold it until it resolves
        if (state.chars[i] === undefined) state.chars[i] = SCRAMBLE_CHARS[Math.random() * SCRAMBLE_CHARS.length | 0];
        return state.chars[i];
      })
      .join('');
  }
}
