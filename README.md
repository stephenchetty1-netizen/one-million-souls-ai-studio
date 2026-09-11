# Christian Content AI Studio — V23

V23 adds the **AI Voice & Visual Asset Engine** layer to the autonomous Christian content pipeline.

### V23 flow

BRAIN → CREATIVE → GENERATE → QUALITY → FACTORY → VIDEO PRODUCTION → ASSET/VOICE MANIFEST → RENDER → PUBLISH → LEARN

The engine creates a renderer-ready manifest for scene visuals, cover art, narration requests, audio mixing and MP4 assembly. Actual generation remains delegated to the configured renderer.

### Safety / quality

The system preserves verified Scripture, avoids fabricated quotations and manipulative promises, requires rights-safe media, prevents unauthorized real-person voice impersonation, and fails closed if the renderer does not return an HTTPS media URL.

`AUTOPILOT_ENABLED=false` remains the default.

## V24 — AI Creative Asset Generator

V24 adds optional real asset generation using OpenAI image and speech models. The orchestrator requests generated visual assets and narration after the video-production manifest passes validation, then sends the asset bundle to the configured renderer. `CREATIVE_ASSETS_ENABLED=false` remains the safe default. For scale, migrate base64 asset transport to object storage with signed HTTPS URLs.

## V25 — Autonomous Video Assembly & Final Quality Director

V25 adds an explicit assembly manifest and a final render-quality gate. The orchestrator now builds the assembly plan, sends it to the renderer, validates the returned video metadata, and only then publishes. The final gate fails closed on missing HTTPS media, missing Scripture-integrity confirmation, rights clearance, captions, audio, or the required 1080×1920 format.

See `docs/V25-AUTONOMOUS-VIDEO-ASSEMBLY.md`.

## V26 — Autonomous Distribution & Platform Intelligence

V26 adds a platform-aware distribution layer after final video quality approval. It creates separate TikTok and YouTube packages, validates publication metadata, requires HTTPS final media, enables AI-content disclosure fields in the Metricool adapter, and publishes only after the final quality gate passes.

See `docs/V26-AUTONOMOUS-DISTRIBUTION.md`.

## V27 — Autonomous Post-Publish Intelligence

V27 closes the learning loop after distribution. It analyzes only ingested public performance records and compares recent posts against platform-specific comparable-post medians. It classifies results as awaiting data, early signal, measured, winner, or needs adaptation. It recommends preserving winning creative ingredients while testing controlled variations, and it avoids declaring winners when there is insufficient data.

### Endpoints
- `POST /api/post-publish/inspect` — protected post-level analysis.
- `POST /api/post-publish/report` — protected aggregate report.
- `GET|POST /api/cron/post-publish` — protected scheduled intelligence run.

V27 does not claim that a successful scheduler response means a post is publicly live. Provider-specific public-status reconciliation can be added through a verified analytics/provider adapter.

## V28 — Autonomous Learning & Decision Agent
V28 closes the learning loop by converting post-publish intelligence into the next content decision. The decision agent classifies the current evidence as INSUFFICIENT_DATA, EXPLORE, EXPLOIT, or BALANCED and recommends a topic, pillar, hook direction, format, objective, preserved ingredients, and one controlled change. The orchestrator consumes this decision before generation. Decisions are persisted to Upstash when configured. Biblical, safety, rights, and privacy guardrails remain mandatory.

### V28 endpoints
- `POST /api/decision` — protected autonomous next-content decision
- `GET/POST /api/cron/decision` — protected scheduled decision refresh

## V29 — Autonomous Mission Strategist

V29 adds mission-level intelligence for the One Million Souls strategy. It converts performance and decision signals into a seasonal strategy covering audience, pillars, campaign theme, recurring content series, priorities, experiments, and guardrails.

New endpoints:
- `POST /api/mission`
- `GET /api/cron/mission`

The latest strategy persists to Upstash at `one-million-souls:mission:strategy:latest`.

The mission layer optimizes how the Gospel is communicated, not the truth of the Gospel itself. It does not infer salvation or spiritual transformation from engagement metrics.

## V30 — Autonomous Campaign Architect

V30 adds campaign-level planning on top of the V29 mission strategist. It creates a multi-week campaign architecture with an audience journey, phase-specific episode objectives, experiment allocation, success signals, and automatic adaptation rules.

New endpoints:
- `/api/campaign/architecture`
- `/api/cron/campaign-architecture`

Latest architecture persists in `one-million-souls:campaign:architecture:latest` when Upstash is configured.

## V31 — Autonomous Content Calendar & Programming Director

V31 converts the V30 campaign architecture into an executable publishing calendar. It assigns every campaign episode a deterministic publish slot, journey stage, platform priority, and controlled exploration/exploitation mode while preserving the campaign sequence and Gospel guardrails.

New endpoints:
- `POST /api/programming/calendar` — protected calendar generation
- `GET|POST /api/cron/programming` — protected scheduled calendar refresh

The latest calendar persists to Upstash at `one-million-souls:programming:calendar:latest` when configured. The baseline cadence is one primary short-form episode per day, repurposed to TikTok and YouTube Shorts. Timing remains a deterministic baseline until enough platform-specific timing evidence exists to justify adaptive scheduling.


## V37 — Autonomous Agent Supervisor

V37 coordinates the specialist agents, checks dependencies and conflicts, and fails closed before orchestration when repair or blocking conditions exist. See `docs/V37-AUTONOMOUS-AGENT-SUPERVISOR.md`.

## V38 — Autonomous Agent Memory

V38 adds durable institutional memory above the learning loop. The system converts measured public performance and autonomous decisions into evidence-weighted lessons and durable principles. Memory distinguishes wins, losses, patterns, decisions, and guardrails, and persists the latest memory snapshot to Upstash at `one-million-souls:agent-memory:latest`.

New endpoints:
- `GET|POST /api/memory` — protected memory snapshot generation/read.
- `GET|POST /api/cron/memory` — protected scheduled memory refresh.

Memory is deliberately conservative: weak evidence does not become a permanent rule, memory never overrides verified Scripture or safety/rights/quality gates, and private or sensitive audience data is excluded.

See `docs/V38-AUTONOMOUS-AGENT-MEMORY.md`.


## V43 — Autonomous Knowledge & Scripture Intelligence

V39 adds a dedicated Scripture Intelligence layer before content generation. It researches the selected topic, verifies primary and supporting references, captures literary and historical context, identifies common misreadings, and records application boundaries. The layer is evidence-weighted and never treated as a replacement for Scripture, pastoral authority, or theological scholarship.

New endpoints:
- `POST /api/knowledge/scripture` — protected Scripture knowledge generation for a selected topic.
- `GET /api/cron/knowledge` — protected daily knowledge refresh using the latest content decision.

Latest knowledge persists to `one-million-souls:knowledge:scripture:latest`. The orchestrator now requires a valid Scripture Intelligence result before content generation proceeds.

See `docs/V39-SCRIPTURE-INTELLIGENCE.md`.


## V43 — Autonomous Theological Consistency Agent

V43 adds an independent theological consistency gate after content generation and before production. It checks Scripture faithfulness, contextual faithfulness, Gospel-centeredness, theological clarity, and the distinction between biblical teaching and application. A non-PASS review blocks autonomous rendering and publishing.

The review is persisted at `one-million-souls:theology:consistency:latest`. It never overrides Scripture Intelligence, existing quality gates, safety checks, rights checks, or platform validation.

## V43 — Autonomous Biblical Source Hierarchy & Evidence Engine
V43 ranks evidence into PRIMARY_SCRIPTURE, STRONG_REFERENCE, SECONDARY_COMMENTARY, and UNVERIFIED. It produces claim-level verdicts and fails closed when unsupported or rejected evidence is material. Protected endpoint: `/api/knowledge/sources`. Persistence key: `one-million-souls:knowledge:source-hierarchy:latest`.


## V43 — Autonomous Biblical Claim Verification
Claim-level verification traces script, theology, history, attribution, and quotations to the strongest available public evidence. It fails closed on fabricated or materially unsupported claims and persists the latest report in Upstash Redis.

## V45 — Autonomous Biblical Context Agent

V44 adds literary, historical, grammatical, and immediate-passage context review before theological approval. Material contextual uncertainty or misalignment fails closed.


## V45 — Autonomous Scripture Interpretation

Adds a dedicated interpretation layer that separates textual meaning, contextual meaning, theological synthesis, inference, and contemporary application. Material uncertainty or misalignment fails closed. See `docs/V45-AUTONOMOUS-SCRIPTURE-INTERPRETATION.md`.

## V46 — Autonomous Biblical Hermeneutics Review Agent

V46 adds a method-level hermeneutics gate after biblical context and Scripture interpretation. It reviews genre, authorial intent, original audience, covenantal setting, grammatical scope, and canonical harmony. It specifically guards against proof-texting, genre confusion, universalizing local promises, ignoring covenantal setting, and confusing description with prescription. Material uncertainty or misalignment fails closed before theological approval and production.

New endpoints:
- `POST /api/knowledge/hermeneutics` — protected hermeneutics review.
- `GET /api/cron/hermeneutics` — protected scheduled refresh.

Successful autonomous-safe reviews persist to `one-million-souls:knowledge:scripture-hermeneutics:latest`.

See `docs/V46-AUTONOMOUS-BIBLICAL-HERMENEUTICS.md`.

## V48 — Autonomous Biblical Theology & Canonical Synthesis
V47 adds a canonical theology gate that checks immediate passage meaning, book-level theology, whole-canon synthesis, Gospel centrality, doctrinal balance, and application scope. It distinguishes explicit teaching from synthesis and application and fails closed on material overreach.

## V48 — Autonomous Biblical Doctrine & Systematic Theology

Adds a doctrinal gate that distinguishes explicit biblical teaching from inference and application, checks canonical support, Christological/Gospel coherence, doctrinal boundaries, and alternative readings. It fails closed on material uncertainty or doctrinal overreach and is integrated into the autonomous orchestrator before theological consistency.

Persistence key: `one-million-souls:knowledge:biblical-doctrine:latest`
API: `/api/knowledge/doctrine`
Cron: `/api/cron/doctrine`

## V49 — Autonomous Christ-Centered Gospel Review

V49 adds a dedicated Gospel gate that audits whether Christian content genuinely and accurately points to Jesus. It separates the passage's established meaning from legitimate Christ/Gospel connections, checks grace and response, Christ's death and resurrection, kingdom/disciple-making, and invitation scope. It explicitly guards against forced Christology, works-based salvation, prosperity guarantees, generic positivity replacing the Gospel, and manipulative invitations.

New endpoints:
- `POST /api/knowledge/gospel` — protected Christ-centered Gospel review.
- `GET /api/cron/gospel` — protected scheduled Gospel review refresh.

Successful autonomous-safe reviews persist to `one-million-souls:knowledge:christ-centered-gospel:latest`.

The orchestrator now runs the Gospel gate after doctrine and before independent theological consistency.

## V50 — Autonomous Gospel & Discipleship Transformation Review
V50 audits the responsible movement from Gospel truth toward repentance, faith, discipleship, obedience, and mission. It explicitly refuses to claim knowledge of a viewer's spiritual transformation and blocks manipulative conversion tactics, works-based salvation, guaranteed outcomes, or engagement-as-discipleship. The gate is integrated before theological consistency.

## V51 — Autonomous Evangelism & Mission Review

V51 adds a dedicated evangelism and mission gate after Gospel and discipleship review. It checks Gospel clarity, evangelistic invitation, discipleship-to-mission connection, witness, urgency, and audience dignity. It explicitly distinguishes biblical invitation from conversion outcomes and blocks coercive, manipulative, fear-based, shame-based, works-based, fabricated, or unsupported evangelistic claims.

New endpoints:
- `POST /api/knowledge/evangelism-mission` — protected mission review.
- `GET /api/cron/evangelism-mission` — protected scheduled refresh.

Successful autonomous-safe reviews persist to `one-million-souls:knowledge:evangelism-mission:latest`.

The orchestrator runs the V51 gate after Gospel & Discipleship and before independent theological consistency.

## V52 — Autonomous Apologetics & Truth Defense

V52 adds an apologetics gate that evaluates Christian responses to questions and objections for fairness, evidence quality, historical reasoning, alternative viewpoints, and honest limits. It is designed to prevent fabricated evidence, false certainty, caricature of opposing views, and coercive apologetics.

Pipeline addition:
`Evangelism & Mission → Apologetics & Truth Defense → Theological Consistency → Production`

Persistent key: `one-million-souls:knowledge:apologetics:latest`

Routes:
- `POST /api/knowledge/apologetics`
- `GET /api/cron/apologetics`

## V53 — Autonomous Christian Ethics & Moral Reasoning Review

V53 adds an ethics gate that distinguishes explicit biblical commands, biblical principles, wisdom and conscience, cultural application, Christian freedom, and legitimate areas of faithful disagreement. It is integrated into the autonomous orchestrator after apologetics and before independent theological consistency.

Persistence key: `one-million-souls:knowledge:christian-ethics:latest`
API: `POST /api/knowledge/christian-ethics`
Cron: `GET /api/cron/christian-ethics`

Autonomous publishing fails closed when ethical claims are unsupported, materially uncertain, misaligned, coercive, or otherwise unsafe to state as settled Christian teaching.


## V54 — Autonomous Pastoral Wisdom & Audience Care Review

V54 adds a pastoral-care gate after Christian ethics and before independent theological consistency. It checks audience care, compassionate tone, age appropriateness, vulnerability and harm risks, practical wisdom, pastoral boundaries, and responsible next steps. It explicitly distinguishes spiritual encouragement from medical, psychological, legal, financial, and safeguarding advice. It does not diagnose viewers or claim to know a viewer's spiritual condition.

Pipeline addition:
`Christian Ethics → Pastoral Wisdom & Audience Care → Theological Consistency → Production`

Persistence key: `one-million-souls:knowledge:pastoral-wisdom:latest`

Routes:
- `POST /api/knowledge/pastoral-wisdom`
- `GET /api/cron/pastoral-wisdom`

Autonomous publishing fails closed when pastoral content is materially uncertain, harmful, coercive, age-inappropriate, or crosses into individualized professional/safeguarding determinations. High-risk cases are routed toward appropriate trusted-human or professional support rather than fabricated AI certainty.

## V55 — Autonomous Spiritual Formation & Prayer Review

V55 adds an independent spiritual-formation gate covering prayer faithfulness, discipleship practices, Scripture alignment, grace and dependence, spiritual growth boundaries, Christian community, and motivation. It guards against formulaic prayer, transactional spirituality, guaranteed outcomes, works-based acceptance, fabricated testimonies, and treating engagement as spiritual growth. The orchestrator runs Spiritual Formation after Pastoral Wisdom and before final Theological Consistency.

## V56 — Autonomous Christian Community & Church Life Review

V56 adds an independent community-life gate covering church and fellowship, unity and peace, accountability, serving and stewardship, discipleship relationships, leadership and authority, and AI/community boundaries. It guards against treating AI engagement as church, replacing pastors or real relationships, coercive participation, fabricated community outcomes, unhealthy isolation, and presenting local traditions as universal biblical commands. The orchestrator runs Community after Spiritual Formation and before final Theological Consistency.

## V57 — Autonomous Christian Character & Virtue Review

V57 adds an independent character-formation gate covering love and compassion, humility and servanthood, integrity and truthfulness, patience and self-control, courage and faithfulness, mercy and forgiveness, Christlike motivation, and the grace/works boundary. It is integrated after Christian Community and before theological consistency. The gate is fail-closed and explicitly rejects perfectionism, shame-based formation, fabricated transformation claims, engagement-as-maturity, and works-based salvation.


## V59 — Autonomous Christian Wisdom & Decision-Making Review

V59 adds an independent Christian wisdom gate covering scriptural wisdom, decision scope, motives, counsel and community, stewardship, conscience and Christian freedom, uncertainty and providence, and practical application. It guards against pretending to know God's hidden will, treating algorithms or outcomes as divine guidance, superstition, coercion, and replacing qualified human counsel in consequential matters.

Persistence key: `one-million-souls:knowledge:christian-wisdom:latest`

Routes:
- `POST /api/knowledge/wisdom` — protected wisdom review.
- `GET /api/cron/wisdom` — protected scheduled refresh.

The orchestrator runs Wisdom after Christian Character and before independent theological consistency. Autonomous publishing fails closed when material uncertainty, overreach, or unsafe decision guidance is detected.

## V59 — Autonomous Christian Wisdom & Decision-Making Review

V59 adds an independent wisdom gate for Christian practical guidance. It evaluates scriptural wisdom, decision scope, motives, counsel and community, stewardship and responsibility, freedom and conscience, uncertainty and providence, and practical application. It explicitly avoids claiming knowledge of God's hidden will, turning outcomes or algorithms into divine guidance, coercing decisions, or replacing qualified human counsel in consequential matters.

Persistence key: `one-million-souls:knowledge:christian-wisdom:latest`

Routes:
- `POST /api/knowledge/wisdom` — protected wisdom review.
- `GET /api/cron/wisdom` — protected scheduled refresh.

Pipeline addition:
`Christian Character → Christian Wisdom & Decision-Making → Theological Consistency → Production`

## V59 Finalization Status

V59 is the finalized autonomous Christian discernment layer. The main orchestrator now sends the complete upstream review context into the Discernment Engine and requires a `PROCEED` decision before production continues.

### Final fail-closed rule

The system must not render or publish when discernment returns `REVISE`, `RESEARCH`, `WAIT_FOR_HUMAN_REVIEW`, or `BLOCK`, or when validation fails.

### Deployment note

Install dependencies in the deployment environment before running the production build. This workspace intentionally does not vendor `node_modules`.
