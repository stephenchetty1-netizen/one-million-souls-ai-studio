import { NextRequest, NextResponse } from 'next/server'
import { verifyBiblicalClaims, saveClaimVerification } from '@/lib/claim-verification'
import { getScriptureKnowledge } from '@/lib/scripture-intelligence'
function auth(req:NextRequest){return req.headers.get('authorization')===`Bearer ${process.env.CRON_SECRET}`}
export async function GET(req:NextRequest){if(!auth(req))return NextResponse.json({error:'Unauthorized'},{status:401});const k=await getScriptureKnowledge();if(!k)return NextResponse.json({status:'INSUFFICIENT_EVIDENCE',detail:'No Scripture knowledge record available.'});const report=await verifyBiblicalClaims([{id:'primary-reference',claim:k.primaryReference,category:'SCRIPTURE',references:[k.primaryReference]},{id:'christ-centered-connection',claim:k.christCenteredConnection,category:'THEOLOGY',references:[k.primaryReference]}]);await saveClaimVerification(report);return NextResponse.json(report)}
