export function toPublicCourse(course) {
  return {
    id: String(course._id),
    name: course.name,
    code: course.code,
    description: course.description || "",
    lecturerId: String(course.lecturerId),
    status: course.status,
    createdAt: course.createdAt,
    updatedAt: course.updatedAt,
  };
}

export function toPublicStudent(student) {
  return {
    id: String(student._id),
    fullName: student.fullName,
    matriculationNumber: student.matriculationNumber,
    email: student.email || null,
    createdAt: student.createdAt,
    updatedAt: student.updatedAt,
  };
}

export function toPublicEnrollment(enrollment, student) {
  const studentRef = enrollment.studentId?._id || enrollment.studentId;
  const courseRef = enrollment.courseId?._id || enrollment.courseId;
  return {
    id: String(enrollment._id),
    studentId: String(studentRef),
    courseId: String(courseRef),
    status: enrollment.status,
    enrolledAt: enrollment.enrolledAt,
    student: student ? toPublicStudent(student) : undefined,
  };
}
