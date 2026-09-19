import fs from 'node:fs/promises'
import path from 'node:path'
import { loadYoutubeGrowthState, rememberYoutubeGrowthScan } from './youtube-growth-memory.mjs'

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
  {id:'yt-fatigue-guard-bot',job:'Block repetitive topics, near-duplicate packaging and overused emotional promises.'},
  {id:'yt-quality-floor-bot',job:'Require enough measured evidence before a growth idea is promoted into production.'},
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

const BLOCKED_GROWTH_TACTICS=Object.freeze([
  'sub4sub','sub for sub','view4view','view for view','buy subscribers','buy views',
  'engagement exchange','comment exchange','traffic bot','watch-time bot','fake subscribers',
])

function clean(value){return typeof value==='string'?value.trim():''}
function clamp(n,min,max){return Math.max(min,Math.min(max,n))}
function isoDaysAgo(days){return new Date(Date.now()-days*86400000).toISOString()}
function ratio(n,d){return d>0?n/d:0}
function normalizeWords(value){
  return new Set(String(value||'').toLowerCase().replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(x=>x.length>2))
}
function similarity(a,b){
  const aa=normalizeWords(a),bb=normalizeWords(b)
  if(!aa.size||!bb.size)return 0
  let common=0
  for(const x of aa)if(bb.has(x))common++
  return common/(aa.size+bb.size-common)
}
function recentTopicPenalty(topic,state){
  const recent=(state?.recentTopics||[]).slice(0,24)
  let penalty=0
  for(const item of recent){
    const sim=similarity(topic,item?.topic||item?.key||'')
    if(sim>=0.8)penalty=Math.max(penalty,20)
    else if(sim>=0.5)penalty=Math.max(penalty,10)
  }
  return penalty
}
function opportunityScore(topic,rows,state,recentTitles=[]){
  const totalViews=rows.reduce((a,x)=>a+Number(x.views||0),0)
  const recent=rows.filter(x=>Date.now()-Date.parse(x.publishedAt||0)<45*86400000).length
  const channels=new Set(rows.map(x=>x.channelTitle).filter(Boolean)).size
  const evidence=Math.min(10,rows.length*1.25)
  const demand=Math.min(35,Math.log10(totalViews+1)*5)
  const freshness=Math.min(25,recent*5)
  const diversity=Math.min(20,channels*4)
  const novelty=10
  const historyFatigue=recentTopicPenalty(topic,state)
  const recentTitleSimilarity=recentTitles.reduce((m,t)=>Math.max(m,similarity(topic,t)),0)
  const channelFatigue=recentTitleSimilarity>=0.72?20:recentTitleSimilarity>=0.5?10:0
  return Math.round(clamp(demand+freshness+diversity+evidence+novelty-historyFatigue-channelFatigue,0,100))
}
async function getText(url){
  const controller=new AbortController()
  const timer=setTimeout(()=>controller.abort(),15000)
  try{
    const r=await fetch(url,{signal:controller.signal,redirect:'follow',headers:{'user-agent':'OneMillionSoulsGrowthBot/1.0'}})
    if(!r.ok)throw new Error(`HTTP_${r.status}:${url}`)
    return await r.text()
  }finally{clearTimeout(timer)}
}
function xmlDecode(value=''){
  return String(value).replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>')
}
async function ownChannelFeed(){
  const channelId=clean(process.env.YOUTUBE_CHANNEL_ID)
  if(!channelId)return {ok:false,reason:'YOUTUBE_CHANNEL_ID_MISSING',items:[]}
  try{
    const xml=await getText(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`)
    const entries=[...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map((m)=>{
      const block=m[1]
      const title=xmlDecode(block.match(/<title>([\s\S]*?)<\/title>/)?.[1]||'')
      const videoId=block.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1]||''
      const published=block.match(/<published>([^<]+)<\/published>/)?.[1]||null
      return {title,videoId,published}
    }).filter(x=>x.title)
    return {ok:true,items:entries.slice(0,30)}
  }catch(error){
    return {ok:false,reason:error instanceof Error?error.message:String(error),items:[]}
  }
}

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
function youtubeKey(){return clean(process.env.YOUTUBE_API_KEY)}
function zeroCreditGuard(){
  if(process.env.ZERO_CREDIT_ONLY!=='true')throw new Error('ZERO_CREDIT_ONLY_REQUIRED')
  if(process.env.YOUTUBE_GROWTH_ALLOW_PAID_AI==='true'){
    throw new Error('ZERO_CREDIT_POLICY_VIOLATION:YOUTUBE_GROWTH_ALLOW_PAID_AI')
  }
}
export function growthIntegrityGuard(input={}){
  const text=JSON.stringify(input).toLowerCase()
  const blocked=BLOCKED_GROWTH_TACTICS.filter(x=>text.includes(x))
  if(blocked.length)throw new Error('ARTIFICIAL_ENGAGEMENT_BLOCKED:'+blocked.join(','))
  return {passed:true,status:'PASS',artificialEngagement:false}
}
async function baseline(){
  try{
    const file=path.join(process.cwd(),'content-agents','youtube-growth-baseline.json')
    return JSON.parse(await fs.readFile(file,'utf8'))
  }catch{return {metrics:{},audienceTiming:{}}}
}
async function localEvidenceSearch(topic){
  try{
    const [patternsRaw,trendsRaw]=await Promise.all([
      fs.readFile(path.join(process.cwd(),'content-agents','million-view-patterns.json'),'utf8'),
      fs.readFile(path.join(process.cwd(),'content-agents','trend-evidence.json'),'utf8'),
    ])
    const patterns=JSON.parse(patternsRaw)
    const trends=JSON.parse(trendsRaw)
    const query=normalizeWords(topic)
    const examples=(patterns?.examples||[]).filter((x)=>{
      const hay=normalizeWords([x.title,x.format,...(x.pattern||[])].join(' '))
      let common=0
      for(const word of query)if(hay.has(word))common++
      return common>0
    }).map((x)=>({
      videoId:null,
      title:x.title||'',
      channelTitle:x.creator||'',
      publishedAt:patterns.updatedAt?patterns.updatedAt+'T00:00:00Z':null,
      views:Number(x.views||0),
      likes:Number(x.likes||0),
      comments:0,
      duration:null,
      source:'Cached public million-view evidence',
      sourceUrl:x.source||null,
      format:x.format||null,
      patterns:x.pattern||[],
    })).sort((a,b)=>b.views-a.views).slice(0,8)
    const trendSignals=(trends?.externalTrendSignals||[]).filter((signal)=>{
      const hay=normalizeWords(signal?.signal||'')
      for(const word of query)if(hay.has(word))return true
      return false
    })
    return {
      ok:examples.length>0,
      topic,
      cachedEvidence:true,
      liveSearch:false,
      evidenceUpdatedAt:patterns.updatedAt||trends.capturedAt||null,
      results:examples,
      trendSignals,
      reason:examples.length?'YOUTUBE_API_KEY_MISSING_USING_CACHED_PUBLIC_EVIDENCE':'NO_MATCHING_CACHED_EVIDENCE',
    }
  }catch(error){
    return {ok:false,topic,cachedEvidence:true,liveSearch:false,reason:error instanceof Error?error.message:String(error),results:[]}
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
  growthIntegrityGuard({topic})
  const key=youtubeKey()
  if(!key)return localEvidenceSearch(topic)
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
export function inspectTitlePackaging(title,recentTitles=[]){
  const value=clean(title)
  const letters=[...value].filter(ch=>/[A-Za-z]/.test(ch))
  const upper=letters.filter(ch=>/[A-Z]/.test(ch)).length
  const upperRatio=ratio(upper,letters.length)
  const hashtags=(value.match(/#[\p{L}\p{N}_]+/gu)||[]).length
  const emojis=(value.match(/\p{Extended_Pictographic}/gu)||[]).length
  const duplicate=recentTitles.reduce((m,t)=>Math.max(m,similarity(value,t)),0)
  const warnings=[]
  if(value.length>75)warnings.push('title longer than 75 characters')
  if(upperRatio>0.65&&letters.length>12)warnings.push('excessive ALL CAPS')
  if(hashtags>1)warnings.push('more than one hashtag in title')
  if(emojis>3)warnings.push('too many emojis in title')
  if(/!{2,}|\?{2,}/.test(value))warnings.push('repeated punctuation')
  if(/god told me you|guaranteed miracle|miracle in 24 hours|you will be rich|watch before it is too late/i.test(value))warnings.push('unsupported/manipulative promise')
  if(duplicate>=0.72)warnings.push('near-duplicate of a recent title')
  return {status:warnings.length?'REVISE':'PASS',warnings,upperCaseRatio:Number(upperRatio.toFixed(2)),hashtags,emojis,recentTitleSimilarity:Number(duplicate.toFixed(2))}
}
function titleDirections(topic){
  const t=clean(topic)
  return [
    `What the Bible Says About ${t}`,
    `When ${t} Feels Hard: A Biblical Response`,
    `${t}: One Truth to Remember Today`,
  ]
}
function opportunityFrom(topic,rows,state,recentTitles=[]){
  const totalViews=rows.reduce((a,x)=>a+x.views,0)
  const recent=rows.filter(x=>Date.now()-Date.parse(x.publishedAt||0)<45*86400000).length
  const leaders=rows.slice(0,5).map(x=>({title:x.title,channelTitle:x.channelTitle,views:x.views,publishedAt:x.publishedAt,videoId:x.videoId}))
  const score=opportunityScore(topic,rows,state,recentTitles)
  const directions=titleDirections(topic).map(title=>({title,inspection:inspectTitlePackaging(title,recentTitles)}))
  return {
    topic,
    opportunityScore:score,
    decision:score>=65?'DEVELOP':score>=50?'RESEARCH_MORE':'HOLD',
    publicEvidenceCount:rows.length,
    totalPublicViewsObserved:totalViews,
    recentExamples:recent,
    recurringTitleTerms:titlePatterns(rows),
    leadingExamples:leaders,
    titleDirections:directions,
    thumbnailDirection:'One clear visual focal point, one truthful promise, minimal text, no misleading before/after or fabricated reaction imagery.',
    nextContentDirection:score>=65
      ? `Develop an original answer to the viewer need behind "${topic}". Deliver the title/thumbnail promise in the first seconds and change only one growth variable at a time.`
      : `Keep "${topic}" in research until the evidence score improves or channel analytics reveal a specific audience need.`,
  }
}
export function retentionActions(metrics={}){
  const intro=Number(metrics.introRetention30s)
  const ctr=Number(metrics.ctr)
  const avg=Number(metrics.averagePercentageViewed)
  const actions=[]
  if(Number.isFinite(intro)&&intro>0&&intro<50)actions.push('Rewrite the opening 30 seconds so it immediately delivers the title/thumbnail promise.')
  if(Number.isFinite(ctr)&&ctr>0&&ctr<4)actions.push('Test a clearer title/thumbnail package while keeping the promise truthful.')
  if(Number.isFinite(avg)&&avg>0&&avg<40)actions.push('Tighten pacing, move the strongest payoff earlier, and remove filler.')
  if(!actions.length)actions.push('Preserve the strongest hook, packaging and pacing ingredients; change only one experimental variable next.')
  return actions
}
export function subscriberActions(metrics={}){
  const gained=Number(metrics.subscribersGained||0)
  const views=Number(metrics.views||metrics.videoViews||0)
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
function channelBenchmark(metrics,base){
  const views=Number(metrics.views||base?.metrics?.videoViews||0)
  const uploads=Number(metrics.uploads||base?.metrics?.uploads||0)
  const gained=Number(metrics.subscribersGained||base?.metrics?.subscribersGained||0)
  const lost=Number(metrics.subscribersLost||base?.metrics?.subscribersLost||0)
  return {
    views,
    uploads,
    viewsPerUpload:uploads?Number((views/uploads).toFixed(2)):null,
    subscribersGained:gained,
    subscribersLost:lost,
    netSubscribers:gained-lost,
    benchmarkViewsPerUpload:Number(base?.metrics?.viewsPerUpload||0)||null,
    strongestRecurringHourSast:base?.audienceTiming?.strongestRecurringHour??null,
  }
}
export async function runYoutubeGrowthScan(input={}){
  zeroCreditGuard()
  growthIntegrityGuard(input)
  const state=await loadYoutubeGrowthState()
  const base=await baseline()
  const metrics={...(base.metrics||{}),...(input.metrics||{})}
  const feed=await ownChannelFeed()
  const recentTitles=Array.isArray(input.recentTitles)&&input.recentTitles.length
    ? input.recentTitles.filter(Boolean).slice(0,60)
    : (feed.items||[]).map(x=>x.title).filter(Boolean).slice(0,60)
  const topics=(Array.isArray(input.topics)&&input.topics.length?input.topics:DEFAULT_TOPICS)
    .map(clean).filter(Boolean).slice(0,8)
  const scans=[]
  for(const topic of topics){
    try{scans.push(await searchYoutubeTopic(topic,{maxResults:input.maxResults||8,days:input.days||120}))}
    catch(error){scans.push({ok:false,topic,error:error instanceof Error?error.message:String(error)})}
  }
  const opportunities=scans.filter(x=>x.ok)
    .map(x=>{
      const opportunity=opportunityFrom(x.topic,x.results||[],state,recentTitles)
      const cacheCap=x.cachedEvidence?70:100
      opportunity.opportunityScore=Math.min(opportunity.opportunityScore,cacheCap)
      opportunity.decision=opportunity.opportunityScore>=65?'DEVELOP':opportunity.opportunityScore>=50?'RESEARCH_MORE':'HOLD'
      opportunity.evidenceMode=x.cachedEvidence?'CACHED_PUBLIC_EVIDENCE':'LIVE_YOUTUBE_DATA_API'
      opportunity.evidenceUpdatedAt=x.evidenceUpdatedAt||null
      opportunity.trendSignals=x.trendSignals||[]
      return opportunity
    })
    .sort((a,b)=>b.opportunityScore-a.opportunityScore)
  const result={
    ok:opportunities.length>0,
    zeroCreditOnly:true,
    artificialEngagement:false,
    writeActionsToYouTube:false,
    searchedAt:new Date().toISOString(),
    bots:YOUTUBE_GROWTH_BOTS,
    researchMode:youtubeKey()?'LIVE_YOUTUBE_DATA_API':'ZERO_CREDIT_CACHED_EVIDENCE_FALLBACK',
    quotaPolicy:{maxTopicSearchesPerCycle:8,minimumHoursBetweenCycles:6},
    promotionPolicy:{developAtScore:65,researchMoreAtScore:50,oneVariableExperiment:true},
    benchmark:channelBenchmark(metrics,base),
    ownChannelFeed:{
      available:feed.ok===true,
      recentTitleCount:recentTitles.length,
      latestItems:(feed.items||[]).slice(0,12),
      warning:feed.ok?null:feed.reason,
    },
    opportunities,
    retention:retentionActions(metrics),
    subscriberGrowth:subscriberActions(metrics),
    failures:scans.filter(x=>!x.ok),
  }
  const remembered=await rememberYoutubeGrowthScan(result,metrics)
  result.memory={
    persistent:!remembered.persistenceWarning,
    recentTopicCount:(remembered.recentTopics||[]).length,
    metricSnapshots:(remembered.metricsHistory||[]).length,
    experimentCount:(remembered.experiments||[]).length,
    warning:remembered.persistenceWarning||null,
  }
  return result
}
