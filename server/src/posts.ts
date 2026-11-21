import crypto from "node:crypto";
import { query } from "./db.js";
import { config } from "./config.js";
import { getSetting, getRaw, setRaw, type Brand } from "./settings.js";
import { BriefSchema, checkContent, suggestBrief, writeContent, type Brief, type Check, type Content } from "./claude.js";
import { findPhoto } from "./pexels.js";
import { loadImage, localPathForUrl } from "./storage.js";
import { renderCarousel, renderImagePost, renderReel } from "./render.js";
import * as meta from "./meta.js";

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

/** Claude writes -> independent check (one automatic fix attempt) -> photos -> render. */
export async function generate(id: string) {
  try {
    await update(id, { status: "generating", error: null });
    const post = await getPost(id);
    if (!post) return;
    const brand = await getSetting("brand");
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

async function render(brand: Brand, brief: Brief, content: Content): Promise<MediaItem[]> {
  const searches =
    brief.format === "carousel" ? content.slides.map((s) => s.image_search)
    : brief.format === "reel" ? content.scenes.map((s) => s.image_search)
    : [content.image_search];
  const sources: MediaItem[] = [];
  const photos: (Buffer | null)[] = [];
  for (let i = 0; i < searches.length; i++) {
    const own = brief.photo_urls[i] ?? (brief.photo_urls.length ? brief.photo_urls[i % brief.photo_urls.length] : undefined);
    let url: string | undefined = own;
    let credit: string | undefined;
    if (!url) {
      const found = await findPhoto(searches[i], brief.format === "reel" ? "portrait" : "portrait");
      url = found?.url;
      credit = found?.credit;
    }
    if (url) {
      try {
        photos.push(await loadImage(url));
        sources.push({ kind: "source", url, credit });
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
    const own = post.media.filter((m) => m.kind === "source").map((m) => m.url);
    const media = await render(brand, { ...post.brief, photo_urls: own.length ? own : post.brief.photo_urls }, content);
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
