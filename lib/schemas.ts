import { z } from 'zod';

// API request validation schemas
export const knowledgeRequestSchema = z.object({
  topic: z.string().min(1),
  context: z.string().optional(),
  previousKnowledge: z.record(z.any()).optional(),
});

export const wisdomRequestSchema = z.object({
  decision: z.string().min(1),
  context: z.record(z.any()).optional(),
  constraints: z.array(z.string()).optional(),
});

export const discernmentRequestSchema = z.object({
  content: z.string().min(1),
  contentType: z.enum(['scripture', 'theology', 'ethics', 'pastoral', 'apologetics']),
  reviews: z.record(z.any()),
  requiresApproval: z.boolean().default(true),
});

// Response types
export type DiscernmentDecision = 'PROCEED' | 'REVISE' | 'RESEARCH' | 'WAIT_FOR_HUMAN_REVIEW' | 'BLOCK';

export interface DiscernmentResult {
  decision: DiscernmentDecision;
  summary: string;
  reasoning: string[];
  blockers: string[];
  recommendations: string[];
  timestamp: string;
  version: string;
}

export interface KnowledgeResult {
  topic: string;
  evidence: {
    type: 'PRIMARY_SCRIPTURE' | 'STRONG_REFERENCE' | 'SECONDARY_COMMENTARY' | 'UNVERIFIED';
    source: string;
    content: string;
  }[];
  context: {
    literary?: string;
    historical?: string;
    grammatical?: string;
  };
  timestamp: string;
}

export interface WisdomResult {
  decision: string;
  scriptureAlignment: number; // 0-100
  compassionScore: number; // 0-100
  wisdomGates: {
    [key: string]: boolean;
  };
  recommendations: string[];
  timestamp: string;
}
