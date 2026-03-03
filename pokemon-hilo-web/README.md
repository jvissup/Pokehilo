# Pokémon Hi‑Lo (CAD-only) — Player + Master Host Pages

## What this does
- Reads `data/cards.csv` (PriceCharting URL + CAD price).
- Shows players the card image but **never shows prices**.
- Starts with: **“Is this card more or less than $40 (CAD)?”**
- Then: **“Will the NEXT card be more or less expensive than this card?”**
- 8-second timer each guess (timeouts = loss).
- Separate **Host page** that can start/announce a new game to the Player page (two tabs).
- Host sees **CAD prices** and the correct direction.
- Server logs every game to `data/game_logs.jsonl` (host-only access).
- Host page includes an **EV & margin simulator** (host-only).

## Setup
1) Install Node.js 18+
2) In this folder:
```bash
npm install
```

3) Set a host key (required if you want host prices)
```bash
# mac/linux
export HOST_KEY="your-secret-key"
npm start

# windows powershell
setx HOST_KEY "your-secret-key"
npm start
```

4) Open:
- Player view: http://localhost:3000
- Host view: http://localhost:3000/host.html

To run in two tabs:
1) Open the Player page (leave it waiting)
2) Open the Host page, enter the host key, click **Start & announce**

## CSV format
Expected headers (case-sensitive based on your provided file):
- `Name` = PriceCharting URL (product page)
- `NAME` = set name (optional display)
- `CAD`  = CAD price like `$48.3`

Optional:
- `ImageFile` = filename inside `public/images/` (example: `serperior-ex-164.jpg`)

USD is ignored completely.

## Notes
- Sessions are in-memory. If you restart the server, current games reset.
- Image loading priority:
  1) `public/images/<ImageFile>` (if provided) or `public/images/<slug>.(jpg|png|webp)`
  2) PriceCharting OG-image scrape + server-side proxy
- Logs are host-only and downloadable from the Host page.
