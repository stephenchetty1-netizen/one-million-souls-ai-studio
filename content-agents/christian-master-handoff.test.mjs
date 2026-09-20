import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import {Readable} from 'node:stream'
import {inspectChristianHandoff,scanChristianHandoffs} from './christian-master-handoff.mjs'

const BASE='https://renderer.example.test'
const VIDEO=Buffer.alloc(1000001,11),SHEET=Buffer.alloc(10001,24)
const sha=b=>crypto.createHash('sha256').update(b).digest('hex')
const HASH=sha(VIDEO),CONTACT=sha(SHEET)
const json=(value,status=200)=>({ok:status===200,status,json:async()=>value})
const media=(buf)=>({ok:true,status:200,body:Readable.from([buf])})
const queue=(count,approved=count)=>({
 ok:true,required:count,reviewed:approved,technicalSourcesReady:true,
 assets:Array.from({length:count},(_,i)=>({
  id:i+1,reviewStatus:i<approved?'APPROVED_CHRISTIAN_STORY_FIT':'AWAITING_SOURCE_VISUAL_REVIEW',
  sourceVideoHash:sha(Buffer.from('clip '+i)),reviewedHash:i<approved?sha(Buffer.from('clip '+i)):null
 }))
})
function fixture(format='SHORT_59',opts={}){
 const count=format==='SHORT_59'?9:24
 const path=format==='SHORT_59'?'narrated-short-review-v1/abc':'music-video-review-v1/YOUTUBE_LONG/abc'
 const draft={
  ok:true,id:'abc',title:'Faith',sourceClips:count,voiceover:true,
  captionsPresent:true,certification:'NOT_CERTIFIED',masterReady:false,
  publishingAllowed:false,masterHash:opts.badHash?'0'.repeat(64):HASH,
  contactSheetHash:CONTACT,measured:{width:format==='SHORT_59'?1080:1920,
   height:format==='SHORT_59'?1920:1080,fps:30,
   durationSeconds:format==='SHORT_59'?59:240,fullDecodePassed:true},
  mediaUrl:BASE+'/media/'+path+'.mp4',
  contactSheetUrl:BASE+'/media/'+path+'-contact.jpg'
 }
 const fetchImpl=async (url)=>{
  const u=String(url)
  if(u.includes('christian-review-queue'))return json(queue(count,opts.approved))
  if(u.includes('christian-reviewed-'))return opts.noDraft?json({},404):json({...draft,...opts.draft})
  if(u.endsWith('.mp4'))return media(VIDEO)
  if(u.endsWith('.jpg'))return media(SHEET)
  throw Error('UNEXPECTED_ENDPOINT '+u)
 }
 return {base:BASE,secret:'fake-local-test-secret',fetchImpl}
}
test('SHORT: nine approved exact sources and hashed video yield review handoff only',async()=>{
 const x=await inspectChristianHandoff('SHORT_59',fixture())
 assert.equal(x.status,'AWAITING_INDEPENDENT_FINAL_MASTER_REVIEW')
 assert.equal(x.exactMp4Verified,true)
 assert.equal(x.masterHash,HASH)
 assert.equal(x.certified,false)
 assert.equal(x.publishingLocked,true)
})
test('LONG: all 24 sources are required and format-specific media prefix is enforced',async()=>{
 const blocked=await inspectChristianHandoff('YOUTUBE_LONG',fixture('YOUTUBE_LONG',{approved:23}))
 assert.equal(blocked.status,'AWAITING_HUMAN_EXACT_SOURCE_REVIEW')
 assert.equal(blocked.remaining,1)
 const verified=await inspectChristianHandoff('YOUTUBE_LONG',fixture('YOUTUBE_LONG'))
 assert.equal(verified.exactMp4Verified,true)
 assert.equal(verified.certified,false)
})
test('Reject wrong exact MP4 even when metadata claims a master hash',async()=>{
 const x=await inspectChristianHandoff('SHORT_59',fixture('SHORT_59',{badHash:true}))
 assert.equal(x.status,'EXACT_MASTER_MEDIA_HASH_MISMATCH')
 assert.equal(x.publishingLocked,true)
})
test('Reject old or external review master URL and incomplete safety fields',async()=>{
 const x=await inspectChristianHandoff('SHORT_59',fixture('SHORT_59',{
  draft:{mediaUrl:'https://other.example.test/media/narrated-short-review-v1/abc.mp4'}
 }))
 assert.equal(x.status,'REVIEWED_MASTER_IDENTITY_INVALID')
 const y=await inspectChristianHandoff('SHORT_59',fixture('SHORT_59',{
  draft:{publishingAllowed:true}
 }))
 assert.equal(y.status,'REVIEWED_MASTER_IDENTITY_INVALID')
})
test('Missing rendered draft is reported, never counted as a certificate',async()=>{
 const x=await inspectChristianHandoff('SHORT_59',fixture('SHORT_59',{noDraft:true}))
 assert.equal(x.status,'AWAITING_REVIEWED_SOURCE_RENDER')
 assert.equal(x.certified,false)
})
test('Per-format outcomes persist without fabricating success',async()=>{
 const records=[]
 const f=fixture()
 const original=f.fetchImpl
 f.fetchImpl=async url=>url.includes('YOUTUBE_LONG')?
  json(queue(24,0)):original(url)
 const x=await scanChristianHandoffs({...f,persist:async(k,v)=>records.push([k,JSON.parse(v)])})
 assert.equal(records.length,2)
 assert.equal(x.allCertified,false)
 assert.equal(x.publishingLocked,true)
 assert.equal(x.reports[0].exactMp4Verified,true)
 assert.equal(x.reports[1].status,'AWAITING_HUMAN_EXACT_SOURCE_REVIEW')
})

test('Measured export and contact-sheet SHA must match exact master metadata',async()=>{
 const shape=await inspectChristianHandoff('SHORT_59',fixture('SHORT_59',{
  draft:{measured:{width:720,height:1280,fps:24,durationSeconds:59,fullDecodePassed:true}}
 }))
 assert.equal(shape.status,'REVIEWED_MASTER_IDENTITY_INVALID')
 const sheet=await inspectChristianHandoff('SHORT_59',fixture('SHORT_59',{
  draft:{contactSheetHash:'f'.repeat(64)}
 }))
 assert.equal(sheet.status,'EXACT_MASTER_MEDIA_HASH_MISMATCH')
})
