/* ============================================================
   LOGAN SOLAMAN — interaction engine
   Boot sequence · matrix rain · terminal · keyboard protocol ·
   themes · GSAP scroll reveals · magnetic buttons.
   ============================================================ */
(() => {
  "use strict";
  document.documentElement.classList.add("js");

  // Wait for the i18n engine to finish loading the active locale before
  // reading any JS-side strings (boot log, typewriter, terminal output).
  const begin = () => {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const THEMES = ["matrix", "synth", "vapor"];
  const THEME_NAMES = { matrix: "MATRIX", synth: "SYNTHWAVE", vapor: "VAPORWAVE" };
  let themeIdx = 0;
  let matrixOn = true;

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];

  /* ================= CLOCK ================= */
  const clockEl = $("#clock");
  const tick = () => {
    if (!clockEl) return;
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    clockEl.textContent = `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  };
  tick();
  setInterval(tick, 1000);

  /* ================= MATRIX RAIN ================= */
  const canvas = $("#matrix");
  const ctx = canvas ? canvas.getContext("2d") : null;
  let drops = [], cols = 0;
  const FONT = 15;
  const KATAKANA = "ｱｧｶｻﾀﾅﾊﾏﾔｬﾗﾜｶﾞｻﾞﾀﾞﾊﾞﾊﾟｲｨｷｼﾁﾆﾋﾐﾘｳｩｸｽﾂﾇﾌﾑﾕｭﾙｴｪｹｾﾃﾈﾍﾒﾚｵｫｺｿﾄﾉﾎﾓﾖｮﾛｦ0123456789LOGANSHOPIFY";

  function sizeCanvas() {
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    cols = Math.floor(canvas.width / FONT);
    drops = Array.from({ length: cols }, () => Math.floor(Math.random() * (canvas.height / FONT)) - 20);
  }
  sizeCanvas();
  window.addEventListener("resize", sizeCanvas);

  function neon() {
    return getComputedStyle(document.documentElement).getPropertyValue("--neon").trim() || "#33FF00";
  }

  function drawRain() {
    if (!ctx || !matrixOn) return;
    ctx.fillStyle = "rgba(0,0,0,0.08)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = neon();
    ctx.font = FONT + "px monospace";
    for (let i = 0; i < drops.length; i++) {
      const ch = KATAKANA.charAt(Math.floor(Math.random() * KATAKANA.length));
      const x = i * FONT;
      const y = drops[i] * FONT;
      if (y > 0) ctx.fillText(ch, x, y);
      if (y > canvas.height && Math.random() > 0.975) drops[i] = 0;
      drops[i]++;
    }
  }
  if (!reduced) {
    for (let i = 0; i < 220; i++) drawRain(); // prewarm
    setInterval(drawRain, 40);
  }

  /* ================= BOOT SEQUENCE ================= */
  const boot = $("#boot");
  const bootLog = $("#bootLog");
  const bootLines = (window.I18N ? I18N.arr("js.boot") : []).length
    ? I18N.arr("js.boot")
    : [
    "SOLAMAN-CLASS PERSONAL SITE v3.0 — BIOS OK",
    "MEM CHECK ............ 64K OK",
    "LOADING LOGAN.SYS ... [████████████] 100%",
    "MOUNTING /portfolio ... done",
    "MOUNTING /cases ....... done",
    "MOUNTING /armory ...... 50 tools found",
    "DECRYPTING MANIFESTO .. ok",
    "VHS TRACKING .......... aligned",
    "NEON GRID ............. online",
    "",
    "WELCOME, OPERATOR.",
  ];

  let bootDone = false;
  function finishBoot() {
    if (bootDone) return;
    bootDone = true;
    boot.classList.add("is-done");
    setTimeout(() => boot.remove(), 700);
    document.body.classList.add("booted");
  }

  if (reduced) {
    finishBoot();
  } else {
    let li = 0;
    const typeBoot = () => {
      if (li >= bootLines.length) { setTimeout(finishBoot, 420); return; }
      bootLog.textContent += bootLines[li] + "\n";
      li++;
      setTimeout(typeBoot, li === bootLines.length ? 300 : 130 + Math.random() * 160);
    };
    typeBoot();
    window.addEventListener("keydown", (e) => {
      if (!bootDone && (e.key === " " || e.key === "Enter")) { e.preventDefault(); finishBoot(); }
    }, { once: false });
  }

  /* ================= TYPEWRITER ================= */
  const twEl = $("#typewriter");
  const twWords = (window.I18N ? I18N.arr("js.typewriter") : []).length
    ? I18N.arr("js.typewriter")
    : ["THE STORE ARCHITECT", "SHOPIFY ENGINEER", "GROWTH SYSTEMS DESIGNER", "10 YEARS · ZERO FLUFF"];
  if (twEl && !reduced) {
    let wi = 0, ci = twWords[0].length, deleting = false;
    const step = () => {
      const word = twWords[wi];
      if (!deleting) {
        ci++;
        if (ci >= word.length) { ci = word.length; deleting = true; setTimeout(step, 2400); twEl.textContent = word; return; }
      } else {
        ci--;
        if (ci <= 0) { ci = 0; deleting = false; wi = (wi + 1) % twWords.length; }
      }
      twEl.textContent = word.slice(0, ci);
      setTimeout(step, deleting ? 34 : 74);
    };
    setTimeout(step, 2600);
  }

  /* ================= TERMINAL ================= */
  const cmdInput = $("#cmd");
  const cmdOut = $("#cmdOut");
  const cmdHint = $("#cmdHint");

  const SECTIONS = { home: 1, about: 2, services: 3, cases: 4, tools: 5, process: 6, contact: 7 };

  function gotoSection(id) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  }

  function themeDelta(d) {
    themeIdx = (themeIdx + d + THEMES.length) % THEMES.length;
    const name = THEMES[themeIdx];
    document.documentElement.dataset.theme = name;
    const tn = $("#themeName");
    if (tn) tn.textContent = THEME_NAMES[name];
    return `theme → ${THEME_NAMES[name]}`;
  }

  function konami() {
    document.documentElement.dataset.theme = "synth";
    const tn = $("#themeName");
    if (tn) tn.textContent = "SYNTHWAVE";
    cmdOut.innerHTML = "⚡ KONAMI ACCEPTED — 30 LIVES GRANTED. SYNTHWAVE UNLOCKED. ⚡";
    if (window.gsap) {
      gsap.fromTo(".hero__name", { rotation: -1 }, { rotation: 0, duration: 0.6, ease: "elastic.out(1,0.3)" });
    }
  }

  const TT = (k, fb) => {
    // Prefer the translated string, but never show the raw key: if i18n
    // hasn't loaded (or the key is missing) fall back to the inline English.
    if (window.I18N) {
      const v = I18N.t(k);
      if (v && v !== k) return v;
    }
    return fb || k;
  };
  const COMMANDS = {
    help: () => TT("js.cmd.help", "commands: about · services · cases · tools · dashboard · process · contact · theme · grid · rain · glitch · clear · sudo hire-me"),
    about: () => { gotoSection("about"); return "opening FILE 02 / MANIFESTO …"; },
    services: () => { gotoSection("services"); return "opening FILE 03 / SYSTEM MODULES …"; },
    cases: () => { gotoSection("cases"); return "opening FILE 04 / MISSION ARCHIVE …"; },
    tools: () => { window.location.href = "tools/"; return "opening THE ARMORY — 50 free merchant tools …"; },
    dashboard: () => { window.location.href = "/dashboard/"; return "opening EVERYTHING DASH — live markets · news archive · fx · commodities …"; },
    process: () => { gotoSection("process"); return "opening FILE 06 / PROTOCOL …"; },
    contact: () => { gotoSection("contact"); return "opening FILE 07 / OPEN CHANNEL …"; },
    home: () => { gotoSection("home"); return "returning to terminal …"; },
    root: () => { gotoSection("home"); return "cd ~ … you are here."; },
    theme: () => themeDelta(1),
    grid: () => { $("#crtGrid").classList.toggle("is-on"); return "CRT grid toggled."; },
    rain: () => { matrixOn = !matrixOn; canvas.style.display = matrixOn ? "" : "none"; return matrixOn ? "matrix rain: ON" : "matrix rain: OFF"; },
    glitch: () => { fireGlitch(); return "signal corrupted … restored."; },
    clear: () => { cmdOut.textContent = ""; return ""; },
    "sudo hire-me": () => { gotoSection("contact"); return "permission GRANTED. opening transmission channel …"; },
    whoami: () => "logan.solaman — store architect · est. 2016",
    ls: () => "about  services  cases  tools  process  contact  (try one)",
    lang: (arg) => {
      if (!window.I18N) return "i18n not loaded";
      if (!arg) return `lang → ${I18N.lang} · try: lang ja  (or "langs" to list)`;
      const want = arg.toLowerCase();
      const hit = I18N.SUPPORTED.find((l) => l.toLowerCase() === want || l.split("-")[0].toLowerCase() === want);
      if (!hit) return `unknown lang "${arg}" — type "langs"`;
      I18N.set(hit);
      return `language → ${hit} (${I18N.LABELS[hit]})`;
    },
    langs: () => (window.I18N ? I18N.SUPPORTED.map((l) => `${l}=${I18N.LABELS[l]}`).join("  ·  ") : "i18n not loaded"),
  };

  const commandNames = Object.keys(COMMANDS);

  function commandCandidates(raw) {
    const q = raw.trim().toLowerCase();
    if (!q) return [];
    return commandNames.filter((name) => name.startsWith(q));
  }

  function updateCmdHint(raw = "") {
    if (!cmdHint) return;
    const q = raw.trim().toLowerCase();
    if (!q) {
      cmdHint.innerHTML = "hint: type <kbd>help</kbd> to list commands · <kbd>Tab</kbd> autocompletes";
      return;
    }
    const candidates = commandCandidates(q);
    if (candidates.length === 0) {
      cmdHint.textContent = `no direct match for "${q}"`;
      return;
    }
    const [first] = candidates;
    if (first === q) {
      cmdHint.textContent = `ready: ${first}`;
      return;
    }
    const more = candidates.length > 1 ? ` (+${candidates.length - 1} more)` : "";
    cmdHint.textContent = `tab to complete: ${first}${more}`;
  }

  function runCommand(raw) {
    const c = raw.trim().toLowerCase();
    if (!c) return;
    const [head, ...rest] = c.split(/\s+/);
    const arg = rest.join(" ");
    // exact full-string match first (e.g. "sudo hire-me"), else head command with arg
    const fn = COMMANDS[c] || COMMANDS[head];
    if (fn) {
      const out = fn(arg);
      cmdOut.textContent = out;
    } else {
      cmdOut.textContent = TT("js.cmd.notfound", `command not found: ${c} — type "help"`).replace("{cmd}", c);
    }
  }

  if (cmdInput) {
    updateCmdHint("");
    cmdInput.addEventListener("input", () => {
      updateCmdHint(cmdInput.value);
    });

    cmdInput.addEventListener("keydown", (e) => {
      e.stopPropagation(); // don't trigger global shortcuts while typing
      if (e.key === "Tab") {
        const candidates = commandCandidates(cmdInput.value);
        if (candidates.length) {
          e.preventDefault();
          cmdInput.value = candidates[0];
          updateCmdHint(cmdInput.value);
        }
        return;
      }
      if (e.key === "Enter") {
        const v = cmdInput.value;
        cmdInput.value = "";
        runCommand(v);
        updateCmdHint("");
      }
    });
  }

  /* ================= GLITCH ================= */
  function fireGlitch() {
    const name = $("#heroName");
    if (!name) return;
    name.classList.remove("is-glitching");
    void name.offsetWidth;
    name.classList.add("is-glitching");
    setTimeout(() => name.classList.remove("is-glitching"), 400);
  }

  /* ================= GLOBAL KEYBOARD PROTOCOL ================= */
  const konamiSeq = ["arrowup", "arrowup", "arrowdown", "arrowdown", "arrowleft", "arrowright", "arrowleft", "arrowright", "b", "a"];
  let konamiPos = 0;
  const helpOverlay = $("#helpOverlay");

  function openHelp() { if (helpOverlay) helpOverlay.hidden = false; }
  function closeHelp() { if (helpOverlay) helpOverlay.hidden = true; }
  if ($("#helpClose")) $("#helpClose").addEventListener("click", closeHelp);

  document.addEventListener("keydown", (e) => {
    // konami tracking
    const k = e.key.toLowerCase();
    konamiPos = k === konamiSeq[konamiPos] ? konamiPos + 1 : (k === konamiSeq[0] ? 1 : 0);
    if (konamiPos === konamiSeq.length) { konamiPos = 0; konami(); return; }

    const inInput = e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA");
    if (inInput) {
      if (e.key === "Escape") e.target.blur();
      return;
    }

    if (e.key === "?") { e.preventDefault(); openHelp(); return; }
    if (e.key === "Escape") { closeHelp(); cmdOut && (cmdOut.textContent = ""); return; }
    if (e.key === "/") { e.preventDefault(); cmdInput && cmdInput.focus(); return; }

    if (e.key >= "1" && e.key <= "7") {
      const id = Object.keys(SECTIONS)[parseInt(e.key, 10) - 1];
      gotoSection(id);
      return;
    }
    switch (k) {
      case "[": themeDelta(-1); break;
      case "]": themeDelta(1); break;
      case "g": $("#crtGrid") && $("#crtGrid").classList.toggle("is-on"); break;
      case "t": fireGlitch(); break;
      case "m": matrixOn = !matrixOn; if (canvas) canvas.style.display = matrixOn ? "" : "none"; break;
    }
  });

  /* ================= CONTACT FORM ================= */
  const form = $("#contactForm");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const btn = form.querySelector(".btn");
      btn.textContent = TT("js.transmitted", "✓ TRANSMITTED — REPLY INBOUND");
      btn.disabled = true;
      if (window.gsap) gsap.fromTo(btn, { scale: 0.94 }, { scale: 1, duration: 0.5, ease: "elastic.out(1,0.5)" });
    });
  }

  /* ================= ARCHIVE FILTERS (always active, a11y-safe) ================= */
  const acardsAll = $$(".acard");
  $$(".afilter").forEach((btn) => {
    btn.addEventListener("click", () => {
      $$(".afilter").forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      const f = (btn.dataset.f || "").toLowerCase();
      acardsAll.forEach((c) => {
        const cat = (c.dataset.cat || "").toLowerCase();
        const status = (c.dataset.status || "").toLowerCase();
        const match =
          f === "all" ||
          cat === f ||
          (f === "building" && status === "building");
        c.classList.toggle("is-hidden", !match);
      });

      // Cards move to new positions after filtering; refresh triggers so visuals stay in sync.
      if (window.ScrollTrigger) window.ScrollTrigger.refresh();
    });
  });

  /* ================= GSAP ================= */
  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;
  if (gsap && ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);

    if (!reduced) {
      /* reveals */
      gsap.utils.toArray("[data-reveal]").forEach((el) => {
        gsap.to(el, {
          opacity: 1, y: 0, duration: 0.9, ease: "expo.out",
          scrollTrigger: { trigger: el, start: "top 88%" },
        });
      });

      /* hero entrance after boot */
      gsap.from(".hero__monitor", { opacity: 0, y: 46, scale: 0.985, duration: 1.1, ease: "expo.out", delay: reduced ? 0 : 0.2 });

      /* counters */
      gsap.utils.toArray("[data-count]").forEach((el) => {
        const target = parseInt(el.dataset.count, 10);
        const obj = { v: 0 };
        gsap.to(obj, {
          v: target, duration: 1.8, ease: "power2.out",
          scrollTrigger: { trigger: el, start: "top 90%" },
          onUpdate: () => { el.textContent = Math.round(obj.v); },
        });
      });

      /* parallax drift for archive cards */
      gsap.utils.toArray(".acard").forEach((c, i) => {
        gsap.fromTo(c, { y: i % 2 ? 40 : 24 }, {
          y: 0, ease: "none",
          scrollTrigger: { trigger: c, start: "top bottom", end: "top 55%", scrub: 0.5 },
        });
      });

      /* magnetic buttons */
      $$("[data-magnet]").forEach((btn) => {
        const mx = gsap.quickTo(btn, "x", { duration: 0.35, ease: "elastic.out(1,0.45)" });
        const my = gsap.quickTo(btn, "y", { duration: 0.35, ease: "elastic.out(1,0.45)" });
        btn.addEventListener("pointermove", (e) => {
          const r = btn.getBoundingClientRect();
          mx((e.clientX - r.left - r.width / 2) * 0.3);
          my((e.clientY - r.top - r.height / 2) * 0.3);
        }, { passive: true });
        btn.addEventListener("pointerleave", () => { mx(0); my(0); });
      });

    }
  }

  /* ================= LANGUAGE SWITCHER + MODAL ================= */
  const langBtn = $("#langSwitch");
  const langModal = $("#langModal");
  const langGrid = $("#langGrid");
  const langClose = $("#langClose");

  function openLangModal() {
    if (!langModal || !window.I18N) return;
    I18N.renderMenu(langGrid, () => { closeLangModal(); });
    langModal.hidden = false;
  }
  function closeLangModal() {
    if (langModal) langModal.hidden = true;
  }

  if (langBtn && window.I18N) {
    langBtn.addEventListener("click", openLangModal);
  }
  if (langClose) langClose.addEventListener("click", closeLangModal);
  if (langModal) {
    langModal.addEventListener("click", (e) => { if (e.target === langModal) closeLangModal(); });
  }

  // keyboard: L opens the modal (or cycles if modal unsupported)
  document.addEventListener("keydown", (e) => {
    const inInput = e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA");
    if (inInput) return;
    if (e.key.toLowerCase() === "l") {
      if (window.I18N && langModal) openLangModal();
      else if (window.I18N) I18N.next();
    }
    if (e.key === "Escape") closeLangModal();
  });
  };  // end begin()

  // Start once the locale dictionary is ready (or immediately if i18n absent).
  if (window.I18N && window.I18N.ready) {
    window.I18N.ready().then(begin).catch(begin);
  } else {
    begin();
  }
})();
