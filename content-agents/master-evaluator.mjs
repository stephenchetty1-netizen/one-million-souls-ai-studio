import OpenAI from 'openai'
import fs from 'node:fs/promises'
import path from 'node:path'

const client=new OpenAI({apiKey:process.env.OPENAI_API_KEY})
const model=process.env.AUTONOMY_MODEL||'gpt-5-mini'

export async function evaluateMaster({contentHash,masterHash,master,evidence}){
 if(!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY_MISSING')
 if(!/^[a-f0-9]{64}$/i.test(contentHash)||!/^[a-f0-9]{64}$/i.test(masterHash)) throw new Error('INVALID_MASTER_IDENTITY')
 if(!master||!evidence) throw new Error('REAL_MASTER_AND_MEASURED_EVIDENCE_REQUIRED')
 const policy=JSON.parse(await fs.readFile(path.join(process.cwd(),'content-agents','approval-policy.json'),'utf8'))
 const decisions={}
 for(const agentId of policy.requiredAgents){
  if(agentId==='publisher') continue
  const prompt={agentId,contentHash,masterHash,master,evidence,standard:'PROFESSIONAL_MASTER',
   instruction:'Act only as the named specialist. Evaluate the supplied immutable master and measured evidence. Never invent missing evidence. Return APPROVE only when evidence supports your specialist remit; otherwise REVISE or BLOCK. Give concise specific evidence.'}
  const r=await client.responses.create({model,input:JSON.stringify(prompt)})
  const text=String(r.output_text||'').trim()
  const m=text.match(/\b(APPROVE|REVISE|BLOCK)\b/i)
  const decision=m?m[1].toUpperCase():'BLOCK'
  decisions[agentId]={decision,evidence:text||'No usable evaluator evidence returned'}
 }
 const all49=policy.requiredAgents.filter(x=>x!=='publisher').every(id=>decisions[id]?.decision==='APPROVE')
 decisions.publisher=all49
  ? {decision:'APPROVE',evidence:'Publisher last: all 49 specialist evaluations returned APPROVE for this exact contentHash and masterHash.'}
  : {decision:'BLOCK',evidence:'Publisher blocked because one or more of the 49 specialist evaluations did not APPROVE.'}
 return {contentHash,masterHash,decisions,all49Approved:all49}
}
