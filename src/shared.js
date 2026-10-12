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
        safeSelector(rule.selector)) : []
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
    hostnameMatches,
    presetAppliesToPage,
    safeSelector,
    normalizeSettings,
    activeSelectors
  });
})();
