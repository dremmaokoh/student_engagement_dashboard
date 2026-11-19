import { Link, useLocation } from "react-router-dom";

export default function BackLink({ to, label, fallbackTo, fallbackLabel }) {
  const location = useLocation();
  const destination = location.state?.from || to || fallbackTo;
  const text = location.state?.fromLabel || label || fallbackLabel;

  if (!destination || !text) {
    return null;
  }

  return (
    <Link className="back-link" to={destination}>
      <span className="back-link-icon" aria-hidden="true">
        ←
      </span>
      {text}
    </Link>
  );
}