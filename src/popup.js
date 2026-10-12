(() => {
  "use strict";
  const { PRESETS, hostnameMatches, normalizeSettings } = globalThis.QuietWeb;
  const elements = {
    siteName: document.getElementById("site-name"),
    siteSwitch: document.getElementById("site-switch"),
    globalSwitch: document.getElementById("global-switch"),
    pickButton: document.getElementById("pick-button"),
    presetsSection: document.getElementById("presets-section"),
    presets: document.getElementById("presets"),
    rules: document.getElementById("rules"),
    ruleCount: document.getElementById("rule-count"),
    message: document.getElementById("message")
  };
  let tabId = null;
  let hostname = null;
  let settings = normalizeSettings();

  function displayError(error) {
    console.error(error);
    elements.message.textContent = error instanceof Error ? error.message : String(error);
  }

  async function saveSettings(next) {
    settings = normalizeSettings(next);
    await browser.storage.local.set({ settings });
    render();
  }

  function switchControl(isChecked, label, onChange) {
    const wrapper = document.createElement("label");
    wrapper.className = "switch";
    wrapper.title = label;
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = isChecked;
    input.setAttribute("aria-label", label);
    input.addEventListener("change", () => onChange(input.checked).catch(displayError));
    const slider = document.createElement("span");
    slider.className = "slider";
    wrapper.append(input, slider);
    return wrapper;
  }

  function renderPresets() {
    const available = PRESETS.filter((preset) => hostnameMatches(hostname, preset.domain));
    elements.presetsSection.hidden = available.length === 0;
    elements.presets.replaceChildren();

    for (const preset of available) {
      const row = document.createElement("div");
      row.className = "item";
      const label = document.createElement("div");
      label.className = "label";
      const title = document.createElement("strong");
      title.textContent = preset.title;
      const description = document.createElement("p");
      description.textContent = preset.description;
      label.append(title, description);
      const enabled = settings.presetOverrides[preset.id] ?? preset.defaultEnabled;
      row.append(label, switchControl(enabled, preset.title, (value) =>
        saveSettings({
          ...settings,
          presetOverrides: { ...settings.presetOverrides, [preset.id]: value }
        })
      ));
      elements.presets.append(row);
    }
  }

  function renderRules() {
    const rules = settings.rules.filter((rule) => rule.hostname === hostname);
    elements.ruleCount.textContent = `(${rules.length})`;
    elements.rules.replaceChildren();
    if (!rules.length) {
      const note = document.createElement("p");
      note.className = "empty";
      note.textContent = "No custom elements hidden on this website yet.";
      elements.rules.append(note);
      return;
    }
    for (const rule of rules.toReversed()) {
      const row = document.createElement("div");
      row.className = "item";
      const label = document.createElement("div");
      label.className = "label";
      const title = document.createElement("strong");
      title.textContent = rule.label || "Hidden element";
      const selector = document.createElement("p");
      selector.className = "selector";
      selector.textContent = rule.selector;
      label.append(title, selector);
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "delete";
      remove.textContent = "Show";
      remove.setAttribute("aria-label", `Show element ${rule.label || rule.selector}`);
      remove.addEventListener("click", () =>
        saveSettings({ ...settings, rules: settings.rules.filter((candidate) => candidate.id !== rule.id) })
          .catch(displayError)
      );
      row.append(label, remove);
      elements.rules.append(row);
    }
  }

  function render() {
    if (!hostname) return;
    elements.globalSwitch.checked = settings.enabled;
    elements.siteSwitch.checked = !settings.pausedHosts.includes(hostname);
    elements.siteSwitch.disabled = !settings.enabled;
    elements.pickButton.disabled = !settings.enabled || settings.pausedHosts.includes(hostname);
    renderPresets();
    renderRules();
  }

  elements.globalSwitch.addEventListener("change", () =>
    saveSettings({ ...settings, enabled: elements.globalSwitch.checked }).catch(displayError)
  );

  elements.siteSwitch.addEventListener("change", () => {
    const paused = new Set(settings.pausedHosts);
    if (elements.siteSwitch.checked) paused.delete(hostname);
    else paused.add(hostname);
    saveSettings({ ...settings, pausedHosts: [...paused] }).catch(displayError);
  });

  elements.pickButton.addEventListener("click", async () => {
    elements.message.textContent = "";
    try {
      const response = await browser.tabs.sendMessage(tabId, { type: "START_PICKER" });
      if (!response?.ok) throw new Error("Element picking is unavailable on this page.");
      window.close();
    } catch {
      elements.message.textContent = "Cannot access this page. Reload the tab and try again; Firefox internal pages are unsupported.";
    }
  });

  browser.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.settings) {
      settings = normalizeSettings(changes.settings.newValue);
      render();
    }
  });

  async function init() {
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      tabId = tab?.id ?? null;
      const url = new URL(tab?.url || "");
      if (!["http:", "https:"].includes(url.protocol)) throw new Error("Unsupported tab");
      hostname = url.hostname.toLowerCase();
      elements.siteName.textContent = hostname;
      settings = normalizeSettings((await browser.storage.local.get("settings")).settings);
      render();
    } catch {
      elements.siteName.textContent = "Unsupported page";
      elements.siteSwitch.disabled = true;
      elements.globalSwitch.disabled = true;
      elements.pickButton.disabled = true;
      elements.message.textContent = "Open a regular website to use Quiet Web.";
      elements.presetsSection.hidden = true;
    }
  }
  init();
})();
