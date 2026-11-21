"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, upload, type Format, type Platform, type Post } from "@/lib/api";
import { Arrow, Card, ErrorBox, Eyebrow, Label, PromptBox, SectionTitle, Select, Toggle } from "@/components/ui";

type Brand = { business_name: string; services: { name: string }[]; tones: { name: string }[] };

const FORMATS: { id: Format; code: string; title: string; text: string; icon: string }[] = [
  { id: "image", code: "IMG", title: "Single image", text: "One branded picture", icon: "▢" },
  { id: "carousel", code: "CRS", title: "Carousel", text: "3–10 swipeable slides", icon: "▤" },
  { id: "reel", code: "REL", title: "Reel", text: "Short vertical video", icon: "▶" },
];

const ROUTES = ["KHI → IST", "LHE → KUL", "ISB → DXB", "KHI → JED", "LHE → BKK", "ISB → GYD", "KHI → MLE", "LHE → TBS", "ISB → ICN", "KHI → SIN"];

function Ticker() {
  const items = [...ROUTES, ...ROUTES];
  return (
    <div className="relative overflow-hidden rounded-full bg-ink py-2 text-paper">
      <div className="flex w-max animate-marquee gap-10 whitespace-nowrap px-6 font-mono text-xs tracking-[0.2em]">
        {items.map((r, i) => (
          <span key={i} className="flex items-center gap-3">
            <span className="text-gold">●</span>{r}<span className="text-paper/40">ON TIME</span>
          </span>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-ink to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-ink to-transparent" />
    </div>
  );
}

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
  const [link, setLink] = useState("");
  const [useLinkImage, setUseLinkImage] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [macOffline, setMacOffline] = useState(false);

  useEffect(() => {
    api<Brand>("settings/brand").then(setBrand).catch((e) => setError(e.message));
    const check = () => api<{ claude_mode: string; helper: { connected: boolean } }>("status")
      .then((s) => setMacOffline(s.claude_mode === "local" && !s.helper.connected)).catch(() => {});
    check();
    const t = setInterval(check, 10_000);
    return () => clearInterval(t);
  }, []);

  const setPrompt = (k: keyof typeof p) => (v: string) => setP((x) => ({ ...x, [k]: v }));
  const togglePlatform = (pl: Platform, on: boolean) => setPlatforms(on ? [...new Set([...platforms, pl])] : platforms.filter((x) => x !== pl));
  const fmt = FORMATS.find((f) => f.id === format)!;

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
          topic: p.topic, details: p.details, link_url: link.trim(), use_link_image: useLinkImage && !!link.trim(),
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
    <form onSubmit={submit} className="stagger space-y-8">
      <section className="relative">
        <Eyebrow>{brand?.business_name ?? "Your brand"} · Content desk</Eyebrow>
        <h1 className="mt-3 max-w-3xl font-display text-5xl leading-[1.02] text-ink sm:text-7xl">
          Where are we <em className="text-sunset">flying</em> today?
        </h1>
        <p className="mt-4 max-w-xl text-[15px] text-muted">
          Brief Claude like you&apos;d brief your best marketer — in English, Urdu or Roman Urdu. Every box below steers one part of the post.
        </p>
        <span className="pointer-events-none absolute -top-4 right-4 hidden animate-float select-none font-display text-[140px] leading-none text-sand lg:block">✈</span>
      </section>

      <Ticker />

      <div className="grid gap-8 lg:grid-cols-[1fr_330px]">
        <div className="stagger space-y-8">
          <Card>
            <SectionTitle no="01" title="Choose your flight" hint="What kind of post, and where it lands." />
            <div className="grid gap-3 sm:grid-cols-3">
              {FORMATS.map((f) => {
                const on = format === f.id;
                return (
                  <button type="button" key={f.id} onClick={() => setFormat(f.id)}
                    className={`ticket group relative overflow-hidden rounded-2xl border p-4 text-left transition-all duration-300 ${on ? "-translate-y-1 border-ink bg-ink text-paper shadow-[0_18px_30px_-18px_rgba(18,33,59,0.8)]" : "border-line bg-white/60 hover:-translate-y-0.5 hover:border-ink/40"}`}>
                    <div className="flex items-center justify-between font-mono text-[10px] tracking-[0.2em]">
                      <span className={on ? "text-gold" : "text-muted"}>{f.code}</span>
                      <span className={`text-lg transition-transform duration-500 group-hover:rotate-12 ${on ? "text-sunset-2" : "text-muted"}`}>{f.icon}</span>
                    </div>
                    <div className="mt-6 font-display text-2xl leading-none">{f.title}</div>
                    <div className={`mt-1 text-xs ${on ? "text-paper/60" : "text-muted"}`}>{f.text}</div>
                  </button>
                );
              })}
            </div>
            <div className="mt-6 flex flex-wrap items-end gap-6">
              <div>
                <Label>Destination</Label>
                <div className="flex gap-2">
                  <Toggle checked={platforms.includes("facebook")} onChange={(v) => togglePlatform("facebook", v)} label="Facebook" />
                  <Toggle checked={platforms.includes("instagram")} onChange={(v) => togglePlatform("instagram", v)} label="Instagram" />
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
            <SectionTitle no="02" title="Brief Claude" hint="Only the first box is required — leave the rest empty and Claude decides." />
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
            <PromptBox no="A" label="What is the post about?" required rows={2} value={p.topic} onChange={setPrompt("topic")}
              placeholder="Turkey family tour — Istanbul and Cappadocia, 7 days"
              chips={["Family package", "Honeymoon special", "Umrah package", "Visa assistance"]} />
            <PromptBox no="B" label="Offer & details" hint="price · dates · inclusions" value={p.details} onChange={setPrompt("details")}
              placeholder="PKR 2,45,000 per person, 15–22 March, flights + 4-star hotel + transfers, only 10 seats"
              chips={["Price per person", "Seats limited", "Booking deadline"]} />

            <div className="group relative rounded-2xl border border-line bg-white/60 p-4 pl-5 transition-all duration-300 focus-within:-translate-y-0.5 focus-within:border-ink/50 focus-within:bg-white">
              <span className="absolute bottom-4 left-0 top-4 w-[3px] rounded-full bg-line transition-colors group-focus-within:bg-sea" />
              <div className="mb-1 flex flex-wrap items-baseline gap-x-3">
                <span className="font-mono text-[11px] text-sea">C</span>
                <span className="font-display text-xl text-ink">Link to a web page</span>
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted">optional</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-sea">↗</span>
                <input type="text" inputMode="url" value={link} onChange={(e) => setLink(e.target.value)}
                  placeholder="yoursite.com/malaysia-tour — or a whole site like bookmyflight.com"
                  className="w-full bg-transparent py-1 text-[15px] text-ink outline-none placeholder:text-muted/50" />
              </div>
              <p className="mt-2 text-xs text-muted">Claude reads the page (or finds the right page on the site for your topic) and puts the link in the post.</p>
              {link.trim() && !photos.length && (
                <label className="mt-2 flex items-center gap-2 text-xs text-muted">
                  <input type="checkbox" checked={useLinkImage} onChange={(e) => setUseLinkImage(e.target.checked)} />
                  Use the page&apos;s main picture as the background (only if you have the right to use it)
                </label>
              )}
            </div>

            <PromptBox no="D" label="The picture" hint={photos.length ? "your photos will be used" : "Claude draws it"} value={p.visual} onChange={setPrompt("visual")}
              placeholder="Hot air balloons over Cappadocia at sunrise, warm golden colours"
              chips={["Sunset colours", "Famous landmark", "Family enjoying the view", "Calm and elegant"]} />
            <PromptBox no="E" label="The caption" value={p.caption} onChange={setPrompt("caption")}
              placeholder="Emotional and short, talk to parents, mention school holidays"
              chips={["Keep it short", "More emotional", "Add urgency", "Mention WhatsApp"]} />
            <PromptBox no="F" label="Hashtags" rows={2} value={p.hashtags} onChange={setPrompt("hashtags")}
              placeholder="Focus on family travel and Pakistan, add #Turkey2027"
              chips={["Family travel tags", "Destination tags", "Pakistan travel tags"]} />
            {format === "reel" && (
              <PromptBox no="G" label="Reel script & scenes" value={p.script} onChange={setPrompt("script")}
                placeholder="Start with a question hook, show 4 places, end with the price and WhatsApp"
                chips={["Question hook", "Show 4 places", "End with price"]} />
            )}
          </Card>

          <Card>
            <SectionTitle no="03" title="Your own photos" hint="Optional — leave empty and Claude draws the background." />
            <label className="group flex cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-line bg-white/40 px-4 py-8 text-center transition hover:border-sunset hover:bg-white">
              <span className="text-3xl transition-transform duration-500 group-hover:-translate-y-1 group-hover:rotate-6">📷</span>
              <span className="font-display text-xl text-ink">{uploading ? "Uploading…" : "Drop in your photos"}</span>
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted">JPG or PNG · up to 10</span>
              <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => addPhotos(e.target.files)} disabled={uploading} />
            </label>
            {!!photos.length && (
              <div className="mt-4 flex flex-wrap gap-3">
                {photos.map((u, i) => (
                  <button type="button" key={u} onClick={() => setPhotos(photos.filter((x) => x !== u))} title="Remove"
                    className="group relative bg-white p-1.5 pb-5 shadow-md transition hover:rotate-0" style={{ transform: `rotate(${(i % 2 ? 3 : -3)}deg)` }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={u} alt="" className="h-20 w-20 object-cover" />
                    <span className="absolute -right-2 -top-2 hidden h-5 w-5 items-center justify-center rounded-full bg-sunset text-xs text-white group-hover:flex">×</span>
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Boarding pass summary */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="ticket overflow-hidden rounded-[22px] bg-ink text-paper shadow-[0_30px_50px_-28px_rgba(18,33,59,0.9)]">
            <div className="p-6">
              <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.25em] text-paper/50">
                <span>Boarding pass</span><span className="text-gold">{fmt.code}</span>
              </div>
              <div className="mt-5 flex items-end justify-between">
                <div>
                  <p className="font-mono text-[10px] tracking-widest text-paper/50">FROM</p>
                  <p className="font-display text-4xl leading-none">Idea</p>
                </div>
                <span className="mb-1 text-gold">- - ✈ - -</span>
                <div className="text-right">
                  <p className="font-mono text-[10px] tracking-widest text-paper/50">TO</p>
                  <p className="font-display text-4xl leading-none text-sunset-2">Post</p>
                </div>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-4 font-mono text-[11px]">
                <div><p className="text-paper/40">FORMAT</p><p className="mt-0.5">{fmt.title}{format === "carousel" ? ` · ${slides}` : format === "reel" ? ` · ${seconds}s` : ""}</p></div>
                <div><p className="text-paper/40">GATE</p><p className="mt-0.5">{platforms.length ? platforms.map((x) => (x === "facebook" ? "FB" : "IG")).join(" + ") : "—"}</p></div>
                <div><p className="text-paper/40">PICTURE</p><p className="mt-0.5">{photos.length ? `${photos.length} photo${photos.length > 1 ? "s" : ""}` : "Drawn by Claude"}</p></div>
                <div><p className="text-paper/40">LINK</p><p className="mt-0.5 truncate">{link.trim() || "—"}</p></div>
              </div>
            </div>
            <div className="perforation mx-5 opacity-40" />
            <div className="space-y-4 p-6">
              <ul className="space-y-2 text-sm text-paper/80">
                {["Reads your brief and brand guide", ...(link.trim() ? ["Opens your link and adds it"] : []), photos.length ? "Uses your photos" : "Draws the background", "Writes FB + IG captions", "Fact-checks prices and wording"].map((t) => (
                  <li key={t} className="flex gap-2"><span className="text-gold">✓</span>{t}</li>
                ))}
              </ul>
              {macOffline && <p className="rounded-xl bg-sunset/20 px-3 py-2 text-xs text-paper">Claude on your Mac isn&apos;t connected. Keep the Mac on, awake and online.</p>}
              <ErrorBox message={error} />
              <button disabled={busy || uploading || macOffline}
                className="group relative w-full overflow-hidden rounded-full bg-sunset py-3.5 text-base font-semibold text-white transition hover:bg-sunset-2 disabled:opacity-50">
                <span className="relative z-10 inline-flex items-center gap-2">{busy ? "Checking in…" : <>Print boarding pass <Arrow /></>}</span>
              </button>
              <p className="text-center font-mono text-[10px] uppercase tracking-widest text-paper/40">Nothing posts until you approve</p>
              <div className="flex h-10 items-end justify-center gap-[3px] opacity-60" aria-hidden>
                {Array.from({ length: 42 }, (_, i) => <span key={i} className="bg-paper" style={{ width: (i * 7) % 3 === 0 ? 3 : 1.5, height: 18 + ((i * 13) % 22) }} />)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
