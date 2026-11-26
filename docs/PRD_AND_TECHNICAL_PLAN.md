# PRD + Technical Plan: Student Engagement Dashboard

**Project:** Design and Development of a Student Engagement Dashboard for Identifying Inactive Students in Learning Management Systems  
**Stack:** React.js, Node.js, Express.js, MongoDB, REST API, JWT, Swagger/OpenAPI  
**Document purpose:** Product requirements, engineering blueprint and Cursor implementation instructions.

---

## 1. Product vision

Build a standalone lecturer-facing dashboard that imports structured or simulated activity records from existing Learning Management Systems (LMS), analyses three selected activity indicators, and helps lecturers identify students whose recorded activity may require attention.

The dashboard supports lecturer judgement. It does not replace it, diagnose why a student is inactive, predict academic failure, infer motivation, or claim to measure every dimension of student engagement.

### Problem
Lecturers may find it difficult to identify students with low or declining LMS activity when login/activity records, material access and assignment information are viewed separately. The product consolidates these signals into an explainable course-level and student-level view.

### Product goals
A lecturer can:
1. Create and manage courses.
2. Create student profiles and enrol students in courses.
3. Import LMS activity data using CSV.
4. Preview and validate imported records.
5. Configure scoring weights and thresholds independently for each course.
6. Generate activity scores and classifications.
7. Review the evidence and calculation behind each result.
8. Identify students who may require follow-up.

## 2. Scope

### In scope
- Lecturer authentication and protected sessions.
- Course CRUD.
- Student CRUD and course enrolments.
- CSV template, upload, preview, validation and import history.
- Exactly three indicators: last recorded LMS login/activity, course material access, assignment submission.
- Per-course weights, indicator thresholds and classification boundaries.
- Normalised indicator scores (0–100).
- Weighted overall score and classification.
- Missing, Not Applicable and Insufficient Data handling.
- Immutable/versioned course configurations.
- Dashboard, student results table and student evidence view.
- Unit and integration tests.
- Swagger/OpenAPI documentation.

### Out of scope
- Building a complete LMS.
- Live Moodle, Canvas or other LMS API integration.
- Institutional-scale integrations or complex university administrator hierarchy.
- Predicting dropout, failure or academic performance.
- Machine learning.
- Diagnosing causes of inactivity or inferring motivation/personal circumstances.
- Automated student messaging or invasive monitoring.

### Integration boundary
This is a separate application designed to work alongside existing LMS platforms. For this prototype, structured or simulated LMS activity records are imported through CSV. Live LMS integration is not part of the current implementation. Keep the import layer modular so API integrations can be considered later.

## 3. Users and core user stories

**Primary user: Lecturer / course owner.**

- As a lecturer, I can sign in securely and access only my authorised courses.
- I can create, edit and archive courses.
- I can create student profiles and enrol a student in one or more courses.
- I can upload a CSV for a selected course and monitoring period.
- I can preview rows and see validation errors before confirming an import.
- I can see imported, skipped and rejected row counts.
- I can configure weights and scoring bands for each course.
- I can generate classifications for a course and monitoring period.
- I can filter and search students by name, matriculation number and classification.
- I can inspect the input evidence, indicator scores, overall score and configuration version behind a result.
- I can distinguish genuine zero activity from missing or non-applicable information.

## 4. Functional requirements

### FR1 Authentication and access control
- Lecturer login; optional registration only if approved.
- Hash passwords using bcrypt or equivalent.
- JWT access token with expiry.
- Protect all private routes.
- Enforce course ownership in backend middleware/service logic, not only frontend routes.
- Never return password hashes or expose secrets.

### FR2 Courses, students and enrolments
- Course fields: name, code, description, lecturer owner, status, timestamps.
- Student fields: full name, matriculation number, optional email, timestamps.
- Enrolment links student and course; store status and enrolled date.
- A student profile can be linked to multiple courses.
- Prevent duplicate active student-course enrolments.
- Archive courses with historical data rather than hard-deleting dependent records.

### FR3 CSV import
Suggested columns:
- `studentIdentifier`
- `studentName` (optional if student exists)
- `lastActivityAt`
- `materialsAvailable`
- `materialsAccessed`
- `assignmentsDue`
- `assignmentsSubmitted`
- `monitoringPeriodStart`
- `monitoringPeriodEnd`

Workflow:
1. Select course and monitoring period.
2. Upload CSV.
3. Validate file type, size, columns and rows.
4. Preview valid rows and row-level errors.
5. Lecturer confirms.
6. Persist valid records and import metadata.
7. Report imported, skipped and rejected rows.
8. Allow classification generation for the period.

Validation:
- Counts are non-negative integers.
- Accessed materials cannot exceed available materials.
- Submitted assignments cannot exceed eligible assignments due.
- Dates are valid; period end cannot precede period start.
- Student must exist or be resolved through an explicit import workflow, and must be enrolled in the selected course.
- Missing values remain missing; never silently convert them to zero.
- Detect duplicate imports and make confirmation idempotent where possible.
- Show useful row number, field and reason for each validation error.

The prototype activity import uses aggregate counts only (see Section 32.2). Do not accept or fabricate event-level material-access or assignment-submission arrays in the CSV import path.

### FR4 Indicator calculations

**Indicator 1 — Last recorded LMS login/activity**

Calculate calendar days between `lastActivityAt` and the end of the monitoring period using a documented, consistent timezone rule.

| Days since last activity | Default score |
|---|---:|
| 0–3 | 100 |
| 4–7 | 80 |
| 8–14 | 60 |
| 15–21 | 30 |
| More than 21 | 0 |

These are proposed operational defaults for this prototype, not universal standards. Make bands configurable per course. Missing timestamp means Insufficient Data, not zero. Use the exact label “Last recorded LMS login/activity”.

**Indicator 2 — Course material access**

`Material Score = (Relevant Materials Accessed / Relevant Materials Available) × 100`

Example: 8/10 = 80.

Count only materials made available during the monitoring period. Materials not yet available are excluded. If no relevant materials were available, status is Not Applicable. If logs are incomplete, status is Insufficient Data. Do not interpret missing logs as proof of no access.

**Indicator 3 — Assignment submission**

`Assignment Score = (Eligible Assignments Submitted / Eligible Assignments Due) × 100`

Example: 3/4 = 75.

Count only assignments whose deadlines have passed within the monitoring period. Not-yet-due assignments are excluded. No eligible assignments due means Not Applicable. Incomplete submission records mean Insufficient Data.

### FR5 Default weights and overall score

| Indicator | Default weight |
|---|---:|
| Last recorded LMS login/activity | 30% |
| Course material access | 30% |
| Assignment submission | 40% |
| **Total** | **100%** |

`E = (L × W_L) + (M × W_M) + (A × W_A)`

Example: `80×0.30 + 60×0.30 + 90×0.40 = 78`.

The weights are proposed prototype defaults informed by design rationale; they are not universal or empirically validated standards.

### FR6 Missing and non-applicable data

Keep these states distinct:
- **Zero activity:** sufficient data establishes no qualifying activity occurred.
- **Not Applicable:** indicator genuinely does not apply, e.g. no assignments were due.
- **Insufficient Data:** required information is missing or incomplete.

Rules:
- Not Applicable indicators are excluded; renormalise remaining applicable weights proportionally.
- Missing/Insufficient Data is not treated as Not Applicable and is not assigned zero.
- Prototype default: if a required indicator is Insufficient Data, final classification is Insufficient Data.
- If all indicators are Not Applicable, return Insufficient Data / No Classifiable Activity, not a score of zero.
- Store indicator status, configured weights and effective weights.
- Example: if assignment is N/A, login and materials weights of 30/30 become 50/50 of the applicable total.

### FR7 Classification boundaries

| Overall score | Classification |
|---|---|
| 70–100 | Active |
| 40–69.99 | Requiring Attention |
| 0–39.99 | Inactive |
| Cannot be reliably calculated | Insufficient Data |

These are proposed prototype boundaries, not universal standards. Make them configurable per course, validate that ranges are gap-free and non-overlapping, and test boundary values 39.99, 40, 69.99, 70 and 100.

### FR8 Configuration versioning
- Each course has versioned settings.
- A change creates a new immutable configuration version.
- New classifications use the active version.
- Historical results retain the exact version or a complete immutable snapshot.
- Store indicator scores/statuses, configured/effective weights, thresholds, overall score, classification, period and generated timestamp.
- Editing current settings must never alter historical results.

### FR9 Dashboard and student detail
Course dashboard:
- Course and monitoring period selector.
- Total enrolled students.
- Active, Requiring Attention, Inactive and Insufficient Data counts.
- Latest import/data-quality summary.
- Classification distribution.
- Searchable, filterable, sortable, paginated student table.

Student detail:
- Name and matriculation number.
- Course and monitoring period.
- Overall score and classification.
- Three indicator scores and statuses.
- Supporting activity data.
- Explanation of calculation.
- Configuration version used.
- Clear data-quality warnings.

## 5. Product design and colour system

### Brand direction
Use a mature, modern academic-technology aesthetic. Blue is the primary brand colour: bright, professional, and data-focused. Sunshine yellow is a deliberate accent on small brand marks only. Balance brand chrome with cool neutral surfaces. Do not use blue or yellow for classification charts and status badges; brand colours and data semantics have different jobs.

### Brand palette

| Token | Hex | Usage |
|---|---|---|
| Primary blue | `#2563EB` | Primary buttons, active navigation, links, key brand elements |
| Primary hover | `#1D4ED8` | Hover/pressed states |
| Secondary blue | `#3B82F6` | Restrained secondary highlights |
| Brand tint | `#EFF6FF` | Selected navigation and subtle brand surfaces |
| Sunshine accent | `#FACC15` | Small brand stripes and decorative accents only |
| Accent muted | `#FBBF24` | Optional accent hover/emphasis |
| Accent tint | `#FEF9C3` | Rare soft highlights (not large text areas) |
| App background | `#F8FAFC` | Main page background |
| Surface | `#FFFFFF` | Cards, panels, tables |
| Subtle surface | `#F1F5F9` | Table headers and secondary panels |
| Primary text | `#0F172A` | Main text |
| Secondary text | `#64748B` | Supporting text |
| Border | `#E2E8F0` | Borders and dividers |
| Focus ring | `#2563EB` | Keyboard focus |

Design recommendations:
- Prefer a white sidebar with a blue active state rather than a permanently saturated blue sidebar.
- Primary buttons: blue with white text.
- Secondary buttons: white with blue text and border.
- Use white cards on a cool off-white background.
- Use restrained borders and subtle shadows.
- Do not use sunshine yellow behind long body text.

### Indicator-category colours
These identify the type of indicator, not the student's classification.

| Indicator | Accent | Hex | Pale tint |
|---|---|---|---|
| Last recorded LMS login/activity | Blue | `#3976B9` | `#EAF2FA` |
| Course material access | Violet | `#7656A6` | `#F0EBF7` |
| Assignment submission | Teal | `#23877B` | `#E7F4F1` |

Use a small icon background, icon, top border or left accent. Keep the card itself white.

### Classification/status colours

| Status | Accent | Hex | Pale tint |
|---|---|---|---|
| Active | Green | `#267A52` | `#E8F4ED` |
| Requiring Attention | Amber | `#A96A12` | `#FFF3DB` |
| Inactive | Red | `#B43B45` | `#FBEAEC` |
| Insufficient Data | Slate | `#667085` | `#EEF0F3` |
| Not Applicable | Neutral grey | `#85818A` | `#F1F0F2` |

Requiring Attention should be amber, not red. Insufficient Data is neutral, not a negative student label. Not Applicable is an indicator state, not a final classification. Always show text labels and never rely on colour alone. Check WCAG 2.1 AA contrast.

### Score display
- Show a numeric score such as `78/100`.
- Place a text classification badge beside it.
- Use indicator-category colours for component scores and status colours only for final classification.
- Progress bars are supplementary, not the only explanation.
- For Insufficient Data, show an explanatory message rather than a false zero-score bar.

### Typography and layout
Use Inter or another clean sans-serif. Use an 8px spacing scale, 8–12px corner radii, readable tables and responsive layouts. Desktop-first is acceptable, but core screens must remain usable on tablet/mobile.

### Navigation and screens
Main navigation: Overview, Courses, optional Students, Settings, Profile/Sign out.

Course workspace tabs: Overview, Students, Activity Imports, Classification Settings, Results/History.

Core screens:
1. Login.
2. Application shell.
3. Courses list/create/edit.
4. Course overview.
5. Student list and enrolment.
6. CSV import and preview.
7. Classification settings.
8. Classification results.
9. Student detail/evidence.

Course overview layout:
- Header with course name/code, period selector, Import Activity and Configure Classification actions.
- Summary cards for total students and each classification state.
- Distribution visual and data-quality summary.
- Student results table.

## 6. Technical architecture

### Fixed stack
- React.js frontend.
- Node.js + Express.js backend.
- MongoDB database.
- REST API.
- JWT authentication.
- Swagger UI/OpenAPI.
- Figma for design.
- Cursor IDE.
- Git/GitHub.

Do not switch to Python/FastAPI, PostgreSQL, Next.js, NestJS or another stack without explicit approval.

### Architecture

```text
React Client
  -> HTTPS / REST / JSON
Node.js + Express API
  -> Auth and ownership middleware
  -> Course/student/enrolment services
  -> CSV import and validation service
  -> Configuration service
  -> Indicator scoring service
  -> Classification service
  -> Results/history service
MongoDB
  -> users
  -> courses
  -> students
  -> enrollments
  -> activityRecords
  -> classificationConfigs
  -> classificationResults
```

Keep business logic out of route handlers. Scoring/classification must be independently testable.

### Suggested repository structure

```text
student-engagement-dashboard/
  client/
    src/
      app/
      assets/
      components/{common,layout,dashboard,students,courses,imports,configuration}/
      features/{auth,courses,students,imports,classifications}/
      hooks/
      lib/
      pages/
      services/
      styles/
  server/
    src/
      config/
      middleware/
      models/
      routes/
      controllers/
      services/{import,scoring,classification}/
      validators/
      utils/
      docs/
      app.js
      server.js
    tests/
  docs/
    PRD_AND_TECHNICAL_PLAN.md
    API_CONTRACT.md
  README.md
  .gitignore
```

## 7. MongoDB model — seven agreed collections

1. **users**: fullName, email (unique, lowercase), passwordHash, role (`lecturer`), timestamps.
2. **courses**: name, code, description, lecturerId, status, timestamps.
3. **students**: fullName, matriculationNumber, optional email, timestamps. Keep profile independent of course.
4. **enrollments**: studentId, courseId, status, enrolledAt, timestamps. Add compound uniqueness for student/course.
5. **activityRecords**: studentId, courseId, monitoringPeriodStart/End, lastLearningActivityAt (legacy alias lastActivityAt), learningItemsRequired, learningItemsCompleted (legacy aliases materialsAvailable and materialsAccessed), assignmentsDue, assignmentsSubmitted, importBatchId, sourceType, validation metadata, timestamps. Learning Activity Recency is the latest qualifying timestamp only; the record does not store an activity type. Aggregate counts only for the prototype CSV path (Section 32.2).
6. **classificationConfigs**: courseId, version, isActive, weights, lastActivityBands, classificationBoundaries, createdBy, createdAt, changeNote. Versions are immutable.
7. **classificationResults**: studentId, courseId, activityRecordId, monitoring period, indicator scores/statuses, configuredWeights, effectiveWeights, overallScore, classification, configurationId/version/snapshot, explanation, generatedAt.

Recommended indexes:
- users.email unique.
- courses.lecturerId.
- enrollments compound unique studentId + courseId.
- activityRecords courseId + monitoring period + studentId.
- classificationResults courseId + monitoring period + classification.
- classificationResults studentId + courseId + monitoring period.

Clarify the matriculation-number uniqueness namespace before enforcing a global unique index. Do not duplicate student profiles per course.

## 8. Classification engine contract

Implement pure deterministic functions:
- `calculateLastActivityScore(lastActivityAt, monitoringPeriodEnd, bands)`
- `calculateMaterialAccessScore(materialsAccessed, materialsAvailable)`
- `calculateAssignmentSubmissionScore(assignmentsSubmitted, assignmentsDue)`
- `calculateEffectiveWeights(indicatorStatuses, configuredWeights)`
- `calculateOverallScore(indicatorResults, configuredWeights)`
- `classifyOverallScore(overallScore, boundaries)`
- `generateStudentClassification(activityRecord, config)`

Example indicator result:
```json
{
  "status": "CALCULATED",
  "score": 80,
  "reason": "Last recorded activity was 5 days before the end of the monitoring period."
}
```

Indicator statuses: `CALCULATED`, `NOT_APPLICABLE`, `INSUFFICIENT_DATA`.

Final classifications: `ACTIVE`, `REQUIRING_ATTENTION`, `INACTIVE`, `INSUFFICIENT_DATA`.

Engineering rules:
- Never coerce null/undefined to zero.
- Validate denominator > 0 before division.
- Validate counts and dates before scoring.
- Do not use clamping to conceal invalid source data.
- Calculate at full precision; display overall score to one decimal place; classify using unrounded value.
- Make ranges inclusive, gap-free and non-overlapping.
- Same inputs and same config must always produce same result.
- Store input reference and config snapshot/version.

## 9. REST API outline

Prefix: `/api/v1`.

**Auth**
- `POST /auth/login`
- `POST /auth/register` (only if enabled)
- `GET /auth/me`

**Courses**
- `GET /courses`
- `POST /courses`
- `GET /courses/:courseId`
- `PATCH /courses/:courseId`
- `DELETE /courses/:courseId` (prefer archive if historical data exists)

**Students/enrolments**
- `GET /courses/:courseId/students`
- `POST /students`
- `GET /students/:studentId`
- `PATCH /students/:studentId`
- `POST /courses/:courseId/enrollments`
- `PATCH /enrollments/:enrollmentId`

**Imports**
- `POST /courses/:courseId/imports/preview`
- `POST /courses/:courseId/imports/confirm`
- `GET /courses/:courseId/imports`
- `GET /courses/:courseId/imports/:importId`

**Configuration**
- `GET /courses/:courseId/classification-config`
- `POST /courses/:courseId/classification-config`
- `GET /courses/:courseId/classification-config/versions`

**Results**
- `POST /courses/:courseId/classifications/generate`
- `GET /courses/:courseId/classification-results`
- `GET /courses/:courseId/classification-results/:resultId`
- `GET /courses/:courseId/dashboard?periodStart=&periodEnd=`

Document request/response schemas, validation errors, status codes and authentication in Swagger.

## 10. Non-functional requirements

**Security:** password hashing, JWT expiry, backend ownership checks, validation/sanitisation, upload limits, environment secrets, rate limiting on auth, secure CORS, no sensitive values in logs.

**Performance:** pagination, useful MongoDB indexes, avoid loading all records in browser, efficient scoring for prototype-sized datasets.

**Reliability:** validate before persistence, duplicate import protection, preserve history and config versions, record timestamps.

**Usability/accessibility:** clear navigation, loading/empty/error/success states, keyboard support, visible focus, labels with colours, sufficient contrast.

**Maintainability:** modular services, pure scoring logic, consistent API contracts, setup docs and meaningful Git commits.

## 11. Test plan and acceptance criteria

### Calculation tests
| Scenario | Inputs | Expected |
|---|---|---|
| High activity | 90, 80, 100; weights 30/30/40 | 91, Active |
| Moderate | 60, 50, 60 | 57, Requiring Attention |
| Low | 20, 20, 30 | 24, Inactive |
| Boundary | 39.99 | Inactive |
| Boundary | 40 | Requiring Attention |
| Boundary | 69.99 | Requiring Attention |
| Boundary | 70 | Active |
| Maximum | 100, 100, 100 | 100, Active |
| Missing required indicator | One Insufficient Data | Insufficient Data |
| Assignment N/A | Login/material calculated | Reweight remaining 50/50 |
| All N/A | All three N/A | Insufficient Data / no classifiable activity |
| Invalid counts | Accessed > available | Validation error |
| Invalid period | End before start | Validation error |

### Indicator tests
- Last activity: 2 days=100; 5=80; 10=60; 18=30; 25=0; missing date=Insufficient Data.
- Materials: 8/10=80; 5/10=50; 0/10 with complete records=0; no available materials=N/A; incomplete logs=Insufficient Data.
- Assignments: 3/4=75; 0/4 with complete records=0; no eligible assignments due=N/A; incomplete records=Insufficient Data; not-yet-due assignments excluded.

### Integration tests
- Unauthenticated request rejected.
- Lecturer A cannot access Lecturer B's course.
- Course/student/enrolment CRUD works.
- Duplicate enrolment prevented.
- Invalid CSV rejected with row-level details.
- Valid CSV preview and import works.
- Duplicate import safely detected.
- Classification results persist.
- Config changes create a new version.
- Historical results retain original config.
- API response schemas match Swagger.

### Frontend acceptance
- Lecturer can complete the main workflow.
- Dashboard counts match persisted results.
- Search/filter/sort/pagination work for selected course and period.
- Student detail shows scores, statuses, evidence and config version.
- Missing data is visibly distinct.
- Core workflow remains usable on smaller screens.

For Chapter Four evidence, capture real screenshots, sample CSV, import outcome, expected-vs-actual test results, calculation examples, data validation outcomes and usability feedback if collected. Never invent successful test outcomes.

## 12. Delivery plan

**Phase 0 — Foundation**
- Inspect repository.
- Set up React client and Express server.
- Connect MongoDB.
- Add environment example, health check, base design tokens and README.
- Exit: client/server run; database connects; no secrets committed.

**Phase 1 — Authentication and shell**
- Login, JWT middleware, protected routes, navigation shell, sign out.
- Exit: unauthenticated users cannot access private APIs/screens.

**Phase 2 — Courses, students, enrolments**
- CRUD, course workspace, ownership, uniqueness and pagination.
- Exit: lecturer creates course, adds students and enrols them.

**Phase 3 — CSV import**
- Template, upload, preview, validation, confirm, history and duplicate protection.
- Exit: valid data imports; invalid rows explained; missing data preserved.

**Phase 4 — Configuration and scoring**
- Default settings, course-level settings, validation, versioning, scoring engine and unit tests.
- Exit: calculation tests pass; historical results immutable.

**Phase 5 — Classification and dashboard**
- Generate results, summary cards, student table, filters and evidence view.
- Exit: counts match results; every classification is explainable.

**Phase 6 — Testing and hardening**
- Integration/access tests, usability, responsive fixes, Swagger, README and evidence.
- Exit: critical workflows pass and limitations are documented.

## 13. Open decisions — ask before making assumptions

1. Is matriculation number unique globally or only within an institution/lecturer context?
2. Should lecturers self-register or use seeded accounts for the prototype?
3. Can lecturers select any monitoring period or use presets?
4. What timezone should be assumed for timestamps without timezone information?
5. Does the source provide material/assignment event IDs and dates, or only aggregate counts? **Decided (Section 32.2): aggregate counts only for the prototype.**
6. Should re-running a classification create a new result revision? Recommended: retain revisions for traceability.
7. Is CSV export essential for the first demonstrable release or a later enhancement? **Decided: include results CSV export for the prototype release.**

---

# 14. MASTER PROMPT FOR CURSOR

You are the lead full-stack engineer implementing the Student Engagement Dashboard. Read `docs/PRD_AND_TECHNICAL_PLAN.md` completely before coding. Treat it as the product source of truth.

**Non-negotiable constraints**
- Use React.js, Node.js, Express.js, MongoDB, REST, JWT and Swagger/OpenAPI.
- Do not change the stack without explicit approval.
- The prototype is standalone and imports structured/simulated LMS data through CSV. Do not claim or build live LMS integration in this release.
- Use exactly the three approved indicators.
- Preserve default weights 30/30/40, recency bands and classification boundaries from the PRD.
- Never turn missing data into zero.
- Distinguish zero activity, Not Applicable and Insufficient Data.
- Exclude Not Applicable indicators and proportionally renormalise remaining weights.
- Default to final Insufficient Data when a required indicator is incomplete.
- Preserve immutable configuration versions and historical result snapshots.
- Enforce lecturer/course ownership on the backend.
- Use the specified blue and sunshine-yellow brand palette, separate indicator-category colours and classification status colours.
- Do not add prediction, machine learning, dropout scoring, automated messaging or other out-of-scope features.

**First response — planning only**
1. Inspect the existing repository and report its structure.
2. Read this PRD.
3. Identify dependencies and potential conflicts.
4. Propose a detailed Phase 0 plan with files/modules to create or change.
5. Identify assumptions requiring my decision.
6. Do not write code until I approve the Phase 0 plan.

**After approval, for each phase**
1. State the scope and files to be changed.
2. Implement one complete vertical slice.
3. Add server-side validation, errors and frontend loading/empty/success states.
4. Add/update tests.
5. Run relevant tests and report actual results.
6. Update README and API documentation.
7. Summarise completed work, remaining work and decisions requiring approval.

**Engineering standards**
- Keep route handlers thin; put business logic in services.
- Implement scoring as pure deterministic functions.
- Validate all data server-side.
- Hash passwords; use JWT expiry and environment variables.
- Add MongoDB indexes and pagination.
- Use consistent API response/error formats.
- Do not expose secrets, password hashes or stack traces.
- Do not fabricate event records from aggregates.
- Do not claim tests passed unless they were run.
- Do not make silent decisions that affect scoring, access control, data retention or historical reproducibility.

**Visual direction**
- Primary blue `#2563EB`; hover `#1D4ED8`; brand tint `#EFF6FF`; accent `#FACC15`.
- Background `#F8FAFC`; surfaces `#FFFFFF`; text `#0F172A`; secondary text `#64748B`.
- Last activity blue `#3976B9`; materials violet `#7656A6`; assignment teal `#23877B`.
- Active green `#267A52`; Requiring Attention amber `#A96A12`; Inactive red `#B43B45`; Insufficient Data slate `#667085`; Not Applicable grey `#85818A`.
- Use pale tints and restrained accents. Always pair colours with text labels and ensure accessible contrast.

Begin by inspecting the repository and presenting the Phase 0 plan. Do not implement until I approve.

---

# 32. Prototype CSV Import Templates – Course Enrolments and Activity Data

This section defines the CSV import structures required for the current prototype. These imports simulate the data that would ordinarily be retrieved automatically from an integrated Learning Management System (LMS).

There are two separate CSV import processes:

1. Course, Student and Enrolment Import.
2. Student Activity Import.

They serve different purposes and must not be combined into one import workflow.

## 32.1 Course, Student and Enrolment Import

The first CSV template is used to populate courses, student identities and their course enrolment relationships.

The CSV must contain exactly four columns:

| Column | Field Name | Description |
|---|---|---|
| A | `courseCode` | Unique course code, e.g. CSC101. |
| B | `courseName` | Name of the course. |
| C | `studentIdentifier` | Unique institutional identifier for the student. |
| D | `studentName` | Student's full name. |

### Example

| courseCode | courseName | studentIdentifier | studentName |
|---|---|---|---|
| CSC101 | Introduction to Computing | MVA001 | Ada Student |
| CSC101 | Introduction to Computing | MVA002 | John Student |
| MTH101 | General Mathematics | MVA001 | Ada Student |

### Important business rules

- Each row represents a student enrolled in a particular course.
- A course may appear in multiple rows because it can have multiple students.
- A student may appear in multiple courses.
- The system must maintain one student identity across multiple courses.
- Student identity must be matched using `studentIdentifier`, not the student's name alone.
- Course identity must be matched using `courseCode`.
- Duplicate course enrolments must be detected and handled safely.
- Re-importing the same CSV should not create duplicate courses, students or enrolments.
- The system must validate the CSV before committing the import.
- Invalid records must be clearly identified, with row-level error messages.

**Important:** This import is responsible for establishing the course structure and student-course relationships. It must not be confused with the activity import.

## 32.2 Student Activity Import

The second CSV template is used to import activity records for students who are already enrolled in a selected course.

The activity CSV must contain exactly nine columns:

| Column | Field Name | Description |
|---|---|---|
| A | `studentIdentifier` | Unique student identifier. |
| B | `studentName` | Student's full name. |
| C | `lastLearningActivityAt` | Timestamp of the student's most recent qualifying learning activity. Qualifying interactions include lecture viewing, instructional video watching, quiz attempts, discussion forum participation and course survey participation. The dashboard stores this timestamp only and does not store which activity produced it. Login alone does not qualify. A missing timestamp is Insufficient Data, not zero. |
| D | `learningMaterialsAvailable` | Learning materials available in the monitoring period. |
| E | `learningMaterialsCompleted` | Learning materials with an explicit LMS completion status. |
| F | `assignmentsDue` | Number of eligible assignments whose deadlines passed during the monitoring period. |
| G | `assignmentsSubmitted` | Number of eligible assignments submitted by the student. |
| H | `monitoringPeriodStart` | Start date of the monitoring period. |
| I | `monitoringPeriodEnd` | End date of the monitoring period. |

### Removed fields

The previous activity template contained two additional columns:

- `materialAccessEvents`
- `assignmentSubmissionEvents`

These have been removed because the current prototype's scoring calculations only require aggregate activity figures.

The simplified nine-column structure should be used throughout the import process, including the downloadable template, parser, validation and API mapping.

### Activity import business rules

- Activity imports must be associated with a selected course.
- Students must already exist and be enrolled in that course.
- Activity imports must not create new students or course enrolments.
- The system must validate student identifiers against existing course enrolments.
- The system must validate activity figures before accepting the import.
- The number of materials accessed must not exceed the number available.
- The number of assignments submitted must not exceed the number due.
- The system must distinguish missing data from zero activity.
- Users must be able to preview records and identify errors before confirming the import.

## 32.3 Standard Product Behaviour: LMS Integration vs Prototype CSV Import

An important architectural distinction must be maintained.

**In the current prototype:**

CSV imports are used to simulate LMS data ingestion because live LMS integration is outside the current development scope.

The prototype therefore supports:

- Course, student and enrolment import through the combined CSV template.
- Student activity import through the simplified nine-column CSV template.

**In the intended standard product:**

Lecturers should not be required to manually download templates, prepare spreadsheets or upload routine student activity records.

Instead, the application should retrieve and synchronise the following information from the connected LMS:

- Courses.
- Student identities.
- Course enrolments.
- Student login/activity records.
- Course material access records.
- Assignment submission records.

The LMS should remain the source of truth for these records.

## 32.4 Future-Proof Data Ingestion Architecture

Although CSV is used in the prototype, the backend should be structured to support future LMS integration without requiring a complete rewrite.

The recommended architecture is:

**CSV Import / Future LMS Connector → Data Validation → Data Normalisation → Internal Database → Classification Engine → Dashboard**

Both the CSV importer and future LMS connector should feed data into the same internal data model.

The classification engine must not depend directly on CSV column names or file-processing logic.

This ensures that introducing a live LMS integration in the future will not require rebuilding the dashboard, classification engine or underlying business logic.

## 32.5 Implementation Requirements for Cursor

Cursor should ensure that:

1. Both CSV templates are available for download within their respective import workflows.
2. Course/student/enrolment imports and activity imports remain separate.
3. Both imports support file validation and preview before submission.
4. Duplicate records are detected.
5. Student matching uses stable student identifiers.
6. Course matching uses course codes.
7. Import errors are communicated clearly.
8. Existing records are not silently overwritten.
9. The system maintains the distinction between zero activity, Not Applicable and Insufficient Data.
10. The backend architecture remains compatible with future LMS synchronisation.
11. Existing working functionality must be preserved while implementing these changes.

### What this addition achieves

CSV import is a temporary data-ingestion mechanism for the academic prototype, not the intended standard lecturer experience.

| Import process | What it establishes |
|---|---|
| Course/Student/Enrolment Import | Which courses exist, which students exist and which students belong to which courses. |
| Student Activity Import | What enrolled students have actually done within their courses. |

This distinction is important because the dashboard cannot correctly calculate student engagement without first knowing which students belong to which courses.
