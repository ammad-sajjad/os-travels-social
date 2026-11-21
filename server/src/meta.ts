// Facebook Page + Instagram professional account publishing via the Meta Graph API.
import fs from "node:fs/promises";
import { config } from "./config.js";

export class MetaError extends Error {
  constructor(message: string, public code?: number, public subcode?: number, public raw?: unknown) {
    super(message);
  }
}

const base = () => `https://graph.facebook.com/${config.meta.version}`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function requireMeta() {
  const m = config.meta;
  if (!m.token) throw new MetaError("META_SYSTEM_USER_TOKEN is not set on the server.");
  return m;
}

async function graph(method: "GET" | "POST", pathname: string, params: Record<string, string> | FormData, token: string): Promise<any> {
  let url = pathname.startsWith("http") ? pathname : `${base()}/${pathname.replace(/^\//, "")}`;
  let init: RequestInit = { method };
  if (params instanceof FormData) {
    params.set("access_token", token);
    init.body = params;
  } else {
    const qs = new URLSearchParams({ ...params, access_token: token });
    if (method === "GET") url += (url.includes("?") ? "&" : "?") + qs;
    else init = { method, body: qs };
  }
  const res = await fetch(url, init);
  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  if (!res.ok || data?.error) {
    const e = data?.error ?? {};
    throw new MetaError(friendly(e.code, e.error_subcode, e.message ?? `HTTP ${res.status}`), e.code, e.error_subcode, e);
  }
  return data;
}

function friendly(code?: number, subcode?: number, message = "") {
  if (code === 190) return `Meta token is invalid or expired. Generate a new System User token. (${message})`;
  if (code === 10 || code === 200) return `Missing Meta permission. Check the token's permissions and App Review. (${message})`;
  if (code === 4 || code === 17 || code === 32 || code === 613) return `Meta rate limit reached - try again in an hour. (${message})`;
  if (subcode === 2207042) return `Instagram daily publishing limit reached - try tomorrow. (${message})`;
  return message;
}

let pageTokenCache: { token: string; at: number } | null = null;
async function pageToken(): Promise<string> {
  const m = requireMeta();
  if (pageTokenCache && Date.now() - pageTokenCache.at < 30 * 60_000) return pageTokenCache.token;
  try {
    const data = await graph("GET", m.pageId, { fields: "access_token" }, m.token);
    pageTokenCache = { token: data.access_token || m.token, at: Date.now() };
  } catch {
    pageTokenCache = { token: m.token, at: Date.now() }; // token may already be a Page token
  }
  return pageTokenCache.token;
}

export async function verifyConnection() {
  const m = requireMeta();
  const out: Record<string, unknown> = {};
  if (!m.pageId) throw new MetaError("META_PAGE_ID is not set.");
  const page = await graph("GET", m.pageId, { fields: "name,instagram_business_account{id,username}" }, m.token);
  out.facebook_page = page.name;
  out.instagram_linked_to_page = page.instagram_business_account?.username ?? null;
  if (m.igUserId) {
    const ig = await graph("GET", m.igUserId, { fields: "username" }, m.token);
    out.instagram_account = ig.username;
    try {
      const limit = await graph("GET", `${m.igUserId}/content_publishing_limit`, { fields: "quota_usage,config" }, m.token);
      out.instagram_posts_used_last_24h = limit.data?.[0]?.quota_usage;
    } catch {
      /* optional */
    }
  }
  return out;
}

export type Progress = (patch: Record<string, unknown>) => Promise<void>;
export type Published = { id: string; link: string };

// ---------------- Facebook ----------------

function jpegBlob(buf: Buffer) {
  return new Blob([new Uint8Array(buf)], { type: "image/jpeg" });
}

export async function facebookImage(filePath: string, caption: string): Promise<Published> {
  const m = requireMeta();
  const form = new FormData();
  form.set("source", jpegBlob(await fs.readFile(filePath)), "post.jpg");
  form.set("message", caption);
  const data = await graph("POST", `${m.pageId}/photos`, form, await pageToken());
  const id = data.post_id || data.id;
  return { id, link: `https://www.facebook.com/${id}` };
}

export async function facebookCarousel(filePaths: string[], caption: string, progress: Progress): Promise<Published> {
  const m = requireMeta();
  const token = await pageToken();
  const ids: string[] = [];
  for (const p of filePaths) {
    const form = new FormData();
    form.set("source", jpegBlob(await fs.readFile(p)), "slide.jpg");
    form.set("published", "false");
    ids.push((await graph("POST", `${m.pageId}/photos`, form, token)).id);
  }
  await progress({ uploaded_photo_ids: ids });
  const params: Record<string, string> = { message: caption };
  ids.forEach((id, i) => (params[`attached_media[${i}]`] = JSON.stringify({ media_fbid: id })));
  const data = await graph("POST", `${m.pageId}/feed`, params, token);
  return { id: data.id, link: `https://www.facebook.com/${data.id}` };
}

export async function facebookReel(filePath: string, caption: string, progress: Progress): Promise<Published> {
  const m = requireMeta();
  const token = await pageToken();
  const start = await graph("POST", `${m.pageId}/video_reels`, { upload_phase: "start" }, token);
  const videoId: string = start.video_id;
  await progress({ video_id: videoId });
  const bytes = await fs.readFile(filePath);
  const up = await fetch(start.upload_url, {
    method: "POST",
    headers: { Authorization: `OAuth ${token}`, offset: "0", file_size: String(bytes.length) },
    body: new Uint8Array(bytes),
  });
  if (!up.ok) throw new MetaError(`Facebook reel upload failed: ${await up.text()}`);
  await graph("POST", `${m.pageId}/video_reels`, { upload_phase: "finish", video_id: videoId, video_state: "PUBLISHED", description: caption }, token);
  for (let i = 0; i < 60; i++) {
    const s = (await graph("GET", videoId, { fields: "status" }, token)).status ?? {};
    if (s.video_status === "error" || s.processing_phase?.status === "error" || s.publishing_phase?.status === "error") {
      throw new MetaError(`Facebook reel processing failed: ${JSON.stringify(s)}`);
    }
    if (s.publishing_phase?.status === "complete" || s.video_status === "ready") break;
    await sleep(10_000);
  }
  const info = await graph("GET", videoId, { fields: "permalink_url" }, token).catch(() => ({}));
  const link = info.permalink_url ? (info.permalink_url.startsWith("http") ? info.permalink_url : `https://www.facebook.com${info.permalink_url}`) : `https://www.facebook.com/${videoId}`;
  return { id: videoId, link };
}

export async function facebookComment(postId: string, message: string) {
  await graph("POST", `${postId}/comments`, { message }, await pageToken());
}

// ---------------- Instagram ----------------

async function igWait(containerId: string, maxTries: number) {
  const m = requireMeta();
  for (let i = 0; i < maxTries; i++) {
    const s = await graph("GET", containerId, { fields: "status_code,status" }, m.token);
    if (s.status_code === "FINISHED") return;
    if (s.status_code === "ERROR" || s.status_code === "EXPIRED") throw new MetaError(`Instagram could not process the media: ${s.status ?? s.status_code}`);
    await sleep(i < 6 ? 3_000 : 10_000);
  }
  throw new MetaError("Instagram is taking too long to process the media.");
}

async function igCheckLimit() {
  const m = requireMeta();
  try {
    const d = await graph("GET", `${m.igUserId}/content_publishing_limit`, { fields: "quota_usage,config" }, m.token);
    const used = d.data?.[0]?.quota_usage, total = d.data?.[0]?.config?.quota_total;
    if (typeof used === "number" && typeof total === "number" && used >= total) throw new MetaError("Instagram daily publishing limit reached - try tomorrow.");
  } catch (e) {
    if (e instanceof MetaError && e.message.includes("daily publishing limit")) throw e;
  }
}

async function igPublish(creationId: string): Promise<Published> {
  const m = requireMeta();
  const pub = await graph("POST", `${m.igUserId}/media_publish`, { creation_id: creationId }, m.token);
  const info = await graph("GET", pub.id, { fields: "permalink" }, m.token).catch(() => ({}));
  return { id: pub.id, link: info.permalink ?? "" };
}

function requireIg() {
  const m = requireMeta();
  if (!m.igUserId) throw new MetaError("META_IG_USER_ID is not set.");
  return m;
}

export async function instagramImage(imageUrl: string, caption: string, progress: Progress): Promise<Published> {
  const m = requireIg();
  await igCheckLimit();
  const c = await graph("POST", `${m.igUserId}/media`, { image_url: imageUrl, caption }, m.token);
  await progress({ container_id: c.id });
  await igWait(c.id, 20);
  return igPublish(c.id);
}

export async function instagramCarousel(imageUrls: string[], caption: string, progress: Progress): Promise<Published> {
  const m = requireIg();
  await igCheckLimit();
  const children: string[] = [];
  for (const url of imageUrls) {
    const c = await graph("POST", `${m.igUserId}/media`, { image_url: url, is_carousel_item: "true" }, m.token);
    children.push(c.id);
  }
  for (const id of children) await igWait(id, 20);
  const c = await graph("POST", `${m.igUserId}/media`, { media_type: "CAROUSEL", children: children.join(","), caption }, m.token);
  await progress({ container_id: c.id });
  await igWait(c.id, 20);
  return igPublish(c.id);
}

export async function instagramReel(videoUrl: string, caption: string, coverUrl: string | undefined, progress: Progress): Promise<Published> {
  const m = requireIg();
  await igCheckLimit();
  const params: Record<string, string> = { media_type: "REELS", video_url: videoUrl, caption, share_to_feed: "true" };
  if (coverUrl) params.cover_url = coverUrl;
  const c = await graph("POST", `${m.igUserId}/media`, params, m.token);
  await progress({ container_id: c.id });
  await igWait(c.id, 70);
  return igPublish(c.id);
}

export async function instagramComment(mediaId: string, message: string) {
  const m = requireMeta();
  await graph("POST", `${mediaId}/comments`, { message }, m.token);
}
