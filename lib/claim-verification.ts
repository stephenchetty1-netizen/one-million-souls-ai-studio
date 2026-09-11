import OpenAI from 'openai'
import { z } from 'zod'
import { redisGetJson, redisSetJson } from './jobs'
import { getScriptureKnowledge } from './scripture-intelligence'

export type ClaimVerdict = 'SUPPORTED'|'PARTIAL'|'UNSUPPORTED'|'REJECTED'
export type BiblicalClaim = { id:string; claim:string; category:'SCRIPTURE'|'THEOLOGY'|'HISTORY'|'APPLICATION'|'ATTRIBUTION'|'QUOTE'; references?:string[] }
export type ClaimVerification = BiblicalClaim & { verdict:ClaimVerdict; confidence:number; evidence:string[]; reason:string; requiredAction:'NONE'|'REVISE'|'BLOCK' }
export type ClaimVerificationReport = { version:'V43'; generatedAt:string; status:'PASS'|'REVISE'|'BLOCK'|'INSUFFICIENT_EVIDENCE'; claims:ClaimVerification[]; summary:string; guardrails:string[] }
const KEY='one-million-souls:knowledge:claim-verification:latest'
const ResultSchema=z.object({claims:z.array(z.object({id:z.string(),verdict:z.enum(['SUPPORTED','PARTIAL','UNSUPPORTED','REJECTED']),confidence:z.number().min(0).max(1),evidence:z.array(z.string()),reason:z.string(),requiredAction:z.enum(['NONE','REVISE','BLOCK'])})),summary:z.string()})
const guards=['Scripture remains primary authority.','Do not fabricate quotations, references, testimony, statistics, or historical claims.','Inference/application must not be presented as explicit biblical teaching.','Public evidence only; no private or sensitive audience profiling.','Verification cannot bypass safety, rights, quality, or theological gates.']
export async function verifyBiblicalClaims(claims:BiblicalClaim[]):Promise<ClaimVerificationReport>{
 if(!claims.length)return {version:'V43',generatedAt:new Date().toISOString(),status:'INSUFFICIENT_EVIDENCE',claims:[],summary:'No claims supplied.',guardrails:guards}
 if(!process.env.OPENAI_API_KEY)throw new Error('OPENAI_API_KEY is not configured on the server.')
 const client=new OpenAI({apiKey:process.env.OPENAI_API_KEY}); const scripture=await getScriptureKnowledge()
 const response=await client.responses.create({model:process.env.OPENAI_TEXT_MODEL||'gpt-5.6-terra',input:`Verify each claim using strongest available public evidence. Scripture is primary authority. Distinguish explicit teaching from inference/application. Never invent evidence. Return JSON only matching the requested schema. Claims: ${JSON.stringify(claims)}. Scripture knowledge: ${JSON.stringify(scripture)}`,tools:[{type:'web_search_preview'} as any]})
 let parsed:any; try{parsed=ResultSchema.parse(JSON.parse(response.output_text.replace(/^```json\s*|\s*```$/g,'')))}catch{return {version:'V43',generatedAt:new Date().toISOString(),status:'BLOCK',claims:claims.map(c=>({...c,verdict:'REJECTED',confidence:0,evidence:[],reason:'Structured verification failed; blocked closed.',requiredAction:'BLOCK'})),summary:'Verifier output was invalid.',guardrails:guards}}
 const results=claims.map(c=>{const x=parsed.claims.find(v=>v.id===c.id); return {...c,verdict:x?.verdict||'REJECTED',confidence:x?.confidence||0,evidence:x?.evidence||[],reason:x?.reason||'No verification result.',requiredAction:x?.requiredAction||'BLOCK'} as ClaimVerification})
 const status=results.some(x=>x.requiredAction==='BLOCK'||x.verdict==='REJECTED')?'BLOCK':results.some(x=>x.requiredAction==='REVISE'||x.verdict==='UNSUPPORTED'||x.verdict==='PARTIAL')?'REVISE':'PASS'
 return {version:'V43',generatedAt:new Date().toISOString(),status,claims:results,summary:parsed.summary,guardrails:guards}
}
export async function saveClaimVerification(report:ClaimVerificationReport){await redisSetJson(KEY,report);return report}
export async function getLatestClaimVerification(){return redisGetJson<ClaimVerificationReport>(KEY)}
