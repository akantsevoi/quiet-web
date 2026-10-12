/* Shared between the popup and content script; no build tools required. */
(() => {
  "use strict";

  const PRESETS = Object.freeze([
    {
      id: "linkedin-feed",
      title: "Hide the feed",
      description: "Remove the scrolling post stream while keeping LinkedIn navigation.",
      domain: "linkedin.com",
      defaultEnabled: true,
      pathPrefixes: ["/feed"],
      selectors: [
        '[data-testid="mainFeed"]',
        "main .scaffold-finite-scroll",
        "main .scaffold-finite-scroll__content > div > .relative",
        "main .feed-shared-update-v2",
        'main [data-id^="urn:li:activity:"]',
        'main [data-testid="feed-container"]'
      ]
    },
    {
      id: "linkedin-news",
      title: "Hide LinkedIn news",
      description: "Hide the news/sidebar widgets where they appear.",
      domain: "linkedin.com",
      defaultEnabled: false,
      selectors: [
        "#feed-news-module",
        ".news-module",
        ".news-module--with-game",
        '[data-view-name="news-module"]'
      ]
    },
    {
      id: "youtube-home",
      title: "Hide home recommendations",
      description: "Make the YouTube home page less distracting; search still works.",
      domain: "youtube.com",
      defaultEnabled: true,
      exactPaths: ["/"],
      selectors: [
        'ytd-browse[page-subtype="home"] ytd-rich-grid-renderer',
        'ytd-browse[page-subtype="home"] #primary'
      ]
    },
    {
      id: "youtube-related",
      title: "Hide suggested videos",
      description: "Hide the watch-page recommendations and end-screen suggestions.",
      domain: "youtube.com",
      defaultEnabled: true,
      pathPrefixes: ["/watch"],
      selectors: [
        "ytd-watch-flexy #secondary #related",
        "ytd-watch-flexy #related",
        "ytd-watch-next-secondary-results-renderer",
        ".ytp-ce-element",
        ".ytp-endscreen-content"
      ]
    },
    {
      id: "youtube-shorts",
      title: "Hide Shorts entry points",
      description: "Hide Shorts navigation links and Shorts shelves.",
      domain: "youtube.com",
      defaultEnabled: false,
      selectors: [
        'ytd-guide-entry-renderer a[href^="/shorts"]',
        'ytd-mini-guide-entry-renderer a[href^="/shorts"]',
        "ytd-reel-shelf-renderer",
        "ytd-rich-grid-slim-media",
        'ytd-rich-shelf-renderer[is-shorts]'
      ]
    },
    {
      id: "youtube-comments",
      title: "Hide comments",
      description: "Hide comments below YouTube videos.",
      domain: "youtube.com",
      defaultEnabled: false,
      pathPrefixes: ["/watch"],
      selectors: [
        "ytd-comments#comments",
        "ytd-watch-flexy #comments"
      ]
    }
  ]);

  function hostnameMatches(hostname, domain) {
    return hostname === domain || hostname.endsWith(`.${domain}`);
  }

  function presetAppliesToPage(preset, hostname, path) {
    if (!hostnameMatches(hostname, preset.domain)) return false;
    if (preset.exactPaths && !preset.exactPaths.includes(path)) return false;
    if (preset.pathPrefixes && !preset.pathPrefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
      return false;
    }
    return true;
  }

  function safeSelector(selector) {
    return typeof selector === "string" &&
      selector.length > 0 && selector.length <= 1500 &&
      !/[{};\r\n]/.test(selector) &&
      !selector.includes("/*") && !selector.includes("*/");
  }


  const WEEKDAYS = Object.freeze([0, 1, 2, 3, 4, 5, 6]);
  const DEFAULT_BLOCK = Object.freeze({
    id: "youtube-morning", domain: "youtube.com", mode: "scheduled",
    start: "00:00", end: "13:00", days: [...WEEKDAYS], enabled: true
  });

  function normalizeDomain(value) {
    if (typeof value !== "string" || !value.trim()) return null;
    let host;
    try {
      const url = new URL(value.includes("://") ? value.trim() : `https://${value.trim()}`);
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.port) return null;
      host = url.hostname.toLowerCase().replace(/\.$/, "");
    } catch { return null; }
    if (host.length > 253 || !host.includes(".")) return null;
    const labels = host.split(".");
    return labels.every((label) => label.length <= 63 &&
      /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)) ? host : null;
  }

  function validTime(value) {
    return typeof value === "string" &&
      /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(value);
  }

  function normalizeSiteBlock(block) {
    if (!block || typeof block !== "object") return null;
    const domain = normalizeDomain(block.domain);
    const mode = block.mode === "always" ? "always" : "scheduled";
    const start = validTime(block.start) ? block.start : "00:00";
    const end = validTime(block.end) ? block.end : "13:00";
    const days = Array.isArray(block.days) ?
      [...new Set(block.days.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))] :
      [...WEEKDAYS];
    if (!domain || days.length === 0 || (mode === "scheduled" && start === end)) return null;
    return {
      id: typeof block.id === "string" && block.id ? block.id : `site-${domain}`,
      domain, mode, start, end, days, enabled: block.enabled !== false
    };
  }

  function minutes(time) {
    return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
  }

  // Days denote the day an interval starts. Overnight blocks continue into
  // the next morning, even if that next weekday wasn't selected.
  function blockIsActive(block, now = new Date()) {
    if (!block.enabled) return false;
    const day = now.getDay();
    if (block.mode === "always") return block.days.includes(day);
    const current = now.getHours() * 60 + now.getMinutes();
    const start = minutes(block.start);
    const end = minutes(block.end);
    if (start < end) {
      return block.days.includes(day) && current >= start && current < end;
    }
    return (block.days.includes(day) && current >= start) ||
      (block.days.includes((day + 6) % 7) && current < end);
  }

  function matchingSiteBlock(settings, hostname, now = new Date()) {
    if (!settings.enabled) return null;
    return settings.siteBlocks.find((block) =>
      hostnameMatches(hostname, block.domain) && blockIsActive(block, now)) || null;
  }

  function normalizeSettings(value) {
    const input = value && typeof value === "object" ? value : {};
    return {
      enabled: input.enabled !== false,
      pausedHosts: Array.isArray(input.pausedHosts)
        ? input.pausedHosts.filter((h) => typeof h === "string") : [],
      presetOverrides: input.presetOverrides && typeof input.presetOverrides === "object"
        ? { ...input.presetOverrides } : {},
      rules: Array.isArray(input.rules) ? input.rules.filter((rule) =>
        rule && typeof rule === "object" &&
        typeof rule.id === "string" &&
        typeof rule.hostname === "string" &&
        safeSelector(rule.selector)) : [],
      // Missing on upgrade: seed the explicitly requested YouTube morning block once.
      // An explicit empty array means the user deleted it; never restore it.
      siteBlocks: (Array.isArray(input.siteBlocks) ? input.siteBlocks : [DEFAULT_BLOCK])
        .map(normalizeSiteBlock).filter(Boolean).slice(0, 100)
    };
  }

  function activeSelectors(settings, hostname, path) {
    if (!settings.enabled || settings.pausedHosts.includes(hostname)) return [];

    const selectors = PRESETS.filter((preset) =>
      presetAppliesToPage(preset, hostname, path) &&
      (settings.presetOverrides[preset.id] ?? preset.defaultEnabled) === true
    ).flatMap((preset) => preset.selectors);

    for (const rule of settings.rules) {
      if (rule.hostname === hostname && safeSelector(rule.selector)) {
        selectors.push(rule.selector);
      }
    }
    return [...new Set(selectors)];
  }

  globalThis.QuietWeb = Object.freeze({
    PRESETS,
    WEEKDAYS,
    normalizeDomain,
    normalizeSiteBlock,
    blockIsActive,
    matchingSiteBlock,
    hostnameMatches,
    presetAppliesToPage,
    safeSelector,
    normalizeSettings,
    activeSelectors
  });
})();
