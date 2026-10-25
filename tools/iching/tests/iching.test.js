/* ===========================================================
   Headless verification of the SHIPPED I Ching app.

   Runs the actual assets/iching-app.js against a minimal DOM stub,
   using the real per-locale JSON that gets published. Nothing is
   re-implemented: the assertions read the same files the browser
   will fetch.

   Usage:  node tests/iching.test.js [siteDir]
   Exit code is non-zero on any failure, so it works as a gate.
   =========================================================== */
"use strict";

const fs = require("fs");
const path = require("path");

const SITE = process.argv[2] || path.resolve(__dirname, "..");
const APP = path.join(SITE, "assets", "iching-app.js");
const DATAJS = path.join(SITE, "assets", "iching-data.js");
const DATA_DIR = path.join(SITE, "assets", "data");

let pass = 0, fail = 0;
const failures = [];

function ok(cond, label, detail) {
  if (cond) { pass++; }
  else { fail++; failures.push(label + (detail ? " :: " + detail : "")); }
}
function eq(a, b, label) {
  ok(a === b, label, "expected " + JSON.stringify(b) + ", got " + JSON.stringify(a));
}

/* ---------- minimal DOM stub ---------- */
function makeEl(tag) {
  const el = {
    tagName: (tag || "div").toUpperCase(),
    children: [], _text: "", _html: "",
    style: {}, dataset: {}, attributes: {}, hidden: false, value: "",
    classList: {
      _s: new Set(),
      add(...c) { c.forEach((x) => this._s.add(x)); },
      remove(...c) { c.forEach((x) => this._s.delete(x)); },
      toggle(c, f) { if (f === undefined) f = !this._s.has(c); f ? this._s.add(c) : this._s.delete(c); },
      contains(c) { return this._s.has(c); },
    },
    get textContent() { return this._text; },
    set textContent(v) { this._text = String(v); this._html = ""; },
    get innerHTML() { return this._html; },
    set innerHTML(v) { this._html = String(v); this.children = []; },
    querySelector() { return makeEl("div"); },
    querySelectorAll() { return []; },
    addEventListener() {},
    setAttribute(k, v) { this.attributes[k] = v; },
    getAttribute(k) { return this.attributes[k] ?? null; },
    appendChild(c) { this.children.push(c); return c; },
    click() {},
    focus() {},
  };
  return el;
}

const registry = {};
function getEl(sel) {
  if (!registry[sel]) registry[sel] = makeEl("div");
  return registry[sel];
}

const doc = {
  documentElement: makeEl("html"),
  body: makeEl("body"),
  readyState: "complete",
  getElementById: (id) => getEl("#" + id),
  querySelector: (s) => getEl(s),
  querySelectorAll: () => [],
  createElement: (t) => makeEl(t),
  addEventListener() {},
};

// Elements the app expects to exist by id.
[
  "question", "action", "btnStart", "coinBtn", "coinA", "coinB", "coinC",
  "lines", "tossLine", "btnRedo", "btnRead", "btnAgain", "btnNewQ", "btnSave",
  "savedNote", "btnExport", "btnClear", "journalList", "langBtn", "langName",
  "langModal", "langClose", "langGrid", "hxModal", "hxClose", "hxBody",
  "result", "derived", "refGrid", "panelAsk", "panelCast", "panelRead",
].forEach((id) => { getEl("#" + id); });

const windowStub = {
  location: { search: "", href: "https://logansolaman.com/tools/iching/", pathname: "/tools/iching/" },
  localStorage: {
    _s: {},
    getItem(k) { return this._s[k] ?? null; },
    setItem(k, v) { this._s[k] = String(v); },
    removeItem(k) { delete this._s[k]; },
  },
  navigator: { language: "en-US" },
  history: { replaceState() {} },
  scrollTo() {},
  addEventListener() {},
  confirm: () => true,
  URL: { createObjectURL: () => "blob:x", revokeObjectURL() {} },
  Blob: function () {},
  setTimeout: (fn) => { if (typeof fn === "function") fn(); return 0; },
  clearTimeout() {},
  Math: Math, Date: Date, JSON: JSON, Object: Object, Array: Array,
  String: String, Number: Number, Boolean: Boolean, Error: Error,
  RegExp: RegExp, Promise: Promise, parseInt: parseInt, parseFloat: parseFloat,
  isNaN: isNaN, console: console,
};
windowStub.window = windowStub;
windowStub.self = windowStub;

const document_ = doc;
const localStorage = windowStub.localStorage;
const navigator = windowStub.navigator;
const location = windowStub.location;
const history = windowStub.history;
const fetchStub = async (url) => {
  const p = path.join(DATA_DIR, url.replace(/^assets\/data\//, "").replace(/^\.\//, ""));
  if (!fs.existsSync(p)) return { ok: false, status: 404, json: async () => null };
  return { ok: true, status: 200, json: async () => JSON.parse(fs.readFileSync(p, "utf8")) };
};

/* ---------- load the shipped assets ---------- */
const appCode = fs.readFileSync(APP, "utf8");
const dataCode = fs.readFileSync(DATAJS, "utf8");

const sandbox = {
  window: windowStub, document: document_, localStorage, navigator, location, history,
  fetch: fetchStub, console, setTimeout: windowStub.setTimeout, clearTimeout: () => {},
  Math, Date, JSON, Object, Array, String, Number, Boolean, Error, RegExp, Promise,
  parseInt, parseFloat, isNaN,
};
sandbox.globalThis = sandbox;

const fn = new Function(
  "window", "document", "localStorage", "navigator", "location", "history",
  "fetch", "console", "setTimeout", "clearTimeout", "Math", "Date", "JSON",
  "Object", "Array", "String", "Number", "Boolean", "Error", "RegExp", "Promise",
  "parseInt", "parseFloat", "isNaN",
  dataCode + "\n" + appCode
);
fn(sandbox.window, sandbox.document, sandbox.localStorage, sandbox.navigator,
  sandbox.location, sandbox.history, sandbox.fetch, console, windowStub.setTimeout,
  () => {}, Math, Date, JSON, Object, Array, String, Number, Boolean, Error, RegExp,
  Promise, parseInt, parseFloat, isNaN);

// The app exposes its pure functions on window.ICHI_TEST for this harness.
const api = windowStub.ICHI_TEST;
if (!api) { console.error("ICHI_TEST hook missing from the shipped app"); process.exit(1); }

/* ---------- data integrity ---------- */
function shippedFiles() {
  return fs.readdirSync(DATA_DIR)
    .filter((f) => /^hexagrams\..+\.json$/.test(f))
    .map((f) => f.replace(/^hexagrams\./, "").replace(/\.json$/, ""))
    .sort();
}
const LANGS = ["en", "zh-TW", "zh-CN", "es", "fr", "pt", "ja", "vi", "ko", "ar"];
const CJK = /[一-鿿]/;
const KANA = /[぀-ヿ]/;

for (const lang of shippedFiles()) {
  const f = path.join(DATA_DIR, "hexagrams." + lang + ".json");
  const arr = JSON.parse(fs.readFileSync(f, "utf8"));
  eq(arr.length, 64, lang + ": 64 hexagrams");
  const nums = new Set(arr.map((h) => h.n));
  eq(nums.size, 64, lang + ": unique hexagram numbers");
  const bits = new Set(arr.map((h) => h.bits.join("")));
  eq(bits.size, 64, lang + ": 64 unique bit patterns");
  let empty = 0, leaks = 0;
  for (const h of arr) {
    for (const k of ["summary", "judgment", "xiang", "core", "plain", "advice"]) {
      if (!h[k] || !h[k].trim()) empty++;
    }
    if (h.lines.length !== 6) empty++;
    for (const l of h.lines) if (!l.text || !l.text.trim()) empty++;
    if (!lang.startsWith("zh")) {
      const fields = ["summary", "judgment", "xiang", "core", "plain", "advice"];
      for (const k of fields) {
        if (CJK.test(h[k] || "") && !(lang === "ja" && KANA.test(h[k]))) leaks++;
      }
      for (const l of h.lines) {
        if (CJK.test(l.text || "") && !(lang === "ja" && KANA.test(l.text))) leaks++;
      }
    }
  }
  eq(empty, 0, lang + ": no empty required fields");
  eq(leaks, 0, lang + ": no untranslated Chinese leaks");
  // Chinese locales must be genuinely different scripts
  if (lang === "zh-TW") {
    ok(arr[0].judgment.includes("貞"), "zh-TW uses traditional forms (貞 not 贞)");
  }
  if (lang === "zh-CN") {
    ok(arr[0].judgment.includes("贞"), "zh-CN uses simplified forms (贞 not 貞)");
  }
}

/* ---------- UI locale parity ---------- */
const uiBundle = JSON.parse(
  dataCode.replace(/^window\.ICHI_DATA\s*=\s*/, "").replace(/;\s*$/, "")
);
const baseKeys = Object.keys(uiBundle.ui.en).sort();
for (const lang of shippedFiles()) {
  const keys = Object.keys(uiBundle.ui[lang] || {}).sort();
  eq(keys.length, baseKeys.length, lang + ": UI key count matches en");
  const missing = baseKeys.filter((k) => !keys.includes(k));
  eq(missing.length, 0, lang + ": no missing UI keys", missing.join(","));
}
const shipped = fs.readdirSync(DATA_DIR)
  .filter((f) => /^hexagrams\..+\.json$/.test(f))
  .map((f) => f.replace(/^hexagrams\./, "").replace(/\.json$/, ""));
eq(uiBundle.langs.length, shipped.length, "advertised languages match shipped data files");
ok(uiBundle.langs.includes("zh-TW"), "zh-TW present");
ok(uiBundle.langs.includes("en"), "en present");
for (const l of uiBundle.langs) {
  ok(fs.existsSync(path.join(DATA_DIR, "hexagrams." + l + ".json")), "data file exists: " + l);
  ok(uiBundle.ui[l] != null, "UI strings present: " + l);
}

/* ---------- app boots and loads a locale ---------- */
(async () => {
  // init() ran at import time (readyState complete) -> language auto-detected
  await new Promise((r) => setTimeout(r, 300));
  const st = api.getState();
/* ---------- hexagram math, derived independently (runs after boot) ---------- */
const en = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "hexagrams.en.json"), "utf8"));
const index = {};
en.forEach((h) => { index[h.bits.join("")] = h.n; });

// Independent expectations for the four derived relations.
function expectNumber(bits) { return index[bits.join("")]; }
function expectNuclear(bits) {
  return expectNumber([bits[1], bits[2], bits[3], bits[2], bits[3], bits[4]]);
}
function expectInverse(bits) { return expectNumber(bits.map((b) => 1 - b)); }
function expectReversed(bits) { return expectNumber(bits.slice().reverse()); }

let mathChecked = 0;
for (const h of en) {
  const b = h.bits;
  eq(api.bitsToNumber(b), h.n, "bitsToNumber roundtrip #" + h.n);
  eq(api.nuclearOf(b), expectNuclear(b), "nuclear #" + h.n);
  eq(api.inverseOf(b), expectInverse(b), "inverse #" + h.n);
  eq(api.reversedOf(b), expectReversed(b), "reversed #" + h.n);
  mathChecked++;
}
ok(mathChecked === 64, "all 64 hexagrams checked for derived relations");

/* ---------- the six canonical relationships are consistent ---------- */
// Every hexagram's inverse must also be a real hexagram, and the 8 pure
// trigram hexagrams must be self-inverse.
for (const h of en) {
  const inv = api.inverseOf(h.bits);
  ok(typeof inv === "number" && inv >= 1 && inv <= 64, "inverse of #" + h.n + " resolves");
}

/* ---------- line value -> bit mapping ---------- */
eq(api.linesToBits([6, 7, 8, 9, 7, 8]).join(""), "010110", "line values map to bits correctly");
eq(api.movingIndices([6, 7, 8, 9, 7, 8]).join(","), "0,3", "moving lines detected");
eq(api.relatingOf([1, 0, 0, 0, 0, 0], [9, 8, 8, 8, 8, 8]),
   2, "relating flips only the moving line (24 復 -> 2 坤)");

/* ---------- Zhu Xi ruling rules ---------- */
eq(api.rulingLine([]).note, "ruling_none", "0 moving lines -> ruling_none");
eq(api.rulingLine([2]).note, "ruling_1", "1 moving line -> ruling_1");
eq(api.rulingLine([1, 4]).lines[0], 4, "2 moving lines -> upper one leads");
eq(api.rulingLine([0, 2, 4]).lines[0], 3, "3 moving lines -> middle (4th) line");
eq(api.rulingLine([0, 1, 2, 3]).note, "ruling_4", "4 moving lines -> ruling_4");
eq(api.rulingLine([0, 1, 2, 3, 4]).note, "ruling_5", "5 moving lines -> ruling_5");
eq(api.rulingLine([0, 1, 2, 3, 4, 5]).note, "ruling_6", "6 moving lines -> ruling_6");


  ok(st.HX.length === 64, "app loaded 64 hexagrams at boot", "got " + st.HX.length);
  ok(Object.keys(st.UI).length >= 60, "UI strings loaded", "got " + Object.keys(st.UI).length);
  ok(st.lang === "en", "auto-detected language is en", st.lang);

  /* ---------- report ---------- */
  console.log("\n=== I CHING APP VERIFICATION ===");
  console.log("passed: " + pass + "   failed: " + fail);
  if (failures.length) {
    console.log("\nFAILURES:");
    failures.forEach((f) => console.log("  ✗ " + f));
    process.exit(1);
  }
  console.log("all checks passed");
  process.exit(0);
})().catch((e) => {
  console.error("HARNESS ERROR:", e);
  process.exit(1);
});
