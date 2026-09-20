import crypto from 'node:crypto'
import {S3Client,ListObjectsV2Command,GetObjectCommand,HeadObjectCommand} from '@aws-sdk/client-s3'
import {worshipMasterRevoked,worshipMediaRevoked} from './christian-visual-editorial-gate.mjs'

// Read-only archive discovery. A staged MP4 or historic successful build is
// NOT evidence of a certified exact master. The durable 50-vote Redis record is
// verified independently by the main V59 certification runner, not fabricated here.
const PREFIXES=['manifests/','internal/music-video-reviews/v1/','certificates/','internal/certificates/']
const QA=['rightsStatus','theologyStatus','factualStatus','mediaIntegrity','captionSync','audioMix',
 'visualQuality','thumbnailQuality','contentQuality','lyricSync','originality',
 'professionalExecution','technicalMaster','creativeMaster']
const validHash=v=>/^[a-f0-9]{64}$/i.test(String(v||''))
export function credibleStoredCertificate(record){
 const cert=record?.certificate||record
 if(!cert||cert.reviewStandardVersion!=='v59-independent-exact-master-v2'||
  cert.certification!=='PROFESSIONAL_MASTER_CERTIFIED'||cert.masterReady!==true||
  cert.releaseStatus!=='APPROVED_AWAITING_POST_TIME'||
  Number(cert.requiredApprovals)!==50||
  !validHash(cert.masterHash)||!validHash(cert.contentHash)||
  worshipMasterRevoked(cert.masterHash)||
  !QA.every(k=>cert.qa?.[k]==='PASS'))return false
 if(record?.masterHash&&record.masterHash.toLowerCase()!==cert.masterHash.toLowerCase())return false
 if(record?.contentHash&&record.contentHash.toLowerCase()!==cert.contentHash.toLowerCase())return false
 return true
}
function mediaKey(url,rendererHost){
 try{
  const parsed=new URL(url)
  if(parsed.host!==rendererHost||!parsed.pathname.startsWith('/media/'))return ''
  const key=parsed.pathname.slice('/media/'.length).split('/').map(decodeURIComponent).join('/')
  return !key.includes('..')&&!worshipMediaRevoked(key)?key:''
 }catch{return ''}
}
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex')
async function scanPrefix(s3,bucket,prefix){
 const keys=[];let token
 for(let page=0;page<4;page++){
  const response=await s3.send(new ListObjectsV2Command({Bucket:bucket,Prefix:prefix,
   MaxKeys:500,...(token?{ContinuationToken:token}:{})}))
  keys.push(...(response.Contents||[]).filter(x=>String(x.Key||'').endsWith('.json')).map(x=>x.Key))
  if(!response.IsTruncated)break
  token=response.NextContinuationToken
  if(!token)break
 }
 return keys
}
async function getJson(s3,bucket,key){
 const response=await s3.send(new GetObjectCommand({Bucket:bucket,Key:key}))
 if(Number(response.ContentLength||0)>3*1024*1024)throw new Error('ARCHIVE_MANIFEST_TOO_LARGE')
 const bytes=Buffer.from(await response.Body.transformToByteArray())
 if(bytes.length>3*1024*1024)throw new Error('ARCHIVE_MANIFEST_TOO_LARGE')
 return JSON.parse(bytes.toString('utf8'))
}
async function verifyMedia(s3,bucket,record,cert,rendererHost){
 const key=mediaKey(record.mediaUrl||record.releasePayload?.mediaUrl||cert.mediaUrl,rendererHost)
 if(!key)return null
 const meta=await s3.send(new HeadObjectCommand({Bucket:bucket,Key:key}))
 if(Number(meta.ContentLength||0)<1000000||Number(meta.ContentLength||0)>350*1024*1024)return null
 const file=await s3.send(new GetObjectCommand({Bucket:bucket,Key:key}))
 const bytes=Buffer.from(await file.Body.transformToByteArray())
 if(sha(bytes)!==cert.masterHash.toLowerCase())return null
 return {mediaUrl:'https://'+rendererHost+'/media/'+key.split('/').map(encodeURIComponent).join('/'),
  masterHash:cert.masterHash,contentHash:cert.contentHash,bytes:bytes.length}
}
export async function searchStoredMasterCandidates({endpoint,region,bucket,accessKeyId,secretAccessKey,rendererHost}){
 if(!endpoint||!region||!bucket||!accessKeyId||!secretAccessKey||!rendererHost)
  throw new Error('STORAGE_SEARCH_CONFIGURATION_MISSING')
 const s3=new S3Client({endpoint,region,forcePathStyle:true,
  credentials:{accessKeyId,secretAccessKey}})
 let scannedJsonObjects=0,manifestEntries=0,musicReviewDrafts=0,qualifiedMetadata=0
 const failures=[],verifiedArchiveCandidates=[],unique=new Set()
 for(const prefix of PREFIXES){
  let keys
  try{keys=await scanPrefix(s3,bucket,prefix)}
  catch(e){failures.push({prefix,error:String(e?.name||e?.message||'archive list failed')});continue}
  for(const key of keys){
   try{
    const json=await getJson(s3,bucket,key);scannedJsonObjects++
    const records=Array.isArray(json?.entries)?json.entries:[json]
    if(key.startsWith('manifests/'))manifestEntries+=records.length
    if(key.startsWith('internal/music-video-reviews/v1/'))musicReviewDrafts+=records.length
    for(const record of records){
     if(!credibleStoredCertificate(record))continue
     qualifiedMetadata++
     const cert=record.certificate||record
     if(unique.has(cert.masterHash))continue
     unique.add(cert.masterHash)
     const result=await verifyMedia(s3,bucket,record,cert,rendererHost).catch(()=>null)
     if(result)verifiedArchiveCandidates.push({
      ...result,certificateId:cert.certificateId||null,
      warning:'R2_RECORD_AND_EXACT_MP4_VALIDATED;_DURABLE_REDIS_50_APPROVAL_RECHECK_REQUIRED'})
    }
   }catch(e){
    if(failures.length<15)failures.push({prefix,error:String(e?.name||e?.message||'archive record read failed')})
   }
  }
 }
 const report={ok:failures.length===0,scope:'R2_REVIEW_AND_MANIFEST_ARCHIVE_ONLY',
  scannedJsonObjects,manifestEntries,musicReviewDrafts,qualifiedMetadata,
  verifiedArchiveCandidates,publishingAllowed:false,
  redisFiftyApprovalVerified:false,
  certifiedMasterClaimAllowed:false,
  note:'Even a verified R2 candidate requires independent durable 50-agent Redis certificate recheck.'}
 if(failures.length)report.failures=failures
 return report
}
