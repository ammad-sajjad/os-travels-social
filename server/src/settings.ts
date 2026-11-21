import { z } from "zod";
import { query } from "./db.js";
import { config } from "./config.js";

export const BrandSchema = z.object({
  business_name: z.string().default("My Business"),
  short_name: z.string().default(""),
  industry: z.enum(["travel", "general"]).default("general"),
  description: z.string().default(""),
  audience: z.string().default(""),
  language: z.string().default("English"),
  personality: z.array(z.string()).default([]),
  tones: z.array(z.object({ name: z.string(), guidance: z.string() })).default([
    { name: "Friendly", guidance: "Warm, clear, helpful." },
  ]),
  services: z.array(z.object({ name: z.string(), guidance: z.string() })).default([]),
  cta_default: z.string().default("Message us today"),
  cta_options: z.array(z.string()).default([]),
  contact: z
    .object({
      phone: z.string().default(""),
      whatsapp: z.string().default(""),
      website: z.string().default(""),
      address: z.string().default(""),
      licence: z.string().default(""),
    })
    .default({ phone: "", whatsapp: "", website: "", address: "", licence: "" }),
  good_words: z.array(z.string()).default([]),
  always: z.array(z.string()).default([]),
  never: z.array(z.string()).default([]),
  brand_hashtags: z.array(z.string()).default([]),
  hashtag_guidance: z.string().default(""),
  emoji_guidance: z.string().default("Instagram 2-5 emojis, Facebook 1-3."),
  number_format: z.string().default(""),
  extra_guidelines: z.string().default(""),
  colors: z
    .object({
      primary: z.string().default("#0F4C81"),
      accent: z.string().default("#F5B700"),
      text: z.string().default("#FFFFFF"),
    })
    .default({ primary: "#0F4C81", accent: "#F5B700", text: "#FFFFFF" }),
  logo_url: z.string().default(""),
});
export type Brand = z.infer<typeof BrandSchema>;

export const AutopilotSchema = z.object({
  enabled: z.boolean().default(false),
  time: z.string().regex(/^\d{2}:\d{2}$/).default("20:00"),
  platforms: z.array(z.enum(["facebook", "instagram"])).default(["facebook", "instagram"]),
  format: z.enum(["image", "carousel", "reel"]).default("image"),
  topics: z.array(z.string()).default([]),
  require_quality_pass: z.boolean().default(true),
});
export type Autopilot = z.infer<typeof AutopilotSchema>;

const schemas = { brand: BrandSchema, autopilot: AutopilotSchema } as const;
type Key = keyof typeof schemas;

export async function getSetting<K extends Key>(key: K): Promise<z.infer<(typeof schemas)[K]>> {
  const rows = await query(`SELECT value FROM settings WHERE business_id=$1 AND key=$2`, [config.businessId, key]);
  return schemas[key].parse(rows[0]?.value ?? {}) as any;
}

export async function setSetting<K extends Key>(key: K, value: unknown) {
  const parsed = schemas[key].parse(value);
  await query(
    `INSERT INTO settings (business_id, key, value, updated_at) VALUES ($1,$2,$3,now())
     ON CONFLICT (business_id, key) DO UPDATE SET value=EXCLUDED.value, updated_at=now()`,
    [config.businessId, key, JSON.stringify(parsed)],
  );
  return parsed;
}

export async function getRaw(key: string): Promise<any> {
  const rows = await query(`SELECT value FROM settings WHERE business_id=$1 AND key=$2`, [config.businessId, key]);
  return rows[0]?.value ?? null;
}

export async function setRaw(key: string, value: unknown) {
  await query(
    `INSERT INTO settings (business_id, key, value, updated_at) VALUES ($1,$2,$3,now())
     ON CONFLICT (business_id, key) DO UPDATE SET value=EXCLUDED.value, updated_at=now()`,
    [config.businessId, key, JSON.stringify(value)],
  );
}
