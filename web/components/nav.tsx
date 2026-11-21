"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Create", icon: "✦" },
  { href: "/posts", label: "History", icon: "🗂" },
  { href: "/settings", label: "Brand", icon: "🎨" },
  { href: "/setup", label: "Connections", icon: "🔌" },
];

export function Nav() {
  const path = usePathname();
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/login");
  }
  return (
    <header className="sticky top-0 z-20 border-b border-white/60 bg-white/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3">
        <Link href="/" className="mr-3 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-sm font-bold text-white shadow-md shadow-indigo-200">✦</span>
          <span className="hidden font-semibold text-slate-900 sm:inline">{process.env.NEXT_PUBLIC_APP_NAME || "Social Autopilot"}</span>
        </Link>
        <nav className="flex flex-1 gap-1 overflow-x-auto">
          {links.map((l) => {
            const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
            return (
              <Link key={l.href} href={l.href} className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition ${active ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:bg-white hover:text-slate-900"}`}>
                <span className="text-xs">{l.icon}</span>
                {l.label}
              </Link>
            );
          })}
        </nav>
        <button onClick={logout} className="shrink-0 rounded-xl px-3 py-2 text-sm text-slate-500 transition hover:bg-white hover:text-slate-900">Log out</button>
      </div>
    </header>
  );
}
