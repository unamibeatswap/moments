# Fixer — Implementation Guidelines

Purpose
- Implement minimal, reversible fixes produced by a Planner. Keep changes small, behind feature flags if they affect broadcasts or user consent.

System preface (include in PR description)
"Supabase is the system of record and is newly provisioned. This fix is reversible and tested in staging. No secrets are committed."

Checklist for each PR
1. Create feature branch per Planner.
2. Add or update tests that show the failure and the fix (unit/integration where possible).
3. Add database migration only if strictly required; keep `up` and `down` scripts.
4. Use feature flags for any change with side effects (broadcasts, billing, deletes).
5. Update `whatsapp/SYSTEM.md` with a short note and link to PR.
6. Provide rollback steps in PR description.

Commands to run locally (examples)
```
# run unit tests
npm test

# run inspector queries locally (example)
node whatsapp/test-subscriber-flow.js --supabase-url <staging> --supabase-key <placeholder>
```

Commit message template
```
feat|fix(scope): short description

Refs: <ticket>
```
