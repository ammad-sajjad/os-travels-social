"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, upload, type Format, type Platform, type Post } from "@/lib/api";
import { Button, Card, ErrorBox, Input, Label, Select, Textarea, Toggle } from "@/components/ui";

type Brand = { business_name: string; services: { name: string }[]; tones: { name: string }[] };

export default function NewPostPage() {
  const router = useRouter();
  const [brand, setBrand] = useState<Brand | null>(null);
  const [format, setFormat] = useState<Format>("image");
  const [platforms, setPlatforms] = useState<Platform[]>(["facebook", "instagram"]);
  const [form, setForm] = useState({ service: "", topic: "", price: "", dates: "", details: "", tone: "", own_caption: "", own_hashtags: "" });
  const [slides, setSlides] = useState(5);
  const [seconds, setSeconds] = useState(20);
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Brand>("settings/brand").then(setBrand).catch((e) => setError(e.message));
  }, []);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });
  const togglePlatform = (p: Platform, on: boolean) => setPlatforms(on ? [...new Set([...platforms, p])] : platforms.filter((x) => x !== p));

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setError(null);
    try {
      const urls: string[] = [];
      for (const f of Array.from(files).slice(0, 10)) urls.push(await upload(f));
      setPhotos([...photos, ...urls].slice(0, 10));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!platforms.length) return setError("Choose Facebook, Instagram or both.");
    setBusy(true);
    setError(null);
    try {
      const post = await api<Post>("posts", {
        method: "POST",
        json: { ...form, format, platforms, slides, reel_seconds: seconds, photo_urls: photos },
      });
      router.push(`/posts/${post.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">New post</h1>
        <p className="text-sm text-slate-500">Fill in what you want to promote. Claude writes it, you check the preview, then post.</p>
      </div>

      <Card className="space-y-4">
        <div>
          <Label>What kind of post?</Label>
          <div className="flex flex-wrap gap-2">
            <Toggle checked={format === "image"} onChange={() => setFormat("image")} label="Single image" />
            <Toggle checked={format === "carousel"} onChange={() => setFormat("carousel")} label="Carousel (swipe)" />
            <Toggle checked={format === "reel"} onChange={() => setFormat("reel")} label="Reel (video)" />
          </div>
          {format === "carousel" && (
            <div className="mt-3 w-40">
              <Label>Number of slides</Label>
              <Input type="number" min={3} max={10} value={slides} onChange={(e) => setSlides(Number(e.target.value))} />
            </div>
          )}
          {format === "reel" && (
            <div className="mt-3 w-40">
              <Label>Length (seconds)</Label>
              <Select value={seconds} onChange={(e) => setSeconds(Number(e.target.value))}>
                {[15, 20, 30, 45, 60].map((s) => <option key={s} value={s}>{s} s</option>)}
              </Select>
            </div>
          )}
        </div>
        <div>
          <Label>Post to</Label>
          <div className="flex flex-wrap gap-2">
            <Toggle checked={platforms.includes("facebook")} onChange={(v) => togglePlatform("facebook", v)} label="Facebook" />
            <Toggle checked={platforms.includes("instagram")} onChange={(v) => togglePlatform("instagram", v)} label="Instagram" />
          </div>
        </div>
      </Card>

      <Card className="grid gap-4 sm:grid-cols-2">
        {!!brand?.services.length && (
          <div>
            <Label>Service</Label>
            <Select value={form.service} onChange={set("service")}>
              <option value="">— choose —</option>
              {brand.services.map((s) => <option key={s.name}>{s.name}</option>)}
            </Select>
          </div>
        )}
        <div className={brand?.services.length ? "" : "sm:col-span-2"}>
          <Label>What is it about?</Label>
          <Input required placeholder="e.g. Turkey family tour, Istanbul + Cappadocia" value={form.topic} onChange={set("topic")} />
        </div>
        <div>
          <Label hint="(optional)">Price</Label>
          <Input placeholder="e.g. PKR 2,45,000 per person" value={form.price} onChange={set("price")} />
        </div>
        <div>
          <Label hint="(optional)">Dates</Label>
          <Input placeholder="e.g. 15 to 22 March" value={form.dates} onChange={set("dates")} />
        </div>
        <div className="sm:col-span-2">
          <Label hint="(optional) what's included, seats left, deadline…">Other details</Label>
          <Textarea rows={3} value={form.details} onChange={set("details")} />
        </div>
        <div>
          <Label>Tone</Label>
          <Select value={form.tone} onChange={set("tone")}>
            <option value="">Let Claude choose</option>
            {brand?.tones.map((t) => <option key={t.name}>{t.name}</option>)}
          </Select>
        </div>
        <div>
          <Label hint="(optional) otherwise stock photos are used">Your own photos</Label>
          <Input type="file" accept="image/*" multiple onChange={(e) => addPhotos(e.target.files)} disabled={uploading} />
          {uploading && <p className="mt-1 text-xs text-slate-500">Uploading…</p>}
          {!!photos.length && (
            <div className="mt-2 flex flex-wrap gap-2">
              {photos.map((u) => (
                <button type="button" key={u} onClick={() => setPhotos(photos.filter((p) => p !== u))} title="Remove">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={u} alt="" className="h-16 w-16 rounded-lg object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      </Card>

      <Card className="space-y-4">
        <details>
          <summary className="cursor-pointer text-sm font-medium text-slate-700">Use my own caption or hashtags (optional)</summary>
          <div className="mt-3 space-y-3">
            <div>
              <Label hint="Claude keeps your words and only adds what's missing">Caption</Label>
              <Textarea rows={4} value={form.own_caption} onChange={set("own_caption")} />
            </div>
            <div>
              <Label>Hashtags</Label>
              <Input value={form.own_hashtags} onChange={set("own_hashtags")} placeholder="#TurkeyTour #FamilyTrip" />
            </div>
          </div>
        </details>
      </Card>

      <ErrorBox message={error} />
      <Button disabled={busy || uploading} className="w-full py-3 text-base sm:w-auto">
        {busy ? "Starting…" : "Create post"}
      </Button>
    </form>
  );
}
