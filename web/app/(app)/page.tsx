"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, upload, type Format, type Platform, type Post } from "@/lib/api";
import { Button, Card, ErrorBox, Label, PromptBox, SectionTitle, Select, Toggle } from "@/components/ui";

type Brand = { business_name: string; services: { name: string }[]; tones: { name: string }[] };

const FORMATS: { id: Format; icon: string; title: string; text: string }[] = [
  { id: "image", icon: "🖼️", title: "Image", text: "One branded picture" },
  { id: "carousel", icon: "🎠", title: "Carousel", text: "3–10 swipeable slides" },
  { id: "reel", icon: "🎬", title: "Reel", text: "Short vertical video" },
];

export default function NewPostPage() {
  const router = useRouter();
  const [brand, setBrand] = useState<Brand | null>(null);
  const [format, setFormat] = useState<Format>("image");
  const [platforms, setPlatforms] = useState<Platform[]>(["facebook", "instagram"]);
  const [service, setService] = useState("");
  const [tone, setTone] = useState("");
  const [slides, setSlides] = useState(5);
  const [seconds, setSeconds] = useState(20);
  const [p, setP] = useState({ topic: "", details: "", visual: "", caption: "", hashtags: "", script: "" });
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Brand>("settings/brand").then(setBrand).catch((e) => setError(e.message));
  }, []);

  const setPrompt = (k: keyof typeof p) => (v: string) => setP((x) => ({ ...x, [k]: v }));
  const togglePlatform = (pl: Platform, on: boolean) => setPlatforms(on ? [...new Set([...platforms, pl])] : platforms.filter((x) => x !== pl));

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
    if (!p.topic.trim()) return setError("Tell Claude what the post is about.");
    setBusy(true);
    setError(null);
    try {
      const post = await api<Post>("posts", {
        method: "POST",
        json: {
          format, platforms, service, tone, slides, reel_seconds: seconds, photo_urls: photos,
          topic: p.topic, details: p.details,
          visual_prompt: p.visual, caption_prompt: p.caption, hashtag_prompt: p.hashtags, script_prompt: p.script,
        },
      });
      router.push(`/posts/${post.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div>
        <p className="text-sm font-medium text-indigo-600">{brand?.business_name ?? " "}</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">What should we post today?</h1>
        <p className="mt-1 text-slate-500">Write to Claude in your own words — English, Urdu or Roman Urdu. Each box controls one part of the post.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card>
            <SectionTitle icon="①" title="Format and where to post" />
            <div className="grid gap-3 sm:grid-cols-3">
              {FORMATS.map((f) => (
                <button type="button" key={f.id} onClick={() => setFormat(f.id)} className={`rounded-2xl border p-4 text-left transition ${format === f.id ? "border-indigo-500 bg-indigo-50 ring-4 ring-indigo-100" : "border-slate-200 bg-white hover:border-slate-300"}`}>
                  <div className="text-2xl">{f.icon}</div>
                  <div className="mt-2 font-semibold text-slate-900">{f.title}</div>
                  <div className="text-xs text-slate-500">{f.text}</div>
                </button>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-end gap-4">
              <div>
                <Label>Post to</Label>
                <div className="flex gap-2">
                  <Toggle icon="📘" checked={platforms.includes("facebook")} onChange={(v) => togglePlatform("facebook", v)} label="Facebook" />
                  <Toggle icon="📸" checked={platforms.includes("instagram")} onChange={(v) => togglePlatform("instagram", v)} label="Instagram" />
                </div>
              </div>
              {format === "carousel" && (
                <div className="w-36">
                  <Label>Slides</Label>
                  <Select value={slides} onChange={(e) => setSlides(Number(e.target.value))}>
                    {[3, 4, 5, 6, 7, 8, 9, 10].map((n) => <option key={n} value={n}>{n} slides</option>)}
                  </Select>
                </div>
              )}
              {format === "reel" && (
                <div className="w-36">
                  <Label>Length</Label>
                  <Select value={seconds} onChange={(e) => setSeconds(Number(e.target.value))}>
                    {[15, 20, 30, 45, 60].map((s) => <option key={s} value={s}>{s} seconds</option>)}
                  </Select>
                </div>
              )}
            </div>
          </Card>

          <Card className="space-y-4">
            <SectionTitle icon="②" title="Tell Claude what to make" hint="Only the first box is required. Leave any box empty and Claude decides." />
            <div className="grid gap-3 sm:grid-cols-2">
              {!!brand?.services.length && (
                <div>
                  <Label>Service</Label>
                  <Select value={service} onChange={(e) => setService(e.target.value)}>
                    <option value="">Let Claude decide</option>
                    {brand.services.map((s) => <option key={s.name}>{s.name}</option>)}
                  </Select>
                </div>
              )}
              <div>
                <Label>Tone</Label>
                <Select value={tone} onChange={(e) => setTone(e.target.value)}>
                  <option value="">Let Claude decide</option>
                  {brand?.tones.map((t) => <option key={t.name}>{t.name}</option>)}
                </Select>
              </div>
            </div>
            <PromptBox label="What is the post about?" required rows={2} value={p.topic} onChange={setPrompt("topic")}
              placeholder="e.g. Turkey family tour — Istanbul and Cappadocia, 7 days"
              chips={["Family package", "Honeymoon special", "Umrah package", "Visa assistance"]} />
            <PromptBox label="Offer and details" hint="price, dates, what's included" value={p.details} onChange={setPrompt("details")}
              placeholder="e.g. PKR 2,45,000 per person, 15–22 March, flights + 4-star hotel + transfers, only 10 seats"
              chips={["Price per person", "Seats limited", "Booking deadline"]} />
            <PromptBox label="The picture" hint={photos.length ? "your photos will be used" : "Claude draws it"} value={p.visual} onChange={setPrompt("visual")}
              placeholder="e.g. hot air balloons over Cappadocia at sunrise, warm golden colours"
              chips={["Sunset colours", "Famous landmark", "Family enjoying the view", "Calm and elegant"]} />
            <PromptBox label="The caption" value={p.caption} onChange={setPrompt("caption")}
              placeholder="e.g. emotional and short, talk to parents, mention school holidays"
              chips={["Keep it short", "More emotional", "Add urgency", "Mention WhatsApp"]} />
            <PromptBox label="Hashtags" rows={2} value={p.hashtags} onChange={setPrompt("hashtags")}
              placeholder="e.g. focus on family travel and Pakistan, add #Turkey2027"
              chips={["Family travel tags", "Destination tags", "Pakistan travel tags"]} />
            {format === "reel" && (
              <PromptBox label="Reel script and scenes" value={p.script} onChange={setPrompt("script")}
                placeholder="e.g. start with a question hook, show 4 places, end with the price and WhatsApp"
                chips={["Question hook", "Show 4 places", "End with price"]} />
            )}
          </Card>

          <Card>
            <SectionTitle icon="③" title="Your own photos (optional)" hint="Leave empty and Claude draws the background for you." />
            <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-4 py-6 text-center transition hover:border-indigo-300 hover:bg-indigo-50/40">
              <span className="text-2xl">📷</span>
              <span className="text-sm font-medium text-slate-700">{uploading ? "Uploading…" : "Click to add photos"}</span>
              <span className="text-xs text-slate-400">JPG or PNG, up to 10</span>
              <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => addPhotos(e.target.files)} disabled={uploading} />
            </label>
            {!!photos.length && (
              <div className="mt-3 flex flex-wrap gap-2">
                {photos.map((u) => (
                  <button type="button" key={u} onClick={() => setPhotos(photos.filter((x) => x !== u))} title="Remove" className="group relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={u} alt="" className="h-20 w-20 rounded-xl object-cover ring-1 ring-slate-200" />
                    <span className="absolute -right-1.5 -top-1.5 hidden h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-xs text-white group-hover:flex">×</span>
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <Card className="space-y-4">
            <h3 className="font-semibold text-slate-900">Claude will</h3>
            <ul className="space-y-2.5 text-sm text-slate-600">
              {[
                "Read every box and your brand guide",
                photos.length ? "Use your photos as the background" : "Draw the background picture",
                format === "reel" ? "Write the scenes and build the reel" : format === "carousel" ? `Write and design ${slides} slides` : "Design the branded image",
                "Write Facebook and Instagram captions",
                "Check facts, prices and wording",
              ].map((t) => (
                <li key={t} className="flex gap-2"><span className="text-indigo-500">✓</span>{t}</li>
              ))}
            </ul>
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">Nothing is posted until you check the preview and press Post.</p>
            <ErrorBox message={error} />
            <Button disabled={busy || uploading} className="w-full py-3 text-base">
              {busy ? "Starting…" : "✦ Create with Claude"}
            </Button>
          </Card>
        </div>
      </div>
    </form>
  );
}
