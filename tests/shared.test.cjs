const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const context = { globalThis: {} };
const source = fs.readFileSync(path.join(__dirname, '../src/shared.js'), 'utf8');
vm.runInNewContext(source, context);
const { PRESETS, hostnameMatches, normalizeSettings, activeSelectors, presetAppliesToPage, safeSelector } = context.globalThis.QuietWeb;
const settings = () => normalizeSettings();

test('subdomain matching is bounded by dot', () => {
  assert.equal(hostnameMatches('www.youtube.com', 'youtube.com'), true);
  assert.equal(hostnameMatches('notyoutube.com', 'youtube.com'), false);
  assert.equal(hostnameMatches('youtube.com.evil.org', 'youtube.com'), false);
});

test('LinkedIn preset only applies on feed URLs', () => {
  const feed = PRESETS.find(p => p.id === 'linkedin-feed');
  assert.equal(presetAppliesToPage(feed, 'www.linkedin.com', '/feed/'), true);
  assert.equal(presetAppliesToPage(feed, 'www.linkedin.com', '/in/someone'), false);
  assert.equal(presetAppliesToPage(feed, 'example.com', '/feed/'), false);
});

test('YouTube home and watch recommendations are scoped by path', () => {
  const home = activeSelectors(settings(), 'www.youtube.com', '/');
  const watch = activeSelectors(settings(), 'www.youtube.com', '/watch');
  const search = activeSelectors(settings(), 'www.youtube.com', '/results');
  assert(home.some(s => s.includes('ytd-rich-grid-renderer')));
  assert(!watch.some(s => s.includes('ytd-rich-grid-renderer')));
  assert(watch.some(s => s.includes('#related')));
  assert(!search.some(s => s.includes('#related')));
});

test('host pause and global switch disable filtering', () => {
  const paused = settings();
  paused.pausedHosts.push('www.youtube.com');
  assert.equal(activeSelectors(paused, 'www.youtube.com', '/watch').length, 0);
  const off = settings();
  off.enabled = false;
  assert.equal(activeSelectors(off, 'www.linkedin.com', '/feed/').length, 0);
});

test('custom rule stays on the hostname where it was picked', () => {
  const s = settings();
  s.rules.push({id:'1', hostname:'example.com', selector:'.sidebar'});
  assert(activeSelectors(s, 'example.com', '/').includes('.sidebar'));
  assert(!activeSelectors(s, 'sub.example.com', '/').includes('.sidebar'));
});

test('presets can be turned off and malformed selectors are refused', () => {
  const s = settings();
  s.presetOverrides['linkedin-feed'] = false;
  assert.equal(activeSelectors(s, 'www.linkedin.com', '/feed/').length, 0);
  assert.equal(safeSelector('.a { color:red }'), false);
  assert.equal(safeSelector('.safe'), true);
});
