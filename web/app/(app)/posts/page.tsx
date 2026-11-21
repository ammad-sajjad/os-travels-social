"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, statusColor, statusLabel, type Post } from "@/lib/api";
import { Card, ErrorBox } from "@/components/ui";

export default function PostsPage() {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Post[]>("posts?limit=100").then(setPosts).catch((e) => setError(e.message));
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">History</h1>
      <ErrorBox message={error} />
      {posts?.length === 0 && <Card><p className="text-sm text-slate-500">No posts yet. <Link href="/" className="underline">Create your first one.</Link></p></Card>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {posts?.map((p) => {
          const thumb = p.media.find((m) => m.kind === "cover") ?? p.media.find((m) => m.kind === "image");
          return (
            <Link key={p.id} href={`/posts/${p.id}`}>
              <Card className="h-full p-3 transition hover:shadow-md">
                {thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumb.url} alt="" className="mb-3 aspect-[4/5] w-full rounded-xl object-cover" />
                ) : (
                  <div className="mb-3 flex aspect-[4/5] w-full items-center justify-center rounded-xl bg-slate-100 text-sm text-slate-400">No preview</div>
                )}
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold">{p.brief.topic}</p>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${statusColor[p.status]}`}>{statusLabel[p.status]}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {p.brief.format} · {p.platforms.join(" + ")} · {new Date(p.created_at).toLocaleDateString()}
                  {p.source === "autopilot" ? " · autopilot" : ""}
                </p>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
