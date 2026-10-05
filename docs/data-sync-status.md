# Data update patch status

Base: `main` at `70e09f542adbe71cb1c33a654d045209ad630931`.
This metrics-only port preserves the live monolith and all existing style blocks; it does not deploy the premium development design.

## Implemented

- One production calculation path for Home and KPI cards; removed timed hard-coded total overrides.
- Historical fixture code removed from the active application; prior source remains in Git history. Previously seeded browser rows remain stored but are excluded from current totals. No browser data is deleted.
- Production CSV/Excel parsing accepts separate batches, mixes and pallets columns. Exact output header matching prevents `Inventory pallets` or `Batches / Mixes` from silently becoming production output.
- Unknown output stays unknown, partial totals are labeled, and invalid/negative quantities or impossible dates are rejected.
- Normalization is connected to structured imports, manual entry and dashboard reads. Existing user confirmation/import history remain in place.
- Shared production coverage note and maintenance source note distinguish historical, mixed and local-only data.
- Existing import commits retain filename, type, import timestamp and date range. Import timestamp is not claimed as report freshness.
- Word file selection is supported as an explicit local staging hold. No DOC/DOCX contents are parsed or quantities inferred yet.

## Groundwork only

`assets/data-core.js` includes pure mapped ClickMaint normalization, source identity/hash duplicate detection, correction review and Word attachment staging contracts. No API request, mailbox request, OAuth grant, secret, background schedule or automatic data write is implemented. The revision helper does not replace the existing manual import preview. A production Word template and verified ClickMaint response mapping are still required.

Existing maintenance KPI formulas/legacy values are preserved, with clearer source labeling. They are not represented as newly refreshed metrics. Incoming verified source reports should be staged privately rather than committed to this public repository.

## Verification

- `node scripts/verify-main.cjs`: passed (11 inline scripts plus data-core syntax, required metric elements/workflows and removal of historical overrides). All original style blocks were compared byte-for-byte and remain unchanged.
- `OPS_APP_SOURCE=$PWD/index.html node --test scripts/test-data-core.cjs`: 20 tests passed. Covers actual importer/calculator functions, saved corrections, explicit zero, unknown/partial totals, inventories, mixes, invalid dates, duplicate attachments, revisions, source namespace and coverage.
- `git diff --check`: passed.
- Browser QA script `scripts/test-browser.cjs` prepared but not passed. `agent-browser` is absent; installed Chromium fails to launch with `socket() failed: Operation not permitted`. Do not treat structural/unit checks as visual or end-to-end approval.

## Before release

1. Verify the patch in a browser that can run the local app. Exercise reload, facility changes, repeated imports, manual entry, cancellation and Word hold.
2. Confirm historical records are presented appropriately and reconcile any older corrections already overwritten by the previous seeding logic. This patch cannot reconstruct lost prior data.
3. Obtain real Word samples, including revisions; verify dates, shifts, facilities, counts and source provenance before connecting extraction.
4. Verify current ClickMaint facility/period/units and privately refresh approved source data.
5. Obtain explicit publication/deployment scope. No push, deployment, credential setup or private-source publication was performed for this patch.

Release preparation was rechecked against a complete checkout of main. The handbook and both LOTO workbooks are present and remain byte-identical to the original commit; the patch does not modify or delete them. The original complete tree was archived with file checksums before publication.

Review additionally confirmed partial-import and manual corrections preserve omitted quantities and staffing/details; exact underscore/hyphen headers remain supported, impossible textual dates are rejected, and empty legacy quantities stay unknown. Obvious ordinal/number shift labels canonicalize (1/1st, 2/2nd, 3/3rd); existing storage keys are preserved on correction. Collisions are held for review and excluded from totals. Plant-specific and day/night labels are not silently equated.

Legacy migration now stages all candidates before writing, preserves existing canonical or ordinal corrections across repeated startup, and holds conflicting legacy aliases without importing either. Focused independent shift checks pass against both source layouts.

## ClickMaint maintenance follow-up

The maintenance source note is now visible. Historical Sacramento/New York seeds never replace an existing saved summary. Missing facility/period data and unrelated fields in partial summaries remain unknown; explicit zeros remain zero, including percentages and labor hours. Eight additional maintenance regression tests pass (`node --test scripts/test-maintenance.cjs`), alongside the 20 production/data tests. No newly verified ClickMaint values are embedded or fetched by this change.

This draft is not a complete daily integration. Current ClickMaint source verification, private persistence, scheduling and browser QA remain outstanding. The separately requested archive-only Data Upload behavior is not included in this metrics draft and must be reconciled before release; no original work reports or invoices are included.
