"use client";

export type Platform = "facebook" | "instagram";
export type Format = "image" | "carousel" | "reel";

export type Content = {
  hook: string;
  headline: string;
  points: string[];
  price_badge: string | null;
  cta: string;
  image_search: string;
  slides: { headline: string; text: string; image_search: string }[];
  scenes: { on_screen: string; image_search: string; seconds: number }[];
  caption_instagram: string;
  caption_facebook: string;
  hashtags: string[];
  first_comment: string | null;
};

export type Post = {
  id: string;
  created_at: string;
  source: "manual" | "autopilot";
  status: "generating" | "ready" | "scheduled" | "publishing" | "published" | "partial" | "failed";
  brief: { format: Format; topic: string; service: string; price: string; dates: string; details: string; tone: string; platforms: Platform[] };
  content: Content | null;
  media: { kind: "image" | "video" | "cover" | "source"; url: string; credit?: string }[];
  check_report: { result: "pass" | "fail"; checks: { name: string; status: "pass" | "fail" | "warn"; reason: string; fix: string | null }[] } | null;
  platforms: Platform[];
  publish_at: string | null;
  results: Record<string, { status: string; link?: string; error?: string }>;
  error: string | null;
};

export async function api<T = unknown>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  const res = await fetch(`/api/${path.replace(/^\//, "")}`, {
    ...rest,
    headers: json !== undefined ? { "content-type": "application/json", ...(rest.headers ?? {}) } : rest.headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && typeof window !== "undefined") window.location.assign("/login");
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as T;
}

/** Shrink photos in the browser before upload (Vercel limits request bodies to ~4.5 MB). */
async function shrink(file: File, maxSide = 2000): Promise<Blob> {
  if (!file.type.startsWith("image/") || file.type === "image/png") return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", 0.9));
}

export async function upload(file: File, kind: "photo" | "logo" = "photo"): Promise<string> {
  const blob = kind === "logo" ? file : await shrink(file);
  if (blob.size > 4_200_000) throw new Error("Image is too large. Please use one under 4 MB.");
  const form = new FormData();
  form.set("file", blob, kind === "logo" ? "logo.png" : "photo.jpg");
  const { url } = await api<{ url: string }>(`uploads?kind=${kind}`, { method: "POST", body: form });
  return url;
}

export const statusLabel: Record<Post["status"], string> = {
  generating: "Creating…",
  ready: "Ready to post",
  scheduled: "Scheduled",
  publishing: "Posting…",
  published: "Posted",
  partial: "Partly posted",
  failed: "Failed",
};

export const statusColor: Record<Post["status"], string> = {
  generating: "bg-indigo-100 text-indigo-800",
  ready: "bg-amber-100 text-amber-800",
  scheduled: "bg-violet-100 text-violet-800",
  publishing: "bg-indigo-100 text-indigo-800",
  published: "bg-emerald-100 text-emerald-800",
  partial: "bg-orange-100 text-orange-800",
  failed: "bg-red-100 text-red-800",
};
