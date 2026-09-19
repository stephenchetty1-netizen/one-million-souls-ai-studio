import { ingestVerifiedPerformance, loadVerifiedPerformance } from './verified-performance-evidence.mjs'

const YT='https://www.googleapis.com/youtube/v3/'
const TT='https://open.tiktokapis.com/v2/video/list/'
const TIMEOUT_MS=15000

function text(value){return String(value||'').trim()}
function num(value){if(value===undefined||value===null||value==='')return null;const n=Number(value);return Number.isFinite(n)&&n>=0?n:null}
function safeError(error){return String(error?.message||error).slice(0,200)}
async function getJson(url,opts={}){
  const controller=new AbortController()
  const timer=setTimeout(()=>controller.abort(),TIMEOUT_MS)
  try{
    const res=await fetch(url,{...opts,signal:controller.signal,redirect:'error'})
    const json=await res.json().catch(()=>null)
    if(!res.ok)throw new Error('UPSTREAM_HTTP_'+res.status)
    return json
  }finally{clearTimeout(timer)}
}
function seconds(iso){
  const match=String(iso||'').match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/)
  if(!match)return null
  return Number(match[1]||0)*86400+Number(match[2]||0)*3600+Number(match[3]||0)*60+Number(match[4]||0)
}
function youtubeUrl(path,params,key){
  const url=new URL(path,YT)
  for(const [k,v] of Object.entries(params))url.searchParams.set(k,String(v))
  url.searchParams.set('key',key)
  return url.href
}
async function refreshYoutube(){
  const key=text(process.env.YOUTUBE_API_KEY)
  const channelId=text(process.env.YOUTUBE_CHANNEL_ID)
  if(!key||!channelId)return {updated:false,skipped:true,reason:!key?'YOUTUBE_API_KEY_MISSING':'YOUTUBE_CHANNEL_ID_MISSING'}
  const channel=await getJson(youtubeUrl('channels',{part:'contentDetails,statistics',id:channelId},key))
  const found=channel?.items?.find(x=>x.id===channelId)
  const uploads=found?.contentDetails?.relatedPlaylists?.uploads
  if(!uploads)throw new Error('YOUTUBE_UPLOAD_PLAYLIST_UNAVAILABLE')
  const page=await getJson(youtubeUrl('playlistItems',{part:'contentDetails',playlistId:uploads,maxResults:30},key))
  const ids=[...new Set((page?.items||[]).map(x=>x.contentDetails?.videoId).filter(Boolean))]
  if(!ids.length)throw new Error('YOUTUBE_UPLOADS_EMPTY_NOT_REPLACING_EVIDENCE')
  const data=await getJson(youtubeUrl('videos',{part:'snippet,statistics,contentDetails',id:ids.join(',')},key))
  const records=(data?.items||[]).filter(v=>v?.snippet?.channelId===channelId)
    .map(v=>{
      const stats=v.statistics||{}
      return {
        postId:v.id,
        topic:v.snippet?.title||'',
        publishedDate:v.snippet?.publishedAt?.slice(0,10),
        views:num(stats.viewCount),
        likes:num(stats.likeCount),
        comments:num(stats.commentCount),
        durationSeconds:seconds(v.contentDetails?.duration),
      }
    })
  if(!records.some(x=>x.views!==null))throw new Error('YOUTUBE_VIEWS_UNAVAILABLE_NOT_REPLACING_EVIDENCE')
  const stored=await ingestVerifiedPerformance({
    source:'YOUTUBE_DATA_API',platform:'youtube',capturedAt:new Date().toISOString(),
    records,channelMetrics:{subscribers:num(found?.statistics?.subscriberCount)||undefined},
  })
  return {updated:stored.accepted,source:'YOUTUBE_DATA_API',records:stored.measuredPostCount}
}
async function refreshTikTok(){
  const token=text(process.env.TIKTOK_DISPLAY_ACCESS_TOKEN)
  if(!token)return {updated:false,skipped:true,reason:'TIKTOK_DISPLAY_ACCESS_TOKEN_MISSING'}
  const fields='id,title,video_description,create_time,duration,like_count,comment_count,share_count,view_count'
  const url=TT+'?fields='+encodeURIComponent(fields)
  const data=await getJson(url,{
    method:'POST',
    headers:{authorization:'Bearer '+token,'content-type':'application/json'},
    body:JSON.stringify({max_count:20}),
  })
  if(data?.error?.code!=='ok')throw new Error('TIKTOK_DISPLAY_ERROR_'+text(data?.error?.code||'UNKNOWN'))
  const listed=data?.data?.videos
  if(!Array.isArray(listed)||!listed.length)throw new Error('TIKTOK_NO_VIDEOS_NOT_REPLACING_EVIDENCE')
  const previous=await loadVerifiedPerformance('tiktok')
  const older=new Map((previous.records||[]).map(x=>[x.postId,x]))
  const records=listed.map(v=>{
    const past=older.get(String(v.id))
    return {
      postId:String(v.id),
      topic:String(v.title||v.video_description||past?.topic||'').slice(0,220),
      publishedDate:Number.isFinite(Number(v.create_time))
        ? new Date(Number(v.create_time)*1000).toISOString().slice(0,10)
        : past?.publishedDate,
      views:num(v.view_count),
      likes:num(v.like_count),
      comments:num(v.comment_count),
      shares:num(v.share_count),
      durationSeconds:num(v.duration),
      // Display API does not offer watch-time data. Do not invent or refresh it.
    }
  })
  if(!records.some(x=>x.views!==null))throw new Error('TIKTOK_VIEWS_UNAVAILABLE_NOT_REPLACING_EVIDENCE')
  const stored=await ingestVerifiedPerformance({
    source:'TIKTOK_DISPLAY_API',platform:'tiktok',capturedAt:new Date().toISOString(),records,
  })
  return {updated:stored.accepted,source:'TIKTOK_DISPLAY_API',records:stored.measuredPostCount,retentionData:'NOT_PROVIDED_BY_DISPLAY_API'}
}
export async function refreshGrowthProvider(platform){
  if(process.env.ZERO_CREDIT_ONLY!=='true')throw new Error('ZERO_CREDIT_ONLY_REQUIRED')
  try{
    if(platform==='youtube')return await refreshYoutube()
    if(platform==='tiktok')return await refreshTikTok()
    return {updated:false,skipped:true,reason:'UNSUPPORTED_PLATFORM'}
  }catch(error){
    return {updated:false,skipped:false,reason:safeError(error)}
  }
}
