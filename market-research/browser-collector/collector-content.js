(function attachTaobaoCollector() {
  "use strict";

  const utils = globalThis.MarketCollectorUtils;
  const PRODUCT_LINK_SELECTOR = [
    'a[href*="item.taobao.com/item.htm"]',
    'a[href*="detail.tmall.com/item.htm"]',
    'a[href*="item.taobao.com/"]',
    'a[href*="detail.tmall.com/"]',
    'a[href*="click.simba.taobao.com/"]',
    'a[href*="uland.taobao.com/"]'
  ].join(",");

  function isRendered(element) {
    if (!(element instanceof Element)) {
      return false;
    }
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
  }

  function discoverSearchRoots(root, roots, visited) {
    if (!root || visited.has(root)) {
      return;
    }
    visited.add(root);
    roots.push(root);
    for (const element of root.querySelectorAll?.("*") || []) {
      if (element.shadowRoot) {
        discoverSearchRoots(element.shadowRoot, roots, visited);
      }
    }
  }

  function getSearchRoots() {
    const roots = [];
    discoverSearchRoots(document, roots, new Set());
    return roots;
  }

  function queryAllFromRoots(roots, selector) {
    const results = [];
    for (const root of roots) {
      results.push(...root.querySelectorAll(selector));
    }
    return results;
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

  function findCardFromPrice(priceElement) {
    let current = priceElement;
    let fallback = null;
    for (let depth = 0; current && depth < 10; depth += 1, current = current.parentElement) {
      if (!isRendered(current)) {
        continue;
      }
      const textLength = utils.normalizeWhitespace(current.innerText).length;
      const imageCount = current.querySelectorAll?.("img").length || 0;
      if (textLength >= 15 && textLength <= 1200 && imageCount >= 1) {
        fallback = current;
        if (textLength <= 700 && imageCount <= 4) {
          return current;
        }
      }
    }
    return fallback;
  }

  function findBestLink(card) {
    if (!card) {
      return null;
    }
    const preferred = card.querySelector(PRODUCT_LINK_SELECTOR);
    if (preferred) {
      return preferred;
    }
    return Array.from(card.querySelectorAll("a[href]")).find((link) => {
      try {
        const hostname = new URL(link.href, location.href).hostname.toLowerCase();
        return hostname.endsWith("taobao.com") || hostname.endsWith("tmall.com");
      } catch (_error) {
        return false;
      }
    }) || null;
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
      link?.getAttribute("title"),
      link?.getAttribute("aria-label"),
      card.querySelector('img[alt]')?.getAttribute("alt"),
      textFromFirst(card, ['[class*="title" i]', '[class*="name" i]', "h2", "h3"], 180),
      link?.innerText,
      ...String(card.innerText || "").split(/\r?\n/)
    ];

    for (const candidate of candidates) {
      const text = utils.normalizeWhitespace(candidate);
      if (text.length >= 4 && text.length <= 180 && !/^[¥￥\d\s.万+起]+$/.test(text)) {
        return text;
      }
    }
    return "";
  }

  function elementPriceTexts(element) {
    if (!element) {
      return [];
    }
    const values = [
      element.innerText,
      element.textContent,
      element.getAttribute?.("aria-label"),
      element.parentElement?.innerText
    ];
    try {
      const before = getComputedStyle(element, "::before").content.replace(/^['"]|['"]$/g, "");
      const after = getComputedStyle(element, "::after").content.replace(/^['"]|['"]$/g, "");
      values.push(`${before}${element.textContent || ""}${after}`);
    } catch (_error) {
      // Pseudo-element content is optional diagnostic input.
    }
    return [...new Set(values.map(utils.normalizeWhitespace).filter(Boolean))];
  }

  function extractPrice(card, priceElement) {
    const candidates = [];
    candidates.push(...elementPriceTexts(priceElement));
    for (const element of card.querySelectorAll('[class*="price" i]')) {
      if (isRendered(element)) {
        candidates.push(...elementPriceTexts(element));
      }
    }
    candidates.push(utils.normalizeWhitespace(card.innerText));

    for (const text of candidates) {
      const match = text.match(/[¥￥]\s*[0-9]{1,7}(?:\.[0-9]{1,2})?/);
      if (match) {
        return { price_text: match[0], price_value: utils.parsePrice(match[0]) };
      }
      const decimalMatch = text.match(/(?:^|\s)([0-9]{1,7}\.[0-9]{1,2})(?:\s|$)/);
      if (decimalMatch) {
        return { price_text: decimalMatch[1], price_value: Number(decimalMatch[1]) };
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

  function normalizeProductId(value) {
    const match = String(value || "").match(/(?:^|\D)([0-9]{5,20})(?:\D|$)/);
    return match ? match[1] : "";
  }

  function extractProductId(link, card) {
    const parameterNames = ["id", "itemId", "item_id", "auctionId", "auction_id", "nid"];
    if (link) {
      try {
        const url = new URL(link.href, location.href);
        for (const name of parameterNames) {
          const id = normalizeProductId(url.searchParams.get(name));
          if (id) {
            return id;
          }
        }

        for (const name of ["url", "redirect", "target"]) {
          const nestedValue = url.searchParams.get(name);
          if (!nestedValue) {
            continue;
          }
          try {
            const nestedUrl = new URL(nestedValue, location.href);
            for (const parameterName of parameterNames) {
              const id = normalizeProductId(nestedUrl.searchParams.get(parameterName));
              if (id) {
                return id;
              }
            }
          } catch (_error) {
            // Some redirect parameters are opaque tokens rather than URLs.
          }
        }
      } catch (_error) {
        // Attribute-based extraction below still has a chance to find the ID.
      }
    }

    const attributeNames = ["data-nid", "data-itemid", "data-item-id", "data-auctionid", "data-id"];
    const candidates = [link, card, ...card.querySelectorAll(attributeNames.map((name) => `[${name}]`).join(","))].filter(Boolean);
    for (const candidate of candidates) {
      for (const attributeName of attributeNames) {
        const id = normalizeProductId(candidate.getAttribute?.(attributeName));
        if (id) {
          return id;
        }
      }
    }

    const markup = card.outerHTML.slice(0, 100000);
    const embeddedMatch = markup.match(/(?:itemId|item_id|auctionId|auction_id|nid)[^0-9]{0,20}([0-9]{5,20})/i);
    return embeddedMatch ? embeddedMatch[1] : "";
  }

  function resolveProductUrl(link, card) {
    const productId = extractProductId(link, card);
    if (productId) {
      return `https://item.taobao.com/item.htm?id=${productId}`;
    }
    return link ? utils.canonicalizeProductUrl(link.href, location.href) : null;
  }

  function findPriceElements(roots) {
    return queryAllFromRoots(roots, "*").filter((element) => {
      if (!isRendered(element) || element.children.length > 6) {
        return false;
      }
      const texts = elementPriceTexts(element).filter((text) => text.length <= 80);
      if (texts.length === 0) {
        return false;
      }
      const hasPriceClass = /price/i.test(String(element.className || ""));
      return texts.some((text) => {
        const hasCurrencyPrice = /[¥￥]\s*[0-9]{1,7}(?:\.[0-9]{1,2})?/.test(text);
        const hasNumericPrice = /^[¥￥]?\s*[0-9]{1,7}(?:\.[0-9]{1,2})?(?:\s*元|\s*起)?$/.test(text);
        const hasPlainDecimalPrice = /^[0-9]{1,7}\.[0-9]{1,2}$/.test(text);
        return hasCurrencyPrice || hasPlainDecimalPrice || (hasPriceClass && hasNumericPrice);
      });
    });
  }

  function candidateCards() {
    const candidates = [];
    const roots = getSearchRoots();
    const matchedLinks = queryAllFromRoots(roots, PRODUCT_LINK_SELECTOR).filter(isRendered);
    for (const link of matchedLinks) {
      const card = findCard(link);
      if (card) {
        candidates.push({ card, link });
      }
    }

    const priceElements = findPriceElements(roots);
    for (const priceElement of priceElements) {
      const card = findCardFromPrice(priceElement);
      if (card) {
        candidates.push({ card, link: findBestLink(card), priceElement });
      }
    }

    return { candidates, matchedLinks, priceElements, roots };
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
    const discovery = candidateCards();
    for (const candidate of discovery.candidates) {
      const { card, link } = candidate;
      const productUrl = resolveProductUrl(link, card);
      const title = extractTitle(link, card);
      if (!title) {
        continue;
      }

      const price = extractPrice(card, candidate.priceElement);
      const shop = textFromFirst(card, ['[class*="shop" i]', '[class*="seller" i]', 'a[href*="shop"]'], 80);
      const imageUrl = extractImage(card);
      const identity = productUrl || [title, price.price_value, shop, imageUrl].join("|");
      if (!identity || seen.has(identity)) {
        continue;
      }

      items.push({
        rank: items.length + 1,
        title,
        price_text: price.price_text,
        price_value: price.price_value,
        shop,
        sales_text: extractSales(card),
        location: textFromFirst(card, ['[class*="location" i]', '[class*="area" i]'], 40),
        product_url: productUrl || "",
        image_url: imageUrl
      });
      seen.add(identity);

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
        diagnostics: {
          matched_product_links: discovery.matchedLinks.length,
          matched_price_elements: discovery.priceElements.length,
          candidate_cards: discovery.candidates.length,
          open_shadow_roots: Math.max(0, discovery.roots.length - 1)
        },
        items
      }
    };
  }

  globalThis.StarMarketTaobaoCollector = Object.freeze({ collect });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "COLLECT_TAOBAO_FRAME_BROADCAST") {
      let result;
      try {
        result = collect();
      } catch (error) {
        result = { ok: false, error: error instanceof Error ? error.message : String(error) };
      }
      try {
        const pending = chrome.runtime.sendMessage({
          type: "TAOBAO_FRAME_COLLECTION_RESULT",
          request_id: message.request_id,
          result
        });
        pending?.catch?.(() => {});
      } catch (_error) {
        // The popup may have closed before the frame returned its result.
      }
      sendResponse({ ok: true });
      return false;
    }

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
