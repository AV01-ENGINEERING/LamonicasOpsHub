# October source-data update

The original main commit `70e09f542adbe71cb1c33a654d045209ad630931` was backed up with all four original files and checksums before this update. Original style blocks and the handbook/LOTO files are unchanged.

## Published snapshot

- ClickMaint custom selected dates: October 1–5, 2026; captured October 5, 15:01 UTC. Exact source timezone and timestamp inclusivity were not displayed.
- Period activity is separate from the all-age current backlog snapshot.
- Completed-work-order costs are recorded costs on WOs completed in the selected window, including older WOs; they are not October spending. The source currency symbol is $, with ISO code unverified.
- Source discrepancies remain visible: LA 26th completed 136 versus 142; Maywood overdue 48 versus 49 and asset downtime 117.9 versus117.97 hours. Selected primary report values are retained, not silently reconciled.
- Production shows14 nonconflicting provided production reports: partial batch subtotals 491 for 26th and 333 for Maywood. These are not full-facility totals. Other production aggregates remain unknown; packed or inventory pallets are not counted as made.
- The cleared42-report catalog is published in stages. One original is currently available under its verified content-hash path; remaining originals have no active file links until their bytes are verified on GitHub. Originals requiring privacy review are not included. No source ZIP containing withheld files is included.

## Archive behavior

Data Upload is an original-report archive. Published files can be searched by facility/date/shift/type and opened/downloaded. New uploads and metadata edits remain in that browser and never modify dashboard metrics. Original byte retention, deduplication and interrupted edits are tested. Metric recovery remains separate in KPI.

The database and automated 6 AM Pacific updates are not enabled. This is a manually published source snapshot, not a live source connection. No credentials or unrelated email/invoice data are included.

## Verification

- 20 production/data regression tests, 8 maintenance tests and 9 archive tests pass.
- Actual snapshot totals, source distinctions, all 42 file hashes/paths and script dependencies were checked.
- Original CSS blocks and handbook/LOTO assets match the original commit.
- Browser/native IndexedDB visual verification was blocked in the preparation environment. Public-site verification remains a release check.

Commands:

```
node scripts/verify-main.cjs
OPS_APP_SOURCE=$PWD/index.html node --test scripts/test-data-core.cjs
node --test scripts/test-maintenance.cjs
node --test scripts/test-archive.cjs
```

Rollback: restore the original Git tree with a reviewed revert/restoration commit; do not force-push or rewrite history. Browser-local records are separate from repository backups.
