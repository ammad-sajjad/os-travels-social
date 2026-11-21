import { config } from "./config.js";

/** Find a stock photo on Pexels (free API key). Returns null if none or no key. */
export async function findPhoto(search: string, orientation: "portrait" | "landscape" = "portrait"): Promise<{ url: string; credit: string } | null> {
  if (!config.pexelsKey || !search.trim()) return null;
  const q = new URLSearchParams({ query: search, orientation, per_page: "5" });
  const res = await fetch(`https://api.pexels.com/v1/search?${q}`, { headers: { Authorization: config.pexelsKey } });
  if (!res.ok) {
    console.warn(`Pexels search failed (${res.status}) for "${search}"`);
    return null;
  }
  const data = (await res.json()) as { photos?: { src: Record<string, string>; photographer: string; url: string }[] };
  const photo = data.photos?.[0];
  if (!photo) return null;
  return { url: photo.src.large2x || photo.src.original, credit: `Photo by ${photo.photographer} on Pexels (${photo.url})` };
}
