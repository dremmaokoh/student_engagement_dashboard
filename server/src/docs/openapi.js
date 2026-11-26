export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Student Engagement Dashboard API",
    version: "0.6.0",
    description:
      "Lecturer-facing prototype API. Private routes require a JWT. Missing activity values stay null and are never coerced to zero.",
  },
  servers: [{ url: "/api/v1", description: "Versioned API" }],
  tags: [
    { name: "Health" },
    { name: "Auth" },
    { name: "Courses" },
    { name: "Students" },
    { name: "Imports" },
    { name: "Configuration" },
    { name: "Classifications" },
    { name: "Dashboard" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
    schemas: {
      Error: {
        type: "object",
        properties: {
          error: { type: "string" },
          message: { type: "string" },
        },
      },
      GlobalIndicatorConfigurationInput: {
        type: "object",
        required: ["weights"],
        properties: {
          weights: {
            type: "object",
            description: "Percent values (30) or fractions (0.3). Only active indicators are summed.",
            required: ["lastActivity", "materialAccess", "assignmentSubmission"],
            properties: {
              lastActivity: { type: "number", minimum: 0 },
              materialAccess: { type: "number", minimum: 0 },
              assignmentSubmission: { type: "number", minimum: 0 },
            },
          },
          activeIndicators: {
            type: "object",
            description: "Omit to keep all three active. At least two must be true.",
            properties: {
              lastActivity: { type: "boolean" },
              materialAccess: { type: "boolean" },
              assignmentSubmission: { type: "boolean" },
            },
          },
          changeNote: { type: "string", maxLength: 500 },
        },
      },
      User: {
        type: "object",
        properties: {
          id: { type: "string" },
          fullName: { type: "string" },
          email: { type: "string" },
          role: { type: "string", example: "lecturer" },
        },
      },
      Health: {
        type: "object",
        required: ["status", "db", "mail"],
        properties: {
          status: { type: "string", enum: ["ok", "degraded"] },
          db: { type: "string", enum: ["connected", "disconnected"] },
          mail: {
            type: "string",
            enum: ["smtp", "resend", "not_configured"],
            description:
              "Configured mail transport only; it does not indicate whether the mail provider is reachable.",
          },
        },
      },
    },
  },
  paths: {
    "/health": {
      get: {
        tags: ["Health"],
        summary: "API and database status",
        responses: {
          200: {
            description: "Health payload",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Health" } } },
          },
        },
      },
    },
    "/auth/registration": {
      get: {
        tags: ["Auth"],
        summary: "Whether self-registration is enabled",
        responses: { 200: { description: "Registration flag" } },
      },
    },
    "/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Create a lecturer account",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["fullName", "email", "password"],
                properties: {
                  fullName: { type: "string" },
                  email: { type: "string" },
                  password: { type: "string", minLength: 8 },
                },
              },
            },
          },
        },
        responses: {
          201: { description: "Token and user" },
          403: { description: "Registration disabled" },
          409: { description: "Duplicate email" },
        },
      },
    },
    "/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Issue a JWT",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string" },
                  password: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Token and user" },
          401: { description: "Invalid email or password" },
        },
      },
    },
    "/auth/me": {
      get: {
        tags: ["Auth"],
        security: [{ bearerAuth: [] }],
        summary: "Current lecturer",
        responses: {
          200: { description: "User" },
          401: { description: "Authentication required" },
        },
      },
    },
    "/auth/forgot-password": {
      post: {
        tags: ["Auth"],
        summary: "Start a password reset",
        responses: { 200: { description: "Generic acknowledgement" } },
      },
    },
    "/auth/reset-password": {
      post: {
        tags: ["Auth"],
        summary: "Set a new password with a one-time token",
        responses: { 200: { description: "Password updated" } },
      },
    },
    "/courses": {
      get: {
        tags: ["Courses"],
        security: [{ bearerAuth: [] }],
        summary: "List the lecturer's courses",
        parameters: [
          { name: "page", in: "query", schema: { type: "integer" } },
          { name: "limit", in: "query", schema: { type: "integer" } },
          { name: "q", in: "query", schema: { type: "string" } },
          { name: "includeArchived", in: "query", schema: { type: "string" } },
        ],
        responses: { 200: { description: "Paginated courses" }, 401: { description: "Unauthorized" } },
      },
      post: {
        tags: ["Courses"],
        security: [{ bearerAuth: [] }],
        summary: "Create a course",
        responses: { 201: { description: "Created" } },
      },
    },
    "/courses/{courseId}": {
      get: {
        tags: ["Courses"],
        security: [{ bearerAuth: [] }],
        summary: "Course detail (owner only)",
        parameters: [{ name: "courseId", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Course" }, 404: { description: "Not found" } },
      },
      patch: {
        tags: ["Courses"],
        security: [{ bearerAuth: [] }],
        summary: "Update a course",
        parameters: [{ name: "courseId", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Updated" } },
      },
      delete: {
        tags: ["Courses"],
        security: [{ bearerAuth: [] }],
        summary: "Archive a course",
        parameters: [{ name: "courseId", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Archived" } },
      },
    },
    "/students": {
      get: {
        tags: ["Students"],
        security: [{ bearerAuth: [] }],
        summary: "Student directory",
        parameters: [
          { name: "q", in: "query", schema: { type: "string" } },
          { name: "page", in: "query", schema: { type: "integer" } },
          { name: "limit", in: "query", schema: { type: "integer" } },
          {
            name: "availableForCourse",
            in: "query",
            schema: { type: "string" },
            description: "When set, returns students the lecturer can still enrol in this course, one page at a time.",
          },
        ],
        responses: { 200: { description: "Paginated students" } },
      },
      post: {
        tags: ["Students"],
        security: [{ bearerAuth: [] }],
        summary: "Create a student profile",
        responses: { 201: { description: "Created" }, 409: { description: "Duplicate matriculation number" } },
      },
    },
    "/students/{studentId}/communications": {
      get: {
        tags: ["Students"],
        security: [{ bearerAuth: [] }],
        summary: "Message history for a student",
        parameters: [
          { name: "studentId", in: "path", required: true, schema: { type: "string" } },
          { name: "page", in: "query", schema: { type: "integer" } },
          { name: "limit", in: "query", schema: { type: "integer" } },
        ],
        responses: { 200: { description: "Paginated communications" } },
      },
      post: {
        tags: ["Students"],
        security: [{ bearerAuth: [] }],
        summary: "Send email to a student",
        parameters: [{ name: "studentId", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          201: { description: "Message accepted by mail provider" },
          502: { description: "Send failed" },
          503: { description: "Mail not configured" },
        },
      },
    },
    "/students/{studentId}": {
      get: {
        tags: ["Students"],
        security: [{ bearerAuth: [] }],
        summary: "Student profile",
        parameters: [{ name: "studentId", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Student" } },
      },
      patch: {
        tags: ["Students"],
        security: [{ bearerAuth: [] }],
        summary: "Update a student profile",
        parameters: [{ name: "studentId", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Updated" } },
      },
    },
    "/courses/{courseId}/students": {
      get: {
        tags: ["Students"],
        security: [{ bearerAuth: [] }],
        summary: "Enrolments for a course",
        parameters: [{ name: "courseId", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Enrolments" } },
      },
    },
    "/courses/{courseId}/students/template": {
      get: {
        tags: ["Students"],
        security: [{ bearerAuth: [] }],
        summary: "Download a course student import template",
        parameters: [{ name: "courseId", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "text/csv" } },
      },
    },
    "/courses/{courseId}/students/import/preview": {
      post: {
        tags: ["Students"],
        security: [{ bearerAuth: [] }],
        summary: "Preview a course student CSV import",
        parameters: [{ name: "courseId", in: "path", required: true, schema: { type: "string" } }],
        responses: { 201: { description: "Preview with row-level duplicate and conflict errors" } },
      },
    },
    "/courses/{courseId}/students/import/confirm": {
      post: {
        tags: ["Students"],
        security: [{ bearerAuth: [] }],
        summary: "Confirm a course student CSV import",
        parameters: [{ name: "courseId", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Students created and enrolled" }, 409: { description: "ID or email conflict" } },
      },
    },
    "/courses/{courseId}/enrollments": {
      post: {
        tags: ["Students"],
        security: [{ bearerAuth: [] }],
        summary: "Enrol a student",
        parameters: [{ name: "courseId", in: "path", required: true, schema: { type: "string" } }],
        responses: { 201: { description: "Enrolled" }, 409: { description: "Duplicate active enrolment" } },
      },
    },
    "/courses/{courseId}/enrollments/bulk": {
      post: {
        tags: ["Students"],
        security: [{ bearerAuth: [] }],
        summary: "Enrol multiple existing students in a course",
        parameters: [{ name: "courseId", in: "path", required: true, schema: { type: "string" } }],
        responses: { 201: { description: "Bulk enrolment counts" } },
      },
    },
    "/enrollments/{enrollmentId}": {
      patch: {
        tags: ["Students"],
        security: [{ bearerAuth: [] }],
        summary: "Update enrolment status",
        parameters: [{ name: "enrollmentId", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Updated" } },
      },
    },
    "/courses/{courseId}/imports/template": {
      get: {
        tags: ["Imports"],
        security: [{ bearerAuth: [] }],
        summary: "Download the activity CSV template for the active indicators",
        parameters: [{ name: "courseId", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "text/csv" } },
      },
    },
    "/courses/{courseId}/imports/preview": {
      post: {
        tags: ["Imports"],
        security: [{ bearerAuth: [] }],
        summary: "Preview a CSV import",
        parameters: [{ name: "courseId", in: "path", required: true, schema: { type: "string" } }],
        responses: { 201: { description: "Preview with row-level errors" } },
      },
    },
    "/courses/{courseId}/imports/confirm": {
      post: {
        tags: ["Imports"],
        security: [{ bearerAuth: [] }],
        summary: "Confirm a previewed import",
        parameters: [{ name: "courseId", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Imported, skipped and rejected counts" } },
      },
    },
    "/courses/{courseId}/imports": {
      get: {
        tags: ["Imports"],
        security: [{ bearerAuth: [] }],
        summary: "Import history",
        parameters: [{ name: "courseId", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "History" } },
      },
    },
    "/courses/{courseId}/imports/{importId}": {
      get: {
        tags: ["Imports"],
        security: [{ bearerAuth: [] }],
        summary: "Import detail",
        parameters: [
          { name: "courseId", in: "path", required: true, schema: { type: "string" } },
          { name: "importId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { 200: { description: "Import" } },
      },
    },
    "/settings/indicator-weights": {
      get: {
        tags: ["Configuration"],
        security: [{ bearerAuth: [] }],
        summary: "Active global indicator selection and weights",
        description:
          "Seeds version 1 on first access: all three indicators active at 30%, 30% and 40%. Missing activeIndicators on an older version means all three are active.",
        responses: { 200: { description: "Active global configuration" } },
      },
      post: {
        tags: ["Configuration"],
        security: [{ bearerAuth: [] }],
        summary: "Save a new global indicator configuration version",
        description:
          "Does not overwrite earlier versions. At least two indicators must be active. The weights of active indicators must total 100%. Disabled indicator weights are stored but excluded from scoring.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/GlobalIndicatorConfigurationInput" },
            },
          },
        },
        responses: {
          201: { description: "New active version" },
          400: { description: "Fewer than two active indicators, or active weights do not total 100%" },
        },
      },
    },
    "/settings/indicator-weights/versions": {
      get: {
        tags: ["Configuration"],
        security: [{ bearerAuth: [] }],
        summary: "Global indicator configuration history",
        responses: { 200: { description: "Versions, newest first, including each version's activeIndicators" } },
      },
    },
    "/courses/{courseId}/classification-config": {
      get: {
        tags: ["Configuration"],
        security: [{ bearerAuth: [] }],
        summary: "Active classification config (seeds default v1)",
        parameters: [{ name: "courseId", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Active config" } },
      },
      post: {
        tags: ["Configuration"],
        security: [{ bearerAuth: [] }],
        summary: "Create an immutable new config version",
        parameters: [{ name: "courseId", in: "path", required: true, schema: { type: "string" } }],
        responses: { 201: { description: "New active version" }, 400: { description: "Invalid weights or bands" } },
      },
    },
    "/courses/{courseId}/classification-config/versions": {
      get: {
        tags: ["Configuration"],
        security: [{ bearerAuth: [] }],
        summary: "Config version history",
        parameters: [{ name: "courseId", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Versions" } },
      },
    },
    "/courses/{courseId}/classifications/generate": {
      post: {
        tags: ["Classifications"],
        security: [{ bearerAuth: [] }],
        summary: "Generate classifications for a monitoring period",
        parameters: [{ name: "courseId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["runName"],
                properties: {
                  runName: { type: "string", maxLength: 120, description: "Lecturer label for this classification run" },
                  monitoringPeriodStart: { type: "string", format: "date" },
                  monitoringPeriodEnd: { type: "string", format: "date" },
                },
              },
            },
          },
        },
        responses: { 201: { description: "Persisted results and counts" }, 400: { description: "Invalid period" } },
      },
    },
    "/dashboard/summary": {
      get: {
        tags: ["Dashboard"],
        security: [{ bearerAuth: [] }],
        summary: "Cross-course dashboard summary",
        parameters: [
          { name: "courseId", in: "query", schema: { type: "string", default: "all" } },
          { name: "periodScope", in: "query", schema: { type: "string", enum: ["latest", "fixed"] } },
          { name: "preset", in: "query", schema: { type: "string" } },
          { name: "periodStart", in: "query", schema: { type: "string", format: "date" } },
          { name: "periodEnd", in: "query", schema: { type: "string", format: "date" } },
        ],
        responses: { 200: { description: "Aggregated enrolment-result counts" } },
      },
    },
    "/dashboard/course-comparison": {
      get: {
        tags: ["Dashboard"],
        security: [{ bearerAuth: [] }],
        summary: "Course engagement comparison",
        parameters: [
          { name: "courseId", in: "query", schema: { type: "string", default: "all" } },
          { name: "periodScope", in: "query", schema: { type: "string", enum: ["latest", "fixed"] } },
          { name: "periodStart", in: "query", schema: { type: "string", format: "date" } },
          { name: "periodEnd", in: "query", schema: { type: "string", format: "date" } },
          { name: "sortBy", in: "query", schema: { type: "string" } },
        ],
        responses: { 200: { description: "Per-course counts" } },
      },
    },
    "/dashboard/trend": {
      get: {
        tags: ["Dashboard"],
        security: [{ bearerAuth: [] }],
        summary: "Historical classification trend by monitoring period",
        parameters: [
          { name: "courseId", in: "query", schema: { type: "string", default: "all" } },
          { name: "periodScope", in: "query", schema: { type: "string", enum: ["latest", "fixed"] } },
          { name: "periodStart", in: "query", schema: { type: "string", format: "date" } },
          { name: "periodEnd", in: "query", schema: { type: "string", format: "date" } },
        ],
        responses: { 200: { description: "Aggregated counts per monitoring period" } },
      },
    },
    "/dashboard/attention-students": {
      get: {
        tags: ["Dashboard"],
        security: [{ bearerAuth: [] }],
        summary: "Students requiring attention across courses",
        parameters: [
          { name: "courseId", in: "query", schema: { type: "string", default: "all" } },
          { name: "periodScope", in: "query", schema: { type: "string", enum: ["latest", "fixed"] } },
          { name: "periodStart", in: "query", schema: { type: "string", format: "date" } },
          { name: "periodEnd", in: "query", schema: { type: "string", format: "date" } },
          { name: "page", in: "query", schema: { type: "integer" } },
          { name: "limit", in: "query", schema: { type: "integer" } },
        ],
        responses: { 200: { description: "Inactive and requiring-attention enrolment results" } },
      },
    },
    "/courses/import-roster/template": {
      get: {
        tags: ["Courses"],
        security: [{ bearerAuth: [] }],
        summary: "Download course and enrolment CSV template",
        responses: { 200: { description: "CSV template" } },
      },
    },
    "/courses/import-roster/preview": {
      post: {
        tags: ["Courses"],
        security: [{ bearerAuth: [] }],
        summary: "Preview course and enrolment CSV import",
        responses: { 201: { description: "Preview summary" } },
      },
    },
    "/courses/import-roster/confirm": {
      post: {
        tags: ["Courses"],
        security: [{ bearerAuth: [] }],
        summary: "Confirm course and enrolment CSV import",
        responses: { 200: { description: "Import counts" } },
      },
    },
    "/courses/{courseId}/dashboard": {
      get: {
        tags: ["Classifications"],
        security: [{ bearerAuth: [] }],
        summary: "Course dashboard for a monitoring period",
        parameters: [
          { name: "courseId", in: "path", required: true, schema: { type: "string" } },
          { name: "periodStart", in: "query", required: true, schema: { type: "string", format: "date" } },
          { name: "periodEnd", in: "query", required: true, schema: { type: "string", format: "date" } },
          { name: "q", in: "query", schema: { type: "string" } },
          { name: "classification", in: "query", schema: { type: "string" } },
          { name: "sortBy", in: "query", schema: { type: "string" } },
          { name: "page", in: "query", schema: { type: "integer" } },
          { name: "limit", in: "query", schema: { type: "integer" } },
          { name: "runId", in: "query", schema: { type: "string" } },
          {
            name: "summary",
            in: "query",
            schema: { type: "string", enum: ["1"] },
            description: "When 1, return run counts and the latest import without a page of student results.",
          },
        ],
        responses: {
          200: {
            description:
              "Course dashboard payload: period, runId, counts, enrolledCount, paginated results, optional latestImport (most recent confirmed import in the period), and activityImportUsed (import batch linked to activity records in the displayed run—primary batch when multiple imports contributed, with linkedStudentCount and multipleImportSources).",
          },
        },
      },
    },
    "/courses/{courseId}/classification-runs": {
      get: {
        tags: ["Classifications"],
        security: [{ bearerAuth: [] }],
        summary: "Classification run history for a monitoring period",
        parameters: [
          { name: "courseId", in: "path", required: true, schema: { type: "string" } },
          { name: "periodStart", in: "query", required: true, schema: { type: "string", format: "date" } },
          { name: "periodEnd", in: "query", required: true, schema: { type: "string", format: "date" } },
        ],
        responses: {
          200: {
            description:
              "Immutable generate runs, plus enrolledCount and attentionPreview for the latest run in the response.",
          },
        },
      },
    },
    "/courses/{courseId}/classification-results": {
      get: {
        tags: ["Classifications"],
        security: [{ bearerAuth: [] }],
        summary: "Paginated results for the latest run",
        parameters: [
          { name: "courseId", in: "path", required: true, schema: { type: "string" } },
          { name: "periodStart", in: "query", required: true, schema: { type: "string", format: "date" } },
          { name: "periodEnd", in: "query", required: true, schema: { type: "string", format: "date" } },
        ],
        responses: { 200: { description: "Results page" } },
      },
    },
    "/courses/{courseId}/classification-results/export": {
      get: {
        tags: ["Classifications"],
        security: [{ bearerAuth: [] }],
        summary: "Export classification results as CSV",
        parameters: [
          { name: "courseId", in: "path", required: true, schema: { type: "string" } },
          { name: "periodStart", in: "query", required: true, schema: { type: "string", format: "date" } },
          { name: "periodEnd", in: "query", required: true, schema: { type: "string", format: "date" } },
          { name: "runId", in: "query", required: false, schema: { type: "string" } },
        ],
        responses: { 200: { description: "text/csv" } },
      },
    },
    "/courses/{courseId}/classification-results/{resultId}": {
      get: {
        tags: ["Classifications"],
        security: [{ bearerAuth: [] }],
        summary: "Evidence for one persisted result",
        parameters: [
          { name: "courseId", in: "path", required: true, schema: { type: "string" } },
          { name: "resultId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { 200: { description: "Result with snapshot" }, 404: { description: "Not found" } },
      },
    },
  },
};
