import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";

const DATA_PATH = process.env.CARDS_CSV_PATH || path.join(process.cwd(), "data", "cards.csv");

function slugFromPricechartingUrl(u) {
  try {
    const url = new URL(u);
    const last = url.pathname.split("/").filter(Boolean).at(-1) || "card";
    return last.replace(/[^a-zA-Z0-9_-]/g, "");
  } catch {
    return "card";
  }
}

const csvRaw = fs.readFileSync(DATA_PATH, "utf8");
const records = parse(csvRaw, { columns: true, skip_empty_lines: true });

const files = [];
for (const r of records) {
  const url = String(r.Name || r.URL || r.Url || "").trim();
  if (!url) continue;
  const imageFile = String(r.ImageFile || r.imageFile || "").trim();
  const base = imageFile || slugFromPricechartingUrl(url);
  files.push(base);
}

const unique = new Set(files);
console.log(`Cards in CSV: ${files.length}`);
console.log(`Unique image bases: ${unique.size}`);
console.log("\nSuggested local image paths (put these under public/images/):");
for (const f of unique) {
  if (f.includes('.')) {
    console.log(`  public/images/${f}`);
  } else {
    console.log(`  public/images/${f}.jpg  (or .png/.webp)`);
  }
}
