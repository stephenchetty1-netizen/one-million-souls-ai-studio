export function snapMsToFrame(ms, fps = 30) {
  const frameMs = 1000 / fps
  return Math.round(Number(ms) / frameMs) * frameMs
}

export function validateThumbnail(input = {}) {
  const mode = String(input.mode || 'SHORT').toUpperCase()
  const words = String(input.text || '').trim().split(/\s+/).filter(Boolean)
  const maxWords = mode === 'LONG' ? 5 : 4
  const checks = {
    focalPoint: Boolean(input.focalPoint && String(input.focalPoint).trim()),
    textLength: words.length <= maxWords,
    mobileReadable: input.mobileReadable === true,
    highContrast: input.highContrast === true,
    cleanMargins: input.cleanMargins === true,
    truthful: input.truthful === true,
    noClutter: input.noClutter === true,
    naturalHeroVisual: input.naturalHeroVisual === true,
    spellingChecked: input.spellingChecked === true,
  }
  return {
    status: Object.values(checks).every(Boolean) ? 'PASS' : 'BLOCK',
    checks,
    maxWords,
    wordCount: words.length,
  }
}

export function validateContentQuality(input = {}) {
  const checks = {
    scriptureVerified: input.scriptureVerified === true,
    factsVerified: input.factsVerified === true,
    modernLanguage: input.modernLanguage === true,
    clearTakeaway: input.clearTakeaway === true,
    motivating: input.motivating === true,
    strongHook: input.strongHook === true,
    captivatingPacing: input.captivatingPacing === true,
    noGenericFiller: input.noGenericFiller === true,
    noGuaranteedOutcome: input.noGuaranteedOutcome === true,
    originalExpression: input.originalExpression === true,
    ctaFitsMessage: input.ctaFitsMessage === true,
  }
  return {
    status: Object.values(checks).every(Boolean) ? 'PASS' : 'BLOCK',
    checks,
  }
}

export function normalizeLyricTimeline(timeline = [], fps = 30) {
  return timeline.map((cue, index) => {
    const startMs = snapMsToFrame(cue.startMs, fps)
    const endMs = snapMsToFrame(cue.endMs, fps)
    return {
      index,
      text: String(cue.text || '').trim(),
      startMs,
      endMs,
      confidence: Number(cue.confidence ?? 0),
      source: cue.source || 'unknown',
    }
  })
}

export function validateLyricTimeline(input = {}) {
  const fps = Number(input.fps || 30)
  const toleranceMs = Number(input.toleranceMs || 80)
  const cues = normalizeLyricTimeline(input.timeline || [], fps)
  const problems = []

  if (input.alignmentSource !== 'final-vocal-track') {
    problems.push('Alignment must be derived from the final vocal track.')
  }
  if (!cues.length) problems.push('No lyric cues supplied.')

  let lastEnd = -1
  for (const cue of cues) {
    if (!cue.text) problems.push(`Cue ${cue.index + 1} has no text.`)
    if (!(cue.startMs >= 0) || !(cue.endMs > cue.startMs)) {
      problems.push(`Cue ${cue.index + 1} has invalid timing.`)
    }
    if (cue.startMs < lastEnd - toleranceMs) {
      problems.push(`Cue ${cue.index + 1} overlaps the previous cue.`)
    }
    if (cue.confidence < 0.85) {
      problems.push(`Cue ${cue.index + 1} alignment confidence is below 0.85.`)
    }
    lastEnd = Math.max(lastEnd, cue.endMs)
  }

  const reviewedSections = new Set((input.reviewedSections || []).map(String))
  for (const required of ['intro','chorus','bridge','final-chorus']) {
    if (!reviewedSections.has(required)) problems.push(`Missing sync review: ${required}.`)
  }

  const maxObservedDriftMs = Number(input.maxObservedDriftMs ?? Infinity)
  if (!Number.isFinite(maxObservedDriftMs) || maxObservedDriftMs > toleranceMs) {
    problems.push(`Observed lyric drift exceeds ${toleranceMs} ms.`)
  }

  return {
    status: problems.length === 0 ? 'PASS' : 'BLOCK',
    fps,
    toleranceMs,
    maxObservedDriftMs,
    cueCount: cues.length,
    timeline: cues,
    problems,
  }
}
