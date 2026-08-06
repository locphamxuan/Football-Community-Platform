# Project Rules

## Communication

- **Reply to the user in Vietnamese.** All explanations, summaries, and questions go in Vietnamese.
- **Code, identifiers, and commit messages stay in English.**

## Git commits

- **Split work into logical commits.** One concern per commit (e.g. schema change, API endpoint, UI, config, docs). Never dump unrelated changes into a single commit.
- **Write commit messages in English**, using Conventional Commits (`feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, `test:`) with a scope when useful (`feat(booking): ...`).
- **Commit automatically.** When a unit of work is finished, stage and commit it without waiting for the user to ask.
- **Do not push or open PRs unless asked.** Auto-commit is local only.
- Never commit on `main` — branch first.

## Memory

Project memory lives in [memory/](memory/), indexed by [memory/MEMORY.md](memory/MEMORY.md).
