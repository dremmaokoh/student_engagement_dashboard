# Chapter Four evidence pack

Source of truth: `docs/PRD_AND_TECHNICAL_PLAN.md` (including Section 32).  
Record only real outcomes. Do not invent successful screenshots or test results.

## Checklist

| Evidence item | Status | Notes |
|---|---|---|
| Sample course/enrolment CSV (4 columns) | Ready | `docs/sample-course-enrolment.csv` |
| Sample activity CSV (9 columns) | Ready | `docs/sample-activity.csv`, `docs/sample-activity-import.csv` |
| Import outcome (roster + activity) | Capture in UI | Preview → confirm; note imported / skipped / rejected |
| Expected-vs-actual scoring examples | Automated | `cd server && npm test -- --runInBand --forceExit tests/scoring.test.js` |
| Invalid CSV / validation outcomes | Automated | `tests/imports.test.js` (counts, event-column rejection, unenrolled) |
| Classification generate + evidence view | Capture in UI | Course Results / History → View evidence |
| Results CSV export | Capture in UI + API | Results / History → Export results CSV |
| Dashboard / Overview screenshots | Capture in UI | `/overview`, Courses, course Overview, Students, Settings |
| Usability / responsive notes | Optional | Test core workflow near 390px width |

## Automated results recorded 17 November 2026

Commands run from the project machine (do not treat as screenshots):

1. Activity import hard-lock: `cd server && npm test -- --runInBand --forceExit tests/imports.test.js` → **5 passed** (template, event-column rejection, invalid counts, confirm/skip, unenrolled).
2. Classification suite (including CSV export): `cd server && npm test -- --runInBand --forceExit tests/classifications.test.js` → **3 passed**.
3. Client production build: `cd client && npm run build` → Vite build succeeded after gap fixes (`/overview`, student/enrol UI, export).

## Manual capture steps (lecturer workflow)

1. Register/login → land on **Overview**.
2. **Courses** → download 4-column template → import `docs/sample-course-enrolment.csv` (or equivalent).
3. Open a course → **Activity Imports** → download 9-column template → import activity for the period.
4. **Classification Settings** → confirm default 30/30/40 (or save a new version).
5. Course **Overview** → Apply period → Generate classifications.
6. **Results / History** → open run → export CSV → open one student evidence page.
7. Optionally create/enrol a student from **Students** / course Students forms (secondary to CSV).
8. Save screenshots into your thesis evidence folder; paste filenames into the checklist notes column.

## Limitations to cite

See README “Limitations (prototype)”. Live LMS integration is out of scope for this prototype (§32.3–32.4).
