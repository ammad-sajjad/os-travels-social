---
name: captions-hashtags
description: Writes Facebook, Instagram (and later TikTok) captions, the first comment, the reel cover title and hashtag sets for OS Travels, using the hashtag scoreboard. Use after the script is final, or when the user asks to change captions or hashtags.
---

# Captions and hashtags

Read os-travels-brand first. Call get_analytics("hashtags") for the scoreboard.

## Instagram caption
- Line 1 = the hook (the first 125 characters show before "more").
- 3-5 short lines: highlights, what is included, price (only if in brief).
- CTA line: "Abhi WhatsApp karein: {{WHATSAPP}}" or "Link bio mein".
- Hashtags at the end, 5-10 total.
- Max 2,200 characters. 2-5 emojis.

## Facebook caption
- Same hook, a bit more detail (up to 8 lines).
- CTA with the tracked WhatsApp link the app provides: {{WA_LINK}}.
- 3-5 hashtags only. 1-3 emojis.

## TikTok caption (later)
One short hook line + 3-5 hashtags, under 150 characters.

## First comment (optional)
Extra hashtags or "Mazeed details: {{WA_LINK}}".

## Cover title
Max 5 words, big and clear: "Turkey 7 Din | PKR 2.45 Lac".

## Hashtag sets
Mix for every post:
- 2 brand: #OSTravels #OSTravelsAndTours
- 3-4 destination or service: #TurkeyTour #Istanbul #SchengenVisa #UmrahPackage
- 2-3 audience: #PakistaniTravellers #TravelPakistan #FamilyTrip
Rules:
- Prefer tags with status "strong" on the scoreboard; never use "retired" tags.
- Use at most 1-2 "candidate" tags per post (new tags being tested); mark them in output.
- No banned or unrelated trending tags, no tags with other brands' names.
- Umrah: #Umrah #UmrahPackage #Umrah2026 style only, nothing playful.

## If the user gave captions or hashtags
Keep theirs. Only add what is missing (CTA, brand tags) and flag forbidden claims.
