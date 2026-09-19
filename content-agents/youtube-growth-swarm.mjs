const API_BASE='https://www.googleapis.com/youtube/v3'

export const YOUTUBE_GROWTH_BOTS=Object.freeze([
  {id:'yt-search-demand-bot',job:'Find current YouTube search demand and recurring viewer questions in the channel niche.'},
  {id:'yt-trend-radar-bot',job:'Find recent high-interest videos and emerging topic/format patterns without copying protected expression.'},
  {id:'yt-content-gap-bot',job:'Identify useful Christian topics and questions with audience interest that the channel has not recently covered.'},
  {id:'yt-title-packaging-bot',job:'Turn validated topics into truthful searchable and curiosity-led title directions.'},
  {id:'yt-thumbnail-lab-bot',job:'Generate thumbnail direction briefs focused on one clear promise, focal point and mobile readability.'},
  {id:'yt-retention-bot',job:'Translate retention evidence into hook, pacing and payoff changes for future videos.'},
  {id:'yt-subscriber-conversion-bot',job:'Improve legitimate subscribe conversion through stronger series continuity, value promise and natural CTAs.'},
  {id:'yt-experiment-manager-bot',job:'Run one-variable-at-a-time content experiments and preserve winning ingredients without artificial engagement.'},
])

const DEFAULT_TOPICS=Object.freeze([
  'prayer',
  'Bible verse',
  'Christian motivation',
  'Jesus',
  'faith over fear',
  'God is with you',
  'Bible questions',
  'Christian youth',
])

function clean(value){return typeof value==='string'?value.trim():''}
function clamp(n,min,max){return Math.max(min,Math.min(max,n))}
function isoDaysAgo(days){return new Date(Date.now()-days*86400000).toISOString()}

async function getJson(url){
  const controller=new AbortController()
  const timer=setTimeout(()=>controller.abort(),15000)
  try{
    const r=await fetch(url,{signal:controller.signal,redirect:'follow'})
    const data=await r.json().catch(()=>null)
    if(!r.ok)throw new Error(`YOUTUBE_API_${r.status}:${data?.error?.message||url}`)
    return data
  }finally{clearTimeout(timer)}
}

function youtubeKey(){
  return clean(process.env.YOUTUBE_API_KEY)
}

function zeroCreditGuard(){
  if(process.env.ZERO_CREDIT_ONLY!=='true')return
  if(process.env.YOUTUBE_GROWTH_ALLOW_PAID_AI==='true'){
    throw new Error('ZERO_CREDIT_POLICY_VIOLATION:YOUTUBE_GROWTH_ALLOW_PAID_AI')
  }
}

async function videoDetails(ids,key){
  if(!ids.length)return []
  const u=new URL(API_BASE+'/videos')
  u.searchParams.set('part','snippet,statistics,contentDetails')
  u.searchParams.set('id',ids.join(','))
  u.searchParams.set('key',key)
  const data=await getJson(u)
  return Array.isArray(data?.items)?data.items:[]
}

export async function searchYoutubeTopic(topic,{maxResults=8,days=120}={}){
  zeroCreditGuard()
  const key=youtubeKey()
  if(!key)return {ok:false,skipped:true,reason:'YOUTUBE_API_KEY_MISSING',topic}
  const u=new URL(API_BASE+'/search')
  u.searchParams.set('part','snippet')
  u.searchParams.set('type','video')
  u.searchParams.set('q',topic)
  u.searchParams.set('maxResults',String(clamp(maxResults,1,15)))
  u.searchParams.set('publishedAfter',isoDaysAgo(clamp(days,7,365)))
  u.searchParams.set('order','viewCount')
  u.searchParams.set('safeSearch','moderate')
  u.searchParams.set('key',key)
  const data=await getJson(u)
  const ids=(data?.items||[]).map(x=>x?.id?.videoId).filter(Boolean)
  const details=await videoDetails(ids,key)
  const rows=details.map(v=>({
    videoId:v.id,
    title:v?.snippet?.title||'',
    channelTitle:v?.snippet?.channelTitle||'',
    publishedAt:v?.snippet?.publishedAt||null,
    views:Number(v?.statistics?.viewCount||0),
    likes:Number(v?.statistics?.likeCount||0),
    comments:Number(v?.statistics?.commentCount||0),
    duration:v?.contentDetails?.duration||null,
    source:'YouTube Data API',
  })).sort((a,b)=>b.views-a.views)
  return {ok:true,topic,results:rows}
}

function titlePatterns(rows){
  const words=new Map()
  for(const row of rows){
    const tokens=String(row.title||'').toLowerCase().replace(/[^a-z0-9\s']/g,' ').split(/\s+/).filter(x=>x.length>=4)
    for(const token of new Set(tokens))words.set(token,(words.get(token)||0)+1)
  }
  return [...words.entries()].sort((a,b)=>b[1]-a[1]).slice(0,12).map(([word,count])=>({word,count}))
}

function opportunityFrom(topic,rows){
  const totalViews=rows.reduce((a,x)=>a+x.views,0)
  const recent=rows.filter(x=>Date.now()-Date.parse(x.publishedAt||0)<45*86400000).length
  const leaders=rows.slice(0,5).map(x=>({title:x.title,channelTitle:x.channelTitle,views:x.views,publishedAt:x.publishedAt,videoId:x.videoId}))
  return {
    topic,
    publicEvidenceCount:rows.length,
    totalPublicViewsObserved:totalViews,
    recentExamples:recent,
    recurringTitleTerms:titlePatterns(rows),
    leadingExamples:leaders,
    nextContentDirection:rows.length
      ? `Create an original video answering the viewer need behind "${topic}" with a direct first-second hook and a title/thumbnail promise that exactly matches the opening.`
      : `No useful public examples found for "${topic}" in this scan; keep it in research, not production.`,
  }
}

export function retentionActions(metrics={}){
  const intro=Number(metrics.introRetention30s)
  const ctr=Number(metrics.ctr)
  const avg=Number(metrics.averagePercentageViewed)
  const actions=[]
  if(Number.isFinite(intro)&&intro<50)actions.push('Rewrite the opening 30 seconds so it immediately delivers the title/thumbnail promise.')
  if(Number.isFinite(ctr)&&ctr<4)actions.push('Test a clearer title/thumbnail package while keeping the promise truthful.')
  if(Number.isFinite(avg)&&avg<40)actions.push('Tighten pacing, move the strongest payoff earlier, and remove filler.')
  if(!actions.length)actions.push('Preserve the strongest hook, packaging and pacing ingredients; change only one experimental variable next.')
  return actions
}

export function subscriberActions(metrics={}){
  const gained=Number(metrics.subscribersGained||0)
  const views=Number(metrics.views||0)
  const rate=views>0?(gained/views)*100:null
  return {
    subscriberConversionPercent:rate===null?null:Number(rate.toFixed(3)),
    actions:[
      'Build recurring series so a viewer knows what they will receive by subscribing.',
      'Use a natural subscribe CTA after delivering value, not before.',
      'Point viewers to the next closely related video or playlist to deepen session value.',
      'Turn repeated audience questions into follow-up videos and Shorts.',
    ],
  }
}

export async function runYoutubeGrowthScan(input={}){
  zeroCreditGuard()
  const topics=(Array.isArray(input.topics)&&input.topics.length?input.topics:DEFAULT_TOPICS)
    .map(clean).filter(Boolean).slice(0,8)
  const scans=[]
  for(const topic of topics){
    try{scans.push(await searchYoutubeTopic(topic,{maxResults:input.maxResults||8,days:input.days||120}))}
    catch(error){scans.push({ok:false,topic,error:error instanceof Error?error.message:String(error)})}
  }
  const opportunities=scans.filter(x=>x.ok).map(x=>opportunityFrom(x.topic,x.results||[]))
  return {
    ok:opportunities.length>0,
    zeroCreditOnly:true,
    artificialEngagement:false,
    writeActionsToYouTube:false,
    searchedAt:new Date().toISOString(),
    bots:YOUTUBE_GROWTH_BOTS,
    quotaPolicy:{maxTopicSearchesPerCycle:8,minimumHoursBetweenCycles:6},
    opportunities,
    retention:retentionActions(input.metrics||{}),
    subscriberGrowth:subscriberActions(input.metrics||{}),
    failures:scans.filter(x=>!x.ok),
  }
}
