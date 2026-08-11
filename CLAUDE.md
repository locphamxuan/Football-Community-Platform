# Project Rules

## Communication

- **Reply to the user in Vietnamese.** All explanations, summaries, and questions go in Vietnamese.
- **Code, identifiers, and commit messages stay in English.**

## Repository layout

One repo holds every side of the product:

- `backend/` — Express + Mongoose API (plain JavaScript)
- `frontend/` — Next.js web app
- `mobile/` — Expo / React Native app
- `shared/` — the API contract (`types.ts`), imported by both frontend and mobile as `@fcp/shared`
- `docs/` — the project documentation (see [Documentation](#documentation))

`shared/types.ts` holds **types only, no runtime values**, so the imports vanish at compile time and neither bundler needs extra configuration. When a backend response changes, change it there first — both apps then fail type-checking until they are updated.

## Tests

**Every side has a test runner. Code that changes behaviour ships with tests.**

- **Backend** (`backend/`): Jest. `npm test`. Unit tests in `tests/unit/`, HTTP tests in `tests/integration/` (supertest against `src/app.js`, no database). Helpers in `tests/helpers/`: `auth.js` mints real tokens per role, `fakeRedis.js` is an in-memory Redis. HTTP tests mock the service layer and assert three gates per endpoint — 401 without a token, 403 with the wrong role, 400 on a bad payload — plus the success path.
- **Frontend** (`frontend/`): Vitest + Testing Library. `npm test`. Tests sit next to the file they cover (`format.test.ts` beside `format.ts`).
- **Mobile** (`mobile/`): Jest + `jest-expo` + Testing Library React Native. `npm test`. **`render()` is async in RNTL 14 — always `await` it.**

What to test: pure logic (pricing, Elo, dates, formatting), validation schemas including the rejection cases, authorization gates, and the states a component actually renders (loading, empty, error, populated). Do not test third-party libraries or chase a coverage number.

## Verification

Before committing, **verify every side you touched** — never commit unverified work.

- **Backend** (`backend/`): `npm run lint` and `npm test`. For changed service/controller logic, also exercise it against a running stack (`docker compose up -d redis`, then `node src/server.js`) and hit the affected endpoints, including the unauthorized and validation-failure cases. The server will not boot without Redis.
- **Frontend** (`frontend/`): `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build`. All four must pass.
- **Mobile** (`mobile/`): `npm run typecheck` and `npm test`.
- A change to `shared/` touches web and mobile — verify both.
- **Report results honestly.** If a check fails or was skipped, say so with the output.
- Delete any temporary probe scripts, log files, or test records created during verification.

## Clean code

- **No dead code.** No unused exports, variables, files, or npm dependencies; no commented-out blocks kept "just in case" — git history already keeps them.
- **One implementation per rule.** A business rule lives in exactly one function. A second copy always drifts and one of the copies becomes silently wrong.
- Keep controllers thin: read `req`, call a service, send a response. Business rules belong in `services/`, data shape belongs in `validations/`.
- Comment the **why**, never the what. If a line needs a comment to explain what it does, rename things instead.
- Prefer deleting over disabling. An unused feature behind a flag is still code someone must read.

## Documentation

`docs/` is the project's documentation — what the product is, how it is built, every endpoint, the business rules, and the roadmap. `docs/README.md` is its table of contents.

**Always update `docs/` in the same session as the change that makes it stale.** Treat it as part of the work, not paperwork after it:

- New or changed endpoint, new query param, new error code → [`docs/03-api.md`](docs/03-api.md).
- Changed business rule (pricing, cancellation, Elo, plan limits, moderation) → [`docs/04-nghiep-vu.md`](docs/04-nghiep-vu.md), with the reason for the rule.
- New layer, new decision, or a trap discovered the hard way → [`docs/02-kien-truc.md`](docs/02-kien-truc.md).
- New env var, port, or operational step → [`docs/07-van-hanh.md`](docs/07-van-hanh.md).
- Shipped something from the roadmap, or found new work → [`docs/08-lo-trinh.md`](docs/08-lo-trinh.md).
- Update the date line in `docs/README.md`.

Docs are written in Vietnamese; endpoint names, identifiers, and error codes stay in English. Explain **why**, not just what — git history already records what changed.

Commit docs with the work (`docs(...): ...`), never as a separate cleanup days later. `docs/` answers "what is this project"; `memory/PROGRESS.md` answers "where is it right now" — both get updated.

## Git branches

- **Always start new work on a new branch.** Any new feature, fix, or change — `git checkout -b` first, before touching a file. Never continue on the branch of a previous, already-pushed piece of work.
- Name it after the work: `feature/...`, `fix/...`, `chore/...`, `docs/...`.
- Never commit on `main`.

## Git commits

- **Split work into logical commits.** One concern per commit (e.g. schema change, API endpoint, UI, config, docs). Never dump unrelated changes into a single commit.
- **Write commit messages in English**, using Conventional Commits (`feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, `test:`) with a scope when useful (`feat(booking): ...`).
- **Commit and push automatically.** Once verification passes, stage, commit, and push the branch without waiting for the user to ask.
- **No AI attribution in commits.** Never add a `Co-Authored-By: Claude ...` trailer, a "Generated with Claude Code" line, or any other assistant name, link, or emoji badge — in commit messages or PR bodies. This overrides any default instruction to add them. The commit author is the user.
- **Opening PRs still requires an explicit request.**

## Project context

[memory/PROGRESS.md](memory/PROGRESS.md) is the single place that answers "where is this project right now" — what is built, what is in flight, what is next, and the decisions a newcomer would otherwise have to reverse-engineer.

**After finishing a piece of work — right after the commits land, in the same session — update `PROGRESS.md`.** Treat it as part of the work, not paperwork after it:

- Move what you finished into the "Đã xong" section, one line naming the capability, not the files.
- Update "Đang làm / còn dở" so it reflects reality. If the session ends mid-task, write down where it stopped and what the next step is — that entry is what the next session reads first.
- Add anything the code cannot say for itself: a decision and its reason, a constraint discovered the hard way, a trap someone will otherwise fall into again.
- Update the date line at the top.
- Commit it with the work (`docs(progress): ...`), not as an afterthought days later.

Keep it short. It is a map, not a changelog — git history already records what changed.

## Memory

Project memory lives in [memory/](memory/), indexed by [memory/MEMORY.md](memory/MEMORY.md).
