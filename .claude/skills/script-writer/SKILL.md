---
name: script-writer
description: Writes OS Travels reel scripts as short lines in both Roman Urdu (subtitles) and Urdu script (for the voice), converts a user's own script in as-is, polish or rewrite mode, and applies "Ask Claude" edits. Use for every reel script, own script, or script change.
---

# Script writer

Read os-travels-brand first. Load the spelling and pronunciation lists with
get_country_profile (pronunciations) and the words table.

## Output: one object per line
{"id": 1, "scene": 1, "roman": "...", "urdu": "...", "pause_after_ms": 200}
- roman: what viewers read. urdu: what the voice reads. Same meaning, same order.

## Word budget (spoken at about 2.3-2.6 words per second)
30 s: 65-75 words | 45 s: 100-110 | 60 s: 135-150 | 90 s: 200-220.
Count the roman words. Stay inside the budget.

## Style
- Everyday Pakistani Urdu: zabardast, shaandaar, bilkul, aaraam se. Not bookish, not Hindi.
- 6-12 words per line, one idea per line, so each line fits two subtitle rows.
- Talk to the viewer: "aap", "aap ki family".
- English travel words stay English. In the urdu line write them in Urdu script:
  package = پیکج, visa = ویزا, hotel = ہوٹل, flight = فلائٹ, tour = ٹور, booking = بکنگ.
- Numbers and prices: digits in roman ("PKR 2,45,000"), words in urdu ("دو لاکھ پینتالیس ہزار روپے").
- Place names: use the urdu spelling from the pronunciation list. If a name is not in
  the list, write your best Urdu spelling and add it to new_pronunciations in the output
  so staff can check it.
- One fixed roman spelling per word, from the spelling list (khoobsurat, zabardast,
  safar, mulk, Umrah, Makkah, Madinah).
- Pauses: 150-300 ms between lines; 500 ms before the price line and before the CTA.
- Last line is always the CTA from the brand skill.

## Own script mode (script_source = "own")
The user gives text in Roman Urdu, Urdu or English and picks a mode:
- as_is: do NOT change any wording. Only split into lines, assign scenes, and produce
  the other script (Urdu script from Roman, or Roman from Urdu). If the text is English,
  keep it English in roman and write the same English words in Urdu script for the
  voice only if the user chose an Urdu voice; otherwise tell the app to use an English voice.
- polish: keep meaning and most words; fix spelling to the spelling list, shorten long
  lines, add the CTA if missing, fix forbidden claims. List every change as
  {"before": "...", "after": "...", "why": "..."}.
- rewrite: write a new script using the user's points and facts; list what was kept.
In every mode: estimate seconds (words / 2.4). If outside +-10% of the chosen length,
return a warning with a suggestion (cut lines X and Y, or choose 45 s). Never drop lines
silently. Forbidden claims are always flagged, even in as_is mode.

## Edits ("Ask Claude")
The request can be Urdu, Roman Urdu or English. Change only what is asked. Return the
changed line ids so only those lines are re-voiced. Keep the word budget.
