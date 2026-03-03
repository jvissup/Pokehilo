const $ = (id) => document.getElementById(id);

const els = {
  hostKeyInput: $("hostKeyInput"),
  saveKeyBtn: $("saveKeyBtn"),
  openPlayerBtn: $("openPlayerBtn"),
  startBtn: $("startBtn"),

  cardImg: $("cardImg"),
  cardTitle: $("cardTitle"),
  cardSet: $("cardSet"),
  prompt: $("prompt"),
  status: $("status"),
  nextCardFrame: $("nextCardFrame"),
  sessionIdText: $("sessionIdText"),
  sessionMeta: $("sessionMeta"),

  hostCurrent: $("hostCurrent"),
  hostNext: $("hostNext"),
  hostCorrect: $("hostCorrect"),
  hostNextTitle: $("hostNextTitle"),
  hostDeck: $("hostDeck"),

  refreshLogsBtn: $("refreshLogsBtn"),
  downloadLogsBtn: $("downloadLogsBtn"),
  logsTable: $("logsTable"),

  evEntry: $("evEntry"),
  evMargin: $("evMargin"),
  evP1: $("evP1"),
  evP: $("evP"),
  evTrials: $("evTrials"),
  runSimBtn: $("runSimBtn"),
  evOut: $("evOut"),

  tiersTable: $("tiersTable"),
  addTierBtn: $("addTierBtn"),
  resetTiersBtn: $("resetTiersBtn"),
};

// Use sessionStorage so the player tab can't read it (tabs don't share sessionStorage).
let hostKey = sessionStorage.getItem("hostKey") || "";
let sessionId = null;
let poller = null;
let lastUpdatedAt = 0;
let bc = null;

function setStatus(text, kind = "") {
  els.status.textContent = text || "";
  els.status.classList.remove("good", "bad");
  if (kind === "good") els.status.classList.add("good");
  if (kind === "bad") els.status.classList.add("bad");
}

function setCard(card) {
  if (!card) return;
  els.cardImg.src = card.imageSrc;
  els.cardTitle.textContent = card.title || "—";
  els.cardSet.textContent = card.setName || "—";
}

function setHostPanel(host) {
  els.hostCurrent.textContent = host?.currentPriceCad != null ? `$${Number(host.currentPriceCad).toFixed(1)}` : "—";
  els.hostNext.textContent = host?.nextPriceCad != null ? `$${Number(host.nextPriceCad).toFixed(1)}` : "—";
  els.hostCorrect.textContent = host?.correctNext || host?.correctAnswer || "—";
  els.hostNextTitle.textContent = host?.nextTitle || "—";
  els.hostDeck.textContent = host?.deckRemaining != null ? String(host.deckRemaining) : "—";
}

async function api(path, body = null, method = null) {
  const headers = { "Content-Type": "application/json" };
  if (hostKey) headers["X-Host-Key"] = hostKey;

  const res = await fetch(path, {
    method: method || (body ? "POST" : "GET"),
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${t}`);
  }
  return res.json();
}

function broadcastStart(id) {
  bc?.postMessage({ type: "start", sessionId: id });
}

function startPolling() {
  stopPolling();
  poller = setInterval(async () => {
    if (!sessionId) return;
    try {
      const s = await api(`/api/session/${encodeURIComponent(sessionId)}`);
      if (s.updatedAt && s.updatedAt === lastUpdatedAt) return;
      lastUpdatedAt = s.updatedAt || 0;
      setCard(s.currentCard);
      els.prompt.textContent = s.prompt || "—";
      els.sessionIdText.textContent = sessionId;
      els.sessionMeta.textContent = `Streak: ${s.streak} • Phase: ${s.phase}`;
      setHostPanel(s.host);
    } catch (e) {
      // Session ended (or host key invalid)
      els.sessionMeta.textContent = "Not active";
      setStatus("Session ended. Refresh logs to see results.", "bad");
      stopPolling();
      await refreshLogs();
    }
  }, 500);
}

function stopPolling() {
  if (poller) clearInterval(poller);
  poller = null;
}

async function startAndAnnounce() {
  if (!hostKey) {
    setStatus("Set your host key first.", "bad");
    return;
  }
  setStatus("Starting…");
  const data = await api("/api/start", {});

  if (!data.host) {
    setStatus("Host key was rejected by the server. Check HOST_KEY env var and try again.", "bad");
    return;
  }
  sessionId = data.sessionId;
  lastUpdatedAt = data.updatedAt || 0;

  setCard(data.currentCard);
  els.prompt.textContent = data.prompt || "—";
  els.sessionIdText.textContent = sessionId;
  els.sessionMeta.textContent = `Streak: ${data.streak} • Phase: ${data.phase}`;
  setHostPanel(data.host);

  broadcastStart(sessionId);
  setStatus(`Announced session ${sessionId} to player tab.`, "good");
  startPolling();
}

function fmtTime(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

async function refreshLogs() {
  if (!hostKey) return;
  try {
    const data = await api("/api/logs?limit=50", null, "GET");
    const tbody = els.logsTable.querySelector("tbody");
    tbody.innerHTML = "";
    for (const row of data.logs || []) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${fmtTime(row.endedAt)}</td>
        <td>${row.result}</td>
        <td>${row.streak}</td>
        <td>${row.reason || "—"}</td>
        <td class="mono">${row.sessionId}</td>
      `;
      tbody.appendChild(tr);
    }
  } catch (e) {
    setStatus(String(e.message || e), "bad");
  }
}

async function downloadLogs() {
  if (!hostKey) return;
  try {
    const res = await fetch("/api/logs/download", {
      headers: { "X-Host-Key": hostKey },
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "game_logs.jsonl";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    setStatus(String(e.message || e), "bad");
  }
}

// ================= EV SIM =================

const DEFAULT_TIERS = [
  { min: 0, max: 3, prize: "Chinese Pack + Coupon", cost: 5 },
  { min: 4, max: 6, prize: "Chinese Pack x2", cost: 6 },
  { min: 7, max: 11, prize: "English Pack 1", cost: 8 },
  { min: 12, max: 17, prize: "Japanese Pack 2", cost: 10 },
  { min: 18, max: null, prize: "English Tin", cost: 19 },
];

function renderTiers(tiers) {
  const tbody = els.tiersTable.querySelector("tbody");
  tbody.innerHTML = "";
  tiers.forEach((t, idx) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><input class="ghost input" data-k="min" data-i="${idx}" type="number" step="1" value="${t.min}" /></td>
      <td><input class="ghost input" data-k="max" data-i="${idx}" type="number" step="1" value="${t.max ?? ""}" placeholder="∞" /></td>
      <td><input class="ghost input" data-k="prize" data-i="${idx}" type="text" value="${t.prize}" /></td>
      <td><input class="ghost input" data-k="cost" data-i="${idx}" type="number" step="0.01" value="${t.cost}" /></td>
      <td><button class="ghost" data-action="del" data-i="${idx}">✕</button></td>
    `;
    tbody.appendChild(tr);
  });
}

function readTiersFromUI() {
  const rows = [...els.tiersTable.querySelectorAll("tbody tr")];
  const tiers = [];
  for (const r of rows) {
    const inputs = r.querySelectorAll("input");
    const get = (k) => [...inputs].find((x) => x.dataset.k === k)?.value ?? "";
    const min = Number(get("min"));
    const maxRaw = String(get("max") || "").trim();
    const max = maxRaw === "" ? null : Number(maxRaw);
    const prize = String(get("prize") || "").trim() || "Tier";
    const cost = Number(get("cost"));
    if (!Number.isFinite(min) || !Number.isFinite(cost)) continue;
    tiers.push({ min, max: Number.isFinite(max) ? max : null, prize, cost });
  }
  tiers.sort((a, b) => a.min - b.min);
  return tiers;
}

function tierForStreak(tiers, streak) {
  for (const t of tiers) {
    const okMin = streak >= t.min;
    const okMax = t.max == null ? true : streak <= t.max;
    if (okMin && okMax) return t;
  }
  return tiers[tiers.length - 1] || { cost: 0, prize: "—" };
}

function simulate({ p1, p, trials, tiers, maxRounds = 500 }) {
  let totalCost = 0;
  const streaks = [];
  for (let i = 0; i < trials; i++) {
    let s = 0;
    // first guess
    if (Math.random() < p1) s++;
    else {
      streaks.push(s);
      totalCost += tierForStreak(tiers, s).cost;
      continue;
    }
    // next guesses
    while (s < maxRounds && Math.random() < p) s++;
    streaks.push(s);
    totalCost += tierForStreak(tiers, s).cost;
  }
  const avgCost = totalCost / trials;
  streaks.sort((a, b) => a - b);
  const pct = (q) => streaks[Math.floor(q * (streaks.length - 1))] ?? 0;
  return {
    avgCost,
    p50: pct(0.5),
    p90: pct(0.9),
    p99: pct(0.99),
  };
}

function runEvSim() {
  const entry = Number(els.evEntry.value || 10);
  const margin = Number(els.evMargin.value || 0.4);
  const p1 = Math.max(0, Math.min(1, Number(els.evP1.value || 0.65)));
  const p = Math.max(0, Math.min(1, Number(els.evP.value || 0.7)));
  const trials = Math.max(1000, Math.min(500000, Number(els.evTrials.value || 50000)));
  const tiers = readTiersFromUI();

  if (!tiers.length) {
    els.evOut.textContent = "Add at least one tier.";
    return;
  }
  const r = simulate({ p1, p, trials, tiers });

  const reqEntry = r.avgCost / Math.max(0.0001, 1 - margin);
  const actualMargin = entry <= 0 ? 0 : (entry - r.avgCost) / entry;

  els.evOut.textContent = [
    `Simulations: ${trials.toLocaleString()}`,
    `p(first): ${(p1 * 100).toFixed(1)}% • p(next): ${(p * 100).toFixed(1)}%`,
    "",
    `Expected prize cost: $${r.avgCost.toFixed(2)}`,
    `Margin at $${entry.toFixed(2)} entry: ${(actualMargin * 100).toFixed(1)}%`,
    `Entry needed for ${(margin * 100).toFixed(0)}% margin: $${reqEntry.toFixed(2)}`,
    "",
    `Streak percentiles (wins): p50=${r.p50} • p90=${r.p90} • p99=${r.p99}`,
  ].join("\n");
}

// ================= EVENTS =================

els.saveKeyBtn.addEventListener("click", () => {
  hostKey = String(els.hostKeyInput.value || "").trim();
  if (hostKey) sessionStorage.setItem("hostKey", hostKey);
  else sessionStorage.removeItem("hostKey");
  setStatus(hostKey ? "Host key saved." : "Host key cleared.", "good");
  refreshLogs();
});

els.openPlayerBtn.addEventListener("click", () => {
  window.open("/", "_blank", "noopener");
});

els.startBtn.addEventListener("click", () => {
  startAndAnnounce().catch((e) => setStatus(String(e.message || e), "bad"));
});

els.refreshLogsBtn.addEventListener("click", () => refreshLogs());
els.downloadLogsBtn.addEventListener("click", (e) => {
  e.preventDefault();
  downloadLogs();
});

els.runSimBtn.addEventListener("click", () => runEvSim());

els.addTierBtn.addEventListener("click", () => {
  const tiers = readTiersFromUI();
  tiers.push({ min: 0, max: null, prize: "New tier", cost: 0 });
  renderTiers(tiers);
});

els.resetTiersBtn.addEventListener("click", () => {
  renderTiers(structuredClone(DEFAULT_TIERS));
});

els.tiersTable.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action='del']");
  if (!btn) return;
  const idx = Number(btn.dataset.i);
  const tiers = readTiersFromUI();
  tiers.splice(idx, 1);
  renderTiers(tiers);
});

(async function init() {
  els.hostKeyInput.value = hostKey;
  renderTiers(structuredClone(DEFAULT_TIERS));
  setHostPanel(null);

  bc = new BroadcastChannel("pokemon-hilo-control");
  bc.onmessage = async (ev) => {
    const msg = ev.data || {};
    if (msg.type === "update" && msg.sessionId && msg.sessionId === sessionId) {
      // opportunistic refresh to feel real-time
      try {
        const s = await api(`/api/session/${encodeURIComponent(sessionId)}`);
        lastUpdatedAt = s.updatedAt || lastUpdatedAt;
        setCard(s.currentCard);
        els.prompt.textContent = s.prompt || "—";
        els.sessionMeta.textContent = `Streak: ${s.streak} • Phase: ${s.phase}`;
        setHostPanel(s.host);
      } catch {
        // ended
        await refreshLogs();
      }
    }
  };

  // Load logs if key already present
  if (hostKey) await refreshLogs();
})();
