export function normalizeRate(value){return Number.isFinite(Number(value))?Number(value):0}

export function comparePlatformOpportunity({youtube={},tiktok={}}={}){
  const yScore=normalizeRate(youtube.opportunityScore)
  const tScore=normalizeRate(tiktok.opportunityScore)
  return {
    youtube:{score:yScore,decision:yScore>=65?'DEVELOP':yScore>=50?'RESEARCH_MORE':'HOLD'},
    tiktok:{score:tScore,decision:tScore>=65?'DEVELOP':tScore>=50?'RESEARCH_MORE':'HOLD'},
    sharedConceptAllowed:yScore>=65||tScore>=65,
    reuseRule:'Share the underlying original concept only. Rebuild hook, title/caption, duration, edit pacing, CTA and packaging independently for each platform.',
  }
}

export function crossPlatformGuard({youtubePackage={},tiktokPackage={}}={}){
  const violations=[]
  const yTitle=String(youtubePackage.title||youtubePackage.caption||'').trim().toLowerCase()
  const tCaption=String(tiktokPackage.caption||tiktokPackage.title||'').trim().toLowerCase()
  if(yTitle&&tCaption&&yTitle===tCaption)violations.push('IDENTICAL_PLATFORM_PACKAGING')
  if(youtubePackage.mediaId&&tiktokPackage.mediaId&&youtubePackage.mediaId===tiktokPackage.mediaId&&youtubePackage.platformEditVerified!==true){
    violations.push('UNVERIFIED_IDENTICAL_PLATFORM_EDIT')
  }
  if(youtubePackage.artificialEngagement===true||tiktokPackage.artificialEngagement===true)violations.push('ARTIFICIAL_ENGAGEMENT')
  return {
    status:violations.length?'BLOCK':'PASS',
    violations,
    rule:'Platform-specific packaging is mandatory; artificial engagement is prohibited.',
  }
}
