# Revenue Target Input Unit Design

**Date:** 2026-07-18  
**Route:** `/revenue-targets`

## Objective

Allow an owner to choose whether an annual revenue target is entered in `ล้านบาท` (million baht) or `บาท` (baht), while continuing to store every target in the database as an exact baht amount.

## Agreed interaction

- Add a clearly labelled unit selector beside the annual target field with two choices: `ล้านบาท` and `บาท`.
- Default new and existing forms to `ล้านบาท` to preserve the current workflow.
- The application must not automatically convert a value already typed by the user when the unit changes.
- If the user changes the unit after entering a value, clear the amount field so the same digits cannot be interpreted accidentally at a different scale.
- Update the label, suffix, placeholder, validation message, and preview to match the selected unit.
- Show the equivalent amount in the other unit in the preview so the user can verify the intended value before saving.

Examples:

- `26.36` with `ล้านบาท` selected is stored as `26,360,000.00` baht.
- `26,360,000` with `บาท` selected is stored as `26,360,000.00` baht.

## Data model and precision

- Keep `revenue_targets.target_amount numeric(20,2)` in baht unchanged.
- Do not persist the input unit because it is a form preference, not part of the target's monetary value.
- Add a form-only unit enum and a neutral amount field.
- Convert input to baht with `decimal.js`; JavaScript floating-point arithmetic must not be used for money.
- Baht input is rounded half up to two decimal places at the existing database boundary.
- Editing uses the exact `targetAmountBaht` returned by the API as the conversion source, avoiding the existing two-decimal million-baht projection as a source of truth.
- No Supabase migration is required.

## Validation and submission

- Require a non-empty, finite amount greater than zero for either unit.
- Accept comma-grouped decimal input in both units.
- Convert the validated amount to a two-decimal baht string immediately before calling `save_revenue_target`.
- Keep all organization/service-scope validation and RPC parameters unchanged.

## Test coverage

- Unit tests cover million-baht and baht conversion, positive-value validation, and exact edit mapping.
- Component tests cover the default unit, switching to baht, clearing an already-entered amount on unit change, unit-specific labels/previews, and user-entered baht values.
- Run the focused tests first, then type checking, linting, the full test suite, and the production build.
- Verify the deployed form in Chrome at desktop and mobile widths, including console health and both unit interactions.

## Documentation

- Update `req.md` and `README.md` so the project documents that the form accepts both units while storage remains in baht.

