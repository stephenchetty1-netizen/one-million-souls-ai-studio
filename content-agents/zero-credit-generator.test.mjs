import test from 'node:test'
import assert from 'node:assert/strict'
import { buildZeroCreditCampaign } from './zero-credit-generator.mjs'
const base={topic:'Trusting God when you cannot see the way forward',audience:'Christian youth and young adults',goal:'Encourage people to trust God',tone:'Bold, warm, Jesus-centered',channels:['TikTok','YouTube Shorts']}

test('default user brief produces a coherent draft without an API key or provider',()=>{
  const before=process.env.OPENAI_API_KEY
  delete process.env.OPENAI_API_KEY
  try {
    const result=buildZeroCreditCampaign(base)
    assert.equal(result.error,undefined)
    const c=result.campaign
    assert.equal(c.provider,'local-curated-template')
    assert.equal(c.zeroCredit,true)
    assert.equal(c.publishingLocked,true)
    assert.equal(c.status,'DRAFT_REVIEW_REQUIRED')
    assert.equal(c.quality.status,'REVISE')
    assert.equal(c.quality.scriptureAccurate,false)
    assert.match(c.bible.primaryScripture,/Proverbs 3:5/)
    assert.match(c.devotional,/Jesus/)
    assert.equal(c.imagePrompts.length,3)
    assert.ok(c.tiktokScript.length>100)
  } finally {
    if(before===undefined) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY=before
  }
})
test('unsupported Scripture topic fails closed instead of inventing research',()=>{
  const result=buildZeroCreditCampaign({...base,topic:'How many trumpets were there in an unspecified dream?'})
  assert.equal(result.statusCode,422)
  assert.match(result.error,/No curated/)
})
test('incomplete brief returns a readable 400 error',()=>{
  const result=buildZeroCreditCampaign({...base,channels:[]})
  assert.equal(result.statusCode,400)
})
test('seven curated topics preserve draft-only review policy',()=>{
  for(const topic of ['Trust','Prayer','Fear','Strength','Hope','Forgiveness','Jesus']){
    const result=buildZeroCreditCampaign({...base,topic})
    assert.equal(result.campaign?.publishingLocked,true,topic)
    assert.equal(result.campaign?.quality?.status,'REVISE',topic)
    assert.ok(result.campaign?.bible?.supportingScriptures?.length>=2,topic)
  }
})
