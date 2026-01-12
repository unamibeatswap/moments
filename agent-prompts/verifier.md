# Verifier — Staging Test Checklist

Purpose
- Verify Planner/PR changes in staging with a focused smoke test run and produce a pass/fail matrix and minimal remediation steps.

Smoke tests (copy-paste)
1. Webhook HMAC: send a test webhook with correct and incorrect HMAC. Expect: correct → 200 + DB row; incorrect → 401 or logged failure.
   - curl examples: `curl -X POST --header 'X-Hub-Signature: sha256=<sig>' http://<staging-webhook>`
2. Inbound flow: webhook → Supabase row in `moments` with `status=draft` and `raw_payload` stored.
   - SQL: `SELECT count(*) FROM moments WHERE created_at > now() - interval '5 minutes';`
3. Approve & Flag: call Admin API (or simulate) to approve and flag a moment. Expect `moderation_status` updated and audit record created.
   - SQL to verify audit: `SELECT * FROM audit_log WHERE object='moment' ORDER BY created_at DESC LIMIT 5;`
4. Subscriber flows: send `START` / `STOP` test messages and verify `subscriptions` changes.
5. Media: upload a small image via Admin UI or API and verify file exists in Supabase Storage and PWA can render it.
6. Scheduling: create a scheduled moment and confirm scheduled processor enqueues a broadcast job (check `broadcasts` or `jobs` table).

Pass/Fail matrix format (CSV or table)
`test_name,expected,actual,status,notes`

Deliverables
- `verification-report.json` with pass/fail and redacted logs.
