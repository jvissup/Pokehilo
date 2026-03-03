# Pokémon Hi‑Lo (CAD-only) — with Host Prices

## What this does
- Reads `data/cards.csv` (PriceCharting URL + CAD price).
- Shows players the card image but **never shows prices**.
- Image loading prefers **local files** (most reliable) and falls back to PriceCharting scraping.
- Starts with: **“Is this card more or less than $40 (CAD)?”**
- Then: **“Will the NEXT card be more or less expensive than this card?”**
- 8-second timer each guess (timeouts = loss).
- Host can toggle a panel to see **CAD prices** and the correct direction.

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
- Host view: click **Host** button and enter the host key (only that browser will show prices)

## CSV format
Expected headers (case-sensitive based on your provided file):
- `Name` = PriceCharting URL (product page)
- `NAME` = set name (optional display)
- `CAD`  = CAD price like `$48.3`

Optional:
- `ImageFile` = a local image filename (relative to `public/images/`). Example: `serperior-ex-164.jpg`

USD is ignored completely.

## Notes
- Sessions are in-memory. If you restart the server, current games reset.
- **Recommended:** put images in `public/images/`.
  - If you *don’t* provide `ImageFile`, the app uses the last part of the PriceCharting URL as the filename slug.
  - Example URL: `.../serperior-ex-164` → `public/images/serperior-ex-164.jpg` (or .png/.webp)
- If a local image is missing, the server will attempt to fetch from PriceCharting and proxy it.
- To print the list of expected local image filenames from your CSV:
  ```bash
  npm run expected-images
  ```
- The browser caches images for 1 day.
