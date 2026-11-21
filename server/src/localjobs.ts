// Queue for "local Claude" mode: the server stores a writing job, the helper on the owner's Mac
// picks it up, answers with Claude Code, and posts the result back.
import crypto from "node:crypto";
import { query } from "./db.js";
import { config } from "./config.js";

const CLAIM_TIMEOUT_MS = 45_000;
const TOTAL_TIMEOUT_MS = 6 * 60_000;
const ONLINE_MS = 15_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let lastSeen = 0;

export function helperStatus() {
  return { connected: Date.now() - lastSeen < ONLINE_MS, last_seen: lastSeen ? new Date(lastSeen).toISOString() : null };
}

export async function runLocal(system: string, prompt: string, schema: unknown, effort: string): Promise<unknown> {
  const id = crypto.randomUUID();
  await query(`INSERT INTO llm_jobs (id, status, payload) VALUES ($1,'pending',$2)`, [
    id, JSON.stringify({ system, prompt, schema, effort, model: config.claudeModel }),
  ]);
  const start = Date.now();
  try {
    for (;;) {
      await sleep(1200);
      const [job] = await query<{ status: string; result: unknown; error: string | null }>(`SELECT status, result, error FROM llm_jobs WHERE id=$1`, [id]);
      if (!job) throw new Error("The writing job was lost. Please try again.");
      if (job.status === "done") return job.result;
      if (job.status === "failed") throw new Error(friendly(job.error));
      const waited = Date.now() - start;
      if (job.status === "pending" && waited > CLAIM_TIMEOUT_MS) {
        throw new Error("Your Mac's Claude helper isn't connected. Make sure the Mac is on, awake and online, then try again.");
      }
      if (waited > TOTAL_TIMEOUT_MS) throw new Error("Claude on your Mac took too long to answer. Please try again.");
    }
  } finally {
    await query(`DELETE FROM llm_jobs WHERE id=$1`, [id]); // prompts aren't kept
  }
}

function friendly(error: string | null) {
  const e = error ?? "Unknown error";
  if (/limit|rate|usage|quota/i.test(e)) return `Your Claude Pro usage limit has been reached. It resets after a few hours. (${e})`;
  if (/log ?in|auth|unauthori[sz]ed|credential/i.test(e)) return `Claude on your Mac needs logging in again: run "claude" in Terminal and use /login. (${e})`;
  return e;
}

export async function claimNext() {
  lastSeen = Date.now();
  await query(`DELETE FROM llm_jobs WHERE created_at < now() - interval '15 minutes'`);
  const rows = await query<{ id: string; payload: Record<string, unknown> }>(
    `UPDATE llm_jobs SET status='running', claimed_at=now()
     WHERE id = (SELECT id FROM llm_jobs WHERE status='pending' ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED)
     RETURNING id, payload`,
  );
  return rows[0] ? { id: rows[0].id, ...rows[0].payload } : null;
}

export async function finishJob(id: string, body: { result?: unknown; error?: string }) {
  lastSeen = Date.now();
  if (body.result !== undefined) {
    await query(`UPDATE llm_jobs SET status='done', result=$2 WHERE id=$1 AND status='running'`, [id, JSON.stringify(body.result)]);
  } else {
    await query(`UPDATE llm_jobs SET status='failed', error=$2 WHERE id=$1 AND status='running'`, [id, String(body.error ?? "Unknown error").slice(0, 1000)]);
  }
}
