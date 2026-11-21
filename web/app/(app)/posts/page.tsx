"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, statusColor, statusLabel, type Post } from "@/lib/api";
import { Button, Card, ErrorBox } from "@/components/ui";

const FORMAT_ICON = { image: "🖼️", carousel: "🎠", reel: "🎬" } as const;

export default function PostsPage() {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Post[]>("posts?limit=100").then(setPosts).catch((e) => setError(e.message));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">History</h1>
          <p className="text-slate-500">Everything Claude has made, and where it was posted.</p>
        </div>
        <Link href="/"><Button>✦ New post</Button></Link>
      </div>
      <ErrorBox message={error} />
      {posts === null && !error && <p className="text-slate-500">Loading…</p>}
      {posts?.length === 0 && (
        <Card className="py-12 text-center">
          <p className="text-4xl">✦</p>
          <p className="mt-2 font-semibold text-slate-900">No posts yet</p>
          <p className="text-sm text-slate-500">Create your first one and it will show up here.</p>
        </Card>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {posts?.map((p) => {
          const thumb = p.media.find((m) => m.kind === "cover") ?? p.media.find((m) => m.kind === "image");
          return (
            <Link key={p.id} href={`/posts/${p.id}`} className="group">
              <Card className="h-full overflow-hidden p-0 transition group-hover:-translate-y-0.5 group-hover:shadow-lg sm:p-0">
                <div className="relative">
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb.url} alt="" className="aspect-[4/5] w-full object-cover" />
                  ) : (
                    <div className="flex aspect-[4/5] w-full items-center justify-center bg-gradient-to-br from-indigo-50 to-violet-50 text-4xl text-indigo-300">✦</div>
                  )}
                  <span className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm ${statusColor[p.status]}`}>{statusLabel[p.status]}</span>
                  <span className="absolute right-3 top-3 rounded-full bg-white/90 px-2 py-1 text-xs shadow-sm">{FORMAT_ICON[p.brief.format]}</span>
                </div>
                <div className="p-4">
                  <p className="truncate font-semibold text-slate-900">{p.brief.topic}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {p.platforms.map((x) => (x === "facebook" ? "📘" : "📸")).join(" ")} · {new Date(p.created_at).toLocaleDateString()}
                    {p.source === "autopilot" ? " · autopilot" : ""}
                  </p>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
