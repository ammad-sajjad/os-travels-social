import { Hono } from "hono";
import { serve } from "@hono/node-server";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { z } from "zod";
import { config, keyStatus } from "./config.js";
import { migrate } from "./db.js";
import { getSetting, setSetting } from "./settings.js";
import { presets } from "./presets.js";
import { mediaPath, saveFile } from "./storage.js";
import { verifyConnection } from "./meta.js";
import * as posts from "./posts.js";

const app = new Hono();

app.onError((err, c) => {
  console.error(err);
  const status = err instanceof z.ZodError ? 400 : 500;
  const message = err instanceof z.ZodError ? err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") : err.message;
  return c.json({ error: message }, status);
});

app.get("/health", (c) => c.json({ ok: true }));

const TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", mp4: "video/mp4" };
app.get("/media/:name", async (c) => {
  const p = mediaPath(c.req.param("name"));
  if (!p) return c.notFound();
  try {
    const data = await fs.readFile(p);
    return c.body(new Uint8Array(data), 200, {
      "Content-Type": TYPES[path.extname(p).slice(1)] ?? "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
    });
  } catch {
    return c.notFound();
  }
});

// Everything under /api needs the shared secret that only the website knows.
app.use("/api/*", async (c, next) => {
  if (!config.apiKey) {
    if (process.env.NODE_ENV === "production") return c.json({ error: "SERVER_API_KEY is not set on the server." }, 500);
  } else if (c.req.header("x-api-key") !== config.apiKey) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  await next();
});

app.get("/api/status", (c) => c.json(keyStatus()));
app.post("/api/meta/test", async (c) => {
  try {
    return c.json({ ok: true, ...(await verifyConnection()) });
  } catch (e) {
    return c.json({ ok: false, error: (e as Error).message }, 200);
  }
});

app.get("/api/settings/:key{brand|autopilot}", async (c) => c.json(await getSetting(c.req.param("key") as "brand" | "autopilot")));
app.put("/api/settings/:key{brand|autopilot}", async (c) => c.json(await setSetting(c.req.param("key") as "brand" | "autopilot", await c.req.json())));

app.get("/api/presets", (c) => c.json(Object.entries(presets).map(([id, p]) => ({ id, label: p.label }))));
app.post("/api/presets/:id/apply", async (c) => {
  const p = presets[c.req.param("id")];
  if (!p) return c.json({ error: "Unknown preset" }, 404);
  const current = await getSetting("brand");
  return c.json(await setSetting("brand", { ...current, ...p.brand, logo_url: current.logo_url, contact: { ...current.contact, ...(p.brand.contact ?? {}) } }));
});

app.post("/api/uploads", async (c) => {
  const body = await c.req.parseBody();
  const file = body.file;
  if (!(file instanceof File)) return c.json({ error: "No file uploaded" }, 400);
  if (file.size > 20 * 1024 * 1024) return c.json({ error: "File too large (max 20 MB)" }, 400);
  const buf = Buffer.from(await file.arrayBuffer());
  const kind = c.req.query("kind");
  try {
    // Normalise: logos stay PNG (keep transparency), photos become JPG.
    const out = kind === "logo"
      ? await saveFile(await sharp(buf).png().toBuffer(), "png")
      : await saveFile(await sharp(buf).rotate().resize({ width: 2160, withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer(), "jpg");
    return c.json({ url: out.url });
  } catch {
    return c.json({ error: "That file is not a supported image." }, 400);
  }
});

app.get("/api/posts", async (c) => c.json(await posts.listPosts(Number(c.req.query("limit") ?? 50))));
app.post("/api/posts", async (c) => c.json(await posts.createPost(await c.req.json()), 201));
app.get("/api/posts/:id", async (c) => {
  const p = await posts.getPost(c.req.param("id"));
  return p ? c.json(p) : c.json({ error: "Not found" }, 404);
});
app.patch("/api/posts/:id", async (c) => c.json(await posts.editPost(c.req.param("id"), await c.req.json())));
app.post("/api/posts/:id/regenerate", async (c) => {
  void posts.generate(c.req.param("id"));
  return c.json({ ok: true });
});
app.post("/api/posts/:id/publish", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  return c.json(await posts.schedule(c.req.param("id"), body.publish_at));
});
app.post("/api/posts/:id/unschedule", async (c) => c.json(await posts.unschedule(c.req.param("id"))));
app.delete("/api/posts/:id", async (c) => {
  await posts.deletePost(c.req.param("id"));
  return c.json({ ok: true });
});

await migrate();
await posts.recoverInterrupted();
posts.startScheduler();
serve({ fetch: app.fetch, port: config.port }, () => {
  console.log(`Server running on port ${config.port} (public URL: ${config.publicUrl})`);
  if (!config.apiKey) console.warn("WARNING: SERVER_API_KEY is not set - the API is open. Set it before deploying.");
});
