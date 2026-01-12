# Moments Migration Planner — Non-breaking Cutover Plan

Purpose: provide a step-by-step, low-risk migration plan to move MCP/webhook and Supabase to the new project and Vercel deployment, without changing secrets in the repo.

High-level phases
- Phase 0 — Prepare (this file + review)
- Phase 1 — Staging deploy & verification
- Phase 2 — Production cutover
- Phase 3 — Post-cutover monitoring & rollback readiness

Files to inspect/update (minimal, non-breaking)
- `whatsapp/.env` — remove from repo (if present) and ensure `.gitignore` contains it. Do not modify secret values in this repo.
- `whatsapp/VERCEL_ENV.md` — update to final `SUPABASE_URL` and `MCP_ENDPOINT` values for documentation.
- `whatsapp/src/server-bulletproof.js` — ensure POST `/webhook` enforces HMAC verification and fails safe; confirm `WEBHOOK_VERIFY_TOKEN` used only for GET verification during setup.
- `whatsapp/src/whatsapp-commands.js` — validate subscription schema usage matches new taxonomy; add stable target_id usage (UUIDs) if missing.
- `whatsapp/src/broadcast-hybrid.js` — ensure admin cost estimation logic is present and broadcast requires two-stage confirmation.
- `whatsapp/debug-webhook.sh`, `test-commands.sh` — update endpoints to staging URLs for testing only.

Environment changes required (staging then production)
- SUPABASE_URL (staging), SUPABASE_SERVICE_KEY (staging), SUPABASE_ANON_KEY
- WHATSAPP_TOKEN, WHATSAPP_PHONE_ID, WHATSAPP_BUSINESS_ACCOUNT_ID
- WEBHOOK_VERIFY_TOKEN, WEBHOOK_HMAC_SECRET
- N8N_WEBHOOK_URL (staging), MCP_ENDPOINT (staging)
- JWT_SECRET, INTERNAL_WEBHOOK_SECRET (staging)

Staging checklist (must pass before prod cutover)
1. Provision staging Supabase and apply DB migrations for `moments`, `moment_intents`, `subscriptions`, `campaigns`, `campaign_advisories`.
2. Add staging env vars to Vercel preview and Supabase (do not commit). Use preview env in Vercel.
3. Deploy MCP to Supabase staging functions and deploy app to Vercel preview.
4. Point Meta webhook to staging preview endpoint (use `WEBHOOK_VERIFY_TOKEN` to verify GET). Do not change production webhook yet.
5. Run automated tests:
   - `node whatsapp/test-subscriber-flow.js` — expect opt-in rows in `subscriptions`.
   - `node whatsapp/test-complete-flow.js` — expect `moment_intents` created and updated by n8n simulation.
   - `node whatsapp/verify-campaigns.js` and `node whatsapp/test-campaigns.js` — confirm campaigns tables exist and CRUD works.
6. Run HMAC verification tests: send signed and unsigned POSTs; unsigned must be rejected.
7. Confirm n8n receives `N8N_WEBHOOK_URL` payloads and logs processing results.
8. In Admin UI staging: verify cost estimation, role enforcement, and audit logs are recorded for approve/schedule/broadcast-request flows.

Rollback checklist (if staging fails or production issue)
- If staging fails: fix issues and repeat staging steps; do not touch production.
- If production cutover causes errors: immediate rollback steps
  1. Repoint Meta webhook back to previous URL (record prior URL before change).
  2. Redeploy previous stable Vercel production build (via Vercel dashboard / `vercel --prod --rollback` if available).
  3. Run audits to find which messages were broadcast; notify stakeholders.

PR strategy & commits
- Use feature branches:
  - `feature/mcp-staging-config` — add staging-only config files or docs (no secrets).
  - `fix/hmac-enforce` — code change to ensure HMAC verified (include unit tests where possible).
  - `chore/remove-env-docs` — update docs to instruct moving secrets to Vercel and Supabase.
- Each PR must include checklist: tests run, staging deployment link, verification screenshots/logs, and a Superadmin sign-off comment.

Testing harness & CI notes
- Add a CI job (GitHub Actions) that runs the test scripts against a preview environment when a PR is opened and env secrets are available in Actions secrets (for preview only).
- Do not store service role keys in Actions logs or outputs.

Security & compliance pre-conditions
- All secrets must be stored in Vercel and Supabase secret stores (not repo).
- `SUPABASE_SERVICE_KEY` must be scoped and rotated; consider generating a scoped key limited to required RPCs if possible.
- Ensure audit logging is atomic with state transitions (approve, schedule, broadcast-request).

Estimated timeline (minimal)
- Preparation & docs: 1 business day
- Staging provisioning & deploy: 1 business day
- Verification & tests: 1 business day
- Production cutover with monitoring: 1 business day

Contact & approvals
- Superadmin must approve production webhook change and broadcast budget token before production messages are sent.

---
End of Planner migration plan.
