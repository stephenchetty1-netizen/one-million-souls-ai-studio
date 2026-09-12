# One Million Souls AI Studio v59

**Christian Content AI Discernment Platform with Autonomous Backend Processing**

V59 is the finalized autonomous Christian discernment layer for the One Million Souls strategy. The system integrates a complete theological reasoning stack with real-time backend processing capabilities.

## V59 Architecture

### Frontend (Next.js React)
- Modern React 18+ with TypeScript
- Tailwind CSS for responsive styling
- Server-side rendering (SSR)
- API routes for orchestration
- Real-time backend communication

### Backend (C# .NET 8)
- **LaserTcpCentralGateway** - High-performance TCP message broker
- **Piranha Protocol** - Binary message serialization
- **Cryptographic Session Handling** - TweetNaCl, Blake2B, Pepper encryption
- **Message Management** - Client login, home data, player state
- **Service Architecture** - TCP sessions, message routing, state persistence

## V59 Autonomous Discernment Pipeline

The orchestrator sends complete content review context through these independent gates:

1. **Scripture Intelligence** — Verify references, capture context
2. **Biblical Source Hierarchy** — Rank evidence (PRIMARY, STRONG, SECONDARY, UNVERIFIED)
3. **Biblical Claim Verification** — Script, theology, attribution, quotations
4. **Biblical Context Agent** — Literary, historical, grammatical context
5. **Scripture Interpretation** — Textual meaning, theological synthesis
6. **Biblical Hermeneutics** — Genre, authorial intent, covenantal scope
7. **Biblical Theology & Canonical Synthesis** — Whole-canon coherence
8. **Biblical Doctrine & Systematic Theology** — Explicit teaching vs. inference
9. **Christ-Centered Gospel Review** — Jesus centrality and Gospel clarity
10. **Gospel & Discipleship Transformation** — Repentance, faith, discipleship, mission
11. **Evangelism & Mission Review** — Gospel clarity, witness, urgency
12. **Apologetics & Truth Defense** — Fairness, evidence quality, alternative views
13. **Christian Ethics & Moral Reasoning** — Commands, principles, conscience
14. **Pastoral Wisdom & Audience Care** — Compassion, age appropriateness, harm review
15. **Spiritual Formation & Prayer** — Faithfulness, discipleship, grace
16. **Christian Community & Church Life** — Fellowship, unity, accountability
17. **Christian Character & Virtue** — Love, humility, integrity, courage
18. **Christian Wisdom & Decision-Making** — Practical guidance, stewardship, freedom

### Final Fail-Closed Rule

```
Publishing requires PROCEED decision.
Any REVISE, RESEARCH, WAIT_FOR_HUMAN_REVIEW, or BLOCK blocks publication.
```

## Deployment

### Railway Configuration

**Project**: `lavish-enjoyment`  
**Service**: `one-million-souls-v59`  
**Branch**: `v59-production`  
**Default Build**: Dockerfile (Next.js)  
**C# Build**: Dockerfile.csharp (Backend)

### Port Configuration

- **Next.js Frontend**: 3000
- **C# Backend Gateway**: 9339

### Environment Variables

```env
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
PORT=3000
BACKEND_URL=https://your-railway-domain:9339
OPENAI_API_KEY=sk-...
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
```

## Development

```bash
# Install dependencies
npm install

# Development server
npm run dev

# Production build
npm run build

# Start production server
npm start

# Run smoke test
npm run smoke-test
```

## Project Structure

```
one-million-souls-ai-studio/
├── app/                           # Next.js app directory (App Router)
│   ├── page.tsx                   # Home page
│   ├── layout.tsx                 # Root layout with metadata
│   └── globals.css                # Tailwind + global styles
├── package.json                   # Dependencies and scripts
├── Dockerfile                     # Next.js multi-stage production build
├── Dockerfile.csharp              # C# .NET 8 backend build
├── tsconfig.json                  # TypeScript configuration
├── tsconfig.node.json             # Node TypeScript config
├── tsconfig.build.json            # Build TypeScript config
├── tailwind.config.ts             # Tailwind CSS config
├── tailwind.config.js             # Tailwind JS alternative
├── postcss.config.js              # PostCSS configuration
├── next.config.js                 # Next.js configuration
└── README.md                      # This file
```

## Dependencies

### Frontend Runtime
- `next` (latest) - React framework
- `react` (latest) - UI library
- `react-dom` (latest) - DOM rendering
- `openai` (latest) - OpenAI API client
- `zod` (latest) - Schema validation

### Frontend Development
- `typescript` (latest) - Type safety
- `@types/node`, `@types/react`, `@types/react-dom` - Type definitions
- `eslint`, `eslint-config-next` - Linting
- `tailwindcss`, `postcss`, `autoprefixer` - Styling

### Backend Runtime (.NET 8.0)
- `NetCoreServer` (8.0.7) - TCP server framework
- Standard .NET libraries (System.Net, System.Net.Sockets)

## Build and Deployment Notes

- Dependencies are **not vendored** — install in deployment environment
- Builds use multi-stage Docker to minimize final image size
- Next.js build optimizes for production: tree-shaking, code splitting
- C# build includes all layers: Messaging, Protocol, Logic, TitanEngine
- Railway Railpack auto-detects Next.js on `main` branch
- Override with `v59-production` branch for explicit control

## Version History

- **V57** — Christian Character & Virtue Review
- **V58** — (Not documented in README)
- **V59** — Autonomous Christian Wisdom & Decision-Making Review (Final)

## Theological Safety

The V59 system preserves verified Scripture, avoids fabricated quotations, requires rights-safe media, prevents unauthorized voice impersonation, and **fails closed** on uncertainty.

- **No autopilot**: `AUTOPILOT_ENABLED=false` (default)
- **No inference claims**: System refuses to claim knowledge of spiritual transformation
- **No private data claims**: Engagement metrics never imply salvation status
- **Human review loop**: Autonomous publishing requires explicit approval

## Links & Documentation

- Endpoint routes: `/api/knowledge/*` (POST for analysis, GET for cron)
- Persistence: Upstash Redis at `one-million-souls:*:latest` keys
- Docs: See `docs/` directory for version-specific guides

---

**Last Updated**: V59 Production Branch  
**Runtime**: Node.js 20+, .NET 8.0  
**Status**: Ready for deployment
