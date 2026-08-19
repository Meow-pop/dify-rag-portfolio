(function attachTaobaoCollector() {
  "use strict";

  const utils = globalThis.MarketCollectorUtils;
  const PRODUCT_LINK_SELECTOR = [
    'a[href*="item.taobao.com/item.htm"]',
    'a[href*="detail.tmall.com/item.htm"]',
    'a[href*="item.taobao.com/"]',
    'a[href*="detail.tmall.com/"]'
  ].join(",");

  function isRendered(element) {
    if (!(element instanceof Element)) {
      return false;
    }
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
  }

  function detectAccessBarrier() {
    const text = utils.normalizeWhitespace(document.body?.innerText).slice(0, 12000);
    const patterns = [
      /访问过于频繁/,
      /请完成(?:安全)?验证/,
      /滑动.*验证/,
      /安全验证/,
      /验证码/
    ];
    const match = patterns.find((pattern) => pattern.test(text));
    return match ? "页面出现访问限制或验证码，请停止采集并由用户处理。" : null;
  }

  function findCard(link) {
    let current = link;
    let fallback = link.parentElement;
    for (let depth = 0; current && depth < 8; depth += 1, current = current.parentElement) {
      if (!isRendered(current)) {
        continue;
      }
      const textLength = utils.normalizeWhitespace(current.innerText).length;
      const productLinks = current.querySelectorAll?.(PRODUCT_LINK_SELECTOR).length || 0;
      const imageCount = current.querySelectorAll?.("img").length || 0;
      if (textLength >= 12 && textLength <= 800 && productLinks <= 4 && imageCount >= 1) {
        fallback = current;
        if (productLinks >= 1 && textLength >= 25) {
          return current;
        }
      }
    }
    return fallback || link;
  }

  function textFromFirst(card, selectors, maxLength) {
    for (const selector of selectors) {
      const elements = card.querySelectorAll(selector);
      for (const element of elements) {
        if (!isRendered(element)) {
          continue;
        }
        const text = utils.normalizeWhitespace(element.innerText || element.textContent);
        if (text && text.length <= maxLength) {
          return text;
        }
      }
    }
    return "";
  }

  function extractTitle(link, card) {
    const candidates = [
      link.getAttribute("title"),
      link.getAttribute("aria-label"),
      card.querySelector('img[alt]')?.getAttribute("alt"),
      textFromFirst(card, ['[class*="title" i]', '[class*="name" i]'], 180),
      link.innerText
    ];

    for (const candidate of candidates) {
      const text = utils.normalizeWhitespace(candidate);
      if (text.length >= 4 && text.length <= 180 && !/^[¥￥\d\s.万+起]+$/.test(text)) {
        return text;
      }
    }
    return "";
  }

  function extractPrice(card) {
    const candidates = [];
    for (const element of card.querySelectorAll('[class*="price" i]')) {
      if (isRendered(element)) {
        candidates.push(utils.normalizeWhitespace(element.innerText || element.textContent));
      }
    }
    candidates.push(utils.normalizeWhitespace(card.innerText));

    for (const text of candidates) {
      const match = text.match(/[¥￥]\s*[0-9]{1,7}(?:\.[0-9]{1,2})?/);
      if (match) {
        return { price_text: match[0], price_value: utils.parsePrice(match[0]) };
      }
      const parsed = utils.parsePrice(text);
      if (parsed !== null) {
        return { price_text: text, price_value: parsed };
      }
    }
    return { price_text: "", price_value: null };
  }

  function extractSales(card) {
    const text = utils.normalizeWhitespace(card.innerText);
    const patterns = [
      /(?:已售|月销|销量)\s*[0-9.]+\s*(?:万)?\+?/,
      /[0-9.]+\s*(?:万)?\+?\s*(?:人付款|人收货)/
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[0];
      }
    }
    return "";
  }

  function extractImage(card) {
    const image = Array.from(card.querySelectorAll("img")).find(isRendered);
    if (!image) {
      return "";
    }
    const url = image.currentSrc || image.getAttribute("data-src") || image.src || "";
    return /^https?:\/\//i.test(url) ? url : "";
  }

  function inferQuery() {
    const params = new URL(location.href).searchParams;
    for (const key of ["q", "keyword", "query", "search"]) {
      const value = utils.normalizeWhitespace(params.get(key));
      if (value) {
        return value;
      }
    }
    const input = document.querySelector('input[type="search"], input[name="q"], input[name="keyword"]');
    return utils.normalizeWhitespace(input?.value);
  }

  function collect() {
    const hostname = location.hostname.toLowerCase();
    if (!hostname.endsWith("taobao.com") && !hostname.endsWith("tmall.com")) {
      throw new Error("请在淘宝或天猫页面使用这个采集器。");
    }

    const barrier = detectAccessBarrier();
    if (barrier) {
      return { ok: false, error: barrier, barrier: true };
    }

    const seen = new Set();
    const items = [];
    const links = Array.from(document.querySelectorAll(PRODUCT_LINK_SELECTOR)).filter(isRendered);
    for (const link of links) {
      const productUrl = utils.canonicalizeProductUrl(link.href, location.href);
      if (!productUrl || seen.has(productUrl)) {
        continue;
      }

      const card = findCard(link);
      const title = extractTitle(link, card);
      if (!title) {
        continue;
      }

      const price = extractPrice(card);
      items.push({
        rank: items.length + 1,
        title,
        price_text: price.price_text,
        price_value: price.price_value,
        shop: textFromFirst(card, ['[class*="shop" i]', '[class*="seller" i]', 'a[href*="shop"]'], 80),
        sales_text: extractSales(card),
        location: textFromFirst(card, ['[class*="location" i]', '[class*="area" i]'], 40),
        product_url: productUrl,
        image_url: extractImage(card)
      });
      seen.add(productUrl);

      if (items.length >= 100) {
        break;
      }
    }

    return {
      ok: true,
      data: {
        schema_version: "1.0",
        platform: "taobao",
        source_url: location.href,
        page_title: document.title,
        query: inferQuery(),
        captured_at: new Date().toISOString(),
        collection_mode: "user_triggered_loaded_dom",
        item_count: items.length,
        items
      }
    };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "COLLECT_VISIBLE_TAOBAO_PRODUCTS") {
      return false;
    }
    try {
      sendResponse(collect());
    } catch (error) {
      sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
    return false;
  });
})();
