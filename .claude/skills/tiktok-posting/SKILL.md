---
name: tiktok-posting
description: How to add TikTok Direct Post publishing to the OS Travels app, including the screens the TikTok audit requires. Use only when building the TikTok phase.
---

# TikTok posting

- App on TikTok for Developers with Login Kit + Content Posting API (Direct Post).
  Scopes: user.info.basic, video.publish.
- Until the app passes TikTok's audit, posts can only be private and only 5 users per day
  can post; posts made before the audit stay private. Apply for the audit early.
- Before posting, call /v2/post/publish/creator_info/query/ and show: account name and
  avatar, privacy options returned (user must choose, no default), comment / duet /
  stitch switches, max video length.
- Commercial content disclosure: OS Travels promotions are "Your brand"; show TikTok's
  required wording and checkbox.
- Upload: POST /v2/post/publish/video/init/ with source FILE_UPLOAD (file from disk,
  chunked) -> upload_url; PUT the bytes; poll /v2/post/publish/status/fetch/ until
  PUBLISH_COMPLETE.
- Around 15 posts per day per account. Save publish_id first; never post twice.
- Mark AI-generated content when a synthetic voice or AI images are used.
- Caption: the short TikTok caption from captions-hashtags.
- Check the current TikTok developer docs before coding; field names change.
