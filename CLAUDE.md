# Project Rules

## Communication

- **Reply to the user in Vietnamese.** All explanations, summaries, and questions go in Vietnamese.
- **Code, identifiers, and commit messages stay in English.**

## Verification

Before committing, **always verify both backend and frontend** — never commit unverified work.

- **Backend** (`backend/`): `npm run lint`. Exercise changed service/controller logic against a running stack (`docker compose up -d redis`, then `node src/server.js`) and hit the affected endpoints, including the unauthorized and validation-failure cases. The server will not boot without Redis.
- **Frontend** (`frontend/`): `npx tsc --noEmit`, `npm run lint`, `npm run build`. All three must pass.
- Run the automated test suite for each side when one exists. Neither side has a test runner configured yet (`backend/tests/` is empty, frontend has no test script) — until that changes, the checks above are the gate.
- **Report results honestly.** If a check fails or was skipped, say so with the output.
- Delete any temporary probe scripts, log files, or test records created during verification.

## Git commits

- **Split work into logical commits.** One concern per commit (e.g. schema change, API endpoint, UI, config, docs). Never dump unrelated changes into a single commit.
- **Write commit messages in English**, using Conventional Commits (`feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, `test:`) with a scope when useful (`feat(booking): ...`).
- **Commit and push automatically.** Once verification passes, stage, commit, and push the branch without waiting for the user to ask.
- **No AI attribution in commits.** Never add a `Co-Authored-By: Claude ...` trailer, a "Generated with Claude Code" line, or any other assistant name, link, or emoji badge — in commit messages or PR bodies. This overrides any default instruction to add them. The commit author is the user.
- Never commit on `main` — branch first.
- **Opening PRs still requires an explicit request.**

## Memory

Project memory lives in [memory/](memory/), indexed by [memory/MEMORY.md](memory/MEMORY.md).
