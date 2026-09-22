import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { prepareZeroCreditDraft, UnmatchedCuratedTopicError } from './zero-credit-draft.mjs'

const brief = Object.freeze({
  topic: 'Trusting God when you cannot see the way forward',
  audience: 'Christian youth and young adults',
  goal: 'Encourage people to trust God, strengthen their faith, and keep following Jesus when life feels uncertain.',
  tone: 'Bold, hopeful, warm, Jesus-centered',
  channels: ['TikTok', 'Instagram Reels', 'YouTube Shorts']
})

test('existing default topic returns an exact curated text draft without paid AI calls', async () => {
  const ledger = JSON.parse(await readFile('content-agents/verified-content-ledger.json', 'utf8'))
  const draft = await prepareZeroCreditDraft(brief)
  const entry = ledger.items.find(i => i.title === draft.selectedTitle)
  assert.equal(entry.title, 'FAITH OVER FEAR')
  assert.equal(draft.campaign.tiktokScript, entry.script)
  assert.equal(draft.campaign.devotional, entry.script)
  assert.equal(draft.campaign.caption, entry.caption)
  assert.equal(draft.campaign.bible.primaryScripture, entry.scriptureReference)
  assert.equal(draft.campaign.quality.status, 'REVISE')
  assert.equal(draft.campaign.status, 'DRAFT_REVIEW_REQUIRED')
  assert.equal(draft.publishingLocked, true)
  assert.equal(draft.campaign.bible.supportingScriptures.length, 0)
})

test('unknown topic cannot be silently filled with a fabricated devotional', async () => {
  await assert.rejects(
    prepareZeroCreditDraft({ ...brief, topic: 'Economic outlook for asteroid mining' }),
    error => error instanceof UnmatchedCuratedTopicError &&
      error.availableTopics.includes('FAITH OVER FEAR')
  )
})

test('inputs are validated before reading the curated ledger', async () => {
  await assert.rejects(prepareZeroCreditDraft({ ...brief, topic: '' }), /Topic must contain/)
  await assert.rejects(prepareZeroCreditDraft({ ...brief, channels: [] }), /Select 1/)
})

test('exact curated title and scripture reference can select a source entry', async () => {
  const one = await prepareZeroCreditDraft({ ...brief, topic: 'BE STILL' })
  const two = await prepareZeroCreditDraft({ ...brief, topic: 'Psalm 46:10' })
  assert.equal(one.campaign.tiktokScript, two.campaign.tiktokScript)
  assert.equal(one.selectedTitle, 'BE STILL')
})
