import { Fragment } from "react";
import { skeletonColumns } from "../../lib/skeletonColumns.js";

function classes(...values) {
  return values.filter(Boolean).join(" ");
}

function normaliseColumns(columns) {
  if (Array.isArray(columns)) {
    return columns;
  }
  const count = Number(columns) || 5;
  return Array.from({ length: count }, (_, index) =>
    index === 0
      ? { className: "col-serial", width: "56px", barWidths: ["70%"] }
      : { className: "", width: `${Math.round(92 / Math.max(1, count - 1))}%` },
  );
}

export function SkeletonBar({ width = "100%", className = "", height }) {
  return (
    <span
      className={classes("skeleton-bar", className)}
      style={{ width, ...(height ? { height } : {}) }}
      aria-hidden="true"
    />
  );
}

export function SkeletonLines({ rows = 4, widths = ["88%", "70%", "80%", "56%"] }) {
  return (
    <div className="content-skeleton-lines" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <SkeletonBar key={index} width={widths[index % widths.length]} />
      ))}
    </div>
  );
}

export function SkeletonSummaryGrid({
  count = 5,
  className = "status-grid",
  withDelta = false,
  wrapperClassName = "",
}) {
  return (
    <div className={className} aria-hidden="true">
      {Array.from({ length: count }, (_, index) => {
        const card = (
          <article className="summary-card skeleton-summary-card">
            <div className="summary-head">
              <span className="skeleton-summary-icon" />
              <SkeletonBar width={index % 2 === 0 ? "62%" : "74%"} />
            </div>
            <SkeletonBar width="44%" className="skeleton-summary-value" />
            {withDelta ? <SkeletonBar width="68%" className="skeleton-summary-delta" /> : null}
          </article>
        );
        return wrapperClassName ? (
          <div className={wrapperClassName} key={index}>
            {card}
          </div>
        ) : (
          <Fragment key={index}>{card}</Fragment>
        );
      })}
    </div>
  );
}

export function SkeletonTable({
  columns,
  rows = 5,
  tableClassName = "",
  wrapClassName = "table-card",
  showHeader = true,
  showFooter = false,
  showTableFooter = false,
}) {
  const descriptors = normaliseColumns(columns);
  return (
    <div className={classes("skeleton-table-wrap", wrapClassName)} aria-hidden="true">
      <table className={classes("data-table", "skeleton-table", tableClassName)}>
        <colgroup>
          {descriptors.map((descriptor, index) => (
            <col key={index} style={descriptor.width ? { width: descriptor.width } : undefined} />
          ))}
        </colgroup>
        {showHeader ? (
          <thead>
            <tr>
              {descriptors.map((descriptor, index) => (
                <th className={descriptor.className || undefined} key={index}>
                  <span className="skeleton-cell">
                    <SkeletonBar width={index === 0 ? "70%" : "62%"} className="skeleton-header-bar" />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
        ) : null}
        <tbody>
          {Array.from({ length: rows }, (_, rowIndex) => (
            <tr key={rowIndex}>
              {descriptors.map((descriptor, columnIndex) => {
                const barWidths = descriptor.barWidths || (columnIndex === 0 ? ["70%"] : ["82%"]);
                const lineCount = descriptor.lines || 1;
                const cellContent = (
                  <span className="skeleton-cell-lines">
                    {Array.from({ length: lineCount }, (_, lineIndex) => (
                      <SkeletonBar
                        key={lineIndex}
                        width={barWidths[(rowIndex + lineIndex) % barWidths.length]}
                      />
                    ))}
                  </span>
                );
                return (
                  <td className={descriptor.className || undefined} key={columnIndex}>
                    <span className="skeleton-cell">
                      {descriptor.avatar ? <span className="skeleton-avatar" aria-hidden="true" /> : null}
                      {lineCount > 1 || descriptor.avatar ? cellContent : (
                        <SkeletonBar width={barWidths[rowIndex % barWidths.length]} />
                      )}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
        {showTableFooter ? (
          <tfoot>
            <tr>
              <td className="col-serial" />
              <th scope="row" colSpan={Math.max(1, descriptors.length - 2)}>
                <span className="skeleton-cell">
                  <SkeletonBar width="70%" />
                </span>
              </th>
              <td>
                <span className="skeleton-cell">
                  <SkeletonBar width="60%" />
                </span>
              </td>
            </tr>
          </tfoot>
        ) : null}
      </table>
      {showFooter ? (
        <div className="skeleton-table-footer">
          <SkeletonBar width="30%" />
          <SkeletonBar width="48%" />
        </div>
      ) : null}
    </div>
  );
}

export function SkeletonChart({ seriesCount = 4, showSnapshot = true }) {
  const legendItems = Array.from({ length: Math.max(1, seriesCount) }, (_, index) => index);
  return (
    <figure className="classification-trend-chart" aria-hidden="true">
      <div className="classification-trend-chart-body">
        <div className="classification-trend-plot-wrap">
          <div className="skeleton-chart-stage">
            <SkeletonBar width="72%" className="skeleton-chart-band" />
            <SkeletonBar width="54%" className="skeleton-chart-band" />
            <SkeletonBar width="64%" className="skeleton-chart-band" />
          </div>
        </div>
        {showSnapshot ? (
          <div className="classification-trend-snapshot-slot">
            <div className="classification-trend-run-tooltip">
              <SkeletonBar width="58%" height={16} />
              <div className="skeleton-chart-snapshot-stats">
                <SkeletonBar width="72%" />
                <SkeletonBar width="64%" />
                <SkeletonBar width="78%" />
              </div>
            </div>
          </div>
        ) : null}
      </div>
      <ul className="classification-trend-legend">
        {legendItems.map((index) => (
          <li className="classification-trend-legend-item" key={index}>
            <SkeletonBar width="72%" />
          </li>
        ))}
      </ul>
    </figure>
  );
}

export function SkeletonDonutChart() {
  return (
    <figure className="donut-chart donut-chart-hero" aria-hidden="true">
      <figcaption className="distribution-caption">
        <SkeletonBar width="36%" height={20} />
        <SkeletonBar width="58%" />
      </figcaption>
      <div className="distribution-hero-layout">
        <div className="donut-chart-stage">
          <span className="skeleton-donut" />
        </div>
        <ul className="distribution-legend distribution-legend-hero">
          {Array.from({ length: 4 }, (_, index) => (
            <li className="distribution-legend-item" key={index}>
              <span className="legend-filter-static">
                <SkeletonBar width="100%" />
              </span>
            </li>
          ))}
        </ul>
      </div>
    </figure>
  );
}

export function SkeletonPanel({
  className = "card",
  titleWidth = "36%",
  lines,
  children,
  showTitle = true,
}) {
  return (
    <section className={classes("skeleton-panel", className)} aria-hidden="true">
      {showTitle ? <SkeletonBar width={titleWidth} className="skeleton-panel-title" /> : null}
      {lines?.length ? (
        <div className="skeleton-panel-lines">
          {lines.map((width, index) => (
            <SkeletonBar width={width} key={index} />
          ))}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function SkeletonPageHeader() {
  return (
    <div className="skeleton-page-header" aria-hidden="true">
      <SkeletonBar width="38%" className="skeleton-page-title" />
      <SkeletonBar width="76%" />
      <SkeletonBar width="58%" />
    </div>
  );
}

export function SkeletonProfile() {
  return (
    <div className="skeleton-profile" aria-hidden="true">
      <section className="card student-profile-card skeleton-profile-card">
        <div className="student-detail-identity-main">
          <span className="skeleton-avatar" />
          <div className="student-profile-body">
            <SkeletonBar width="26%" className="skeleton-profile-eyebrow" />
            <SkeletonBar width="44%" className="skeleton-page-title" />
            <div className="skeleton-profile-fields">
              <SkeletonBar width="28%" />
              <SkeletonBar width="36%" />
            </div>
            <SkeletonBar width="30%" />
          </div>
        </div>
      </section>
      <SkeletonPanel className="card student-communication-panel" showTitle={false}>
        <div className="student-communication-head">
          <SkeletonBar width="28%" height={20} />
          <SkeletonBar className="skeleton-button" width="104px" height={40} />
        </div>
        <SkeletonTable
          columns={skeletonColumns("messages")}
          rows={3}
          tableClassName="student-communication-table"
          wrapClassName="table-card table-card-flush student-communication-table-wrap"
        />
      </SkeletonPanel>
      <SkeletonPanel className="card student-detail-summary" titleWidth="32%">
        <div className="student-summary-grid" aria-hidden="true">
          {Array.from({ length: 4 }, (_, index) => (
            <div className="student-summary-stat" key={index}>
              <SkeletonBar className="student-summary-count" width="48%" height={22} />
              <SkeletonBar className="student-summary-label" width="72%" height={10} />
            </div>
          ))}
        </div>
      </SkeletonPanel>
      <SkeletonPanel
        className="card table-card"
        titleWidth="34%"
        children={<SkeletonTable columns={skeletonColumns("courseParticipation")} rows={4} />}
      />
    </div>
  );
}

export default function ContentSkeleton({
  loading,
  variant = "table",
  rows = 5,
  columns = 5,
  label = "Loading content…",
  className = "",
  children,
  ...tableProps
}) {
  if (!loading) {
    return null;
  }

  let content = children;
  if (content == null && variant === "table") {
    content = <SkeletonTable columns={columns} rows={rows} {...tableProps} />;
  } else if (content == null && variant === "cards") {
    content = <SkeletonSummaryGrid count={rows} className={tableProps.gridClassName || "status-grid"} />;
  } else if (content == null && variant === "lines") {
    content = <SkeletonLines rows={rows} />;
  }

  return (
    <div className={classes("content-skeleton-wrap", "is-visible", className)} role="status" aria-live="polite" aria-label={label}>
      <span className="sr-only">{label}</span>
      {content}
    </div>
  );
}
