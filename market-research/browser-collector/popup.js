(function initializePopup() {
  "use strict";

  const utils = globalThis.MarketCollectorUtils;
  const collectButton = document.querySelector("#collect");
  const jsonButton = document.querySelector("#download-json");
  const csvButton = document.querySelector("#download-csv");
  const status = document.querySelector("#status");
  const summary = document.querySelector("#summary");
  const count = document.querySelector("#count");
  const query = document.querySelector("#query");
  let latestData = null;

  function setStatus(message, kind) {
    status.textContent = message;
    status.className = "status" + (kind ? " " + kind : "");
  }

  function downloadText(filename, text, mimeType) {
    const blob = new Blob([text], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function filename(extension) {
    const date = new Date().toISOString().slice(0, 10);
    const keyword = utils.safeFilenamePart(latestData?.query || "taobao");
    return `taobao-${keyword}-${date}.${extension}`;
  }

  function itemIdentity(item) {
    return item.product_url || [item.title, item.price_value, item.shop, item.image_url].join("|");
  }

  async function collectFromAllFrames(tab) {
    const requestId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    const responses = [];

    const listener = (message) => {
      if (message?.type === "TAOBAO_FRAME_COLLECTION_RESULT" && message.request_id === requestId && message.result) {
        responses.push(message.result);
      }
    };
    chrome.runtime.onMessage.addListener(listener);

    try {
      const broadcast = chrome.tabs.sendMessage(tab.id, {
        type: "COLLECT_TAOBAO_FRAME_BROADCAST",
        request_id: requestId
      });
      broadcast?.catch?.(() => {});
      await new Promise((resolve) => setTimeout(resolve, 1600));
    } finally {
      chrome.runtime.onMessage.removeListener(listener);
    }

    const successful = responses.filter((response) => response.ok && response.data);
    if (successful.length === 0) {
      const blocked = responses.find((response) => response?.barrier);
      return blocked || responses[0] || { ok: false, error: "页面没有返回采集结果，请刷新后重试。" };
    }

    const preferred = successful.find((response) => response.data.query) || successful[0];
    const items = [];
    const seen = new Set();
    const diagnostics = {
      scanned_frames: successful.length,
      matched_product_links: 0,
      matched_price_elements: 0,
      candidate_cards: 0,
      open_shadow_roots: 0
    };

    for (const response of successful) {
      const frameDiagnostics = response.data.diagnostics || {};
      for (const key of ["matched_product_links", "matched_price_elements", "candidate_cards", "open_shadow_roots"]) {
        diagnostics[key] += Number(frameDiagnostics[key] || 0);
      }
      for (const item of response.data.items || []) {
        const identity = itemIdentity(item);
        if (!identity || seen.has(identity)) {
          continue;
        }
        seen.add(identity);
        items.push({ ...item, rank: items.length + 1 });
        if (items.length >= 100) {
          break;
        }
      }
    }

    return {
      ok: true,
      data: {
        ...preferred.data,
        source_url: tab.url,
        page_title: tab.title || preferred.data.page_title,
        item_count: items.length,
        diagnostics,
        items
      }
    };
  }

  collectButton.addEventListener("click", async () => {
    collectButton.disabled = true;
    jsonButton.disabled = true;
    csvButton.disabled = true;
    latestData = null;
    summary.hidden = true;
    setStatus("正在读取当前页面……");

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id || !/^https:\/\/[^/]*\.(?:taobao|tmall)\.com\//i.test(tab.url || "")) {
        throw new Error("请先打开淘宝或天猫页面。");
      }

      const response = await collectFromAllFrames(tab);
      if (!response?.ok) {
        throw new Error(response?.error || "页面没有返回采集结果，请刷新页面后重试。");
      }

      latestData = response.data;
      count.textContent = String(latestData.item_count);
      query.textContent = latestData.query || "未识别";
      summary.hidden = false;

      if (latestData.item_count === 0) {
        const diagnostics = latestData.diagnostics || {};
        setStatus(
          `未识别到商品（框架 ${diagnostics.scanned_frames || 0}，阴影层 ${diagnostics.open_shadow_roots || 0}，链接 ${diagnostics.matched_product_links || 0}，价格 ${diagnostics.matched_price_elements || 0}，卡片 ${diagnostics.candidate_cards || 0}）。`,
          "error"
        );
        return;
      }

      jsonButton.disabled = false;
      csvButton.disabled = false;
      setStatus(`采集完成：${latestData.item_count} 件商品。`, "success");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error), "error");
    } finally {
      collectButton.disabled = false;
    }
  });

  jsonButton.addEventListener("click", () => {
    if (latestData) {
      downloadText(filename("json"), JSON.stringify(latestData, null, 2), "application/json;charset=utf-8");
    }
  });

  csvButton.addEventListener("click", () => {
    if (latestData) {
      downloadText(filename("csv"), utils.toCsv(latestData.items), "text/csv;charset=utf-8");
    }
  });
})();
