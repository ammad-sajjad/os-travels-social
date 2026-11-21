import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { config } from "./config.js";
import type { Brand } from "./settings.js";
import { industryPacks } from "./packs.js";
import { runLocal } from "./localjobs.js";

export const BriefSchema = z.object({
  format: z.enum(["image", "carousel", "reel"]).default("image"),
  platforms: z.array(z.enum(["facebook", "instagram"])).min(1),
  service: z.string().optional().default(""),
  topic: z.string().min(1),
  price: z.string().optional().default(""),
  dates: z.string().optional().default(""),
  details: z.string().optional().default(""),
  tone: z.string().optional().default(""),
  slides: z.number().int().min(3).max(10).optional().default(5),
  reel_seconds: z.number().int().min(10).max(90).optional().default(20),
  own_caption: z.string().optional().default(""),
  own_hashtags: z.string().optional().default(""),
  photo_urls: z.array(z.string()).optional().default([]),
  // Free-text instructions, one per part of the post ("chat boxes" in the form).
  visual_prompt: z.string().optional().default(""),
  caption_prompt: z.string().optional().default(""),
  hashtag_prompt: z.string().optional().default(""),
  script_prompt: z.string().optional().default(""),
  // Web page the owner pasted; the server reads it and fills in `page`.
  link_url: z.string().optional().default(""),
  use_link_image: z.boolean().optional().default(false),
  page: z
    .object({ url: z.string(), title: z.string(), description: z.string(), text: z.string(), image: z.string().nullable() })
    .nullable()
    .optional()
    .default(null),
});
export type Brief = z.infer<typeof BriefSchema>;

export const ContentSchema = z.object({
  hook: z.string().describe("Scroll-stopping first line, max 10 words"),
  headline: z.string().describe("Headline printed on the image, max 6 words"),
  points: z.array(z.string()).describe("0-3 short bullet points for the image, max 5 words each"),
  price_badge: z.string().nullable().describe("Price text for a badge, ONLY if a price is in the brief, else null"),
  cta: z.string().describe("Short call to action printed on the image"),
  image_search: z.string().describe("English description of the main background picture: place, scene, time of day, mood"),
  slides: z
    .array(z.object({ headline: z.string(), text: z.string(), image_search: z.string() }))
    .describe("Carousel slides (only when format is carousel, else empty)"),
  scenes: z
    .array(z.object({ on_screen: z.string(), image_search: z.string(), seconds: z.number() }))
    .describe("Reel scenes (only when format is reel, else empty)"),
  caption_instagram: z.string(),
  caption_facebook: z.string(),
  hashtags: z.array(z.string()),
  first_comment: z.string().nullable(),
});
export type Content = z.infer<typeof ContentSchema>;

export const CheckSchema = z.object({
  result: z.enum(["pass", "fail"]),
  checks: z.array(
    z.object({
      name: z.string(),
      status: z.enum(["pass", "fail", "warn"]),
      reason: z.string(),
      fix: z.string().nullable(),
    }),
  ),
});
export type Check = z.infer<typeof CheckSchema>;

let client: Anthropic | null = null;
function claude() {
  if (!config.anthropicKey) throw new Error("ANTHROPIC_API_KEY is not set on the server.");
  client ??= new Anthropic({ apiKey: config.anthropicKey });
  return client;
}

function list(items: string[]) {
  return items.filter(Boolean).map((s) => `- ${s}`).join("\n");
}

export function waLink(brand: Brand) {
  const digits = brand.contact.whatsapp.replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : "";
}

/** The "skill" for this business, rebuilt from Settings. Stable text so it caches well. */
export function brandInstructions(brand: Brand) {
  const c = brand.contact;
  return `# ${brand.business_name} - brand guide

## Who we are
${brand.description || "(not set)"}

## Audience
${brand.audience || "(not set)"}

## Language
Write all post text and captions in: ${brand.language}

## Personality
${list(brand.personality) || "- Helpful and trustworthy."}

## Tone presets (the brief picks one; if none, choose the best fit)
${brand.tones.map((t) => `- ${t.name}: ${t.guidance}`).join("\n")}

## Services
${brand.services.map((s) => `### ${s.name}\n${s.guidance}`).join("\n\n") || "(any)"}

## Call to action
Default: "${brand.cta_default}". Others: ${brand.cta_options.map((o) => `"${o}"`).join(", ") || "-"}

## Contact details (use exactly these, never invent others; skip empty ones)
- Phone: ${c.phone || "-"}
- WhatsApp: ${c.whatsapp || "-"}
- WhatsApp link: ${waLink(brand) || "-"}
- Website: ${c.website || "-"}
- Address: ${c.address || "-"}
- Licence no.: ${c.licence || "-"}

## Always
${list(brand.always) || "- Use the business name exactly as written above."}

## Never
${list(brand.never)}
- Never invent prices, dates, discounts, availability, guarantees or statistics that are not in the brief.
- Never write fake reviews, testimonials or customer names.

## Good words
${brand.good_words.join(", ") || "-"}

## Numbers
${brand.number_format || "-"}

## Emojis
${brand.emoji_guidance}

## Hashtags
Brand hashtags (always include): ${brand.brand_hashtags.join(" ") || "-"}
${brand.hashtag_guidance}

${brand.extra_guidelines ? `## Extra guidelines\n${brand.extra_guidelines}` : ""}

${industryPacks[brand.industry] ?? industryPacks.general}
`;
}

const WRITER_RULES = `
# Your job
You are the social media content writer for this business. You receive a brief and return one post for Facebook and Instagram as JSON.

## Hook (first line)
Max 10 words. Pick one type: question, price (only if price in brief), bold statement, POV, list ("3 jagahen..."), problem, urgency (only if seats/deadline in brief).

## Image text
- headline: max 6 words. points: max 3, max 5 words each. cta: max 5 words.
- price_badge: only if the brief gives a price, written in the brand's number format; otherwise null.
- image_search: an English description of the background picture (specific landmark or scene, time of day, mood), never just a country or a generic word. It is used to draw or find the picture. Follow the user's image instructions.

## Carousel (format = carousel)
slides: exactly the requested number. Slide 1 = the hook as headline. Middle slides = one highlight or step each. Last slide = offer + call to action. Each slide: headline (max 6 words), text (max 18 words), image_search.

## Reel (format = reel)
scenes: one per 3-5 seconds of the requested length. First scene = hook (max 3 s). Last scene = call to action. on_screen max 6 words.

## Captions
- Instagram: line 1 = the hook (first 125 characters show before "more"); 3-5 short lines (highlights, what's included, price only if in brief); CTA line with the WhatsApp number; hashtags at the end (5-10 total). Max 2,200 characters.
- Facebook: same hook, a bit more detail (up to 8 lines), CTA with the WhatsApp link; 3-5 hashtags.
- hashtags: the full list you used (with #).
- first_comment: optional extra hashtags or "More details: <WhatsApp link>", or null.

## Linked web page
If the brief includes a linked web page: use its details (places, inclusions, prices and dates exactly as written there) together with the brief, and include its URL:
- caption_facebook: put the URL on its own line near the call to action (e.g. "Details: <url>").
- caption_instagram: links are not clickable on Instagram, so write "Link in comments" near the call to action instead of the URL.
- first_comment: "Details: <url>" (plus the WhatsApp link if there is one).

## The user's instructions for each part
The brief may include separate instructions for the image, the caption, the hashtags and the reel script. Follow each one for its part, as long as it doesn't break the brand rules or the facts rule (if it does, follow the rules and keep as close to the request as possible).

## If the brief includes the user's own caption or hashtags
Keep their words. Only add what is missing (CTA, brand hashtags) and fix forbidden claims.

## Facts
Use only facts from the brief, the linked web page (if any) and the brand guide. If a fact is missing, leave it out.
`;

const CHECKER_RULES = `
# Your job
You are an independent quality checker. You did not write this content. Be strict.
Check the post against the brief and the brand guide. Return each check as pass / fail / warn with a reason, and a concrete fix for every fail.

Checks:
1. facts: every price, date, number, inclusion, discount and availability claim matches the brief or the linked web page exactly. Anything in neither = fail.
2. claims: no guarantees, "cheapest", "No. 1", fake reviews or invented names; nothing from the brand's Never list.
3. brand: business name correct; captions have a clear call to action with the correct contact detail.
4. language: written in the brand's language and style.
5. format: headline/points/hashtag counts within limits; Instagram caption under 2,200 characters.
6. sensitivity: respectful of religion and culture; modest imagery searches.
Any fail = result "fail". Warnings do not block.
`;

async function parse<T extends z.ZodType>(system: string, user: string, schema: T, effort: "low" | "medium"): Promise<z.infer<T>> {
  if (config.claudeMode === "local") {
    const raw = await runLocal(system, user, z.toJSONSchema(schema), effort);
    return schema.parse(raw) as z.infer<T>;
  }
  const response = await claude().beta.messages.parse({
    model: config.claudeModel,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort, format: betaZodOutputFormat(schema) },
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: user }],
  });
  if (response.stop_reason === "refusal") {
    throw new Error(`Claude declined this request${response.stop_details?.explanation ? `: ${response.stop_details.explanation}` : "."}`);
  }
  if (response.stop_reason === "max_tokens") throw new Error("Claude's answer was cut off (max_tokens).");
  if (!response.parsed_output) throw new Error("Claude returned an answer that did not match the expected format.");
  return response.parsed_output as z.infer<T>;
}

function describeBrief(brief: Brief, extra = "") {
  return `# Brief
- Format: ${brief.format}${brief.format === "carousel" ? ` (${brief.slides} slides)` : ""}${brief.format === "reel" ? ` (${brief.reel_seconds} seconds)` : ""}
- Platforms: ${brief.platforms.join(", ")}
- Service / category: ${brief.service || "(not given)"}
- Topic: ${brief.topic}
- Price: ${brief.price || "(only if stated in the details below; otherwise do not mention any price)"}
- Dates: ${brief.dates || "(only if stated in the details below; otherwise do not mention dates)"}
- Offer and other details: ${brief.details || "(none)"}
- Tone: ${brief.tone || "(choose the best fit)"}
- User's own caption: ${brief.own_caption || "(none - write it)"}
- User's own hashtags: ${brief.own_hashtags || "(none)"}
- Instructions for the image: ${brief.visual_prompt || "(none - choose)"}
- Instructions for the caption: ${brief.caption_prompt || "(none - follow the brand guide)"}
- Instructions for the hashtags: ${brief.hashtag_prompt || "(none - follow the brand guide)"}
- Instructions for the reel script: ${brief.format === "reel" ? brief.script_prompt || "(none - choose)" : "(not a reel)"}
- Today's date: ${new Date().toISOString().slice(0, 10)}
${brief.page ? `
# Linked web page (include this URL in the post)
- URL: ${brief.page.url}
- Title: ${brief.page.title || "(none)"}
- Description: ${brief.page.description || "(none)"}
- Page text (facts you may use):
${brief.page.text.slice(0, 6000) || "(the page had no readable text)"}
` : ""}${extra}`;
}

export async function writeContent(brand: Brand, brief: Brief, feedback?: string): Promise<Content> {
  const extra = feedback ? `\n# Fix these problems from the quality check\n${feedback}` : "";
  return parse(brandInstructions(brand) + WRITER_RULES, describeBrief(brief, extra), ContentSchema, "medium");
}

export async function checkContent(brand: Brand, brief: Brief, content: Content): Promise<Check> {
  return parse(
    brandInstructions(brand) + CHECKER_RULES,
    `${describeBrief(brief)}\n\n# Post to check\n${JSON.stringify(content, null, 2)}`,
    CheckSchema,
    "low",
  );
}

/** For autopilot: pick today's post idea. */
export async function suggestBrief(brand: Brand, topics: string[], recent: string[]): Promise<{ service: string; topic: string; tone: string }> {
  const Idea = z.object({ service: z.string(), topic: z.string(), tone: z.string() });
  return parse(
    brandInstructions(brand) +
      `\n# Your job\nSuggest ONE social media post idea for today. Consider season, upcoming holidays and variety. Do not invent prices or offers; pick an evergreen angle.`,
    `Topics the owner wants covered (rotate through them): ${topics.join("; ") || "(any of our services)"}\nRecently posted (avoid repeating): ${recent.join("; ") || "(nothing yet)"}\nToday: ${new Date().toISOString().slice(0, 10)}`,
    Idea,
    "low",
  );
}

// ---------------- "Ask Claude" edits to one part ----------------

export type RefineField = "image" | "visual" | "caption_instagram" | "caption_facebook" | "hashtags" | "first_comment";

const FIELD_HELP: Record<RefineField, string> = {
  image: "the text printed on the image(s): headline, points, price_badge, cta, and slides[].headline/text or scenes[].on_screen",
  visual: "the background picture descriptions: image_search, and slides[].image_search or scenes[].image_search",
  caption_instagram: "caption_instagram",
  caption_facebook: "caption_facebook",
  hashtags: "the hashtags list, and the hashtags at the end of caption_instagram and caption_facebook",
  first_comment: "first_comment",
};

export async function refineContent(brand: Brand, brief: Brief, content: Content, field: RefineField, instruction: string): Promise<Content> {
  return parse(
    brandInstructions(brand) + WRITER_RULES,
    `${describeBrief(brief)}

# Current post
${JSON.stringify(content, null, 2)}

# Change request from the owner
Part to change: ${FIELD_HELP[field]}
Request: ${instruction}

Return the whole post JSON. Change ONLY the part named above, exactly as requested, keeping the brand rules and facts rule. Copy every other field unchanged.`,
    ContentSchema,
    "medium",
  );
}

// ---------------- Claude-drawn backgrounds (no stock photos needed) ----------------

const ART_RULES = `
# Your job
You are an illustrator. For each description, draw one background picture as a standalone SVG.
- Style: rich flat-vector travel-poster illustration with layered shapes and gradients (sky, horizon, landmark silhouettes, water, mountains, light). Recognisable landmark shapes where named.
- NO text, letters, numbers or logos anywhere.
- No people's faces; any people are small silhouettes and modestly dressed. Respectful for religious places (exteriors only).
- The lower 45% will be covered by dark text overlay: keep detail mostly in the upper part.
- Use the exact width/height given, with viewBox set to match. Only basic SVG elements (rect, circle, ellipse, path, polygon, linearGradient, radialGradient, g). No <image>, no <text>, no external references, no filters.
- Keep each SVG under 7,000 characters.
`;

export async function drawBackgrounds(descriptions: string[], width: number, height: number): Promise<string[]> {
  const Art = z.object({ svgs: z.array(z.string()) });
  const out: string[] = [];
  for (let i = 0; i < descriptions.length; i += 3) {
    const batch = descriptions.slice(i, i + 3);
    const res = await parse(
      ART_RULES,
      `Canvas: width ${width}, height ${height}.\nDraw ${batch.length} SVG(s), in this order:\n${batch.map((d, j) => `${j + 1}. ${d}`).join("\n")}`,
      Art,
      "low",
    );
    for (let j = 0; j < batch.length; j++) out.push(res.svgs[j] ?? "");
  }
  return out;
}

// ---------------- Picking the right page on a website ----------------

/** The owner pasted e.g. a home page; pick the link on it that best matches the post topic. */
export async function pickLink(topic: string, page: { url: string; title: string; text: string; links: { url: string; text: string }[] }): Promise<string> {
  if (!page.links.length) return page.url;
  const Pick = z.object({ choice: z.enum(["this_page", "link"]), url: z.string().nullable() });
  const res = await parse(
    `# Your job
You help pick which web page a social media post should link to. The owner pasted a page and described the post topic.
- If the pasted page itself is already about the topic (e.g. a Malaysia package page for a Malaysia post), answer choice "this_page".
- Otherwise pick the ONE link from the list whose page is most specifically about the topic (destination, package, route or service), and answer choice "link" with its exact URL from the list.
- If nothing in the list fits better than the pasted page, answer "this_page".`,
    `Post topic: ${topic}

Pasted page: ${page.url}
Title: ${page.title}
Start of its text: ${page.text.slice(0, 1500)}

Links on the page:
${page.links.map((l) => `- ${l.url} | ${l.text}`).join("\n")}`,
    Pick,
    "low",
  );
  if (res.choice === "link" && res.url && page.links.some((l) => l.url === res.url)) return res.url;
  return page.url;
}
