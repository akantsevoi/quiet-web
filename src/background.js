(() => {
  "use strict";
  const { normalizeSettings, blockIsActive } = globalThis.QuietWeb;
  const ALARM_NAME = "quiet-web-schedule-sync";
  let queue = Promise.resolve();

  // Declarative Net Request blocks the top-level HTTP(S) navigation, rather
  // than merely concealing the page. These dynamic rules survive a restart.
  async function syncRules() {
    const stored = await browser.storage.local.get("settings");
    const settings = normalizeSettings(stored.settings);
    const now = new Date(); // Browser's LOCAL timezone, including DST.
    const activeDomains = [...new Set(settings.enabled
      ? settings.siteBlocks.filter((block) => blockIsActive(block, now)).map((b) => b.domain)
      : [])];

    const desired = activeDomains.map((domain, i) => ({
      id: i + 1,
      priority: 1,
      action: { type: "block" },
      condition: {
        urlFilter: `||${domain}^`,
        resourceTypes: ["main_frame", "sub_frame"]
      }
    }));
    const current = await browser.declarativeNetRequest.getDynamicRules();
    const serialize = (rules) => rules.map((r) => `${r.id}:${r.condition.urlFilter}`).sort().join("|");
    if (serialize(current) !== serialize(desired)) {
      await browser.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: current.map((rule) => rule.id),
        addRules: desired
      });
    }
  }

  function queueSync() {
    queue = queue.catch(() => {}).then(syncRules).catch((error) =>
      console.error("Quiet Web: failed to update network blocking rules", error)
    );
    return queue;
  }

  async function scheduleAlarm() {
    // Align checks with wall-clock minute changes, then recheck each minute.
    // Browser alarms may be delayed on suspended machines.
    const now = Date.now();
    const nextMinute = now + (60000 - (now % 60000)) + 150;
    await browser.alarms.create(ALARM_NAME, {
      when: nextMinute,
      periodInMinutes: 1
    });
  }

  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_NAME) queueSync();
  });
  browser.runtime.onInstalled.addListener(() => {
    scheduleAlarm().catch(console.error);
    queueSync();
  });
  browser.runtime.onStartup.addListener(() => {
    scheduleAlarm().catch(console.error);
    queueSync();
  });
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.settings) queueSync();
  });

  // Event pages can be unloaded and restored. Re-establish alarm on load.
  scheduleAlarm().catch(console.error);
  queueSync();
})();
