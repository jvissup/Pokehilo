import express from "express";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { parse } from "csv-parse/sync";
import * as cheerio from "cheerio";

const app = express();
const PORT = process.env.PORT || 3000;

// Host mode is controlled by the host page (host.html) via a simple flag.
// No host key is required since this is intended to be run locally by the host.

const DATA_PATH = process.env.CARDS_CSV_PATH || path.join(process.cwd(), "data", "cards.csv");
const LOG_PATH = process.env.GAME_LOG_PATH || path.join(process.cwd(), "data", "game_logs.jsonl");
const PUBLIC_DIR = path.join(process.cwd(), "public");
const IMAGES_DIR = path.join(PUBLIC_DIR, "images");

const TIMER_SECONDS = 8;
const START_THRESHOLD_CAD = 40;

app.use(express.json({ limit: "200kb" }));
app.use(express.static(PUBLIC_DIR));

/**
 * Cards: { id, url, setName, priceCad, imageFile }
 */
let cards = [];

/** PriceCharting scrape cache: url -> { imageUrl, title, fetchedAt } */
const metaCache = new Map();

/** Sessions in memory: sessionId -> session */
const sessions = new Map();

function toCadFloat(v) {
  // Accept "$48.3" or "48.3"
  const n = Number(String(v ?? "").replace("$", "").trim());
  // Ensure 1 decimal place as requested
  return Math.round(n * 10) / 10;
}

function loadCards() {
  const csvRaw = fs.readFileSync(DATA_PATH, "utf8");
  const records = parse(csvRaw, { columns: true, skip_empty_lines: true });

  cards = records
    .map((r, idx) => {
      const url = String(r.Name || r.URL || r.Url || "").trim();
      const setName = String(r.NAME || r.Set || r.set || "").trim();
      const priceCad = toCadFloat(r.CAD);
      const imageFile = String(r.ImageFile || r.Image || r.image || "").trim();
      if (!url) return null;
      if (!Number.isFinite(priceCad)) return null;
      return { id: idx, url, setName, priceCad, imageFile };
    })
    .filter(Boolean);

  if (!cards.length) {
    throw new Error("No cards loaded. Check your CSV headers and path: " + DATA_PATH);
  }

  console.log(`Loaded ${cards.length} cards from CSV.`);
}

function shuffle(arr) {
  // Fisher-Yates
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function isHost(req) {
  // Host page calls APIs with ?host=1 (or X-Host: 1). Player page never does.
  const q = String(req.query.host || "").trim();
  const h = String(req.header("x-host") || "").trim();
  return q === "1" || h === "1";
}

function pickCardFromDeck(session) {
  if (!session.deck?.length) return null;
  const id = session.deck.pop();
  return cards[id] || null;
}

async function fetchCardMeta(pricechartingUrl) {
  const cached = metaCache.get(pricechartingUrl);
  const now = Date.now();
  if (cached && now - cached.fetchedAt < 1000 * 60 * 60 * 24 * 7) {
    return cached;
  }

  const res = await fetch(pricechartingUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
    },
  });

  if (!res.ok) {
    throw new Error(`PriceCharting fetch failed: ${res.status} ${res.statusText}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  const ogImage =
    $("meta[property='og:image']").attr("content") ||
    $("meta[name='twitter:image']").attr("content") ||
    "";
  const ogTitle = $("meta[property='og:title']").attr("content") || $("title").text() || "";

  const meta = {
    imageUrl: String(ogImage).trim(),
    title: String(ogTitle).trim(),
    fetchedAt: now,
  };

  metaCache.set(pricechartingUrl, meta);
  return meta;
}

function ensureLogFile() {
  const dir = path.dirname(LOG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(LOG_PATH)) fs.writeFileSync(LOG_PATH, "", "utf8");
}

function appendGameLog(entry) {
  ensureLogFile();
  fs.appendFileSync(LOG_PATH, JSON.stringify(entry) + "\n", "utf8");
}

function safeSlugTitleFromUrl(u) {
  try {
    const url = new URL(u);
    const last = url.pathname.split("/").filter(Boolean).at(-1) || "card";
    return last
      .replace(/-/g, " ")
      .replace(/\b\w/g, (m) => m.toUpperCase());
  } catch {
    return "Card";
  }
}

function slugFromPriceChartingUrl(u) {
  try {
    const url = new URL(u);
    return (url.pathname.split("/").filter(Boolean).at(-1) || "card").trim();
  } catch {
    return "card";
  }
}

function localImageSrcIfExists(card) {
  // Priority:
  // 1) Explicit ImageFile column
  // 2) slug from URL
  // Supported extensions: .jpg .jpeg .png .webp
  const candidates = [];
  if (card.imageFile) candidates.push(card.imageFile);
  const slug = slugFromPriceChartingUrl(card.url);
  candidates.push(`${slug}.jpg`, `${slug}.jpeg`, `${slug}.png`, `${slug}.webp`);

  for (const filename of candidates) {
    const clean = filename.replace(/^\/+/, "");
    const abs = path.join(IMAGES_DIR, clean);
    if (fs.existsSync(abs)) {
      return `/images/${encodeURIComponent(clean)}`;
    }
  }
  return "";
}

async function cardForClient(card) {
  const local = localImageSrcIfExists(card);
  const meta = local
    ? { imageUrl: "", title: "" }
    : await fetchCardMeta(card.url).catch(() => ({ imageUrl: "", title: "" }));

  const title = meta.title || safeSlugTitleFromUrl(card.url);

  return {
    id: card.id,
    url: card.url,
    setName: card.setName,
    title,
    imageSrc: local || `/api/image?u=${encodeURIComponent(card.url)}`,
  };
}

function promptForPhase(phase) {
  if (phase === "first") return `Is this card more or less than $${START_THRESHOLD_CAD} (CAD)?`;
  // compare
  return "Is this card more or less expensive than the previous card?";
}

function compareDirection(currentPrice, prevPrice) {
  if (currentPrice > prevPrice) return "more";
  if (currentPrice < prevPrice) return "less";
  return "tie"; // tie = loss
}

function hostPayloadForSession(session) {
  const current = session.currentCardId != null ? cards[session.currentCardId] : null;
  const prev = session.prevCardId != null ? cards[session.prevCardId] : null;

  const host = {
    prevPriceCad: prev?.priceCad ?? null,
    currentPriceCad: current?.priceCad ?? null,
    deckRemaining: session.deck?.length ?? null,
    phase: session.phase,
  };

  if (session.phase === "first") {
    const p = current?.priceCad;
    host.startThresholdCad = START_THRESHOLD_CAD;
    host.correctAnswer =
      p > START_THRESHOLD_CAD ? "more" : p < START_THRESHOLD_CAD ? "less" : "tie (loss)";
  } else if (session.phase === "compare") {
    const d =
      current && prev ? compareDirection(current.priceCad, prev.priceCad) : "—";
    host.correctAnswer = d === "tie" ? "tie (loss)" : d;
  }

  return host;
}

// ================== API ==================

app.get("/api/info", (req, res) => {
  res.json({
    cards: cards.length,
    currency: "CAD",
    timerSeconds: TIMER_SECONDS,
    startThresholdCad: START_THRESHOLD_CAD,
    rounding: "1 decimal",
    phases: ["first", "compare"],
  });
});

app.get("/api/session/:sessionId", async (req, res) => {
  const { sessionId } = req.params;
  const session = sessions.get(sessionId);
  if (!session) return res.status(404).json({ error: "Session not found." });

  const current = cards[session.currentCardId];
  if (!current) return res.status(500).json({ error: "Current card missing." });

  const prev = session.prevCardId != null ? cards[session.prevCardId] : null;

  const payload = {
    sessionId: session.id,
    streak: session.streak,
    phase: session.phase,
    prompt: promptForPhase(session.phase),
    currentCard: await cardForClient(current),
    previousCard: prev ? await cardForClient(prev) : null,
    updatedAt: session.updatedAt,
  };

  if (isHost(req)) {
    payload.host = hostPayloadForSession(session);
  }

  res.json(payload);
});

app.post("/api/reload", (req, res) => {
  try {
    loadCards();
    res.json({ ok: true, cards: cards.length });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

app.post("/api/start", async (req, res) => {
  const deck = shuffle(cards.map((c) => c.id));
  const first = pickCardFromDeck({ deck });
  if (!first) return res.status(500).json({ error: "No cards available." });

  const sessionId = crypto.randomUUID();
  const session = {
    id: sessionId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    streak: 0,
    phase: "first",
    deck,
    prevCardId: null,
    currentCardId: first.id,
    steps: [],
  };

  sessions.set(sessionId, session);

  const payload = {
    sessionId,
    streak: session.streak,
    phase: session.phase,
    prompt: promptForPhase(session.phase),
    currentCard: await cardForClient(first),
    previousCard: null,
    updatedAt: session.updatedAt,
  };

  if (isHost(req)) {
    payload.host = hostPayloadForSession(session);
  }

  res.json(payload);
});

app.post("/api/guess", async (req, res) => {
  const { sessionId, guess } = req.body || {};
  const session = sessions.get(sessionId);
  if (!session) return res.status(404).json({ error: "Session not found." });

  const normalizedGuess = String(guess || "").toLowerCase();
  if (!['more', 'less'].includes(normalizedGuess)) {
    return res.status(400).json({ error: "Guess must be 'more' or 'less'." });
  }

  const current = cards[session.currentCardId];
  const prev = session.prevCardId != null ? cards[session.prevCardId] : null;
  if (!current) return res.status(500).json({ error: "Current card missing." });

  const endSession = async ({ reason, message, correctDirection }) => {
    const endedAt = Date.now();

    // Log entry
    appendGameLog({
      sessionId: session.id,
      startedAt: new Date(session.createdAt).toISOString(),
      endedAt: new Date(endedAt).toISOString(),
      result: 'lose',
      reason,
      streak: session.streak,
      steps: session.steps,
      cardsInPool: cards.length,
    });

    sessions.delete(sessionId);

    const payload = {
      result: 'lose',
      reason,
      message,
      streak: session.streak,
      phase: session.phase,
      prompt: 'Game over',
      currentCard: await cardForClient(current),
      previousCard: prev ? await cardForClient(prev) : null,
      correctDirection,
    };

    if (isHost(req)) {
      payload.host = hostPayloadForSession(session);
    }

    res.json(payload);
  };

  // ===== Phase 1: current card vs $40 =====
  if (session.phase === 'first') {
    const price = current.priceCad;
    const correct = price > START_THRESHOLD_CAD ? 'more' : price < START_THRESHOLD_CAD ? 'less' : 'tie';
    const win = correct !== 'tie' && normalizedGuess === correct;

    session.updatedAt = Date.now();
    session.steps.push({
      ts: new Date(session.updatedAt).toISOString(),
      phase: 'first',
      cardId: current.id,
      priceCad: price,
      thresholdCad: START_THRESHOLD_CAD,
      guess: normalizedGuess,
      correct: correct === 'tie' ? 'tie' : correct,
      win,
    });

    if (!win) {
      return endSession({
        reason: correct === 'tie' ? 'tie' : 'wrong',
        message: correct === 'tie' ? `It was exactly $${START_THRESHOLD_CAD.toFixed(1)} — ties are a loss.` : 'Wrong guess.',
        correctDirection: correct === 'tie' ? 'tie' : correct,
      });
    }

    // Win: advance to compare by drawing the next visible current card.
    session.streak += 1;
    session.phase = 'compare';
    session.prevCardId = current.id;

    const next = pickCardFromDeck(session);
    if (!next) {
      // No next card — deck cleared.
      appendGameLog({
        sessionId: session.id,
        startedAt: new Date(session.createdAt).toISOString(),
        endedAt: new Date(Date.now()).toISOString(),
        result: 'complete',
        reason: 'deck_empty_after_first',
        streak: session.streak,
        steps: session.steps,
        cardsInPool: cards.length,
      });
      sessions.delete(sessionId);
      const payload = {
        result: 'win',
        streak: session.streak,
        phase: 'complete',
        message: 'You cleared the deck!',
        currentCard: await cardForClient(current),
        previousCard: null,
      };
      if (isHost(req)) payload.host = hostPayloadForSession(session);
      return res.json(payload);
    }

    session.currentCardId = next.id;
    session.updatedAt = Date.now();

    const payload = {
      result: 'win',
      streak: session.streak,
      phase: session.phase,
      message: 'Correct!',
      prompt: promptForPhase(session.phase),
      currentCard: await cardForClient(next),
      previousCard: await cardForClient(current),
      updatedAt: session.updatedAt,
    };

    if (isHost(req)) {
      payload.host = hostPayloadForSession(session);
    }

    return res.json(payload);
  }

  // ===== Compare phase: current vs previous =====
  if (session.phase === 'compare') {
    if (!prev) return res.status(500).json({ error: 'Previous card missing.' });

    const correct = compareDirection(current.priceCad, prev.priceCad);
    const win = correct !== 'tie' && normalizedGuess === correct;

    session.updatedAt = Date.now();
    session.steps.push({
      ts: new Date(session.updatedAt).toISOString(),
      phase: 'compare',
      prevCardId: prev.id,
      prevPriceCad: prev.priceCad,
      currentCardId: current.id,
      currentPriceCad: current.priceCad,
      guess: normalizedGuess,
      correct: correct === 'tie' ? 'tie' : correct,
      win,
    });

    if (!win) {
      return endSession({
        reason: correct === 'tie' ? 'tie' : 'wrong',
        message: correct === 'tie' ? 'Tie — ties are a loss.' : 'Wrong guess.',
        correctDirection: correct === 'tie' ? 'tie' : correct,
      });
    }

    // Win: streak++, shift current -> previous, draw a new current.
    session.streak += 1;
    session.prevCardId = current.id;

    const next = pickCardFromDeck(session);
    if (!next) {
      appendGameLog({
        sessionId: session.id,
        startedAt: new Date(session.createdAt).toISOString(),
        endedAt: new Date(Date.now()).toISOString(),
        result: 'complete',
        reason: 'deck_cleared',
        streak: session.streak,
        steps: session.steps,
        cardsInPool: cards.length,
      });
      sessions.delete(sessionId);
      const payload = {
        result: 'win',
        streak: session.streak,
        phase: 'complete',
        message: 'You cleared the deck!',
        currentCard: await cardForClient(current),
        previousCard: await cardForClient(prev),
      };
      if (isHost(req)) payload.host = hostPayloadForSession(session);
      return res.json(payload);
    }

    session.currentCardId = next.id;
    session.updatedAt = Date.now();

    const payload = {
      result: 'win',
      streak: session.streak,
      phase: session.phase,
      message: 'Correct!',
      prompt: promptForPhase(session.phase),
      currentCard: await cardForClient(next),
      previousCard: await cardForClient(current),
      updatedAt: session.updatedAt,
    };

    if (isHost(req)) {
      payload.host = hostPayloadForSession(session);
    }

    return res.json(payload);
  }

  return res.status(400).json({ error: 'Unknown phase.' });
});

app.post('/api/timeout', async (req, res) => {
  const { sessionId } = req.body || {};
  const session = sessions.get(sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found.' });

  const current = cards[session.currentCardId];
  const prev = session.prevCardId != null ? cards[session.prevCardId] : null;

  session.updatedAt = Date.now();
  session.steps.push({
    ts: new Date(session.updatedAt).toISOString(),
    phase: session.phase,
    reason: 'timeout',
  });

  appendGameLog({
    sessionId: session.id,
    startedAt: new Date(session.createdAt).toISOString(),
    endedAt: new Date(Date.now()).toISOString(),
    result: 'lose',
    reason: 'timeout',
    streak: session.streak,
    steps: session.steps,
    cardsInPool: cards.length,
  });

  sessions.delete(sessionId);

  const payload = {
    result: 'lose',
    reason: 'timeout',
    message: "Time's up!",
    streak: session.streak,
    phase: session.phase,
    prompt: 'Game over',
    currentCard: current ? await cardForClient(current) : null,
    previousCard: prev ? await cardForClient(prev) : null,
  };

  if (isHost(req)) payload.host = hostPayloadForSession(session);

  res.json(payload);
});

app.get('/api/logs', (req, res) => {
  const limit = Math.max(1, Math.min(500, Number(req.query.limit || 50)));
  ensureLogFile();
  const raw = fs.readFileSync(LOG_PATH, 'utf8');
  const lines = raw.split('\n').filter(Boolean);
  const sliced = lines.slice(-limit);
  const logs = [];
  for (const line of sliced) {
    try {
      logs.push(JSON.parse(line));
    } catch {
      // ignore
    }
  }
  res.json({ logs: logs.reverse() });
});

app.get('/api/logs/download', (req, res) => {
  ensureLogFile();
  res.setHeader('Content-Type', 'application/jsonl; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=game_logs.jsonl');
  fs.createReadStream(LOG_PATH).pipe(res);
});

app.get('/api/image', async (req, res) => {
  const u = String(req.query.u || '').trim();
  if (!u) return res.status(400).send('Missing u');

  try {
    const meta = await fetchCardMeta(u);
    if (!meta.imageUrl) return res.status(404).send('No image found');

    const imgRes = await fetch(meta.imageUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36",
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        Referer: 'https://www.pricecharting.com/',
      },
    });

    if (!imgRes.ok) return res.status(502).send('Image fetch failed');
    const ct = imgRes.headers.get('content-type') || 'image/jpeg';
    res.setHeader('Content-Type', ct);
    res.setHeader('Cache-Control', 'public, max-age=86400');

    const arrayBuffer = await imgRes.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));
  } catch (e) {
    res.status(500).send(String(e?.message || e));
  }
});

// Clean up old sessions every 10 minutes
setInterval(() => {
  const cutoff = Date.now() - 1000 * 60 * 60; // 1 hour
  for (const [id, s] of sessions.entries()) {
    if (s.createdAt < cutoff) sessions.delete(id);
  }
}, 1000 * 60 * 10);

loadCards();

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log('Host mode: open /host.html (no host key required).');
});
