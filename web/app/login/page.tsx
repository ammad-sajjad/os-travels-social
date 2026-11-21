"use client";
import { useState } from "react";
import { Arrow, ErrorBox, Input, Label } from "@/components/ui";

const BOARD = [
  ["07:40", "ISTANBUL", "BOARDING"],
  ["09:15", "KUALA LUMPUR", "ON TIME"],
  ["11:30", "DUBAI", "ON TIME"],
  ["13:05", "JEDDAH", "GATE 4"],
  ["16:50", "BAKU", "ON TIME"],
];

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const name = process.env.NEXT_PUBLIC_APP_NAME || "Social Autopilot";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
    const data = await res.json().catch(() => ({}));
    if (res.ok) window.location.assign("/");
    else {
      setError(data.error ?? "Login failed");
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-ink p-12 text-paper lg:flex">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-dashed border-gold text-gold">✈</span>
          <span className="font-mono text-[11px] uppercase tracking-[0.3em] text-paper/60">Content control tower</span>
        </div>
        <div>
          <h1 className="font-display text-7xl leading-[0.95]">
            Every post,<br /><em className="text-sunset-2">cleared for take-off.</em>
          </h1>
          <div className="mt-12 rounded-2xl border border-paper/10 bg-ink-2/60 p-5 font-mono text-sm">
            <div className="mb-3 grid grid-cols-[70px_1fr_100px] text-[10px] tracking-[0.25em] text-paper/40">
              <span>TIME</span><span>DESTINATION</span><span className="text-right">STATUS</span>
            </div>
            {BOARD.map(([t, d, s], i) => (
              <div key={d} className="grid grid-cols-[70px_1fr_100px] border-t border-paper/5 py-2" style={{ animation: `rise .6s ${0.15 + i * 0.12}s both` }}>
                <span className="text-gold">{t}</span>
                <span className="flap">{d.split("").map((ch, j) => <span key={j} style={{ animationDelay: `${0.3 + i * 0.12 + j * 0.03}s` }}>{ch === " " ? " " : ch}</span>)}</span>
                <span className={`text-right ${s === "BOARDING" ? "text-sunset-2" : "text-paper/60"}`}>{s}</span>
              </div>
            ))}
          </div>
        </div>
        <span className="pointer-events-none absolute -right-10 top-24 animate-float font-display text-[260px] leading-none text-ink-2">✈</span>
      </section>

      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm animate-rise">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted">Check-in</p>
          <h2 className="mt-2 font-display text-5xl leading-none text-ink">{name}</h2>
          <p className="mt-3 text-sm text-muted">Create and post to Facebook and Instagram with Claude.</p>
          <form onSubmit={submit} className="ticket mt-8 space-y-4 rounded-[22px] border border-line bg-card p-6 shadow-[0_24px_50px_-30px_rgba(18,33,59,0.6)]">
            <div>
              <Label>Email</Label>
              <Input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <Label>Password</Label>
              <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <ErrorBox message={error} />
            <button disabled={busy} className="group w-full rounded-full bg-ink py-3 text-sm font-semibold text-paper transition hover:bg-sunset disabled:opacity-50">
              <span className="inline-flex items-center gap-2">{busy ? "Checking in…" : <>Board <Arrow /></>}</span>
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
