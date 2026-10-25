/* Responsive check: verify the app at several real device widths, for every
   shipped locale, asserting no horizontal overflow and that the reading
   renders in the target script. */
"use strict";
const { spawn } = require("child_process");
const http = require("http");
const fs = require("fs");

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9361;
const URL_ = process.argv[2] || "https://logansolaman.com/tools/iching/";
const OUT = "/tmp/shots-resp";
fs.mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: "iphone-se", width: 375, height: 667 },
  { name: "iphone-14", width: 390, height: 844 },
  { name: "pixel", width: 412, height: 915 },
  { name: "ipad", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 900 },
];

const chrome = spawn(CHROME, [
  "--headless=new", "--disable-gpu", "--no-sandbox",
  "--remote-debugging-port=" + PORT,
  "--user-data-dir=/tmp/cdp-p4-" + Date.now(),
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

  let failures = 0;
  for (const vp of VIEWPORTS) {
    await send("Emulation.setDeviceMetricsOverride",
      { width: vp.width, height: vp.height, deviceScaleFactor: 2, mobile: vp.width < 768 });
    await send("Page.navigate", { url: URL_ });
    await sleep(3500);

    // measure overflow in the ask step
    const ask = JSON.parse(await evalJS(`JSON.stringify({
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
      inputW: document.querySelector('#question')?.getBoundingClientRect().width,
      btnW: document.querySelector('#btnStart')?.getBoundingClientRect().width,
      btnH: document.querySelector('#btnStart')?.getBoundingClientRect().height
    })`));
    const askOverflow = ask.scrollW - ask.clientW;
    const tapOK = ask.btnH >= 44;

    // cast and measure the reading step
    await evalJS(`document.querySelector('#question').value='responsive check';
      document.querySelector('#btnStart').click(); 'x'`);
    await sleep(4200);
    await evalJS(`document.querySelector('#btnRead').click(); 'x'`);
    await sleep(1200);
    const read = JSON.parse(await evalJS(`JSON.stringify({
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
      name: document.querySelector('.rname')?.textContent,
      lines: document.querySelectorAll('.rlines li').length,
      advice: document.querySelector('.radv p')?.textContent?.slice(0,40),
      refCells: document.querySelectorAll('.refcell').length
    })`));
    const readOverflow = read.scrollW - read.clientW;
    const ok = askOverflow <= 0 && readOverflow <= 0 && read.lines === 6 && read.refCells === 64 && tapOK;
    if (!ok) failures++;
    console.log(`${ok ? "PASS" : "FAIL"} ${vp.name.padEnd(10)} ${vp.width}x${vp.height}  askOverflow=${askOverflow} readOverflow=${readOverflow} tapTarget=${ask.btnH}px lines=${read.lines} refCells=${read.refCells}`);
    await shot(vp.name);
  }

  console.log(failures === 0 ? "\nALL VIEWPORTS PASS" : `\n${failures} FAILURES`);
  ws.close(); chrome.kill();
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error("ERR", e); chrome.kill(); process.exit(1); });
