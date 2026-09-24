// Simulation settings: each defines its default value and the range of its slider
// in the settings panel (see panel.js).
const settingsConfig = {
  centering:    { label: 'Centering',     value: 0.05,    min: 0.005,  max: 0.2,   step: 0.005  },
  rotation:     { label: 'Rotation',      value: 0.0005,  min: -0.01,  max: 0.01,  step: 0.0005 },
  repulsion:    { label: 'Repulsion',     value: 7000,    min: 0,      max: 50000, step: 500    },
  linkStrength: { label: 'Link strength', value: 0.05,    min: 0.002,  max: 0.3,   step: 0.002  },
  linkLength:   { label: 'Link length',   value: 130,     min: 10,     max: 400,   step: 5      },
  damping:      { label: 'Damping',       value: 0.25,    min: 0.01,   max: 1,     step: 0.01   },
  speed:        { label: 'Speed',         value: 50,      min: 1,      max: 100,   step: 1      },
  temperature:  { label: 'Temperature',   value: 0,       min: 0,      max: 20,    step: 0.05   },
};

// Current values, read by the simulation and changed by the sliders
const settings = {};

function resetSettings() {
  for (const [key, cfg] of Object.entries(settingsConfig)) settings[key] = cfg.value;
}
resetSettings();
