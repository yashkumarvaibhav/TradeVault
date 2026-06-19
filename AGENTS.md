# TradeVault Agent Continuity Instructions

This repository is being upgraded in small, resumable slices that may alternate between Codex and Claude Code.

## Read before changing code

1. `docs/PREMIUM_UX_IMPLEMENTATION.md` — authoritative task state, current checkpoint, next action, and verification commands.
2. `docs/PREMIUM_UX_WORKLOG.md` — append-only evidence and handoff history.
3. `docs/PREMIUM_UX_REVIEW.md` — approved product/UX requirements and priorities.
4. `../graphic-identity.md` — visual identity source of truth.

If chat context conflicts with the repository tracker, stop and reconcile the tracker before coding. Never infer completion from a previous chat.

## Non-negotiable rules

- Preserve every existing feature listed in `PREMIUM_UX_REVIEW.md`.
- Do not blend INR and USD without an explicit conversion model. Use per-currency or clearly labelled R-normalized views.
- Keep TradeVault's teal, Newsreader + Arial typography, hairline borders, restrained elevation, and light/dark parity.
- Do not build the explicitly excluded multi-account manual ledger.
- Work on one bounded task ID at a time. Do not combine unrelated refactors with a UX slice.
- Before editing, mark the task `IN PROGRESS` and record the exact baseline commit.
- After editing, run the task's checks, update the task row/checkpoint, append the worklog, then commit.
- A task is `DONE` only when its acceptance criteria and verification evidence are recorded.
- If interrupted, leave the worktree safe and update `Current checkpoint` with modified files, checks run, failures, and the next exact action.
- Do not deploy unless the user explicitly asks. A pushed code checkpoint is not a production deployment.

## Standard verification

Run from the repository root (`app/`):

```bash
.venv/bin/python -m py_compile app.py
.venv/bin/python -m unittest discover -s tests
node --check static/js/app.js
git diff --check
```

Add focused tests for every behavior change. Visual tasks also require light/dark and responsive evidence before they can be marked `DONE`.

## Handoff format

Append this block to `docs/PREMIUM_UX_WORKLOG.md` at every checkpoint:

```markdown
## YYYY-MM-DD HH:MM UTC — AGENT — TASK-ID

- Baseline: `<commit>`
- Outcome: ...
- Files: ...
- Verification: ...
- Commit: `<commit>` or `not committed`
- Remaining risk: ...
- Next exact action: ...
```

