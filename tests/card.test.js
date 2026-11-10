"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const WIR = require("../docs/engine.js");
const Card = require("../docs/card.js");

const data = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "models.json"), "utf8"));

function fakeCtx() {
  const calls = [];
  return {
    calls,
    fillStyle: "",
    font: "",
    textBaseline: "",
    fillRect(x, y, w, h) { calls.push(["rect", x, y, w, h]); },
    fillText(t, x, y) { calls.push(["text", t, x, y]); },
    measureText(t) { return { width: t.length * 14 }; }
  };
}

test("card is 1200 by 630", () => {
  assert.strictEqual(Card.WIDTH, 1200);
  assert.strictEqual(Card.HEIGHT, 630);
  const ctx = fakeCtx();
  Card.drawCard(ctx, Card.cardSpec(WIR.evaluate(data, { os: "windows", ram_gb: 16, vram_gb: 8 }, "chat"), { os: "windows", ram_gb: 16, vram_gb: 8, apple: false }, "chat"));
  assert.deepStrictEqual(ctx.calls[0], ["rect", 0, 0, 1200, 630]);
});

test("everything drawn stays inside the card", () => {
  const hw = WIR.normaliseHardware({ os: "windows", ram_gb: 16, vram_gb: 8 });
  const ctx = fakeCtx();
  Card.drawCard(ctx, Card.cardSpec(WIR.evaluate(data, hw, "coding"), hw, "coding"));
  ctx.calls.filter((c) => c[0] === "rect").forEach(([, x, y, w, h]) => {
    assert.ok(x >= 0 && y >= 0 && x + w <= 1200 && y + h <= 630, "rect out of bounds " + [x, y, w, h]);
  });
  ctx.calls.filter((c) => c[0] === "text").forEach(([, , x, y]) => assert.ok(x >= 0 && y > 0 && y <= 630));
});

test("a very long name is cut to fit", () => {
  const ctx = fakeCtx();
  const spec = { title: "t", headline: "h", machine: "m", foot: "f", rows: [{ name: "x".repeat(200), verdict: "well", label: "Runs well" }] };
  Card.drawCard(ctx, spec);
  const t = ctx.calls.find((c) => c[0] === "text" && c[1].startsWith("xxx"));
  assert.ok(t[1].endsWith("..."));
  assert.ok(t[1].length * 14 <= 640 + 3 * 14);
});

test("spec words: Apple, no graphics memory, and the repo URL", () => {
  const apple = WIR.normaliseHardware({ os: "macos", ram_gb: 16, apple: true });
  const s1 = Card.cardSpec(WIR.evaluate(data, apple, "chat"), apple, "chat");
  assert.ok(s1.machine.includes("16 GB unified memory"));
  const cpu = WIR.normaliseHardware({ os: "linux", ram_gb: 8, vram_gb: 0 });
  const s2 = Card.cardSpec(WIR.evaluate(data, cpu, "chat"), cpu, "chat");
  assert.ok(s2.machine.includes("no graphics memory"));
  assert.ok(s2.foot.includes("github.com/rishsadh/will-it-run"));
  assert.ok(s2.foot.includes("Estimates"));
});

test("headline is honest when nothing runs well", () => {
  const tiny = WIR.normaliseHardware({ os: "windows", ram_gb: 4, vram_gb: 0 });
  const s = Card.cardSpec(WIR.evaluate(data, tiny, "images"), tiny, "images");
  assert.ok(s.headline.startsWith("No images model runs well"));
});

test("card text has no em or en dashes", () => {
  const hw = WIR.normaliseHardware({ os: "windows", ram_gb: 16, vram_gb: 8 });
  const ctx = fakeCtx();
  Card.drawCard(ctx, Card.cardSpec(WIR.evaluate(data, hw, "chat"), hw, "chat"));
  ctx.calls.filter((c) => c[0] === "text").forEach((c) => assert.ok(!/[–—]/.test(c[1])));
});
