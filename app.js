(() => {
  const MAX_RGB_DISTANCE = Math.sqrt(3 * 255 * 255);

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const ColorMath = {
    randomRgb() {
      return {
        r: Math.floor(Math.random() * 256),
        g: Math.floor(Math.random() * 256),
        b: Math.floor(Math.random() * 256),
      };
    },

    rgbToCss({ r, g, b }) {
      return `rgb(${r}, ${g}, ${b})`;
    },

    rgbDistance(a, b) {
      const dr = a.r - b.r;
      const dg = a.g - b.g;
      const db = a.b - b.b;
      return Math.sqrt(dr * dr + dg * dg + db * db);
    },

    scoreFromDistance(distance) {
      return Math.round(((MAX_RGB_DISTANCE - distance) / MAX_RGB_DISTANCE) * 100);
    },

    rgbToHsl({ r, g, b }) {
      const rn = r / 255;
      const gn = g / 255;
      const bn = b / 255;
      const max = Math.max(rn, gn, bn);
      const min = Math.min(rn, gn, bn);
      const delta = max - min;

      let h = 0;
      if (delta !== 0) {
        if (max === rn) h = ((gn - bn) / delta) % 6;
        else if (max === gn) h = (bn - rn) / delta + 2;
        else h = (rn - gn) / delta + 4;
      }

      h = Math.round((h * 60 + 360) % 360);
      const l = (max + min) / 2;
      const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

      return { h, s: Math.round(s * 100), l: Math.round(l * 100) };
    },

    hslToRgb({ h, s, l }) {
      const sn = clamp(s, 0, 100) / 100;
      const ln = clamp(l, 0, 100) / 100;
      const c = (1 - Math.abs(2 * ln - 1)) * sn;
      const hp = ((h % 360) + 360) % 360 / 60;
      const x = c * (1 - Math.abs((hp % 2) - 1));

      let r1 = 0;
      let g1 = 0;
      let b1 = 0;

      if (hp < 1) [r1, g1, b1] = [c, x, 0];
      else if (hp < 2) [r1, g1, b1] = [x, c, 0];
      else if (hp < 3) [r1, g1, b1] = [0, c, x];
      else if (hp < 4) [r1, g1, b1] = [0, x, c];
      else if (hp < 5) [r1, g1, b1] = [x, 0, c];
      else [r1, g1, b1] = [c, 0, x];

      const m = ln - c / 2;
      return {
        r: Math.round((r1 + m) * 255),
        g: Math.round((g1 + m) * 255),
        b: Math.round((b1 + m) * 255),
      };
    },

    rgbToCmyk({ r, g, b }) {
      const rn = r / 255;
      const gn = g / 255;
      const bn = b / 255;
      const k = 1 - Math.max(rn, gn, bn);
      if (k === 1) return { c: 0, m: 0, y: 0, k: 100 };
      const c = (1 - rn - k) / (1 - k);
      const m = (1 - gn - k) / (1 - k);
      const y = (1 - bn - k) / (1 - k);
      return {
        c: Math.round(c * 100),
        m: Math.round(m * 100),
        y: Math.round(y * 100),
        k: Math.round(k * 100),
      };
    },

    cmykToRgb({ c, m, y, k }) {
      const cn = clamp(c, 0, 100) / 100;
      const mn = clamp(m, 0, 100) / 100;
      const yn = clamp(y, 0, 100) / 100;
      const kn = clamp(k, 0, 100) / 100;
      return {
        r: Math.round(255 * (1 - cn) * (1 - kn)),
        g: Math.round(255 * (1 - mn) * (1 - kn)),
        b: Math.round(255 * (1 - yn) * (1 - kn)),
      };
    },

    harmonyTargets(baseRgb, type) {
      const baseHsl = this.rgbToHsl(baseRgb);
      const shifts = {
        analogous: [330, 30],
        complementary: [180],
        "split-complementary": [150, 210],
        triad: [120, 240],
        "bad-harmony": [90, 270],
      }[type] || [180];

      return shifts.map((shift, index) => {
        const targetHsl = {
          h: (baseHsl.h + shift) % 360,
          s: type === "bad-harmony" ? (index % 2 === 0 ? 100 : 20) : baseHsl.s,
          l: type === "bad-harmony" ? (index % 2 === 0 ? 20 : 80) : baseHsl.l,
        };
        return this.hslToRgb(targetHsl);
      });
    },
  };

  class BaseMode {
    constructor(state) {
      this.state = state;
    }

    startRound() {
      throw new Error("Not implemented");
    }

    evaluate() {
      throw new Error("Not implemented");
    }
  }

  class GuessMode extends BaseMode {
    startRound() {
      this.state.target = ColorMath.randomRgb();
      this.state.harmony = [];
      return this.state.target;
    }

    evaluate(playerColors) {
      const player = playerColors[0];
      const distance = ColorMath.rgbDistance(this.state.target, player);
      const score = ColorMath.scoreFromDistance(distance);
      return {
        distance: [distance],
        score,
        message: `Distance: ${distance.toFixed(2)} | Score: ${score}/100`,
      };
    }
  }

  class HarmonyMode extends BaseMode {
    startRound() {
      this.state.target = ColorMath.randomRgb();
      this.state.harmony = ColorMath.harmonyTargets(this.state.target, this.state.harmonyType);
      return this.state.target;
    }

    evaluate(playerColors) {
      const distances = this.state.harmony.map((target, idx) => ColorMath.rgbDistance(target, playerColors[idx]));
      const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;
      const score = ColorMath.scoreFromDistance(avgDistance);
      return {
        distance: distances,
        score,
        message: `Average harmony distance: ${avgDistance.toFixed(2)} | Score: ${score}/100`,
      };
    }
  }

  const modelDefs = {
    rgb: [
      { key: "r", min: 0, max: 255, step: 1, label: "R" },
      { key: "g", min: 0, max: 255, step: 1, label: "G" },
      { key: "b", min: 0, max: 255, step: 1, label: "B" },
    ],
    hsl: [
      { key: "h", min: 0, max: 360, step: 1, label: "H" },
      { key: "s", min: 0, max: 100, step: 1, label: "S" },
      { key: "l", min: 0, max: 100, step: 1, label: "L" },
    ],
    cmyk: [
      { key: "c", min: 0, max: 100, step: 1, label: "C" },
      { key: "m", min: 0, max: 100, step: 1, label: "M" },
      { key: "y", min: 0, max: 100, step: 1, label: "Y" },
      { key: "k", min: 0, max: 100, step: 1, label: "K" },
    ],
  };

  const dom = {
    mode: document.getElementById("mode"),
    model: document.getElementById("model"),
    infiniteRounds: document.getElementById("infiniteRounds"),
    rounds: document.getElementById("rounds"),
    alwaysVisible: document.getElementById("alwaysVisible"),
    hideSeconds: document.getElementById("hideSeconds"),
    harmonyType: document.getElementById("harmonyType"),
    harmonyTypeLabel: document.getElementById("harmonyTypeLabel"),
    visibilityLabel: document.getElementById("visibilityLabel"),
    hideSecondsLabel: document.getElementById("hideSecondsLabel"),
    targetWrap: document.getElementById("targetWrap"),
    targetSwatch: document.getElementById("targetSwatch"),
    guessPreview: document.getElementById("guessPreview"),
    harmonyTargets: document.getElementById("harmonyTargets"),
    inputs: document.getElementById("inputs"),
    feedback: document.getElementById("feedback"),
    form: document.getElementById("guessForm"),
    roundStatus: document.getElementById("roundStatus"),
    nextRound: document.getElementById("nextRound"),
  };

  const state = {
    mode: "guess",
    model: "rgb",
    target: ColorMath.randomRgb(),
    harmonyType: "analogous",
    harmony: [],
    currentRound: 1,
    roundsPlayed: 0,
    hideTimer: null,
  };

  const modes = {
    guess: new GuessMode(state),
    harmony: new HarmonyMode(state),
  };

  function convertInputToRgb(model, values) {
    if (model === "rgb") return values;
    if (model === "hsl") return ColorMath.hslToRgb(values);
    return ColorMath.cmykToRgb(values);
  }

  function rgbToModel(model, rgb) {
    if (model === "rgb") return rgb;
    if (model === "hsl") return ColorMath.rgbToHsl(rgb);
    return ColorMath.rgbToCmyk(rgb);
  }

  function buildSliderGradient(model, key, values) {
    if (model === "rgb") {
      const r = Math.round(values.r);
      const g = Math.round(values.g);
      const b = Math.round(values.b);
      if (key === "r") return `linear-gradient(to right, rgb(0,${g},${b}), rgb(255,${g},${b}))`;
      if (key === "g") return `linear-gradient(to right, rgb(${r},0,${b}), rgb(${r},255,${b}))`;
      return `linear-gradient(to right, rgb(${r},${g},0), rgb(${r},${g},255))`;
    }
    if (model === "hsl") {
      const h = Math.round(values.h);
      const s = Math.round(values.s);
      const l = Math.round(values.l);
      if (key === "h") {
        const stops = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330, 360]
          .map((deg) => `hsl(${deg},${s}%,${l}%)`)
          .join(", ");
        return `linear-gradient(to right, ${stops})`;
      }
      if (key === "s") return `linear-gradient(to right, hsl(${h},0%,${l}%), hsl(${h},100%,${l}%))`;
      return `linear-gradient(to right, hsl(${h},${s}%,0%), hsl(${h},${s}%,50%), hsl(${h},${s}%,100%))`;
    }
    if (model === "cmyk") {
      if (key === "c") return "linear-gradient(to right, white, cyan)";
      if (key === "m") return "linear-gradient(to right, white, magenta)";
      if (key === "y") return "linear-gradient(to right, white, yellow)";
      return "linear-gradient(to right, white, black)";
    }
    return "linear-gradient(to right, rgba(255,255,255,0.05), rgba(255,255,255,0.15))";
  }

  function getGroupModelValues(groupEl, index) {
    const fields = modelDefs[state.model];
    const values = {};
    fields.forEach((field) => {
      const slider = groupEl.querySelector(`[name="color-${index}-${field.key}"]`);
      values[field.key] = clamp(Number(slider.value), field.min, field.max);
    });
    return values;
  }

  function updateSliderGradients(groupEl, index) {
    const values = getGroupModelValues(groupEl, index);
    modelDefs[state.model].forEach((field) => {
      const slider = groupEl.querySelector(`[name="color-${index}-${field.key}"]`);
      if (slider) slider.style.background = buildSliderGradient(state.model, field.key, values);
    });
  }

  function updateLivePreview(groupEl, index) {
    const values = getGroupModelValues(groupEl, index);
    const rgb = convertInputToRgb(state.model, values);
    const css = ColorMath.rgbToCss(rgb);
    const chip = groupEl.querySelector(".group-color-chip");
    if (chip) chip.style.background = css;
    if (state.mode === "guess") {
      dom.guessPreview.style.background = css;
    }
  }

  function buildInputGroup(index, defaults) {
    const fields = modelDefs[state.model];
    const group = document.createElement("div");
    group.className = "input-group";

    const header = document.createElement("div");
    header.className = "group-header";
    const chip = document.createElement("div");
    chip.className = "group-color-chip";
    const title = document.createElement("span");
    title.className = "group-title";
    title.textContent = state.mode === "harmony" ? `Color ${index + 1}` : "Your guess";
    header.appendChild(chip);
    header.appendChild(title);
    group.appendChild(header);

    const container = document.createElement("div");
    container.className = "sliders-container";

    fields.forEach((field) => {
      const row = document.createElement("div");
      row.className = "slider-row";

      const lbl = document.createElement("span");
      lbl.className = "slider-label";
      lbl.textContent = field.label;

      const slider = document.createElement("input");
      slider.type = "range";
      slider.min = String(field.min);
      slider.max = String(field.max);
      slider.step = String(field.step);
      slider.name = `color-${index}-${field.key}`;
      slider.value = String(clamp(defaults[field.key] ?? field.min, field.min, field.max));

      const valDisplay = document.createElement("span");
      valDisplay.className = "slider-value";
      valDisplay.textContent = slider.value;

      slider.addEventListener("input", () => {
        valDisplay.textContent = slider.value;
        updateSliderGradients(group, index);
        updateLivePreview(group, index);
      });

      row.appendChild(lbl);
      row.appendChild(slider);
      row.appendChild(valDisplay);
      container.appendChild(row);
    });

    group.appendChild(container);
    updateSliderGradients(group, index);
    updateLivePreview(group, index);
    return group;
  }

  function renderInputs() {
    dom.inputs.innerHTML = "";

    if (state.mode === "guess") {
      dom.inputs.appendChild(buildInputGroup(0, rgbToModel(state.model, state.target)));
      return;
    }

    state.harmony.forEach((harmonyRgb, idx) => {
      dom.inputs.appendChild(buildInputGroup(idx, rgbToModel(state.model, harmonyRgb)));
    });
  }

  function renderHarmonyTargets() {
    dom.harmonyTargets.innerHTML = "";
    if (state.mode !== "harmony") return;

    state.harmony.forEach((rgb, idx) => {
      const row = document.createElement("div");
      row.className = "harmony-item";
      const chip = document.createElement("span");
      chip.className = "harmony-chip";
      chip.style.background = ColorMath.rgbToCss(rgb);
      const txt = document.createElement("span");
      txt.textContent = `Target harmony ${idx + 1}`;
      row.appendChild(chip);
      row.appendChild(txt);
      dom.harmonyTargets.appendChild(row);
    });
  }

  function updateVisibilitySettings() {
    const isGuess = state.mode === "guess";
    dom.harmonyTypeLabel.classList.toggle("hidden", isGuess);
    dom.visibilityLabel.classList.toggle("hidden", !isGuess);
    dom.hideSecondsLabel.classList.toggle("hidden", !isGuess || dom.alwaysVisible.checked);
    dom.guessPreview.classList.toggle("hidden", !isGuess);
  }

  function setTargetVisibility() {
    clearTimeout(state.hideTimer);
    dom.targetWrap.classList.remove("hidden-target");

    if (state.mode !== "guess" || dom.alwaysVisible.checked) return;

    const seconds = clamp(Number(dom.hideSeconds.value) || 3, 1, 15);
    state.hideTimer = setTimeout(() => {
      dom.targetWrap.classList.add("hidden-target");
    }, seconds * 1000);
  }

  function startRound(resetCount = false) {
    if (resetCount) {
      state.currentRound = 1;
      state.roundsPlayed = 0;
    }

    state.mode = dom.mode.value;
    state.model = dom.model.value;
    state.harmonyType = dom.harmonyType.value;

    modes[state.mode].startRound();
    dom.targetSwatch.style.background = ColorMath.rgbToCss(state.target);
    renderHarmonyTargets();
    renderInputs();
    updateVisibilitySettings();
    setTargetVisibility();
    dom.feedback.textContent = "Pick values and submit to get feedback.";
    dom.roundStatus.textContent = `Round ${state.currentRound}`;
  }

  function parseInputs() {
    const fields = modelDefs[state.model];
    const rounds = state.mode === "harmony" ? state.harmony.length : 1;
    const all = [];

    for (let i = 0; i < rounds; i += 1) {
      const values = {};
      fields.forEach((field) => {
        const input = dom.form.elements.namedItem(`color-${i}-${field.key}`);
        values[field.key] = clamp(Number(input.value), field.min, field.max);
      });
      all.push(convertInputToRgb(state.model, values));
    }

    return all;
  }

  function finishRoundIfNeeded() {
    state.roundsPlayed += 1;
    const isInfinite = dom.infiniteRounds.checked;
    const roundLimit = clamp(Number(dom.rounds.value) || 1, 1, 100);

    if (!isInfinite && state.roundsPlayed >= roundLimit) {
      dom.feedback.textContent += " | Game over: round limit reached. Click New target to restart.";
      state.currentRound = 1;
      state.roundsPlayed = 0;
      return;
    }

    state.currentRound += 1;
  }

  dom.form.addEventListener("submit", (event) => {
    event.preventDefault();
    const player = parseInputs();
    const result = modes[state.mode].evaluate(player);
    dom.feedback.textContent = result.message;
    finishRoundIfNeeded();
  });

  dom.nextRound.addEventListener("click", () => {
    startRound(false);
  });

  dom.mode.addEventListener("change", () => {
    startRound(true);
  });

  dom.model.addEventListener("change", () => {
    state.model = dom.model.value;
    renderInputs();
  });

  dom.harmonyType.addEventListener("change", () => {
    if (state.mode === "harmony") startRound(false);
  });

  dom.alwaysVisible.addEventListener("change", () => {
    updateVisibilitySettings();
    setTargetVisibility();
  });

  dom.hideSeconds.addEventListener("change", () => {
    setTargetVisibility();
  });

  dom.infiniteRounds.addEventListener("change", () => {
    dom.rounds.disabled = dom.infiniteRounds.checked;
  });

  dom.rounds.disabled = dom.infiniteRounds.checked;
  startRound(true);
})();
