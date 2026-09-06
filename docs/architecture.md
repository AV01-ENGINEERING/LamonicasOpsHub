# Target Architecture

## Data ownership

| Concern | Authority | Browser role |
| --- | --- | --- |
| Operational records and KPIs | Supabase PostgreSQL | Read-through cache only |
| Original reports and documents | Private Supabase Storage | Temporary local preview/cache |
| Import provenance and corrections | Supabase PostgreSQL | Staged, unconfirmed edits only |
| Location, display, and accessibility preferences | User preference store | Allowed |
| Offline state | Explicitly labeled cache | Never overwrites newer server state |

## Import transaction

1. Select or confirm the global location.
2. Stage a file or text source without mutating authoritative data.
3. Parse into raw extraction plus normalized candidate records.
4. Validate report type, location, dates, required values, and duplicates.
5. Present an editable preview with source provenance.
6. On confirmation, upload the original file and commit the import, raw extraction, normalized records, and audit event.
7. Report success only after every required write is verified.
8. Refresh affected queries and show the persisted result.

Partial failure must remain visible and retryable. Corrections create scoped audit records rather than restoring a browser snapshot over shared data.

## Migration sequence

1. Freeze and test current KPI/parser behavior.
2. Define database entities and facility/role permissions from real requirements.
3. Add Supabase migrations, RLS policies, Storage policies, and environment validation.
4. Place a data-service interface between features and IndexedDB.
5. Migrate one bounded workflow—production imports—end to end.
6. Verify refresh and second-device retrieval before calling the workflow shared.
7. Migrate maintenance reports, files, receiving, shift notes, and remaining operational data incrementally.
8. Remove authoritative browser stores only after data reconciliation and rollback planning.
