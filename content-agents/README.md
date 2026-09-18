# One Million Souls Content Agent Team

This directory defines a staged AI content-production system for Christian Shorts, long-form videos, and original/public-domain lyric videos.

## Core rule

The team may learn from trends, but it must not copy another creator's script, footage, song, thumbnail, or edit shot-for-shot. It may reuse formats and ideas such as hook patterns, pacing, topic framing, scene rhythm, and title structures.

Every external asset must have a rights record before it can enter production.

## Agent team

1. Trend Scout
   - Finds current Christian topics, search questions, hooks, formats, and audience patterns.
   - Produces trend briefs, not copied scripts.

2. Rights Scout
   - Verifies source, license, creator, attribution requirement, commercial-use permission, and any model/trademark concerns.
   - Blocks unknown or ambiguous rights.

3. Theology Guard
   - Checks Scripture references, context, quotations, doctrine-sensitive claims, and avoids invented Bible verses.

4. Script Writer
   - Produces original short-form and long-form scripts from approved trend briefs.

5. Asset Scout
   - Finds licensed stock video first, then images only when moving footage is unavailable.
   - Prefers realistic human footage, Bible/prayer/worship/nature footage, and avoids obvious AI-looking visuals.

6. Music Director
   - Uses original generated music, YouTube Audio Library tracks when appropriate for YouTube, or other licensed tracks recorded in the rights ledger.
   - Never assumes "royalty free" means unrestricted.

7. Visual Director
   - Builds cinematic shot lists, typography, color grade, captions, transitions, and thumbnails.

8. Shorts Editor
   - Produces 9:16 videos with a strong first-second hook, fast visual changes, clean captions, and a clear CTA.

9. Long-form Producer
   - Produces 16:9 teaching/devotional/story videos with chapters, B-roll, music beds, and Shorts cutdowns.

10. Lyric Video Producer
   - Produces lyric videos only from original songs/lyrics, user-owned songs, or verified public-domain text/tune/recordings.
   - Modern copyrighted worship lyrics are blocked unless rights are supplied.

11. QA Agent
   - Checks media integrity, caption timing, clipping, spelling, audio levels, factual/theological accuracy, source rights, and visual quality.

12. Publisher
   - Can publish only when QA=PASS, rights=PASS, theology=PASS, and user/publication policy allows it.

13. Analytics Learner
   - Reads performance, identifies retention/drop-off patterns, and feeds lessons back into the next brief.

## Production modes

### SHORT
15-45 sec, 9:16, one idea, one emotional arc, one CTA.

### LONG
4-12 min by default, 16:9, searchable topic, structured teaching/story, multiple B-roll sequences.

### LYRIC
Original song or verified public-domain material only. Lyrics are timed at phrase level and visually designed to remain readable on mobile.

## Quality gates

A render is NOT publishable if any of these fail:
- rightsStatus != PASS
- theologyStatus != PASS
- factualStatus != PASS
- mediaIntegrity != PASS
- captionSync != PASS
- audioMix != PASS
- visualQuality != PASS
- originality != PASS

## Rollout

The agent team is intentionally staged separately from the live publisher. Test generated briefs and asset ledgers first, then connect rendering, then connect Metricool publishing only after review.
