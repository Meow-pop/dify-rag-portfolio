(function attachMarketCollectorUtils(root) {
  "use strict";

  function normalizeWhitespace(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function parsePrice(value) {
    const text = normalizeWhitespace(value);
    const currencyMatch = text.match(/[¥￥]\s*([0-9]{1,7}(?:\.[0-9]{1,2})?)/);
    const looseMatch = text.match(/^([0-9]{1,7}(?:\.[0-9]{1,2})?)(?:\s*元|\s*起)?$/);
    const match = currencyMatch || looseMatch;
    return match ? Number(match[1]) : null;
  }

  function canonicalizeProductUrl(value, baseUrl) {
    try {
      const url = new URL(value, baseUrl);
      const hostname = url.hostname.toLowerCase();
      if (!hostname.endsWith("taobao.com") && !hostname.endsWith("tmall.com")) {
        return null;
      }

      if (hostname === "click.simba.taobao.com" || hostname === "uland.taobao.com") {
        url.hash = "";
        return url.toString();
      }

      const id = url.searchParams.get("id");
      const canonical = new URL(url.origin + url.pathname);
      if (id) {
        canonical.searchParams.set("id", id);
      }
      return canonical.toString();
    } catch (_error) {
      return null;
    }
  }

  function safeCsvCell(value) {
    let text = normalizeWhitespace(value);
    if (/^[=+\-@]/.test(text)) {
      text = "'" + text;
    }
    return '"' + text.replace(/"/g, '""') + '"';
  }

  function toCsv(items) {
    const fields = [
      "rank",
      "title",
      "price_text",
      "price_value",
      "shop",
      "sales_text",
      "location",
      "product_url",
      "image_url"
    ];
    const rows = [fields.map(safeCsvCell).join(",")];
    for (const item of items) {
      rows.push(fields.map((field) => safeCsvCell(item[field] ?? "")).join(","));
    }
    return "\uFEFF" + rows.join("\r\n");
  }

  function safeFilenamePart(value) {
    const normalized = normalizeWhitespace(value || "taobao")
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
      .replace(/\.+$/g, "")
      .slice(0, 50);
    return normalized || "taobao";
  }

  root.MarketCollectorUtils = Object.freeze({
    canonicalizeProductUrl,
    normalizeWhitespace,
    parsePrice,
    safeFilenamePart,
    toCsv
  });
})(globalThis);
