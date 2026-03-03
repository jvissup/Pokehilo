import express from "express";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const app = express();
const PORT = process.env.PORT || 3000;

const PUBLIC_DIR = path.join(process.cwd(), "public");
const IMAGES_DIR = path.join(PUBLIC_DIR, "images");

const TIMER_SECONDS = 8;
const START_THRESHOLD_CAD = 40;

app.use(express.json({ limit: "200kb" }));
app.use(express.static(PUBLIC_DIR));

// ================== Card Data ==================
// Each entry: { url (PriceCharting link), setName, priceCad (1 decimal), imageFile (filename in public/images/) }

const CARDS = [
  { url: "https://www.pricecharting.com/game/pokemon-black-bolt/serperior-ex-164", setName: "Black Bolt", priceCad: 48.3, imageFile: "serperior-ex-164.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-black-bolt/meloetta-ex-167", setName: "Black Bolt", priceCad: 44.7, imageFile: "meloetta-ex-167.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-black-bolt/krookodile-137", setName: "Black Bolt", priceCad: 41.4, imageFile: "krookodile-137.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-black-bolt/volcarona-100", setName: "Black Bolt", priceCad: 39.2, imageFile: "volcarona-100.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-black-bolt/solosis-118", setName: "Black Bolt", priceCad: 39.1, imageFile: "solosis-118.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-black-bolt/amoonguss-96", setName: "Black Bolt", priceCad: 33.2, imageFile: "amoonguss-96.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-black-bolt/lilligant-92", setName: "Black Bolt", priceCad: 31.5, imageFile: "lilligant-92.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-black-bolt/dwebble-129", setName: "Black Bolt", priceCad: 31.1, imageFile: "dwebble-129.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-black-bolt/genesect-ex-169", setName: "Black Bolt", priceCad: 55, imageFile: "genesect-ex-169.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-black-bolt/haxorus-147", setName: "Black Bolt", priceCad: 55.4, imageFile: "haxorus-147.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-black-bolt/air-balloon-great-ball-league-79", setName: "Black Bolt", priceCad: 64.2, imageFile: "air-balloon-great-ball-league-79.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-black-bolt/conkeldurr-127", setName: "Black Bolt", priceCad: 27.3, imageFile: "conkeldurr-127.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-black-bolt/excadrill-ex-168", setName: "Black Bolt", priceCad: 26.3, imageFile: "excadrill-ex-168.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-black-bolt/victini-master-ball-12", setName: "Black Bolt", priceCad: 26, imageFile: "victini-master-ball-12.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-black-bolt/cobalion-144", setName: "Black Bolt", priceCad: 26, imageFile: "cobalion-144.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-black-bolt/landorus-131", setName: "Black Bolt", priceCad: 25.1, imageFile: "landorus-131.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-black-bolt/fraxure-146", setName: "Black Bolt", priceCad: 25, imageFile: "fraxure-146.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-black-bolt/scolipede-134", setName: "Black Bolt", priceCad: 24.1, imageFile: "scolipede-134.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-black-bolt/eelektrik-114", setName: "Black Bolt", priceCad: 23, imageFile: "eelektrik-114.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-black-bolt/snivy-87", setName: "Black Bolt", priceCad: 22.6, imageFile: "snivy-87.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-black-bolt/audino-151", setName: "Black Bolt", priceCad: 22.4, imageFile: "audino-151.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-black-bolt/pidove-148", setName: "Black Bolt", priceCad: 21.1, imageFile: "pidove-148.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-black-bolt/eelektross-115", setName: "Black Bolt", priceCad: 21, imageFile: "eelektross-115.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-black-bolt/klinklang-141", setName: "Black Bolt", priceCad: 21.1, imageFile: "klinklang-141.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-black-bolt/tirtouga-106", setName: "Black Bolt", priceCad: 19.8, imageFile: "tirtouga-106.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-black-bolt/unfezant-150", setName: "Black Bolt", priceCad: 20.1, imageFile: "unfezant-150.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-black-bolt/tynamo-113", setName: "Black Bolt", priceCad: 18.9, imageFile: "tynamo-113.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-black-bolt/axew-145", setName: "Black Bolt", priceCad: 17.3, imageFile: "axew-145.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-black-bolt/foongus-95", setName: "Black Bolt", priceCad: 15.7, imageFile: "foongus-95.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-black-bolt/cubchoo-109", setName: "Black Bolt", priceCad: 15.5, imageFile: "cubchoo-109.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-crown-zenith/pikachu-gg30", setName: "Crown Zenith", priceCad: 31.7, imageFile: "pikachu-gg30.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-destined-rivals/team-rocket%27s-tyranitar-pokemon-center-96", setName: "Destined Rivals", priceCad: 49.1, imageFile: "team-rocket%27s-tyranitar-pokemon-center-96.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-destined-rivals/ethan%27s-adventure-236", setName: "Destined Rivals", priceCad: 47.9, imageFile: "ethan%27s-adventure-236.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-destined-rivals/team-rocket%27s-giovanni-238", setName: "Destined Rivals", priceCad: 43.6, imageFile: "team-rocket%27s-giovanni-238.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-destined-rivals/cynthia%27s-garchomp-ex-241", setName: "Destined Rivals", priceCad: 39, imageFile: "cynthia%27s-garchomp-ex-241.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-destined-rivals/arven%27s-mabosstiff-ex-235", setName: "Destined Rivals", priceCad: 35.5, imageFile: "arven%27s-mabosstiff-ex-235.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-destined-rivals/ethan%27s-ho-oh-ex-239", setName: "Destined Rivals", priceCad: 34.6, imageFile: "ethan%27s-ho-oh-ex-239.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-destined-rivals/team-rocket%27s-ariana-237", setName: "Destined Rivals", priceCad: 31.9, imageFile: "team-rocket%27s-ariana-237.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-destined-rivals/misty%27s-lapras-194", setName: "Destined Rivals", priceCad: 31.8, imageFile: "misty%27s-lapras-194.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-destined-rivals/yanmega-ex-228", setName: "Destined Rivals", priceCad: 27.3, imageFile: "yanmega-ex-228.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-destined-rivals/ethan%27s-typhlosion-190", setName: "Destined Rivals", priceCad: 28.7, imageFile: "ethan%27s-typhlosion-190.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-lost-origin/pikachu-tg05", setName: "Lost Origin", priceCad: 41.4, imageFile: "pikachu-tg05.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-mega-evolution/acerola%27s-mischief-183", setName: "Mega Evolution", priceCad: 41.7, imageFile: "acerola%27s-mischief-183.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-mega-evolution/yveltal-eb-games-88", setName: "Mega Evolution", priceCad: 28.1, imageFile: "yveltal-eb-games-88.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-mega-evolution/wally%27s-compassion-186", setName: "Mega Evolution", priceCad: 27.5, imageFile: "wally%27s-compassion-186.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-mega-evolution/lillie%27s-determination-169", setName: "Mega Evolution", priceCad: 25.9, imageFile: "lillie%27s-determination-169.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-mega-evolution/lt-surge%27s-bargain-185", setName: "Mega Evolution", priceCad: 26.2, imageFile: "lt-surge%27s-bargain-185.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-mega-evolution/bulbasaur-133", setName: "Mega Evolution", priceCad: 23.2, imageFile: "bulbasaur-133.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-phantasmal-flames/mega-charizard-x-ex-109", setName: "Phantasmal Flames", priceCad: 45.3, imageFile: "mega-charizard-x-ex-109.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-phantasmal-flames/dawn-129", setName: "Phantasmal Flames", priceCad: 50.4, imageFile: "dawn-129.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-phantasmal-flames/mega-sharpedo-ex-127", setName: "Phantasmal Flames", priceCad: 39.1, imageFile: "mega-sharpedo-ex-127.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-phantasmal-flames/suicune-gamestop-26", setName: "Phantasmal Flames", priceCad: 34.2, imageFile: "suicune-gamestop-26.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-phantasmal-flames/rotom-ex-126", setName: "Phantasmal Flames", priceCad: 29.4, imageFile: "rotom-ex-126.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-phantasmal-flames/mega-lopunny-ex-128", setName: "Phantasmal Flames", priceCad: 29.4, imageFile: "mega-lopunny-ex-128.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-phantasmal-flames/suicune-eb-games-26", setName: "Phantasmal Flames", priceCad: 50.3, imageFile: "suicune-eb-games-26.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-phantasmal-flames/reshiram-stamped-17", setName: "Phantasmal Flames", priceCad: 23.1, imageFile: "reshiram-stamped-17.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-phantasmal-flames/meowth-106", setName: "Phantasmal Flames", priceCad: 22.4, imageFile: "meowth-106.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-phantasmal-flames/piplup-98", setName: "Phantasmal Flames", priceCad: 15.6, imageFile: "piplup-98.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-stellar-crown/terapagos-ex-170", setName: "Stellar Crown", priceCad: 42.5, imageFile: "terapagos-ex-170.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-stellar-crown/dachsbun-ex-169", setName: "Stellar Crown", priceCad: 40.1, imageFile: "dachsbun-ex-169.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-stellar-crown/lapras-7-11-31", setName: "Stellar Crown", priceCad: 34.1, imageFile: "lapras-7-11-31.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-stellar-crown/hydrapple-ex-167", setName: "Stellar Crown", priceCad: 28.2, imageFile: "hydrapple-ex-167.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-stellar-crown/lacey-172", setName: "Stellar Crown", priceCad: 25.1, imageFile: "lacey-172.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-promo/pikachu-&-zekrom-gx-sm248", setName: "Sun & Moon", priceCad: 39.6, imageFile: "pikachu-&-zekrom-gx-sm248.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-surging-sparks/lisia%27s-appeal-246", setName: "Surging Sparks", priceCad: 37.9, imageFile: "lisia%27s-appeal-246.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-surging-sparks/alolan-exeggutor-ex-242", setName: "Surging Sparks", priceCad: 37.2, imageFile: "alolan-exeggutor-ex-242.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-surging-sparks/pikachu-ex-219", setName: "Surging Sparks", priceCad: 28.7, imageFile: "pikachu-ex-219.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-surging-sparks/latios-203", setName: "Surging Sparks", priceCad: 32.5, imageFile: "latios-203.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-surging-sparks/pikachu-ex-prize-pack-57", setName: "Surging Sparks", priceCad: 33.1, imageFile: "pikachu-ex-prize-pack-57.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-surging-sparks/durant-ex-236", setName: "Surging Sparks", priceCad: 27.6, imageFile: "durant-ex-236.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-scarlet-&-violet-151/charizard-ex-183?q=charizard+ex+183", setName: "SV: 151", priceCad: 47.9, imageFile: "charizard-ex-183.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-scarlet-&-violet-151/mew-ex-193", setName: "SV: 151", priceCad: 31.3, imageFile: "mew-ex-193.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-scarlet-&-violet-151/poliwhirl-176", setName: "SV: 151", priceCad: 32.4, imageFile: "poliwhirl-176.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-scarlet-&-violet-151/dragonair-181", setName: "SV: 151", priceCad: 38.3, imageFile: "dragonair-181.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-scarlet-&-violet-151/ivysaur-167", setName: "SV: 151", priceCad: 46.5, imageFile: "ivysaur-167.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-team-up/pikachu-&-zekrom-gx-33", setName: "Team Up", priceCad: 39, imageFile: "pikachu-&-zekrom-gx-33.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-team-up/latias-&-latios-gx-113", setName: "Team Up", priceCad: 68, imageFile: "latias-&-latios-gx-113.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-team-up/celebi-&-venusaur-gx-159", setName: "Team Up", priceCad: 62.9, imageFile: "celebi-&-venusaur-gx-159.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-team-up/dana-173", setName: "Team Up", priceCad: 61.3, imageFile: "dana-173.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-team-up/morgan-178", setName: "Team Up", priceCad: 54.7, imageFile: "morgan-178.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-team-up/brock%27s-grit-172", setName: "Team Up", priceCad: 54.7, imageFile: "brock%27s-grit-172.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-team-up/nita-180", setName: "Team Up", priceCad: 52.7, imageFile: "nita-180.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-team-up/ingo-&-emmet-176", setName: "Team Up", priceCad: 51.4, imageFile: "ingo-&-emmet-176.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-team-up/celebi-&-venusaur-gx-1", setName: "Team Up", priceCad: 47.9, imageFile: "celebi-&-venusaur-gx-1.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-team-up/ampharos-gx-185", setName: "Team Up", priceCad: 42.6, imageFile: "ampharos-gx-185.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-team-up/charizard-cracked-ice-14", setName: "Team Up", priceCad: 39.9, imageFile: "charizard-cracked-ice-14.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-team-up/hoopa-gx-187", setName: "Team Up", priceCad: 32.9, imageFile: "hoopa-gx-187.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-team-up/charizard-cosmos-holo-14", setName: "Team Up", priceCad: 29.9, imageFile: "charizard-cosmos-holo-14.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-team-up/moltres-stamped-19", setName: "Team Up", priceCad: 28.7, imageFile: "moltres-stamped-19.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-team-up/incineroar-gx-188", setName: "Team Up", priceCad: 29.1, imageFile: "incineroar-gx-188.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-team-up/electrode-reverse-holo-39", setName: "Team Up", priceCad: 27.3, imageFile: "electrode-reverse-holo-39.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-team-up/ampharos-gx-163", setName: "Team Up", priceCad: 28.2, imageFile: "ampharos-gx-163.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-team-up/blastoise-cracked-ice-25", setName: "Team Up", priceCad: 26.2, imageFile: "blastoise-cracked-ice-25.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-team-up/electrode-39", setName: "Team Up", priceCad: 22.6, imageFile: "electrode-39.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-team-up/charizard-reverse-holo-14", setName: "Team Up", priceCad: 24.3, imageFile: "charizard-reverse-holo-14.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-team-up/lugia-reverse-holo-131", setName: "Team Up", priceCad: 17.8, imageFile: "lugia-reverse-holo-131.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-team-up/nanu-179", setName: "Team Up", priceCad: 17.4, imageFile: "nanu-179.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-team-up/cobalion-gx-189", setName: "Team Up", priceCad: 17.1, imageFile: "cobalion-gx-189.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-team-up/blastoise-reverse-holo-25", setName: "Team Up", priceCad: 16.4, imageFile: "blastoise-reverse-holo-25.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-team-up/lugia-131", setName: "Team Up", priceCad: 15.4, imageFile: "lugia-131.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-team-up/charizard-14", setName: "Team Up", priceCad: 15.4, imageFile: "charizard-14.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-unbroken-bonds/marshadow-&-machamp-gx-221", setName: "Unbroken Bonds", priceCad: 70.3, imageFile: "marshadow-&-machamp-gx-221.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-unbroken-bonds/greninja-&-zoroark-gx-200", setName: "Unbroken Bonds", priceCad: 69.4, imageFile: "greninja-&-zoroark-gx-200.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-unbroken-bonds/pokegear-30-233", setName: "Unbroken Bonds", priceCad: 65.6, imageFile: "pokegear-30-233.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-unbroken-bonds/snorlax-158", setName: "Unbroken Bonds", priceCad: 54.7, imageFile: "snorlax-158.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-unbroken-bonds/welder-214", setName: "Unbroken Bonds", priceCad: 57.8, imageFile: "welder-214.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-unbroken-bonds/reshiram-&-charizard-gx-20", setName: "Unbroken Bonds", priceCad: 52.4, imageFile: "reshiram-&-charizard-gx-20.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-unbroken-bonds/snorlax-reverse-holo-158", setName: "Unbroken Bonds", priceCad: 51.9, imageFile: "snorlax-reverse-holo-158.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-unbroken-bonds/dedenne-gx-219", setName: "Unbroken Bonds", priceCad: 50.6, imageFile: "dedenne-gx-219.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-unbroken-bonds/lucario-&-melmetal-gx-203", setName: "Unbroken Bonds", priceCad: 49.2, imageFile: "lucario-&-melmetal-gx-203.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-unbroken-bonds/pheromosa-&-buzzwole-gx-215", setName: "Unbroken Bonds", priceCad: 43.6, imageFile: "pheromosa-&-buzzwole-gx-215.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-unbroken-bonds/gengar-reverse-holo-70", setName: "Unbroken Bonds", priceCad: 43, imageFile: "gengar-reverse-holo-70.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-unbroken-bonds/greninja-&-zoroark-gx-107", setName: "Unbroken Bonds", priceCad: 45.4, imageFile: "greninja-&-zoroark-gx-107.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-unbroken-bonds/cleffa-reverse-holo-131", setName: "Unbroken Bonds", priceCad: 37.2, imageFile: "cleffa-reverse-holo-131.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-unbroken-bonds/lucario-&-melmetal-gx-120", setName: "Unbroken Bonds", priceCad: 35.4, imageFile: "lucario-&-melmetal-gx-120.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-unbroken-bonds/marshadow-&-machamp-gx-198", setName: "Unbroken Bonds", priceCad: 34.2, imageFile: "marshadow-&-machamp-gx-198.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-unbroken-bonds/koga%27s-trap-211", setName: "Unbroken Bonds", priceCad: 33.6, imageFile: "koga%27s-trap-211.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-unbroken-bonds/muk-&-alolan-muk-gx-220", setName: "Unbroken Bonds", priceCad: 31.3, imageFile: "muk-&-alolan-muk-gx-220.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-unbroken-bonds/muk-&-alolan-muk-gx-196", setName: "Unbroken Bonds", priceCad: 32.7, imageFile: "muk-&-alolan-muk-gx-196.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-unbroken-bonds/marshadow-&-machamp-gx-82", setName: "Unbroken Bonds", priceCad: 30.9, imageFile: "marshadow-&-machamp-gx-82.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-unbroken-bonds/dedenne-gx-195a", setName: "Unbroken Bonds", priceCad: 28.2, imageFile: "dedenne-gx-195a.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-unbroken-bonds/greninja-117", setName: "Unbroken Bonds", priceCad: 26, imageFile: "greninja-117.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-unbroken-bonds/pheromosa-&-buzzwole-gx-191", setName: "Unbroken Bonds", priceCad: 25.8, imageFile: "pheromosa-&-buzzwole-gx-191.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-unbroken-bonds/greninja-reverse-holo-117", setName: "Unbroken Bonds", priceCad: 27.4, imageFile: "greninja-reverse-holo-117.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-unbroken-bonds/persian-gx-227", setName: "Unbroken Bonds", priceCad: 24.6, imageFile: "persian-gx-227.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-unbroken-bonds/janine-210", setName: "Unbroken Bonds", priceCad: 24.6, imageFile: "janine-210.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-unbroken-bonds/dedenne-gx-195", setName: "Unbroken Bonds", priceCad: 24.6, imageFile: "dedenne-gx-195.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-unbroken-bonds/muk-&-alolan-muk-gx-61", setName: "Unbroken Bonds", priceCad: 20.5, imageFile: "muk-&-alolan-muk-gx-61.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-unbroken-bonds/venomoth-gx-216", setName: "Unbroken Bonds", priceCad: 19.8, imageFile: "venomoth-gx-216.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-unbroken-bonds/whimsicott-gx-226", setName: "Unbroken Bonds", priceCad: 19.3, imageFile: "whimsicott-gx-226.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-unbroken-bonds/gengar-70", setName: "Unbroken Bonds", priceCad: 17.4, imageFile: "gengar-70.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-unbroken-bonds/honchkrow-gx-223", setName: "Unbroken Bonds", priceCad: 15.5, imageFile: "honchkrow-gx-223.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-unbroken-bonds/blastoise-gx-35", setName: "Unbroken Bonds", priceCad: 15, imageFile: "blastoise-gx-35.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-vivid-voltage/pikachu-v-170", setName: "Vivid Voltage", priceCad: 36.5, imageFile: "pikachu-v-170.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-white-flare/hilda-171", setName: "White Flare", priceCad: 68.4, imageFile: "hilda-171.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-white-flare/keldeo-ex-167", setName: "White Flare", priceCad: 68.1, imageFile: "keldeo-ex-167.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-white-flare/oshawott-105", setName: "White Flare", priceCad: 60.2, imageFile: "oshawott-105.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-white-flare/zoroark-143", setName: "White Flare", priceCad: 58.8, imageFile: "zoroark-143.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-white-flare/chandelure-103", setName: "White Flare", priceCad: 53.8, imageFile: "chandelure-103.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-white-flare/samurott-107", setName: "White Flare", priceCad: 47.4, imageFile: "samurott-107.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-white-flare/vanilluxe-113", setName: "White Flare", priceCad: 35.5, imageFile: "vanilluxe-113.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-white-flare/emboar-98", setName: "White Flare", priceCad: 34.2, imageFile: "emboar-98.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-white-flare/liepard-137", setName: "White Flare", priceCad: 31.2, imageFile: "liepard-137.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-white-flare/jellicent-ex-168", setName: "White Flare", priceCad: 30.8, imageFile: "jellicent-ex-168.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-white-flare/whimsicott-ex-165", setName: "White Flare", priceCad: 29.5, imageFile: "whimsicott-ex-165.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-white-flare/virizion-95", setName: "White Flare", priceCad: 27.3, imageFile: "virizion-95.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-white-flare/zorua-142", setName: "White Flare", priceCad: 26.5, imageFile: "zorua-142.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-white-flare/sawsbuck-92", setName: "White Flare", priceCad: 26.4, imageFile: "sawsbuck-92.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-white-flare/lillipup-154", setName: "White Flare", priceCad: 25.2, imageFile: "lillipup-154.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-white-flare/joltik-116", setName: "White Flare", priceCad: 24.6, imageFile: "joltik-116.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-white-flare/leavanny-89", setName: "White Flare", priceCad: 24.3, imageFile: "leavanny-89.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-white-flare/tepig-96", setName: "White Flare", priceCad: 23.7, imageFile: "tepig-96.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-white-flare/cofagrigus-123", setName: "White Flare", priceCad: 22.2, imageFile: "cofagrigus-123.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-white-flare/stoutland-156", setName: "White Flare", priceCad: 22, imageFile: "stoutland-156.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-white-flare/terrakion-135", setName: "White Flare", priceCad: 21.8, imageFile: "terrakion-135.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-white-flare/bouffalant-ex-170", setName: "White Flare", priceCad: 20.5, imageFile: "bouffalant-ex-170.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-white-flare/scrafty-139", setName: "White Flare", priceCad: 20.5, imageFile: "scrafty-139.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-white-flare/zebstrika-115", setName: "White Flare", priceCad: 19.9, imageFile: "zebstrika-115.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-white-flare/galvantula-117", setName: "White Flare", priceCad: 19.8, imageFile: "galvantula-117.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-white-flare/scraggy-138", setName: "White Flare", priceCad: 19.2, imageFile: "scraggy-138.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-white-flare/ducklett-109", setName: "White Flare", priceCad: 19.1, imageFile: "ducklett-109.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-white-flare/gigalith-129", setName: "White Flare", priceCad: 17.8, imageFile: "gigalith-129.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-white-flare/deerling-91", setName: "White Flare", priceCad: 17.1, imageFile: "deerling-91.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-white-flare/litwick-101", setName: "White Flare", priceCad: 17.1, imageFile: "litwick-101.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-white-flare/gothita-124", setName: "White Flare", priceCad: 16.8, imageFile: "gothita-124.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-white-flare/garbodor-141", setName: "White Flare", priceCad: 16.7, imageFile: "garbodor-141.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-white-flare/dewott-106", setName: "White Flare", priceCad: 16.6, imageFile: "dewott-106.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-white-flare/lillipup-master-ball-74", setName: "White Flare", priceCad: 15.5, imageFile: "lillipup-master-ball-74.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-unified-minds/latios-gx-243", setName: "Unified Minds", priceCad: 73.2, imageFile: "latios-gx-243.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-unified-minds/raichu-&-alolan-raichu-gx-220", setName: "Unified Minds", priceCad: 57.7, imageFile: "raichu-&-alolan-raichu-gx-220.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-unified-minds/mega-sableye-&-tyranitar-gx-225", setName: "Unified Minds", priceCad: 57, imageFile: "mega-sableye-&-tyranitar-gx-225.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-unified-minds/rowlet-&-alolan-exeggutor-gx-237", setName: "Unified Minds", priceCad: 49.4, imageFile: "rowlet-&-alolan-exeggutor-gx-237.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-unified-minds/blue%27s-tactics-231", setName: "Unified Minds", priceCad: 55.4, imageFile: "blue%27s-tactics-231.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-unified-minds/garchomp-&-giratina-gx-146", setName: "Unified Minds", priceCad: 47.9, imageFile: "garchomp-&-giratina-gx-146.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-unified-minds/espeon-&-deoxys-gx-72", setName: "Unified Minds", priceCad: 44.7, imageFile: "espeon-&-deoxys-gx-72.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-unified-minds/viridian-forest-256", setName: "Unified Minds", priceCad: 43.7, imageFile: "viridian-forest-256.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-unified-minds/poke-maniac-236", setName: "Unified Minds", priceCad: 40.5, imageFile: "poke-maniac-236.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-unified-minds/raichu-&-alolan-raichu-gx-54", setName: "Unified Minds", priceCad: 35.5, imageFile: "raichu-&-alolan-raichu-gx-54.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-unified-minds/rowlet-&-alolan-exeggutor-gx-214", setName: "Unified Minds", priceCad: 31.7, imageFile: "rowlet-&-alolan-exeggutor-gx-214.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-unified-minds/latios-gx-223", setName: "Unified Minds", priceCad: 31.1, imageFile: "latios-gx-223.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-unified-minds/keldeo-gx-240", setName: "Unified Minds", priceCad: 29.4, imageFile: "keldeo-gx-240.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-unified-minds/mawile-gx-246", setName: "Unified Minds", priceCad: 26.1, imageFile: "mawile-gx-246.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-hidden-fates/darkrai-gx-sv70", setName: "Hidden Fates", priceCad: 75.4, imageFile: "darkrai-gx-sv70.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-hidden-fates/jessie-&-james-68", setName: "Hidden Fates", priceCad: 68.4, imageFile: "jessie-&-james-68.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-hidden-fates/scizor-gx-sv72", setName: "Hidden Fates", priceCad: 68.1, imageFile: "scizor-gx-sv72.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-hidden-fates/leafeon-gx-sv46", setName: "Hidden Fates", priceCad: 64.8, imageFile: "leafeon-gx-sv46.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-hidden-fates/reshiram-gx-sv51", setName: "Hidden Fates", priceCad: 55.7, imageFile: "reshiram-gx-sv51.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-hidden-fates/glaceon-gx-sv55", setName: "Hidden Fates", priceCad: 54.4, imageFile: "glaceon-gx-sv55.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-hidden-fates/gardevoir-gx-sv75", setName: "Hidden Fates", priceCad: 54.4, imageFile: "gardevoir-gx-sv75.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-hidden-fates/alolan-ninetales-gx-sv53", setName: "Hidden Fates", priceCad: 47.9, imageFile: "alolan-ninetales-gx-sv53.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-hidden-fates/moltres-&-zapdos-&-articuno-gx-66", setName: "Hidden Fates", priceCad: 42.6, imageFile: "moltres-&-zapdos-&-articuno-gx-66.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-hidden-fates/moltres-&-zapdos-&-articuno-gx-44", setName: "Hidden Fates", priceCad: 44.9, imageFile: "moltres-&-zapdos-&-articuno-gx-44.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-hidden-fates/moltres-&-zapdos-&-articuno-gx-69", setName: "Hidden Fates", priceCad: 42.7, imageFile: "moltres-&-zapdos-&-articuno-gx-69.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-hidden-fates/zygarde-gx-sv65", setName: "Hidden Fates", priceCad: 42.2, imageFile: "zygarde-gx-sv65.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-hidden-fates/articuno-gx-sv54", setName: "Hidden Fates", priceCad: 42.2, imageFile: "articuno-gx-sv54.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-hidden-fates/ho-oh-gx-sv50", setName: "Hidden Fates", priceCad: 39.1, imageFile: "ho-oh-gx-sv50.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-hidden-fates/eevee-sv41", setName: "Hidden Fates", priceCad: 38.9, imageFile: "eevee-sv41.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-hidden-fates/metagross-gx-157a", setName: "Hidden Fates", priceCad: 32.9, imageFile: "metagross-gx-157a.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-hidden-fates/altaria-gx-sv77", setName: "Hidden Fates", priceCad: 27.7, imageFile: "altaria-gx-sv77.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-hidden-fates/guzma-sv84", setName: "Hidden Fates", priceCad: 27.8, imageFile: "guzma-sv84.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-hidden-fates/tapu-fini-sv92", setName: "Hidden Fates", priceCad: 24.6, imageFile: "tapu-fini-sv92.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-hidden-fates/tapu-lele-sv94", setName: "Hidden Fates", priceCad: 23.9, imageFile: "tapu-lele-sv94.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-hidden-fates/tapu-koko-sv93", setName: "Hidden Fates", priceCad: 23.4, imageFile: "tapu-koko-sv93.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-hidden-fates/decidueye-gx-sv47", setName: "Hidden Fates", priceCad: 22.1, imageFile: "decidueye-gx-sv47.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-hidden-fates/lycanroc-gx-sv67", setName: "Hidden Fates", priceCad: 20.6, imageFile: "lycanroc-gx-sv67.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-hidden-fates/xurkitree-gx-sv58", setName: "Hidden Fates", priceCad: 20.5, imageFile: "xurkitree-gx-sv58.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-hidden-fates/tapu-bulu-sv91", setName: "Hidden Fates", priceCad: 20.2, imageFile: "tapu-bulu-sv91.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-hidden-fates/charmander-sv6", setName: "Hidden Fates", priceCad: 19.9, imageFile: "charmander-sv6.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-hidden-fates/brooklet-hill-sv88", setName: "Hidden Fates", priceCad: 19.8, imageFile: "brooklet-hill-sv88.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-hidden-fates/nihilego-gx-sv62", setName: "Hidden Fates", priceCad: 21, imageFile: "nihilego-gx-sv62.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-hidden-fates/lucario-sv22", setName: "Hidden Fates", priceCad: 18.7, imageFile: "lucario-sv22.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-hidden-fates/wooper-sv9", setName: "Hidden Fates", priceCad: 19.2, imageFile: "wooper-sv9.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-hidden-fates/electrode-gx-sv57", setName: "Hidden Fates", priceCad: 18.5, imageFile: "electrode-gx-sv57.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-hidden-fates/guzzlord-gx-sv71", setName: "Hidden Fates", priceCad: 17.6, imageFile: "guzzlord-gx-sv71.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-hidden-fates/noivern-gx-sv78", setName: "Hidden Fates", priceCad: 17.6, imageFile: "noivern-gx-sv78.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-hidden-fates/lady-sv86", setName: "Hidden Fates", priceCad: 17.2, imageFile: "lady-sv86.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-hidden-fates/lycanroc-gx-sv66", setName: "Hidden Fates", priceCad: 16.4, imageFile: "lycanroc-gx-sv66.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-hidden-fates/charmeleon-sv7", setName: "Hidden Fates", priceCad: 15.9, imageFile: "charmeleon-sv7.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-cosmic-eclipse/mega-lopunny-&-jigglypuff-gx-261", setName: "Cosmic Eclipse", priceCad: 77.3, imageFile: "mega-lopunny-&-jigglypuff-gx-261.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-cosmic-eclipse/blastoise-&-piplup-gx-38", setName: "Cosmic Eclipse", priceCad: 68.4, imageFile: "blastoise-&-piplup-gx-38.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-cosmic-eclipse/silvally-gx-227", setName: "Cosmic Eclipse", priceCad: 61.5, imageFile: "silvally-gx-227.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-cosmic-eclipse/piplup-239", setName: "Cosmic Eclipse", priceCad: 62.1, imageFile: "piplup-239.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-cosmic-eclipse/venusaur-&-snivy-gx-249", setName: "Cosmic Eclipse", priceCad: 61.3, imageFile: "venusaur-&-snivy-gx-249.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-cosmic-eclipse/arceus-&-dialga-&-palkia-gx-220", setName: "Cosmic Eclipse", priceCad: 61.3, imageFile: "arceus-&-dialga-&-palkia-gx-220.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-cosmic-eclipse/mega-lopunny-&-jigglypuff-gx-225", setName: "Cosmic Eclipse", priceCad: 60.1, imageFile: "mega-lopunny-&-jigglypuff-gx-225.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-cosmic-eclipse/guzma-&-hala-229", setName: "Cosmic Eclipse", priceCad: 54.1, imageFile: "guzma-&-hala-229.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-cosmic-eclipse/vileplume-gx-250", setName: "Cosmic Eclipse", priceCad: 59.7, imageFile: "vileplume-gx-250.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-cosmic-eclipse/mimikyu-245", setName: "Cosmic Eclipse", priceCad: 47.8, imageFile: "mimikyu-245.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-cosmic-eclipse/togepi-&-cleffa-&-igglybuff-gx-143", setName: "Cosmic Eclipse", priceCad: 43.7, imageFile: "togepi-&-cleffa-&-igglybuff-gx-143.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-cosmic-eclipse/venusaur-&-snivy-gx-210", setName: "Cosmic Eclipse", priceCad: 41.5, imageFile: "venusaur-&-snivy-gx-210.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-cosmic-eclipse/silvally-gx-262", setName: "Cosmic Eclipse", priceCad: 35.6, imageFile: "silvally-gx-262.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-cosmic-eclipse/solgaleo-&-lunala-gx-75", setName: "Cosmic Eclipse", priceCad: 38.6, imageFile: "solgaleo-&-lunala-gx-75.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-cosmic-eclipse/naganadel-&-guzzlord-gx-260", setName: "Cosmic Eclipse", priceCad: 35.5, imageFile: "naganadel-&-guzzlord-gx-260.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-cosmic-eclipse/charizard-&-braixen-gx-22", setName: "Cosmic Eclipse", priceCad: 34.4, imageFile: "charizard-&-braixen-gx-22.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-cosmic-eclipse/flygon-gx-256", setName: "Cosmic Eclipse", priceCad: 31.4, imageFile: "flygon-gx-256.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-cosmic-eclipse/solgaleo-stamped-142", setName: "Cosmic Eclipse", priceCad: 31.2, imageFile: "solgaleo-stamped-142.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-cosmic-eclipse/lillie's-poke-doll-267", setName: "Cosmic Eclipse", priceCad: 27.5, imageFile: "lillie%27s-poke-doll-267.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-cosmic-eclipse/koffing-243", setName: "Cosmic Eclipse", priceCad: 27.4, imageFile: "koffing-243.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-cosmic-eclipse/venusaur-&-snivy-gx-1", setName: "Cosmic Eclipse", priceCad: 27.3, imageFile: "venusaur-&-snivy-gx-1.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-cosmic-eclipse/mega-lopunny-&-jigglypuff-gx-165", setName: "Cosmic Eclipse", priceCad: 27, imageFile: "mega-lopunny-&-jigglypuff-gx-165.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-cosmic-eclipse/arceus-&-dialga-&-palkia-gx-156", setName: "Cosmic Eclipse", priceCad: 26.7, imageFile: "arceus-&-dialga-&-palkia-gx-156.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-cosmic-eclipse/roller-skater-235", setName: "Cosmic Eclipse", priceCad: 26, imageFile: "roller-skater-235.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-cosmic-eclipse/naganadel-&-guzzlord-gx-223", setName: "Cosmic Eclipse", priceCad: 24.6, imageFile: "naganadel-&-guzzlord-gx-223.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-cosmic-eclipse/marshadow-reverse-holo-103", setName: "Cosmic Eclipse", priceCad: 23.7, imageFile: "marshadow-reverse-holo-103.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-cosmic-eclipse/volcarona-gx-252", setName: "Cosmic Eclipse", priceCad: 21.8, imageFile: "volcarona-gx-252.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-cosmic-eclipse/vileplume-gx-4", setName: "Cosmic Eclipse", priceCad: 19.2, imageFile: "vileplume-gx-4.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-cosmic-eclipse/steelix-247", setName: "Cosmic Eclipse", priceCad: 19.2, imageFile: "steelix-247.jpg" },
  { url: "https://www.pricecharting.com/game/pokemon-cosmic-eclipse/mimikyu-reverse-holo-97", setName: "Cosmic Eclipse", priceCad: 19, imageFile: "mimikyu-reverse-holo-97.jpg" },
];

const cards = CARDS.map((c, idx) => ({ id: idx, ...c }));

// ================== Helpers ==================

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function isHost(req) {
  const q = String(req.query.host || "").trim();
  const h = String(req.header("x-host") || "").trim();
  return q === "1" || h === "1";
}

function pickCardFromDeck(session) {
  if (!session.deck?.length) return null;
  const id = session.deck.pop();
  return cards[id] || null;
}

function localImageSrc(card) {
  const clean = card.imageFile.replace(/^\/+/, "");
  const abs = path.join(IMAGES_DIR, clean);
  if (fs.existsSync(abs)) {
    return `/images/${clean}`;
  }
  return "";
}

function safeSlugTitleFromUrl(u) {
  try {
    const url = new URL(u);
    const last = url.pathname.split("/").filter(Boolean).at(-1) || "card";
    return last.replace(/-/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
  } catch {
    return "Card";
  }
}

function cardForClient(card) {
  const imgSrc = localImageSrc(card);
  const title = safeSlugTitleFromUrl(card.url);
  return {
    id: card.id,
    url: card.url,
    setName: card.setName,
    title,
    imageSrc: imgSrc,
  };
}

function promptForPhase(phase) {
  if (phase === "first") return `Is this card more or less than $${START_THRESHOLD_CAD} (CAD)?`;
  return "Is this card more or less expensive than the previous card?";
}

function compareDirection(currentPrice, prevPrice) {
  if (currentPrice > prevPrice) return "more";
  if (currentPrice < prevPrice) return "less";
  return "tie";
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
    const d = current && prev ? compareDirection(current.priceCad, prev.priceCad) : "—";
    host.correctAnswer = d === "tie" ? "tie (loss)" : d;
  }

  return host;
}

/** Sessions in memory: sessionId -> session */
const sessions = new Map();

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

app.get("/api/session/:sessionId", (req, res) => {
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
    currentCard: cardForClient(current),
    previousCard: prev ? cardForClient(prev) : null,
    updatedAt: session.updatedAt,
  };

  if (isHost(req)) {
    payload.host = hostPayloadForSession(session);
  }

  res.json(payload);
});

app.post("/api/start", (req, res) => {
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
  };

  sessions.set(sessionId, session);

  const payload = {
    sessionId,
    streak: session.streak,
    phase: session.phase,
    prompt: promptForPhase(session.phase),
    currentCard: cardForClient(first),
    previousCard: null,
    updatedAt: session.updatedAt,
  };

  if (isHost(req)) {
    payload.host = hostPayloadForSession(session);
  }

  res.json(payload);
});

app.post("/api/guess", (req, res) => {
  const { sessionId, guess } = req.body || {};
  const session = sessions.get(sessionId);
  if (!session) return res.status(404).json({ error: "Session not found." });

  const normalizedGuess = String(guess || "").toLowerCase();
  if (!["more", "less"].includes(normalizedGuess)) {
    return res.status(400).json({ error: "Guess must be 'more' or 'less'." });
  }

  const current = cards[session.currentCardId];
  const prev = session.prevCardId != null ? cards[session.prevCardId] : null;
  if (!current) return res.status(500).json({ error: "Current card missing." });

  const endSession = ({ reason, message, correctDirection }) => {
    sessions.delete(sessionId);
    const payload = {
      result: "lose",
      reason,
      message,
      streak: session.streak,
      phase: session.phase,
      prompt: "Game over",
      currentCard: cardForClient(current),
      previousCard: prev ? cardForClient(prev) : null,
      correctDirection,
    };
    if (isHost(req)) payload.host = hostPayloadForSession(session);
    res.json(payload);
  };

  // ===== Phase 1: current card vs $40 =====
  if (session.phase === "first") {
    const price = current.priceCad;
    const correct = price > START_THRESHOLD_CAD ? "more" : price < START_THRESHOLD_CAD ? "less" : "tie";
    const win = correct !== "tie" && normalizedGuess === correct;

    session.updatedAt = Date.now();

    if (!win) {
      return endSession({
        reason: correct === "tie" ? "tie" : "wrong",
        message: correct === "tie" ? `It was exactly $${START_THRESHOLD_CAD.toFixed(1)} — ties are a loss.` : "Wrong guess.",
        correctDirection: correct === "tie" ? "tie" : correct,
      });
    }

    session.streak += 1;
    session.phase = "compare";
    session.prevCardId = current.id;

    const next = pickCardFromDeck(session);
    if (!next) {
      sessions.delete(sessionId);
      const payload = {
        result: "win",
        streak: session.streak,
        phase: "complete",
        message: "You cleared the deck!",
        currentCard: cardForClient(current),
        previousCard: null,
      };
      if (isHost(req)) payload.host = hostPayloadForSession(session);
      return res.json(payload);
    }

    session.currentCardId = next.id;
    session.updatedAt = Date.now();

    const payload = {
      result: "win",
      streak: session.streak,
      phase: session.phase,
      message: "Correct!",
      prompt: promptForPhase(session.phase),
      currentCard: cardForClient(next),
      previousCard: cardForClient(current),
      updatedAt: session.updatedAt,
    };

    if (isHost(req)) payload.host = hostPayloadForSession(session);
    return res.json(payload);
  }

  // ===== Compare phase: current vs previous =====
  if (session.phase === "compare") {
    if (!prev) return res.status(500).json({ error: "Previous card missing." });

    const correct = compareDirection(current.priceCad, prev.priceCad);
    const win = correct !== "tie" && normalizedGuess === correct;

    session.updatedAt = Date.now();

    if (!win) {
      return endSession({
        reason: correct === "tie" ? "tie" : "wrong",
        message: correct === "tie" ? "Tie — ties are a loss." : "Wrong guess.",
        correctDirection: correct === "tie" ? "tie" : correct,
      });
    }

    session.streak += 1;
    session.prevCardId = current.id;

    const next = pickCardFromDeck(session);
    if (!next) {
      sessions.delete(sessionId);
      const payload = {
        result: "win",
        streak: session.streak,
        phase: "complete",
        message: "You cleared the deck!",
        currentCard: cardForClient(current),
        previousCard: cardForClient(prev),
      };
      if (isHost(req)) payload.host = hostPayloadForSession(session);
      return res.json(payload);
    }

    session.currentCardId = next.id;
    session.updatedAt = Date.now();

    const payload = {
      result: "win",
      streak: session.streak,
      phase: session.phase,
      message: "Correct!",
      prompt: promptForPhase(session.phase),
      currentCard: cardForClient(next),
      previousCard: cardForClient(current),
      updatedAt: session.updatedAt,
    };

    if (isHost(req)) payload.host = hostPayloadForSession(session);
    return res.json(payload);
  }

  return res.status(400).json({ error: "Unknown phase." });
});

app.post("/api/timeout", (req, res) => {
  const { sessionId } = req.body || {};
  const session = sessions.get(sessionId);
  if (!session) return res.status(404).json({ error: "Session not found." });

  const current = cards[session.currentCardId];
  const prev = session.prevCardId != null ? cards[session.prevCardId] : null;

  sessions.delete(sessionId);

  const payload = {
    result: "lose",
    reason: "timeout",
    message: "Time's up!",
    streak: session.streak,
    phase: session.phase,
    prompt: "Game over",
    currentCard: current ? cardForClient(current) : null,
    previousCard: prev ? cardForClient(prev) : null,
  };

  if (isHost(req)) payload.host = hostPayloadForSession(session);

  res.json(payload);
});

// Clean up old sessions every 10 minutes
setInterval(() => {
  const cutoff = Date.now() - 1000 * 60 * 60; // 1 hour
  for (const [id, s] of sessions.entries()) {
    if (s.createdAt < cutoff) sessions.delete(id);
  }
}, 1000 * 60 * 10);

export default app;

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}
