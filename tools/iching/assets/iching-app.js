/* ===========================================================
   I CHING DECISION — application logic (vanilla JS, no deps)

   The casting engine is the classical three-coin method:
     heads = 3, tails = 2, three coins per toss, six tosses,
     first toss = bottom line (line 1), sixth = top line (line 6).
     6 = old yin (changes to yang)   7 = young yang (stable)
     8 = young yin (stable)          9 = old yang (changes to yin)

   Hexagram relations computed here (not hardcoded):
     primary  = what you cast
     relating = primary with every moving line flipped
     nuclear  = lines 2-3-4 and 3-4-5 stacked
     inverse  = every line flipped
     reversed = the same figure turned upside down

   Ruling-line selection follows Zhu Xi's rules (0-6 moving lines).
   =========================================================== */
(() => {
  "use strict";

  const DATA = window.ICHI_DATA || {};
  const LANGS = DATA.langs || [];
  const RTL = new Set(["ar"]);

  let lang = "en";
  let UI = {};
  let HX = [];           // hexagrams in the active language
  let HX_BY_N = {};

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  /* ---------- state ---------- */
  const state = {
    question: "",
    tosses: [],          // values 6..9, index 0 = line 1
    action: "",
    cast: null,
  };

  const JOURNAL_KEY = "iching_journal_v1";

  /* ---------- i18n ---------- */
  function detectLang() {
    const url = new URLSearchParams(location.search).get("lang");
    if (url && LANGS.includes(url)) return url;
    try {
      const saved = localStorage.getItem("iching_lang");
      if (saved && LANGS.includes(saved)) return saved;
    } catch (e) {}
    const nav = (navigator.language || "en").trim();
    if (LANGS.includes(nav)) return nav;
    const base = nav.split("-")[0];
    if (base === "zh") return /TW|HK|MO/i.test(nav) ? "zh-TW" : "zh-CN";
    const hit = LANGS.find((l) => l.split("-")[0] === base);
    return hit || "en";
  }

  function t(key, vars) {
    let s = UI[key];
    if (s == null) s = DATA.ui && DATA.ui.en ? DATA.ui.en[key] : key;
    if (Array.isArray(s)) s = s.join(" / ");
    if (vars) for (const k in vars) s = s.replace(new RegExp("\\{" + k + "\\}", "g"), vars[k]);
    return s;
  }

  async function loadLang(code) {
    lang = code;
    const ui = (DATA.ui && DATA.ui[code]) || (DATA.ui && DATA.ui.en) || {};
    UI = ui;
    document.documentElement.lang = code;
    document.documentElement.dir = RTL.has(code) ? "rtl" : "ltr";
    try { localStorage.setItem("iching_lang", code); } catch (e) {}
    const u = new URL(location.href);
    if (code === "en") u.searchParams.delete("lang"); else u.searchParams.set("lang", code);
    history.replaceState({}, "", u);
    applyStatic();
    renderLangMenu();

    // Hexagram text is ~200 KB per language — fetch it on demand rather than
    // shipping all ten in one bundle. Mark the page as loading so the
    // previous language's reading is not mistaken for the new one.
    document.body.dataset.loading = "1";
    const path = "assets/data/hexagrams." + code + ".json";
    try {
      const r = await fetch(path, { cache: "no-cache" });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const arr = await r.json();
      HX = Array.isArray(arr) ? arr : [];
    } catch (e) {
      // fall back to English if a locale file is missing
      try {
        const r = await fetch("assets/data/hexagrams.en.json", { cache: "no-cache" });
        HX = await r.json();
      } catch (e2) {
        HX = [];
      }
    }
    HX_BY_N = {};
    HX.forEach((h) => { HX_BY_N[h.n] = h; });
    reindex();
    buildRefGrid();
    if (state.cast) renderResult();
    renderJournal();
    delete document.body.dataset.loading;
  }

  function applyStatic() {
    $$("[data-i18n]").forEach((el) => {
      const k = el.getAttribute("data-i18n");
      const v = UI[k];
      if (v == null) return;
      if (Array.isArray(v)) { el.textContent = ""; return; }
      el.textContent = v;
    });
    $$("[data-i18n-attr]").forEach((el) => {
      el.getAttribute("data-i18n-attr").split(";").forEach((pair) => {
        const [attr, key] = pair.split(":");
        const val = UI[key];
        if (attr && val != null) el.setAttribute(attr, val);
      });
    });
    const ln = $("#langName");
    if (ln) ln.textContent = (DATA.langLabels && DATA.langLabels[lang]) || lang.toUpperCase();
  }

  /* ---------- hexagram math ---------- */
  // bits[0] = line 1 (bottom). 1 = yang (solid), 0 = yin (broken).
  function linesToBits(lines) {
    return lines.map((v) => {
      if (v === 7 || v === 9) return 1;
      return 0;
    });
  }

  function bitsToHex(bits) {
    const key = bits.join("");
    return HX_BY_N[bitsToNumber(bits)] || null;
  }

  // Lookup from line-bits -> hexagram number, rebuilt whenever the locale
  // data loads (each locale carries the same 64 bit patterns).
  let BITS_INDEX = {};

  function reindex() {
    BITS_INDEX = {};
    HX.forEach((h) => { BITS_INDEX[(h.bits || []).join("")] = h.n; });
  }

  function bitsToNumber(bits) { return BITS_INDEX[bits.join("")]; }

  function nuclearOf(bits) {
    // lower trigram = lines 2,3,4 ; upper trigram = lines 3,4,5
    const lower = [bits[1], bits[2], bits[3]];
    const upper = [bits[2], bits[3], bits[4]];
    return bitsToNumber(lower.concat(upper));
  }

  // 錯卦 (inverse): every line's polarity flips, order unchanged.
  function inverseOf(bits) { return bitsToNumber(bits.map((b) => 1 - b)); }

  // 綜卦 (reversed): the figure turned upside down. The ORDER of the six
  // lines is reversed (初↔上, 二↔五, 三↔四) and each line KEEPS its
  // polarity. Verified against the classical eight self-opposite
  // hexagrams: 乾坤坎離頤大過小過中孚 — reversing the order alone
  // reproduces exactly that set.
  function reversedOf(bits) { return bitsToNumber(bits.slice().reverse()); }

  function relatingOf(bits, tosses) {
    const out = bits.slice();
    tosses.forEach((v, i) => {
      if (v === 6) out[i] = 1;      // old yin -> yang
      if (v === 9) out[i] = 0;      // old yang -> yin
    });
    return bitsToNumber(out);
  }

  function movingIndices(tosses) {
    const out = [];
    tosses.forEach((v, i) => { if (v === 6 || v === 9) out.push(i); });
    return out;
  }

  /* Zhu Xi's rules: which line(s) to read, given the moving lines. */
  function rulingLine(moving) {
    const n = moving.length;
    if (n === 0) return { lines: [], note: "ruling_none" };
    if (n === 1) return { lines: [moving[0]], note: "ruling_1" };
    if (n === 2) return { lines: [moving[1]], note: "ruling_2" };   // upper leads
    if (n === 3) return { lines: [3], note: "ruling_3" };           // middle line (4th)
    if (n === 4) return { lines: null, note: "ruling_4" };          // handled in relating
    if (n === 5) return { lines: null, note: "ruling_5" };
    return { lines: null, note: "ruling_6" };
  }

  /* ---------- casting ---------- */
  function toss() {
    let sum = 0;
    const faces = [];
    for (let i = 0; i < 3; i++) {
      const head = Math.random() < 0.5;
      faces.push(head);
      sum += head ? 3 : 2;
    }
    return { sum, faces };
  }

  function castAll() {
    state.tosses = [];
    state.cast = null;
    let i = 0;
    const step = () => {
      if (i >= 6) { finishCast(); return; }
      const { sum, faces } = toss();
      state.tosses.push(sum);
      paintCoin(i, faces);
      paintLine(i, sum);
      i++;
      $("#tossLine").textContent = t("toss_line", { n: i });
      setTimeout(step, 420);
    };
    $("#tossLine").textContent = t("toss_line", { n: 1 });
    step();
  }

  function paintCoin(idx, faces) {
    const ids = ["#coinA", "#coinB", "#coinC"];
    const el = $(ids[idx]);
    if (!el) return;
    el.classList.add("spin");
    const i = el.querySelector("i");
    if (i) i.style.transform = faces[idx] ? "rotateY(0deg)" : "rotateY(180deg)";
    setTimeout(() => el.classList.remove("spin"), 320);
  }

  function buildLineSlots() {
    const ol = $("#lines");
    ol.innerHTML = "";
    for (let i = 5; i >= 0; i--) {           // render top line first
      const li = document.createElement("li");
      li.id = "line" + i;
      li.innerHTML =
        '<span class="lp">' + (UI.line_pos ? UI.line_pos[i] : i + 1) + "</span>" +
        '<span class="lbar"><i class="h"></i><i class="h"></i></span>' +
        '<span class="lmark"></span>';
      ol.appendChild(li);
    }
  }

  function paintLine(idx, val) {
    const li = $("#line" + idx);
    if (!li) return;
    const yang = val === 7 || val === 9;
    const moving = val === 6 || val === 9;
    const bars = li.querySelectorAll(".lbar i");
    // A yang line is one solid bar; a yin line is two halves.
    if (yang) {
      bars[0].className = "h";
      bars[1].style.display = "none";
    } else {
      bars[0].className = "";
      bars[0].style.width = "calc(50% - 3px)";
      bars[1].style.display = "block";
      bars[1].style.width = "calc(50% - 3px)";
    }
    li.classList.toggle("moving", moving);
    li.classList.add("fresh");
    setTimeout(() => li.classList.remove("fresh"), 320);
    const mark = li.querySelector(".lmark");
    mark.textContent = moving ? t("moving") : t("static");
  }

  function finishCast() {
    const bits = linesToBits(state.tosses);
    const n = bitsToNumber(bits);
    const hx = HX_BY_N[n];
    if (!hx) {
      $("#tossLine").textContent = t("error");
      return;
    }
    const moving = movingIndices(state.tosses);
    state.cast = {
      question: state.question,
      at: new Date().toISOString(),
      tosses: state.tosses.slice(),
      bits,
      n,
      moving,
      relating: relatingOf(bits, state.tosses),
      nuclear: nuclearOf(bits),
      inverse: inverseOf(bits),
      reversed: reversedOf(bits),
    };
    $("#btnRedo").hidden = false;
    $("#btnRead").hidden = false;
    $("#tossLine").textContent = "";
  }

  /* ---------- rendering the reading ---------- */
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function trigramLabel(name, nature, side) {
    return "<div class=\"" + side + "\"><b>" + esc(name) + "</b>" + esc(nature) + "</div>";
  }

  function lineRow(hx, i, moving) {
    const l = hx.lines[i];
    if (!l) return "";
    const pos = UI.line_pos ? UI.line_pos[i] : (i + 1) + "";
    const mark = moving ? " · " + t("moving") : "";
    return (
      '<li class="' + (moving ? "moving" : "") + '">' +
        '<div class="rp"><span>' + esc(pos) + mark + "</span>" +
        (l.pos ? "<span>" + esc(l.pos) + "</span>" : "") + "</div>" +
        '<div class="rt">' + esc(l.text) + "</div>" +
        (l.image ? '<div class="ri">' + esc(l.image) + "</div>" : "") +
      "</li>"
    );
  }

  function renderResult() {
    const c = state.cast;
    if (!c) return;
    const hx = HX_BY_N[c.n];
    const rel = HX_BY_N[c.relating];
    const rul = rulingLine(c.moving);

    let html = "";

    /* --- primary hexagram --- */
    html += '<div class="result">';
    html += '<div class="rhead">';
    html += '<div class="rglyph">' + esc(hx.glyph) + "</div>";
    html += '<div class="rmeta">';
    html += '<div class="rnum">HEXAGRAM ' + String(hx.n).padStart(2, "0") + " / 64</div>";
    html += '<h2 class="rname">' + esc(hx.name) + "</h2>";
    html += '<div class="ren">' + esc(hx.en) + "</div>";
    html += "</div></div>";
    html += '<p class="rsum">' + esc(hx.summary) + "</p>";
    html += '<div class="rtri">' +
      trigramLabel(hx.upper, hx.upperNature, "up") +
      trigramLabel(hx.lower, hx.lowerNature, "lo") +
      "</div>";

    /* ruling line note */
    html += '<div class="ruling">' + esc(t("ruling") + ": " + t(rul.note)) + "</div>";

    /* judgment */
    html += '<div class="rblock"><h3>' + esc(t("judgment")) + "</h3>";
    html += '<p class="zh">' + esc(hx.judgment) + "</p>";
    if (hx.tuan) html += '<p class="en">' + esc(hx.tuan) + "</p>";
    html += "</div>";

    /* image */
    html += '<div class="rblock"><h3>' + esc(t("image")) + "</h3>";
    html += '<p class="zh">' + esc(hx.xiang) + "</p>";
    html += "</div>";

    /* meaning */
    html += '<div class="rblock"><h3>' + esc(t("meaning")) + "</h3>";
    html += '<p class="en">' + esc(hx.core) + "</p>";
    if (hx.plain) html += '<p class="en">' + esc(hx.plain) + "</p>";
    html += "</div>";

    /* the six lines */
    html += '<div class="rblock"><h3>' + esc(t("lines")) + "</h3><ul class=\"rlines\">";
    for (let i = 0; i < 6; i++) html += lineRow(hx, i, c.moving.includes(i));
    html += "</ul></div>";

    /* advice */
    html += '<div class="radv"><h3>' + esc(t("advice")) + "</h3><p>" + esc(hx.advice) + "</p></div>";
    html += "</div>";

    $("#result").innerHTML = html;

    /* --- derived hexagrams --- */
    let d = "";
    d += derivedCard("relating", rel, t("relating_hint"), "dcard--rel");
    d += derivedCard("nuclear", HX_BY_N[c.nuclear], t("nuclear_hint"), "");
    d += derivedCard("inverse", HX_BY_N[c.inverse], t("inverse_hint"), "");
    d += derivedCard("reversed", HX_BY_N[c.reversed], t("reversed_hint"), "");
    $("#derived").innerHTML = d;

    /* highlight visited hexagrams in the reference grid */
    $$(".refcell").forEach((el) => {
      el.classList.toggle("hit", [c.n, c.relating, c.nuclear, c.inverse, c.reversed].includes(Number(el.dataset.n)));
    });
  }

  function derivedCard(kind, hx, hint, cls) {
    if (!hx) return "";
    let s = '<div class="dcard ' + cls + '">';
    s += '<div class="dcard__k"><b>' + esc(t(kind)) + "</b><span>" + esc(hint) + "</span></div>";
    s += '<div class="dcard__n"><i>' + esc(hx.glyph) + "</i>" + esc(hx.name) +
         "<em>" + esc(hx.en) + "</em></div>";
    s += '<p class="zh">' + esc(hx.xiang) + "</p>";
    s += '<p>' + esc(hx.summary) + "</p>";
    s += "</div>";
    return s;
  }

  /* ---------- reference grid ---------- */
  function buildRefGrid() {
    const g = $("#refGrid");
    if (!g) return;
    g.innerHTML = "";
    HX.slice().sort((a, b) => a.n - b.n).forEach((h) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "refcell";
      b.dataset.n = h.n;
      b.textContent = h.glyph;
      b.setAttribute("aria-label", h.name);
      b.addEventListener("click", () => openHex(h.n));
      g.appendChild(b);
    });
  }

  function openHex(n) {
    const hx = HX_BY_N[n];
    if (!hx) return;
    let h = '<div class="rhead">';
    h += '<div class="rglyph">' + esc(hx.glyph) + "</div><div class=\"rmeta\">";
    h += '<div class="rnum">HEXAGRAM ' + String(hx.n).padStart(2, "0") + " / 64</div>";
    h += '<h2 class="rname">' + esc(hx.name) + "</h2>";
    h += '<div class="ren">' + esc(hx.en) + "</div></div></div>";
    h += '<p class="rsum">' + esc(hx.summary) + "</p>";
    h += '<div class="rtri">' + trigramLabel(hx.upper, hx.upperNature, "up") +
         trigramLabel(hx.lower, hx.lowerNature, "lo") + "</div>";
    h += '<div class="rblock"><h3>' + esc(t("judgment")) + '</h3><p class="zh">' + esc(hx.judgment) + "</p>";
    if (hx.tuan) h += '<p class="en">' + esc(hx.tuan) + "</p></div>";
    h += '<div class="rblock"><h3>' + esc(t("image")) + '</h3><p class="zh">' + esc(hx.xiang) + "</p></div>";
    h += '<div class="rblock"><h3>' + esc(t("meaning")) + '</h3><p class="en">' + esc(hx.core) + "</p>";
    if (hx.plain) h += '<p class="en">' + esc(hx.plain) + "</p></div>";
    h += '<div class="rblock"><h3>' + esc(t("lines")) + '</h3><ul class="rlines">';
    for (let i = 0; i < 6; i++) h += lineRow(hx, i, false);
    h += "</ul></div>";
    h += '<div class="radv"><h3>' + esc(t("advice")) + "</h3><p>" + esc(hx.advice) + "</p></div>";
    $("#hxBody").innerHTML = h;
    $("#hxModal").hidden = false;
  }

  /* ---------- journal ---------- */
  function readJournal() {
    try { return JSON.parse(localStorage.getItem(JOURNAL_KEY) || "[]"); }
    catch (e) { return []; }
  }
  function writeJournal(list) {
    try { localStorage.setItem(JOURNAL_KEY, JSON.stringify(list)); } catch (e) {}
  }

  function renderJournal() {
    const list = readJournal();
    const box = $("#journalList");
    if (!list.length) {
      box.innerHTML = '<p class="jempty">' + esc(t("journal_empty")) + "</p>";
      return;
    }
    box.innerHTML = list.map((e, i) => {
      const hx = HX.find((h) => h.n === e.n);
      return '<div class="jentry">' +
        '<button class="jentry__del" data-del="' + i + '" aria-label="' + esc(t("delete")) + '">&times;</button>' +
        '<p class="jentry__q">' + esc(e.question || "—") + "</p>" +
        '<p class="jentry__m">#' + String(e.n).padStart(2, "0") + " · " +
          esc(e.at || "") + (hx ? " · " + esc(hx.name) : "") + "</p>" +
        (e.action ? '<p class="jentry__a">→ ' + esc(e.action) + "</p>" : "") +
        "</div>";
    }).join("");
    $$("[data-del]", box).forEach((b) => {
      b.addEventListener("click", () => {
        const l = readJournal();
        l.splice(Number(b.dataset.del), 1);
        writeJournal(l);
        renderJournal();
      });
    });
  }

  function saveCast() {
    if (!state.cast) return;
    const list = readJournal();
    list.unshift({
      question: state.question,
      action: $("#action").value.trim(),
      at: new Date().toISOString(),
      n: state.cast.n,
      tosses: state.cast.tosses,
      moving: state.cast.moving,
      relating: state.cast.relating,
    });
    writeJournal(list);
    $("#savedNote").hidden = false;
    renderJournal();
  }

  function exportJournal() {
    const list = readJournal();
    const blob = new Blob([JSON.stringify(list, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "iching-journal.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  /* ---------- language menu ---------- */
  function renderLangMenu() {
    const g = $("#langGrid");
    if (!g) return;
    g.innerHTML = "";
    LANGS.forEach((code) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "langopt" + (code === lang ? " is-active" : "");
      b.setAttribute("role", "option");
      b.setAttribute("aria-selected", code === lang ? "true" : "false");
      const nm = (DATA.langNames && DATA.langNames[code]) || null;
      const native = nm && nm[0] ? nm[0] : code;
      const english = nm && nm[1] ? nm[1] : code;
      b.innerHTML = "<b>" + esc(native) + "</b><span>" + esc(english) + "</span>";
      b.addEventListener("click", () => {
        loadLang(code);
        $("#langModal").hidden = true;
      });
      g.appendChild(b);
    });
  }

  /* ---------- panel switching ---------- */
  function show(id) {
    ["panelAsk", "panelCast", "panelRead"].forEach((p) => {
      const el = $("#" + p);
      if (el) el.hidden = p !== id;
    });
    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  }

  /* ---------- wiring ---------- */
  function init() {

    $("#btnStart").addEventListener("click", () => {
      state.question = $("#question").value.trim();
      state.tosses = [];
      buildLineSlots();
      $("#coinA").querySelector("i").style.transform = "rotateY(0deg)";
      $("#coinB").querySelector("i").style.transform = "rotateY(0deg)";
      $("#coinC").querySelector("i").style.transform = "rotateY(0deg)";
      $("#btnRedo").hidden = true;
      $("#btnRead").hidden = true;
      $("#castQuestion").textContent = state.question || "—";
      show("panelCast");
      castAll();
    });

    $("#coinBtn").addEventListener("click", () => {
      if (state.tosses.length >= 6) return;
      buildLineSlots();
      state.tosses = [];
      state.cast = null;
      $("#btnRedo").hidden = true;
      $("#btnRead").hidden = true;
      castAll();
    });

    $("#btnRedo").addEventListener("click", () => {
      buildLineSlots();
      state.tosses = [];
      state.cast = null;
      $("#btnRedo").hidden = true;
      $("#btnRead").hidden = true;
      castAll();
    });

    $("#btnRead").addEventListener("click", () => {
      renderResult();
      show("panelRead");
    });

    $("#btnAgain").addEventListener("click", () => {
      buildLineSlots();
      state.tosses = [];
      state.cast = null;
      $("#savedNote").hidden = true;
      $("#btnRedo").hidden = true;
      $("#btnRead").hidden = true;
      $("#castQuestion").textContent = state.question || "—";
      show("panelCast");
      castAll();
    });

    $("#btnNewQ").addEventListener("click", () => {
      state.cast = null;
      state.tosses = [];
      $("#question").value = "";
      $("#action").value = "";
      $("#savedNote").hidden = true;
      show("panelAsk");
    });

    $("#btnSave").addEventListener("click", saveCast);
    $("#btnExport").addEventListener("click", exportJournal);
    $("#btnClear").addEventListener("click", () => {
      if (confirm(t("confirm_clear"))) { writeJournal([]); renderJournal(); }
    });

    $("#langBtn").addEventListener("click", () => { $("#langModal").hidden = false; });
    $("#langClose").addEventListener("click", () => { $("#langModal").hidden = true; });
    $("#hxClose").addEventListener("click", () => { $("#hxModal").hidden = true; });
    $$(".modal").forEach((m) => {
      m.addEventListener("click", (e) => { if (e.target === m) m.hidden = true; });
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { $("#langModal").hidden = true; $("#hxModal").hidden = true; }
    });

    buildRefGrid();
    renderJournal();
    // start with both modals closed regardless of markup state
    $("#langModal").hidden = true;
    $("#hxModal").hidden = true;
    loadLang(detectLang());
  }

  /* Expose the pure functions for the headless test harness in tests/.
     Read-only introspection; the app does not depend on it. */
  window.ICHI_TEST = {
    linesToBits, bitsToNumber, nuclearOf, inverseOf, reversedOf, relatingOf,
    movingIndices, rulingLine,
    bitsIndex: () => BITS_INDEX,
    getState: () => ({ state, HX, HX_BY_N, UI, lang }),
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
