export default function ScoreBar({ score, label, tone }) {
  if (score === null || score === undefined) {
    return null;
  }
  const width = Math.max(0, Math.min(100, Number(score)));
  return (
    <div className="score-bar">
      <div className={`score-bar-fill fill-${tone || "primary"}`} style={{ width: `${width}%` }} />
      <span className="visually-hidden">{label || `${width} out of 100`}</span>
    </div>
  );
}
