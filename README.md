# Student Engagement Dashboard

Lecturer-facing prototype that imports structured or simulated LMS activity records (CSV), scores three approved indicators, and helps lecturers identify students whose recorded activity may require attention.

This application **does not** replace lecturer judgement, diagnose causes of inactivity, predict academic failure, or integrate live with Moodle/Canvas in the current release.

## Approved stack

- Frontend: React.js (Vite, JavaScript)
- Backend: Node.js + Express.js (JavaScript, ESM)
- Database: MongoDB
- API: REST (`/api/v1`)
- Authentication: JWT (Phase 1)
- Documentation: Swagger/OpenAPI at `/api/v1/docs`

Do not switch this stack without explicit approval.

## Product rules (preserved)

- Indicators: last recorded LMS login/activity, course material access, assignment submission
- Default weights: 30% / 30% / 40%
- Classification: 70–100 Active, 40–69.99 Requiring Attention, 0–39.99 Inactive
- Missing data is never converted to zero
- Zero activity, Not Applicable, and Insufficient Data remain distinct

Source of truth: [docs/PRD_AND_TECHNICAL_PLAN.md](docs/PRD_AND_TECHNICAL_PLAN.md)

## Prerequisites

- Node.js 20+
- npm
- MongoDB 7 locally, Docker Desktop, **or** a MongoDB Atlas URI

## Setup

```bash
# 1. Copy environment example (do not commit the real .env)
copy .env.example server\.env

# 2. Optional local MongoDB via Docker
docker compose up -d

# 3. Install dependencies
cd server && npm install
cd ../client && npm install
```

On macOS/Linux use `cp .env.example server/.env`.

To use Atlas, set `MONGODB_URI` in `server/.env` to your Atlas connection string. Do not put credentials in git.

## Run

Use two terminals.

**Server** (binds `0.0.0.0:$PORT`, default 5000):

```bash
cd server
npm run dev
```

**Client** (Vite, default http://localhost:5173; proxies `/api` to the server):

```bash
cd client
npm run dev
```

Health checks:

- http://localhost:5000/health
- http://localhost:5000/api/v1/health
- Swagger UI: http://localhost:5000/api/v1/docs
- OpenAPI JSON: http://localhost:5000/api/v1/openapi.json
- Client app: http://localhost:5173 (login required for private screens)

Sample CSV for demos: [docs/sample-activity.csv](docs/sample-activity.csv). Students in the file must already be enrolled.

Expected JSON:

```json
{ "status": "ok", "db": "connected", "mail": "smtp" }
```

`mail` is the configured transport (`smtp`, `resend`, or `not_configured`); `resend` takes precedence when `RESEND_API_KEY` is set. It reports configuration only — it does not verify that the mail provider is reachable and does not affect `status`.

If MongoDB is down, the API still serves health with `"db": "disconnected"` and `"status": "degraded"` (and the same `mail` field). The process logs a connection error and does not print secrets.

## Tests

```bash
cd server
npm test
```

The health test always asserts the route shape. The database-connected assertion runs only when MongoDB is reachable at `MONGODB_URI`; otherwise that case is skipped and reported.

## Phase 0 verification (actual results)

Recorded 10 November 2026. These are real command outcomes, not invented.

**Environment**
- Node.js `v22.14.0`, npm `10.9.2`
- Docker is **not** installed (`docker` is not on PATH)
- No `mongod` / `mongosh` on PATH; `127.0.0.1:27017` refused connections

**Install**
- `server`: `npm install` succeeded (402 packages)
- `client`: `npm install` succeeded (63 packages)

**Tests** (`cd server && npm test`)
- `GET /health returns status and db fields` — pass
- `GET /api/v1/health matches GET /health` — pass
- `reports connected when MongoDB is reachable` — pass (skipped the connected assertion: `connect ECONNREFUSED 127.0.0.1:27017`)
- Suites: 1 passed, 3 tests passed

**Runtime**
- API listened on `0.0.0.0:5000`
- `GET /health` and `GET /api/v1/health` both returned `{"status":"degraded","db":"disconnected"}` (Phase 0 predates the `mail` field)
- Vite client built successfully (`vite build`)
- http://localhost:5173 loaded the Phase 0 page and showed API status **degraded**, database **disconnected**

**Secrets**
- Real credentials are not committed. `server/.env` is gitignored and uses local placeholders only.

**Database (later confirmed)**
Atlas is configured in `server/.env` (not committed). Health should return `{"status":"ok","db":"connected"}` when the API is running.

## Phase 1 notes

- Self-registration is **enabled** for this prototype (`AUTH_REGISTER_ENABLED=true`). Set it to `false` to require seeded accounts only.
- Open http://localhost:5173, create a lecturer account or sign in, then use Overview / Courses / Students / Settings / Profile / Sign out.
- Unauthenticated visits to private screens redirect to `/login`. Private APIs return `401`.
- Forgot password: `/forgot-password`. Add SMTP settings in `server/.env` to send mail with Nodemailer. In development, the API also returns `resetUrl` so the flow can be tested without SMTP.

## Phase 1 verification (actual results)

Recorded 10 November 2026.

**Tests** (`cd server && npm test`)
- Latest: 2 suites passed, 14 tests passed (includes forgot/reset password)

**Runtime**
- Live `GET /api/v1/courses` without a token returned **401**
- Visiting `/courses` or `/students` while signed out redirected to `/login`
- Lecturer registration and login reached the shell (Overview, Courses, Students, Settings, Sign out)
- After sign-out, private screens required login again

**Decision used:** prototype self-registration is enabled (`AUTH_REGISTER_ENABLED=true`). Set `false` if you want seeded accounts only.

SMTP: host/user/pass are set in `server/.env`; `transporter.verify()` returned **ok**. Gmail app-password spaces are stripped before connecting.

## Phase 2 verification (actual results)

**Tests:** 3 suites, 19 tests passed (courses/students/enrolments, ownership 404, duplicate enrolment 409, archive, unauthenticated 401).

**UI:** lecturer created HCI401, created student Ada Student, enrolled them in the course workspace.

**Decision used:** matriculation numbers are globally unique in this prototype.

## Phase 3 verification (actual results)

**Tests:** 4 suites, 23 tests passed. CSV template, row-level invalid counts, missing dates stored as null (not zero), confirm import, idempotent confirm, duplicate student/period skipped, unenrolled student rejected.

**UI:** Activity Imports tab on the course workspace (template, period, preview, history).

## Phase 4 notes

- Classification settings live per course. GET seeds default v1 (weights 30/30/40, bands 0–3/4–7/8–14/15–21/>21, Active ≥ 70, Requiring Attention ≥ 40).
- POST creates a new immutable version and deactivates the previous one. Historical classified results (Phase 5) will keep the version they were generated with.
- Missing indicators stay missing. Not Applicable re-normalises remaining weights. Any Insufficient Data required indicator yields Insufficient Data overall.

## Phase map

| Phase | Status |
| --- | --- |
| 0 Foundation | Complete (Atlas connected) |
| 1 Authentication and shell | Complete (SMTP verified) |
| 2 Courses, students, enrolments | Complete |
| 3 CSV import | Complete |
| 4 Configuration and scoring | Complete |
| 5 Classification and dashboard | Complete |
| 6 Testing and hardening | Complete |

## Phase 5 notes

- Generate scores every active enrolment for a course and monitoring period. Students without imported activity are Insufficient Data, never a silent zero.
- Re-running create a new result run. The dashboard shows the latest run. Older result documents keep the config snapshot they were generated with.
- Course Results tab: summary counts, data-quality line, searchable/filterable/sortable table, and an evidence page per student.

## Phase 5 verification (actual results)

Recorded 10 November 2026.

**Tests** (`cd server && npx jest tests/classifications.test.js --runInBand --forceExit`)
- 1 suite, 3 tests passed
- Imported 8/10 materials, 3/4 assignments, last activity 2 days before period end → overall **84 Active**
- Enrolled student with no import → Insufficient Data, score null
- Dashboard counts match persisted results
- After changing weights to 10/10/80, a new run uses v2 while the original result still stores v1 and 84

**UI:** HCI501 Results generated for 2026-10-01 to 2026-10-31. Cards showed enrolled 1, Insufficient Data 1. Evidence for Ada Result CSC/2026/501 explained missing imported activity and config v1.

## Phase 4 verification (actual results)

Recorded 10 November 2026.

**Tests** (`cd server && npx jest tests/scoring.test.js tests/configValidation.test.js tests/config.test.js --runInBand --forceExit`)
- 3 suites, 13 tests passed
- Scoring: 91 Active, 57 Requiring Attention, 24 Inactive; boundaries 39.99 / 40 / 69.99 / 70 / 100; last-activity 2/5/10/18/25 days; materials 8/10, 5/10, 0/10, N/A, incomplete; assignments 3/4, 0/4, N/A, incomplete; N/A reweight 50/50; all N/A Insufficient Data
- Config API: GET seeds default v1; POST creates immutable v2 and deactivates v1; invalid weights return 400

**UI:** HCI401 Classification Settings loaded default v1 (30/30/40). Saving 25/25/50 created immutable v2 (`Increase assignment weight for HCI401`); v1 stayed inactive. Weights that do not sum to 100% show an error and do not create a version. Global Settings lists HCI401 and links through.

## Phase 6 verification (actual results)

Recorded 10 November 2026.

**Tests** (`cd server && npm test`)
- 10 suites, **44 tests passed**
- Includes ownership (lecturer B cannot generate/read A’s dashboard), dashboard search/filter (table filter does not change summary counts), and unauthenticated OpenAPI/Swagger

**Client build:** `cd client && npm run build` succeeded (`vite build`, 60 modules).

**Docs/UI:** http://localhost:5000/api/v1/docs loaded Swagger UI (Health through Classifications). HCI501 Results remained usable at 390px width (nav, Generate classifications, Apply).

## Section 32.2 activity import hard-lock (actual results)

Recorded 17 November 2026.

- The activity template includes columns only for indicators that are active in Settings. With all three active, the file has nine columns: identity, `lastLearningActivityAt`, `learningMaterialsAvailable`, `learningMaterialsCompleted`, assignment counts, and the monitoring period. A deactivated indicator's columns are omitted, and an upload that still contains them is rejected. Learning Activity Recency is the timestamp in `lastLearningActivityAt` only. Files that add `lastLearningActivityType` or the removed event columns are rejected with HTTP 400. Sample CSVs are synthetic.
- `docs/sample-activity.csv` and `docs/sample-activity-import.csv` match the nine-column template.
- `cd server && npm test -- --runInBand --forceExit tests/imports.test.js` → **5 passed** (template, event-column rejection, invalid counts, confirm/idempotent skip, unenrolled student).
- `tests/classifications.test.js` → **passed** against the nine-column activity CSV.

Chapter Four evidence checklist and recorded automated outcomes: [docs/CHAPTER_FOUR_EVIDENCE.md](docs/CHAPTER_FOUR_EVIDENCE.md). Screenshots remain a manual capture step (do not invent outcomes).

## Performance and operations

**Measured before/after (25 November 2026, shared Atlas database, 12 courses and 600 classified enrolments):**

| Operation | Before | After | Notes |
| --- | ---: | ---: | --- |
| `GET /api/v1/courses?limit=100` | 9.14 s | 0.96 s | 3 batched aggregates + lean reads |
| Dashboard summary (cold / warm) | 10.02 / 9.98 s | 4.23 / 0.75 s | 30 s cache, shared in-flight work |
| Dashboard course comparison (cold / warm) | 9.18 / 9.09 s | 0.27 / 0.25 s | Reuses the cached scoped bundle |
| Dashboard trend (cold / warm) | 3.52 / 3.38 s | 1.01 / 0.24 s | Per-course aggregations run in parallel |
| Roster import confirm, 500 rows | 377.8 s | 3.34 s | Batched lookups, 500-row chunked writes |
| Roster import confirm, 1,000 rows | >15 min (timed out) | 3.85 s | Baseline run hit the harness timeout |
| Roster import confirm, 5,000 rows | not run (baseline too slow) | 17.63 s | Under the 20 s chunked-write budget |
| Course-student import confirm, 500 / 1,000 / 5,000 rows | 2.45 s (500 only) | 2.16 / 2.77 / 9.65 s | Chunked inserts and bulk writes |
| Activity import confirm, 500 rows | 249.3 s | 2.30 s | Duplicate keys now skip rows instead of failing |
| Activity import confirm, 1,000 / 5,000 rows | not run (baseline too slow) | 3.24 / 10.85 s | Period dates now persist on the batch |
| 5,001-row CSV preview | accepted (201) | rejected (400) | `This file has 5001 rows. The maximum is 5,000 per upload. Please split the file.` |

Import confirms use one batched lookup followed by writes in chunks of 500. Because the largest measured confirm was 17.63 s, the app keeps the synchronous `200` response contract instead of switching to `202` plus polling.

**CSV limits**

- Upload body limit is 5 MB.
- Each upload accepts at most 5,000 data rows (the header is not counted).
- Import previews expire after 30 minutes. An expired or re-uploaded preview returns `Preview expired, please upload the file again.`
- Each lecturer can hold at most 10 unconfirmed previews; the oldest are removed first.

**Indexes and hosting**

- Production starts with Mongoose `autoIndex=false`. After deploying a new index definition, run `cd server && npm run sync:indexes` once (with `MONGODB_URI` set) to build the indexes explicitly.
- Responses are gzip/br compressed. Built client assets are cached for one year as immutable; `index.html` is never cached.
- Requests taking 300 ms or more are logged as `slow_request` JSON so cold starts and slow queries are visible in the host logs.
- The API uses a MongoDB connection pool of 10.

**Cold starts on Render**

Free Render web services sleep after roughly 15 minutes of inactivity. The first request after sleep can take up to a minute. To reduce cold starts, point an external cron/uptime pinger at `GET /health` every 5–10 minutes, or keep the service on a paid plan. Do not ping more frequently than that.

## Limitations (prototype)

- No live Moodle/Canvas/LMS API. Activity arrives through CSV only.
- Scoring weights, recency bands and classification boundaries are proposed prototype defaults, not empirically validated standards.
- The dashboard supports lecturer judgement. It does not diagnose inactivity, infer motivation, or predict failure.
- Matriculation numbers are globally unique in this prototype.
- Dates without a timezone are treated as UTC calendar dates.
- Activity CSV uses the aggregate columns for the active indicators (nine when all three are active; PRD §32.2). Event-level columns are not accepted.
- Re-generating classifications creates a new run. Course Overview shows the latest run; Results / History opens earlier runs with their stored config snapshots.
- Results CSV export is available from Results / History for a selected run and period.
- Self-registration is enabled (`AUTH_REGISTER_ENABLED=true`) for the prototype.
- Auth endpoints are rate-limited (skipped in tests). JWT expiry defaults to 8 hours.
- Swagger UI is public for the contract; protected operations still require a bearer token.

Decisions used: any monitoring period (no presets); re-runs keep revisions; CSV export deferred.

## Screens (PRD)

Main navigation: Overview, Courses, Students, Settings, Profile. Sign out stays in the sidebar.

Course workspace tabs: Overview, Students, Activity Imports, Classification Settings, Results/History.

- Overview (`/overview`, app home): cross-course KPIs, donut distribution, course comparison, students requiring attention, data freshness. `/dashboard` redirects here.
- Courses: list-first directory with course/enrolment CSV import; manual add is secondary.
- Course overview: period controls, Import Activity / Configure Classification / generate actions, summary cards, distribution, attention list, student table.
- Course students: read-only roster with search/filter (no manual enrol UI).
- Results / History: immutable generate runs for a period.
- Student evidence: indicator glyphs, N/A badges, score bars (not shown for Insufficient Data), and imported aggregate activity values.
- Settings: classification guidance and colour key; editing stays per course.
- Profile: account details and password reset (sign out in sidebar only).

## Security

- Never commit `.env`, password hashes, or JWT secrets
- `.env.example` contains placeholders only
- CORS is restricted to `CLIENT_ORIGIN`
