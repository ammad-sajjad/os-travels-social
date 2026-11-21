import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { config } from "./config.js";

export type StoredFile = { name: string; path: string; url: string };

/** Files get long random names, so public links can't be guessed (Instagram needs public links). */
export async function saveFile(data: Buffer, ext: string): Promise<StoredFile> {
  const name = `${crypto.randomBytes(16).toString("hex")}.${ext.replace(/^\./, "")}`;
  const filePath = path.join(config.mediaDir, name);
  await fs.writeFile(filePath, data);
  return { name, path: filePath, url: `${config.publicUrl}/media/${name}` };
}

export function localPathForUrl(url: string): string | null {
  const m = url.match(/\/media\/([a-f0-9]{32}\.[a-z0-9]+)$/i);
  return m ? path.join(config.mediaDir, m[1]) : null;
}

/** Read an image from our own media folder or download it from the web. */
export async function loadImage(url: string): Promise<Buffer> {
  const local = localPathForUrl(url);
  if (local) return fs.readFile(local);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not download image (${res.status}): ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

export function mediaPath(name: string) {
  if (!/^[a-f0-9]{32}\.[a-z0-9]+$/i.test(name)) return null;
  return path.join(config.mediaDir, name);
}
