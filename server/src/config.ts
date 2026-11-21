// All per-client configuration comes from environment variables.
// Selling to a new client = new deployment + new values here. No code changes.
import path from "node:path";
import fs from "node:fs";

const env = (k: string, d = "") => (process.env[k] ?? d).trim();

const dataDir = path.resolve(env("DATA_DIR", "./data"));
fs.mkdirSync(path.join(dataDir, "media"), { recursive: true });

function publicUrl() {
  const explicit = env("PUBLIC_URL");
  if (explicit) return explicit.replace(/\/$/, "");
  const railway = env("RAILWAY_PUBLIC_DOMAIN");
  if (railway) return `https://${railway}`;
  return `http://localhost:${env("PORT", "8080")}`;
}

export const config = {
  port: Number(env("PORT", "8080")),
  businessId: env("BUSINESS_ID", "default"),
  apiKey: env("SERVER_API_KEY"), // shared secret between the website and this server
  dataDir,
  mediaDir: path.join(dataDir, "media"),
  publicUrl: publicUrl(),
  databaseUrl: env("DATABASE_URL"),
  timezone: env("TIMEZONE", "Asia/Karachi"),

  anthropicKey: env("ANTHROPIC_API_KEY"),
  claudeModel: env("CLAUDE_MODEL", "claude-sonnet-5-5"),
  // "api" = Anthropic API key (fully automatic). "local" = Claude Code on the owner's Mac, via the helper.
  claudeMode: (env("CLAUDE_MODE") || (env("ANTHROPIC_API_KEY") ? "api" : "local")) as "api" | "local",
  helperKey: env("LOCAL_HELPER_KEY"),

  pexelsKey: env("PEXELS_API_KEY"),

  meta: {
    version: env("META_GRAPH_VERSION", "v26.0"),
    token: env("META_SYSTEM_USER_TOKEN"),
    pageId: env("META_PAGE_ID"),
    igUserId: env("META_IG_USER_ID"),
  },
};

export function keyStatus() {
  return {
    anthropic: !!config.anthropicKey,
    claude_mode: config.claudeMode,
    pexels: !!config.pexelsKey,
    meta_token: !!config.meta.token,
    meta_page_id: !!config.meta.pageId,
    meta_ig_user_id: !!config.meta.igUserId,
    database: config.databaseUrl ? "postgres" : "embedded",
    public_url: config.publicUrl,
    model: config.claudeModel,
  };
}
