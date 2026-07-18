# Revenue Target Input Unit Implementation Plan

**Goal:** Let owners enter annual targets in either million baht or baht without changing the database schema or monetary precision.

**Architecture:** Keep the RPC contract and database storage in baht. Extend the client form with an input-unit enum and neutral amount string, centralize exact `decimal.js` conversion in the target domain module, and derive the submitted baht text at the query boundary.

**Tech stack:** Next.js 16, React 19, React Hook Form, Zod, Decimal.js, Vitest, Testing Library.

## Task 1: Define exact unit conversion behavior

**Files:**

- Modify: `tests/unit/revenue-targets.test.ts`
- Modify: `lib/targets/revenue-targets.ts`

1. Add failing tests for baht input conversion, unit-aware validation, and exact mapping of stored baht to an editable million-baht value.
2. Run the focused unit test and confirm it fails for the missing unit model.
3. Add `targetAmountUnit`, `targetAmount`, unit-aware conversion helpers, and exact edit mapping using Decimal.js.
4. Run the focused unit test and confirm it passes.

## Task 2: Add unit selection to the form

**Files:**

- Modify: `tests/components/revenue-target-form.test.tsx`
- Modify: `components/targets/revenue-target-form.tsx`

1. Add failing component tests for the default million-baht state, baht selection, clearing a typed amount when switching units, and the baht-input preview.
2. Run the focused component test and confirm it fails for the missing selector.
3. Implement the accessible unit selector and unit-aware label, suffix, placeholder, and equivalent-value preview.
4. Run the focused component test and confirm it passes.

## Task 3: Submit exact baht values

**Files:**

- Modify: `lib/query/revenue-targets.ts`

1. Replace the million-only conversion call with the unit-aware conversion helper.
2. Keep every RPC parameter and the database contract unchanged.
3. Re-run the target unit and component tests.

## Task 4: Document the accepted input units

**Files:**

- Modify: `README.md`
- Modify: `req.md` (local project requirements file)

1. State that the form accepts either million baht or baht.
2. Retain the requirement that the database stores exact baht values.

## Task 5: Verify and publish

1. Run target-focused tests.
2. Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build`.
3. Inspect the final diff and ensure the unrelated `components/reports/revenue-matrix-report.tsx` modification is not staged.
4. Commit and push `main`.
5. Verify the deployed `/revenue-targets` form in Chrome at desktop and mobile widths, including console health and saving behavior without creating a production record.
