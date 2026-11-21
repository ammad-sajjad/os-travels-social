# Social Autopilot

Create a Facebook + Instagram post with Claude in under a minute, check it, and post it — or let it post once a day by itself.

- **`web/`** — the website (Next.js) → deploy to **Vercel**. Login, New post form, preview & edit, History, Brand settings, Connections.
- **`server/`** — the backend (Node) → deploy to **Railway**. Claude writing + quality check, image/carousel/reel rendering, Facebook & Instagram publishing, scheduler, daily autopilot.
- **`.claude/skills/`** — the original OS Travels skills from the build guide (reference for Claude Code while developing). The app itself rebuilds these from the **Brand** settings page, so each client gets their own.

## How it works

```
Owner's browser ──► Vercel website ──(secret key)──► Railway server ──► Claude (writes + checks)
                                                         │          ──► Pexels (stock photos)
                                                         │          ──► Meta Graph API (Facebook / Instagram)
                                                         ├── Postgres (posts, settings)
                                                         └── Volume /data (images & videos, public links)
```

1. Owner logs in → **New post**: picks image / carousel / reel, Facebook / Instagram / both, fills in topic, price, dates, details (optional own photos or caption).
2. Claude writes the post using the brand rules, then a second independent Claude pass checks it (wrong prices, guarantees, forbidden words…). If it fails, Claude fixes it once automatically.
3. The server makes the branded image(s) or reel (logo, colours, price badge, WhatsApp number).
4. Owner sees the preview, can edit captions and image text, then **Post now** or **Schedule**.
5. Optional **Autopilot**: every day at a set time Claude picks a topic and posts by itself (only if the quality check passes, unless you change that).

Safety: each platform's result is saved; a platform that already published is never posted again. Keys live only on Railway; the browser never sees them.

---

## Selling to a new client (Option A: one copy per client)

Same code, new deployment, new keys. About an hour:

1. Railway: new project from this repo's `server/` folder (+ Postgres + volume). Set the client's keys.
2. Vercel: new project from `web/`. Set the server address, shared secret and the client's login.
3. Client logs in → **Brand & autopilot**: business name, logo, colours, contacts, services, tone, rules. (Travel agencies can load the OS Travels preset and edit it.)
4. **Connections** page → *Test Facebook & Instagram connection*.

---

## 1. Deploy the backend on Railway

1. Push this folder to a GitHub repo (private).
2. railway.com → **New Project → Deploy from GitHub repo** → choose the repo → in the service **Settings** set **Root Directory** to `server`. It builds with the included `Dockerfile` (FFmpeg and fonts are installed there).
3. **+ New → Database → PostgreSQL**. Then in the server service → Variables → add `DATABASE_URL` = `${{Postgres.DATABASE_URL}}`.
4. Server service → **Settings → Volumes → Add volume**, mount path **`/data`** (images and videos are kept here).
5. Server service → **Settings → Networking → Generate Domain** (gives `https://xxxx.up.railway.app`). Instagram downloads images from this address, so it must be public.
6. **Variables** (see `server/.env.example`):

| Variable | Value |
|---|---|
| `SERVER_API_KEY` | a long random string (e.g. `openssl rand -hex 32`) — same value goes into Vercel |
| `ANTHROPIC_API_KEY` | from console.anthropic.com (set a monthly spend limit there) |
| `CLAUDE_MODEL` | `claude-sonnet-5-5` (default, as in the build guide) |
| `PEXELS_API_KEY` | free from pexels.com/api (optional) |
| `META_GRAPH_VERSION` | `v26.0` |
| `META_SYSTEM_USER_TOKEN`, `META_PAGE_ID`, `META_IG_USER_ID` | see **Meta setup** below |
| `TIMEZONE` | `Asia/Karachi` |
| `DATA_DIR` | `/data` |

Check: open `https://<your-railway-domain>/health` → `{"ok":true}`.

## 2. Deploy the website on Vercel

1. vercel.com → **Add New → Project** → import the same repo → **Root Directory: `web`**.
2. Environment variables (see `web/.env.example`):

| Variable | Value |
|---|---|
| `SERVER_URL` | the Railway domain, e.g. `https://xxxx.up.railway.app` |
| `SERVER_API_KEY` | same value as on Railway |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | the owner's login |
| `SESSION_SECRET` | another long random string |
| `NEXT_PUBLIC_APP_NAME` | e.g. `OS Travels Social` |

3. Deploy, open the site, log in, go to **Connections**.

Note: Vercel's free Hobby plan is for non-commercial use; use Pro for a business.

## 3. Meta setup (once per client, about 1 hour)

Posting to the client's **own** Page and Instagram normally works without Meta App Review.

1. **Meta Business Suite**: the Facebook Page and the Instagram account are both in the business portfolio; Instagram is a **Professional (Business)** account linked to the Page.
2. **developers.facebook.com → Create app → type Business** → choose the business portfolio. Add products **Facebook Login for Business** and **Instagram (Instagram API with Facebook Login)**. Set the app to **Live**.
3. **Business Settings → Users → System users → Add** (role Admin). **Assign assets**: the Page (full control), the Instagram account, the app.
4. **Generate token** for the system user, select the app, expiry **Never**, permissions:
   `pages_show_list, pages_read_engagement, pages_manage_posts, pages_manage_engagement, publish_video, read_insights, instagram_basic, instagram_content_publish, instagram_manage_insights, instagram_manage_comments, business_management`
5. Find IDs in **Graph API Explorer** with that token: `GET /me/accounts` → Page ID; `GET /{page-id}?fields=instagram_business_account` → Instagram user ID.
6. Put the token and both IDs into Railway variables → **Connections → Test**.

If publishing returns a permission error, submit App Review for `pages_manage_posts` and `instagram_content_publish`.

## Run locally

```bash
# backend (uses an embedded database if DATABASE_URL is empty)
cd server && npm install && SERVER_API_KEY=dev npm run dev        # http://localhost:8080
# website
cd web && npm install && cp .env.example .env.local   # set SERVER_URL=http://localhost:8080, SERVER_API_KEY=dev, login, SESSION_SECRET
npm run dev                                           # http://localhost:3000
```

Helpers: `npx tsx scripts/render-test.ts` (renders sample image/carousel/reel without any keys), `npx tsx scripts/demo-post.ts` (adds a sample post to try the preview page).
Instagram cannot fetch images from `localhost`, so real Instagram posting only works once the server is on Railway (Facebook works locally).

## What's in each format

| Format | Size | Facebook | Instagram |
|---|---|---|---|
| Single image | 1080×1350 JPG | Page photo post | Feed post |
| Carousel | 3–10 × 1080×1350 | Multi-photo post | Carousel |
| Reel | 1080×1920 MP4, 15–60 s, photo slideshow with zoom, on-screen text, price + WhatsApp end card | Reel | Reel (shared to feed) |

## Next steps (not built yet)

- Voice-over for reels (ElevenLabs Urdu voice + subtitles) and licensed background music.
- Analytics: pull likes/reach/WhatsApp clicks, weekly Claude lessons, hashtag scoreboard.
- Multiple users/roles, TikTok, multi-client single website (Option B, needs Meta App Review).
