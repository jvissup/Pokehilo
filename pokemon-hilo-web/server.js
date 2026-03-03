import express from "express";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { parse } from "csv-parse/sync";
import * as cheerio from "cheerio";

const app = express();
const PORT = process.env.PORT || 3000;

// Set this before running (recommended).
// Example: HOST_KEY="my-secret" npm start
const HOST_KEY = process.env.HOST_KEY || "change-me";

const DATA_PATH = process.env.CARDS_CSV_PATH || path.join(process.cwd(), "data", "cards.csv");
const PUBLIC_DIR = path.join(process.cwd(), "public");

app.use(express.json({ limit: "200kb" }));
app.use(express.static(PUBLIC_DIR));

/**
 * Cards: { id, url, setName, priceCad, imageFile? }
 */
let cards = [];

/** PriceCharting scrape cache: url -> { imageUrl, title, fetchedAt } */
const metaCache = new Map();

/** Sessions in memory: sessionId -> session */
const sessions = new Map();

function toCadFloat(v) {
  // Accept "$48.3" or "48.3"
  const n = Number(String(v).replace("$", "").trim());
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
      // Optional: allow providing a local image file name (relative to public/images)
      const imageFile = String(r.ImageFile || r.imageFile || r.IMAGE_FILE || r.image || "").trim();
      if (!url) return null;
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
  const key = String(req.header("x-host-key") || "").trim();
  return key && key === HOST_KEY;
}

function pickCardFromDeck(session) {
  if (session.deck.length === 0) return null;
  const id = session.deck.pop();
  return cards[id] || null;
}

async function fetchCardMeta(pricechartingUrl) {
  const cached = metaCache.get(pricechartingUrl);
  const now = Date.now();
  if (cached && now - cached.fetchedAt < 1000 * 60 * 60 * 24 * 7) {
    return cached;
  }

  // Fetch PriceCharting HTML and scrape OG image + title.
  const res = await fetch(pricechartingUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });

  if (!res.ok) {
    throw new Error(`PriceCharting fetch failed: ${res.status} ${res.statusText}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  const ogImage =
    $('meta[property="og:image"]').attr("content") ||
    $('meta[name="twitter:image"]').attr("content") ||
    $('meta[itemprop="image"]').attr("content") ||
    $('link[rel="image_src"]').attr("href") ||
    "";
  const ogTitle = $('meta[property="og:title"]').attr("content") || $("title").text() || "";

  // Normalize relative URLs
  let imageUrl = String(ogImage).trim();
  try {
    if (imageUrl && imageUrl.startsWith("/")) {
      const base = new URL(pricechartingUrl);
      imageUrl = new URL(imageUrl, base.origin).toString();
    }
  } catch {
    // ignore
  }
  const title = String(ogTitle).trim();

  const meta = { imageUrl, title, fetchedAt: now };
  metaCache.set(pricechartingUrl, meta);
  return meta;
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

function slugFromPricechartingUrl(u) {
  try {
    const url = new URL(u);
    const last = url.pathname.split("/").filter(Boolean).at(-1) || "card";
    return last.replace(/[^a-zA-Z0-9_-]/g, "");
  } catch {
    return "card";
  }
}

function findLocalImagePath(card) {
  const baseName = card?.imageFile ? card.imageFile : slugFromPricechartingUrl(card?.url || "");
  if (!baseName) return null;

  // If user provided an extension already, try that first.
  const candidates = [];
  if (baseName.includes(".")) {
    candidates.push(baseName);
  } else {
    candidates.push(`${baseName}.jpg`, `${baseName}.jpeg`, `${baseName}.png`, `${baseName}.webp`);
  }

  for (const f of candidates) {
    const p = path.join(PUBLIC_DIR, "images", f);
    if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
  }
  return null;
}

async function cardForClient(card) {
  const meta = await fetchCardMeta(card.url).catch(() => ({ imageUrl: "", title: "" }));
  const title = meta.title || safeSlugTitleFromUrl(card.url);
  return {
    id: card.id,
    url: card.url, // safe to show (doesn't reveal price)
    setName: card.setName,
    title,
    imageSrc: `/api/image?id=${encodeURIComponent(card.id)}`,
  };
}

// ================== API ==================

app.get("/api/info", (req, res) => {
  res.json({
    cards: cards.length,
    currency: "CAD",
    timerSeconds: 8,
    startThresholdCad: 40,
    rounding: "1 decimal",
    hostEnabled: true,
  });
});

app.post("/api/reload", (req, res) => {
  // Optional endpoint for you to reload the CSV without restarting.
  if (!isHost(req)) return res.status(403).json({ error: "Forbidden" });
  try {
    loadCards();
    res.json({ ok: true, cards: cards.length });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

app.post("/api/start", async (req, res) => {
  // New session
  const deck = shuffle(cards.map((c) => c.id));
  const current = pickCardFromDeck({ deck });

  if (!current) return res.status(500).json({ error: "No cards available." });

  const sessionId = crypto.randomUUID();
  const session = {
    id: sessionId,
    createdAt: Date.now(),
    streak: 0,
    phase: "first", // "first" or "predict"
    deck,
    currentCardId: current.id,
    nextCardId: null, // set after first win and between rounds
  };

  sessions.set(sessionId, session);

  const currentClient = await cardForClient(current);

  const payload = {
    sessionId,
    streak: session.streak,
    phase: session.phase,
    prompt: "Is this card more or less than $40 (CAD)?",
    currentCard: currentClient,
    // Next card is hidden in client view
  };

  if (isHost(req)) {
    const currentPrice = current.priceCad;
    payload.host = {
      currentPriceCad: currentPrice,
      startThresholdCad: 40,
      correctAnswer: currentPrice > 40 ? "more" : currentPrice < 40 ? "less" : "tie (loss)",
      setName: current.setName,
    };
  }

  res.json(payload);
});

app.post("/api/guess", async (req, res) => {
  const { sessionId, guess } = req.body || {};
  const session = sessions.get(sessionId);

  if (!session) return res.status(404).json({ error: "Session not found." });

  const normalizedGuess = String(guess || "").toLowerCase();
  if (!["more", "less"].includes(normalizedGuess)) {
    return res.status(400).json({ error: "Guess must be 'more' or 'less'." });
  }

  const current = cards[session.currentCardId];
  if (!current) return res.status(500).json({ error: "Current card missing." });

  // Helper to finalize loss and cleanup
  const finalizeLoss = async (extra = {}) => {
    sessions.delete(sessionId);
    res.json({
      result: "lose",
      streak: session.streak,
      phase: session.phase,
      ...extra,
    });
  };

  // FIRST ROUND: current card vs fixed $40
  if (session.phase === "first") {
    const price = current.priceCad;
    const correct = price > 40 ? "more" : price < 40 ? "less" : "tie"; // tie = loss
    const win = correct !== "tie" && normalizedGuess === correct;

    if (!win) {
      const currentClient = await cardForClient(current);
      const extra = {
        revealedCard: currentClient,
        message: correct === "tie" ? "It was exactly $40.0 — ties are a loss." : "Wrong guess.",
        correctDirection: correct === "tie" ? "tie" : correct,
      };
      if (isHost(req)) {
        extra.host = {
          currentPriceCad: price,
          startThresholdCad: 40,
          correctAnswer: correct === "tie" ? "tie (loss)" : correct,
        };
      }
      return finalizeLoss(extra);
    }

    // Win: move to predict mode. Preselect the next hidden card.
    session.streak += 1;
    session.phase = "predict";
    const next = pickCardFromDeck(session);
    if (!next) {
      // If you somehow run out, treat as win and end.
      sessions.delete(sessionId);
      return res.json({
        result: "win",
        streak: session.streak,
        phase: "complete",
        message: "You cleared the whole deck!",
        currentCard: await cardForClient(current),
      });
    }
    session.nextCardId = next.id;

    const payload = {
      result: "win",
      streak: session.streak,
      phase: session.phase,
      message: "Correct!",
      prompt: "Will the NEXT card be more or less expensive than this card?",
      currentCard: await cardForClient(current),
      // next card remains hidden
    };

    if (isHost(req)) {
      const correctNext =
        next.priceCad > current.priceCad ? "more" : next.priceCad < current.priceCad ? "less" : "tie (loss)";
      payload.host = {
        currentPriceCad: current.priceCad,
        nextPriceCad: next.priceCad,
        correctNext,
      };
      // Optional: include next card title for host (still hidden in main UI)
      const nextClient = await cardForClient(next);
      payload.host.nextTitle = nextClient.title;
    }

    return res.json(payload);
  }

  // PREDICT MODE: guess direction for the hidden next card vs current card
  if (session.phase === "predict") {
    const next = cards[session.nextCardId];
    if (!next) return res.status(500).json({ error: "Next card missing." });

    const correct = next.priceCad > current.priceCad ? "more" : next.priceCad < current.priceCad ? "less" : "tie";
    const win = correct !== "tie" && normalizedGuess === correct;

    const revealedNextClient = await cardForClient(next);

    if (!win) {
      const extra = {
        revealedCard: revealedNextClient,
        message: correct === "tie" ? "Tie — ties are a loss." : "Wrong guess.",
        correctDirection: correct === "tie" ? "tie" : correct,
      };
      if (isHost(req)) {
        extra.host = {
          currentPriceCad: current.priceCad,
          nextPriceCad: next.priceCad,
          correctAnswer: correct === "tie" ? "tie (loss)" : correct,
        };
      }
      return finalizeLoss(extra);
    }

    // Win: promote next to current, pick new hidden next
    session.streak += 1;
    session.currentCardId = next.id;

    const newNext = pickCardFromDeck(session);
    if (!newNext) {
      sessions.delete(sessionId);
      const payload = {
        result: "win",
        streak: session.streak,
        phase: "complete",
        message: "You cleared the whole deck!",
        currentCard: revealedNextClient,
      };
      if (isHost(req)) {
        payload.host = { currentPriceCad: next.priceCad };
      }
      return res.json(payload);
    }

    session.nextCardId = newNext.id;

    const payload = {
      result: "win",
      streak: session.streak,
      phase: session.phase,
      message: "Correct!",
      prompt: "Will the NEXT card be more or less expensive than this card?",
      currentCard: revealedNextClient,
    };

    if (isHost(req)) {
      const correctNext =
        newNext.priceCad > next.priceCad ? "more" : newNext.priceCad < next.priceCad ? "less" : "tie (loss)";
      payload.host = {
        currentPriceCad: next.priceCad,
        nextPriceCad: newNext.priceCad,
        correctNext,
      };
      const newNextClient = await cardForClient(newNext);
      payload.host.nextTitle = newNextClient.title;
    }

    return res.json(payload);
  }

  return res.status(400).json({ error: "Unknown phase." });
});

app.post("/api/timeout", async (req, res) => {
  const { sessionId } = req.body || {};
  const session = sessions.get(sessionId);
  if (!session) return res.status(404).json({ error: "Session not found." });

  const current = cards[session.currentCardId];
  const payload = {
    result: "lose",
    reason: "timeout",
    message: "Time's up!",
    streak: session.streak,
    phase: session.phase,
  };

  if (session.phase === "predict" && session.nextCardId != null) {
    const revealed = cards[session.nextCardId];
    if (revealed) {
      payload.revealedCard = await cardForClient(revealed);
    }
  } else {
    payload.revealedCard = await cardForClient(current);
  }

  if (isHost(req)) {
    payload.host = {
      currentPriceCad: current?.priceCad,
      nextPriceCad: session.nextCardId != null ? cards[session.nextCardId]?.priceCad : null,
    };
  }

  sessions.delete(sessionId);
  res.json(payload);
});

app.get("/api/image", async (req, res) => {
  // Preferred: serve a local image from public/images (most reliable)
  // Fallback: fetch from PriceCharting and proxy bytes
  const idStr = String(req.query.id || "").trim();
  const u = String(req.query.u || "").trim(); // backward compatible

  let card = null;
  let pricechartingUrl = u;

  if (idStr) {
    const id = Number(idStr);
    if (Number.isFinite(id)) {
      card = cards[id];
      if (card) pricechartingUrl = card.url;
    }
  }

  if (!pricechartingUrl && !card) return res.status(400).send("Missing id (or u)");
  if (!card && pricechartingUrl) {
    // Create a pseudo card object for slugging
    card = { url: pricechartingUrl, imageFile: "" };
  }

  // 1) Try local first
  const localPath = findLocalImagePath(card);
  if (localPath) {
    res.setHeader("Cache-Control", "public, max-age=86400");
    return res.sendFile(localPath);
  }

  // 2) Fallback to PriceCharting
  try {
    const meta = await fetchCardMeta(pricechartingUrl);
    if (!meta.imageUrl) {
      return res
        .status(404)
        .send(
          "No image found. If PriceCharting blocks scraping, add a local image under public/images named after the URL slug (e.g. serperior-ex-164.jpg)."
        );
    }

    const imgRes = await fetch(meta.imageUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36",
        "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        // Some CDNs require a referer to allow image loads.
        "Referer": pricechartingUrl,
      },
    });

    if (!imgRes.ok) return res.status(502).send(`Image fetch failed (${imgRes.status})`);
    const ct = imgRes.headers.get("content-type") || "image/jpeg";
    res.setHeader("Content-Type", ct);
    res.setHeader("Cache-Control", "public, max-age=86400"); // 1 day cache

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
  console.log(`Host panel key is set: ${HOST_KEY === "change-me" ? "NO (set HOST_KEY!)" : "YES"}`);
});
