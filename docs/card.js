/* will-it-run result card. Draws a 1200 by 630 picture on a canvas. Plain JavaScript, works in the browser and in Node tests. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.WIRCard = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var W = 1200;
  var H = 630;
  var REPO_URL = "github.com/rishsadh/will-it-run";
  var COLORS = { bg: "#101418", panel: "#1b2229", text: "#f2f5f7", muted: "#9fb0bd", well: "#46c27a", slow: "#e0b341", no: "#e5645a", line: "#2c3842" };
  var GOAL_LABEL = { chat: "chat", writing: "writing", coding: "coding help", images: "images" };
  var OS_LABEL = { windows: "Windows", macos: "macOS", linux: "Linux" };

  // Pure: turns results into the words and rows on the card.
  function cardSpec(rows, hw, goal) {
    var memory = hw.apple ? hw.ram_gb + " GB unified memory" : hw.ram_gb + " GB RAM" + (hw.vram_gb > 0 ? ", " + hw.vram_gb + " GB graphics memory" : ", no graphics memory");
    var matches = rows.filter(function (r) { return r.match; });
    var show = matches.slice(0, 4).map(function (r) { return { name: r.name, verdict: r.verdict, label: r.label }; });
    var well = matches.filter(function (r) { return r.verdict === "well"; }).length;
    var headline = well > 0 ? well + " of " + matches.length + " models run well for " + GOAL_LABEL[goal] : "No " + GOAL_LABEL[goal] + " model runs well yet";
    return {
      title: "Will it run?",
      machine: (OS_LABEL[hw.os] || hw.os) + ", " + memory,
      headline: headline,
      rows: show,
      foot: "Estimates, not benchmarks. " + REPO_URL
    };
  }

  function fit(ctx, text, maxWidth) {
    if (ctx.measureText(text).width <= maxWidth) return text;
    var t = text;
    while (t.length > 1 && ctx.measureText(t + "...").width > maxWidth) t = t.slice(0, -1);
    return t + "...";
  }

  function drawCard(ctx, spec) {
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, W, H);
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = COLORS.muted;
    ctx.font = "600 30px system-ui, sans-serif";
    ctx.fillText(spec.title, 72, 92);
    ctx.fillStyle = COLORS.text;
    ctx.font = "700 54px system-ui, sans-serif";
    ctx.fillText(fit(ctx, spec.headline, W - 144), 72, 170);
    ctx.fillStyle = COLORS.muted;
    ctx.font = "400 30px system-ui, sans-serif";
    ctx.fillText(fit(ctx, spec.machine, W - 144), 72, 220);

    var y = 270;
    spec.rows.forEach(function (r) {
      ctx.fillStyle = COLORS.panel;
      ctx.fillRect(72, y, W - 144, 62);
      ctx.fillStyle = COLORS[r.verdict] || COLORS.muted;
      ctx.fillRect(72, y, 10, 62);
      ctx.fillStyle = COLORS.text;
      ctx.font = "600 30px system-ui, sans-serif";
      ctx.fillText(fit(ctx, r.name, 640), 104, y + 41);
      ctx.fillStyle = COLORS[r.verdict] || COLORS.muted;
      ctx.font = "600 28px system-ui, sans-serif";
      var w = ctx.measureText(r.label).width;
      ctx.fillText(r.label, W - 72 - 24 - w, y + 41);
      y += 74;
    });

    ctx.fillStyle = COLORS.line;
    ctx.fillRect(72, H - 86, W - 144, 2);
    ctx.fillStyle = COLORS.muted;
    ctx.font = "400 26px system-ui, sans-serif";
    ctx.fillText(fit(ctx, spec.foot, W - 144), 72, H - 40);
  }

  return { WIDTH: W, HEIGHT: H, REPO_URL: REPO_URL, cardSpec: cardSpec, drawCard: drawCard };
});
