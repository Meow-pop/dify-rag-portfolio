"use strict";

const assert = require("node:assert/strict");
require("../shared.js");

const utils = globalThis.MarketCollectorUtils;

assert.equal(utils.parsePrice("¥ 199.90"), 199.9);
assert.equal(utils.parsePrice("月销 199 件"), null);
assert.equal(
  utils.canonicalizeProductUrl(
    "https://item.taobao.com/item.htm?id=12345&spm=tracking",
    "https://s.taobao.com/search?q=test"
  ),
  "https://item.taobao.com/item.htm?id=12345"
);
assert.equal(utils.canonicalizeProductUrl("https://example.com/item?id=1"), null);
assert.equal(
  utils.canonicalizeProductUrl(
    "https://click.simba.taobao.com/cc_im?p=%B1%A3%CE%C2%B1%AD&e=opaque#tracking"
  ),
  "https://click.simba.taobao.com/cc_im?p=%B1%A3%CE%C2%B1%AD&e=opaque"
);

const csv = utils.toCsv([
  {
    rank: 1,
    title: "=HYPERLINK(\"https://bad.example\")",
    price_text: "¥19.9",
    price_value: 19.9,
    shop: "测试店铺",
    sales_text: "已售100+",
    location: "浙江 杭州",
    product_url: "https://item.taobao.com/item.htm?id=1",
    image_url: ""
  }
]);
assert.match(csv, /"'=HYPERLINK/);
assert.ok(csv.startsWith("\uFEFF"));

console.log("shared utilities tests passed");
