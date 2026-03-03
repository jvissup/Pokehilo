const $ = (id) => document.getElementById(id);

const els = {
  // Current card (left)
  cardImg: $("cardImg"),
  cardTitle: $("cardTitle"),
  cardSet: $("cardSet"),

  // Previous card (middle)
  prevCardFrame: $("prevCardFrame"),
  prevCardImg: $("prevCardImg"),
  prevCardBack: $("prevCardBack"),
  prevCardTitle: $("prevCardTitle"),
  prevCardSet: $("prevCardSet"),

  prompt: $("prompt"),
  status: $("status"),
  streakPill: $("streakPill"),
  timerNum: $("timerNum"),
  timerFill: $("timerFill"),
  moreBtn: $("moreBtn"),
  lessBtn: $("lessBtn"),
  playerHelp: $("playerHelp"),
  playerStartBtn: $("playerStartBtn"),
};

let timerSeconds = 8;
let sessionId = null;
let streak = 0;
let phase = "first";
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

function setCurrentCard(card) {
  if (!card) return;
  els.cardImg.src = card.imageSrc;
  els.cardTitle.textContent = card.title || "—";
  els.cardSet.textContent = card.setName || "—";
}

function clearCurrentCard() {
  els.cardImg.removeAttribute("src");
  els.cardTitle.textContent = "—";
  els.cardSet.textContent = "—";
}

function setPreviousCard(card) {
  if (!card) {
    els.prevCardImg.removeAttribute("src");
    els.prevCardImg.style.display = "none";
    els.prevCardBack.style.display = "block";
    els.prevCardTitle.textContent = "—";
    els.prevCardSet.textContent = "—";
    return;
  }
  els.prevCardImg.src = card.imageSrc;
  els.prevCardImg.style.display = "block";
  els.prevCardBack.style.display = "none";
  els.prevCardTitle.textContent = card.title || "—";
  els.prevCardSet.textContent = card.setName || "—";
}

function setPrompt(text) {
  els.prompt.textContent = text;
}

async function api(path, body = null, method = null) {
  const headers = { "Content-Type": "application/json" };
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

function showWaiting() {
  sessionId = null;
  phase = "first";
  setStreak(0);
  stopTimer();
  resetTimerUIOnly();
  setButtonsEnabled(false);
  setPrompt("Ready");
  setStatus("Press Play again to start a new round.", "");
  els.playerHelp.hidden = false;
  els.prevCardFrame.style.opacity = "1";

  clearCurrentCard();
  setPreviousCard(null);
}

async function startLocalGame() {
  stopTimer();
  resetTimerUIOnly();
  setButtonsEnabled(false);
  els.playerHelp.hidden = true;
  setStatus("Starting…");

  const data = await api("/api/start", {});
  sessionId = data.sessionId;
  phase = data.phase;
  setStreak(data.streak || 0);

  setCurrentCard(data.currentCard);
  setPreviousCard(data.previousCard || null);
  setPrompt(data.prompt);

  resetTimerUIOnly();
  setTimeout(() => {
    resetTimerUIOnly();
    setButtonsEnabled(true);
    setStatus("");
    startTimer();
  }, 350);
}

async function submitGuess(guess) {
  if (inputLocked || !sessionId) return;
  setButtonsEnabled(false);
  stopTimer();
  resetTimerUIOnly();

  const data = await api("/api/guess", { sessionId, guess });

  setStreak(data.streak ?? streak);
  phase = data.phase || phase;

  if (data.currentCard) setCurrentCard(data.currentCard);
  if (Object.prototype.hasOwnProperty.call(data, "previousCard")) {
    setPreviousCard(data.previousCard);
  }

  if (data.result === "lose") {
    setPrompt("Game over");
    els.prevCardFrame.style.opacity = "0.55";

    const msg = [
      data.message || "Wrong.",
      `You got ${data.streak ?? streak} right before you lost.`,
      data.reason === "timeout" ? "(Timed out.)" : "",
    ]
      .filter(Boolean)
      .join("\n");
    setStatus(msg, "bad");

    setTimeout(() => showWaiting(), 2500);
    return;
  }

  // Win path
  setPrompt(data.prompt || "Next round");
  setStatus("Correct! 🔥", "good");
  els.prevCardFrame.style.opacity = "1";

  resetTimerUIOnly();

  setTimeout(() => {
    setStatus("");
    resetTimerUIOnly();
    setButtonsEnabled(true);
    startTimer();
  }, 650);
}

async function handleTimeout() {
  if (!sessionId) return;
  try {
    const data = await api("/api/timeout", { sessionId });
    setStreak(data.streak ?? streak);

    if (data.currentCard) setCurrentCard(data.currentCard);
    if (Object.prototype.hasOwnProperty.call(data, "previousCard")) {
      setPreviousCard(data.previousCard);
    }

    setPrompt("Game over");
    els.prevCardFrame.style.opacity = "0.55";
    setStatus(`Time's up!\nYou got ${data.streak ?? streak} right before you lost.`, "bad");

    setTimeout(() => showWaiting(), 2500);
  } catch (e) {
    setStatus(String(e.message || e), "bad");
    setTimeout(() => showWaiting(), 2500);
  }
}

els.moreBtn.addEventListener("click", () => submitGuess("more"));
els.lessBtn.addEventListener("click", () => submitGuess("less"));

window.addEventListener("keydown", (e) => {
  if (e.key === "ArrowUp") submitGuess("more");
  if (e.key === "ArrowDown") submitGuess("less");
  if (e.key.toLowerCase() === "n") {
    if (!sessionId) startLocalGame().catch((err) => setStatus(String(err.message || err), "bad"));
  }
});

els.playerStartBtn?.addEventListener("click", () => {
  startLocalGame().catch((e) => setStatus(String(e.message || e), "bad"));
});

(async function init() {
  try {
    const info = await api("/api/info");
    timerSeconds = Number(info.timerSeconds || 8);
    timeLeft = timerSeconds;
    updateTimerUI();

    await startLocalGame();
  } catch (e) {
    setStatus(String(e.message || e), "bad");
    setButtonsEnabled(false);
  }
})();
