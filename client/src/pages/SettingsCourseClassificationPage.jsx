import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import LoadingState from "../components/common/LoadingState.jsx";
import IndicatorGlyph from "../components/dashboard/IndicatorGlyph.jsx";
import ClassificationBadge from "../components/design/ClassificationBadge.jsx";
import BackLink from "../components/layout/BackLink.jsx";
import { apiRequest } from "../services/api.js";

function emptyForm() {
  return {
    requiringAttentionMin: 40,
    activeMin: 70,
    changeNote: "",
    bands: [
      { minDays: 0, maxDays: 3, score: 100 },
      { minDays: 4, maxDays: 7, score: 80 },
      { minDays: 8, maxDays: 14, score: 60 },
      { minDays: 15, maxDays: 21, score: 30 },
      { minDays: 22, maxDays: "", score: 0 },
    ],
  };
}

function formFromConfig(config) {
  return {
    requiringAttentionMin: config.classificationBoundaries.requiringAttentionMin,
    activeMin: config.classificationBoundaries.activeMin,
    changeNote: "",
    bands: config.lastActivityBands.map((band) => ({
      minDays: band.minDays,
      maxDays: band.maxDays === null || band.maxDays === undefined ? "" : band.maxDays,
      score: band.score,
    })),
  };
}

export default function SettingsCourseClassificationPage() {
  const { courseId } = useParams();
  const [course, setCourse] = useState(null);
  const [config, setConfig] = useState(null);
  const [versions, setVersions] = useState([]);
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [courseResult, configResult, versionResult] = await Promise.all([
        apiRequest(`/api/v1/courses/${courseId}`),
        apiRequest(`/api/v1/courses/${courseId}/classification-config`),
        apiRequest(`/api/v1/courses/${courseId}/classification-config/versions`),
      ]);
      setCourse(courseResult.data.course);
      setConfig(configResult.data.config);
      setVersions(versionResult.data.versions);
      setForm(formFromConfig(configResult.data.config));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [courseId]);

  function updateBand(index, field, value) {
    setForm((current) => ({
      ...current,
      bands: current.bands.map((band, bandIndex) =>
        bandIndex === index ? { ...band, [field]: value } : band,
      ),
    }));
  }

  async function onSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await apiRequest(`/api/v1/courses/${courseId}/classification-config`, {
        method: "POST",
        body: {
          classificationBoundaries: {
            requiringAttentionMin: Number(form.requiringAttentionMin),
            activeMin: Number(form.activeMin),
          },
          lastActivityBands: form.bands.map((band) => ({
            minDays: Number(band.minDays),
            maxDays: band.maxDays === "" ? null : Number(band.maxDays),
            score: Number(band.score),
          })),
          changeNote: form.changeNote,
        },
      });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="content">
        <LoadingState loading variant="page" size="lg" message="Loading classification settings…" />
      </main>
    );
  }

  return (
    <main className="content settings-course-config-page">
      <header className="content-header">
        <BackLink fallbackTo="/settings" fallbackLabel="Back to Settings" />
        <h1>
          {course?.code} · {course?.name}
        </h1>
        <p className="lede">
          Course-specific scoring bands and classification boundaries. Global indicator weights are managed in{" "}
          <Link to="/settings">Settings</Link>. Saving creates a new configuration version; historical runs keep their
          snapshots.
        </p>
        <p className="settings-config-status">
          Status:{" "}
          <span className={config?.configurationStatus === "CONFIGURED" ? "badge badge-ok" : "badge"}>
            {config?.configurationStatus === "CONFIGURED" ? "Configured" : "Not configured"}
          </span>{" "}
          · Course config v{config?.version} · Global weights v{config?.globalWeightsVersion}
        </p>
      </header>

      <form className="stack-form settings-course-config-form" onSubmit={onSubmit}>
        <section className="card settings-config-section">
          <h2>
            <IndicatorGlyph indicatorKey="lastActivity" /> Last Recorded Login
          </h2>
          <p className="panel-desc">
            Bands use calendar days between the student&apos;s last recorded login and the monitoring period end
            (UTC). Missing timestamps yield Insufficient Data, not zero.
          </p>
          <table className="data-table">
            <thead>
              <tr>
                <th className="col-serial">S/N</th>
                <th>Min days</th>
                <th>Max days</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              {form.bands.map((band, index) => (
                <tr key={`${band.minDays}-${index}`}>
                  <td className="col-serial">{index + 1}</td>
                  <td>
                    <input
                      aria-label={`Band ${index + 1} min days`}
                      type="number"
                      min="0"
                      value={band.minDays}
                      onChange={(event) => updateBand(index, "minDays", event.target.value)}
                      required
                    />
                  </td>
                  <td>
                    <input
                      aria-label={`Band ${index + 1} max days`}
                      type="number"
                      min="0"
                      value={band.maxDays}
                      onChange={(event) => updateBand(index, "maxDays", event.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      aria-label={`Band ${index + 1} score`}
                      type="number"
                      min="0"
                      max="100"
                      value={band.score}
                      onChange={(event) => updateBand(index, "score", event.target.value)}
                      required
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="card settings-config-section settings-config-auto">
          <h2>
            <IndicatorGlyph indicatorKey="materialAccess" /> Course material access
          </h2>
          <p className="panel-desc">
            Automatic: (relevant materials accessed ÷ relevant materials available) × 100. Example: 8 of 10 → 80%. Not
            Applicable when no materials were available during the period.
          </p>
        </section>

        <section className="card settings-config-section settings-config-auto">
          <h2>
            <IndicatorGlyph indicatorKey="assignmentSubmission" /> Assignment submission
          </h2>
          <p className="panel-desc">
            Automatic: (eligible assignments submitted ÷ eligible assignments due) × 100. Example: 3 of 4 → 75%.
            Assignments not yet due are excluded.
          </p>
        </section>

        <section className="card settings-config-section">
          <h2>Final participation classification</h2>
          <p className="panel-desc">Boundaries apply to the weighted overall score (0–100).</p>
          <label htmlFor="requiringAttentionMin" className="label-with-glyph">
            <ClassificationBadge classification="REQUIRING_ATTENTION" /> from (inclusive)
          </label>
          <input
            id="requiringAttentionMin"
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={form.requiringAttentionMin}
            onChange={(event) => setForm({ ...form, requiringAttentionMin: event.target.value })}
            required
          />
          <label htmlFor="activeMin" className="label-with-glyph">
            <ClassificationBadge classification="ACTIVE" /> from (inclusive)
          </label>
          <input
            id="activeMin"
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={form.activeMin}
            onChange={(event) => setForm({ ...form, activeMin: event.target.value })}
            required
          />
          <label htmlFor="changeNote">Change note</label>
          <input
            id="changeNote"
            value={form.changeNote}
            onChange={(event) => setForm({ ...form, changeNote: event.target.value })}
            placeholder="Why this version exists"
          />
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          <button type="submit" className="primary-btn" disabled={saving}>
            {saving ? "Saving…" : "Save configuration"}
          </button>
        </section>
      </form>

      <details className="card table-card">
        <summary>
          <h2>Version history</h2>
        </summary>
        {versions.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th className="col-serial">S/N</th>
                <th>Version</th>
                <th>Active</th>
                <th>Boundaries</th>
                <th>Global weights v</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((item, index) => (
                <tr key={item.id}>
                  <td className="col-serial">{index + 1}</td>
                  <td>v{item.version}</td>
                  <td>{item.isActive ? "Yes" : "No"}</td>
                  <td>
                    {item.classificationBoundaries.requiringAttentionMin} / {item.classificationBoundaries.activeMin}
                  </td>
                  <td>{item.globalWeightsVersionAtSave ?? "—"}</td>
                  <td>{item.changeNote || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">No versions yet.</p>
        )}
      </details>

      <p className="muted settings-course-workspace-link">
        <Link to={`/courses/${courseId}/monitoring`}>Open course Monitoring workspace</Link>.
      </p>
    </main>
  );
}