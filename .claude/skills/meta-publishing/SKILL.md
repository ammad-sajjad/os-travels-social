---
name: meta-publishing
description: How to write the OS Travels code that publishes images, carousels and reels from local disk to a Facebook Page and Instagram professional account with the Graph API, poll status, avoid double posts, handle errors and pull insights. Use when writing or fixing src/lib/meta.ts or the publish and insights worker steps.
---

# Meta publishing (Graph API)

Settings from .env: META_GRAPH_VERSION, META_SYSTEM_USER_TOKEN, META_PAGE_ID,
META_IG_USER_ID. Get the Page token once at start: GET /{page-id}?fields=access_token.
Base: https://graph.facebook.com/{version}. Video bytes go to rupload.facebook.com.
Before writing code, check the current Meta docs for any endpoint you use; field and
metric names change between versions.

## Rules
- Save every container id / video id in the posts table BEFORE publishing.
- On any error, first read the status of the saved id. Only start a new upload if the
  old one failed or expired. Never publish twice.
- Retry network errors and 5xx 3 times (wait 30 s, 2 min, 10 min). Do not retry 4xx
  except rate limits.
- Log the full response JSON (without tokens) to posts.error / the data file.

## Facebook image
POST /{page-id}/photos, multipart: source=<jpg file>, message=<caption>. Returns post_id.

## Facebook carousel (multi-photo)
For each image: POST /{page-id}/photos with source, published=false -> id.
Then POST /{page-id}/feed with message and attached_media[0]={"media_fbid":"id"} ...

## Facebook reel
1. POST /{page-id}/video_reels upload_phase=start -> video_id, upload_url.
2. POST upload_url with headers Authorization: OAuth <page token>, offset: 0,
   file_size: <bytes>; body = MP4 bytes from disk.
3. Poll GET /{video_id}?fields=status every 10 s (max 10 min) until upload complete.
4. POST /{page-id}/video_reels upload_phase=finish, video_id, video_state=PUBLISHED,
   description=<caption>.
5. Poll status until publishing_phase is complete; save permalink.
Limit: 30 API reels per Page per 24 h. Minimum 540p.

## Instagram reel
1. POST /{ig-user-id}/media media_type=REELS, upload_type=resumable, caption,
   share_to_feed=true, cover_url or thumb_offset, is_ai_generated when needed -> id, uri.
2. POST https://rupload.facebook.com/ig-api-upload/{version}/{id} with headers
   Authorization: OAuth <token>, offset: 0, file_size: <bytes>; body = MP4 bytes.
3. Poll GET /{id}?fields=status_code every 10 s until FINISHED (fail on ERROR/EXPIRED).
4. POST /{ig-user-id}/media_publish creation_id={id} -> media id. Get permalink.

## Instagram image and carousel
Instagram downloads images itself, so it needs a public URL:
1. tunnel.ts: copy the JPG to the tunnel folder under a random 32-char name, giving
   PUBLIC_MEDIA_BASE_URL/<token>.jpg (Cloudflare Tunnel serves only this folder).
2. Image: POST /{ig-user-id}/media image_url, caption -> id; publish as above.
   Carousel: one container per image with image_url and is_carousel_item=true, then
   POST /{ig-user-id}/media media_type=CAROUSEL, children=<ids comma separated>,
   caption -> id; wait FINISHED; publish.
3. Delete the temporary files right after the containers are FINISHED.

## Limits and checks
- Before each Instagram post: GET /{ig-user-id}/content_publishing_limit; stop if used up.
- Daily: GET /debug_token for the system user token; WhatsApp alert if invalid or a
  permission is missing.

## Insights
- Instagram: GET /{ig-media-id}/insights?metric=reach,views,likes,comments,shares,saved,
  total_interactions (+ ig_reels_avg_watch_time for reels). Check current metric names.
- Facebook: GET /{post-id}/insights for posts; reels/videos via /{video-id}/video_insights.
- Schedule: 1 h, 24 h, 72 h, 7 d, then weekly for 4 weeks. Save to stats and append to
  the item's data file.

## Common errors
190 token invalid -> alert, stop publishing. 200/10 permission -> alert Admin.
4 / 17 / 32 / 613 rate limit -> wait 1 h. IG subcode 2207042 -> daily limit, move to tomorrow.
Media ERROR -> mark failed, keep files, alert.
