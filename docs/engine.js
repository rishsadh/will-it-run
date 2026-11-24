/* will-it-run verdict engine. Plain JavaScript, no dependencies, works in the browser and in Node. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.WIR = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Stated in the README. All of these are estimates.
  var MARGIN = 0.9;          // use at most 90 percent of a memory pool
  var OS_RESERVE_GB = 4;     // memory kept for the system when the CPU holds part of a model
  var APPLE_GPU_SHARE = 0.75; // share of Apple unified memory the GPU can use by default
  var CPU_WELL_MAX_GB = 4;   // CPU only: only very small models count as "runs well"

  var GOALS = ["chat", "writing", "coding", "images"];
  var OS_LIST = ["windows", "macos", "linux"];
  var RANK = { well: 0, slow: 1, no: 2 };
  var LABEL = { well: "Runs well", slow: "Runs slowly", no: "Will not run" };

  function num(v, name) {
    var n = typeof v === "string" ? Number(v.trim()) : v;
    if (typeof n !== "number" || !isFinite(n) || n < 0) {
      throw new Error(name + " must be a number of 0 or more");
    }
    return n;
  }

  // hw: { os, ram_gb, vram_gb, apple }. apple true means an Apple chip with unified memory.
  function normaliseHardware(hw) {
    if (!hw) throw new Error("hardware is required");
    var os = String(hw.os || "").toLowerCase();
    if (OS_LIST.indexOf(os) < 0) throw new Error("os must be windows, macos or linux");
    var ram = num(hw.ram_gb, "ram_gb");
    if (ram === 0) throw new Error("ram_gb must be more than 0");
    var apple = os === "macos" && hw.apple === true;
    var vram = apple ? 0 : num(hw.vram_gb === undefined || hw.vram_gb === "" ? 0 : hw.vram_gb, "vram_gb");
    return { os: os, ram_gb: ram, vram_gb: vram, apple: apple };
  }

  function pools(hw) {
    var cpu = Math.max(hw.ram_gb - OS_RESERVE_GB, 0);
    if (hw.apple) return { kind: "apple", fast: hw.ram_gb * APPLE_GPU_SHARE, cpu: cpu };
    if (hw.vram_gb > 0) return { kind: "gpu", fast: hw.vram_gb, cpu: cpu };
    return { kind: "cpu", fast: 0, cpu: cpu };
  }

  function r1(n) { return Math.round(n * 10) / 10; }

  function verdictFor(model, hwIn) {
    var hw = normaliseHardware(hwIn);
    var p = pools(hw);
    var need = model.memory_gb;
    var v, why;

    if (p.fast > 0 && need <= p.fast * MARGIN) {
      v = "well";
      why = "Needs about " + r1(need) + " GB. Your " + (p.kind === "apple" ? "Apple chip can use about " + r1(p.fast) + " GB of its memory" : "graphics memory is " + r1(p.fast) + " GB") + ".";
    } else if (model.gpu_only) {
      if (p.kind === "apple" && need <= p.cpu * MARGIN) {
        v = "slow"; why = "Image models need a fast chip. It fits in memory but will be slow.";
      } else if (p.kind === "gpu" && need <= (p.fast + p.cpu) * MARGIN) {
        v = "slow"; why = "Needs about " + r1(need) + " GB. It spills past graphics memory into system memory, so it will be slow.";
      } else if (p.kind === "cpu") {
        v = "no"; why = "Image models need a graphics card or an Apple chip. Enter graphics memory if you have it.";
      } else {
        v = "no"; why = "Needs about " + r1(need) + " GB. You have too little memory.";
      }
    } else if (p.kind === "apple") {
      if (need <= p.cpu * MARGIN) { v = "slow"; why = "Needs about " + r1(need) + " GB. It fits in your memory but past the share the GPU can use, so expect it to be slow."; }
      else { v = "no"; why = "Needs about " + r1(need) + " GB. Your memory is too small once the system takes its share."; }
    } else if (p.kind === "gpu") {
      if (need <= (p.fast + p.cpu) * MARGIN) { v = "slow"; why = "Needs about " + r1(need) + " GB. Part of it will sit in system memory, so expect it to be slow."; }
      else { v = "no"; why = "Needs about " + r1(need) + " GB. Graphics memory plus spare system memory is too small."; }
    } else {
      if (need <= p.cpu * MARGIN) {
        if (need <= CPU_WELL_MAX_GB) { v = "well"; why = "A small model. It runs on the processor alone at a usable pace."; }
        else { v = "slow"; why = "Needs about " + r1(need) + " GB. With no graphics memory it runs on the processor and will be slow."; }
      } else { v = "no"; why = "Needs about " + r1(need) + " GB. You have about " + r1(p.cpu) + " GB free after the system takes " + OS_RESERVE_GB + " GB."; }
    }
    return { id: model.id, verdict: v, label: LABEL[v], reason: why, need_gb: need, file_gb: model.file_gb };
  }

  function appFor(model, apps, os) {
    var out = [];
    (model.apps || []).forEach(function (key) {
      var a = apps[key];
      if (a && a.os.indexOf(os) >= 0) out.push({ key: key, name: a.name, url: a.url });
    });
    return out;
  }

  // Returns every model with a verdict, goal matches first, then best verdict, then larger models first.
  function evaluate(data, hwIn, goal) {
    var hw = normaliseHardware(hwIn);
    if (GOALS.indexOf(goal) < 0) throw new Error("goal must be one of " + GOALS.join(", "));
    var rows = data.models.map(function (m) {
      var r = verdictFor(m, hw);
      r.name = m.name;
      r.params_b = m.params_b;
      r.licence = m.licence;
      r.quant = m.quant;
      r.match = m.goals.indexOf(goal) >= 0;
      r.apps = appFor(m, data.apps, hw.os);
      r.no_app_for_os = r.apps.length === 0;
      r.source_url = m.source_url;
      r.read_date = m.read_date;
      return r;
    });
    rows.sort(function (a, b) {
      if (a.match !== b.match) return a.match ? -1 : 1;
      if (RANK[a.verdict] !== RANK[b.verdict]) return RANK[a.verdict] - RANK[b.verdict];
      return b.params_b - a.params_b;
    });
    return rows;
  }

  // Least memory (rounded up) that runs a model well.
  function minimumFor(model) {
    return {
      vram_gb: Math.ceil(model.memory_gb / MARGIN),
      unified_gb: Math.ceil(model.memory_gb / (MARGIN * APPLE_GPU_SHARE))
    };
  }

  // Hardware tiers by memory. For each tier, the goal models that it first unlocks. No products, no prices.
  function whatToBuy(data, tiers, goal, kind) {
    if (GOALS.indexOf(goal) < 0) throw new Error("goal must be one of " + GOALS.join(", "));
    var useApple = kind === "apple";
    var models = data.models.filter(function (m) { return m.goals.indexOf(goal) >= 0; });
    var seen = {};
    var out = [];
    tiers.tiers.forEach(function (t) {
      var pool = useApple ? t.unified_gb * APPLE_GPU_SHARE : t.vram_gb;
      var unlocked = models.filter(function (m) {
        return !seen[m.id] && m.memory_gb <= pool * MARGIN;
      });
      unlocked.forEach(function (m) { seen[m.id] = true; });
      out.push({
        id: t.id,
        label: t.label,
        memory_gb: useApple ? t.unified_gb : t.vram_gb,
        memory_kind: useApple ? "unified memory" : "graphics memory",
        unlocks: unlocked.map(function (m) { return m.name; }),
        best: unlocked.length ? unlocked.slice().sort(function (a, b) { return b.params_b - a.params_b; })[0].name : null
      });
    });
    return out;
  }

  return {
    MARGIN: MARGIN, OS_RESERVE_GB: OS_RESERVE_GB, APPLE_GPU_SHARE: APPLE_GPU_SHARE, CPU_WELL_MAX_GB: CPU_WELL_MAX_GB,
    GOALS: GOALS, OS_LIST: OS_LIST, LABEL: LABEL,
    normaliseHardware: normaliseHardware, verdictFor: verdictFor, evaluate: evaluate,
    minimumFor: minimumFor, whatToBuy: whatToBuy
  };
});
