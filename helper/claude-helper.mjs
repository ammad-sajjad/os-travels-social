#!/usr/bin/env node
// Runs on the owner's Mac. Picks up writing jobs from the Railway server, answers them with the
// locally logged-in Claude Code (Pro plan), and sends the result back. Outbound connections only.
// Claude runs with NO tools, in an empty folder: job text can include web page content, which is untrusted.
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const envFile = path.join(here, ".env");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}
const SERVER = (process.env.SERVER_URL ?? "").replace(/\/$/, "");
const KEY = process.env.LOCAL_HELPER_KEY ?? "";
const CLAUDE = process.env.CLAUDE_BIN || path.join(os.homedir(), ".local/bin/claude");
const JOB_TIMEOUT_MS = 5 * 60_000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString(), ...a);

export function runClaude({ system, prompt, schema, model, effort }) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "claude-helper-"));
  const env = { ...process.env };
  // Never bill an API key by accident: use the Pro login.
  for (const k of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "LOCAL_HELPER_KEY"]) delete env[k];
  const args = [
    "-p", "--output-format", "json", "--json-schema", JSON.stringify(schema),
    "--model", model, "--effort", effort, "--system-prompt", system,
    "--tools", "", "--strict-mcp-config", "--setting-sources", "", "--disable-slash-commands", "--no-session-persistence",
  ];
  return new Promise((resolve, reject) => {
    const p = spawn(CLAUDE, args, { cwd, env, stdio: ["pipe", "pipe", "pipe"] });
    let out = "", err = "";
    const timer = setTimeout(() => { p.kill("SIGTERM"); reject(new Error("Claude took too long to answer.")); }, JOB_TIMEOUT_MS);
    const done = () => { clearTimeout(timer); fs.rmSync(cwd, { recursive: true, force: true }); };
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err = (err + d).slice(-2000)));
    p.on("error", (e) => { done(); reject(e); });
    p.on("close", (code) => {
      done();
      let r;
      try { r = JSON.parse(out); } catch { return reject(new Error(`Claude Code failed (${code}): ${(err || out).slice(0, 400)}`)); }
      if (r.is_error) return reject(new Error(String(r.result || r.subtype || "Claude Code error").slice(0, 400)));
      if (r.structured_output === undefined) return reject(new Error("Claude did not return the expected format."));
      resolve(r.structured_output);
    });
    p.stdin.end(prompt);
  });
}

async function call(pathname, body) {
  return fetch(`${SERVER}${pathname}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-helper-key": KEY },
    body: JSON.stringify(body ?? {}),
    signal: AbortSignal.timeout(30_000),
  });
}

async function main() {
  if (!SERVER || !KEY) throw new Error("SERVER_URL and LOCAL_HELPER_KEY must be set in helper/.env");
  log(`Helper started, connected to ${SERVER}`);
  for (;;) {
    try {
      const res = await call("/helper/next");
      if (res.status === 204) { await sleep(2500); continue; }
      if (!res.ok) { log(`Server answered ${res.status}`); await sleep(10_000); continue; }
      const job = await res.json();
      log(`Job ${job.id} started`);
      let payload;
      try {
        payload = { result: await runClaude(job) };
        log(`Job ${job.id} done`);
      } catch (e) {
        payload = { error: e.message };
        log(`Job ${job.id} failed: ${e.message}`);
      }
      await call(`/helper/jobs/${job.id}/result`, payload);
    } catch (e) {
      log(`Connection problem: ${e.message}`);
      await sleep(5000);
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch((e) => { console.error(e.message); process.exit(1); });
