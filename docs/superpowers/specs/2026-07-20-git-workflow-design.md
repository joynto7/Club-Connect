# Git branching & deployment workflow — design

## Context

Club Connect has had a single committer for all 49 commits to date (`joyntoghosh`), and every one of them went straight to `main`. `main` auto-deploys on every push via `.github/workflows/deploy.yml` (type-check + build backend and frontend, then run Prisma migrations against production and deploy to Render + Vercel). No branch has ever been created, no PR has ever been opened, and there are zero automated tests in either app — CI's only gate is type-check + build.

This has already bitten production twice: a trailing slash on `APP_URL`/`FRONTEND_URL` on Render broke Google OAuth and then CORS (see `reference_production_urls.md` memory), in both cases because there was no checkpoint between "make a change" and "it's live."

The user wants a standardized, industry-conventional dev/deploy cycle that's easier to maintain on GitHub. Two decisions were made up front:
- Branch-based workflow, but **without** GitHub PRs (solo dev, no second reviewer — PRs would add process without adding a reviewer).
- **No separate staging environment** — merging to `main` keeps auto-deploying straight to production, same as today.

## Goals

- Every change happens on its own branch instead of as a direct commit to `main`.
- A broken build can't reach `main` without at least one automated check running first — the thing a PR would normally provide, achieved without requiring a PR.
- Keep the existing deploy-on-push-to-`main` pipeline unchanged.
- A documented, fast rollback path for when a bad deploy gets through anyway.

## Non-goals

- **No GitHub PR requirement.** Explicitly declined — solo dev, no second reviewer to add value to a review step. PRs remain available as an occasional opt-in (e.g. for a riskier change you want a full CI run + diff view on before merging) but nothing in this design requires them.
- **No staging environment.** Explicitly declined — a second Render service + database duplicates env vars and migration runs for a solo project. Note this also means Vercel's per-PR preview deploys won't come into play as a substitute staging step *unless* a PR is opened for a given change — that's fine, since PRs are optional, not the norm.
- **No test suite / no test step in CI.** The repo has zero automated tests today; writing one is a separate, much larger initiative and out of scope here. The pre-push hook below only re-runs the same type-check CI already does, earlier.
- **No changes to `.github/workflows/deploy.yml`.** It already does the right thing on every push to `main`; branching doesn't change what happens after code lands there.
- **No enforced commit-message convention.** Only branch *naming* is standardized here; existing commit message style is untouched.

## Design

### 1. Branch naming

- `feat/<slug>` — new functionality
- `fix/<slug>` — bug fixes
- `chore/<slug>` — tooling, config, dependencies, docs-only changes

When a change already has a design spec under `docs/superpowers/specs/`, the branch reuses that spec's slug, so branch, spec, and plan all trace to the same name.

### 2. Day-to-day loop

```
git checkout main && git pull
git checkout -b feat/<slug>
# ...work, commit as usual...
git checkout main
git merge --no-ff feat/<slug>
git branch -d feat/<slug>
git push origin main   # existing CI: typecheck → build → migrate → deploy
```

`--no-ff` is the one deliberate departure from git defaults: a fast-forward merge is indistinguishable from having committed straight on `main`, which defeats the point of branching at all. `--no-ff` leaves one merge commit per feature, so `git log --first-parent` reads as a feature-level history, and `git revert -m 1 <merge-commit>` can cleanly back out an entire feature as a unit if it turns out to be the cause of a production problem.

### 3. Pre-push safety net

A committed, versioned git hook — `.githooks/pre-push`:

```sh
#!/bin/sh
# Blocks pushing a broken build to main. Only fires when main is a push target,
# so pushing a feature/backup branch is never blocked.
while read -r local_ref local_sha remote_ref remote_sha; do
  if [ "$remote_ref" = "refs/heads/main" ]; then
    echo "pre-push: type-checking backend & frontend before pushing to main..."
    (cd backend && npx tsc --noEmit) || exit 1
    (cd frontend && npx tsc --noEmit) || exit 1
  fi
done
```

Activated once per clone via `git config core.hooksPath .githooks` (native git hooks live in `.git/hooks/`, which is never version-controlled and never travels with a clone — `core.hooksPath` is the standard way to point git at a committed, shared hooks directory instead). This is documented as a required one-time setup step in `CONTRIBUTING.md`, since nothing can make git run it automatically on clone.

Deliberately scoped to `tsc --noEmit` only (not a full `next build`/backend build) — it's meant to be fast enough to run on every push without friction; the full build still happens in CI immediately after, as it does today. This hook narrows the failure window, it doesn't replace CI.

### 4. GitHub branch protection on `main` — deferred

Two toggles, applied only after separate explicit confirmation (this is a GitHub repo-settings change, not a code change):
- Block force-pushes to `main`
- Block deletion of `main`

Deliberately **not** including "require a pull request" — that would contradict the no-PR decision above.

### 5. Rollback procedure

Documented in `CONTRIBUTING.md` for when a deploy reaches production broken anyway:

1. **Vercel** — Dashboard → Deployments → select the last known-good deployment → *Promote to Production*. Instant, no rebuild.
2. **Render** — Dashboard → service → Deploys/Events → select the last known-good deploy → *Rollback*. Instant.
3. Once production is stable again, `git revert` the offending merge commit on `main` and push, so the next push doesn't reintroduce the same bug — the dashboard rollback buys time, it doesn't fix `main`.

This directly targets the failure mode already seen twice in this project (a bad env-var/config change shipping straight to prod with no checkpoint).

### 6. Documentation

- New `CONTRIBUTING.md` at repo root, containing sections 1, 2, 3, and 5 above (GitHub automatically surfaces this file to anyone opening a PR or viewing the repo). If/when section 4 is applied, a line is added here noting it.
- One-line addition to `README.md`'s existing `## Deployment` section pointing to `CONTRIBUTING.md` for the branching workflow.

## Files touched

- **New:** `CONTRIBUTING.md` (repo root)
- **New:** `.githooks/pre-push` (executable)
- **Edit:** `README.md` — one-line pointer under `## Deployment`
- **Not part of this change, separate confirmation required:** GitHub branch-protection settings on `main` (section 4)

## Verification

No test framework in this repo (consistent project-wide convention, per the existing spec docs). Manual:

- Introduce a throwaway TypeScript type error on a branch, merge it into a local `main`, run `git push origin main`, confirm the hook blocks the push with a clear message and non-zero exit before it reaches GitHub.
- Fix the error, confirm the same push now proceeds and CI runs as normal.
- Confirm pushing a non-`main` branch (e.g. `git push origin feat/test`) is never blocked by the hook, even with a type error present.
- Confirm the hook has no effect at all until `git config core.hooksPath .githooks` has been run once — demonstrating why that setup step must be documented, not assumed.
