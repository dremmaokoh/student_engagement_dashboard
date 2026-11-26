import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import ContentSkeleton, { SkeletonBar } from "../components/common/ContentSkeleton.jsx";
import { skeletonColumns } from "../lib/skeletonColumns.js";
import IndicatorGlyph from "../components/dashboard/IndicatorGlyph.jsx";
import IndicatorInfo from "../components/design/IndicatorInfo.jsx";
import { indicatorLabel } from "../lib/classifications.js";
import { activeIndicatorCount, activeWeightsTotalPercent, toPercentFraction } from "../lib/weights.js";
import { useApiAction } from "../hooks/useApiAction.js";
import { apiRequest } from "../services/api.js";

const INDICATOR_FIELDS = [
  {
    key: "lastActivity",
    inputId: "weightLastActivity",
    summary: "How recently the student performed a qualifying learning activity.",
  },
  {
    key: "materialAccess",
    inputId: "weightMaterial",
    summary: "Share of required learning items completed in the LMS.",
  },
  {
    key: "assignmentSubmission",
    inputId: "weightAssignment",
    summary: "Share of eligible assignments submitted during the monitoring period.",
  },
];

function emptyWeightForm() {
  return {
    lastActivity: 30,
    materialAccess: 30,
    assignmentSubmission: 40,
    activeIndicators: { lastActivity: true, materialAccess: true, assignmentSubmission: true },
    changeNote: "",
  };
}

export default function SettingsPage() {
  const run = useApiAction();
  const [weights, setWeights] = useState(null);
  const [courses, setCourses] = useState([]);
  const [weightForm, setWeightForm] = useState(emptyWeightForm());
  const [error, setError] = useState("");
  const [weightError, setWeightError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [courseFilter, setCourseFilter] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    setWeights(null);
    setCourses([]);
    try {
      const [weightResult, courseResult] = await Promise.all([
        apiRequest("/api/v1/settings/indicator-weights"),
        apiRequest("/api/v1/settings/course-classification"),
      ]);
      const active = weightResult.data.weights;
      setWeights(active);
      const selection = active.activeIndicators || {};
      setWeightForm({
        lastActivity: toPercentFraction(active.weights.lastActivity),
        materialAccess: toPercentFraction(active.weights.materialAccess),
        assignmentSubmission: toPercentFraction(active.weights.assignmentSubmission),
        activeIndicators: {
          lastActivity: selection.lastActivity !== false,
          materialAccess: selection.materialAccess !== false,
          assignmentSubmission: selection.assignmentSubmission !== false,
        },
        changeNote: "",
      });
      setCourses(courseResult.data.courses);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const activeCount = activeIndicatorCount(weightForm.activeIndicators);
  const weightTotal = useMemo(
    () => activeWeightsTotalPercent(weightForm, weightForm.activeIndicators),
    [weightForm],
  );
  const selectionValid = activeCount >= 2;
  const weightsValid = selectionValid && weightTotal !== null && Math.abs(weightTotal - 100) < 0.01;

  const filteredCourses = useMemo(() => {
    const q = courseFilter.trim().toLowerCase();
    if (!q) {
      return courses;
    }
    return courses.filter(
      (course) =>
        String(course.code).toLowerCase().includes(q) || String(course.name).toLowerCase().includes(q),
    );
  }, [courses, courseFilter]);

  async function onSaveWeights(event) {
    event.preventDefault();
    if (!selectionValid) {
      setWeightError("At least two indicators must remain active.");
      return;
    }
    if (!weightsValid) {
      setWeightError("Active indicator weights must total exactly 100%.");
      return;
    }
    setSaving(true);
    setWeightError("");
    try {
      await run(
        () =>
          apiRequest("/api/v1/settings/indicator-weights", {
            method: "POST",
            body: {
              weights: {
                lastActivity: Number(weightForm.lastActivity),
                materialAccess: Number(weightForm.materialAccess),
                assignmentSubmission: Number(weightForm.assignmentSubmission),
              },
              activeIndicators: weightForm.activeIndicators,
              changeNote: weightForm.changeNote,
            },
          }),
        { success: "Indicator weights saved.", rethrow: true },
      );
      await load();
    } catch (err) {
      setWeightError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="content settings-hub">
      <header className="content-header">
        <h1>Settings</h1>
        <p className="lede">Manage global activity weights and per-course classification rules.</p>
      </header>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      <section className="card settings-weights-card" aria-labelledby="weights-heading">
        <h2 id="weights-heading">Activity indicator weights</h2>
        <p className="panel-desc">
          Choose two or three indicators for every course. Only active indicators are scored, and their weights must
          total 100%. An excluded indicator is left out of the configuration. That is separate from Not Applicable and
          from Insufficient Data, which apply only to indicators that are switched on.
        </p>

        {loading ? (
          <ContentSkeleton loading label="Loading indicator weights…">
            <div className="settings-weights-form" aria-hidden="true">
              <div className="settings-weight-grid">
                <SkeletonBar height={40} />
                <SkeletonBar height={40} />
                <SkeletonBar height={40} />
              </div>
              <SkeletonBar width="32%" />
              <div className="settings-weights-footer">
                <SkeletonBar width="42%" />
                <SkeletonBar height={40} />
                <SkeletonBar width="24%" height={40} />
              </div>
            </div>
          </ContentSkeleton>
        ) : (
          <form className="settings-weights-form" onSubmit={onSaveWeights}>
            <div className="settings-weight-grid">
              {INDICATOR_FIELDS.map((field) => {
                const active = weightForm.activeIndicators[field.key] !== false;
                return (
                  <div
                    key={field.key}
                    className={active ? "settings-weight-field" : "settings-weight-field is-excluded"}
                  >
                    <span className="settings-weight-heading">
                      <IndicatorGlyph indicatorKey={field.key} />
                      <span className="settings-weight-name">
                        {indicatorLabel(field.key)}
                        <IndicatorInfo indicatorKey={field.key} />
                      </span>
                    </span>
                    <p className="settings-weight-summary">{field.summary}</p>
                    <label className="settings-weight-toggle">
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={(event) =>
                          setWeightForm({
                            ...weightForm,
                            activeIndicators: {
                              ...weightForm.activeIndicators,
                              [field.key]: event.target.checked,
                            },
                          })
                        }
                      />
                      <span>{active ? "Active" : "Excluded"}</span>
                    </label>
                    <label htmlFor={field.inputId}>Weight (%)</label>
                    <input
                      id={field.inputId}
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={weightForm[field.key]}
                      disabled={!active}
                      onChange={(event) => setWeightForm({ ...weightForm, [field.key]: event.target.value })}
                      required={active}
                    />
                  </div>
                );
              })}
            </div>

            {!selectionValid ? (
              <p className="form-error" role="alert">
                At least two indicators must remain active.
              </p>
            ) : null}

            <p className={`settings-weight-total ${weightsValid ? "settings-weight-total-ok" : "settings-weight-total-bad"}`}>
              Active indicator weight total: {weightTotal ?? "—"}% / 100%.
              {selectionValid && !weightsValid ? " Active weights must total 100%." : ""}
            </p>

            <div className="settings-weights-footer">
              <label htmlFor="weightChangeNote">Change note (optional)</label>
              <input
                id="weightChangeNote"
                type="text"
                value={weightForm.changeNote}
                onChange={(event) => setWeightForm({ ...weightForm, changeNote: event.target.value })}
                placeholder="Why these weights changed"
              />

              {weightError ? (
                <p className="form-error" role="alert">
                  {weightError}
                </p>
              ) : null}

              <button type="submit" className="primary-btn settings-weights-save" disabled={saving || !weightsValid}>
                {saving ? "Saving…" : "Save weights"}
              </button>
            </div>
            {weights ? (
              <p className="muted settings-weight-meta">Active global weights: version {weights.version}</p>
            ) : null}
          </form>
        )}

        <details className="settings-weight-example">
          <summary>How the weighted score is calculated</summary>
          <p className="panel-desc">
            Final score = the sum of each active indicator score multiplied by its weight. Excluded indicators are
            omitted. If an active indicator is Not Applicable, the remaining active weights are renormalised. An active
            indicator with Insufficient Data blocks the final score.
          </p>
          <table className="data-table settings-example-table">
            <thead>
              <tr>
                <th className="col-serial">S/N</th>
                <th>Indicator</th>
                <th>Score</th>
                <th>Weight</th>
                <th>Contribution</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="col-serial">1</td>
                <td>{indicatorLabel("lastActivity")}</td>
                <td>80</td>
                <td>30%</td>
                <td>24</td>
              </tr>
              <tr>
                <td className="col-serial">2</td>
                <td>{indicatorLabel("materialAccess")}</td>
                <td>90</td>
                <td>30%</td>
                <td>27</td>
              </tr>
              <tr>
                <td className="col-serial">3</td>
                <td>Assignment submission</td>
                <td>75</td>
                <td>40%</td>
                <td>30</td>
              </tr>
              <tr>
                <td className="col-serial" aria-hidden="true" />
                <th scope="row" colSpan={3}>
                  Total
                </th>
                <td>
                  <strong>81</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </details>
      </section>

      <section className="card table-card" aria-labelledby="course-config-heading">
        <h2 id="course-config-heading">Course classification settings</h2>
        <p className="panel-desc">
          Each course has its own last-activity bands and classification boundaries. Configure them here — the Courses
          workspace shows a read-only summary.
        </p>

        <div className="settings-course-filter">
          <label htmlFor="courseConfigSearch">Search courses</label>
          <input
            id="courseConfigSearch"
            type="search"
            value={courseFilter}
            onChange={(event) => setCourseFilter(event.target.value)}
            placeholder="Course code or name…"
          />
        </div>

        <ContentSkeleton
          loading={loading}
          variant="table"
          columns={skeletonColumns("settingsCourses")}
          rows={5}
          tableClassName="settings-courses-table"
          label="Loading course classification settings…"
        />

        {!loading && filteredCourses.length === 0 ? (
          <p className="lede">No courses match. Create or import a course from the Courses page first.</p>
        ) : null}

        {!loading && filteredCourses.length > 0 ? (
          <div className="table-card">
            <table className="data-table settings-courses-table">
              <thead>
                <tr>
                  <th className="col-serial">S/N</th>
                  <th>Course code</th>
                  <th>Course name</th>
                  <th>Configuration status</th>
                  <th className="students-col-action">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredCourses.map((course, index) => (
                  <tr key={course.id}>
                    <td className="col-serial">{index + 1}</td>
                    <td>{course.code}</td>
                    <td>{course.name}</td>
                    <td>
                      <span
                        className={
                          course.configurationStatus === "CONFIGURED" ? "badge badge-ok" : "badge badge-na"
                        }
                      >
                        {course.configurationStatus === "CONFIGURED" ? "Configured" : "Not configured"}
                      </span>
                    </td>
                    <td className="students-col-action">
                      <Link className="text-btn" to={`/settings/classification/${course.id}`}>
                        Configure
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </main>
  );
}