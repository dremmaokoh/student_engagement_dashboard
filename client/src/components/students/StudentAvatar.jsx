import { studentInitials } from "../../lib/studentDirectory.js";

export default function StudentAvatar({ fullName, size = "md" }) {
  return (
    <span className={`student-avatar student-avatar-${size}`} aria-hidden="true">
      {studentInitials(fullName)}
    </span>
  );
}