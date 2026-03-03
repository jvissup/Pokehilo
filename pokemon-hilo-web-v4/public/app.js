const timerSeconds = 8;

const $ = (id) => document.getElementById(id);

const els = {
  cardImg: $("cardImg"),
  cardTitle: $("cardTitle"),
  cardSet: $("cardSet"),
  prompt: $("prompt"),
  status: $("status"),
  streakPill: $("streakPill"),
  timerNum: $("timerNum"),
  timerFill: $("timerFill"),
  moreBtn: $("moreBtn"),
  lessBtn: $("lessBtn"),
  newGameBtn: $("newGameBtn"),
  hostBtn: $("hostBtn"),
  hostPanel: $("hostPanel"),
  hostCurrent: $("hostCurrent"),
  hostNext: $("hostNext"),
  hostCorrect: $("hostCorrect"),
  hostNextTitle: $("hostNextTitle"),
  nextCardFrame: $("nextCardFrame"),
};

let sessionId = null;
let streak = 0;
let phase = "first";
let hostKey = localStorage.getItem("hostKey") || "";
let timer = null;
let timeLeft = timerSeconds;
let inputLocked = true;

function setStatus(text, kind = "") {
  els.status.textContent = text || "";
  els.status.classList.remove("good", "bad");
  if (kind === "good") els.status.classList.add("good");
  if (kind === "bad") els.status.classList.add("bad");
}

function setButtonsEnabled(enabled) {
  els.moreBtn.disabled = !enabled;
  els.lessBtn.disabled = !enabled;
  inputLocked = !enabled;
}

function setStreak(n) {
  streak = n;
  els.streakPill.textContent = `Streak: ${streak}`;
}

function updateTimerUI() {
  els.timerNum.textContent = timeLeft.toFixed(1);
  const pct = Math.max(0, Math.min(1, timeLeft / timerSeconds));
  els.timerFill.style.width = `${pct * 100}%`;
}

function stopTimer() {
  if (timer) clearInterval(timer);
  timer = null;
}

function resetTimerUIOnly() {
  timeLeft = timerSeconds;
  updateTimerUI();
}

function startTimer() {
  stopTimer();
  timeLeft = timerSeconds;
  updateTimerUI();

  const startedAt = performance.now();
  timer = setInterval(async () => {
    const elapsed = (performance.now() - startedAt) / 1000;
    timeLeft = Math.max(0, timerSeconds - elapsed);
    updateTimerUI();

    if (timeLeft <= 0) {
      stopTimer();
      setButtonsEnabled(false);
      await handleTimeout();
    }
  }, 50);
}

function setCard(card) {
  els.cardImg.src = card.imageSrc;
  els.cardTitle.textContent = card.title || "—";
  els.cardSet.textContent = card.setName || "—";
}

function setPrompt(text) {
  els.prompt.textContent = text;
}

function setHostPanel(host) {
  if (!hostKey) {
    els.hostPanel.hidden = true;
    return;
  }
  els.hostPanel.hidden = false;
  els.hostCurrent.textContent =
    host?.currentPriceCad != null ? `$${Number(host.currentPriceCad).toFixed(1)} CAD` : "—";
  els.hostNext.textContent =
    host?.nextPriceCad != null ? `$${Number(host.nextPriceCad).toFixed(1)} CAD` : "—";
  els.hostCorrect.textContent = host?.correctNext || host?.correctAnswer || "—";
  els.hostNextTitle.textContent = host?.nextTitle || "—";
}

async function api(path, body = null) {
  const headers = { "Content-Type": "application/json" };
  if (hostKey) headers["X-Host-Key"] = hostKey;
  const res = await fetch(path, {
    method: body ? "POST" : "GET",
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${t}`);
  }
  return res.json();
}

async function newGame() {
  stopTimer();
  resetTimerUIOnly();
  setButtonsEnabled(false);
  setStatus("Starting…");
  els.nextCardFrame.style.opacity = "1";

  const data = await api("/api/start", {});
  sessionId = data.sessionId;
  phase = data.phase;
  setStreak(data.streak || 0);
  setCard(data.currentCard);
  setPrompt(data.prompt);
  setHostPanel(data.host);

  // Show a tiny delay, then unlock inputs + start timer.
  resetTimerUIOnly();
  setTimeout(() => {
    resetTimerUIOnly(); // reset again when card is shown (per requirement)
    setButtonsEnabled(true);
    setStatus("");
    startTimer();
  }, 350);
}

async function submitGuess(guess) {
  if (inputLocked) return;
  setButtonsEnabled(false);
  stopTimer();

  // reset when player wins/loses (UI reset)
  resetTimerUIOnly();

  const data = await api("/api/guess", { sessionId, guess });

  setStreak(data.streak ?? streak);
  setHostPanel(data.host);

  if (data.result === "lose") {
    // Reveal card if provided (usually next card or current)
    if (data.revealedCard) setCard(data.revealedCard);

    setPrompt("Game over");
    els.nextCardFrame.style.opacity = "0.35";

    const msg = [
      data.message || "Wrong.",
      `You got ${data.streak ?? streak} right before you lost.`,
      data.reason === "timeout" ? "(Timed out.)" : "",
    ]
      .filter(Boolean)
      .join("\n");
    setStatus(msg, "bad");
    return;
  }

  // Win path
  if (data.currentCard) setCard(data.currentCard);
  if (data.revealedCard) setCard(data.revealedCard);
  setPrompt(data.prompt || "Next round");
  setStatus("Correct! 🔥", "good");

  // Reset timer when player wins, then again when next prompt is active.
  resetTimerUIOnly();

  setTimeout(() => {
    setStatus("");
    resetTimerUIOnly(); // reset again when next card is shown / next round starts
    setButtonsEnabled(true);
    startTimer();
  }, 650);
}

async function handleTimeout() {
  if (!sessionId) return;
  try {
    const data = await api("/api/timeout", { sessionId });
    setStreak(data.streak ?? streak);
    setHostPanel(data.host);

    if (data.revealedCard) setCard(data.revealedCard);

    setPrompt("Game over");
    els.nextCardFrame.style.opacity = "0.35";
    setStatus(`Time's up!\nYou got ${data.streak ?? streak} right before you lost.`, "bad");
  } catch (e) {
    setStatus(String(e.message || e), "bad");
  }
}

els.moreBtn.addEventListener("click", () => submitGuess("more"));
els.lessBtn.addEventListener("click", () => submitGuess("less"));
els.newGameBtn.addEventListener("click", () => newGame());

els.hostBtn.addEventListener("click", async () => {
  const current = hostKey || "";
  const next = prompt("Enter host key (prices will show in this browser):", current);
  if (next == null) return;
  hostKey = next.trim();
  if (hostKey) localStorage.setItem("hostKey", hostKey);
  else localStorage.removeItem("hostKey");

  // soft refresh host panel using /api/info; then restart game to receive host payloads
  els.hostPanel.hidden = !hostKey;
  setHostPanel(null);
  await newGame();
});

window.addEventListener("keydown", (e) => {
  if (e.key === "ArrowUp") submitGuess("more");
  if (e.key === "ArrowDown") submitGuess("less");
  if (e.key.toLowerCase() === "n") newGame();
});

// Boot
(async function init() {
  try {
    await api("/api/info");
    await newGame();
  } catch (e) {
    setStatus(String(e.message || e), "bad");
    setButtonsEnabled(false);
  }
})();
