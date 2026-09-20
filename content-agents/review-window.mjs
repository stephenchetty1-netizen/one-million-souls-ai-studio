// Rolling 14-day Johannesburg review window; never let yesterday's fixed packet
// silently replace the production horizon. Explicit fixed windows are test-only
// unless REVIEW_FIXED_START_DATE=true is deliberately configured.
export function computeReviewWindow({now=new Date(),timezone='Africa/Johannesburg',days=14,
 fixedStartDate='',fixedEnabled=false}={}){
 const amount=Number(days)
 if(!Number.isInteger(amount)||amount<1||amount>14)
  throw new Error('REVIEW_DAYS_MUST_BE_BETWEEN_1_AND_14')
 const target=new Date(now.getTime()+86400000)
 if(Number.isNaN(target.getTime()))throw new Error('INVALID_REVIEW_WINDOW_CLOCK')
 const parts=new Intl.DateTimeFormat('en-CA',{
  timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'
 }).formatToParts(target)
 const m=Object.fromEntries(parts.map(x=>[x.type,x.value]))
 const rolling=m.year+'-'+m.month+'-'+m.day
 const start=fixedEnabled?String(fixedStartDate):rolling
 if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||
  new Date(start+'T12:00:00Z').toISOString().slice(0,10)!==start)
  throw new Error('REVIEW_START_DATE_INVALID')
 return {startDate:start,days:amount,rolling:!fixedEnabled,timezone}
}
