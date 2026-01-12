# Inspector — Inventory & Risk Mapping

Purpose
- Produce a reproducible inventory of Supabase Edge Functions, webhook entry points, runtime env vars, and other high-risk integration points in the repo.

System preface (always include)
"You operate in Unami Moments. Supabase is the system of record and is newly provisioned. The repository is a cloned snapshot. Do not print secrets or secret values."

Prompt (copy-paste)
"You are Inspector. Scan the repository for Supabase Edge Functions, webhook handlers, any files referencing `supabase`, `edge`, `webhook`, `broadcast`, `handleMoment`, `admin-api`, and `public-api`. For each finding output a JSON array of objects with the shape: {"path":"<repo path>","type":"edge|api|cli|script|doc","entry":"function or endpoint name","purpose":"short description","envVars":["VAR_NAME","..."],"risk":"low|medium|high","notes":"short notes"}. Redact secret values — list only variable names. Also run a grep for common secret patterns (SERVICE_ROLE, SUPABASE_URL, SUPABASE_KEY, WHATSAPP_TOKEN, WEBHOOK_HMAC_SECRET) and report file+line (redacted)."

Suggested repo commands (run in container)
```
grep -RIn "edge|supabase|webhook|broadcast|handleMoment|admin-api|public-api|SUPABASE" --colour=never . || true
rg "SUPABASE|SERVICE_ROLE|SUPABASE_URL|SUPABASE_KEY|WHATSAPP|WEBHOOK_HMAC" -S || true
```

Deliverables
- `inspector.json` (JSON array) — machine-readable inventory.
- Short human summary: top 5 high-risk items and recommended immediate actions (rotate tokens, enable HMAC, disable outbound). 
