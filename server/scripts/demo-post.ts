// Creates a sample "ready" post without calling Claude, for demos and UI testing:
//   npx tsx scripts/demo-post.ts
import crypto from "node:crypto";
import sharp from "sharp";
import { migrate, query } from "../src/db.js";
import { config } from "../src/config.js";
import { getSetting } from "../src/settings.js";
import { renderImagePost } from "../src/render.js";
import { saveFile } from "../src/storage.js";

await migrate();
const brand = await getSetting("brand");
const content = {
  hook: "Kya aap ne Cappadocia ke hot air balloons dekhe hain?",
  headline: "Turkey 7 Din Family Tour",
  points: ["Istanbul aur Cappadocia", "Hotel aur transfers", "Guided tours"],
  price_badge: "PKR 2,45,000/-",
  cta: brand.cta_default,
  image_search: "Cappadocia hot air balloons sunrise",
  slides: [], scenes: [],
  caption_instagram: `Kya aap ne Cappadocia ke hot air balloons dekhe hain? 🎈\n\nIstanbul ki khoobsurat galiyan aur Cappadocia ka jaadu, family ke saath.\n✈️ 7 din 6 raatein\n💰 PKR 2,45,000/- per person\n\n${brand.cta_default}: ${brand.contact.whatsapp}\n\n${brand.brand_hashtags.join(" ")} #TurkeyTour #Cappadocia #FamilyTrip`,
  caption_facebook: `Kya aap ne Cappadocia ke hot air balloons dekhe hain? 🎈\n\nIs saal family ke saath Turkey ka yaadgaar safar karein.\nPKR 2,45,000/- per person.\n\n${brand.cta_default}: https://wa.me/${brand.contact.whatsapp.replace(/\D/g, "")}\n\n${brand.brand_hashtags.join(" ")} #TurkeyTour`,
  hashtags: [...brand.brand_hashtags, "#TurkeyTour", "#Cappadocia", "#FamilyTrip"],
  first_comment: null,
};
const photo = await sharp({ create: { width: 1600, height: 2000, channels: 3, background: { r: 30, g: 90, b: 140 } } }).jpeg().toBuffer();
const [img] = await renderImagePost(brand, content as any, photo);
const id = crypto.randomUUID();
await query(
  `INSERT INTO posts (id, business_id, status, brief, content, media, check_report, platforms) VALUES ($1,$2,'ready',$3,$4,$5,$6,$7)`,
  [id, config.businessId,
   JSON.stringify({ format: "image", platforms: ["facebook", "instagram"], topic: "Turkey family tour (demo)", service: "Tour package", price: "PKR 2,45,000", dates: "", details: "", tone: "Family", slides: 5, reel_seconds: 20, own_caption: "", own_hashtags: "", photo_urls: [] }),
   JSON.stringify(content), JSON.stringify([{ kind: "image", url: img.url }]),
   JSON.stringify({ result: "pass", checks: [{ name: "facts", status: "pass", reason: "Matches the brief", fix: null }, { name: "format", status: "warn", reason: "Demo post - not written by Claude", fix: null }] }),
   JSON.stringify(["facebook", "instagram"])],
);
console.log(`Demo post created: ${id}`);
process.exit(0);
