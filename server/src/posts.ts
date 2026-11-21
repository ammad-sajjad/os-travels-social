import crypto from "node:crypto";
import { query } from "./db.js";
import { config } from "./config.js";
import { getSetting, getRaw, setRaw, type Brand } from "./settings.js";
import sharp from "sharp";
import { BriefSchema, checkContent, drawBackgrounds, pickLink, refineContent, suggestBrief, writeContent, type Brief, type Check, type Content, type RefineField } from "./claude.js";
import { findPhoto } from "./pexels.js";
import { loadImage, localPathForUrl, saveFile } from "./storage.js";
import { renderCarousel, renderImagePost, renderReel } from "./render.js";
import * as meta from "./meta.js";
import { normaliseUrl, readPage } from "./webpage.js";

export type MediaItem = { kind: "image" | "video" | "cover" | "source"; url: string; credit?: string };
export type PlatformResult = { status: "published" | "failed" | "publishing"; id?: string; link?: string; error?: string; at?: string; [k: string]: unknown };
export type Post = {
  id: string;
  created_at: string;
  updated_at: string;
  source: "manual" | "autopilot";
  status: "generating" | "ready" | "scheduled" | "publishing" | "published" | "partial" | "failed";
  brief: Brief;
  content: Content | null;
  media: MediaItem[];
  check_report: Check | null;
  platforms: ("facebook" | "instagram")[];
  publish_at: string | null;
  results: Record<string, PlatformResult>;
  error: string | null;
};

const B = () => config.businessId;

export async function getPost(id: string): Promise<Post | null> {
  const rows = await query<Post>(`SELECT * FROM posts WHERE id=$1 AND business_id=$2`, [id, B()]);
  return rows[0] ?? null;
}

export async function listPosts(limit = 50): Promise<Post[]> {
  return query<Post>(`SELECT * FROM posts WHERE business_id=$1 ORDER BY created_at DESC LIMIT $2`, [B(), limit]);
}

async function update(id: string, fields: Partial<Record<keyof Post, unknown>>) {
  const keys = Object.keys(fields);
  if (!keys.length) return;
  const json = new Set(["brief", "content", "media", "check_report", "platforms", "results"]);
  const sets = keys.map((k, i) => `${k}=$${i + 3}`).join(", ");
  const vals = keys.map((k) => (json.has(k) ? JSON.stringify((fields as any)[k]) : (fields as any)[k]));
  await query(`UPDATE posts SET ${sets}, updated_at=now() WHERE id=$1 AND business_id=$2`, [id, B(), ...vals]);
}

export async function createPost(input: unknown, source: "manual" | "autopilot" = "manual"): Promise<Post> {
  const brief = BriefSchema.parse(input);
  const id = crypto.randomUUID();
  await query(`INSERT INTO posts (id, business_id, source, status, brief, platforms) VALUES ($1,$2,$3,'generating',$4,$5)`, [
    id, B(), source, JSON.stringify(brief), JSON.stringify(brief.platforms),
  ]);
  void generate(id);
  return (await getPost(id))!;
}

/** Read the pasted link; if it's a general page (e.g. a home page), let Claude pick the page that matches the topic. */
async function attachPage(brief: Brief): Promise<Brief> {
  let page;
  try {
    page = await readPage(brief.link_url);
  } catch (e) {
    const message = (e as Error).message;
    // The site refused or failed (many block cloud servers): keep the link, use only the brief's facts.
    if (message.startsWith("The page answered with error") || /timeout|aborted|fetch failed/i.test(message)) {
      console.warn(`Could not read ${brief.link_url}: ${message}`);
      return { ...brief, page: { url: normaliseUrl(brief.link_url).toString(), title: "", description: "", text: "", image: null, unreadable: true } };
    }
    throw new Error(`Couldn't open the link ${brief.link_url}: ${message}`);
  }
  const chosen = await pickLink(`${brief.service ? brief.service + ": " : ""}${brief.topic}`, page);
  if (chosen !== page.url) {
    try {
      page = await readPage(chosen);
    } catch (e) {
      console.warn(`Chosen link ${chosen} failed, using the pasted page:`, (e as Error).message);
    }
  }
  const photo_urls = brief.use_link_image && page.image && !brief.photo_urls.length ? [page.image] : brief.photo_urls;
  return { ...brief, photo_urls, page: { url: page.url, title: page.title, description: page.description, text: page.text, image: page.image } };
}

/** Claude writes -> independent check (one automatic fix attempt) -> photos -> render. */
export async function generate(id: string) {
  try {
    await update(id, { status: "generating", error: null });
    const post = await getPost(id);
    if (!post) return;
    const brand = await getSetting("brand");
    if (post.brief.link_url && !post.brief.page) {
      post.brief = await attachPage(post.brief);
      await update(id, { brief: post.brief });
    }
    let content = await writeContent(brand, post.brief);
    let check = await checkContent(brand, post.brief, content);
    if (check.result === "fail") {
      const feedback = check.checks.filter((c) => c.status === "fail").map((c) => `- ${c.name}: ${c.reason}. Fix: ${c.fix ?? ""}`).join("\n");
      content = await writeContent(brand, post.brief, feedback);
      check = await checkContent(brand, post.brief, content);
    }
    await update(id, { content, check_report: check });
    const media = await render(brand, post.brief, content);
    await update(id, { media, status: "ready" });
  } catch (e) {
    console.error(`generate ${id} failed`, e);
    await update(id, { status: "failed", error: (e as Error).message });
  }
}

/**
 * Background for each image/slide/scene: reused picture (on re-render) -> owner's photo -> Pexels (only if a key is set)
 * -> a picture Claude draws itself. Then the branded images/reel are rendered.
 */
async function render(brand: Brand, brief: Brief, content: Content, reuse?: string[]): Promise<MediaItem[]> {
  const descs =
    brief.format === "carousel" ? content.slides.map((s) => s.image_search)
    : brief.format === "reel" ? content.scenes.map((s) => s.image_search)
    : [content.image_search];
  const [W, H] = brief.format === "reel" ? [1080, 1920] : [1080, 1350];
  const own = brief.photo_urls;
  const urls: (string | undefined)[] = descs.map((_, i) => reuse?.[i] ?? own[i] ?? (own.length ? own[i % own.length] : undefined));
  const credits: (string | undefined)[] = descs.map(() => undefined);

  if (config.pexelsKey) {
    for (let i = 0; i < descs.length; i++) {
      if (urls[i]) continue;
      const found = await findPhoto(descs[i], "portrait").catch(() => null);
      if (found) { urls[i] = found.url; credits[i] = found.credit; }
    }
  }

  const missing = descs.map((_, i) => i).filter((i) => !urls[i]);
  if (missing.length) {
    const svgs = await drawBackgrounds(missing.map((i) => descs[i]), W, H).catch((e) => {
      console.warn("Claude drawing failed, using brand colours:", (e as Error).message);
      return [] as string[];
    });
    for (let k = 0; k < missing.length; k++) {
      // Strip anything that could load external content before rendering.
      const svg = svgs[k]?.replace(/<(image|script|foreignObject|use)\b[\s\S]*?(\/>|<\/\1>)/gi, "").replace(/(xlink:)?href\s*=\s*["'][^"']*["']/gi, "");
      if (!svg?.includes("<svg")) continue;
      try {
        const jpg = await sharp(Buffer.from(svg)).resize(W, H, { fit: "cover" }).jpeg({ quality: 92 }).toBuffer();
        urls[missing[k]] = (await saveFile(jpg, "jpg")).url;
        credits[missing[k]] = "Illustration drawn by Claude";
      } catch (e) {
        console.warn("Could not render Claude's drawing:", (e as Error).message);
      }
    }
  }

  const sources: MediaItem[] = [];
  const photos: (Buffer | null)[] = [];
  for (let i = 0; i < descs.length; i++) {
    const url = urls[i];
    if (url) {
      try {
        photos.push(await loadImage(url));
        sources.push({ kind: "source", url, credit: credits[i] });
        continue;
      } catch (e) {
        console.warn("photo load failed", (e as Error).message);
      }
    }
    photos.push(null);
  }
  if (brief.format === "carousel") return [...(await renderCarousel(brand, content, photos)).map((f) => ({ kind: "image" as const, url: f.url })), ...sources];
  if (brief.format === "reel") {
    const [video, cover] = await renderReel(brand, content, photos);
    return [{ kind: "video", url: video.url }, { kind: "cover", url: cover.url }, ...sources];
  }
  return [...(await renderImagePost(brand, content, photos[0] ?? null)).map((f) => ({ kind: "image" as const, url: f.url })), ...sources];
}

const REFINE_KEYS: Record<RefineField, (keyof Content)[]> = {
  image: ["headline", "points", "price_badge", "cta", "slides", "scenes"],
  visual: ["image_search", "slides", "scenes"],
  caption_instagram: ["caption_instagram"],
  caption_facebook: ["caption_facebook"],
  hashtags: ["hashtags", "caption_instagram", "caption_facebook"],
  first_comment: ["first_comment"],
};

/** "Ask Claude" box on one part of the post. Runs in the background; the page polls. */
export async function refinePost(id: string, field: RefineField, instruction: string) {
  if (!REFINE_KEYS[field]) throw new Error("Unknown part of the post.");
  if (!instruction.trim()) throw new Error("Type what you want changed.");
  const post = await getPost(id);
  if (!post || !post.content) throw new Error("Post not found or not generated yet.");
  if (!["ready", "failed", "scheduled"].includes(post.status)) throw new Error(`Cannot change a post that is ${post.status}.`);
  const back = post.status === "failed" ? "ready" : post.status;
  await update(id, { status: "generating", error: null });
  void (async () => {
    try {
      const brand = await getSetting("brand");
      const updated = await refineContent(brand, post.brief, post.content!, field, instruction);
      const content = { ...post.content! } as Record<string, unknown>;
      for (const k of REFINE_KEYS[field]) content[k] = updated[k];
      const next = content as Content;
      let media = post.media;
      if (field === "image") media = await render(brand, post.brief, next, post.media.filter((m) => m.kind === "source").map((m) => m.url));
      if (field === "visual") media = await render(brand, post.brief, next);
      const check = await checkContent(brand, post.brief, next);
      await update(id, { content: next, media, check_report: check, status: back });
    } catch (e) {
      console.error(`refine ${id} failed`, e);
      await update(id, { status: back, error: `Claude couldn't make that change: ${(e as Error).message}` });
    }
  })();
  return getPost(id);
}

/** Owner edited the text. Captions need no re-render; on-image text does. */
export async function editPost(id: string, patch: { content?: Partial<Content>; platforms?: Post["platforms"]; rerender?: boolean }) {
  const post = await getPost(id);
  if (!post || !post.content) throw new Error("Post not found or not generated yet.");
  if (!["ready", "failed", "scheduled"].includes(post.status)) throw new Error(`Cannot edit a post that is ${post.status}.`);
  const content = { ...post.content, ...(patch.content ?? {}) } as Content;
  const fields: Partial<Record<keyof Post, unknown>> = { content };
  if (patch.platforms?.length) fields.platforms = patch.platforms;
  await update(id, fields);
  if (patch.rerender) {
    const brand = await getSetting("brand");
    const reuse = post.media.filter((m) => m.kind === "source").map((m) => m.url);
    const media = await render(brand, post.brief, content, reuse);
    await update(id, { media, status: post.status === "failed" ? "ready" : post.status });
  }
  return getPost(id);
}

export async function schedule(id: string, when?: string) {
  const post = await getPost(id);
  if (!post) throw new Error("Post not found.");
  if (!["ready", "scheduled", "failed", "partial"].includes(post.status)) throw new Error(`Cannot publish a post that is ${post.status}.`);
  if (!post.content || !post.media.length) throw new Error("Post has no content yet.");
  if (when && new Date(when).getTime() > Date.now() + 60_000) {
    await update(id, { status: "scheduled", publish_at: new Date(when).toISOString() });
    return getPost(id);
  }
  void publishNow(id);
  return getPost(id);
}

export async function unschedule(id: string) {
  await query(`UPDATE posts SET status='ready', publish_at=NULL, updated_at=now() WHERE id=$1 AND business_id=$2 AND status='scheduled'`, [id, B()]);
  return getPost(id);
}

export async function deletePost(id: string) {
  await query(`DELETE FROM posts WHERE id=$1 AND business_id=$2 AND status NOT IN ('published','partial','publishing')`, [id, B()]);
}

/** Publish to each chosen platform that isn't already published. Never posts the same platform twice. */
export async function publishNow(id: string) {
  const claimed = await query<Post>(
    `UPDATE posts SET status='publishing', updated_at=now() WHERE id=$1 AND business_id=$2 AND status IN ('ready','scheduled','failed','partial') RETURNING *`,
    [id, B()],
  );
  const post = claimed[0];
  if (!post || !post.content) return;
  const results = { ...post.results };
  const save = async () => update(id, { results });
  const images = post.media.filter((m) => m.kind === "image").map((m) => m.url);
  const video = post.media.find((m) => m.kind === "video")?.url;
  const cover = post.media.find((m) => m.kind === "cover")?.url;
  const local = (url: string) => {
    const p = localPathForUrl(url);
    if (!p) throw new Error(`Media file missing: ${url}`);
    return p;
  };

  for (const platform of post.platforms) {
    if (results[platform]?.status === "published") continue;
    if (results[platform]?.status === "publishing") {
      results[platform] = { status: "failed", error: "An earlier attempt was interrupted. Check the account before retrying so it isn't posted twice." };
      // Mark and skip once; the owner can press Publish again after checking.
      await save();
      continue;
    }
    results[platform] = { status: "publishing", at: new Date().toISOString() };
    await save();
    const progress: meta.Progress = async (patch) => {
      results[platform] = { ...results[platform], ...patch };
      await save();
    };
    try {
      let out: meta.Published;
      const c = post.content;
      if (platform === "facebook") {
        if (video) out = await meta.facebookReel(local(video), c.caption_facebook, progress);
        else if (images.length > 1) out = await meta.facebookCarousel(images.map(local), c.caption_facebook, progress);
        else out = await meta.facebookImage(local(images[0]), c.caption_facebook);
        if (c.first_comment) await meta.facebookComment(out.id, c.first_comment).catch((e) => console.warn("fb comment", e.message));
      } else {
        if (video) out = await meta.instagramReel(video, c.caption_instagram, cover, progress);
        else if (images.length > 1) out = await meta.instagramCarousel(images, c.caption_instagram, progress);
        else out = await meta.instagramImage(images[0], c.caption_instagram, progress);
        if (c.first_comment) await meta.instagramComment(out.id, c.first_comment).catch((e) => console.warn("ig comment", e.message));
      }
      results[platform] = { status: "published", id: out.id, link: out.link, at: new Date().toISOString() };
    } catch (e) {
      console.error(`publish ${id} to ${platform} failed`, e);
      results[platform] = { ...results[platform], status: "failed", error: (e as Error).message };
    }
    await save();
  }
  const statuses = post.platforms.map((p) => results[p]?.status);
  const status = statuses.every((s) => s === "published") ? "published" : statuses.some((s) => s === "published") ? "partial" : "failed";
  await update(id, { status, results, error: status === "published" ? null : "Some platforms failed - see details." });
}

// ---------------- Scheduler + autopilot ----------------

function localNow() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: config.timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour") === "24" ? "00" : get("hour")}:${get("minute")}` };
}

async function runAutopilot() {
  const ap = await getSetting("autopilot");
  if (!ap.enabled) return;
  if (config.claudeMode === "local") return; // unattended posting needs an API key
  const now = localNow();
  if (now.time < ap.time) return;
  const last = await getRaw("autopilot_last_run");
  if (last === now.date) return;
  await setRaw("autopilot_last_run", now.date); // set first, so a crash never double-posts
  console.log(`Autopilot: creating today's post (${now.date})`);
  const brand = await getSetting("brand");
  const recent = (await listPosts(10)).map((p) => p.brief.topic);
  const idea = await suggestBrief(brand, ap.topics, recent);
  const post = await createPost({ ...idea, format: ap.format, platforms: ap.platforms }, "autopilot");
  for (let i = 0; i < 90; i++) {
    await new Promise((r) => setTimeout(r, 10_000));
    const p = await getPost(post.id);
    if (!p || p.status === "failed") return;
    if (p.status === "ready") {
      if (ap.require_quality_pass && p.check_report?.result !== "pass") {
        console.warn("Autopilot: quality check failed - left for the owner to review.");
        return;
      }
      await publishNow(p.id);
      return;
    }
  }
}

let ticking = false;
export function startScheduler() {
  const tick = async () => {
    if (ticking) return;
    ticking = true;
    try {
      const due = await query<{ id: string }>(`SELECT id FROM posts WHERE business_id=$1 AND status='scheduled' AND publish_at <= now()`, [B()]);
      for (const d of due) await publishNow(d.id);
      await runAutopilot();
    } catch (e) {
      console.error("scheduler error", e);
    } finally {
      ticking = false;
    }
  };
  setInterval(tick, 60_000);
  setTimeout(tick, 5_000);
}

/** After a restart, nothing can still be running. */
export async function recoverInterrupted() {
  await query(`UPDATE posts SET status='failed', error='The server restarted while this post was being created. Press Regenerate.' WHERE status='generating'`);
  await query(`UPDATE posts SET status='partial', error='The server restarted while publishing. Check Facebook/Instagram before retrying.' WHERE status='publishing'`);
}
