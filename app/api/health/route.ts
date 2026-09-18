import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const status = {
      service: 'one-million-souls-ai-studio',
      version: 'v59',
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      endpoints: {
        knowledge: '/api/knowledge',
        discernment: '/api/discernment',
        wisdom: '/api/wisdom',
        health: '/api/health',
      },
      features: {
        scriptureIntelligence: true,
        biblicalSourceHierarchy: true,
        claimVerification: true,
        contextAnalysis: true,
        scriptureInterpretation: true,
        hermeneutics: true,
        theology: true,
        doctrine: true,
        gospel: true,
        discipleship: true,
        evangelism: true,
        apologetics: true,
        ethics: true,
        pastoral: true,
        spiritualFormation: true,
        community: true,
        character: true,
        wisdom: true,
      },
      backend: {
        status: 'ready',
        gateway: 'tcp://localhost:9339',
        protocol: 'Piranha',
      },
    };

    return NextResponse.json(status, { status: 200 });
  } catch (error) {
    console.error('Health check error:', error);
    return NextResponse.json(
      { 
        service: 'one-million-souls-ai-studio',
        status: 'error',
        error: 'Health check failed',
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
