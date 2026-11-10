"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const WIR = require("../docs/engine.js");

const root = path.join(__dirname, "..");
const data = JSON.parse(fs.readFileSync(path.join(root, "data", "models.json"), "utf8"));
const tiers = JSON.parse(fs.readFileSync(path.join(root, "data", "hardware-tiers.json"), "utf8"));
const byId = (id) => data.models.find((m) => m.id === id);
const v = (id, hw) => WIR.verdictFor(byId(id), hw).verdict;

const WIN8 = { os: "windows", ram_gb: 16, vram_gb: 8 };
const MAC16 = { os: "macos", ram_gb: 16, apple: true };
const CPU16 = { os: "linux", ram_gb: 16, vram_gb: 0 };

test("discrete GPU: fits in graphics memory with margin runs well", () => {
  assert.strictEqual(v("llama31-8b", WIN8), "well"); // 6.6 <= 8 * 0.9
});

test("discrete GPU: spills into system memory runs slowly", () => {
  assert.strictEqual(v("gemma3-12b", WIN8), "slow"); // 10.4 > 7.2 but <= (8 + 12) * 0.9
});

test("discrete GPU: far too big will not run", () => {
  assert.strictEqual(v("llama31-70b", WIN8), "no");
});

test("margin: a model that exactly equals the pool does not run well", () => {
  const m = { id: "x", memory_gb: 8, file_gb: 6, goals: ["chat"], gpu_only: false };
  assert.strictEqual(WIR.verdictFor(m, WIN8).verdict, "slow"); // 8 > 7.2
  const edge = { id: "y", memory_gb: 7.2, file_gb: 5, goals: ["chat"], gpu_only: false };
  assert.strictEqual(WIR.verdictFor(edge, WIN8).verdict, "well"); // 7.2 <= 7.2
});

test("Apple unified memory: GPU share is 75 percent of memory", () => {
  assert.strictEqual(v("gemma3-12b", MAC16), "well"); // 10.4 <= 16 * 0.75 * 0.9 = 10.8
  assert.strictEqual(v("gpt-oss-20b", MAC16), "no"); // 17.1 > (16 - 4) * 0.9
});

test("Apple: fits past the GPU share but not in it runs slowly", () => {
  const mac32 = { os: "macos", ram_gb: 32, apple: true };
  assert.strictEqual(v("gpt-oss-20b", mac32), "well"); // 17.1 <= 32 * 0.75 * 0.9 = 21.6
  assert.strictEqual(v("qwen3-32b", mac32), "slow"); // 24.0 > 21.6 but <= (32 - 4) * 0.9 = 25.2
});

test("Apple: vram entered is ignored", () => {
  const hw = WIR.normaliseHardware({ os: "macos", ram_gb: 16, vram_gb: 24, apple: true });
  assert.strictEqual(hw.vram_gb, 0);
  assert.strictEqual(v("gemma3-12b", { os: "macos", ram_gb: 16, vram_gb: 24, apple: true }), "well");
});

test("Intel Mac (apple false) uses the typed graphics memory, not unified memory", () => {
  assert.strictEqual(v("llama31-8b", { os: "macos", ram_gb: 16, vram_gb: 0, apple: false }), "slow");
});

test("apple flag on Windows is ignored", () => {
  assert.strictEqual(WIR.normaliseHardware({ os: "windows", ram_gb: 16, vram_gb: 8, apple: true }).apple, false);
});

test("no GPU: very small models run well, mid models run slowly, big ones do not run", () => {
  assert.strictEqual(v("llama3.2-3b", CPU16), "well");
  assert.strictEqual(v("gemma3-4b", CPU16), "slow");
  assert.strictEqual(v("gpt-oss-20b", CPU16), "no");
});

test("no GPU: OS reserve is subtracted from RAM", () => {
  assert.strictEqual(v("llama3.2-3b", { os: "linux", ram_gb: 4, vram_gb: 0 }), "no"); // 0 free
  assert.strictEqual(v("llama3.2-3b", { os: "linux", ram_gb: 8, vram_gb: 0 }), "well"); // 3.3 <= 4 * 0.9
});

test("image model: no GPU will not run, a graphics card runs it", () => {
  assert.strictEqual(v("sdxl-base", CPU16), "no");
  assert.strictEqual(v("sdxl-base", { os: "windows", ram_gb: 32, vram_gb: 12 }), "well");
  assert.strictEqual(v("sdxl-base", { os: "windows", ram_gb: 32, vram_gb: 6 }), "slow");
});

test("image model on Apple chip with enough memory runs well", () => {
  assert.strictEqual(v("sdxl-base", { os: "macos", ram_gb: 16, apple: true }), "well"); // 9 <= 10.8
});

test("string numbers from form fields are accepted", () => {
  assert.strictEqual(v("llama31-8b", { os: "windows", ram_gb: "16", vram_gb: "8" }), "well");
  assert.strictEqual(v("llama31-8b", { os: "windows", ram_gb: "16", vram_gb: "" }), "slow");
});

test("bad input throws", () => {
  assert.throws(() => WIR.normaliseHardware(null));
  assert.throws(() => WIR.normaliseHardware({ os: "beos", ram_gb: 8 }));
  assert.throws(() => WIR.normaliseHardware({ os: "windows", ram_gb: 0 }));
  assert.throws(() => WIR.normaliseHardware({ os: "windows", ram_gb: -4 }));
  assert.throws(() => WIR.normaliseHardware({ os: "windows", ram_gb: "abc" }));
  assert.throws(() => WIR.normaliseHardware({ os: "windows", ram_gb: 8, vram_gb: -1 }));
  assert.throws(() => WIR.normaliseHardware({ os: "windows", ram_gb: Infinity }));
});

test("evaluate: bad goal throws, goal matches come first, then best verdict", () => {
  assert.throws(() => WIR.evaluate(data, WIN8, "gaming"));
  const rows = WIR.evaluate(data, WIN8, "coding");
  assert.strictEqual(rows.length, data.models.length);
  const firstNonMatch = rows.findIndex((r) => !r.match);
  assert.ok(rows.slice(0, firstNonMatch).every((r) => r.match));
  assert.ok(rows.slice(firstNonMatch).every((r) => !r.match));
  const ranks = rows.slice(0, firstNonMatch).map((r) => ({ well: 0, slow: 1, no: 2 })[r.verdict]);
  assert.deepStrictEqual(ranks, ranks.slice().sort((a, b) => a - b));
});

test("evaluate: every row carries a source and a read date", () => {
  WIR.evaluate(data, WIN8, "chat").forEach((r) => {
    assert.ok(/^https:\/\//.test(r.source_url));
    assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(r.read_date));
  });
});

test("apps are filtered by operating system", () => {
  const win = WIR.evaluate(data, WIN8, "images").find((r) => r.id === "sdxl-base");
  assert.strictEqual(win.apps[0].name, "ComfyUI");
  const lin = WIR.evaluate(data, { os: "linux", ram_gb: 32, vram_gb: 12 }, "images").find((r) => r.id === "sdxl-base");
  assert.strictEqual(lin.apps.length, 0);
  assert.strictEqual(lin.no_app_for_os, true);
});

test("minimumFor rounds up", () => {
  const m = byId("llama31-8b"); // 6.6
  assert.deepStrictEqual(WIR.minimumFor(m), { vram_gb: 8, unified_gb: 10 });
});

test("whatToBuy: tiers rise, each model unlocks once, no price or product fields", () => {
  const out = WIR.whatToBuy(data, tiers, "chat", "gpu");
  assert.strictEqual(out.length, tiers.tiers.length);
  const names = out.flatMap((t) => t.unlocks);
  assert.strictEqual(new Set(names).size, names.length);
  assert.ok(out[0].unlocks.includes("Llama 3.2 3B"));
  out.forEach((t) => assert.deepStrictEqual(Object.keys(t).sort(), ["best", "id", "label", "memory_gb", "memory_kind", "unlocks"]));
});

test("whatToBuy: Apple path uses unified memory", () => {
  const out = WIR.whatToBuy(data, tiers, "chat", "apple");
  assert.strictEqual(out[0].memory_kind, "unified memory");
  assert.ok(out[0].memory_gb >= 8);
  assert.throws(() => WIR.whatToBuy(data, tiers, "nope", "gpu"));
});

test("verdict never claims a model runs well when it needs more than the margin", () => {
  for (const m of data.models) {
    for (const vram of [0, 4, 6, 8, 12, 16, 24, 48]) {
      const r = WIR.verdictFor(m, { os: "windows", ram_gb: 64, vram_gb: vram });
      if (r.verdict === "well" && vram > 0) assert.ok(m.memory_gb <= vram * WIR.MARGIN + 1e-9);
    }
  }
});
