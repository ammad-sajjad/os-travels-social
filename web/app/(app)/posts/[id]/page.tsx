"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, statusColor, statusLabel, type Content, type Platform, type Post } from "@/lib/api";
import { AskClaude, Button, Card, ErrorBox, Input, Label, Textarea, Toggle } from "@/components/ui";

const BUSY = ["generating", "publishing"];
type Field = "image" | "visual" | "caption_instagram" | "caption_facebook" | "hashtags" | "first_comment";

export default function PostPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [post, setPost] = useState<Post | null>(null);
  const [draft, setDraft] = useState<Content | null>(null);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [when, setWhen] = useState("");
  const [override, setOverride] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const p = await api<Post>(`posts/${id}`);
    setPost(p);
    return p;
  }, [id]);

  useEffect(() => {
    api<Post>(`posts/${id}`).then((p) => {
      setPost(p);
      setDraft(p.content);
      setPlatforms(p.platforms);
    }).catch((e) => setError(e.message));
  }, [id]);
  useEffect(() => {
    if (!post || !BUSY.includes(post.status)) return;
    const t = setInterval(async () => {
      const p = await load().catch(() => null);
      if (p && !BUSY.includes(p.status)) {
        setDraft(p.content);
        setPlatforms(p.platforms);
      }
    }, 2500);
    return () => clearInterval(t);
  }, [post, load]);

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(label);
    setError(null);
    try {
      await fn();
      const p = await load();
      if (!BUSY.includes(p.status)) setDraft(p.content);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const ask = (field: Field) => async (instruction: string) => {
    setError(null);
    try {
      await api(`posts/${id}/refine`, { method: "POST", json: { field, instruction } });
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (!post) return <div className="text-slate-500">{error ?? "Loading…"}</div>;

  const images = post.media.filter((m) => m.kind === "image");
  const video = post.media.find((m) => m.kind === "video");
  const cover = post.media.find((m) => m.kind === "cover");
  const credits = [...new Set(post.media.filter((m) => m.kind === "source" && m.credit).map((m) => m.credit))];
  const working = BUSY.includes(post.status);
  const editable = ["ready", "failed", "scheduled"].includes(post.status) && !!draft;
  const canPublish = ["ready", "scheduled", "failed", "partial"].includes(post.status) && !!post.content && post.media.length > 0;
  const checkFailed = post.check_report?.result === "fail";
  const dirty = JSON.stringify(draft) !== JSON.stringify(post.content) || JSON.stringify(platforms) !== JSON.stringify(post.platforms);
  const imageKeys = ["headline", "cta", "price_badge", "points", "slides", "scenes"] as const;
  const imageTextDirty = !!draft && !!post.content && imageKeys.some((k) => JSON.stringify(draft[k]) !== JSON.stringify(post.content![k]));

  const save = (rerender: boolean) => run(rerender ? "rerender" : "save", () => api(`posts/${id}`, { method: "PATCH", json: { content: draft, platforms, rerender } }));
  const publish = (at?: string) =>
    run("publish", async () => {
      if (dirty) await api(`posts/${id}`, { method: "PATCH", json: { content: draft, platforms, rerender: imageTextDirty } });
      await api(`posts/${id}/publish`, { method: "POST", json: at ? { publish_at: new Date(at).toISOString() } : {} });
    });
  const upd = (patch: Partial<Content>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const canAsk = editable && !working;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={() => router.push("/posts")} className="text-sm text-slate-500 hover:text-slate-900">← History</button>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{post.brief.topic}</h1>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusColor[post.status]}`}>{statusLabel[post.status]}</span>
        {post.status === "scheduled" && post.publish_at && <span className="text-sm text-slate-500">for {new Date(post.publish_at).toLocaleString()}</span>}
        {post.source === "autopilot" && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-500">autopilot</span>}
      </div>

      {working && (
        <Card className="flex items-center gap-4">
          <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white">
            <span className="absolute inset-0 animate-ping rounded-2xl bg-indigo-400 opacity-30" />✦
          </span>
          <div>
            <p className="font-semibold text-slate-900">{post.status === "publishing" ? "Posting to " + post.platforms.join(" and ") + "…" : post.content ? "Claude is making your change…" : "Claude is creating your post…"}</p>
            <p className="text-sm text-slate-500">
              {post.status === "publishing" ? "This can take a minute, especially for reels." : `Writing, checking and designing. Usually 30–90 seconds${post.brief.format === "reel" ? ", a bit longer for reels" : ""}.`}
            </p>
          </div>
        </Card>
      )}
      <ErrorBox message={error ?? (["failed", "partial", "ready", "scheduled"].includes(post.status) ? post.error : null)} />

      {post.media.length > 0 && draft && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,400px)_1fr]">
          <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <Card className="p-3 sm:p-3">
              <div className={working ? "opacity-50 transition" : "transition"}>
                {video ? (
                  <video src={video.url} poster={cover?.url} controls playsInline className="w-full rounded-2xl bg-black" />
                ) : (
                  <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto">
                    {images.map((m, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={m.url} src={m.url} alt={`Slide ${i + 1}`} className="w-full shrink-0 snap-center rounded-2xl" />
                    ))}
                  </div>
                )}
              </div>
              {images.length > 1 && <p className="mt-2 text-center text-xs text-slate-500">{images.length} slides — swipe sideways</p>}
              {!!credits.length && <p className="mt-1 text-center text-xs text-slate-400">{credits.join(" · ")}</p>}
            </Card>
            <Card>
              <p className="text-sm font-semibold text-slate-900">🖼️ The picture</p>
              <p className="text-xs text-slate-500">Change what the background shows.</p>
              <AskClaude disabled={!canAsk} placeholder="e.g. show a beach at sunset instead" suggestions={["Brighter colours", "More luxurious", "Show the landmark closer"]} onSend={ask("visual")} />
              <div className="mt-5 border-t border-slate-100 pt-4">
                <p className="text-sm font-semibold text-slate-900">🔤 Text on the image</p>
                <p className="text-xs text-slate-500">Headline, points, price badge and button.</p>
                <AskClaude disabled={!canAsk} placeholder="e.g. make the headline shorter and punchier" suggestions={["Shorter headline", "Add urgency", "Remove the points"]} onSend={ask("image")} />
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-800">Edit the text myself</summary>
                  <div className="mt-3 grid gap-3">
                    <div><Label>Headline</Label><Input value={draft.headline} disabled={!editable} onChange={(e) => upd({ headline: e.target.value })} /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Button text</Label><Input value={draft.cta} disabled={!editable} onChange={(e) => upd({ cta: e.target.value })} /></div>
                      <div><Label>Price badge</Label><Input value={draft.price_badge ?? ""} disabled={!editable} onChange={(e) => upd({ price_badge: e.target.value || null })} /></div>
                    </div>
                    <div><Label hint="one per line">Points</Label><Textarea rows={3} value={draft.points.join("\n")} disabled={!editable} onChange={(e) => upd({ points: e.target.value.split("\n").filter(Boolean) })} /></div>
                    {draft.slides.map((s, i) => (
                      <div key={i} className="grid grid-cols-2 gap-2">
                        <div><Label>Slide {i + 1}</Label><Input value={s.headline} disabled={!editable} onChange={(e) => upd({ slides: draft.slides.map((x, j) => (j === i ? { ...x, headline: e.target.value } : x)) })} /></div>
                        <div><Label>Text</Label><Input value={s.text} disabled={!editable} onChange={(e) => upd({ slides: draft.slides.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })} /></div>
                      </div>
                    ))}
                    {draft.scenes.map((s, i) => (
                      <div key={i}><Label>Scene {i + 1}</Label><Input value={s.on_screen} disabled={!editable} onChange={(e) => upd({ scenes: draft.scenes.map((x, j) => (j === i ? { ...x, on_screen: e.target.value } : x)) })} /></div>
                    ))}
                    {editable && <Button type="button" variant="secondary" disabled={!!busy || !imageTextDirty} onClick={() => save(true)}>{busy === "rerender" ? "Updating…" : "Update image"}</Button>}
                  </div>
                </details>
              </div>
            </Card>
          </div>

          <div className="space-y-4">
            {post.check_report && (
              <Card className={checkFailed ? "!border-red-200 !bg-red-50/60" : "!border-emerald-200 !bg-emerald-50/60"}>
                <p className={`text-sm font-semibold ${checkFailed ? "text-red-800" : "text-emerald-800"}`}>{checkFailed ? "⚠️ Quality check found problems" : "✅ Quality check passed"}</p>
                <ul className="mt-2 space-y-1 text-sm">
                  {post.check_report.checks.filter((c) => c.status !== "pass").map((c) => (
                    <li key={c.name} className={c.status === "fail" ? "text-red-700" : "text-amber-700"}>
                      <b className="capitalize">{c.name}</b>: {c.reason}{c.fix ? ` → ${c.fix}` : ""}
                    </li>
                  ))}
                  {post.check_report.checks.every((c) => c.status === "pass") && <li className="text-emerald-700">Facts, prices, wording and brand rules all look right.</li>}
                </ul>
              </Card>
            )}

            {(["caption_instagram", "caption_facebook"] as const).map((k) => (
              <Card key={k}>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-900">{k === "caption_instagram" ? "📸 Instagram caption" : "📘 Facebook caption"}</p>
                  <span className="text-xs text-slate-400">{draft[k].length} characters</span>
                </div>
                <Textarea rows={8} value={draft[k]} disabled={!editable} onChange={(e) => upd({ [k]: e.target.value } as Partial<Content>)} />
                <AskClaude disabled={!canAsk} placeholder="e.g. make it shorter and more emotional" suggestions={["Shorter", "More emotional", "Add urgency", "More Roman Urdu"]} onSend={ask(k)} />
              </Card>
            ))}

            <Card>
              <p className="mb-2 text-sm font-semibold text-slate-900"># Hashtags</p>
              <div className="flex flex-wrap gap-1.5">
                {draft.hashtags.map((h) => <span key={h} className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">{h.startsWith("#") ? h : `#${h}`}</span>)}
              </div>
              <AskClaude disabled={!canAsk} placeholder="e.g. add more family travel hashtags" suggestions={["Fewer hashtags", "More destination tags", "Add seasonal tags"]} onSend={ask("hashtags")} />
            </Card>

            <Card>
              <Label hint="(optional, posted under the post)">First comment</Label>
              <Input value={draft.first_comment ?? ""} disabled={!editable} onChange={(e) => upd({ first_comment: e.target.value || null })} placeholder="No first comment" />
              <AskClaude disabled={!canAsk} placeholder="e.g. add the WhatsApp link with a short line" onSend={ask("first_comment")} />
            </Card>

            {editable && dirty && !imageTextDirty && (
              <Button type="button" variant="secondary" disabled={!!busy} onClick={() => save(false)}>{busy === "save" ? "Saving…" : "Save my edits"}</Button>
            )}

            {Object.keys(post.results).length > 0 && (
              <Card>
                <p className="mb-2 text-sm font-semibold text-slate-900">Posting results</p>
                <ul className="space-y-1.5 text-sm">
                  {Object.entries(post.results).map(([pl, r]) => (
                    <li key={pl}>
                      <b className="capitalize">{pl}</b>: {r.status === "published" ? "✅ posted" : r.status === "publishing" ? "⏳ posting…" : "❌ failed"}
                      {r.link && <> — <a className="font-medium text-indigo-700 underline" href={r.link} target="_blank" rel="noreferrer">open post</a></>}
                      {r.error && <span className="text-red-700"> — {r.error}</span>}
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {canPublish && (
              <Card className="space-y-4 !border-indigo-200">
                <p className="font-semibold text-slate-900">Ready to post?</p>
                <div className="flex gap-2">
                  {(["facebook", "instagram"] as Platform[]).map((pl) => (
                    <Toggle key={pl} icon={pl === "facebook" ? "📘" : "📸"} checked={platforms.includes(pl)} onChange={(v) => setPlatforms(v ? [...new Set([...platforms, pl])] : platforms.filter((x) => x !== pl))} label={pl === "facebook" ? "Facebook" : "Instagram"} />
                  ))}
                </div>
                {checkFailed && (
                  <label className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-800">
                    <input type="checkbox" className="mt-0.5" checked={override} onChange={(e) => setOverride(e.target.checked)} />
                    The quality check found problems. I&apos;ve read them and want to post anyway.
                  </label>
                )}
                <div className="flex flex-wrap items-end gap-3">
                  <Button disabled={!!busy || !platforms.length || (checkFailed && !override)} onClick={() => publish()} className="px-6">
                    {busy === "publish" ? "Posting…" : "🚀 Post now"}
                  </Button>
                  <span className="pb-2.5 text-sm text-slate-400">or</span>
                  <div className="flex items-end gap-2">
                    <div>
                      <Label>Schedule for</Label>
                      <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
                    </div>
                    <Button variant="secondary" disabled={!!busy || !when || !platforms.length || (checkFailed && !override)} onClick={() => publish(when)}>Schedule</Button>
                  </div>
                  {post.status === "scheduled" && <Button variant="ghost" disabled={!!busy} onClick={() => run("unschedule", () => api(`posts/${id}/unschedule`, { method: "POST" }))}>Cancel schedule</Button>}
                </div>
              </Card>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        {["ready", "failed"].includes(post.status) && (
          <Button variant="secondary" disabled={!!busy} onClick={() => run("regen", () => api(`posts/${id}/regenerate`, { method: "POST" }))}>↻ Start over with Claude</Button>
        )}
        {!["published", "partial", "publishing"].includes(post.status) && (
          <Button variant="danger" disabled={!!busy} onClick={async () => { await api(`posts/${id}`, { method: "DELETE" }); router.push("/posts"); }}>Delete</Button>
        )}
      </div>
    </div>
  );
}
