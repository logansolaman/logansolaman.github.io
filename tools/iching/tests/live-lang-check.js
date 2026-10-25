/* Verify the LIVE site's language switch actually re-renders the reading
   in the target language. Waits for the fetch to settle instead of a
   fixed timeout, so a slow CDN can't be mistaken for a broken switch. */
"use strict";
const { spawn } = require("child_process");
const http = require("http");
const fs = require("fs");

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9345;
const URL_ = process.argv[2] || "https://logansolaman.com/tools/iching/";
const OUT = "/tmp/shots-live2";
fs.mkdirSync(OUT, { recursive: true });

const chrome = spawn(CHROME, [
  "--headless=new", "--disable-gpu", "--no-sandbox",
  "--remote-debugging-port=" + PORT,
  "--user-data-dir=/tmp/cdp-p2-" + Date.now(),
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

  // cast once
  await evalJS(`document.querySelector('#question').value='live test';
    document.querySelector('#btnStart').click(); 'x'`);
  await sleep(4000);
  await evalJS(`document.querySelector('#btnRead').click(); 'x'`);
  await sleep(1200);
  const enSnap = await evalJS(`JSON.stringify({
    lang: document.documentElement.lang,
    name: document.querySelector('.rname')?.textContent,
    judgment: document.querySelector('.rblock .zh')?.textContent?.slice(0,70),
    advice: document.querySelector('.radv p')?.textContent?.slice(0,70)
  })`);
  console.log("EN :", enSnap);

  // switch to zh-TW and WAIT until the DOM actually shows Chinese
  const zh = await evalJS(`(async()=>{
    document.querySelector('#langBtn').click();
    await new Promise(r=>setTimeout(r,300));
    const opt=[...document.querySelectorAll('.langopt')].find(b=>b.textContent.includes('繁體'));
    if(!opt) return JSON.stringify({error:'zh-TW option not found',
       opts:[...document.querySelectorAll('.langopt')].map(b=>b.textContent)});
    opt.click();
    // poll until the judgment text is Chinese (or timeout)
    const CJK=/[\\u4e00-\\u9fff]/;
    for(let i=0;i<40;i++){
      await new Promise(r=>setTimeout(r,250));
      const j=document.querySelector('.rblock .zh')?.textContent||'';
      if(CJK.test(j)) break;
    }
    return JSON.stringify({
      lang: document.documentElement.lang,
      name: document.querySelector('.rname')?.textContent,
      judgment: document.querySelector('.rblock .zh')?.textContent?.slice(0,70),
      advice: document.querySelector('.radv p')?.textContent?.slice(0,70),
      line1: document.querySelector('.rlines .rt')?.textContent?.slice(0,50),
      cjkJudgment: CJK.test(document.querySelector('.rblock .zh')?.textContent||'')
    });
  })()`);
  console.log("ZH :", zh);
  await shot("zh-tw-live");

  const j = JSON.parse(zh);
  const CJK = /[\u4e00-\u9fff]/;
  const ok = j.cjkJudgment && CJK.test(j.name || "") && CJK.test(j.advice || "");
  console.log("\nLANGUAGE SWITCH RE-RENDERS:", ok ? "PASS" : "FAIL");

  ws.close(); chrome.kill();
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.error("ERR", e); chrome.kill(); process.exit(1); });
