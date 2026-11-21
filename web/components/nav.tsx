"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "New post" },
  { href: "/posts", label: "History" },
  { href: "/settings", label: "Brand & autopilot" },
  { href: "/setup", label: "Connections" },
];

export function Nav() {
  const path = usePathname();
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-1 px-4 py-3">
        <span className="mr-4 font-bold">{process.env.NEXT_PUBLIC_APP_NAME || "Social Autopilot"}</span>
        {links.map((l) => {
          const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
          return (
            <Link key={l.href} href={l.href} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
              {l.label}
            </Link>
          );
        })}
        <button onClick={logout} className="ml-auto text-sm text-slate-500 hover:text-slate-900">Log out</button>
      </div>
    </header>
  );
}
