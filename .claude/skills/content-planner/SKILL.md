---
name: content-planner
description: Turns an OS Travels brief into a content plan - three hook options, reel structure for 30/45/60/90 seconds, a scene list with photo searches, the image post layout and carousel slides - and applies approved learnings. Use first for every new post or reel, and when choosing photos for scenes.
---

# Content planner

Read os-travels-brand and services-and-destinations first. Call get_country_profile for
each country and get_learnings. Apply every approved learning that matches the service,
country or format, and list their ids in used_learnings.

## 1. Hooks (first 3 seconds)
Write 3 options, max 10 words, each a different type:
- question: "Kya aap ne Cappadocia ke hot air balloons dekhe hain?"
- price: "Sirf PKR 1,95,000 mein poora Baku!" (only if price in brief)
- bold: "Turkey is saal ki behtareen family destination hai."
- pov: "POV: Aap Bosphorus cruise par hain..."
- list: "Georgia ki 3 jagahen jo aap ko hairan kar dengi."
- problem: "Schengen visa ka process mushkil lagta hai? Ab nahi."
- urgency: "Sirf 10 seats baqi!" (only if seats/deadline in brief)
Set hook.type to the type used.

## 2. Structure by length
- 30 s: 5-6 scenes. hook, 3 highlights, offer, CTA.
- 45 s: 7-8 scenes. hook, 4 highlights, included, offer, CTA.
- 60 s: 8-10 scenes. hook, why this place, 5 highlights, included, offer, trust line, CTA.
- 90 s: 11-14 scenes. hook, day-by-day story, included, visa help, offer, trust, CTA.
Scene 3-6 s; first scene max 3 s; last scene (logo + WhatsApp) 3-4 s.
Template: "destination" for tours, "offer" for deals/tickets/visa, "umrah" for Umrah.

## 3. Scenes
For each scene: id, search (specific, e.g. "Blue Mosque Istanbul exterior golden hour",
never just "Turkey"), on_screen (max 4 words), motion (zoom_in, zoom_out, pan_left,
pan_right, static). Vary shots: wide landmark, street/food, people enjoying (modest),
hotel/transport, close detail.

## 4. Choosing photos
Call search_library first, then search_pexels if nothing fits. Look at each candidate
image and reject it if: it shows another country or city, a visible brand logo, a
celebrity, immodest clothing, text/watermarks, or low quality. For Umrah, no close-ups
of people praying. Prefer vertical images for reels. Save the chosen media_id.

## 5. Image post and carousel
- post.template: price_hero (photo + big price), destination (photo + 3 points),
  visa_service (steps with icons).
- headline max 6 words; points max 5 words each, max 3 points.
- Carousel: slide 1 = hook as headline; slides 2 to n-1 = one highlight or step each;
  last slide = offer + CTA. 3-10 slides.

## 6. Output
Return only the plan JSON (see the plan format in the build guide) and call save_plan.
If save_plan returns errors, fix exactly those fields and call it again.
Never invent prices, dates, inclusions, seats or visa facts.
