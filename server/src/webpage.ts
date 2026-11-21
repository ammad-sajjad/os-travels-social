// Reads a public web page the owner pasted into the form: title, description, main image, text and links.
// Guards against fetching private/internal addresses (SSRF), and limits size and time.
import dns from "node:dns/promises";
import net from "node:net";

export type PageInfo = {
  url: string;
  title: string;
  description: string;
  image: string | null;
  text: string;
  links: { url: string; text: string }[];
};

const MAX_BYTES = 2_000_000;
const UA = "Mozilla/5.0 (compatible; SocialAutopilot/1.0; +https://os-travels-social.vercel.app/privacy)";

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v = ip.toLowerCase();
  if (v.startsWith("::ffff:")) return isPrivateIp(v.slice(7));
  return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80");
}

export async function assertPublic(url: URL) {
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Only http and https links are supported.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (/(^localhost$|\.local$|\.internal$|\.localhost$)/i.test(host)) throw new Error("That link points to a private address.");
  const addrs = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true }).catch(() => []);
  if (!addrs.length) throw new Error(`Couldn't find the website ${host}.`);
  if (addrs.some((a) => isPrivateIp(a.address))) throw new Error("That link points to a private address.");
}

/** Normalise what the owner typed: "bookmyflight.com" -> "https://bookmyflight.com/". */
export function normaliseUrl(input: string): URL {
  const s = input.trim();
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(s) && !/^https?:\/\//i.test(s)) throw new Error("Only http and https links are supported.");
  try {
    return new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
  } catch {
    throw new Error("That doesn't look like a web address.");
  }
}

async function fetchHtml(start: URL): Promise<{ url: URL; html: string }> {
  let url = start;
  for (let hop = 0; hop < 4; hop++) {
    await assertPublic(url);
    const res = await fetch(url, {
      redirect: "manual",
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
      signal: AbortSignal.timeout(12_000),
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = new URL(res.headers.get("location")!, url);
      continue;
    }
    if (!res.ok) throw new Error(`The page answered with error ${res.status}.`);
    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("html")) throw new Error("That link is not a web page.");
    const reader = res.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      chunks.push(value);
      if (size > MAX_BYTES) {
        await reader.cancel();
        break;
      }
    }
    return { url, html: Buffer.concat(chunks).toString("utf8") };
  }
  throw new Error("The link redirects too many times.");
}

const decode = (s: string) =>
  s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));

function meta(html: string, name: string): string {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]*>`, "i");
  const tag = html.match(re)?.[0];
  return tag ? decode(tag.match(/content=["']([^"']*)["']/i)?.[1] ?? "").trim() : "";
}

export async function readPage(input: string | URL): Promise<PageInfo> {
  const { url, html } = await fetchHtml(typeof input === "string" ? normaliseUrl(input) : input);
  const title = decode(meta(html, "og:title") || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").replace(/\s+/g, " ").trim();
  const description = meta(html, "og:description") || meta(html, "description");
  const img = meta(html, "og:image");
  let image: string | null = null;
  try {
    image = img ? new URL(img, url).toString() : null;
  } catch {
    image = null;
  }

  const links: PageInfo["links"] = [];
  const seen = new Set<string>();
  for (const m of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    try {
      const href = new URL(decode(m[1]), url);
      if (!["http:", "https:"].includes(href.protocol) || href.hostname !== url.hostname) continue;
      href.hash = "";
      const key = href.toString();
      const text = decode(m[2].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim().slice(0, 80);
      if (seen.has(key) || (!text && !/[a-z]{3,}/i.test(href.pathname))) continue;
      seen.add(key);
      links.push({ url: key, text });
      if (links.length >= 250) break;
    } catch {
      /* ignore bad hrefs */
    }
  }

  const text = decode(
    html
      .replace(/<(script|style|noscript|svg|nav|footer|header)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>|<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim()
    .slice(0, 8000);

  return { url: url.toString(), title, description, image, text, links };
}
