 # UNAMI FOUNDATION MOMENTS — SYSTEM PLAYBOOK (REVISED)

This `SYSTEM.md` is the operational playbook for engineers, maintainers, and AI agents working on Moments. IMPORTANT TRUTH: this document was created outside the repository. The Supabase project backing Moments is newly provisioned and the repo was cloned as the working snapshot. Treat Supabase as the source of truth for runtime state.

**Key truths**:
- The repo is a cloned snapshot; do not rely on local `.env` or developer-only files for production secrets.
- Supabase is the system of record and hosts Edge Functions used as MCP (Message Control Plane).
- Some production edge functions and automations live in a public repo: https://github.com/prooftv/whatsapp — treat those functions as high-risk integration points.

**Non-negotiable constraints**:
- No hardcoded secrets, credentials, or mock data in production branches.
- Changes must be incremental, reversible, and feature-flagged if they affect broadcasts, billing, or consent.
- All admin actions must append immutable audit records.
- Webhooks must be verified by HMAC and failures must be logged and surfaced.

**Minimal architecture (canonical)**
- Meta (WhatsApp) → Supabase Edge Function(s) (webhook handlers / MCP) → Supabase DB + Storage → n8n (optional enrichment/automation) → Admin Dashboard → PWA (`/moments`) as public display. Broadcasts are enqueued from Supabase → outbound worker → WhatsApp.

**Immediate problem inventory (user-reported, observation-only)**
- Admin: Broadcasts lack titles; mobile stats poorly presented; pagination inconsistent.
- Subscribers: `START` / `STOP` flows don't reflect in UI or DB as expected.
- Moderation: `Approve`/`Flag` actions do not change state; preview styling is unhelpful.
- Sponsors: Added sponsors are not visible in Admin or PWA.
- Campaigns: Activation doesn't deliver to PWA or WhatsApp; scheduling and budget handling are inconsistent; Meta compliance check failing.
- Moments: Media (images) not rendered; delete operation fails; scheduling unreliable.
- Layout: Admin header duplicates labels and is not mobile-friendly.

Treat each bullet as a ticket: reproduce, map to code/edge function, create minimal fix, verify on staging, roll out.

**Master Prompter (roles & copyable prompts)**
- System Preface (always include):
  "You operate in Unami Moments. Supabase is the system of record and is newly provisioned. The repo is a cloned snapshot. Do not expose secrets. All changes must be reversible, non-breaking, and feature-flagged when affecting broadcasts or consent."

- Inspector — inventory & risk mapping:
  Prompt: "List all Supabase Edge Functions and webhook entry points in the repository, mapping file paths to purpose and risk. For secrets, output the variable name and file path only; do not print secret values."

- Auditor — data truth & SQL checks:
  Prompt: "Produce SQL queries and counts for subscribers (total / active / opted out), pending moderation items, scheduled broadcasts, and sponsors. Highlight mismatches with Admin UI numbers and suggest queries to reconcile."

- Fixer — small reversible changes:
  Prompt: "Given a confirmed issue and PR target branch, propose a minimal code change, tests, and a rollback plan. Implement only with feature flags and update `SYSTEM.md` with instructions."

- Verifier — staging test runner:
  Prompt: "Run the smoke test checklist on staging: webhook verification, inbound → DB row, approve/flag state change, schedule processing, and outbound enqueue. Return pass/fail matrix and redacted logs."

Orchestration pattern: Inspector → Planner → Fixer (small PR) → Verifier → Superadmin approval → Gradual rollout.

**Practical phased playbook (actions to resolve reported issues)**
Phase 0 — Triage & safety
- Snapshot DB tables: `moments`, `campaigns`, `subscriptions`, `broadcasts`, `sponsors`.
- Disable live broadcast sends (feature flag) if unexpected sends are present.

Phase 1 — Edge function & webhook inspection
- Run Inspector to map `broadcast-webhook`, `handleMomentCreated`, `public-api`, `admin-api` functions and confirm HMAC verification and error logs.

Phase 2 — Fix editorial state & moderation
- Ensure Admin UI calls the correct API endpoints and that APIs update `moderation_status` and create audit records.

Phase 3 — Sponsors, campaigns, scheduling
- Fix missing joins/caching causing sponsors to be invisible.
- Reconcile campaign activation flow: activation → schedule → enqueue → outbound worker.

Phase 4 — Media & PWA display
- Verify Supabase Storage ACLs and signed URL generation. Confirm PWA requests signed URLs or uses a secure proxy.

Phase 5 — Pagination, UX, mobile
- Move lists to cursor pagination with `(items, cursor, has_more)` responses and adjust Admin UI.

Phase 6 — Compliance & budgets
- Fix Meta compliance queries; add human gate on compliance failures; require budget token before enqueue.

**Verification (smoke checklist)**
- Inbound webhook → draft moment row exists.
- Approve → `status=approved`, audit row created.
- Flag → `status=flagged`, ticket created.
- START/STOP commands update `subscriptions` and UI reflects changes.
- Sponsor created appears in `sponsors` table and UI.
- Image upload stored in Supabase Storage and displays in PWA.

**Security & secrets remediation (must do now if secrets present)**
1. Identify and redact secrets (use Inspector). Rotate exposed tokens (WhatsApp, Supabase service role).
2. Move secrets to managed env stores (Vercel, Supabase Secrets, GitHub Actions). Remove secrets from repo and add `.env` to `.gitignore`.
3. Enforce HMAC verification for webhooks and log failures.

**Tactical next items I can produce now (choose one):**
- Full file-by-file inventory mapping reported issues to code paths and edge functions.
- Scaffold `whatsapp/agent-prompts/` with `inspector.md`, `planner.md`, `fixer.md`, `verifier.md` starter prompts.

---
End of revised SYSTEM playbook.
