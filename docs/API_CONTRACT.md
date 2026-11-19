# API contract

Prefix: `/api/v1`.

Interactive docs: [http://localhost:5000/api/v1/docs](http://localhost:5000/api/v1/docs)  
OpenAPI JSON: [http://localhost:5000/api/v1/openapi.json](http://localhost:5000/api/v1/openapi.json)

Swagger is public (no JWT) so the contract can be inspected. Trying protected operations in Swagger still requires `Authorize` with a bearer token.

## Phase 0 — health

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/health` | none | Process liveness |
| GET | `/api/v1/health` | none | API + database status |

```json
{ "status": "ok", "db": "connected", "mail": "smtp" }
```

`status` is `ok` when the database is connected, otherwise `degraded`. `db` is `connected` or `disconnected`.

`mail` reports the configured mail transport: `smtp`, `resend`, or `not_configured`. `resend` takes precedence when `RESEND_API_KEY` is set. This field reflects configuration only — it does **not** test whether the mail server or provider is reachable, and it does not affect `status`.

## Phase 1 — authentication

All other `/api/v1` routes require `Authorization: Bearer <access-token>`.

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/v1/auth/registration` | none | Whether self-registration is enabled |
| POST | `/api/v1/auth/register` | none | Create a lecturer account (if enabled) |
| POST | `/api/v1/auth/login` | none | Issue a JWT |
| GET | `/api/v1/auth/me` | JWT | Current lecturer |
| POST | `/api/v1/auth/forgot-password` | none | Start a password reset |
| POST | `/api/v1/auth/reset-password` | none | Set a new password with a one-time token |

Register body:

```json
{ "fullName": "Ada Lecturer", "email": "ada@example.com", "password": "at-least-8-chars" }
```

Login body:

```json
{ "email": "ada@example.com", "password": "at-least-8-chars" }
```

Success (`201` register, `200` login):

```json
{
  "data": {
    "token": "<jwt>",
    "user": {
      "id": "…",
      "fullName": "Ada Lecturer",
      "email": "ada@example.com",
      "role": "lecturer"
    }
  }
}
```

Password hashes are never returned. Invalid login always uses `401` and `Invalid email or password.` Duplicate email uses `409`. Registration disabled uses `403`. Missing/invalid token uses `401 Authentication required.`

JWT expiry is configured by `JWT_EXPIRES_IN` (default `8h`). Prototype self-registration is controlled by `AUTH_REGISTER_ENABLED`.

Forgot-password body: `{ "email": "ada@example.com" }`. The response always uses a generic message so account existence is not leaked. In development/test only, `data.resetUrl` is included so the flow can be verified without SMTP.

Reset-password body: `{ "token": "<from-email-or-resetUrl>", "password": "at-least-8-chars" }`. Tokens expire after 30 minutes and can be used once. Nodemailer sends reset, welcome, and password-changed mail when `SMTP_HOST`, `SMTP_USER`, and `SMTP_PASS` are set.

## Phase 2 — courses, students, enrolments

All routes below require JWT. Lecturers can only read or change **their own** courses (other lecturers receive `404`).

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/v1/courses` | Paginated courses (`page`, `limit`, `q`, `includeArchived=true`) |
| POST | `/api/v1/courses` | Create `{ name, code, description }` |
| GET | `/api/v1/courses/:courseId` | Course detail |
| PATCH | `/api/v1/courses/:courseId` | Update fields |
| DELETE | `/api/v1/courses/:courseId` | Archive (does not hard-delete) |
| GET | `/api/v1/students` | Student directory (`page`, `limit`, `q`, `courseId`, `classification` including `NOT_CLASSIFIED`, `sortBy=fullName\|matriculationNumber`) |
| POST | `/api/v1/students` | Create `{ fullName, matriculationNumber, email? }` |
| GET | `/api/v1/students/:studentId` | Student profile with `courses[]` and `courseResults[]` (latest classification per enrolled course, plus activity snapshot fields when classified) |
| PATCH | `/api/v1/students/:studentId` | Update profile |
| GET | `/api/v1/courses/:courseId/students` | Enrolments for a course (`periodStart`, `periodEnd` optional — classification/results from latest run in period; `classification`, `q`, `sortBy`, `page`, `limit`) |
| POST | `/api/v1/courses/:courseId/enrollments` | Enrol `{ studentId }` |
| PATCH | `/api/v1/enrollments/:enrollmentId` | `{ status: "active" \| "withdrawn" }` |

Prototype decision: matriculation numbers are **globally unique**. Duplicate active enrolments return `409`. Course codes are unique per lecturer.

## Phase 3 — CSV import

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/v1/courses/:courseId/imports/template` | Activity CSV template: header + one row per enrolled student (`studentIdentifier`, `studentName` pre-filled). Optional query `periodStart`, `periodEnd` pre-fill monitoring columns. |
| POST | `/api/v1/courses/:courseId/imports/preview` | Multipart `file` plus optional period fields |
| POST | `/api/v1/courses/:courseId/imports/confirm` | `{ importId }` persist valid rows |
| GET | `/api/v1/courses/:courseId/imports` | Import history |
| GET | `/api/v1/courses/:courseId/imports/:importId` | Import detail |

Empty cells stay `null` (missing), never `0`. Confirm is idempotent. A second file for the same student and period is counted as skipped. Dates without a timezone are treated as UTC calendar dates.

## Phase 4 — Configuration and scoring

### Global indicator weights (lecturer scope)

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/v1/settings/indicator-weights` | Active global weights (seeds default 30/30/40 on first access) |
| POST | `/api/v1/settings/indicator-weights` | New global weight version (`weights` as % or fractions, optional `changeNote`) |
| GET | `/api/v1/settings/indicator-weights/versions` | Global weight version history |
| GET | `/api/v1/settings/course-classification` | Course list with `configurationStatus` (`CONFIGURED` / `NOT_CONFIGURED`) |

### Per-course classification config

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/v1/courses/:courseId/classification-config` | Active **effective** config: global weights + course bands/boundaries |
| POST | `/api/v1/courses/:courseId/classification-config` | New course version (`lastActivityBands`, `classificationBoundaries`, `changeNote`). **Weights are not accepted** (400 if sent). |
| GET | `/api/v1/courses/:courseId/classification-config/versions` | Course config version history |

Default global weights: 30 / 30 / 40. Default last-activity bands: 0–3 = 100, 4–7 = 80, 8–14 = 60, 15–21 = 30, >21 = 0. Default classifications: Active ≥ 70, Requiring Attention ≥ 40, Inactive below 40. Missing indicator values are never coerced to zero. Not Applicable indicators re-normalise remaining weights. If any required indicator is Insufficient Data, the overall result is Insufficient Data. Classification snapshots store `globalWeightsVersion`, `courseConfigurationVersion`, and weights used at generate time.

## Phase 5 — Classification and dashboard

| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/v1/courses/:courseId/classifications/generate` | `{ monitoringPeriodStart, monitoringPeriodEnd }` score all active enrolments |
| GET | `/api/v1/courses/:courseId/dashboard` | Summary counts plus paginated results (`periodStart`, `periodEnd`, optional `q`, `classification`, `sortBy`, `page`, `runId`). Each result may include `activityImport` (`id`, `filename`, `confirmedAt`) from the student’s `activityRecordId` for that run. Includes `activityImportUsed` (primary batch summary for the run). |
| GET | `/api/v1/courses/:courseId/classification-runs` | Classification run history. `scope=all` (or omit period query) lists **every** run for the course, newest first, each row with its stored monitoring period. Optional `periodStart` / `periodEnd` filters to one monitoring period; `periodAdjusted` applies when the filter had no exact match. |
| GET | `/api/v1/courses/:courseId/classification-results` | Paginated results for the latest run in the period |
| GET | `/api/v1/courses/:courseId/classification-results/export` | CSV export of results for period (`periodStart`, `periodEnd`, optional `runId`) |
| GET | `/api/v1/courses/:courseId/classification-results/:resultId` | Evidence, scores, statuses and config snapshot |
| GET | `/api/v1/dashboard/summary` | Cross-course enrolment-result summary (`courseId=all\|id`, `periodStart`, `periodEnd`). Read-only; never generates. |
| GET | `/api/v1/dashboard/course-comparison` | Per-course comparison for the same filters |
| GET | `/api/v1/dashboard/attention-students` | Paginated enrolment results for Overview table. Query: `focus=followup` (default: inactive + requiring attention), `focus=all`, `classification`, `q` (name/matric search), `page`, `limit`. Sort: inactive first, then requiring attention, then active, insufficient data. |
| GET | `/api/v1/courses/import-roster/template` | Course + enrolment CSV template for the signed-in lecturer: one row per **active** course with `courseCode`/`courseName` filled and empty `studentIdentifier`/`studentName` for you to complete (4 columns) |
| POST | `/api/v1/courses/import-roster/preview` | Preview course/student/enrolment CSV |
| POST | `/api/v1/courses/import-roster/confirm` | `{ importId }` commit roster import |

Activity import template uses nine columns only (no event arrays): `studentIdentifier,studentName,lastActivityAt,materialsAvailable,materialsAccessed,assignmentsDue,assignmentsSubmitted,monitoringPeriodStart,monitoringPeriodEnd`.

Re-running generate creates a new run. The dashboard reads the latest run. Historical result documents keep the configuration snapshot used when they were generated. Enrolled students with no imported activity for the period are classified Insufficient Data, not zero.
