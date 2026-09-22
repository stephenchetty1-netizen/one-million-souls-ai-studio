import { readFile } from 'node:fs/promises'
import path from 'node:path'

const RULES = [
  { title: 'DO NOT CARRY TOMORROW', pattern: /\b(tomorrow|anxious|anxiety|worr(?:y|ies|ied)|overwhelm)\b/i },
  { title: 'GRACE IN WEAKNESS', pattern: /\b(weak|weakness|grace|not strong)\b/i },
  { title: 'GOD IS NEAR', pattern: /\b(broken|heartbreak|pain|hurting|heavy heart)\b/i },
  { title: 'YOU ARE NOT ALONE', pattern: /\b(lonely|alone|isolated|forgotten)\b/i },
  { title: 'KEEP PRAYING', pattern: /\b(pray|praying|prayer|waiting for an answer)\b/i },
  { title: 'BE STILL', pattern: /\b(still|silence|be quiet|panic)\b/i },
  { title: 'LET YOUR LIGHT SHINE', pattern: /\b(light|shine|good works)\b/i },
  { title: 'NOTHING CAN SEPARATE YOU', pattern: /\b(separate|god.s love)\b/i },
  { title: 'START AGAIN WITH GOD', pattern: /\b(mercy|new start|start again|forgiv)\b/i },
  { title: 'RUN YOUR RACE', pattern: /\b(race|endurance|comparison|persever)\b/i },
  { title: 'GOD IS STILL WORKING', pattern: /\b(still working|god.s plan|difficult chapter)\b/i },
  { title: 'FAITH OVER FEAR', pattern: /\b(fear|afraid|trust|uncertain|uncertainty|way forward|cannot see|can't see|guidance|faith)\b/i },
]

export class UnmatchedCuratedTopicError extends Error {
  constructor(availableTopics) {
    super('No exact curated devotional covers this topic. Choose an available curated topic; no AI text was generated.')
    this.name = 'UnmatchedCuratedTopicError'
    this.availableTopics = availableTopics
  }
}

function validateText(value, label, maximum) {
  if (typeof value !== 'string' || value.trim().length < 3 || value.length > maximum) {
    throw new TypeError(label + ' must contain 3–' + maximum + ' characters.')
  }
  return value.trim()
}

export async function prepareZeroCreditDraft(input, { ledgerPath = path.join(process.cwd(), 'content-agents', 'verified-content-ledger.json') } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('A valid message brief is required.')
  const topic = validateText(input.topic, 'Topic', 300)
  validateText(input.audience, 'Audience', 500)
  validateText(input.goal, 'Goal', 500)
  if (typeof input.tone !== 'string' || input.tone.trim().length < 2 || input.tone.length > 200) throw new TypeError('Tone must contain 2–200 characters.')
  if (!Array.isArray(input.channels) || input.channels.length < 1 || input.channels.length > 8 ||
      input.channels.some(channel => typeof channel !== 'string' || !channel.trim() || channel.length > 80)) {
    throw new TypeError('Select 1–8 channels.')
  }

  const ledger = JSON.parse(await readFile(ledgerPath, 'utf8'))
  const items = Array.isArray(ledger.items) ? ledger.items : []
  const item = items.find(entry => entry.title.toLowerCase() === topic.toLowerCase() ||
    entry.scriptureReference.toLowerCase() === topic.toLowerCase()) ||
    items.find(entry => RULES.find(rule => rule.pattern.test(topic))?.title === entry.title)
  if (!item) throw new UnmatchedCuratedTopicError(items.map(entry => entry.title))

  for (const field of ['title', 'scriptureReference', 'script', 'caption', 'theologyNote', 'factualNote']) {
    if (typeof item[field] !== 'string' || !item[field].trim()) {
      throw new Error('CURATED_LEDGER_INCOMPLETE: ' + field)
    }
  }
  const hashtags = item.caption.match(/#[A-Za-z0-9_]+/g) || []
  const sentences = item.script.match(/[^.!?]+[.!?]?/g)?.map(s => s.trim()).filter(Boolean) || [item.script]
  const hook = sentences[0]
  const cta = sentences[sentences.length - 1]
  return {
    mode: 'ZERO_CREDIT_CURATED_DRAFT',
    source: 'content-agents/verified-content-ledger.json',
    ledgerVersion: ledger.version,
    selectedTitle: item.title,
    publishingLocked: true,
    campaign: {
      title: item.title,
      hook,
      devotional: item.script,
      tiktokScript: item.script,
      onScreenText: [item.title, item.scriptureReference, hook, cta],
      caption: item.caption,
      hashtags: [],
      cta,
      visualConcept: 'Editorial visual direction only: find and individually review licensed moving footage suited to ' + item.title + '. No media has been generated or cleared for publishing.',
      imagePrompts: [
        'Seek rights-cleared moving footage relevant to ' + item.title + '; inspect actual content and license.',
        'Seek rights-cleared Bible or church footage; check that the imagery is explicitly Christian and relevant.',
        'Seek rights-cleared natural transition footage; review exact scenes, pacing and mobile-safe captions.'
      ],
      bible: {
        primaryScripture: item.scriptureReference,
        supportingScriptures: [],
        context: 'Curated devotional application note: ' + item.theologyNote,
        keyTruth: hook,
        cautions: ['The ledger is a curated devotional source, not newly performed Bible research.']
      },
      quality: {
        scriptureAccurate: false,
        biblicalConsistency: false,
        gospelCentered: false,
        audienceFit: false,
        retentionReady: false,
        notes: [
          'Source: exact curated text (' + ledger.version + '); no paid AI or new text generation occurred.',
          'Scripture accuracy, biblical consistency, Gospel focus, audience fit and independent theological review remain PENDING; the curated ledger is not a substitute for this draft's review.',
          'This is a text draft, not an approved video or a publishable campaign. Publishing is locked.'
        ],
        status: 'REVISE'
      },
      status: 'DRAFT_REVIEW_REQUIRED',
      experiments: []
    }
  }
}
