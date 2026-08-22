---
name: project-nextjs-quirks
description: Next.js 16 version quirks discovered early in the project that still apply
metadata:
  type: project
---

Frontend is Next.js 16.2.7 — not 15 as originally assumed when the project started; `create-next-app@latest` installs whatever is newest, and `frontend/AGENTS.md` exists specifically to flag that the trained-on API surface may be stale for this version.

**Why:** Two concrete breakages hit early and are easy to reintroduce without knowing why:
- `useSearchParams()` must be wrapped in `<Suspense>`, or the build fails.
- `Select.onValueChange` (Base UI, used by `components/ui/select.tsx`) returns `string | null`, not just `string` — needs a null-check.

**How to apply:** When adding a new page that reads search params or a new `<Select>` usage, check for these two before assuming a TypeScript/build error is something else. For anything else Next.js-16-specific, read `node_modules/next/dist/docs/` per `frontend/AGENTS.md` rather than relying on trained knowledge.

For current backend/frontend folder structure, see [`docs/02-kien-truc.md`](../docs/02-kien-truc.md) — not duplicated here, since a second copy is exactly what goes stale first.
