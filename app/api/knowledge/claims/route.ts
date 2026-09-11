import { NextRequest, NextResponse } from 'next/server'
import { verifyBiblicalClaims, saveClaimVerification } from '@/lib/claim-verification'
function auth(req:NextRequest){return req.headers.get('authorization')===`Bearer ${process.env.CRON_SECRET}`}
export async function POST(req:NextRequest){if(!auth(req))return NextResponse.json({error:'Unauthorized'},{status:401});try{const body=await req.json();const report=await verifyBiblicalClaims(Array.isArray(body.claims)?body.claims:[]);await saveClaimVerification(report);return NextResponse.json(report)}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Verification failed'},{status:500})}}
