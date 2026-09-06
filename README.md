# Lamonica's Operations Hub

Internal operations workspace for Lamonica's Pizza Dough International.

## Current release status

The production application is a static GitHub Pages site. The premium rebuild is being developed separately from `main` so the working deployment remains protected.

This foundation milestone separates page structure, styling, and application logic into:

- `index.html` — semantic page structure and embedded source documents
- `assets/app.css` — design system and interface styles
- `assets/app.js` — existing business logic and application behavior
- `docs/` — audit and target architecture notes
- `scripts/verify-build.mjs` — dependency-free structural checks

Operational imports and shared records are still browser-local in this milestone. The interface labels that state honestly. Do not treat this branch as a shared Supabase-backed release yet.

## Verify

Run:

```bash
node scripts/verify-build.mjs
```

The check validates the static entry point, required assets, JavaScript syntax, global location options, unique element IDs, and the business-critical import/KPI functions retained from the production baseline.

## Deployment

`main` remains the GitHub Pages production branch. Merge only after review and verification. Supabase configuration, migrations, authentication, Row Level Security, and private storage policies must be implemented and tested before any feature is described as shared or live.
