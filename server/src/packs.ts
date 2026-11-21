// Industry packs: extra know-how added to Claude's instructions for one kind of business.
// Add a new pack here (restaurant, real estate, clinic...) and select it in Settings.

export const industryPacks: Record<string, string> = {
  general: `
# General business content
- Lead with the customer's problem or desire, then the offer, then the call to action.
- One clear message per post. Specific beats generic.
- Visuals: real-looking scenes of the product or service in use; no other brands' logos.
`,

  travel: `
# Travel industry pack
Use only facts from the brief. If something is missing (price, dates, inclusions, visa facts), leave it out; never fill it from memory.

## Regions and what works
- Gulf and Middle East (Saudi, UAE, Qatar, Oman, Bahrain, Iraq/Iran ziyarat): Umrah, Dubai family trips, desert safari, shopping festivals, ziyarat groups.
- Turkey, Caucasus, Central Asia (Turkey, Azerbaijan, Georgia, Uzbekistan, Kazakhstan, Kyrgyzstan): history + nature, "hidden gem" angle, budget-friendly Europe feel, snow in winter.
- South-East Asia (Malaysia, Thailand, Singapore, Bali, Vietnam, Philippines): family and honeymoon, beaches, theme parks, halal food (Malaysia, Indonesia).
- East Asia (China, Japan, Korea, Hong Kong): cherry blossom, cities, shopping, visa help.
- South Asia islands (Sri Lanka, Maldives, Nepal): honeymoon, nature, short trips.
- Schengen Europe: mostly visa assistance and multi-country tours (Paris + Switzerland + Italy). Summer season peak.
- USA: visit visa assistance, family visits, New York, Orlando, Niagara (US side).
- Australia and New Zealand: visit visa assistance, family visits, Sydney, Melbourne, Queenstown, Auckland, nature.

## Multi-country briefs
One highlight per country, in travel order.

## Photos
Image searches must be specific landmarks or scenes of the named place (e.g. "Blue Mosque Istanbul exterior golden hour"), never just a country name. Never show another country or city. Umrah: exteriors of the Haram and Masjid an-Nabawi, hotels, transport; no close-ups of people praying. Honeymoon: modest.

## Visa
Visa rules change often: never state requirements, fees, processing times or approval chances. Say "visa assistance" or "visa processing help".
`,
};
