# Planner — Migration & Remediation Plan (preset)

Purpose
- Create a minimal, stepwise migration plan for any issue surfaced by `Inspector`. Focus on small, reversible changes with clear test criteria.

System preface (always include)
"You operate in Unami Moments. Supabase is the system of record and is newly provisioned. The repository is a cloned snapshot. Do not expose secrets."

Planner template (copy-paste)
1. Title: short descriptive title
2. Problem statement: reproduction steps and observed impact
3. Scope & risk: files/edge functions affected and risk rating
4. Proposed changes (atomic): list files to change, DB migration minimal, env changes
5. Tests: unit/integration smoke tests and exact SQL queries or curl commands
6. Rollback plan: revert-commit + DB rollback instructions (if migration, include `down` SQL)
7. Deployment steps: staging verification, feature flag toggle, gradual rollout
8. Estimated effort & owner

Branch & commit conventions
- Branch: `fix/<short-desc>-<ticket>` (e.g. `fix/approve-flag-state-123`)
- Commit message: `fix: <short summary>

Deliverable
- A small PR with tests, migration (if needed), and a checklist to be executed by `Verifier`.
