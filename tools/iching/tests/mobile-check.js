/* Drive the shipped page in real Chrome over CDP: verify mobile layout,
   run a full cast, and capture screenshots. No re-implementation — this
   loads the real page from the local server. */
"use strict";
const { spawn } = require("child_process");
const http = require("http");
const fs = require("fs");

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9333;
const URL_ = process.argv[2] || "http://127.0.0.1:8901/tools/iching/";
const OUT = process.argv[3] || "/tmp/shots";

fs.mkdirSync(OUT, { recursive: true });

const chrome = spawn(CHROME, [
  "--headless=new", "--disable-gpu", "--no-sandbox",
  "--remote-debugging-port=" + PORT,
  "--user-data-dir=/tmp/cdp-profile-" + Date.now(),
  "--no-first-run", "--disable-extensions",
  "about:blank",
], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function getJSON(path) {
  return new Promise((resolve, reject) => {
    http.get({ host: "127.0.0.1", port: PORT, path }, (res) => {
      let b = "";
      res.on("data", (c) => (b += c));
      res.on("end", () => { try { resolve(JSON.parse(b)); } catch (e) { reject(e); } });
    }).on("error", reject);
  });
}

(async () => {
  let tabs = null;
  for (let i = 0; i < 40; i++) {
    try { tabs = await getJSON("/json/list"); break; } catch (e) { await sleep(300); }
  }
  if (!tabs) { console.error("chrome did not start"); process.exit(1); }
  const target = tabs.find((t) => t.type === "page");
  const WebSocket = require("/tmp/node_modules/ws");
  let ws;
  try { ws = new WebSocket(target.webSocketDebuggerUrl); }
  catch (e) {
    console.error("ws module missing:", e.message);
    process.exit(2);
  }
  let id = 0;
  const pending = new Map();
  const send = (method, params) => new Promise((res, rej) => {
    const mid = ++id;
    pending.set(mid, { res, rej });
    ws.send(JSON.stringify({ id: mid, method, params: params || {} }));
  });
  ws.on("message", (raw) => {
    const m = JSON.parse(raw);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id);
      pending.delete(m.id);
      if (m.error) p.rej(new Error(m.error.message));
      else p.res(m.result);
    }
  });
  await new Promise((r) => ws.on("open", r));

  await send("Page.enable");
  await send("Runtime.enable");

  // iPhone 14 Pro-ish metrics
  const metrics = { width: 390, height: 844, deviceScaleFactor: 3, mobile: true };
  await send("Emulation.setDeviceMetricsOverride", metrics);

  await send("Page.navigate", { url: URL_ });
  await sleep(3500);

  const evalJS = async (expr) => {
    const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + " " +
      (r.exceptionDetails.exception && r.exceptionDetails.exception.description || ""));
    return r.result.value;
  };

  const shot = async (name, full) => {
    const r = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: !!full });
    fs.writeFileSync(OUT + "/" + name + ".png", Buffer.from(r.data, "base64"));
    return OUT + "/" + name + ".png";
  };

  console.log("=== INITIAL MOBILE VIEW ===");
  console.log(await evalJS(`JSON.stringify({
    title: document.title,
    h1: document.querySelector('.bar__title')?.textContent,
    inputVisible: !!document.querySelector('#question')?.offsetParent,
    btnText: document.querySelector('#btnStart')?.textContent,
    bodyText: document.body.innerText.slice(0,300),
    scrollW: document.documentElement.scrollWidth,
    clientW: document.documentElement.clientWidth,
    fonts: getComputedStyle(document.body).fontFamily
  }, null, 1)`));
  console.log("shot:", await shot("01-ask"));

  // ---- run a full cast ----
  console.log("\n=== CAST FLOW ===");
  await evalJS(`document.querySelector('#question').value = 'Should I take this job offer?';
               document.querySelector('#btnStart').click(); 'clicked'`);
  await sleep(500);
  console.log("after start:", await evalJS(`JSON.stringify({
    castVisible: !!document.querySelector('#panelCast')?.offsetParent,
    askVisible: !!document.querySelector('#panelAsk')?.offsetParent,
    lines: document.querySelectorAll('#lines li').length
  })`));
  await sleep(3500);   // let the 6 animated tosses finish
  console.log("after tosses:", await evalJS(`JSON.stringify({
    lines: document.querySelectorAll('#lines li').length,
    moving: document.querySelectorAll('#lines li.moving').length,
    readBtnVisible: !!document.querySelector('#btnRead')?.offsetParent,
    marks: [...document.querySelectorAll('#lines .lmark')].map(e=>e.textContent)
  })`));
  console.log("shot:", await shot("02-cast"));

  // ---- read the result ----
  await evalJS(`document.querySelector('#btnRead').click(); 'ok'`);
  await sleep(900);
  console.log("result:", await evalJS(`JSON.stringify({
    readVisible: !!document.querySelector('#panelRead')?.offsetParent,
    hexName: document.querySelector('.rname')?.textContent,
    hexEn: document.querySelector('.ren')?.textContent,
    judgment: document.querySelector('.rblock .zh')?.textContent?.slice(0,90),
    lineCount: document.querySelectorAll('.rlines li').length,
    movingLines: document.querySelectorAll('.rlines li.moving').length,
    advice: document.querySelector('.radv p')?.textContent,
    derived: [...document.querySelectorAll('.dcard__n')].map(e=>e.textContent.trim().replace(/\\s+/g,' ')),
    ruling: document.querySelector('.ruling')?.textContent
  }, null, 1)`));
  console.log("shot:", await shot("03-reading"));
  console.log("shot:", await shot("04-reading-full", true));

  // ---- language switch ----
  console.log("\n=== LANGUAGE SWITCH (zh-TW) ===");
  await evalJS(`window.ICHI_TEST && 'hook ok'; 'x'`);
  await evalJS(`(async()=>{ 
      document.querySelector('#langBtn').click();
      await new Promise(r=>setTimeout(r,200));
      const opt=[...document.querySelectorAll('.langopt')].find(b=>b.textContent.includes('繁體'));
      opt.click();
      await new Promise(r=>setTimeout(r,1500));
      return 'switched';
  })()`);
  console.log(await evalJS(`JSON.stringify({
    lang: document.documentElement.lang,
    dir: document.documentElement.dir,
    h1: document.querySelector('.bar__title')?.textContent,
    hexName: document.querySelector('.rname')?.textContent,
    judgment: document.querySelector('.rblock .zh')?.textContent?.slice(0,60),
    advice: document.querySelector('.radv p')?.textContent?.slice(0,80),
    scrollW: document.documentElement.scrollWidth,
    clientW: document.documentElement.clientWidth
  }, null, 1)`));
  console.log("shot:", await shot("05-zhtw"));

  // ---- reference grid / modal ----
  await evalJS(`document.querySelector('#panelRead').scrollIntoView(); window.scrollTo(0,document.body.scrollHeight); 'x'`);
  await sleep(400);
  console.log("shot:", await shot("06-reference"));
  await evalJS(`document.querySelector('.refcell').click(); 'x'`);
  await sleep(500);
  console.log("modal:", await evalJS(`JSON.stringify({
    open: !document.querySelector('#hxModal')?.hidden,
    name: document.querySelector('#hxBody .rname')?.textContent,
    lines: document.querySelectorAll('#hxBody .rlines li').length
  })`));
  console.log("shot:", await shot("07-modal"));

  // ---- overflow check across all shipped locales ----
  console.log("\n=== OVERFLOW CHECK (all shipped locales) ===");
  const langs = await evalJS(`JSON.stringify(window.ICHI_DATA.langs)`);
  for (const L of JSON.parse(langs)) {
    await evalJS(`(async()=>{ const m=await import('assets/iching-data.js'); return 1; })()`).catch(()=>{});
    const r = await evalJS(`(async()=>{
      const code = ${JSON.stringify(L)};
      // simulate a language change through the app's own path
      location.search = '?lang=' + code;
      await new Promise(r=>setTimeout(r,1600));
      return JSON.stringify({
        lang: document.documentElement.lang,
        scrollW: document.documentElement.scrollWidth,
        clientW: document.documentElement.clientWidth,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        h1: document.querySelector('.bar__title')?.textContent
      });
    })()`);
    console.log(" ", r);
  }

  ws.close();
  chrome.kill();
  process.exit(0);
})().catch((e) => { console.error("ERR", e); chrome.kill(); process.exit(1); });
