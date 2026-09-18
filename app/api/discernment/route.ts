import { NextRequest, NextResponse } from 'next/server';
import { discernmentRequestSchema, DiscernmentResult } from '@/lib/schemas';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request
    const validation = discernmentRequestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { content, contentType, reviews, requiresApproval } = validation.data;

    // Analyze reviews for blockers
    const blockers: string[] = [];
    const recommendations: string[] = [];
    
    Object.entries(reviews).forEach(([gate, result]: [string, any]) => {
      if (result.blocked || result.status === 'BLOCK') {
        blockers.push(`${gate}: ${result.reason || 'Blocked by gate'}`);
      }
      if (result.recommendation) {
        recommendations.push(`${gate}: ${result.recommendation}`);
      }
    });

    // Determine final decision
    let decision: 'PROCEED' | 'REVISE' | 'RESEARCH' | 'WAIT_FOR_HUMAN_REVIEW' | 'BLOCK' = 'PROCEED';
    
    if (blockers.length > 0) {
      decision = 'BLOCK';
    } else if (requiresApproval && Object.keys(reviews).length < 10) {
      decision = 'WAIT_FOR_HUMAN_REVIEW';
    }

    const result: DiscernmentResult = {
      decision,
      summary: `V59 Discernment Result for ${contentType}`,
      reasoning: [
        `Analyzed content type: ${contentType}`,
        `Reviewed ${Object.keys(reviews).length} theological gates`,
        `Blockers found: ${blockers.length}`,
        `Recommendations: ${recommendations.length}`,
      ],
      blockers,
      recommendations,
      timestamp: new Date().toISOString(),
      version: 'v59',
    };

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('Discernment API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json(
    { 
      message: 'POST to /api/discernment with content, contentType, and reviews',
      version: 'v59',
      supportedTypes: ['scripture', 'theology', 'ethics', 'pastoral', 'apologetics'],
    },
    { status: 200 }
  );
}
