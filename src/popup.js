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

  let editingBlock = null;
  function renderBlocks() {
    const container = document.getElementById("site-blocks");
    container.replaceChildren();
    for (const block of settings.siteBlocks) {
      const row = document.createElement("div");
      row.className = "item";
      const label = document.createElement("div");
      label.className = "label";
      const title = document.createElement("strong");
      title.textContent = block.domain;
      const status = document.createElement("p");
      const isOn = globalThis.QuietWeb.blockIsActive(block);
      status.className = "block-status" + (isOn && settings.enabled ? " active" : "");
      status.textContent = block.mode === "always" ?
        "All day · " + block.days.length + " day(s) · " + (isOn && settings.enabled ? "Blocked now" : "Inactive") :
        block.start + "–" + block.end + " · " + block.days.length + " day(s) · " +
        (isOn && settings.enabled ? "Blocked now" : "Inactive");
      label.append(title, status);
      const actions = document.createElement("div");
      actions.className = "block-actions";
      const toggle = document.createElement("input");
      toggle.type = "checkbox";
      toggle.checked = block.enabled;
      toggle.title = "Enable/disable block";
      toggle.setAttribute("aria-label", "Enable block for " + block.domain);
      toggle.addEventListener("change", () => {
        saveSettings({...settings,siteBlocks:settings.siteBlocks.map(b =>
          b.id === block.id ? {...b,enabled:toggle.checked} : b)}).catch(displayError);
      });
      const edit = document.createElement("button");
      edit.type = "button"; edit.textContent = "Edit";
      edit.addEventListener("click", () => {
        editingBlock = block.id;
        document.getElementById("block-domain").value = block.domain;
        document.getElementById("block-mode").value = block.mode;
        document.getElementById("block-start").value = block.start;
        document.getElementById("block-end").value = block.end;
        for(const input of document.querySelectorAll("#block-weekdays input")) {
          input.checked = block.days.includes(Number(input.value));
        }
        document.getElementById("block-save").textContent = "Save changes";
        document.getElementById("block-cancel").hidden = false;
        adjustBlockMode();
      });
      const del = document.createElement("button");
      del.type="button";del.textContent="Remove";
      del.addEventListener("click", () =>
        saveSettings({...settings,siteBlocks:settings.siteBlocks.filter(b => b.id !== block.id)})
          .then(resetBlockForm).catch(displayError)
      );
      actions.append(toggle,edit,del);row.append(label,actions);container.append(row);
    }
  }
  function adjustBlockMode() {
    document.getElementById("block-times").hidden =
      document.getElementById("block-mode").value === "always";
  }
  function resetBlockForm() {
    editingBlock=null;
    document.getElementById("block-form").reset();
    document.getElementById("block-save").textContent="Add website block";
    document.getElementById("block-cancel").hidden=true;
    adjustBlockMode();
  }
  document.getElementById("block-mode").addEventListener("change", adjustBlockMode);
  document.getElementById("block-cancel").addEventListener("click",resetBlockForm);
  document.getElementById("block-form").addEventListener("submit", async(event)=>{
    event.preventDefault();
    elements.message.textContent="";
    const domain=globalThis.QuietWeb.normalizeDomain(document.getElementById("block-domain").value);
    const mode=document.getElementById("block-mode").value;
    const start=document.getElementById("block-start").value;
    const end=document.getElementById("block-end").value;
    const days=[...document.querySelectorAll("#block-weekdays input:checked")].map(input=>Number(input.value));
    if(!domain || !days.length || (mode==="scheduled" && (!start || !end || start===end))) {
      elements.message.textContent="Enter a valid domain, select days, and choose different start/end times.";
      return;
    }
    const existing=settings.siteBlocks.find(b=>b.id===editingBlock);
    const block=globalThis.QuietWeb.normalizeSiteBlock({
      id: editingBlock || "site-"+Date.now()+"-"+Math.random().toString(36).slice(2,6),
      domain, mode,start,end,days,enabled:existing ? existing.enabled : true
    });
    if(!block){elements.message.textContent="Invalid website block.";return;}
    const next=settings.siteBlocks.filter(b=>b.id!==editingBlock);
    next.push(block);
    try{await saveSettings({...settings,siteBlocks:next});resetBlockForm();}
    catch(error){displayError(error);}
  });
  document.getElementById("selector-form").addEventListener("submit",async(event)=>{
    event.preventDefault();
    const domain=globalThis.QuietWeb.normalizeDomain(document.getElementById("selector-domain").value);
    const selector=document.getElementById("selector-value").value.trim();
    if(!domain || !globalThis.QuietWeb.safeSelector(selector)) {
      elements.message.textContent="Enter a valid domain and CSS selector.";return;
    }
    try{ document.querySelector(selector); }
    catch{elements.message.textContent="Invalid CSS selector.";return;}
    try{
      await saveSettings({...settings,rules:[...settings.rules,{id:"rule-"+Date.now(),
        hostname:domain,selector,label:"Manual rule",createdAt:Date.now()}]});
      document.getElementById("selector-form").reset();
      elements.message.textContent="Element rule saved for "+domain+".";
    }catch(error){displayError(error);}
  });

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
    renderBlocks();
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
