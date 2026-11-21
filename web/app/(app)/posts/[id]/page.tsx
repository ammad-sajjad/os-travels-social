"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, statusColor, statusLabel, type Content, type Platform, type Post } from "@/lib/api";
import { Button, Card, ErrorBox, Input, Label, Textarea, Toggle } from "@/components/ui";

const BUSY = ["generating", "publishing"];

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

  // First load, then keep refreshing while the server is working.
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

  if (!post) return <div className="text-slate-500">{error ?? "Loading…"}</div>;

  const images = post.media.filter((m) => m.kind === "image");
  const video = post.media.find((m) => m.kind === "video");
  const cover = post.media.find((m) => m.kind === "cover");
  const credits = post.media.filter((m) => m.kind === "source" && m.credit).map((m) => m.credit);
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

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{post.brief.topic}</h1>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusColor[post.status]}`}>{statusLabel[post.status]}</span>
        {post.status === "scheduled" && post.publish_at && <span className="text-sm text-slate-500">for {new Date(post.publish_at).toLocaleString()}</span>}
        {post.source === "autopilot" && <span className="text-xs text-slate-400">created by autopilot</span>}
      </div>

      {post.status === "generating" && (
        <Card><p className="text-sm text-slate-600">Claude is writing the post and the images are being made. This takes about 30–90 seconds{post.brief.format === "reel" ? " (reels take a bit longer)" : ""}…</p></Card>
      )}
      <ErrorBox message={error ?? (post.status === "failed" || post.status === "partial" ? post.error : null)} />

      {post.media.length > 0 && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,380px)_1fr]">
          <div className="space-y-2">
            {video ? (
              <video src={video.url} poster={cover?.url} controls playsInline className="w-full rounded-2xl bg-black" />
            ) : (
              <div className="flex snap-x gap-3 overflow-x-auto">
                {images.map((m, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={m.url} src={m.url} alt={`Slide ${i + 1}`} className="w-full shrink-0 snap-center rounded-2xl" />
                ))}
              </div>
            )}
            {images.length > 1 && <p className="text-xs text-slate-500">{images.length} slides — scroll sideways</p>}
            {!!credits.length && <p className="text-xs text-slate-400">{credits.join(" · ")}</p>}
          </div>

          <div className="space-y-4">
            {post.check_report && (
              <Card className={checkFailed ? "border-red-200" : "border-green-200"}>
                <p className={`mb-2 text-sm font-semibold ${checkFailed ? "text-red-700" : "text-green-700"}`}>
                  Quality check: {checkFailed ? "problems found" : "passed"}
                </p>
                <ul className="space-y-1 text-sm">
                  {post.check_report.checks.filter((c) => c.status !== "pass").map((c) => (
                    <li key={c.name} className={c.status === "fail" ? "text-red-700" : "text-amber-700"}>
                      <b>{c.name}</b>: {c.reason}{c.fix ? ` → ${c.fix}` : ""}
                    </li>
                  ))}
                  {post.check_report.checks.every((c) => c.status === "pass") && <li className="text-slate-500">No issues found.</li>}
                </ul>
              </Card>
            )}

            {draft && (
              <Card className="space-y-3">
                <div>
                  <Label>Instagram caption</Label>
                  <Textarea rows={7} value={draft.caption_instagram} disabled={!editable} onChange={(e) => upd({ caption_instagram: e.target.value })} />
                </div>
                <div>
                  <Label>Facebook caption</Label>
                  <Textarea rows={7} value={draft.caption_facebook} disabled={!editable} onChange={(e) => upd({ caption_facebook: e.target.value })} />
                </div>
                <div>
                  <Label hint="(optional)">First comment</Label>
                  <Input value={draft.first_comment ?? ""} disabled={!editable} onChange={(e) => upd({ first_comment: e.target.value || null })} />
                </div>
                <details>
                  <summary className="cursor-pointer text-sm font-medium text-slate-700">Edit the text on the image</summary>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div><Label>Headline</Label><Input value={draft.headline} disabled={!editable} onChange={(e) => upd({ headline: e.target.value })} /></div>
                    <div><Label>Button text</Label><Input value={draft.cta} disabled={!editable} onChange={(e) => upd({ cta: e.target.value })} /></div>
                    <div><Label>Price badge</Label><Input value={draft.price_badge ?? ""} disabled={!editable} onChange={(e) => upd({ price_badge: e.target.value || null })} /></div>
                    <div><Label hint="one per line">Points</Label><Textarea rows={3} value={draft.points.join("\n")} disabled={!editable} onChange={(e) => upd({ points: e.target.value.split("\n").filter(Boolean) })} /></div>
                    {draft.slides.map((s, i) => (
                      <div key={i} className="sm:col-span-2 grid gap-2 sm:grid-cols-2">
                        <div><Label>Slide {i + 1} headline</Label><Input value={s.headline} disabled={!editable} onChange={(e) => upd({ slides: draft.slides.map((x, j) => (j === i ? { ...x, headline: e.target.value } : x)) })} /></div>
                        <div><Label>Slide {i + 1} text</Label><Input value={s.text} disabled={!editable} onChange={(e) => upd({ slides: draft.slides.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })} /></div>
                      </div>
                    ))}
                    {draft.scenes.map((s, i) => (
                      <div key={i} className="sm:col-span-2"><Label>Scene {i + 1} text</Label><Input value={s.on_screen} disabled={!editable} onChange={(e) => upd({ scenes: draft.scenes.map((x, j) => (j === i ? { ...x, on_screen: e.target.value } : x)) })} /></div>
                    ))}
                  </div>
                  {editable && <Button type="button" variant="secondary" className="mt-3" disabled={!!busy || !imageTextDirty} onClick={() => save(true)}>{busy === "rerender" ? "Updating…" : "Update image"}</Button>}
                </details>
                {editable && dirty && !imageTextDirty && <Button type="button" variant="secondary" disabled={!!busy} onClick={() => save(false)}>{busy === "save" ? "Saving…" : "Save changes"}</Button>}
              </Card>
            )}
          </div>
        </div>
      )}

      {Object.keys(post.results).length > 0 && (
        <Card>
          <p className="mb-2 text-sm font-semibold">Posting results</p>
          <ul className="space-y-1 text-sm">
            {Object.entries(post.results).map(([p, r]) => (
              <li key={p}>
                <b className="capitalize">{p}</b>: {r.status === "published" ? "✅ posted" : r.status === "publishing" ? "posting…" : "❌ failed"}
                {r.link && <> — <a className="text-blue-700 underline" href={r.link} target="_blank" rel="noreferrer">open post</a></>}
                {r.error && <span className="text-red-700"> — {r.error}</span>}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {canPublish && (
        <Card className="space-y-4">
          <div>
            <Label>Post to</Label>
            <div className="flex gap-2">
              {(["facebook", "instagram"] as Platform[]).map((p) => (
                <Toggle key={p} checked={platforms.includes(p)} onChange={(v) => setPlatforms(v ? [...new Set([...platforms, p])] : platforms.filter((x) => x !== p))} label={p === "facebook" ? "Facebook" : "Instagram"} />
              ))}
            </div>
          </div>
          {checkFailed && (
            <label className="flex items-center gap-2 text-sm text-red-700">
              <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} />
              The quality check found problems. I have read them and want to post anyway.
            </label>
          )}
          <div className="flex flex-wrap items-end gap-3">
            <Button disabled={!!busy || !platforms.length || (checkFailed && !override)} onClick={() => publish()}>
              {busy === "publish" ? "Posting…" : "Post now"}
            </Button>
            <div className="flex items-end gap-2">
              <div>
                <Label>or schedule for</Label>
                <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
              </div>
              <Button variant="secondary" disabled={!!busy || !when || !platforms.length || (checkFailed && !override)} onClick={() => publish(when)}>Schedule</Button>
            </div>
            {post.status === "scheduled" && <Button variant="secondary" disabled={!!busy} onClick={() => run("unschedule", () => api(`posts/${id}/unschedule`, { method: "POST" }))}>Cancel schedule</Button>}
          </div>
        </Card>
      )}

      <div className="flex flex-wrap gap-3">
        {["ready", "failed"].includes(post.status) && (
          <Button variant="secondary" disabled={!!busy} onClick={() => run("regen", () => api(`posts/${id}/regenerate`, { method: "POST" }))}>Write it again</Button>
        )}
        {!["published", "partial", "publishing"].includes(post.status) && (
          <Button variant="danger" disabled={!!busy} onClick={async () => { await api(`posts/${id}`, { method: "DELETE" }); router.push("/posts"); }}>Delete</Button>
        )}
      </div>
    </div>
  );
}
