"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button, Card, ErrorBox } from "@/components/ui";

type Status = { anthropic: boolean; pexels: boolean; meta_token: boolean; meta_page_id: boolean; meta_ig_user_id: boolean; database: string; public_url: string; model: string };

function Row({ ok, label, hint }: { ok: boolean; label: string; hint: string }) {
  return (
    <li className="flex items-start gap-3 py-2">
      <span className="mt-0.5">{ok ? "✅" : "⚠️"}</span>
      <div>
        <p className="text-sm font-medium">{label}</p>
        {!ok && <p className="text-xs text-slate-500">{hint}</p>}
      </div>
    </li>
  );
}

export default function SetupPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [test, setTest] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Status>("status").then(setStatus).catch((e) => setError(e.message));
  }, []);

  async function testMeta() {
    setBusy(true);
    setTest(null);
    try { setTest(await api<Record<string, unknown>>("meta/test", { method: "POST" })); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Connections</h1>
        <p className="text-sm text-slate-500">Keys are set as environment variables on the Railway server (never in this website). See README for where each one comes from.</p>
      </div>
      <ErrorBox message={error} />
      {status && (
        <Card>
          <ul className="divide-y divide-slate-100">
            <Row ok label="Website is connected to the server" hint="" />
            <Row ok={status.anthropic} label={`Claude (${status.model})`} hint="Set ANTHROPIC_API_KEY on Railway." />
            <Row ok={status.meta_token} label="Meta System User token" hint="Set META_SYSTEM_USER_TOKEN on Railway." />
            <Row ok={status.meta_page_id} label="Facebook Page ID" hint="Set META_PAGE_ID on Railway." />
            <Row ok={status.meta_ig_user_id} label="Instagram account ID" hint="Set META_IG_USER_ID on Railway (only needed for Instagram)." />
            <Row ok={status.pexels} label="Stock photos (Pexels)" hint="Optional. Set PEXELS_API_KEY on Railway for automatic photos." />
            <Row ok={status.database === "postgres"} label="Postgres database" hint="Attach a Postgres database on Railway (DATABASE_URL). The built-in database works but Postgres is recommended." />
            <Row ok={status.public_url.startsWith("https://")} label={`Public media link: ${status.public_url}`} hint="Instagram downloads images from this link, so it must be a public https address (Railway: generate a domain)." />
          </ul>
        </Card>
      )}
      <Card className="space-y-3">
        <p className="text-sm">Check the Meta connection. This posts nothing; it only reads the Page and Instagram account.</p>
        <Button onClick={testMeta} disabled={busy}>{busy ? "Checking…" : "Test Facebook & Instagram connection"}</Button>
        {test && (
          <pre className={`overflow-x-auto rounded-lg p-3 text-xs ${test.ok ? "bg-green-50 text-green-900" : "bg-red-50 text-red-900"}`}>{JSON.stringify(test, null, 2)}</pre>
        )}
      </Card>
    </div>
  );
}
