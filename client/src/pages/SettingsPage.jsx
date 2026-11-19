import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import IndicatorGlyph from "../components/dashboard/IndicatorGlyph.jsx";
import { LAST_RECORDED_LOGIN_LABEL } from "../lib/classifications.js";
import { toPercentFraction, weightsTotalPercent } from "../lib/weights.js";
import { apiRequest } from "../services/api.js";

function emptyWeightForm() {
  return { lastActivity: 30, materialAccess: 30, assignmentSubmission: 40, changeNote: "" };
}

export default function SettingsPage() {
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
    try {
      const [weightResult, courseResult] = await Promise.all([
        apiRequest("/api/v1/settings/indicator-weights"),
        apiRequest("/api/v1/settings/course-classification"),
      ]);
      const active = weightResult.data.weights;
      setWeights(active);
      setWeightForm({
        lastActivity: toPercentFraction(active.weights.lastActivity),
        materialAccess: toPercentFraction(active.weights.materialAccess),
        assignmentSubmission: toPercentFraction(active.weights.assignmentSubmission),
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

  const weightTotal = useMemo(
    () => weightsTotalPercent(weightForm.lastActivity, weightForm.materialAccess, weightForm.assignmentSubmission),
    [weightForm],
  );
  const weightsValid = weightTotal !== null && Math.abs(weightTotal - 100) < 0.01;

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
    if (!weightsValid) {
      setWeightError("Weights must total exactly 100%.");
      return;
    }
    setSaving(true);
    setWeightError("");
    try {
      await apiRequest("/api/v1/settings/indicator-weights", {
        method: "POST",
        body: {
          weights: {
            lastActivity: Number(weightForm.lastActivity),
            materialAccess: Number(weightForm.materialAccess),
            assignmentSubmission: Number(weightForm.assignmentSubmission),
          },
          changeNote: weightForm.changeNote,
        },
      });
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
          These three weights apply to every course. They control how much each indicator contributes to the overall
          participation score. Not Applicable indicators are excluded and remaining weights are renormalised during
          calculation (never treated as zero).
        </p>

        {loading ? <p className="lede" role="status">Loading weights…</p> : null}

        {!loading ? (
          <form className="settings-weights-form" onSubmit={onSaveWeights}>
            <div className="settings-weight-grid">
              <label className="settings-weight-field" htmlFor="weightLastActivity">
                <IndicatorGlyph indicatorKey="lastActivity" /> {LAST_RECORDED_LOGIN_LABEL}
                <input
                  id="weightLastActivity"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={weightForm.lastActivity}
                  onChange={(event) => setWeightForm({ ...weightForm, lastActivity: event.target.value })}
                  required
                />
              </label>
              <label className="settings-weight-field" htmlFor="weightMaterial">
                <IndicatorGlyph indicatorKey="materialAccess" /> Course material access
                <input
                  id="weightMaterial"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={weightForm.materialAccess}
                  onChange={(event) => setWeightForm({ ...weightForm, materialAccess: event.target.value })}
                  required
                />
              </label>
              <label className="settings-weight-field" htmlFor="weightAssignment">
                <IndicatorGlyph indicatorKey="assignmentSubmission" /> Assignment submission
                <input
                  id="weightAssignment"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={weightForm.assignmentSubmission}
                  onChange={(event) => setWeightForm({ ...weightForm, assignmentSubmission: event.target.value })}
                  required
                />
              </label>
            </div>

            <p className={`settings-weight-total ${weightsValid ? "settings-weight-total-ok" : "settings-weight-total-bad"}`}>
              Total: {weightTotal ?? "—"}% {weightsValid ? "" : "(must equal 100%)"}
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
        ) : null}

        <details className="settings-weight-example">
          <summary>How the weighted score is calculated</summary>
          <p className="panel-desc">
            Final score = (activity score × activity weight) + (material score × material weight) + (assignment score ×
            assignment weight), using weights as decimals.
          </p>
          <table className="data-table settings-example-table">
            <thead>
              <tr>
                <th>Indicator</th>
                <th>Score</th>
                <th>Weight</th>
                <th>Contribution</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{LAST_RECORDED_LOGIN_LABEL}</td>
                <td>80</td>
                <td>30%</td>
                <td>24</td>
              </tr>
              <tr>
                <td>Material access</td>
                <td>90</td>
                <td>30%</td>
                <td>27</td>
              </tr>
              <tr>
                <td>Assignment submission</td>
                <td>75</td>
                <td>40%</td>
                <td>30</td>
              </tr>
              <tr>
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

        {loading ? <p className="lede">Loading courses…</p> : null}
        {!loading && filteredCourses.length === 0 ? (
          <p className="lede">No courses match. Create or import a course from the Courses page first.</p>
        ) : null}

        {!loading && filteredCourses.length > 0 ? (
          <div className="table-card">
            <table className="data-table settings-courses-table">
              <thead>
                <tr>
                  <th>Course code</th>
                  <th>Course name</th>
                  <th>Configuration status</th>
                  <th className="students-col-action">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredCourses.map((course) => (
                  <tr key={course.id}>
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