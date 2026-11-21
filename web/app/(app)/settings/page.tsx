"use client";
import { useEffect, useState } from "react";
import { api, upload } from "@/lib/api";
import { Button, Card, ErrorBox, Input, Label, Select, Textarea, Toggle } from "@/components/ui";

type NamedGuide = { name: string; guidance: string };
type Brand = {
  business_name: string; short_name: string; industry: "travel" | "general"; description: string; audience: string; language: string;
  personality: string[]; tones: NamedGuide[]; services: NamedGuide[]; cta_default: string; cta_options: string[];
  contact: { phone: string; whatsapp: string; website: string; address: string; licence: string };
  good_words: string[]; always: string[]; never: string[]; brand_hashtags: string[]; hashtag_guidance: string;
  emoji_guidance: string; number_format: string; extra_guidelines: string;
  colors: { primary: string; accent: string; text: string }; logo_url: string;
};
type Autopilot = { enabled: boolean; time: string; platforms: ("facebook" | "instagram")[]; format: "image" | "carousel" | "reel"; topics: string[]; require_quality_pass: boolean };

const lines = (a: string[]) => a.join("\n");
const unlines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);
const guides = (a: NamedGuide[]) => a.map((g) => `${g.name}: ${g.guidance}`).join("\n");
const unguides = (s: string): NamedGuide[] =>
  unlines(s).map((l) => {
    const i = l.indexOf(":");
    return i > 0 ? { name: l.slice(0, i).trim(), guidance: l.slice(i + 1).trim() } : { name: l, guidance: "" };
  });

export default function SettingsPage() {
  const [brand, setBrand] = useState<Brand | null>(null);
  const [text, setText] = useState<Record<string, string>>({});
  const [auto, setAuto] = useState<Autopilot | null>(null);
  const [presets, setPresets] = useState<{ id: string; label: string }[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function loadBrand(b: Brand) {
    setBrand(b);
    setText({
      personality: lines(b.personality), tones: guides(b.tones), services: guides(b.services), cta_options: lines(b.cta_options),
      good_words: b.good_words.join(", "), always: lines(b.always), never: lines(b.never), brand_hashtags: b.brand_hashtags.join(" "),
    });
  }

  useEffect(() => {
    Promise.all([api<Brand>("settings/brand"), api<Autopilot>("settings/autopilot"), api<{ id: string; label: string }[]>("presets")])
      .then(([b, a, p]) => { loadBrand(b); setAuto(a); setPresets(p); })
      .catch((e) => setError(e.message));
  }, []);

  if (!brand || !auto) return <div className="text-muted">{error ?? "Loading…"}</div>;

  const set = (k: keyof Brand) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setBrand({ ...brand, [k]: e.target.value });
  const setContact = (k: keyof Brand["contact"]) => (e: React.ChangeEvent<HTMLInputElement>) => setBrand({ ...brand, contact: { ...brand.contact, [k]: e.target.value } });
  const setColor = (k: keyof Brand["colors"]) => (e: React.ChangeEvent<HTMLInputElement>) => setBrand({ ...brand, colors: { ...brand.colors, [k]: e.target.value } });
  const setText_ = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setText({ ...text, [k]: e.target.value });

  async function save() {
    setBusy(true); setError(null); setMsg(null);
    try {
      const b = await api<Brand>("settings/brand", {
        method: "PUT",
        json: {
          ...brand,
          personality: unlines(text.personality), tones: unguides(text.tones), services: unguides(text.services), cta_options: unlines(text.cta_options),
          good_words: text.good_words.split(",").map((x) => x.trim()).filter(Boolean), always: unlines(text.always), never: unlines(text.never),
          brand_hashtags: text.brand_hashtags.split(/\s+/).filter(Boolean),
        },
      });
      loadBrand(b);
      setAuto(await api<Autopilot>("settings/autopilot", { method: "PUT", json: auto }));
      setMsg("Saved.");
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  async function applyPreset(id: string) {
    if (!id) return;
    setBusy(true); setError(null);
    try { loadBrand(await api<Brand>(`presets/${id}/apply`, { method: "POST" })); setMsg("Preset loaded and saved. Review the fields below."); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  async function uploadLogo(f?: File) {
    if (!f) return;
    try { setBrand({ ...brand!, logo_url: await upload(f, "logo") }); setMsg("Logo uploaded — press Save."); }
    catch (e) { setError((e as Error).message); }
  }

  return (
    <div className="space-y-5 pb-24">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-5xl leading-none text-ink">Brand & autopilot</h1>
          <p className="text-sm text-muted">Everything Claude needs to write like this business. Change it any time.</p>
        </div>
        {!!presets.length && (
          <div className="w-72">
            <Label>Start from a preset</Label>
            <Select defaultValue="" onChange={(e) => applyPreset(e.target.value)}>
              <option value="">— choose —</option>
              {presets.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </Select>
          </div>
        )}
      </div>

      <Card className="grid gap-4 sm:grid-cols-2">
        <h2 className="font-display text-2xl text-ink sm:col-span-2">Business</h2>
        <div><Label>Business name (exactly as it should appear)</Label><Input value={brand.business_name} onChange={set("business_name")} /></div>
        <div>
          <Label>Industry</Label>
          <Select value={brand.industry} onChange={set("industry")}>
            <option value="general">General</option>
            <option value="travel">Travel agency</option>
          </Select>
        </div>
        <div className="sm:col-span-2"><Label>Who you are</Label><Textarea rows={3} value={brand.description} onChange={set("description")} /></div>
        <div className="sm:col-span-2"><Label>Who your customers are</Label><Textarea rows={2} value={brand.audience} onChange={set("audience")} /></div>
        <div className="sm:col-span-2"><Label>Language and style of posts</Label><Input value={brand.language} onChange={set("language")} placeholder="e.g. Roman Urdu, everyday Pakistani style" /></div>
        <div className="sm:col-span-2"><Label hint="one per line">Personality</Label><Textarea rows={3} value={text.personality} onChange={setText_("personality")} /></div>
      </Card>

      <Card className="grid gap-4 sm:grid-cols-2">
        <h2 className="font-display text-2xl text-ink sm:col-span-2">Contact details (printed on posts)</h2>
        <div><Label>WhatsApp number</Label><Input value={brand.contact.whatsapp} onChange={setContact("whatsapp")} placeholder="+92 300 1234567" /></div>
        <div><Label>Phone</Label><Input value={brand.contact.phone} onChange={setContact("phone")} /></div>
        <div><Label>Website</Label><Input value={brand.contact.website} onChange={setContact("website")} /></div>
        <div><Label>Licence no.</Label><Input value={brand.contact.licence} onChange={setContact("licence")} /></div>
        <div className="sm:col-span-2"><Label>Address</Label><Input value={brand.contact.address} onChange={setContact("address")} /></div>
      </Card>

      <Card className="grid gap-4 sm:grid-cols-2">
        <h2 className="font-display text-2xl text-ink sm:col-span-2">Look</h2>
        <div>
          <Label hint="transparent PNG works best">Logo</Label>
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {brand.logo_url && <img src={brand.logo_url} alt="logo" className="h-14 rounded bg-sand p-1" />}
            <Input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => uploadLogo(e.target.files?.[0])} />
          </div>
        </div>
        <div className="flex gap-4">
          {(["primary", "accent", "text"] as const).map((k) => (
            <div key={k}><Label>{k === "primary" ? "Main colour" : k === "accent" ? "Highlight" : "Text on main"}</Label><input type="color" value={brand.colors[k]} onChange={setColor(k)} className="h-10 w-16 rounded border" /></div>
          ))}
        </div>
      </Card>

      <Card className="grid gap-4 sm:grid-cols-2">
        <h2 className="font-display text-2xl text-ink sm:col-span-2">How to write</h2>
        <div className="sm:col-span-2"><Label hint='one per line, "Name: how to write it"'>Services</Label><Textarea rows={5} value={text.services} onChange={setText_("services")} /></div>
        <div className="sm:col-span-2"><Label hint='one per line, "Name: how it sounds"'>Tones</Label><Textarea rows={4} value={text.tones} onChange={setText_("tones")} /></div>
        <div><Label>Main call to action</Label><Input value={brand.cta_default} onChange={set("cta_default")} /></div>
        <div><Label hint="one per line">Other calls to action</Label><Textarea rows={2} value={text.cta_options} onChange={setText_("cta_options")} /></div>
        <div className="sm:col-span-2"><Label hint="one per line">Always</Label><Textarea rows={3} value={text.always} onChange={setText_("always")} /></div>
        <div className="sm:col-span-2"><Label hint="one per line — claims and words that must never appear">Never</Label><Textarea rows={5} value={text.never} onChange={setText_("never")} /></div>
        <div className="sm:col-span-2"><Label hint="comma separated">Good words</Label><Input value={text.good_words} onChange={setText_("good_words")} /></div>
        <div><Label hint="space separated">Brand hashtags</Label><Input value={text.brand_hashtags} onChange={setText_("brand_hashtags")} /></div>
        <div><Label>Emojis</Label><Input value={brand.emoji_guidance} onChange={set("emoji_guidance")} /></div>
        <div className="sm:col-span-2"><Label>Hashtag guidance</Label><Textarea rows={2} value={brand.hashtag_guidance} onChange={set("hashtag_guidance")} /></div>
        <div className="sm:col-span-2"><Label>Prices, dates and numbers</Label><Input value={brand.number_format} onChange={set("number_format")} /></div>
        <div className="sm:col-span-2"><Label hint="(optional) anything else Claude should know">Extra guidelines</Label><Textarea rows={4} value={brand.extra_guidelines} onChange={set("extra_guidelines")} /></div>
      </Card>

      <Card className="space-y-4">
        <div>
          <h2 className="font-display text-2xl text-ink">Autopilot (daily automatic post)</h2>
          <p className="text-sm text-muted">When on, Claude picks a topic and posts once a day at the time below, with nobody pressing a button. Leave it off until you trust the manual posts.</p>
        </div>
        <Toggle checked={auto.enabled} onChange={(v) => setAuto({ ...auto, enabled: v })} label={auto.enabled ? "Autopilot is ON" : "Autopilot is OFF"} />
        <div className="grid gap-4 sm:grid-cols-3">
          <div><Label>Time each day</Label><Input type="time" value={auto.time} onChange={(e) => setAuto({ ...auto, time: e.target.value })} /></div>
          <div>
            <Label>Format</Label>
            <Select value={auto.format} onChange={(e) => setAuto({ ...auto, format: e.target.value as Autopilot["format"] })}>
              <option value="image">Single image</option><option value="carousel">Carousel</option><option value="reel">Reel</option>
            </Select>
          </div>
          <div>
            <Label>Post to</Label>
            <div className="flex gap-2">
              {(["facebook", "instagram"] as const).map((p) => (
                <Toggle key={p} checked={auto.platforms.includes(p)} onChange={(v) => setAuto({ ...auto, platforms: v ? [...new Set([...auto.platforms, p])] : auto.platforms.filter((x) => x !== p) })} label={p === "facebook" ? "Facebook" : "Instagram"} />
              ))}
            </div>
          </div>
        </div>
        <div><Label hint="one per line — Claude rotates through these">Topics to cover</Label><Textarea rows={4} value={lines(auto.topics)} onChange={(e) => setAuto({ ...auto, topics: e.target.value.split("\n") })} onBlur={(e) => setAuto({ ...auto, topics: unlines(e.target.value) })} placeholder={"Umrah packages\nTurkey tours\nSchengen visa assistance"} /></div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={auto.require_quality_pass} onChange={(e) => setAuto({ ...auto, require_quality_pass: e.target.checked })} />
          Only post automatically if the quality check passes (otherwise it waits in History for you)
        </label>
      </Card>

      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
          {msg && <span className="text-sm text-green-700">{msg}</span>}
          <div className="flex-1"><ErrorBox message={error} /></div>
        </div>
      </div>
    </div>
  );
}
