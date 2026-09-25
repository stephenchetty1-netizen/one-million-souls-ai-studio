# Operations Hub: integration gate and runtime evidence

**Observed 2026-09-25 11:12 UTC (13:12 Africa/Johannesburg)** from connected Railway deployment logs. This is a dated **diagnostic snapshot**, not a live probe, master certificate, sales report or assertion that a test publication occurred.

## Verified facts

- OneHub Floot storefront is published at https://onehub-ai-business.floot.app; the new Operations Hub is NOT installed there. Existing Floot app has a database and email/password auth; access to business records requires its existing admin role.
- V59 and renderer have successful Railway deployment records; renderer and app responded 200 to the recovery agent's reachability checks. Deployment success is not an end-to-end production pass.
- V59 recovery scan status: `REPAIR_REQUIRED`, `allPassed=false`, 12 repair checks.
- `regression-test-engineer`: readiness HTTP 503, 0 independently certified final masters.
- `manifest-consistency-engineer`: date 2026-09-26, 3 entries, 0 release-ready candidates, short-source approval 3/9, long-source approval 0/24.
- Railway's renderer proxy logs contain HTTP 404 on `/factory-manifest`. Its server route returns 404 when a dated stored manifest cannot be read; do not infer that the endpoint code is absent or the entire renderer is down.
- OMS `AUTONOMY_CYCLE_PASS` log carries `providerConnected:false`; it describes a cycle, not completed video rendering.
- `release-gate-integrity-engineer` passed: publishing remains locked. Maintain it that way.

## Remaining integration work, in order

1. **Floot command centre:** add an admin-authenticated route and server-side workflow storage when the account's free Floot build-action capacity permits. Never put the Floot database credential or PayPal tokens in a static HTML file. Keep the public storefront unchanged.
2. **Read-only V59 status bridge:** authenticated, server-side adapter that fetches the V59 health / readiness / master registry. Treat a failed request as unavailable, never fabricate a green result. Avoid a public browser-side bearer token.
3. **Manifest discrepancy:** collect the exact 404 query date and server storage error, compare `manifests/YYYY-MM-DD.json` with `manifests/latest.json`, and confirm whether that date is supposed to exist. Do not use a blank fallback manifest as a fake PASS.
4. **Media evidence:** confirm each short/long source has rights evidence, and the final rendered MP4 has a content hash and an independent human review. Do not move local checklist decisions to V59 automatically.
5. **Revenue:** show real sales only after independent PayPal verification. Do not count visits, clicks, enquiries or draft receipts as funds received.
6. **Publishing:** remains DISABLED. No social APIs, scheduled posts, mass messages or paid API calls are authorized by this PR.

## Acceptance tests before claiming integrated

- Admin user can create one isolated work item in each workspace; unauthenticated requests cannot read either workspace.
- Refresh on another Android browser session shows committed work from the server, not a local-only copy.
- A deliberately failed V59 request yields `unavailable` instead of `healthy`.
- A known exact master SHA-256 can be reviewed without enabling social publishing.
- A lead without confirmed payment remains unverified.
- All local workflow tests, GitHub safety CI and appropriate real production health tests pass.

The V2 standalone HTML delivered in the ChatGPT conversation remains local-only. This branch does not create a Floot application, modify Railway environment variables, or deploy to production.
