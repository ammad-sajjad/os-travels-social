"use client";
import { useState } from "react";
import { Button, ErrorBox, Input, Label } from "@/components/ui";

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
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_top_left,_#c7d2fe_0%,_transparent_50%),radial-gradient(ellipse_at_bottom_right,_#f5d0fe_0%,_transparent_45%)] bg-slate-50 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-2xl font-bold text-white shadow-lg shadow-indigo-200">✦</span>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">{name}</h1>
          <p className="text-sm text-slate-500">Create and post to Facebook and Instagram with Claude.</p>
        </div>
        <form onSubmit={submit} className="space-y-4 rounded-3xl border border-white/70 bg-white/90 p-6 shadow-xl shadow-slate-200/60 backdrop-blur">
          <div>
            <Label>Email</Label>
            <Input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <Label>Password</Label>
            <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <ErrorBox message={error} />
          <Button className="w-full py-3" disabled={busy}>{busy ? "Logging in…" : "Log in"}</Button>
        </form>
      </div>
    </main>
  );
}
