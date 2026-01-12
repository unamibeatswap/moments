# Amazon Q — Finish Missions: Removing Embedded Secrets & Final Steps

Purpose
- Provide a single, actionable checklist and step-by-step instructions for Amazon Q to finish removing embedded secrets and complete the remaining missions on branch `chore/remove-embedded-secrets`.

Prerequisites
- Working Git environment with push permissions for the branch.
- Node.js and npm installed for project scripts (project uses `whatsapp/` scripts).
- `detect-secrets` (or `truffleHog`/`gitleaks`) recommended for scanning.
- Admin access to CI (GitHub Actions/GitLab/CircleCI) and AWS Secrets Manager / Parameter Store.

High-level checklist
- Checkout target branch and run repo-wide secret scans.
- Identify all files containing embedded secrets across `whatsapp/` and root scripts.
- Replace literal secrets with environment variables or AWS Secrets Manager lookups.
- Update `env.example` and docs to show variable names (no secret values).
- Run unit/integration tests and CI validation.
- If secrets were committed, purge them from git history (coordinate first).
- Update CI/CD pipelines to supply secrets from vault/CI secrets.
- Deploy to staging, verify, then open PR to `main`.
- Rotate any exposed credentials and notify stakeholders.

Files and areas to check first
- README and docs in `whatsapp/` (e.g., SAFE_REMOVE_ENV.md)
- `whatsapp/env.example`
- Deploy and helper scripts: `whatsapp/deploy-production.sh`, `whatsapp/deploy-moments.sh`, `whatsapp/production-deploy.sh`, `whatsapp/start.sh` and `whatsapp/start-n8n.sh` (scan all `*.sh`)
- JS/JSON files in `whatsapp/` that may embed tokens (search `*.js`, `*.json`)
- Any CI or pipeline YAML files in repo root or `whatsapp/`

Step-by-step instructions

1) Checkout branch

```bash
git fetch origin
git checkout chore/remove-embedded-secrets
git pull --ff-only origin chore/remove-embedded-secrets
```

2) Run an initial secret scan (quick greps and detect-secrets)

```bash
# Grep for common patterns (fast, surface-level)
git grep -nE "AKIA|AIza|-----BEGIN PRIVATE KEY-----|password|token|secret|SECRET_" || true

# Use detect-secrets if available for better coverage
detect-secrets scan > .secrets.baseline || true
```

Make a short inventory of files reported by these scans. Save the list as `whatsapp/secrets-findings.txt`.

3) Identify mission-specific files and all embedded secrets
- Manually review the flagged files. Prioritize files under `whatsapp/` and any deployment scripts.
- For each file, record: file path, line snippet, secret type (API key, password, private key), and whether the secret is still valid.

4) Replace secrets with environment-backed configuration
- In application code, replace literal values with environment lookups, e.g., `process.env.MY_API_KEY`.
- For shell scripts use `${MY_API_KEY}` or read from a small helper that loads env vars from the environment or a secrets provider.
- Add the variable names (no values) to `whatsapp/env.example`.

Example code change pattern

```js
- const apiKey = "abcd1234-SECRET";
const apiKey = process.env.MY_SERVICE_API_KEY;
```

Commit pattern

```bash
git add path/to/changed-file
git commit -m "chore: remove embedded secret from <path>; read from ENV"
```

5) Update CI/CD and runtime secret sourcing
- Replace any plaintext secrets in pipeline config with CI encrypted secrets (GitHub Actions: `secrets.*`, GitLab CI variables, etc.).
- Prefer AWS Secrets Manager or Parameter Store for production; add a small integration helper if not present.
- Update deployment scripts to fetch secrets from environment or to call `aws secretsmanager get-secret-value` at deploy time (avoid printing secrets in logs).

6) Run tests and local verification

```bash
cd whatsapp
npm ci
npm test
# run any smoke scripts that exercise external integrations
./start.sh
```

7) If secrets were committed, plan and execute history purge (coordination required)
- WARNING: history-rewrite is destructive. Communicate to the team and schedule downtime or a coordinated re-clone.
- Preferred: `git-filter-repo`.

Example `git-filter-repo` workflow:

```bash
# Work on a clone mirror to avoid working-tree surprises
git clone --mirror git@github.com:proofdig321/moments.git repo-mirror.git
cd repo-mirror.git
# Prepare a replacements.txt mapping (see git-filter-repo docs)
# Example format for replace-text: exact-secret==>REDACTED
git filter-repo --replace-text ../replacements.txt
git push --force origin --all
git push --force origin --tags
```

Alternative: BFG Repo-Cleaner (simpler but less flexible).

8) Rotate any credentials that were exposed
- Immediately rotate API keys, tokens, and keys found in the repository regardless of whether history was purged.
- Use the service consoles (AWS IAM, third-party providers) and update the new secrets into AWS Secrets Manager or your CI secrets.

9) Deploy to staging and verify
- Deploy using the staging pipeline and run smoke/integration tests.
- Verify: service starts, can call downstream APIs, no authentication failures, no secrets printed in logs.

10) Open a PR to `main`
- Push the branch and open a PR. Use `gh` if available:

```bash
git push origin chore/remove-embedded-secrets
gh pr create --fill
```

- PR checklist: summary of changes, list of rotated credentials, tests run, and verification steps.

11) Post-merge tasks
- Ensure everyone re-clones if history was rewritten.
- Close the incident ticket once rotation and verification are complete.

Verification checklist (must pass before PR merge)
- No literal secrets remain in changed files.
- `detect-secrets` baseline updated with no failures on CI.
- Unit and integration tests pass.
- Staging deploy succeeded and smoke tests pass.
- Credentials that were exposed are rotated and stored in Secrets Manager or CI secrets.

Communication and coordination
- Announce planned history-rewrite and the time window to the team.
- Provide the list of rotated credentials and the new secret locations.
- If keys were leaked to third parties (public GitHub), treat it as a security incident and follow company incident response steps.

Notes and hints
- Keep `env.example` and README updated with variable names and usage examples.
- Avoid storing long-lived secrets in files; prefer short-lived tokens or managed secrets.
- Do not commit `whatsapp/.secrets.baseline` to main; treat baseline files as local artifacts unless approved.

Contact for help
- If you need me to run a repo-wide scan and produce the `whatsapp/secrets-findings.txt`, say so and I will run it.

---
Generated for branch chore/remove-embedded-secrets on repository `moments`.
