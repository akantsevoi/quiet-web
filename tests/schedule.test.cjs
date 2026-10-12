const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

const context = { globalThis: {}, URL };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../src/shared.js"),"utf8"),context);
const {normalizeDomain, normalizeSettings, blockIsActive, matchingSiteBlock} = context.globalThis.QuietWeb;
const date = (weekday, hh, mm=0) => {
  // Oct 11, 2026 is Sunday, in runtime-local timezone.
  return new Date(2026,9,11+weekday,hh,mm);
};

test("default block is YouTube from midnight through 12:59 local time",()=>{
  const s=normalizeSettings();
  assert.equal(s.siteBlocks.length,1);
  assert.equal(s.siteBlocks[0].domain,"youtube.com");
  assert.equal(s.siteBlocks[0].start,"00:00");
  assert.equal(s.siteBlocks[0].end,"13:00");
  assert.equal(blockIsActive(s.siteBlocks[0],date(1,12,59)),true);
  assert.equal(blockIsActive(s.siteBlocks[0],date(1,13,0)),false);
});

test("removed default does not reappear",()=>{
  assert.equal(normalizeSettings({siteBlocks:[]}).siteBlocks.length,0);
});

test("domain normalization rejects invalid and attacker-controlled URLs",()=>{
  assert.equal(normalizeDomain("https://www.youtube.com/watch?v=12"),"www.youtube.com");
  assert.equal(normalizeDomain("youtube.com"),"youtube.com");
  assert.equal(normalizeDomain("youtube.com.evil.org"),"youtube.com.evil.org");
  assert.equal(normalizeDomain("https://user:pass@youtube.com"),null);
  assert.equal(normalizeDomain("localhost"),null);
  assert.equal(normalizeDomain("https://youtube.com:8080"),null);
});

test("domain suffix matching avoids lookalikes and handles subdomains",()=>{
  const s=normalizeSettings();
  assert.ok(matchingSiteBlock(s,"music.youtube.com",date(1,9)));
  assert.equal(matchingSiteBlock(s,"notyoutube.com",date(1,9)),null);
});

test("overnight interval uses day the block starts",()=>{
  const b={enabled:true,mode:"scheduled",start:"22:00",end:"06:00",days:[1]};
  assert.equal(blockIsActive(b,date(1,23)),true);
  assert.equal(blockIsActive(b,date(2,5)),true);
  assert.equal(blockIsActive(b,date(2,6)),false);
  assert.equal(blockIsActive(b,date(1,5)),false);
});

test("all-day block applies to selected days",()=>{
  const b={enabled:true,mode:"always",days:[1,2]};
  assert.equal(blockIsActive(b,date(1,19)),true);
  assert.equal(blockIsActive(b,date(3,19)),false);
});

test("global pause disables scheduled website blocking",()=>{
  const s=normalizeSettings({enabled:false});
  assert.equal(matchingSiteBlock(s,"youtube.com",date(1,10)),null);
});
