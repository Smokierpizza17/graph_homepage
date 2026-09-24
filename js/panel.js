// Settings panel: one slider per entry in settingsConfig, plus Reset! and Random! buttons.

const settingsPanel = document.getElementById('settings');
const sliders = []; // { key, slider, output } per setting

function htmlElement(tag, className, text) {
  const el = document.createElement(tag);
  el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

// Show the current settings on the sliders
function syncSliders() {
  for (const { key, slider, output } of sliders) {
    slider.value = settings[key];
    output.textContent = settings[key];
  }
}

function buildPanel() {
  for (const [key, cfg] of Object.entries(settingsConfig)) {
    const row = htmlElement('label', 'setting');
    const output = htmlElement('span', 'setting-value');
    const slider = document.createElement('input');
    Object.assign(slider, { type: 'range', min: cfg.min, max: cfg.max, step: cfg.step });
    slider.addEventListener('input', () => {
      settings[key] = Number(slider.value);
      output.textContent = slider.value;
    });
    row.append(htmlElement('span', 'setting-name', cfg.label), output, slider);
    settingsPanel.appendChild(row);
    sliders.push({ key, slider, output });
  }
  syncSliders();

  const resetButton = htmlElement('button', 'settings-button', 'Reset!');
  resetButton.addEventListener('click', () => { resetSettings(); syncSliders(); });

  const randomButton = htmlElement('button', 'settings-button', 'Random!');
  randomButton.addEventListener('click', () => randomizePositions(svg.clientWidth, svg.clientHeight));

  const buttonRow = htmlElement('div', 'settings-buttons');
  buttonRow.append(resetButton, randomButton);
  settingsPanel.appendChild(buttonRow);

  // The settings never take focus, so Tab skips them and keyboard shortcuts
  // (Space, H) keep working after touching a slider or button.
  for (const el of settingsPanel.querySelectorAll('summary, input, button')) {
    el.setAttribute('tabindex', '-1');
  }
  settingsPanel.addEventListener('focusin', (evt) => evt.target.blur());
}
buildPanel();
