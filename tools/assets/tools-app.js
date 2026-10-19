/* ============================================================
   THE ARMORY — app framework
   Renders tool grid, workspace modal, and special engines:
   qr · invoice(pdf) · pdf_text/ocr · image_resize · base64 ·
   fx · page_audit · scrape
   ============================================================ */
(() => {
  "use strict";

  // Build after the locale dictionary is ready so tool names/descs render localized.
  const start = () => {

  const $ = (s, c = document) => c.querySelector(s);
  const TOOLS = window.TOOLS || [];
  const CATS = window.CATS || [];
  const CAT_ICON = Object.fromEntries(CATS.map((c) => [c.id, c.icon]));

  /* ---------- i18n helpers (fallback to data.js English) ---------- */
  const hasI18N = !!window.I18N;
  const tName = (t) => hasI18N ? (I18N.t(`tool.${t.id}.name`) !== `tool.${t.id}.name` ? I18N.t(`tool.${t.id}.name`) : t.name) : t.name;
  const tDesc = (t) => hasI18N ? (I18N.t(`tool.${t.id}.desc`) !== `tool.${t.id}.desc` ? I18N.t(`tool.${t.id}.desc`) : t.desc) : t.desc;
  const cName = (c) => hasI18N ? (I18N.t(`cat.${c.id}`) !== `cat.${c.id}` ? I18N.t(`cat.${c.id}`) : c.name) : c.name;
  const TT = (k, fb) => hasI18N ? (I18N.t(k) !== k ? I18N.t(k) : fb) : fb;

  /* ---------- clock ---------- */
  const clockEl = $("#clock");
  const tick = () => {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    clockEl.textContent = `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  };
  tick(); setInterval(tick, 1000);

  /* ---------- grid ---------- */
  const grid = $("#grid");
  const tabs = $("#tabs");
  const countEl = $("#count");
  const searchInput = $("#search");
  let activeCat = "all";
  let query = "";

  CATS.forEach((c) => {
    const b = document.createElement("button");
    b.className = "tab";
    b.dataset.cat = c.id;
    b.textContent = `${c.icon} ${cName(c)}`;
    b.addEventListener("click", () => setCat(c.id));
    tabs.appendChild(b);
  });
  const allTab = document.createElement("button");
  allTab.className = "tab is-active";
  allTab.dataset.cat = "all";
  allTab.textContent = TT("armory.all", "▦ ALL [50]");
  allTab.addEventListener("click", () => setCat("all"));
  tabs.prepend(allTab);

  TOOLS.forEach((t) => {
    const el = document.createElement("button");
    el.className = "toolcard";
    el.dataset.cat = t.cat;
    el.dataset.id = t.id;
    el.innerHTML = `
      <div class="toolcard__head">
        <span class="toolcard__icon">${CAT_ICON[t.cat] || "▣"}</span>
        <span class="toolcard__name">${tName(t)}</span>
      </div>
      <span class="toolcard__desc">${tDesc(t)}</span>
      <span class="toolcard__run">${TT("armory.run", "RUN ▸")}</span>`;
    el.addEventListener("click", () => openTool(t));
    grid.appendChild(el);
  });

  function applyFilters() {
    let shown = 0;
    document.querySelectorAll(".toolcard").forEach((el) => {
      const t = TOOLS.find((x) => x.id === el.dataset.id);
      const catOk = activeCat === "all" || t.cat === activeCat;
      const qOk = !query || (t.name + " " + t.desc + " " + t.cat).toLowerCase().includes(query);
      const vis = catOk && qOk;
      el.classList.toggle("is-hidden", !vis);
      if (vis) shown++;
    });
    countEl.textContent = `${shown} / ${TOOLS.length} ${TT("armory.shown", "TOOLS SHOWN")} · ${activeCat === "all" ? TT("armory.allcats", "ALL CATEGORIES") : cName(CATS.find((c) => c.id === activeCat) || { name: "" })}`;
  }

  function setCat(c) {
    activeCat = c;
    document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("is-active", b.dataset.cat === c));
    applyFilters();
  }

  searchInput.addEventListener("input", () => { query = searchInput.value.trim().toLowerCase(); applyFilters(); });
  applyFilters();

  /* ---------- keyboard ---------- */
  document.addEventListener("keydown", (e) => {
    const typing = e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT");
    if (e.key === "/" && !typing) { e.preventDefault(); searchInput.focus(); }
    if (e.key === "Escape") {
      if (!ws.hidden) closeWs();
      else if (typing) e.target.blur();
    }
  });

  /* ---------- workspace ---------- */
  const ws = $("#ws");
  const wsName = $("#wsName");
  const wsDesc = $("#wsDesc");
  const wsFields = $("#wsFields");
  const wsOut = $("#wsOut");
  const wsMedia = $("#wsMedia");
  const wsRun = $("#wsRun");
  const wsCopy = $("#wsCopy");
  const wsDownload = $("#wsDownload");
  let current = null;

  function openTool(t) {
    current = t;
    wsName.textContent = tName(t);
    wsDesc.textContent = tDesc(t);
    wsOut.textContent = "";
    wsMedia.innerHTML = "";
    wsCopy.hidden = true;
    wsDownload.hidden = true;
    wsFields.innerHTML = "";

    t.fields.forEach((f) => {
      const wrap = document.createElement("div");
      wrap.className = "field";
      let input;
      if (f.type === "area") {
        input = document.createElement("textarea");
        input.rows = 4;
      } else if (f.type === "select") {
        input = document.createElement("select");
        f.opts.forEach((o) => {
          const opt = document.createElement("option");
          opt.textContent = o; opt.value = o;
          input.appendChild(opt);
        });
      } else if (f.type === "check") {
        wrap.classList.add("field--check");
        input = document.createElement("input");
        input.type = "checkbox";
      } else {
        input = document.createElement("input");
        input.type = f.type || "text";
        if (f.accept) input.accept = f.accept;
      }
      input.name = f.k;
      const fldPh = hasI18N && I18N.t(`tool.${t.id}.f.${f.k}.ph`) !== `tool.${t.id}.f.${f.k}.ph` ? I18N.t(`tool.${t.id}.f.${f.k}.ph`) : f.ph;
      if (fldPh) input.placeholder = fldPh;
      input.id = "f_" + f.k;
      const label = document.createElement("label");
      label.htmlFor = "f_" + f.k;
      label.textContent = hasI18N && I18N.t(`tool.${t.id}.f.${f.k}.label`) !== `tool.${t.id}.f.${f.k}.label` ? I18N.t(`tool.${t.id}.f.${f.k}.label`) : f.label;
      if (f.type === "check") { wrap.appendChild(input); wrap.appendChild(label); }
      else { wrap.appendChild(label); wrap.appendChild(input); }
      wsFields.appendChild(wrap);
    });

    ws.hidden = false;
    document.body.style.overflow = "hidden";
    const first = wsFields.querySelector("input, textarea, select");
    if (first) setTimeout(() => first.focus(), 60);
  }

  function closeWs() {
    ws.hidden = true;
    document.body.style.overflow = "";
  }
  $("#wsClose").addEventListener("click", closeWs);
  ws.addEventListener("click", (e) => { if (e.target === ws) closeWs(); });

  function gatherInputs() {
    const out = {};
    current.fields.forEach((f) => {
      const el = wsFields.querySelector(`[name="${f.k}"]`);
      if (!el) return;
      out[f.k] = f.type === "check" ? el.checked : (f.type === "file" ? el.files[0] : el.value);
    });
    return out;
  }

  wsRun.addEventListener("click", async () => {
    if (!current) return;
    const inputs = gatherInputs();
    wsOut.textContent = TT("armory.running", "RUNNING ▓▓▓ …");
    wsMedia.innerHTML = "";
    wsCopy.hidden = true;
    wsDownload.hidden = true;
    try {
      const res = await current.run(inputs);
      renderResult(res);
    } catch (err) {
      wsOut.textContent = TT("armory.error", "ERROR") + ": " + (err.message || err) + "\n\n" + TT("armory.error_hint", "check inputs and retry");
    }
  });

  wsFields.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.tagName !== "TEXTAREA" && e.target.type !== "file") {
      e.preventDefault();
      wsRun.click();
    }
  });

  wsCopy.addEventListener("click", () => {
    navigator.clipboard.writeText(wsOut.textContent).then(() => {
      wsCopy.textContent = "COPIED ✓";
      setTimeout(() => { wsCopy.textContent = "COPY"; }, 1400);
    });
  });

  function renderResult(res) {
    if (res && typeof res === "object" && res.engine) { runEngine(res); return; }
    if (res && typeof res === "object" && res.download) {
      wsOut.textContent = res.summary || "";
      res.download.forEach((d) => {
        const a = document.createElement("a");
        a.className = "btn btn--ghost";
        a.textContent = `↓ ${d.name}`;
        a.href = URL.createObjectURL(new Blob([d.content], { type: "text/plain" }));
        a.download = d.name;
        wsMedia.appendChild(a);
      });
      wsCopy.hidden = false;
      return;
    }
    wsOut.textContent = String(res);
    wsCopy.hidden = false;
  }

  /* ================= ENGINES ================= */
  function loadScript(src) {
    return new Promise((ok, bad) => {
      if (document.querySelector(`script[src="${src}"]`)) return ok();
      const s = document.createElement("script");
      s.src = src;
      s.onload = ok; s.onerror = () => bad(new Error("failed to load " + src));
      document.head.appendChild(s);
    });
  }

  async function proxyFetch(url) {
    const proxies = [
      (u) => "https://api.allorigins.win/raw?url=" + encodeURIComponent(u),
      (u) => "https://corsproxy.io/?url=" + encodeURIComponent(u),
    ];
    for (const p of proxies) {
      try {
        const r = await fetch(p(url), { signal: AbortSignal.timeout(15000) });
        if (r.ok) return await r.text();
      } catch (e) { /* try next */ }
    }
    throw new Error("all proxies refused — the target may be blocking bots");
  }

  async function runEngine(spec) {
    switch (spec.engine) {

      /* ---- QR code ---- */
      case "qr": {
        await loadScript("https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js");
        if (!window.qrcode) throw new Error("QR library failed to load");
        const type = spec.lvl === "L" ? "L" : spec.lvl === "Q" ? "Q" : spec.lvl === "H" ? "H" : "M";
        const qr = window.qrcode(0, type);
        qr.addData(spec.data || "https://logansolaman.com");
        qr.make();
        const size = spec.size || 280;
        const cell = Math.max(2, Math.floor(size / qr.getModuleCount()));
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = qr.getModuleCount() * cell;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#FDFBF7";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#111111";
        for (let r = 0; r < qr.getModuleCount(); r++)
          for (let c = 0; c < qr.getModuleCount(); c++)
            if (qr.isDark(r, c)) ctx.fillRect(c * cell, r * cell, cell, cell);
        const img = new Image();
        img.src = canvas.toDataURL("image/png");
        img.alt = "Generated QR code";
        wsMedia.appendChild(img);
        const dl = document.createElement("a");
        dl.className = "btn btn--ghost";
        dl.textContent = "↓ qr.png";
        dl.href = canvas.toDataURL("image/png");
        dl.download = "qr.png";
        wsMedia.appendChild(dl);
        wsOut.textContent = `payload: ${spec.data}\nmodules: ${qr.getModuleCount()}×${qr.getModuleCount()} · ECC: ${type}\nscan-test before printing on packaging`;
        break;
      }

      /* ---- Invoice → print/PDF ---- */
      case "invoice": {
        const lines = (spec.lines || "").split(/\n+/).map((l) => l.split(",").map((x) => x.trim())).filter((p) => p[0]);
        const tax = parseFloat(spec.tax) || 0;
        let sub = 0;
        const rows = lines.map((p) => {
          const qty = parseFloat(p[1]) || 1, price = parseFloat(p[2]) || 0;
          const amt = qty * price; sub += amt;
          return `<tr><td>${escHtml(p[0])}</td><td class="num">${qty}</td><td class="num">${fmt2(price)}</td><td class="num">${fmt2(amt)}</td></tr>`;
        }).join("");
        const taxAmt = sub * tax / 100, total = sub + taxAmt;
        const invNo = spec.inv || "INV-" + Date.now();
        const today = new Date().toLocaleDateString("en-GB");
        wsMedia.innerHTML = `
          <div class="invoice-print" id="invoicePrint">
            <h3>INVOICE ${escHtml(invNo)}</h3>
            <p><strong>Date:</strong> ${today} &nbsp; <strong>Terms:</strong> ${escHtml(spec.terms || "Net 14")}</p>
            <p style="white-space:pre-line"><strong>From:</strong><br/>${escHtml(spec.seller || "")}</p>
            <p style="white-space:pre-line"><strong>Bill to:</strong><br/>${escHtml(spec.client || "")}</p>
            <table>
              <thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Unit (${escHtml(spec.cur || "USD")})</th><th class="num">Amount</th></tr></thead>
              <tbody>${rows || '<tr><td colspan="4">—</td></tr>'}</tbody>
              <tfoot>
                <tr><td colspan="3" class="num">Subtotal</td><td class="num">${fmt2(sub)}</td></tr>
                <tr><td colspan="3" class="num">Tax (${tax}%)</td><td class="num">${fmt2(taxAmt)}</td></tr>
                <tr class="total"><td colspan="3" class="num">TOTAL</td><td class="num">${fmt2(total)} ${escHtml(spec.cur || "USD")}</td></tr>
              </tfoot>
            </table>
            <p style="font-size:12px">Generated free by THE ARMORY — logansolaman.com/tools</p>
          </div>`;
        const pb = document.createElement("button");
        pb.className = "btn";
        pb.textContent = "PRINT / SAVE AS PDF ▸";
        pb.addEventListener("click", () => window.print());
        wsMedia.appendChild(pb);
        wsOut.textContent = `${lines.length} line(s) · subtotal ${fmt2(sub)} · tax ${fmt2(taxAmt)} · total ${fmt2(total)}\nuse "Print / Save as PDF" → choose "Save as PDF" in the dialog`;
        break;
      }

      /* ---- PDF text extraction + OCR ---- */
      case "pdf_text": {
        if (!spec.file) throw new Error("choose a PDF first");
        wsOut.textContent = "reading PDF …";
        await loadScript("https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js");
        const pdfjs = window.pdfjsLib;
        pdfjs.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
        const buf = await spec.file.arrayBuffer();
        const doc = await pdfjs.getDocument({ data: buf }).promise;
        let text = "";
        for (let p = 1; p <= doc.numPages; p++) {
          const page = await doc.getPage(p);
          const tc = await page.getTextContent();
          text += tc.items.map((i) => i.str).join(" ") + "\n\n";
        }
        text = text.trim();
        if (text.length > 40) {
          wsOut.textContent = text.slice(0, 6000) + (text.length > 6000 ? "\n… (truncated)" : "");
          wsCopy.hidden = false;
        } else {
          wsOut.textContent = "no embedded text layer — this PDF looks scanned (image-only).\nloading OCR engine (tesseract.js, ~2 MB) …";
          await loadScript("https://cdn.jsdelivr.net/npm/tesseract.js@5.0.4/dist/tesseract.min.js");
          wsOut.textContent += "\nOCR running — first run downloads language data …";
          // render pages to canvas, OCR each
          let ocrText = "";
          for (let p = 1; p <= Math.min(doc.numPages, 8); p++) {
            const page = await doc.getPage(p);
            const vp = page.getViewport({ scale: 1.6 });
            const cv = document.createElement("canvas");
            cv.width = vp.width; cv.height = vp.height;
            await page.render({ canvasContext: cv.getContext("2d"), viewport: vp }).promise;
            const { data } = await window.Tesseract.recognize(cv, "eng");
            ocrText += data.text + "\n\n";
            wsOut.textContent = `OCR page ${p}/${Math.min(doc.numPages, 8)} …`;
          }
          wsOut.textContent = ocrText.trim() || "OCR found nothing readable — try a clearer scan";
          wsCopy.hidden = false;
        }
        break;
      }

      /* ---- image resize/compress ---- */
      case "image_resize": {
        if (!spec.file) throw new Error("choose an image first");
        const img = await readImage(spec.file);
        const w = Math.min(6000, spec.w || 1600);
        const scale = Math.min(1, w / img.width);
        const cv = document.createElement("canvas");
        cv.width = Math.round(img.width * scale);
        cv.height = Math.round(img.height * scale);
        cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
        const dataUrl = cv.toDataURL(spec.fmt || "image/jpeg", spec.q || 0.82);
        const before = spec.file.size, after = Math.round((dataUrl.length - dataUrl.indexOf(",") - 1) * 3 / 4);
        const out = new Image();
        out.src = dataUrl;
        out.alt = "Resized image preview";
        wsMedia.appendChild(out);
        const dl = document.createElement("a");
        dl.className = "btn btn--ghost";
        dl.textContent = "↓ download";
        dl.href = dataUrl;
        dl.download = spec.file.name.replace(/\.\w+$/, "") + "_resized" + (spec.fmt.includes("png") ? ".png" : spec.fmt.includes("webp") ? ".webp" : ".jpg");
        wsMedia.appendChild(dl);
        wsOut.textContent = `${img.width}×${img.height} → ${cv.width}×${cv.height}\nsize: ${fmtKB(before)} → ~${fmtKB(after)} (${Math.round((1 - after / before) * 100)}% smaller)\n\nShopify product-image guideline: ≤ 2048px, square crops for grids`;
        break;
      }

      /* ---- base64 inliner ---- */
      case "base64": {
        if (!spec.file) throw new Error("choose an image first");
        const reader = new FileReader();
        const dataUrl = await new Promise((ok, bad) => { reader.onload = () => ok(reader.result); reader.onerror = bad; reader.readAsDataURL(spec.file); });
        wsOut.textContent = dataUrl.slice(0, 4000) + (dataUrl.length > 4000 ? "\n… (truncated — use COPY for the full string)" : "");
        wsCopy.hidden = false;
        const note = document.createElement("p");
        note.className = "note";
        note.textContent = `full length: ${dataUrl.length} chars (${fmtKB(spec.file.size)})`;
        wsMedia.appendChild(note);
        break;
      }

      /* ---- FX rates ---- */
      case "fx": {
        const r = await fetch(`https://open.er-api.com/v6/latest/${spec.from}`);
        if (!r.ok) throw new Error("rate service refused");
        const j = await r.json();
        const rate = j.rates && j.rates[spec.to];
        if (!rate) throw new Error("currency not found");
        wsOut.textContent = `${spec.amt} ${spec.from} = ${fmt2(spec.amt * rate)} ${spec.to}\n\nrate: 1 ${spec.from} = ${rate} ${spec.to}\nupdated: ${j.time_last_update_utc}\nsource: open.er-api.com (daily)`;
        break;
      }

      /* ---- page audit ---- */
      case "page_audit": {
        wsOut.textContent = "fetching via proxy …";
        const html = await proxyFetch(spec.url);
        const doc = new DOMParser().parseFromString(html, "text/html");
        const title = doc.querySelector("title")?.textContent?.trim() || "(none)";
        const desc = doc.querySelector('meta[name="description"]')?.content || "(none)";
        const og = doc.querySelector('meta[property="og:image"]')?.content || "(none)";
        const h1 = [...doc.querySelectorAll("h1")].map((h) => h.textContent.trim().replace(/\s+/g, " ")).filter(Boolean);
        const imgs = [...doc.querySelectorAll("img")];
        const noAlt = imgs.filter((im) => !im.alt).length;
        const ld = [...doc.querySelectorAll('script[type="application/ld+json"]')].length;
        const canonical = doc.querySelector('link[rel="canonical"]')?.href || "(none)";
        const shopify = /cdn\.shopify\.com|myshopify/i.test(html);
        const report = [
          `URL: ${spec.url}`,
          `platform: ${shopify ? "Shopify ✓" : "not Shopify (or hidden)"}`,
          ``,
          `TITLE (${title.length}/60) ${title.length > 60 ? "⚠ truncates" : "✓"}`,
          title,
          ``,
          `META DESC (${desc.length}/155) ${desc.length > 155 ? "⚠ trim" : desc === "(none)" ? "⚠ missing" : "✓"}`,
          desc,
          ``,
          `H1: ${h1.length ? h1.join(" | ").slice(0, 140) : "⚠ no H1 found"}`,
          `images without alt: ${noAlt}/${imgs.length} ${noAlt ? "⚠ fix for a11y + image SEO" : "✓"}`,
          `structured data blocks: ${ld} ${ld ? "✓" : "⚠ add Product JSON-LD (use json_ld_builder)"}`,
          `og:image: ${og === "(none)" ? "⚠ missing — shares will look empty" : "✓ present"}`,
          `canonical: ${canonical}`,
        ].join("\n");
        wsOut.textContent = report;
        wsCopy.hidden = false;
        break;
      }

      /* ---- product scraper ---- */
      case "scrape": {
        wsOut.textContent = "fetching via proxy …";
        const html = await proxyFetch(spec.url);
        const doc = new DOMParser().parseFromString(html, "text/html");
        // try Shopify product JSON first
        let found = null;
        const pm = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g) || [];
        for (const block of pm) {
          try {
            const j = JSON.parse(block.replace(/<script type="application\/ld\+json">/, "").replace(/<\/script>/, ""));
            const obj = Array.isArray(j) ? j.find((x) => x["@type"] === "Product") : (j["@type"] === "Product" ? j : null);
            if (obj) { found = obj; break; }
          } catch (e) { /* keep looking */ }
        }
        if (found) {
          const offers = found.offers && !Array.isArray(found.offers) ? found.offers : (found.offers || [])[0] || {};
          wsOut.textContent = [
            `SOURCE: Product JSON-LD`,
            `name:  ${found.name || "—"}`,
            `price: ${offers.price || "—"} ${offers.priceCurrency || ""}`,
            `sku:   ${found.sku || "—"}`,
            `image: ${Array.isArray(found.image) ? found.image[0] : found.image || "—"}`,
            ``,
            `description:`,
            (found.description || "(none)").replace(/\s+/g, " ").slice(0, 900),
          ].join("\n");
        } else {
          const title = doc.querySelector("title")?.textContent?.trim() || "(none)";
          const h1 = doc.querySelector("h1")?.textContent?.trim() || "(none)";
          const price = doc.querySelector('[class*="price"], [data-price]')?.textContent?.trim() || "(not found)";
          const img = doc.querySelector('meta[property="og:image"]')?.content || "(none)";
          wsOut.textContent = `SOURCE: generic DOM\n\ntitle: ${title}\nh1: ${h1}\nprice: ${price}\nimage: ${img}\n\nno Product schema found — scrape is best-effort`;
        }
        wsCopy.hidden = false;
        break;
      }

      default:
        wsOut.textContent = "engine not wired yet";
    }
  }

  /* ---------- helpers ---------- */
  function escHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
  function fmt2(n) { return Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function fmtKB(b) { return b > 1048576 ? (b / 1048576).toFixed(1) + " MB" : Math.round(b / 1024) + " KB"; }
  function readImage(file) {
    return new Promise((ok, bad) => {
      const img = new Image();
      img.onload = () => ok(img);
      img.onerror = bad;
      img.src = URL.createObjectURL(file);
    });
  }

  /* ---------- static workspace button labels + language switcher ---------- */
  const wsRunBtn = $("#wsRun"), wsCopyBtn = $("#wsCopy"), wsDlBtn = $("#wsDownload");
  if (wsRunBtn) wsRunBtn.textContent = TT("armory.run", "RUN ▸");
  if (wsCopyBtn) wsCopyBtn.textContent = TT("armory.copy", "COPY");
  if (wsDlBtn) wsDlBtn.textContent = TT("armory.download", "DOWNLOAD");

  const langBtn = $("#langSwitch");
  const langModal = $("#langModal");
  const langGrid = $("#langGrid");
  const langClose = $("#langClose");

  function openLangModal() {
    if (!langModal || !hasI18N) return;
    I18N.renderMenu(langGrid, () => { if (langModal) langModal.hidden = true; });
    langModal.hidden = false;
  }
  if (langBtn && hasI18N) {
    langBtn.addEventListener("click", openLangModal);
  }
  if (langClose) langClose.addEventListener("click", () => { if (langModal) langModal.hidden = true; });
  if (langModal) langModal.addEventListener("click", (e) => { if (e.target === langModal) langModal.hidden = true; });
  if (hasI18N) {
    document.addEventListener("keydown", (e) => {
      const inInput = e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA");
      if (inInput) return;
      if (e.key.toLowerCase() === "l") openLangModal();
      if (e.key === "Escape" && langModal) langModal.hidden = true;
    });
    // re-render grid + workspace when language changes
    I18N.onChange(() => {
      document.querySelectorAll(".toolcard").forEach((el) => {
        const t = TOOLS.find((x) => x.id === el.dataset.id);
        if (!t) return;
        el.querySelector(".toolcard__name").textContent = tName(t);
        el.querySelector(".toolcard__desc").textContent = tDesc(t);
      });
      document.querySelectorAll(".tab").forEach((b) => {
        if (b.dataset.cat === "all") b.textContent = TT("armory.all", "▦ ALL [50]");
        else { const c = CATS.find((x) => x.id === b.dataset.cat); if (c) b.textContent = `${c.icon} ${cName(c)}`; }
      });
      applyFilters();
      if (current) { wsName.textContent = tName(current); wsDesc.textContent = tDesc(current); }
    });
  }
  };  // end start()

  if (window.I18N && window.I18N.ready) {
    window.I18N.ready().then(start).catch(start);
  } else {
    start();
  }
})();
