(() => {
  "use strict";

  const { normalizeSettings, activeSelectors, safeSelector } = globalThis.QuietWeb;
  const STYLE_ID = "quiet-web-style";
  const hostname = location.hostname.toLowerCase();
  let settings = normalizeSettings();
  let lastUrl = location.href;
  let activePicker = null;

  function ensureStyle() {
    let style = document.getElementById(STYLE_ID);
    if (style) return style;
    if (!document.documentElement) return null;
    style = document.createElement("style");
    style.id = STYLE_ID;
    style.setAttribute("data-quiet-web", "true");
    document.documentElement.append(style);
    return style;
  }

  function applyRules() {
    const style = ensureStyle();
    if (!style) return;
    const selectors = activeSelectors(settings, hostname, location.pathname);
    const css = selectors.filter(safeSelector)
      .map((selector) => `${selector} { display: none !important; }`)
      .join("\n");
    if (style.textContent !== css) style.textContent = css;
  }

  async function loadSettings() {
    try {
      const result = await browser.storage.local.get("settings");
      settings = normalizeSettings(result.settings);
      applyRules();
    } catch (error) {
      console.error("Quiet Web: could not load settings", error);
    }
  }

  browser.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.settings) {
      settings = normalizeSettings(changes.settings.newValue);
      applyRules();
      if (activePicker && (!settings.enabled || settings.pausedHosts.includes(hostname))) {
        stopPicker();
      }
    }
  });

  // CSS hides late-loaded elements automatically; this observer is only for SPA URL changes.
  const navigationObserver = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      applyRules();
    }
  });
  navigationObserver.observe(document, { childList: true, subtree: true });

  for (const event of ["popstate", "hashchange", "yt-navigate-finish"]) {
    window.addEventListener(event, () => {
      lastUrl = location.href;
      applyRules();
    });
  }
  document.addEventListener("DOMContentLoaded", applyRules, { once: true });
  loadSettings();

  function stableId(id) {
    return id && id.length <= 65 &&
      !/^(ember\d+|react-select-|:r[0-9a-z]+:)/i.test(id) &&
      !/\d{6,}/.test(id);
  }

  function cssString(value) {
    return JSON.stringify(value);
  }

  function section(node) {
    const tag = node.localName;
    if (!tag) return null;
    if (stableId(node.id)) return `#${CSS.escape(node.id)}`;

    for (const attr of ["data-testid", "data-test-id", "data-view-name", "aria-label"]) {
      const value = node.getAttribute(attr);
      if (value && value.length <= 100) {
        const selector = `${tag}[${attr}=${cssString(value)}]`;
        if (document.querySelectorAll(selector).length === 1) return selector;
      }
    }

    const classes = [...node.classList].filter((name) =>
      /^[a-zA-Z][a-zA-Z0-9_-]{2,60}$/.test(name) &&
      !/^(active|selected|focus|hover|disabled|css-|sc-)/.test(name)
    ).slice(0, 2);
    const withClasses = tag + classes.map((name) => `.${CSS.escape(name)}`).join("");
    const parent = node.parentElement;
    if (!parent) return withClasses;
    const matching = [...parent.children].filter((sibling) => sibling.matches(withClasses));
    if (matching.length === 1) return withClasses;

    const siblings = [...parent.children].filter((sibling) => sibling.localName === tag);
    return `${withClasses}:nth-of-type(${siblings.indexOf(node) + 1})`;
  }

  function selectorFor(element) {
    if (!(element instanceof Element) || ["html", "body"].includes(element.localName)) {
      return null;
    }
    const segments = [];
    for (let node = element; node && node.localName !== "html"; node = node.parentElement) {
      if (node.localName === "body") break;
      const piece = section(node);
      if (!piece) break;
      segments.unshift(piece);
      const selector = segments.join(" > ");
      try {
        if (safeSelector(selector) && document.querySelectorAll(selector).length === 1) {
          return selector;
        }
      } catch {
        // Fall back to a more specific selector.
      }
      if (piece.startsWith("#")) break;
    }
    const result = segments.join(" > ");
    try {
      return safeSelector(result) && document.querySelectorAll(result).length === 1 ? result : null;
    } catch {
      return null;
    }
  }

  function stopPicker() {
    if (!activePicker) return;
    const { outline, hint, oldCursor } = activePicker;
    document.removeEventListener("pointermove", movePicker, true);
    document.removeEventListener("click", pickElement, true);
    document.removeEventListener("keydown", keyPicker, true);
    document.documentElement.style.cursor = oldCursor;
    outline.remove();
    hint.remove();
    activePicker = null;
  }

  function movePicker(event) {
    if (!activePicker) return;
    const element = event.target;
    if (!(element instanceof Element) || ["html", "body"].includes(element.localName)) {
      activePicker.outline.style.display = "none";
      return;
    }
    const rect = element.getBoundingClientRect();
    activePicker.outline.style.display = "block";
    Object.assign(activePicker.outline.style, {
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`
    });
    activePicker.hovered = element;
  }

  function keyPicker(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopImmediatePropagation();
      stopPicker();
    }
  }

  async function pickElement(event) {
    if (!activePicker) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const target = event.target;
    const selector = selectorFor(target);
    if (!selector) {
      stopPicker();
      console.warn("Quiet Web: could not generate a reliable selector for this element");
      return;
    }
    stopPicker();
    try {
      const stored = normalizeSettings((await browser.storage.local.get("settings")).settings);
      if (!stored.enabled || stored.pausedHosts.includes(hostname)) return;
      const rule = {
        id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        hostname,
        selector,
        label: target.localName + (target.id ? `#${target.id}` : ""),
        createdAt: Date.now()
      };
      stored.rules.push(rule);
      await browser.storage.local.set({ settings: stored });
    } catch (error) {
      console.error("Quiet Web: could not save selected element", error);
    }
  }

  function startPicker() {
    if (activePicker) return true;
    if (!document.documentElement || !settings.enabled || settings.pausedHosts.includes(hostname)) {
      return false;
    }
    const outline = document.createElement("div");
    outline.setAttribute("data-quiet-web-overlay", "true");
    Object.assign(outline.style, {
      position: "fixed", pointerEvents: "none", zIndex: "2147483647",
      display: "none", boxSizing: "border-box", border: "3px solid #30c2b1",
      background: "rgba(48,194,177,.13)", borderRadius: "3px"
    });
    const hint = document.createElement("div");
    hint.setAttribute("data-quiet-web-overlay", "true");
    hint.textContent = "Quiet Web: click an element to hide it · Esc cancels";
    Object.assign(hint.style, {
      position: "fixed", top: "14px", left: "14px", zIndex: "2147483647",
      pointerEvents: "none", background: "#132a35", color: "white",
      padding: "10px 14px", borderRadius: "8px", font: "13px system-ui, sans-serif",
      boxShadow: "0 3px 18px rgba(0,0,0,.3)"
    });
    const oldCursor = document.documentElement.style.cursor;
    activePicker = { outline, hint, oldCursor, hovered: null };
    document.documentElement.append(outline, hint);
    document.documentElement.style.cursor = "crosshair";
    document.addEventListener("pointermove", movePicker, true);
    document.addEventListener("click", pickElement, true);
    document.addEventListener("keydown", keyPicker, true);
    return true;
  }

  browser.runtime.onMessage.addListener((message) => {
    if (message && message.type === "START_PICKER") {
      return Promise.resolve({ ok: startPicker() });
    }
    if (message && message.type === "STOP_PICKER") {
      stopPicker();
      return Promise.resolve({ ok: true });
    }
    return false;
  });
})();
