---
name: reel-and-voice-pipeline
description: How to build the OS Travels voice, subtitle and rendering code - ElevenLabs per-line synthesis with timing, own voice uploads, Remotion (or FFmpeg) reel and image templates at 1080x1920 and 1080x1350, music ducking, file naming and saving. Use when writing src/lib/elevenlabs.ts, src/worker/steps/voice.ts, render.ts or anything in src/remotion.
---

# Reel and voice pipeline

## Voice (ElevenLabs)
- For each script line: POST /v1/text-to-speech/{voice_id}/with-timestamps with
  text = line.urdu, the current multilingual model, output mp3_44100_128.
- Save to audio/.../<item>/line-01.mp3. Cache by sha1(voice_id + model + text): if the
  file exists, reuse it (saves money on edits).
- Duration of each line = ffprobe of the file. Line start = sum of previous durations
  + pauses (pause_after_ms).
- Word highlight: split the line's time across roman words by syllable count.
- Own recording: run it through loudnorm; split by silence if possible, otherwise show
  each roman line for a share of time proportional to its word count.
- Backup (Azure ur-PK-AsadNeural / ur-PK-UzmaNeural) only if ElevenLabs fails twice.

## Audio mix
Concatenate lines with pauses -> voice.mp3. Music under voice: about -20 LUFS with
sidechain ducking; final mix loudnorm to about -14 LUFS. ffmpeg filters: loudnorm,
sidechaincompress, amix.

## Remotion reel
- Composition 1080x1920, 30 fps, durationInFrames = ceil(total audio seconds x 30)
  + intro (45 frames) + outro (105 frames).
- Props = the plan JSON + audio paths + timings + brand kit (logo paths, colours, fonts).
- Layers: background scene media (Ken Burns per scene.motion), dark gradient bottom,
  logo top corner (12-15% width), on_screen text, Roman subtitles (2 lines max, ~32
  chars per line, white with dark outline, current word in brand colour), price badge
  near the end, outro card (logo, "Abhi WhatsApp karein", number, website, licence).
- Safe zones: no text in the top 250 px or bottom 400 px.
- Templates: Destination.tsx, Offer.tsx, Umrah.tsx (calm cross-fades, gold/white, no music).
- Render with @remotion/renderer renderMedia: codec h264, crf about 20, audio aac.
  Then ffmpeg -movflags +faststart.
- Cover: renderStill of a strong frame with the cover title.

## Images
Post.tsx (1080x1350) templates price_hero, destination, visa_service; Carousel.tsx renders
one still per slide. renderStill to JPG, quality 90.

## Files
- Name: YYYY-MM-DD_<CODES>_<Country>_<Service>_<format>_v<N>.<ext> (see build guide).
- Save to CONTENT_ROOT/videos|images|audio|data/<YYYY>/<MM-Month>/. Never overwrite;
  bump v. Write the item's data JSON after render and update it after publish and
  each stats pull.
- Work in _temp and move finished files into place only when complete.
- Before rendering, check free disk space (warn 80%, stop 95%).

## FFmpeg-only alternative
If Remotion is not used: build each scene with zoompan, overlay logo PNG, drawtext or
ASS subtitles (libass, with the Urdu/Latin fonts), concat scenes, add the mixed audio.
