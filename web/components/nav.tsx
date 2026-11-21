"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const links = [
  { href: "/", label: "Create", code: "01" },
  { href: "/posts", label: "History", code: "02" },
  { href: "/settings", label: "Brand", code: "03" },
  { href: "/setup", label: "Connections", code: "04" },
];

function Clock() {
  const [now, setNow] = useState<string | null>(null);
  useEffect(() => {
    const fmt = () => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Karachi", hour: "2-digit", minute: "2-digit" }).format(new Date());
    const first = setTimeout(() => setNow(fmt()), 0);
    const t = setInterval(() => setNow(fmt()), 15_000);
    return () => { clearTimeout(first); clearInterval(t); };
  }, []);
  if (!now) return null;
  const [h, m] = now.split(":");
  return (
    <span className="hidden items-center gap-1 font-mono text-xs text-paper/70 md:flex">
      PKT
      <span className="flap rounded bg-ink-2 px-1.5 py-0.5 text-gold"><span key={h}>{h}</span></span>
      <span className="animate-blink text-gold">:</span>
      <span className="flap rounded bg-ink-2 px-1.5 py-0.5 text-gold"><span key={m}>{m}</span></span>
    </span>
  );
}

export function Nav() {
  const path = usePathname();
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/login");
  }
  return (
    <header className="sticky top-0 z-30 bg-ink text-paper shadow-[0_10px_30px_-15px_rgba(18,33,59,0.6)]">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <Link href="/" className="group mr-2 flex items-center gap-3">
          <span className="relative flex h-9 w-9 items-center justify-center rounded-full border-2 border-dashed border-gold text-gold transition-transform duration-700 group-hover:rotate-[360deg]">✈</span>
          <span className="hidden leading-none sm:block">
            <span className="block font-display text-xl italic">{process.env.NEXT_PUBLIC_APP_NAME || "Social Autopilot"}</span>
            <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-paper/50">Content control tower</span>
          </span>
        </Link>
        <nav className="flex flex-1 gap-1 overflow-x-auto">
          {links.map((l) => {
            const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
            return (
              <Link key={l.href} href={l.href} className={`group relative flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-sm transition ${active ? "bg-paper text-ink" : "text-paper/70 hover:text-paper"}`}>
                <span className={`font-mono text-[10px] ${active ? "text-sunset" : "text-paper/40 group-hover:text-gold"}`}>{l.code}</span>
                {l.label}
              </Link>
            );
          })}
        </nav>
        <Clock />
        <button onClick={logout} className="shrink-0 rounded-full px-3 py-2 font-mono text-[11px] uppercase tracking-widest text-paper/60 transition hover:text-sunset-2">Exit</button>
      </div>
    </header>
  );
}
