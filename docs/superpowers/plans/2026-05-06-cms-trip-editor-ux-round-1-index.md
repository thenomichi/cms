# CMS Trip Editor UX Round 1 — Plan Index

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement these plans task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** [docs/superpowers/specs/2026-05-06-cms-trip-editor-ux-round-1-design.md](../specs/2026-05-06-cms-trip-editor-ux-round-1-design.md)

**Goal:** Implement the six UX improvements from round 1 feedback (latency, NumberField, autosave, discount, departure city, end-date bug) across five independently shippable PRs.

**Architecture:** Each PR is its own plan file. Each can be merged on its own. Order is chosen so the user feels speed first (PR 1), then small UX wins (PRs 2–4), then the safety net (PR 5).

**Tech Stack:** Next.js 16, React 19, react-compiler, Vitest + Testing Library, Supabase, Zod, Tailwind v4, sonner.

---

## PRs

| # | Plan | DB? | Independence |
|---|---|---|---|
| 1 | [PR 1 — Latency fixes + end-date bug](./2026-05-06-pr1-latency-and-end-date-bug.md) | No | Standalone |
| 2 | [PR 2 — NumberField stepper + allowNull](./2026-05-06-pr2-number-field.md) | No | Standalone |
| 3 | [PR 3 — Absolute discount field](./2026-05-06-pr3-absolute-discount.md) | Yes (additive) | Depends on PR 2 (uses NumberField) |
| 4 | [PR 4 — Departure city table + combobox](./2026-05-06-pr4-departure-cities.md) | Yes (additive) | Standalone |
| 5 | [PR 5 — Autosave + draft recovery](./2026-05-06-pr5-autosave-drafts.md) | Yes (additive) | Depends on PR 1 (latency fixes inform autosave shape) |

## Conventions used in every plan

- **Migrations** live in `supabase/migrations/<timestamp>__<description>.sql`. Apply via Supabase MCP `apply_migration` (read-only is default; explicit permission required per CLAUDE.md). The plan flags the exact step where permission is needed.
- **Tests** use Vitest. Run a single file with `npm test -- path/to/test.test.ts`. Run full suite with `npm test`.
- **Commits** are tight per task. Use Conventional Commits (`feat`, `fix`, `chore`, etc.) matching existing repo style (`fix(cms):`, `feat(trips):`).
- **Type safety:** every new field flows through `TripFormState` (`app/(cms)/trips/_components/types.ts`), `tripBasicSchema` (`lib/schemas/trip.ts`), `TripFull` (`lib/db/trips.ts`). All three updated together.
- **No mocking the database in tests** unless the test is unit-scoped to a pure function. Integration tests should hit a real (test) Supabase. If test infra isn't set up, the plan calls it out — don't paper over with mocks.
- **Verification before completion:** every PR ends with a manual smoke-test checklist run against `npm run dev` (port 3001).

## Execution

Recommended: subagent-driven, one PR at a time. Land PR 1, smoke test, then PR 2, etc. Each PR's plan ends with a "Ready to merge" checklist.
