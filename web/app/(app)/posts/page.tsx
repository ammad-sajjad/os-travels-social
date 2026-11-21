"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, statusLabel, type Post } from "@/lib/api";
import { Arrow, Button, Card, ErrorBox, Eyebrow, Stamp } from "@/components/ui";

const FORMAT_CODE = { image: "IMG", carousel: "CRS", reel: "REL" } as const;
const stampColor = (s: Post["status"]) => (s === "published" ? "sea" : s === "failed" || s === "partial" ? "sunset" : s === "ready" ? "gold" : "ink") as "sea" | "sunset" | "gold" | "ink";

export default function PostsPage() {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Post[]>("posts?limit=100").then(setPosts).catch((e) => setError(e.message));
  }, []);

  return (
    <div className="stagger space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>Logbook</Eyebrow>
          <h1 className="mt-2 font-display text-6xl leading-none text-ink">Every <em className="text-sunset">journey</em></h1>
          <p className="mt-3 text-muted">Everything Claude has made, and where it landed.</p>
        </div>
        <Link href="/"><Button>New post <Arrow /></Button></Link>
      </div>
      <ErrorBox message={error} />
      {posts === null && !error && <p className="font-mono text-xs uppercase tracking-widest text-muted">Loading the logbook…</p>}
      {posts?.length === 0 && (
        <Card ticket className="py-16 text-center">
          <p className="animate-float text-5xl">✈</p>
          <p className="mt-4 font-display text-3xl text-ink">No flights yet</p>
          <p className="mt-1 text-sm text-muted">Create your first post and it will land here.</p>
        </Card>
      )}
      <div className="stagger grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {posts?.map((p, i) => {
          const thumb = p.media.find((m) => m.kind === "cover") ?? p.media.find((m) => m.kind === "image");
          const tilt = [-1.6, 1.2, -0.6, 1.8, -1.2, 0.8][i % 6];
          return (
            <Link key={p.id} href={`/posts/${p.id}`} className="group block">
              <div className="relative bg-card p-3 pb-4 shadow-[0_20px_40px_-26px_rgba(18,33,59,0.7)] ring-1 ring-line transition duration-500 group-hover:-translate-y-1.5 group-hover:rotate-0 group-hover:shadow-[0_30px_50px_-26px_rgba(18,33,59,0.8)]" style={{ transform: `rotate(${tilt}deg)` }}>
                <div className="relative overflow-hidden">
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb.url} alt="" className="aspect-[4/5] w-full object-cover transition duration-700 group-hover:scale-[1.04]" />
                  ) : (
                    <div className="flex aspect-[4/5] w-full items-center justify-center bg-sand font-display text-6xl text-line">✈</div>
                  )}
                  <span className="absolute right-3 top-3 rounded bg-card/90 px-1.5 py-0.5 font-mono text-[10px] tracking-widest text-ink">{FORMAT_CODE[p.brief.format]}</span>
                </div>
                <div className="flex items-start justify-between gap-3 px-1 pt-3">
                  <div className="min-w-0">
                    <p className="truncate font-display text-xl leading-tight text-ink">{p.brief.topic}</p>
                    <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted">
                      {p.platforms.map((x) => (x === "facebook" ? "FB" : "IG")).join(" + ")} · {new Date(p.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                      {p.source === "autopilot" ? " · auto" : ""}
                    </p>
                  </div>
                  <Stamp color={stampColor(p.status)} className="shrink-0">{statusLabel[p.status]}</Stamp>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
