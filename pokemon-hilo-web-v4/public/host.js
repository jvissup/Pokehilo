const $ = (id) => document.getElementById(id);

const els = {
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
  hostPrev: $("hostPrev"),
  hostCorrect: $("hostCorrect"),
  hostPrevTitle: $("hostPrevTitle"),
  hostDeck: $("hostDeck"),
};

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

function setHostPanel(host, prevCard) {
  els.hostPrev.textContent = host?.prevPriceCad != null ? `$${Number(host.prevPriceCad).toFixed(1)}` : "—";
  els.hostCurrent.textContent = host?.currentPriceCad != null ? `$${Number(host.currentPriceCad).toFixed(1)}` : "—";
  els.hostCorrect.textContent = host?.correctAnswer || "—";
  els.hostPrevTitle.textContent = prevCard?.title || "—";
  els.hostDeck.textContent = host?.deckRemaining != null ? String(host.deckRemaining) : "—";
}

async function api(path, body = null, method = null) {
  const headers = { "Content-Type": "application/json" };
  const url = path.includes("?") ? `${path}&host=1` : `${path}?host=1`;
  const res = await fetch(url, {
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
      setHostPanel(s.host, s.previousCard);
    } catch (e) {
      els.sessionMeta.textContent = "Not active";
      setStatus("Session ended.", "bad");
      stopPolling();
    }
  }, 500);
}

function stopPolling() {
  if (poller) clearInterval(poller);
  poller = null;
}

async function startAndAnnounce() {
  setStatus("Starting…");
  const data = await api("/api/start", {});
  sessionId = data.sessionId;
  lastUpdatedAt = data.updatedAt || 0;

  setCard(data.currentCard);
  els.prompt.textContent = data.prompt || "—";
  els.sessionIdText.textContent = sessionId;
  els.sessionMeta.textContent = `Streak: ${data.streak} • Phase: ${data.phase}`;
  setHostPanel(data.host, data.previousCard);

  broadcastStart(sessionId);
  setStatus(`Announced session to player tab.`, "good");
  startPolling();
}

// ================= EVENTS =================

els.openPlayerBtn.addEventListener("click", () => {
  window.open("/", "_blank", "noopener");
});

els.startBtn.addEventListener("click", () => {
  startAndAnnounce().catch((e) => setStatus(String(e.message || e), "bad"));
});

(async function init() {
  setHostPanel(null, null);

  bc = new BroadcastChannel("pokemon-hilo-control");
  bc.onmessage = async (ev) => {
    const msg = ev.data || {};
    if (msg.type === "start" && msg.sessionId) {
      sessionId = msg.sessionId;
      try {
        const s = await api(`/api/session/${encodeURIComponent(sessionId)}`);
        lastUpdatedAt = s.updatedAt || 0;
        setCard(s.currentCard);
        els.prompt.textContent = s.prompt || "—";
        els.sessionIdText.textContent = sessionId;
        els.sessionMeta.textContent = `Streak: ${s.streak} • Phase: ${s.phase}`;
        setHostPanel(s.host, s.previousCard);
        setStatus(`Attached to player-started session.`, "good");
        startPolling();
      } catch (e) {
        setStatus(String(e.message || e), "bad");
      }
      return;
    }
    if (msg.type === "update" && msg.sessionId && msg.sessionId === sessionId) {
      try {
        const s = await api(`/api/session/${encodeURIComponent(sessionId)}`);
        lastUpdatedAt = s.updatedAt || lastUpdatedAt;
        setCard(s.currentCard);
        els.prompt.textContent = s.prompt || "—";
        els.sessionMeta.textContent = `Streak: ${s.streak} • Phase: ${s.phase}`;
        setHostPanel(s.host, s.previousCard);
      } catch {
        // session ended
      }
    }
  };
})();
