import { NextRequest, NextResponse } from 'next/server';
import { wisdomRequestSchema, WisdomResult } from '@/lib/schemas';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request
    const validation = wisdomRequestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { decision, context, constraints } = validation.data;

    // Evaluate wisdom gates
    const wisdomGates: { [key: string]: boolean } = {
      scriptureAlignment: true,
      decisionScope: true,
      motivesClarity: true,
      counselAndCommunity: true,
      stewardshipResponsibility: true,
      freedomAndConsience: true,
      uncertaintyAndProvidence: true,
      compasionateApplication: true,
    };

    // Calculate scores based on context
    const scriptureAlignment = 85; // Mock calculation
    const compassionScore = 90; // Mock calculation

    const result: WisdomResult = {
      decision,
      scriptureAlignment,
      compassionScore,
      wisdomGates,
      recommendations: [
        'Ensure decision aligns with scriptural principles',
        'Consider impact on community and relationships',
        'Practice stewardship and responsible freedom',
        'Seek counsel from trusted believers',
        'Trust in God\'s providence through uncertainty',
      ],
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('Wisdom API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json(
    { 
      message: 'POST to /api/wisdom with decision and optional context',
      gates: [
        'scriptureAlignment',
        'decisionScope',
        'motives',
        'counselAndCommunity',
        'stewardship',
        'freedom',
        'uncertainty',
        'compassion',
      ],
    },
    { status: 200 }
  );
}
