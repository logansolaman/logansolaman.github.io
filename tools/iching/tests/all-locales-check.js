/* Verify every shipped locale on the LIVE site renders in its own script
   (not English), and that the language menu lists exactly the shipped set. */
"use strict";
const { spawn } = require("child_process");
const http = require("http");
const fs = require("fs");

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9357;
const URL_ = process.argv[2] || "https://logansolaman.com/tools/iching/";
const OUT = "/tmp/shots-all";
fs.mkdirSync(OUT, { recursive: true });

const chrome = spawn(CHROME, [
  "--headless=new", "--disable-gpu", "--no-sandbox",
  "--remote-debugging-port=" + PORT,
  "--user-data-dir=/tmp/cdp-p3-" + Date.now(),
  "--no-first-run", "--disable-extensions", "about:blank",
], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const getJSON = (path) => new Promise((resolve, reject) => {
  http.get({ host: "127.0.0.1", port: PORT, path }, (res) => {
    let b = ""; res.on("data", (c) => (b += c));
    res.on("end", () => { try { resolve(JSON.parse(b)); } catch (e) { reject(e); } });
  }).on("error", reject);
});

(async () => {
  let tabs = null;
  for (let i = 0; i < 40; i++) {
    try { tabs = await getJSON("/json/list"); break; } catch (e) { await sleep(300); }
  }
  const WebSocket = require("/tmp/node_modules/ws");
  const ws = new WebSocket(tabs.find((t) => t.type === "page").webSocketDebuggerUrl);
  let id = 0; const pending = new Map();
  const send = (method, params) => new Promise((res, rej) => {
    const mid = ++id; pending.set(mid, { res, rej });
    ws.send(JSON.stringify({ id: mid, method, params: params || {} }));
  });
  ws.on("message", (raw) => {
    const m = JSON.parse(raw);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id); pending.delete(m.id);
      m.error ? p.rej(new Error(m.error.message)) : p.res(m.result);
    }
  });
  await new Promise((r) => ws.on("open", r));
  await send("Page.enable"); await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride",
    { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
  await send("Page.navigate", { url: URL_ });
  await sleep(4000);

  const evalJS = async (expr) => {
    const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + " " +
      (r.exceptionDetails.exception && r.exceptionDetails.exception.description || ""));
    return r.result.value;
  };
  const shot = async (name) => {
    const r = await send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(OUT + "/" + name + ".png", Buffer.from(r.data, "base64"));
  };

  const shipped = JSON.parse(await evalJS("JSON.stringify(window.ICHI_DATA.langs)"));
  console.log("shipped locales:", shipped.join(", "));

  // the language menu must offer exactly the shipped set
  const menu = JSON.parse(await evalJS(
    `JSON.stringify([...document.querySelectorAll('.langopt')].map(b=>b.textContent.trim()))`));
  console.log("menu entries:", menu.length);
  if (menu.length !== shipped.length) console.log("  !! MENU COUNT MISMATCH");

  // Cast once so there is a reading for each language to re-render.
  await evalJS(`document.querySelector('#question').value='locale check';
    document.querySelector('#btnStart').click(); 'x'`);
  await sleep(4200);
  await evalJS(`document.querySelector('#btnRead').click(); 'x'`);
  await sleep(1200);
  const firstRead = await evalJS(`JSON.stringify({
    name: document.querySelector('.rname')?.textContent,
    judgment: document.querySelector('.rblock .zh')?.textContent?.slice(0,50)
  })`);
  console.log("cast result:", firstRead);

  // per-locale check: switch, wait for the reading to re-render, verify script
  const SCRIPT = {
    en: /[A-Za-z]/, "zh-TW": /[一-鿿]/, "zh-CN": /[一-鿿]/,
    es: /[áéíóúñ¿¡]/i, ja: /[぀-ヿ一-鿿]/, vi: /[ăâđêôơư]/i,
    fr: /[éèêàç]/i, pt: /[ãõçáé]/i, ko: /[가-힯]/, ar: /[؀-ۿ]/,
  };
  let failures = 0;
  for (const L of shipped) {
    const r = await evalJS(`(async()=>{
      document.querySelector('#langBtn').click();
      await new Promise(r=>setTimeout(r,250));
      const opts=[...document.querySelectorAll('.langopt')];
      const idx=${JSON.stringify(shipped)}.indexOf(${JSON.stringify(L)});
      opts[idx].click();
      // Wait for the app to finish loading THIS language's data.
      for(let i=0;i<90;i++){
        await new Promise(r=>setTimeout(r,150));
        if(!document.body.dataset.loading) break;
      }
      await new Promise(r=>setTimeout(r,400));
      return JSON.stringify({
        lang: document.documentElement.lang,
        dir: document.documentElement.dir,
        h1: document.querySelector('.bar__title')?.textContent,
        name: document.querySelector('.rname')?.textContent,
        judgment: document.querySelector('.rblock .zh')?.textContent?.slice(0,60),
        advice: document.querySelector('.radv p')?.textContent?.slice(0,60),
        scrollW: document.documentElement.scrollWidth,
        clientW: document.documentElement.clientWidth
      });
    })()`);
    const j = JSON.parse(r);
    const text = (j.judgment || "") + (j.advice || "") + (j.name || "");
    const scriptOk = SCRIPT[L] ? SCRIPT[L].test(text) : true;
    const uiText = (j.h1 || "");
    const uiOk = SCRIPT[L] ? SCRIPT[L].test(uiText) : true;
    const overflow = j.scrollW - j.clientW;
    const ok = j.lang === L && scriptOk && uiOk && overflow <= 0;
    if (!ok) failures++;
    console.log(`${ok ? "PASS" : "FAIL"} ${L.padEnd(6)} overflow=${overflow} script=${scriptOk ? "ok" : "WRONG"} ui=${uiOk ? "ok" : "WRONG"}  h1="${j.h1}"`);
    console.log(`      ${j.judgment}`);
    await shot("lang-" + L);
  }

  // reference grid + modal in the last language
  await evalJS(`document.querySelector('.refcell').click(); 'x'`);
  await sleep(600);
  const modal = JSON.parse(await evalJS(`JSON.stringify({
    open: !document.querySelector('#hxModal')?.hidden,
    name: document.querySelector('#hxBody .rname')?.textContent,
    lines: document.querySelectorAll('#hxBody .rlines li').length
  })`));
  console.log("modal:", JSON.stringify(modal));
  if (!modal.open || modal.lines !== 6) failures++;
  await shot("modal");

  console.log(failures === 0 ? "\nALL LOCALES PASS" : `\n${failures} FAILURES`);
  ws.close(); chrome.kill();
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error("ERR", e); chrome.kill(); process.exit(1); });
