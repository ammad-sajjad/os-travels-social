// Renders sample outputs without calling Claude or Meta: npx tsx scripts/render-test.ts
import sharp from "sharp";
import { BrandSchema } from "../src/settings.js";
import { presets } from "../src/presets.js";
import { renderImagePost, renderCarousel, renderReel } from "../src/render.js";

const brand = BrandSchema.parse({ ...presets["os-travels"].brand, contact: { whatsapp: "+92 300 1234567", website: "ostravels.pk" } });
const photo = await sharp({ create: { width: 1600, height: 2400, channels: 3, background: { r: 40, g: 110, b: 160 } } })
  .composite([{ input: Buffer.from(`<svg width="1600" height="2400"><circle cx="800" cy="900" r="500" fill="#e9b44c"/><rect y="1500" width="1600" height="900" fill="#1d4e89"/></svg>`) }])
  .jpeg().toBuffer();
const content: any = {
  hook: "Kya aap ne Cappadocia ke hot air balloons dekhe hain?",
  headline: "Turkey 7 Din Family Tour",
  points: ["Istanbul aur Cappadocia", "Hotel aur transfers", "Guided tours"],
  price_badge: "PKR 2,45,000/-",
  cta: "Abhi WhatsApp karein",
  image_search: "Cappadocia balloons",
  slides: [
    { headline: "Turkey ka safar!", text: "Is saal family ke saath yaadgaar chhuttiyan.", image_search: "" },
    { headline: "Istanbul", text: "Blue Mosque, Bosphorus cruise aur bazaar.", image_search: "" },
    { headline: "Book karein", text: "Seats limited hain, aaj hi book karein.", image_search: "" },
  ],
  scenes: [
    { on_screen: "Turkey 7 din ka safar", image_search: "", seconds: 3 },
    { on_screen: "Cappadocia balloons", image_search: "", seconds: 3 },
    { on_screen: "Book now", image_search: "", seconds: 3 },
  ],
};
const t0 = Date.now();
console.log("image", (await renderImagePost(brand, content, photo)).map((f) => f.path));
console.log("carousel", (await renderCarousel(brand, content, [photo, null, photo])).map((f) => f.path));
console.log("reel", (await renderReel(brand, content, [photo, null, photo])).map((f) => f.path), `${Date.now() - t0}ms`);
