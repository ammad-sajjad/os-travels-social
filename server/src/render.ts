// Turns written content into branded images (1080x1350) and reels (1080x1920 MP4).
import sharp, { type OverlayOptions } from "sharp";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import ffmpegStatic from "ffmpeg-static";
import type { Brand } from "./settings.js";
import type { Content } from "./claude.js";
import { loadImage, saveFile, type StoredFile } from "./storage.js";

const FONT = "DejaVu Sans, Helvetica Neue, Helvetica, Arial, sans-serif";
const POST_W = 1080, POST_H = 1350, REEL_W = 1080, REEL_H = 1920;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function wrap(text: string, maxChars: number, maxLines = 4): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    if ((line + " " + w).trim().length > maxChars && line) {
      lines.push(line);
      line = w;
    } else line = (line + " " + w).trim();
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = kept[maxLines - 1].replace(/\s*\S*$/, "") + "…";
    return kept;
  }
  return lines;
}

function textLines(lines: string[], x: number, y: number, size: number, opts: { weight?: number; fill?: string; anchor?: string; gap?: number } = {}) {
  const gap = opts.gap ?? 1.18;
  return lines
    .map(
      (l, i) =>
        `<text x="${x}" y="${y + i * size * gap}" font-family="${FONT}" font-size="${size}" font-weight="${opts.weight ?? 700}" fill="${opts.fill ?? "#fff"}" text-anchor="${opts.anchor ?? "start"}" stroke="rgba(0,0,0,0.35)" stroke-width="2" paint-order="stroke">${esc(l)}</text>`,
    )
    .join("");
}

async function background(photo: Buffer | null, w: number, h: number, brand: Brand): Promise<Buffer> {
  if (photo) {
    return sharp(photo).rotate().resize(w, h, { fit: "cover", position: "attention" }).jpeg({ quality: 92 }).toBuffer();
  }
  const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${brand.colors.primary}"/><stop offset="1" stop-color="#000"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 92 }).toBuffer();
}

async function logoLayer(brand: Brand, width: number): Promise<Buffer | null> {
  if (!brand.logo_url) return null;
  try {
    return await sharp(await loadImage(brand.logo_url)).resize({ width, withoutEnlargement: false }).png().toBuffer();
  } catch (e) {
    console.warn("Logo could not be loaded:", (e as Error).message);
    return null;
  }
}

function contactLine(brand: Brand, cta = "") {
  const c = brand.contact;
  // Don't say "WhatsApp" twice when the call to action already does.
  const wa = c.whatsapp && (/whatsapp/i.test(cta) ? c.whatsapp : `WhatsApp ${c.whatsapp}`);
  return [wa, c.website].filter(Boolean).join("  ·  ");
}

/** Largest font size (up to max) that keeps a bold line inside the width, in the widest font we use. */
const fitSize = (text: string, width: number, max: number) => Math.min(max, Math.floor(width / (text.length * 0.7)));

type Slide = { headline: string; points?: string[]; text?: string; price?: string | null; cta?: string; showContact?: boolean };

/** One branded 1080x1350 image. */
async function renderPostImage(brand: Brand, photo: Buffer | null, s: Slide): Promise<Buffer> {
  const bg = await background(photo, POST_W, POST_H, brand);
  const pad = 70;
  const headline = wrap(s.headline, 18, 3);
  const body = s.text ? wrap(s.text, 34, 4) : [];
  const points = (s.points ?? []).slice(0, 3);
  const ctaBar = 120;

  // Build the text block from the bottom up so it never collides with the CTA bar.
  let y = POST_H - ctaBar - 60;
  const parts: string[] = [];
  if (points.length) {
    const block = points.map((p, i) => `<circle cx="${pad + 12}" cy="${y - (points.length - 1 - i) * 62 - 14}" r="10" fill="${brand.colors.accent}"/>` + textLines([p], pad + 40, y - (points.length - 1 - i) * 62, 42, { weight: 600 })).join("");
    parts.push(block);
    y -= points.length * 62 + 30;
  }
  if (body.length) {
    parts.push(textLines(body, pad, y - (body.length - 1) * 50, 40, { weight: 500, gap: 1.25 }));
    y -= body.length * 50 + 30;
  }
  const hSize = 84;
  parts.push(textLines(headline, pad, y - (headline.length - 1) * hSize * 1.12, hSize, { weight: 800, gap: 1.12 }));

  const price = s.price
    ? `<rect x="${POST_W - pad - 440}" y="${pad + 10}" rx="22" width="440" height="110" fill="${brand.colors.accent}"/>` +
      `<text x="${POST_W - pad - 220}" y="${pad + 82}" font-family="${FONT}" font-size="${s.price.length > 16 ? 38 : 48}" font-weight="800" fill="#111" text-anchor="middle">${esc(s.price)}</text>`
    : "";
  const ctaText = [s.cta, s.showContact !== false ? contactLine(brand, s.cta) : ""].filter(Boolean).join("  ·  ");
  const cta = ctaText
    ? `<rect x="0" y="${POST_H - ctaBar}" width="${POST_W}" height="${ctaBar}" fill="${brand.colors.primary}"/>` +
      `<text x="${POST_W / 2}" y="${POST_H - ctaBar / 2 + 14}" font-family="${FONT}" font-size="${fitSize(ctaText, POST_W - 80, 40)}" font-weight="700" fill="${brand.colors.text}" text-anchor="middle">${esc(ctaText)}</text>`
    : "";

  const overlay = `<svg width="${POST_W}" height="${POST_H}" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0.35" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.85"/></linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#fade)"/>${parts.join("")}${price}${cta}</svg>`;

  const layers: OverlayOptions[] = [{ input: Buffer.from(overlay) }];
  const logo = await logoLayer(brand, Math.round(POST_W * 0.16));
  if (logo) layers.push({ input: logo, top: pad, left: pad });
  return sharp(bg).composite(layers).jpeg({ quality: 90 }).toBuffer();
}

export async function renderImagePost(brand: Brand, content: Content, photo: Buffer | null): Promise<StoredFile[]> {
  const img = await renderPostImage(brand, photo, { headline: content.headline, points: content.points, price: content.price_badge, cta: content.cta });
  return [await saveFile(img, "jpg")];
}

export async function renderCarousel(brand: Brand, content: Content, photos: (Buffer | null)[]): Promise<StoredFile[]> {
  const out: StoredFile[] = [];
  const n = content.slides.length;
  for (let i = 0; i < n; i++) {
    const s = content.slides[i];
    const last = i === n - 1;
    const img = await renderPostImage(brand, photos[i] ?? photos[0] ?? null, {
      headline: s.headline,
      text: s.text,
      price: last || i === 0 ? content.price_badge : null,
      cta: last ? content.cta : `${i + 1}/${n}`,
      showContact: last,
    });
    out.push(await saveFile(img, "jpg"));
  }
  return out;
}

// ---------- Reels ----------

/** Transparent text layer for one reel scene. Keeps text out of the top 250px and bottom 400px. */
async function reelOverlay(brand: Brand, text: string, opts: { last: boolean; price: string | null; cta: string }): Promise<Buffer> {
  const lines = wrap(text, 16, 4);
  const size = 92;
  // Last scene: text higher up, then price badge, then the CTA card ending at y=1480 (above the bottom 400px).
  const midY = (opts.last ? 820 : 1150) - ((lines.length - 1) * size * 1.12) / 2;
  let extra = "";
  if (opts.price) {
    const y = opts.last ? 1110 : 1320;
    extra += `<rect x="290" y="${y}" rx="24" width="500" height="110" fill="${brand.colors.accent}"/>` +
      `<text x="540" y="${y + 73}" font-family="${FONT}" font-size="${opts.price.length > 16 ? 38 : 50}" font-weight="800" fill="#111" text-anchor="middle">${esc(opts.price)}</text>`;
  }
  if (opts.last) {
    const contact = contactLine(brand, opts.cta);
    extra +=
      `<rect x="90" y="1280" rx="26" width="900" height="200" fill="${brand.colors.primary}" opacity="0.95"/>` +
      `<text x="540" y="1365" font-family="${FONT}" font-size="${fitSize(opts.cta, 840, 54)}" font-weight="800" fill="${brand.colors.text}" text-anchor="middle">${esc(opts.cta)}</text>` +
      (contact ? `<text x="540" y="1440" font-family="${FONT}" font-size="${fitSize(contact, 840, 36)}" font-weight="600" fill="${brand.colors.text}" text-anchor="middle">${esc(contact)}</text>` : "");
  }
  const svg = `<svg width="${REEL_W}" height="${REEL_H}" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0.3" stop-color="#000" stop-opacity="0"/><stop offset="0.75" stop-color="#000" stop-opacity="0.55"/><stop offset="1" stop-color="#000" stop-opacity="0.2"/></linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#fade)"/>${textLines(lines, 540, midY, size, { weight: 800, anchor: "middle", gap: 1.12 })}${extra}</svg>`;
  const layers: OverlayOptions[] = [{ input: Buffer.from(svg) }];
  const logo = await logoLayer(brand, Math.round(REEL_W * 0.15));
  if (logo) layers.push({ input: logo, top: 260, left: 60 });
  return sharp({ create: { width: REEL_W, height: REEL_H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(layers)
    .png()
    .toBuffer();
}

function runFfmpeg(args: string[]): Promise<void> {
  const bin = process.env.FFMPEG_PATH || (ffmpegStatic as unknown as string) || "ffmpeg";
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => (err = (err + d).slice(-4000)));
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg failed (${code}): ${err}`))));
  });
}

export async function renderReel(brand: Brand, content: Content, photos: (Buffer | null)[]): Promise<StoredFile[]> {
  const scenes = content.scenes.length ? content.scenes : [{ on_screen: content.headline, image_search: content.image_search, seconds: 5 }];
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "reel-"));
  try {
    const args: string[] = ["-y"];
    const filters: string[] = [];
    let total = 0;
    for (let i = 0; i < scenes.length; i++) {
      const sec = Math.min(8, Math.max(2, Number(scenes[i].seconds) || 4));
      total += sec;
      const last = i === scenes.length - 1;
      const bgPath = path.join(tmp, `bg${i}.jpg`);
      const ovPath = path.join(tmp, `ov${i}.png`);
      await fs.writeFile(bgPath, await background(photos[i] ?? photos[0] ?? null, REEL_W, REEL_H, brand));
      await fs.writeFile(ovPath, await reelOverlay(brand, scenes[i].on_screen, { last, price: last ? content.price_badge : null, cta: content.cta }));
      args.push("-i", bgPath, "-loop", "1", "-t", String(sec), "-i", ovPath);
      const frames = Math.round(sec * 30);
      const zoom = i % 2 === 0 ? "min(zoom+0.0008,1.12)" : "if(eq(on,0),1.12,max(zoom-0.0008,1.0))";
      filters.push(
        `[${i * 2}:v]scale=1296:2304,zoompan=z='${zoom}':d=${frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${REEL_W}x${REEL_H}:fps=30,setsar=1[b${i}]`,
        `[b${i}][${i * 2 + 1}:v]overlay=0:0:shortest=1,format=yuv420p[v${i}]`,
      );
    }
    const audioIdx = scenes.length * 2;
    args.push("-f", "lavfi", "-t", String(total), "-i", "anullsrc=r=44100:cl=stereo");
    filters.push(`${scenes.map((_, i) => `[v${i}]`).join("")}concat=n=${scenes.length}:v=1:a=0[v]`);
    const outPath = path.join(tmp, "reel.mp4");
    args.push(
      "-filter_complex", filters.join(";"),
      "-map", "[v]", "-map", `${audioIdx}:a`,
      "-c:v", "libx264", "-preset", "veryfast", "-b:v", "6M", "-maxrate", "8M", "-bufsize", "12M",
      "-pix_fmt", "yuv420p", "-r", "30", "-c:a", "aac", "-b:a", "128k", "-shortest", "-movflags", "+faststart",
      outPath,
    );
    await runFfmpeg(args);
    const video = await saveFile(await fs.readFile(outPath), "mp4");
    // Cover image = first scene with text.
    const cover = await sharp(await fs.readFile(path.join(tmp, "bg0.jpg")))
      .composite([{ input: await fs.readFile(path.join(tmp, "ov0.png")) }])
      .jpeg({ quality: 88 })
      .toBuffer();
    return [video, await saveFile(cover, "jpg")];
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
}
