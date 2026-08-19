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

      const response = await chrome.tabs.sendMessage(tab.id, {
        type: "COLLECT_VISIBLE_TAOBAO_PRODUCTS"
      });
      if (!response?.ok) {
        throw new Error(response?.error || "页面没有返回采集结果，请刷新页面后重试。");
      }

      latestData = response.data;
      count.textContent = String(latestData.item_count);
      query.textContent = latestData.query || "未识别";
      summary.hidden = false;

      if (latestData.item_count === 0) {
        setStatus("未识别到商品。请滚动加载商品；若淘宝刚改版，需要更新适配器。", "error");
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
