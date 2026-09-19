// Editorial format contract. These targets describe a finished edit, not
// evidence of quality or any authorization to publish.
export const CHRISTIAN_VIDEO_FORMATS=Object.freeze({
  SHORT_59:Object.freeze({
    id:'SHORT_59',platforms:Object.freeze(['TikTok','Instagram Reels','YouTube Shorts']),
    durationSeconds:59,width:1080,height:1920,fps:30,
    orientation:'portrait',minimumDistinctClips:9,
    secondsPerScene:59/9,requiredAudioSeconds:59,
    format:'MUSIC_LED_SHORT',publishingAllowed:false,
    humanAudioVisualApprovalRequired:true,
  }),
  YOUTUBE_LONG:Object.freeze({
    id:'YOUTUBE_LONG',platforms:Object.freeze(['YouTube']),
    durationSeconds:240,width:1920,height:1080,fps:30,
    orientation:'landscape',minimumDistinctClips:24,
    secondsPerScene:10,requiredAudioSeconds:240,
    format:'LONG_FORM_WORSHIP',publishingAllowed:false,
    humanAudioVisualApprovalRequired:true,
  }),
})
export function requireChristianVideoFormat(id){
  if(!Object.hasOwn(CHRISTIAN_VIDEO_FORMATS,id))
    throw new Error('CHRISTIAN_VIDEO_FORMAT_NOT_SUPPORTED')
  return CHRISTIAN_VIDEO_FORMATS[id]
}
export function inspectChristianVideoSources(formatId,sources=[],audioSeconds=0){
  const format=requireChristianVideoFormat(formatId)
  const clips=Array.isArray(sources)?sources:[]
  const unique=new Set(clips.map(x=>String(x?.id||x?.sourceVideoHash||'')).filter(Boolean))
  const minimumClipSeconds=format.secondsPerScene+0.25
  const oriented=clips.filter(x=>format.orientation==='portrait'
    ?Number(x?.width)>=format.width&&Number(x?.height)>=format.height&&Number(x?.height)>Number(x?.width)
    :Number(x?.width)>=format.width&&Number(x?.height)>=format.height&&Number(x?.width)>Number(x?.height))
  const longEnough=oriented.filter(x=>Number(x?.durationSeconds)>=minimumClipSeconds)
  const licensed=longEnough.filter(x=>x?.license==='Pexels License'&&
    String(x?.pageUrl||'').startsWith('https://www.pexels.com/video/'))
  const eligibleUnique=new Set(licensed.map(x=>String(x?.id||x?.sourceVideoHash||'')).filter(Boolean))
  const blockers=[]
  if(unique.size<format.minimumDistinctClips)
    blockers.push('NOT_ENOUGH_DISTINCT_VISUAL_SHOTS_'+unique.size+'_OF_'+format.minimumDistinctClips)
  if(eligibleUnique.size<format.minimumDistinctClips)
    blockers.push('NATIVE_'+format.orientation.toUpperCase()+'_LICENSED_SHOTS_'+eligibleUnique.size+'_OF_'+format.minimumDistinctClips)
  if(!(Number(audioSeconds)>=format.requiredAudioSeconds+0.5))
    blockers.push('LICENSED_MUSIC_TOO_SHORT_FOR_'+format.id)
  return Object.freeze({
    formatId:format.id,readyForDraftRender:blockers.length===0,
    blockers,availableDistinctClips:unique.size,
    eligibleDistinctClips:eligibleUnique.size,
    requiredDistinctClips:format.minimumDistinctClips,
    targetSeconds:format.durationSeconds,width:format.width,height:format.height,
    repeatedSourceClipsAllowed:false,
    sourceReviewRequired:true,publishingAllowed:false,
  })
}
export function requireChristianVideoSources(formatId,sources,audioSeconds){
  const result=inspectChristianVideoSources(formatId,sources,audioSeconds)
  if(!result.readyForDraftRender)
    throw new Error('CHRISTIAN_VIDEO_FORMAT_SOURCES_BLOCKED: '+result.blockers.join(';'))
  return result
}
