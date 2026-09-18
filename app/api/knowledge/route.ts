import { NextRequest, NextResponse } from 'next/server';
import { knowledgeRequestSchema, KnowledgeResult } from '@/lib/schemas';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request
    const validation = knowledgeRequestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { topic, context } = validation.data;

    // Mock Scripture Knowledge result
    // In production, this would call OpenAI, LLamaIndex, or similar
    const result: KnowledgeResult = {
      topic,
      evidence: [
        {
          type: 'PRIMARY_SCRIPTURE',
          source: 'Bible Passage',
          content: 'Primary scriptural reference for the topic',
        },
        {
          type: 'STRONG_REFERENCE',
          source: 'Theological Commentary',
          content: 'Supporting theological reference with strong scholarly consensus',
        },
      ],
      context: {
        literary: 'Literary context of the passage',
        historical: 'Historical context and cultural setting',
        grammatical: 'Original language and grammatical analysis',
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('Knowledge API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json(
    { message: 'POST to /api/knowledge with topic and context' },
    { status: 200 }
  );
}
