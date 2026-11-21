// Ready-made brand presets. A new client can start from one and edit it in Settings.
import type { Brand } from "./settings.js";

export const presets: Record<string, { label: string; brand: Partial<Brand> }> = {
  "os-travels": {
    label: "OS Travels and Tours (travel agency, Roman Urdu)",
    brand: {
      business_name: "OS Travels and Tours",
      short_name: "OS Travels",
      industry: "travel",
      description:
        "A Pakistani travel agency: tour packages, visit visa assistance, air ticketing, Umrah packages, hotel booking and honeymoon trips across Asia, the Gulf, Schengen Europe, the USA, Australia and New Zealand.",
      audience:
        "Pakistani families, couples, young professionals and overseas Pakistanis, on mobile, reading Roman Urdu.",
      language:
        "Roman Urdu (Urdu written in English letters), everyday Pakistani spoken style with natural English travel words. Not bookish Urdu, not Hindi.",
      personality: [
        "Trustworthy first: clear prices, no hidden surprises, honest promises.",
        "Warm and family-friendly: like an experienced elder brother or sister, not a salesman.",
        "Excited about travel, never exaggerated.",
      ],
      tones: [
        { name: "Exciting", guidance: 'Tours and deals. Punchy hooks, "zabardast", "shaandaar".' },
        { name: "Family", guidance: 'Family packages, school holidays. Warm, safe, "apni family ke saath".' },
        { name: "Luxury", guidance: 'Premium and honeymoon. Calm, elegant, few emojis, "yaadgaar lamhay".' },
        { name: "Budget", guidance: 'Low prices, students. Direct, value first, "kam budget mein".' },
        { name: "Religious", guidance: "Umrah. Respectful, peaceful, no hype, no jokes, no music words." },
      ],
      services: [
        { name: "Tour package", guidance: "Sell the experience: 3-5 highlights, then what is included (only from the brief), then price and CTA. Angles: dream destination, family memories, value." },
        { name: "Visit visa assistance", guidance: 'Sell the easy, trusted process, not the visa. Problem ("process mushkil lagta hai?") -> our help (file preparation, appointment booking, document checklist) -> CTA. Always say "visa assistance". Never promise approval, timing or fees.' },
        { name: "Air ticketing", guidance: 'Route + fare (only if in brief) + "best fares, quick booking on WhatsApp". Generic aircraft/airport/skyline visuals. No airline logos.' },
        { name: "Umrah package", guidance: "Respectful and calm. Package level, nights in Makkah and Madinah, hotel distance to Haram, transport, visa, ziyarat (only if in brief). No music words, no jokes, no 'masti'. Use the Religious tone." },
        { name: "Hotel booking", guidance: "Comfort, location, price. One hotel type per post." },
        { name: "Honeymoon package", guidance: "Romantic but modest: couples walking, sunsets, resorts. No swimwear close-ups or kissing. Luxury tone." },
        { name: "Custom / other", guidance: "Follow the brief." },
      ],
      cta_default: "Abhi WhatsApp karein",
      cta_options: ["Seats limited hain, aaj hi book karein", "Details ke liye WhatsApp karein"],
      good_words: ["safar", "khoobsurat", "zabardast", "shaandaar", "yaadgaar", "aaraam se", "bharosa", "family ke saath", "complete package", "all inclusive", "visa assistance", "guided tour", "best price"],
      always: [
        "Brand name exactly: OS Travels and Tours (hashtag #OSTravels).",
        "End with a clear call to action.",
      ],
      never: [
        '"100% visa guarantee", "visa pakka", "guaranteed approval" - we give visa assistance only.',
        '"Cheapest in Pakistan", "No. 1 agency" or any claim we cannot prove.',
        "Prices, dates, seats, inclusions, discounts, hotel stars or airlines not in the brief.",
        "Visa requirements, fees or processing times.",
        "Fake reviews, testimonials or customer names.",
        "Hindi-only words: yatra, sundar, dhanyavaad, pariwar (use safar, khoobsurat, shukriya, ghar walay).",
        "Mocking any country, culture, religion or competitor.",
      ],
      brand_hashtags: ["#OSTravels", "#OSTravelsAndTours"],
      hashtag_guidance:
        "2 brand tags + 3-4 destination or service tags (#TurkeyTour #Istanbul #SchengenVisa #UmrahPackage) + 2-3 audience tags (#PakistaniTravellers #TravelPakistan #FamilyTrip). Umrah: #Umrah #UmrahPackage style only, nothing playful.",
      emoji_guidance: "Instagram 2-5, Facebook 1-3 (plane, globe, island, phone). Umrah: kaaba and dua hands only, sparingly.",
      number_format: 'Prices: PKR 2,45,000/- (Pakistani grouping). Dates: "15 March", "15 se 22 March tak". Duration: "7 din 6 raatein".',
      colors: { primary: "#0B3C5D", accent: "#F2A900", text: "#FFFFFF" },
    },
  },
};
