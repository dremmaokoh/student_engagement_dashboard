export default function DashboardInsights({ insights }) {
  if (!insights?.length) {
    return null;
  }

  return (
    <aside className="dashboard-insights" aria-label="Dashboard observations">
      <h3 className="insights-title">Observations</h3>
      <ul className="insights-list">
        {insights.map((text) => (
          <li key={text}>{text}</li>
        ))}
      </ul>
    </aside>
  );
}