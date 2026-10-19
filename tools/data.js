/* ============================================================
   THE ARMORY — 50 free merchant tools · tool registry
   Declarative specs: {id, cat, name, desc, fields, run}
   ============================================================ */

const fmt = (n, d = 2) => {
  if (!isFinite(n)) return "—";
  return Number(n).toLocaleString("en-US", { maximumFractionDigits: d });
};
const slugify = (s) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
   .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const num = (v, fb = 0) => { const n = parseFloat(v); return isFinite(n) ? n : fb; };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const CATS = [
  { id: "catalog", name: "CATALOG & CONTENT", icon: "▣" },
  { id: "pricing", name: "PRICING & FINANCE", icon: "◈" },
  { id: "marketing", name: "MARKETING & SEO", icon: "☍" },
  { id: "ops", name: "OPERATIONS & LOGISTICS", icon: "⚙" },
  { id: "analytics", name: "ANALYTICS & UTILITIES", icon: "∿" },
];
window.CATS = CATS;

window.TOOLS = [

/* ================= CATALOG & CONTENT (10) ================= */
{ id: "slug_cleaner", cat: "catalog", name: "slug_cleaner", desc: "Turn any product name into a clean, SEO-safe URL handle.",
  fields: [{ k: "t", type: "text", label: "PRODUCT / PAGE NAME", ph: "Shopify Store Build — Custom Theme (2026)" }],
  run: (i) => `slug:\n/${slugify(i.t)}\n\ncharacters: ${slugify(i.t).length}` },

{ id: "alt_text_forge", cat: "catalog", name: "alt_text_forge", desc: "Assemble accessible, SEO-smart image alt text.",
  fields: [
    { k: "what", type: "text", label: "PRODUCT", ph: "Shopify storefront redesign" },
    { k: "mat", type: "text", label: "DETAIL / COLOR", ph: "dark espresso homepage on desktop" },
    { k: "ctx", type: "text", label: "CONTEXT (optional)", ph: "shown on a laptop during a client handoff" }],
  run: (i) => {
    const alt = `${i.what}${i.mat ? " in " + i.mat : ""}${i.ctx ? ", " + i.ctx : ""}`.replace(/\s+/g, " ").trim();
    return `alt="${alt}"\n\nlength: ${alt.length} chars ${alt.length <= 125 ? "✓ within 125-char guideline" : "⚠ over 125 — trim for screen readers"}`;
  } },

{ id: "meta_writer", cat: "catalog", name: "meta_writer", desc: "SEO title + meta description drafts with character discipline.",
  fields: [
    { k: "type", type: "select", label: "PAGE TYPE", opts: ["Product", "Collection", "Blog post", "Homepage"] },
    { k: "name", type: "text", label: "PAGE / PRODUCT NAME", ph: "Shopify Theme Customization" },
    { k: "kw", type: "text", label: "KEYWORDS", ph: "shopify theme, custom storefront, conversion" },
    { k: "brand", type: "text", label: "BRAND", ph: "Logan Solaman" }],
  run: (i) => {
    const t = i.type === "Product"
      ? `${i.name} — ${i.kw} | ${i.brand}`
      : i.type === "Collection" ? `${i.name}: ${i.kw} | ${i.brand}`
      : i.type === "Blog post" ? `${i.name} | ${i.brand} Journal`
      : `${i.brand} — ${i.kw}`;
    const d = `Shop ${i.name.toLowerCase()} — ${i.kw}. Built to last, shipped fast, backed by our guarantee. ${i.brand}.`;
    return `<title> (${t.length}/60)\n${t}${t.length > 60 ? "\n⚠ over 60 — will truncate in SERPs" : " ✓"}\n\n<meta description> (${d.length}/155)\n${d}${d.length > 155 ? "\n⚠ over 155 — trim" : " ✓"}`;
  } },

{ id: "json_ld_builder", cat: "catalog", name: "json_ld_builder", desc: "Generate Product structured data (schema.org) ready to paste.",
  fields: [
    { k: "name", type: "text", label: "PRODUCT NAME", ph: "Shopify App Development" },
    { k: "img", type: "text", label: "IMAGE URL", ph: "https://cdn.shop.../app-dev.jpg" },
    { k: "brand", type: "text", label: "BRAND", ph: "Acme Supply" },
    { k: "sku", type: "text", label: "SKU", ph: "SVC-APP-DEV" },
    { k: "price", type: "number", label: "PRICE", ph: "3800" },
    { k: "cur", type: "select", label: "CURRENCY", opts: ["USD", "HKD", "EUR", "GBP", "TWD", "JPY", "AUD"] },
    { k: "avail", type: "select", label: "AVAILABILITY", opts: ["InStock", "OutOfStock", "PreOrder"] },
    { k: "rating", type: "text", label: "REVIEW RATING (optional)", ph: "4.8 (123 reviews)" }],
  run: (i) => {
    const ld = {
      "@context": "https://schema.org", "@type": "Product",
      name: i.name, image: [i.img || undefined].filter(Boolean),
      brand: { "@type": "Brand", name: i.brand }, sku: i.sku,
      offers: { "@type": "Offer", priceCurrency: i.cur, price: num(i.price), availability: `https://schema.org/${i.avail}` },
    };
    const r = (i.rating || "").match(/([\d.]+)\s*\((\d+)/);
    if (r) ld.aggregateRating = { "@type": "AggregateRating", ratingValue: r[1], reviewCount: r[2] };
    return `<script type="application/ld+json">\n${JSON.stringify(ld, null, 2)}\n<` + `/script>`;
  } },

{ id: "sku_mapper", cat: "catalog", name: "sku_mapper", desc: "Bulk-normalize a messy SKU list.",
  fields: [
    { k: "list", type: "area", label: "ONE SKU PER LINE", ph: " store build hk\nSTORE-BUILD-HK \nstore_build_HK" },
    { k: "mode", type: "select", label: "MODE", opts: ["UPPERCASE + trim", "kebab-case", "snake_case", "Add prefix", "Remove duplicates"] },
    { k: "prefix", type: "text", label: "PREFIX (if adding)", ph: "SDN-" }],
  run: (i) => {
    let lines = i.list.split(/\n+/).map((s) => s.trim()).filter(Boolean);
    if (i.mode.startsWith("UPPER")) lines = lines.map((s) => s.toUpperCase());
    else if (i.mode === "kebab-case") lines = lines.map((s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""));
    else if (i.mode === "snake_case") lines = lines.map((s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, ""));
    else if (i.mode === "Add prefix") lines = lines.map((s) => (i.prefix || "") + s);
    else if (i.mode === "Remove duplicates") lines = [...new Set(lines)];
    return `${lines.length} SKUs:\n\n${lines.join("\n")}`;
  } },

{ id: "csv_json", cat: "catalog", name: "csv_converter", desc: "CSV ↔ JSON converter with header detection.",
  fields: [
    { k: "dir", type: "select", label: "DIRECTION", opts: ["CSV → JSON", "JSON → CSV"] },
    { k: "data", type: "area", label: "PASTE DATA", ph: 'name,price\nStore Build,4800\nSEO Audit,900' }],
  run: (i) => {
    if (i.dir.startsWith("CSV")) {
      const rows = i.data.trim().split(/\n+/).map((r) => r.split(",").map((c) => c.trim().replace(/^"|"$/g, "")));
      const head = rows.shift() || [];
      const out = rows.map((r) => Object.fromEntries(head.map((h, j) => [h, r[j] ?? ""])));
      return JSON.stringify(out, null, 2);
    }
    const arr = JSON.parse(i.data);
    if (!Array.isArray(arr) || !arr.length) return "need a JSON array of objects";
    const keys = Object.keys(arr[0]);
    return [keys.join(","), ...arr.map((o) => keys.map((k) => JSON.stringify(o[k] ?? "")).join(","))].join("\n");
  } },

{ id: "image_resizer", cat: "catalog", name: "image_resizer", desc: "Resize & compress product photos in-browser. Nothing uploads.",
  fields: [
    { k: "file", type: "file", label: "IMAGE FILE", accept: "image/*" },
    { k: "w", type: "number", label: "MAX WIDTH (px)", ph: "1600" },
    { k: "fmt", type: "select", label: "OUTPUT", opts: ["image/jpeg", "image/png", "image/webp"] },
    { k: "q", type: "number", label: "QUALITY % (jpeg/webp)", ph: "82" }],
  run: async (i) => ({ engine: "image_resize", file: i.file, w: num(i.w, 1600), fmt: i.fmt, q: num(i.q, 82) / 100 }) },

{ id: "base64_inliner", cat: "catalog", name: "base64_inliner", desc: "Convert an image to a data URI for emails / inline embeds.",
  fields: [{ k: "file", type: "file", label: "IMAGE FILE (small)", accept: "image/*" }],
  run: async (i) => ({ engine: "base64", file: i.file }) },

{ id: "collection_copy", cat: "catalog", name: "collection_namer", desc: "Draft collection descriptions from tokens.",
  fields: [
    { k: "name", type: "text", label: "COLLECTION", ph: "Growth Services" },
    { k: "tone", type: "select", label: "TONE", opts: ["Confident", "Warm", "Technical", "Playful"] },
    { k: "kw", type: "text", label: "KEYWORDS", ph: "shopify, conversion, retention" }],
  run: (i) => {
    const open = { Confident: "Built for people who commit.", Warm: "Made to be lived in.", Technical: "Engineered around performance data.", Playful: "Serious gear, zero seriousness." }[i.tone];
    return `${i.name}\n\n${open} The ${i.name} collection gathers our ${i.kw} pieces into one system — mix, match, and build the kit the season asks for.\n\nchars: ${(`The ${i.name} collection...`).length} — expand with your brand voice`;
  } },

{ id: "product_scraper", cat: "catalog", name: "product_scraper", desc: "Pull title, price, image & description off any product URL (via proxy).",
  fields: [{ k: "url", type: "text", label: "PRODUCT URL", ph: "https://store.com/products/widget" }],
  run: async (i) => ({ engine: "scrape", url: i.url }) },

/* ================= PRICING & FINANCE (10) ================= */
{ id: "margin_calculator", cat: "pricing", name: "margin_calculator", desc: "Gross margin, markup, and profit per unit.",
  fields: [
    { k: "price", type: "number", label: "SELLING PRICE", ph: "36" },
    { k: "cost", type: "number", label: "UNIT COST (COGS)", ph: "6" }],
  run: (i) => {
    const p = num(i.price), c = num(i.cost);
    return `gross profit: ${fmt(p - c)}\ngross margin: ${fmt(((p - c) / p) * 100)}%\nmarkup:      ${fmt(((p - c) / c) * 100)}%\n\n${((p - c) / p) >= 0.8 ? "✓ 80%+ — healthy headroom for paid acquisition" : "⚠ below 80% — CAC budget will be tight"}`;
  } },

{ id: "price_from_markup", cat: "pricing", name: "price_from_markup", desc: "Find the price for a target margin or markup.",
  fields: [
    { k: "cost", type: "number", label: "UNIT COST", ph: "6" },
    { k: "mode", type: "select", label: "TARGET TYPE", opts: ["Gross margin %", "Markup %"] },
    { k: "target", type: "number", label: "TARGET %", ph: "83.3" }],
  run: (i) => {
    const c = num(i.cost), t = num(i.target) / 100;
    const price = i.mode.startsWith("Gross") ? c / (1 - t) : c * (1 + t);
    return `target price: ${fmt(price)}\ncheck margin: ${fmt(((price - c) / price) * 100)}%\nprofit/unit:  ${fmt(price - c)}`;
  } },

{ id: "breakeven", cat: "pricing", name: "breakeven_calc", desc: "Units and revenue needed to cover fixed costs.",
  fields: [
    { k: "fixed", type: "number", label: "FIXED COSTS / MONTH", ph: "4500" },
    { k: "price", type: "number", label: "PRICE / UNIT", ph: "36" },
    { k: "var", type: "number", label: "VARIABLE COST / UNIT", ph: "11" }],
  run: (i) => {
    const contrib = num(i.price) - num(i.var);
    const units = num(i.fixed) / contrib;
    return `contribution/unit: ${fmt(contrib)}\nbreakeven: ${fmt(units, 0)} units\nbreakeven revenue: ${fmt(units * num(i.price))}`;
  } },

{ id: "aov_calc", cat: "pricing", name: "aov_calc", desc: "Average order value + bundle projection.",
  fields: [
    { k: "rev", type: "number", label: "TOTAL REVENUE", ph: "18200" },
    { k: "orders", type: "number", label: "ORDERS", ph: "240" },
    { k: "bundle", type: "number", label: "BUNDLE PRICE (optional)", ph: "87" }],
  run: (i) => {
    const aov = num(i.rev) / num(i.orders, 1);
    const b = num(i.bundle, 0);
    return `AOV: ${fmt(aov)}\n${b ? `\nif 30% of orders become the bundle (${fmt(b)}):\nprojected AOV: ${fmt(aov * 0.7 + b * 0.3)}\nlift: +${fmt(((aov * 0.7 + b * 0.3) / aov - 1) * 100)}%` : "add a bundle price to project AOV lift"}`;
  } },

{ id: "ltv_calc", cat: "pricing", name: "ltv_calculator", desc: "Customer lifetime value and LTV:CAC ratio.",
  fields: [
    { k: "aov", type: "number", label: "AOV", ph: "87" },
    { k: "freq", type: "number", label: "ORDERS / YEAR", ph: "2.4" },
    { k: "years", type: "number", label: "LIFESPAN (YEARS)", ph: "3" },
    { k: "margin", type: "number", label: "GROSS MARGIN %", ph: "70" },
    { k: "cac", type: "number", label: "CAC (optional)", ph: "32" }],
  run: (i) => {
    const rev = num(i.aov) * num(i.freq) * num(i.years);
    const ltv = rev * num(i.margin) / 100;
    const cac = num(i.cac, 0);
    return `lifetime revenue: ${fmt(rev)}\nLTV (margin-adjusted): ${fmt(ltv)}\n${cac ? `LTV:CAC = ${fmt(ltv / cac, 1)}x ${ltv / cac >= 3 ? "✓ healthy" : "⚠ under 3x — improve retention or CAC"}` : ""}`;
  } },

{ id: "roas_calc", cat: "pricing", name: "roas_calc", desc: "Return on ad spend + your break-even ROAS.",
  fields: [
    { k: "spend", type: "number", label: "AD SPEND", ph: "1200" },
    { k: "rev", type: "number", label: "ATTRIBUTED REVENUE", ph: "5400" },
    { k: "margin", type: "number", label: "GROSS MARGIN %", ph: "70" }],
  run: (i) => {
    const roas = num(i.rev) / num(i.spend, 1);
    const be = 1 / (num(i.margin) / 100);
    return `ROAS: ${fmt(roas, 2)}x\nbreak-even ROAS (at ${i.margin}% margin): ${fmt(be, 2)}x\n${roas >= be ? "✓ profitable headroom: " + fmt(roas - be, 2) + "x" : "⚠ below break-even"}`;
  } },

{ id: "cac_calc", cat: "pricing", name: "cac_calc", desc: "Customer acquisition cost per channel.",
  fields: [
    { k: "cost", type: "number", label: "TOTAL ACQUISITION COST", ph: "4800" },
    { k: "cust", type: "number", label: "NEW CUSTOMERS", ph: "150" }],
  run: (i) => `CAC: ${fmt(num(i.cost) / num(i.cust, 1))}\n\nrule of thumb: CAC should recover in the first order\nor be comfortably covered by LTV (see ltv_calculator)` },

{ id: "discount_stack", cat: "pricing", name: "discount_stacker", desc: "Stack sequential discounts and see the true effective cut.",
  fields: [
    { k: "price", type: "number", label: "ORIGINAL PRICE", ph: "148" },
    { k: "d1", type: "number", label: "DISCOUNT 1 %", ph: "20" },
    { k: "d2", type: "number", label: "DISCOUNT 2 % (optional)", ph: "10" },
    { k: "d3", type: "number", label: "DISCOUNT 3 % (optional)", ph: "" }],
  run: (i) => {
    let p = num(i.price); const start = p;
    [i.d1, i.d2, i.d3].forEach((d) => { const v = num(d, 0); if (v) p = p * (1 - v / 100); });
    return `final price: ${fmt(p)}\neffective discount: ${fmt((1 - p / start) * 100)}% (not the sum!)\nmargin erosion check: stack wisely — each layer is real money`;
  } },

{ id: "currency_convert", cat: "pricing", name: "currency_convert", desc: "Live FX conversion (open.er-api.com rates).",
  fields: [
    { k: "amt", type: "number", label: "AMOUNT", ph: "100" },
    { k: "from", type: "select", label: "FROM", opts: ["USD", "HKD", "EUR", "GBP", "TWD", "JPY", "AUD", "CAD", "CNY", "KRW", "SGD"] },
    { k: "to", type: "select", label: "TO", opts: ["HKD", "USD", "EUR", "GBP", "TWD", "JPY", "AUD", "CAD", "CNY", "KRW", "SGD"] }],
  run: async (i) => ({ engine: "fx", amt: num(i.amt), from: i.from, to: i.to }) },

{ id: "invoice_gen", cat: "pricing", name: "invoice_gen", desc: "Compose a printable invoice → save as PDF via print dialog.",
  fields: [
    { k: "seller", type: "area", label: "YOUR BUSINESS (name + address)", ph: "Acme Supply Co\n12 Harbour Rd, HK" },
    { k: "client", type: "area", label: "BILL TO", ph: "Acme Trading\n8 Queen St, HK" },
    { k: "lines", type: "area", label: "LINE ITEMS — name, qty, unit price (one per line)", ph: "Storefront Build, 1, 4800\nTheme Customization, 2, 950" },
    { k: "tax", type: "number", label: "TAX RATE %", ph: "0" },
    { k: "cur", type: "text", label: "CURRENCY", ph: "HKD" },
    { k: "inv", type: "text", label: "INVOICE #", ph: "INV-0042" },
    { k: "terms", type: "text", label: "PAYMENT TERMS", ph: "Net 14" }],
  run: (i) => ({ engine: "invoice", ...i }) },

/* ================= MARKETING & SEO (10) ================= */
{ id: "seo_auditor", cat: "marketing", name: "seo_auditor", desc: "Spot-check any page's title, meta, OG tags and schema.",
  fields: [{ k: "url", type: "text", label: "PAGE URL", ph: "https://yourstore.com/products/widget" }],
  run: async (i) => ({ engine: "page_audit", url: i.url }) },

{ id: "keyword_density", cat: "marketing", name: "keyword_density", desc: "Word frequency + keyword density for product copy.",
  fields: [
    { k: "text", type: "area", label: "PASTE COPY", ph: "..." },
    { k: "kw", type: "text", label: "TARGET KEYWORD", ph: "shopify developer" }],
  run: (i) => {
    const words = i.text.toLowerCase().match(/[a-z0-9']+/g) || [];
    const freq = {};
    words.forEach((w) => freq[w] = (freq[w] || 0) + 1);
    const top = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([w, c]) => `${w}: ${c} (${fmt((c / words.length) * 100, 1)}%)`);
    const kwc = i.kw ? (i.text.toLowerCase().split(i.kw.toLowerCase()).length - 1) : 0;
    return `${words.length} words total\n\n${i.kw ? `"${i.kw}" appears ${kwc}x (${fmt((kwc / Math.max(1, words.length / i.kw.split(" ").length)) * 100, 1)}% phrase density)\n\n` : ""}top words:\n${top.join("\n")}`;
  } },

{ id: "utm_builder", cat: "marketing", name: "utm_builder", desc: "Build tagged campaign links with instant preview.",
  fields: [
    { k: "url", type: "text", label: "DESTINATION URL", ph: "https://yourstore.com/sale" },
    { k: "src", type: "text", label: "SOURCE", ph: "instagram" },
    { k: "med", type: "text", label: "MEDIUM", ph: "paid_social" },
    { k: "camp", type: "text", label: "CAMPAIGN", ph: "ss26_launch" },
    { k: "term", type: "text", label: "TERM (optional)", ph: "" },
    { k: "cont", type: "text", label: "CONTENT (optional)", ph: "story_v2" }],
  run: (i) => {
    const u = new URL(i.url.startsWith("http") ? i.url : "https://" + i.url);
    u.searchParams.set("utm_source", slugify(i.src));
    u.searchParams.set("utm_medium", slugify(i.med));
    u.searchParams.set("utm_campaign", slugify(i.camp));
    if (i.term) u.searchParams.set("utm_term", slugify(i.term));
    if (i.cont) u.searchParams.set("utm_content", slugify(i.cont));
    return `${u.href}\n\npaste into GA4 / Shopify attribution to track`;
  } },

{ id: "qrcode_gen", cat: "marketing", name: "qrcode_gen", desc: "QR codes for packaging, receipts, and O2O flows.",
  fields: [
    { k: "data", type: "text", label: "TEXT / URL", ph: "https://yourstore.com/menu" },
    { k: "size", type: "number", label: "SIZE (px)", ph: "280" },
    { k: "lvl", type: "select", label: "ERROR CORRECTION", opts: ["M (standard)", "L", "Q", "H (max)"] }],
  run: async (i) => ({ engine: "qr", data: i.data, size: num(i.size, 280), lvl: i.lvl[0] }) },

{ id: "subject_line_tester", cat: "marketing", name: "subject_line_tester", desc: "Score email subject lines before you send.",
  fields: [{ k: "s", type: "text", label: "SUBJECT LINE", ph: "Your daily glow is waiting ✨" }],
  run: (i) => {
    const s = i.s; let score = 100; const notes = [];
    if (s.length < 30) { notes.push(`short (${s.length}) — 35–50 chars ideal`); score -= 15; }
    if (s.length > 60) { notes.push(`long (${s.length}) — will truncate on mobile`); score -= 20; }
    const spam = (s.match(/\b(FREE|WINNER|\$\$\$|BUY NOW|LIMITED TIME ONLY|ACT NOW)\b/gi) || []).length;
    if (spam) { notes.push(`${spam} spam-trigger phrase(s)`); score -= spam * 18; }
    if (/[!]{2,}/.test(s)) { notes.push("multiple ! reads as shouting"); score -= 10; }
    if (/\{.*\}|{name}|first name/i.test(s)) { notes.push("✓ personalization token"); score += 8; }
    if (/[\u{1F300}-\u{1FAFF}\u2728]/u.test(s)) { notes.push("✓ emoji present (1 max is fine)"); score += 4; }
    if (/[a-z]/.test(s) && s === s.toUpperCase()) { notes.push("ALL CAPS"); score -= 15; }
    return `score: ${Math.max(0, Math.min(100, score))}/100\nlength: ${s.length} chars\n\nnotes:\n${notes.length ? notes.map((n) => "· " + n).join("\n") : "· clean — no flags"}`;
  } },

{ id: "social_char_counter", cat: "marketing", name: "social_char_counter", desc: "Check caption length against every platform's limit.",
  fields: [{ k: "t", type: "area", label: "CAPTION TEXT", ph: "..." }],
  run: (i) => {
    const n = i.t.length;
    const limits = [["X / Twitter", 280], ["Instagram", 2200], ["TikTok caption", 2200], ["LinkedIn post", 3000], ["Facebook", 63206], ["YouTube title", 100], ["Pinterest pin title", 100]];
    return limits.map(([p, l]) => `${n}/${l} ${p} ${n <= l ? "✓" : "✗ over by " + (n - l)}`).join("\n");
  } },

{ id: "hashtag_kit", cat: "marketing", name: "hashtag_kit", desc: "Niche hashtag sets sized for reach tiers.",
  fields: [
    { k: "niche", type: "select", label: "NICHE", opts: ["Fashion", "Outdoor", "Food & beverage", "Beauty & wellness", "Tech gadgets", "Art & craft", "Home & living"] },
    { k: "custom", type: "text", label: "BRAND / PRODUCT WORDS", ph: "shopify expert" }],
  run: (i) => {
    const sets = {
      "Fashion": ["ootd", "styleinspo", "fashiondaily", "lookbook", "wardrobe", "streetstyle", "capsulewardrobe", "slowfashion", "outfitideas", "fashiongram"],
      "Outdoor": ["hiking", "trailrunning", "campinglife", "outdoorlife", "adventureseeker", "gearhead", "mountainlife", "backpacking", "getoutside", "basecamp"],
      "Food & beverage": ["foodie", "homecooking", "foodphotography", "instafood", "recipeoftheday", "foodlover", "kitchenlife", "eatwell", "foodgram", "chefmode"],
      "Beauty & wellness": ["skincare", "selfcare", "glow", "wellnessjourney", "cleanbeauty", "skincareroutine", "beautytips", "selflove", "rituals", "holistichealth"],
      "Tech gadgets": ["tech", "gadgets", "gear", "unboxing", "techtok", "innovation", "smartlife", "everydaycarry", "edc", "futuretech"],
      "Art & craft": ["art", "artistsoninstagram", "handmade", "craft", "artdaily", "studio", "creativeprocess", "artcollector", "contemporaryart", "makersmovement"],
      "Home & living": ["homedecor", "interior", "homedesign", "cozyhome", "livingroom", "homeinspo", "decorideas", "homestyle", "modernhome", "houselove"],
    };
    const base = sets[i.niche] || [];
    const customs = i.custom.split(/\s+/).filter(Boolean).map((w) => slugify(w).replace(/-/g, ""));
    return `high-reach: #${base.slice(0, 4).join(" #")}\nmid-tier:   #${base.slice(4, 8).join(" #")}\nniche:      #${base.slice(8).join(" #")}${customs.length ? "\nbrand:      #" + customs.join(" #") : ""}\n\nmix 3/5/5 per post; rotate sets to avoid shadow-flagging`;
  } },

{ id: "sample_size_calc", cat: "marketing", name: "ab_test_calc", desc: "Sample size per variant for an A/B test.",
  fields: [
    { k: "base", type: "number", label: "BASELINE CONVERSION %", ph: "2.4" },
    { k: "mde", type: "number", label: "MIN DETECTABLE LIFT (relative %)", ph: "15" },
    { k: "conf", type: "select", label: "CONFIDENCE", opts: ["95%", "90%", "99%"] }],
  run: (i) => {
    const p1 = num(i.base) / 100, lift = num(i.mde) / 100;
    const p2 = p1 * (1 + lift);
    const z = { "90%": 1.645, "95%": 1.96, "99%": 2.576 }[i.conf] + 0.84; // alpha + power 0.8
    const n = Math.ceil((z * z * (p1 * (1 - p1) + p2 * (1 - p2))) / Math.pow(p2 - p1, 2));
    return `${fmt(n, 0)} visitors PER VARIANT\n${fmt(n * 2, 0)} total\n\nat ${i.base}% CR with ${i.lift}% expected lift, ${i.conf} confidence, 80% power`;
  } },

{ id: "coupon_gen", cat: "marketing", name: "coupon_gen", desc: "Generate unguessable coupon codes in bulk.",
  fields: [
    { k: "style", type: "select", label: "STYLE", opts: ["Readable (A-Z 0-9)", "Random mixed", "Words (XMAS-GLOW)"] },
    { k: "prefix", type: "text", label: "PREFIX (optional)", ph: "SS26-" },
    { k: "n", type: "number", label: "HOW MANY", ph: "10" },
    { k: "len", type: "number", label: "CODE LENGTH", ph: "8" }],
  run: (i) => {
    const n = Math.min(200, num(i.n, 10)), len = Math.min(20, Math.max(4, num(i.len, 8)));
    const read = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    const mix = read + "abcdefghjkmnpqrstuvwxyz";
    const words = ["GLOW", "RITUAL", "SPARK", "CALM", "DRIFT", "BLOOM", "PEAK", "TIDE", "DUSK", "EMBER", "CREST", "NOVA"];
    const codes = Array.from({ length: n }, () => {
      let c;
      if (i.style.startsWith("Words")) c = words[Math.floor(Math.random() * words.length)] + "-" + words[Math.floor(Math.random() * words.length)];
      else {
        const pool = i.style.startsWith("Readable") ? read : mix;
        c = Array.from({ length: len }, () => pool[Math.floor(Math.random() * pool.length)]).join("").toUpperCase();
      }
      return (i.prefix || "") + c;
    });
    return codes.join("\n") + `\n\n${n} codes — check collisions against your existing set`;
  } },

{ id: "launch_countdown", cat: "marketing", name: "launch_countdown", desc: "Days to launch + date arithmetic for campaign planning.",
  fields: [
    { k: "mode", type: "select", label: "MODE", opts: ["Countdown to date", "Add N days to date"] },
    { k: "date", type: "date", label: "TARGET DATE", ph: "" },
    { k: "days", type: "number", label: "DAYS (for add mode)", ph: "30" }],
  run: (i) => {
    const d = new Date(i.date + "T00:00:00");
    if (isNaN(d)) return "pick a date first";
    if (i.mode.startsWith("Add")) {
      const r = new Date(d.getTime() + num(i.days) * 864e5);
      return `${d.toDateString()} + ${i.days} days =\n${r.toDateString()}\n\n${[7, 14, 30].map((w) => `minus ${w}d checkpoint: ${new Date(r.getTime() - w * 864e5).toDateString()}`).join("\n")}`;
    }
    const diff = Math.ceil((d - Date.now()) / 864e5);
    return diff > 0 ? `${diff} days until ${d.toDateString()}\n\nT-${Math.min(diff, 30)}d email: teaser\nT-7d: sample ship-out\nT-1d: early-access link\nT-0: launch` : `that date passed ${-diff} days ago`;
  } },

/* ================= OPERATIONS & LOGISTICS (10) ================= */
{ id: "order_email_templates", cat: "ops", name: "order_emails", desc: "Fill tokens into shipping / delay / cancel / refund templates.",
  fields: [
    { k: "type", type: "select", label: "TEMPLATE", opts: ["Order shipped", "Shipping delayed", "Order cancelled", "Refund issued", "Back in stock"] },
    { k: "name", type: "text", label: "CUSTOMER NAME", ph: "Ada" },
    { k: "order", type: "text", label: "ORDER #", ph: "#1042" },
    { k: "extra", type: "text", label: "TRACKING / ETA / ITEM", ph: "SF1234567 · arrives Thu" }],
  run: (i) => {
    const t = {
      "Order shipped": `Subject: ${i.order} is on its way\n\nHi ${i.name},\n\nGood news — your order has shipped.\n${i.extra}\n\nYou'll get a second note when it lands. If anything looks off, reply here and a human answers.\n\n— the team`,
      "Shipping delayed": `Subject: An honest update on ${i.order}\n\nHi ${i.name},\n\nYour order is running later than we promised. ${i.extra}\n\nNo action needed from you — and if the new date doesn't work, reply and we'll make it right.\n\n— the team`,
      "Order cancelled": `Subject: ${i.order} — confirmed cancelled\n\nHi ${i.name},\n\nDone. Your order is cancelled and any payment released (refunds show in 3–5 business days).\n\nIf this was a mistake, reply within the hour and we'll try to catch it.\n\n— the team`,
      "Refund issued": `Subject: Your refund for ${i.order}\n\nHi ${i.name},\n\nRefund issued: ${i.extra || "full amount"}. It lands in 3–5 business days depending on your bank.\n\nNo forms, no hoops. Thanks for giving us the chance.\n\n— the team`,
      "Back in stock": `Subject: It's back — and you asked first\n\nHi ${i.name},\n\n${i.extra || "The item you watched"} is back in stock. Early list gets first pick — no code needed.\n\n— the team`,
    };
    return t[i.type];
  } },

{ id: "volumetric_weight", cat: "ops", name: "dim_weight_calc", desc: "Billable weight: actual vs volumetric (DIM).",
  fields: [
    { k: "l", type: "number", label: "LENGTH (cm)", ph: "30" },
    { k: "w", type: "number", label: "WIDTH (cm)", ph: "22" },
    { k: "h", type: "number", label: "HEIGHT (cm)", ph: "12" },
    { k: "aw", type: "number", label: "ACTUAL WEIGHT (kg)", ph: "1.4" },
    { k: "dim", type: "select", label: "DIM FACTOR", opts: ["5000 (courier)", "6000 (air freight)"] }],
  run: (i) => {
    const f = num(i.dim.split(" ")[0], 5000);
    const vol = (num(i.l) * num(i.w) * num(i.h)) / f;
    const aw = num(i.aw);
    const bill = Math.max(vol, aw);
    return `volumetric: ${fmt(vol)} kg\nactual:     ${fmt(aw)} kg\nbillable:   ${fmt(bill)} kg ← carrier charges this\n\n${vol > aw ? "⚠ you're paying for air — can the box shrink?" : "✓ weight-dominant"}`;
  } },

{ id: "reorder_point", cat: "ops", name: "reorder_point", desc: "When to reorder, and how much.",
  fields: [
    { k: "sales", type: "number", label: "AVG DAILY SALES (units)", ph: "6" },
    { k: "lead", type: "number", label: "LEAD TIME (days)", ph: "21" },
    { k: "safety", type: "number", label: "SAFETY STOCK (units)", ph: "40" },
    { k: "review", type: "number", label: "REVIEW CYCLE (days, optional)", ph: "7" }],
  run: (i) => {
    const s = num(i.sales), rop = s * num(i.lead) + num(i.safety);
    const rc = num(i.review, 0);
    return `reorder point: ${fmt(rop, 0)} units\n(sales during lead time + safety stock)\n${rc ? `\norder-up-to level (periodic review): ${fmt(s * (num(i.lead) + rc) + num(i.safety), 0)} units\nsuggested order qty: ${fmt(s * (num(i.lead) + rc) + num(i.safety) - rop + s * rc, 0)} — adjust for current stock` : ""}`;
  } },

{ id: "stock_turn", cat: "ops", name: "stock_turn_calc", desc: "Inventory turnover + days of stock on hand.",
  fields: [
    { k: "cogs", type: "number", label: "COGS (period)", ph: "96000" },
    { k: "inv", type: "number", label: "AVG INVENTORY VALUE", ph: "24000" }],
  run: (i) => {
    const t = num(i.cogs) / num(i.inv, 1);
    return `turnover: ${fmt(t, 1)}x per year\ndays of stock: ${fmt(365 / t, 0)}\n\nbenchmarks: fashion 3–4x, consumables 8–12x, gadgets 4–6x`;
  } },

{ id: "pdf_ocr", cat: "ops", name: "pdf-ocr", desc: "Extract text from PDFs (invoices, packing lists) in-browser.",
  fields: [{ k: "file", type: "file", label: "PDF FILE", accept: "application/pdf" }],
  run: async (i) => ({ engine: "pdf_text", file: i.file }) },

{ id: "csv_splitter", cat: "ops", name: "csv_splitter", desc: "Split a big CSV into chunks of N rows (bulk imports).",
  fields: [
    { k: "csv", type: "area", label: "CSV (with header)", ph: "sku,price\nA,1\nB,2" },
    { k: "rows", type: "number", label: "ROWS PER FILE", ph: "500" }],
  run: (i) => {
    const lines = i.csv.trim().split(/\n+/);
    const head = lines.shift(); const per = Math.max(1, num(i.rows, 500));
    const chunks = [];
    for (let j = 0; j < lines.length; j += per) chunks.push([head, ...lines.slice(j, j + per)].join("\n"));
    return { download: chunks.map((c, idx) => ({ name: `chunk_${idx + 1}.csv`, content: c })), summary: `${chunks.length} files × ≤${per} rows from ${lines.length} data rows` };
  } },

{ id: "bulk_find_replace", cat: "ops", name: "bulk_find_replace", desc: "Find & replace across pasted text, regex-capable.",
  fields: [
    { k: "text", type: "area", label: "TEXT", ph: "..." },
    { k: "find", type: "text", label: "FIND", ph: "colour" },
    { k: "repl", type: "text", label: "REPLACE WITH", ph: "color" },
    { k: "regex", type: "check", label: "USE REGEX" }],
  run: (i) => {
    let count = 0;
    const re = new RegExp(i.find, i.regex ? "g" : "gi");
    const out = i.text.replace(re, () => { count++; return i.repl; });
    return `${count} replacement(s)\n\n${out}`;
  } },

{ id: "ean_checker", cat: "ops", name: "ean_upc_check", desc: "Validate EAN-13 / EAN-8 / UPC-A check digits.",
  fields: [{ k: "codes", type: "area", label: "ONE CODE PER LINE", ph: "4891234567892\n036000291452" }],
  run: (i) => i.codes.split(/\n+/).map((s) => s.trim()).filter(Boolean).map((c) => {
    if (!/^\d+$/.test(c)) return `${c} — ✗ digits only`;
    const len = c.length;
    if (![8, 12, 13, 14].includes(len)) return `${c} — ✗ unsupported length ${len}`;
    const digits = c.split("").map(Number);
    const check = digits.pop();
    const sum = digits.reverse().reduce((acc, d, j) => acc + d * (j % 2 === 0 ? 3 : 1), 0);
    const expect = (10 - (sum % 10)) % 10;
    return `${c} — ${check === expect ? "✓ valid" : `✗ check digit should be ${expect}`}`;
  }).join("\n") },

{ id: "shipping_rate_table", cat: "ops", name: "shipping_rates", desc: "Zone-based rate estimator (editable default card).",
  fields: [
    { k: "zone", type: "select", label: "ZONE", opts: ["HK local", "US", "Europe", "Asia regional", "Australia"] },
    { k: "w", type: "number", label: "BILLABLE WEIGHT (kg)", ph: "1.2" },
    { k: "base", type: "text", label: "BASE / FIRST-KG / PER-KG (comma)", ph: "30, 30, 12" }],
  run: (i) => {
    const defaults = { "HK local": "25,25,6", "US": "140,140,55", "Europe": "150,150,60", "Asia regional": "80,80,30", "Australia": "140,140,55" };
    const card = (i.base || defaults[i.zone]).split(",").map((x) => num(x.trim()));
    const w = Math.max(0, num(i.w) - 1);
    const rate = card[0] + w * card[2];
    return `estimate: ${fmt(rate)} (${i.zone})\n\nfirst kg: ${card[0]} · each extra kg: ${card[2]}\nedit the card above to match your 3PL rate sheet`;
  } },

{ id: "packing_list", cat: "ops", name: "packing_list_gen", desc: "Turn order lines into a warehouse-ready packing list.",
  fields: [{ k: "lines", type: "area", label: "SKU, QTY (one per line)", ph: "SVC-THEME-01, 2\nSVC-SEO-01, 1" }],
  run: (i) => {
    const rows = i.lines.split(/\n+/).map((l) => l.split(",")).map((p) => ({ sku: (p[0] || "").trim(), qty: num(p[1], 1) })).filter((r) => r.sku);
    const total = rows.reduce((a, r) => a + r.qty, 0);
    return rows.map((r) => `[ ] ${r.sku} × ${r.qty}`).join("\n") + `\n\n────\n${rows.length} line(s) · ${total} unit(s)\npacked by: ______  date: ______`;
  } },

/* ================= ANALYTICS & UTILITIES (10) ================= */
{ id: "funnel_calc", cat: "analytics", name: "conversion_funnel", desc: "Step-by-step drop-off from session to purchase.",
  fields: [
    { k: "sess", type: "number", label: "SESSIONS", ph: "18400" },
    { k: "atc", type: "number", label: "ADD TO CART", ph: "1150" },
    { k: "co", type: "number", label: "REACHED CHECKOUT", ph: "610" },
    { k: "pur", type: "number", label: "PURCHASES", ph: "380" }],
  run: (i) => {
    const s = num(i.sess, 1), a = num(i.atc), c = num(i.co), p = num(i.pur);
    return `sessions → ATC:      ${fmt((a / s) * 100)}%  (lose ${fmt(s - a, 0)})\nATC → checkout:      ${fmt((c / a) * 100)}%\ncheckout → purchase: ${fmt((p / c) * 100)}%\noverall CVR:         ${fmt((p / s) * 100)}%\n\nbiggest leak wins your next sprint — fix the step with the worst %`;
  } },

{ id: "profit_per_order", cat: "analytics", name: "profit_per_order", desc: "True net profit after fees, shipping, and duties.",
  fields: [
    { k: "price", type: "number", label: "ORDER VALUE", ph: "87" },
    { k: "cogs", type: "number", label: "COGS", ph: "18" },
    { k: "pct", type: "number", label: "PAYMENT FEE %", ph: "3.4" },
    { k: "flat", type: "number", label: "PAYMENT FLAT FEE", ph: "2.35" },
    { k: "ship", type: "number", label: "SHIPPING COST", ph: "9" },
    { k: "other", type: "number", label: "DUTIES / OTHER", ph: "0" }],
  run: (i) => {
    const fees = num(i.price) * num(i.pct) / 100 + num(i.flat);
    const net = num(i.price) - num(i.cogs) - fees - num(i.ship) - num(i.other);
    return `fees: ${fmt(fees)}\nnet profit: ${fmt(net)}\nnet margin: ${fmt((net / num(i.price, 1)) * 100)}%\n\n${net < 0 ? "⚠ negative — this order loses money" : net / num(i.price) < 0.15 ? "⚠ thin — watch CAC on top" : "✓ healthy"}`;
  } },

{ id: "refund_rate", cat: "analytics", name: "refund_rate_calc", desc: "Refund rate by count and by dollars.",
  fields: [
    { k: "orders", type: "number", label: "ORDERS", ph: "240" },
    { k: "refunds", type: "number", label: "REFUNDED ORDERS", ph: "9" },
    { k: "rev", type: "number", label: "REVENUE", ph: "21000" },
    { k: "refamt", type: "number", label: "REFUNDED $", ph: "810" }],
  run: (i) => {
    const rc = (num(i.refunds) / num(i.orders, 1)) * 100;
    const ra = (num(i.refamt) / num(i.rev, 1)) * 100;
    return `by orders: ${fmt(rc)}%\nby revenue: ${fmt(ra)}%\n\nhealthy ecommerce: < 5% count. Above 8% → audit sizing/copy/QC`;
  } },

{ id: "review_reply", cat: "analytics", name: "review_responder", desc: "Draft on-brand replies to customer reviews.",
  fields: [
    { k: "tone", type: "select", label: "REVIEW SENTIMENT", opts: ["5-star praise", "4-star with a note", "3-star mixed", "1-2 star complaint"] },
    { k: "review", type: "area", label: "THE REVIEW", ph: "..." },
    { k: "brand", type: "text", label: "BRAND NAME", ph: "Acme Supply" }],
  run: (i) => {
    const t = {
      "5-star praise": `Thank you — this made our day at ${i.brand}. Reviews like yours are how small brands grow without ad budgets. If you ever want early access to what's next, reply here. Enjoy the gear.`,
      "4-star with a note": `Thanks for the kind words and the honest note — that second part is the useful part. We're reading it carefully. If you'll tell us more, we'd genuinely like to close that gap.`,
      "3-star mixed": `Appreciate you taking the time to write this. We'd rather earn a 5 than ask for one — tell us what would have made this a yes, and we'll do our best to make it right.`,
      "1-2 star complaint": `This isn't the experience we build for, and we're sorry. Reply with your order number and a human (not a queue) will sort it — replacement or refund, your call.`,
    };
    return t[i.tone] + `\n\n— personalize the first line by quoting one phrase from their review`;
  } },

{ id: "nps_calc", cat: "analytics", name: "nps_score", desc: "Net Promoter Score from a list of 0–10 responses.",
  fields: [{ k: "scores", type: "area", label: "SCORES (comma/space/newline)", ph: "9, 10, 8, 7, 10, 6, 9, 10, 5, 9" }],
  run: (i) => {
    const s = i.scores.split(/[\s,;]+/).map(Number).filter((n) => n >= 0 && n <= 10);
    if (!s.length) return "paste 0–10 scores first";
    const prom = s.filter((n) => n >= 9).length, det = s.filter((n) => n <= 6).length;
    return `${s.length} responses\npromoters: ${prom} · passives: ${s.length - prom - det} · detractors: ${det}\nNPS: ${Math.round(((prom - det) / s.length) * 100)}\n\n> 50 = excellent, 0–30 = room to grow`;
  } },

{ id: "retention_cohort", cat: "analytics", name: "cohort_retention", desc: "Turn monthly repeat-purchase counts into retention %.",
  fields: [{ k: "data", type: "area", label: "COHORT SIZE, M1, M2, M3… (one cohort per line)", ph: "120, 54, 40, 33\n90, 38, 31" }],
  run: (i) => {
    const rows = i.data.split(/\n+/).map((r) => r.split(/[,\s]+/).map(Number).filter(isFinite)).filter((r) => r.length >= 2);
    return rows.map((r, idx) => {
      const base = r[0];
      return `cohort ${idx + 1} (n=${base}): ` + r.slice(1).map((v, m) => `M${m + 1} ${fmt((v / base) * 100, 0)}%`).join(" · ");
    }).join("\n") + "\n\nbenchmark: 20%+ M1 repeat for consumables is strong";
  } },

{ id: "world_clocks", cat: "analytics", name: "launch_clock", desc: "Launch timing across your customer timezones.",
  fields: [{ k: "when", type: "text", label: "YOUR LOCAL LAUNCH TIME", ph: "2026-09-01 10:00" }],
  run: (i) => {
    const zones = ["Asia/Hong_Kong", "Asia/Tokyo", "Asia/Singapore", "Australia/Sydney", "Europe/London", "Europe/Paris", "America/New_York", "America/Los_Angeles", "America/Sao_Paulo", "Asia/Dubai", "Asia/Taipei", "Asia/Seoul"];
    const d = i.when ? new Date(i.when.replace(" ", "T")) : new Date();
    const label = isNaN(d) ? "(now)" : `(from ${i.when} local)`;
    return zones.map((z) => {
      try { return `${new Intl.DateTimeFormat("en-US", { timeZone: z, weekday: "short", hour: "2-digit", minute: "2-digit" }).format(isNaN(d) ? new Date() : d)} — ${z.split("/")[1].replace("_", " ")}`; } catch { return `${z} — n/a`; }
    }).join("\n") + `\n${label}`;
  } },

{ id: "unit_converter", cat: "analytics", name: "unit_converter", desc: "Weight / length conversions for product specs.",
  fields: [
    { k: "v", type: "number", label: "VALUE", ph: "250" },
    { k: "u", type: "select", label: "FROM UNIT", opts: ["grams", "kg", "oz", "lb", "cm", "in", "mm", "ft"] }],
  run: (i) => {
    const v = num(i.v);
    const W = { grams: 1, kg: 1000, oz: 28.3495, lb: 453.592 };
    const L = { cm: 1, mm: 0.1, in: 2.54, ft: 30.48 };
    if (W[i.u]) {
      const g = v * W[i.u];
      return `${fmt(g, 1)} g\n${fmt(g / 1000, 3)} kg\n${fmt(g / 28.3495, 2)} oz\n${fmt(g / 453.592, 3)} lb`;
    }
    const c = v * L[i.u];
    return `${fmt(c, 1)} cm\n${fmt(c * 10, 0)} mm\n${fmt(c / 2.54, 2)} in\n${fmt(c / 30.48, 2)} ft`;
  } },

{ id: "token_gen", cat: "analytics", name: "token_gen", desc: "Strong tokens for API keys, webhooks, and secrets.",
  fields: [
    { k: "n", type: "number", label: "HOW MANY", ph: "3" },
    { k: "len", type: "number", label: "LENGTH", ph: "32" },
    { k: "charset", type: "select", label: "CHARSET", opts: ["hex (safe everywhere)", "alphanumeric", "full (with symbols)"] }],
  run: (i) => {
    const pools = { "hex (safe everywhere)": "0123456789abcdef", "alphanumeric": "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789", "full (with symbols)": "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*-_+=" };
    const pool = pools[i.charset];
    const len = Math.min(128, Math.max(8, num(i.len, 32)));
    const arr = new Uint32Array(len);
    crypto.getRandomValues(arr);
    return Array.from({ length: Math.min(20, num(i.n, 1)) }, () =>
      Array.from(arr).map((x) => pool[x % pool.length]).join("")
    ).join("\n") + "\n\nstore in env vars — never in theme code";
  } },

{ id: "text_diff", cat: "analytics", name: "text_diff", desc: "Line-by-line diff — compare two versions of copy.",
  fields: [
    { k: "a", type: "area", label: "VERSION A", ph: "..." },
    { k: "b", type: "area", label: "VERSION B", ph: "..." }],
  run: (i) => {
    const a = i.a.split(/\n/), b = i.b.split(/\n/);
    const max = Math.max(a.length, b.length); const out = [];
    for (let j = 0; j < max; j++) {
      if (a[j] === b[j]) out.push("  " + (a[j] ?? ""));
      else { if (a[j] !== undefined) out.push("- " + a[j]); if (b[j] !== undefined) out.push("+ " + b[j]); }
    }
    return out.join("\n") || "identical";
  } },
];
