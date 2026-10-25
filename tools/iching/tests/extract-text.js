/* Extract the ACTUAL rendered text from the live page for one locale.
   Vision-model OCR of small Arabic misreads characters, so verify
   against the DOM, not the screenshot. */
"use strict";
const { spawn } = require("child_process");
const http = require("http");

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9373;
const URL_ = process.argv[2] || "https://logansolaman.com/tools/iching/";
const LANG = process.argv[3] || "ar";

const chrome = spawn(CHROME, [
  "--headless=new", "--disable-gpu", "--no-sandbox",
  "--remote-debugging-port=" + PORT,
  "--user-data-dir=/tmp/cdp-p5-" + Date.now(),
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
  await send("Page.navigate", { url: URL_ + "?lang=" + LANG });
  await sleep(4000);

  const evalJS = async (expr) => {
    const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
    return r.result.value;
  };

  await evalJS(`document.querySelector('#question').value='text extraction check';
    document.querySelector('#btnStart').click(); 'x'`);
  await sleep(4200);
  await evalJS(`document.querySelector('#btnRead').click(); 'x'`);
  await sleep(1500);

  const out = await evalJS(`JSON.stringify({
    lang: document.documentElement.lang,
    dir: document.documentElement.dir,
    back: document.querySelector('.bar__back')?.textContent,
    title: document.querySelector('.bar__title')?.textContent,
    h1: document.querySelector('.rname')?.textContent,
    summary: document.querySelector('.rsum')?.textContent,
    judgment: document.querySelector('.rblock .zh')?.textContent,
    xiang: document.querySelectorAll('.rblock .zh')[1]?.textContent,
    core: document.querySelector('.rblock .en')?.textContent,
    advice: document.querySelector('.radv p')?.textContent,
    ruling: document.querySelector('.ruling')?.textContent,
    line1: document.querySelector('.rlines .rt')?.textContent,
    line1img: document.querySelector('.rlines .ri')?.textContent,
    derived: [...document.querySelectorAll('.dcard__n')].map(e=>e.textContent.trim().replace(/\\s+/g,' ')),
    derivedText: [...document.querySelectorAll('.dcard p')].map(e=>e.textContent.trim())
  }, null, 1)`);
  console.log(out);
  ws.close(); chrome.kill();
  process.exit(0);
})().catch((e) => { console.error("ERR", e); chrome.kill(); process.exit(1); });
