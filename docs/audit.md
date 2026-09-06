# Foundation Audit

Audit date: 2026-09-06

Baseline commit: `70e09f5`
Live deployment and repository baseline matched byte-for-byte at the start of this milestone.

## A. Current architecture

The application is a static GitHub Pages site. Production consisted of one 396 KB `index.html` containing the structure, 29 style blocks, 14 executable inline script blocks, embedded images/documents, business calculations, report parsers, and hard-coded source data. Three browser-loaded libraries provide spreadsheet, PDF, and OCR support.

## B. Important functionality to preserve

- Global location context: All Locations, Indiana, LA 26th St., LA Maywood, New York, and Sacramento
- Home, KPI, purchasing, receiving, asset, document, safety, employee, and data-upload surfaces
- ClickMaint report parsing, import preview, location validation, record merge behavior, KPI calculations, and import history
- Production records keyed by location, date, and shift
- Original-file viewing/download behavior and embedded official resources
- Scoped KPI reset/undo behavior and settings that are genuinely device-local

## C. Technical debt and bugs

- Structure, styling, data, and behavior were coupled in one file.
- Later CSS blocks repeatedly overrode earlier blocks, including extensive `!important` use and oversized navigation rules.
- Multiple generations of similar asset, production, KPI, and startup logic coexist.
- Several global event handlers and delayed render passes can race or overwrite one another.
- The data layer exposes IndexedDB implementation details throughout UI and business logic.
- Large base64 resources block parsing and make code review difficult.
- There is no automated test or documented deployment contract.

## D. Data architecture findings

IndexedDB stores files, work orders, production records, import history, summaries, and undo actions. localStorage stores location, filters, purchasing/receiving records, shift notes, metric resets, and settings. No Supabase client, database configuration, migration, authentication, or Storage integration exists in the baseline. Therefore the current application cannot meet the shared, cross-device persistence standard.

Hard-coded KPI/report records and seeded location data are presented alongside imported records. Their provenance is partly documented in filenames and notes, but the application does not consistently distinguish historical baseline data from live authoritative data.

## E. Security findings

- No user authentication or role-based authorization is present.
- The public repository and public deployment contain operational records and employee names.
- Browser-local records are accessible to anyone using that browser profile.
- Third-party scripts are loaded from CDNs without integrity metadata or a restrictive Content Security Policy.
- No Supabase Row Level Security or private file-storage policy exists because Supabase is not yet integrated.

No secret or service-role key was found in the baseline search. A browser-safe anonymous key may be used later only with correctly tested Row Level Security; privileged keys must never enter frontend code.

## F. UX and design findings

The product already contains broad operational capability, but visual hierarchy is diluted by oversized navigation, repeated card treatments, emoji-based iconography, inconsistent spacing, and stacked responsive overrides. Data state was also ambiguous: browser-local information could appear production-authoritative. Loading, empty, and error handling exist in places but are inconsistent.

## G. Recommended target architecture

Keep the employee experience static and fast while separating concerns into an application shell, feature modules, parsers, business calculations, validation, data services, and shared UI primitives. Introduce Supabase behind a narrow repository/service boundary:

1. Authenticated user and location membership
2. PostgreSQL tables for imports, normalized records, provenance, corrections, and audit events
3. Private Storage buckets for original files
4. Row Level Security by user role and facility membership
5. Idempotent imports using a source hash plus report type, location, and period
6. Browser storage limited to preferences and explicitly labeled offline cache

## H. Safe development strategy

Develop on `develop/premium-foundation`; keep `main` unchanged until the milestone passes structural checks and human review. Use small logical commits, review the complete diff, and merge through a pull request. Backend schema changes should use migrations and be tested in a non-production Supabase project before release.

## I. First implementation milestone

This milestone modularizes the production monolith without rewriting calculations, adds a restrained shared design foundation, adds a startup lifecycle tied to the real initialization promise, and labels the current data state as `Local only`. It also adds repeatable structural verification and documents the migration boundary.

The next milestone is the authoritative data foundation. It requires the actual Supabase project configuration and a deliberate schema/RLS review; it should not be simulated with invented endpoints or credentials.
