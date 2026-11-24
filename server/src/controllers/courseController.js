import { archiveCourse, createCourse, listCourses, updateCourse } from "../services/courseService.js";
import {
  createStudent,
  enrolStudent,
  enrolStudents,
  getStudentParticipationProfile,
  listCourseStudents,
  listStudents,
  updateEnrollment,
  updateStudent,
} from "../services/studentService.js";
import { toPublicCourse } from "../utils/toPublic.js";
import { validateCourseInput, validateStudentInput } from "../validators/courseValidators.js";

export async function getCourses(req, res) {
  const data = await listCourses(req.user.id, req.query);
  res.json({ data });
}

export async function postCourse(req, res) {
  const input = validateCourseInput(req.body);
  const course = await createCourse(req.user.id, input);
  res.status(201).json({ data: { course } });
}

export async function getCourse(req, res) {
  res.json({ data: { course: toPublicCourse(req.course) } });
}

export async function patchCourse(req, res) {
  const input = validateCourseInput(req.body, { partial: true });
  const course = await updateCourse(req.course, input);
  res.json({ data: { course } });
}

export async function deleteCourse(req, res) {
  const result = await archiveCourse(req.course);
  res.json({ data: result });
}

export async function getDirectoryStudents(req, res) {
  const data = await listStudents(req.query, req.user.id);
  res.json({ data });
}

export async function postStudent(req, res) {
  const input = validateStudentInput(req.body);
  const student = await createStudent(input);
  res.status(201).json({ data: { student } });
}

export async function getStudentById(req, res) {
  const student = await getStudentParticipationProfile(req.params.studentId, req.user.id);
  res.json({ data: { student } });
}

export async function patchStudent(req, res) {
  const input = validateStudentInput(req.body, { partial: true });
  await getStudentParticipationProfile(req.params.studentId, req.user.id);
  const student = await updateStudent(req.params.studentId, input);
  res.json({ data: { student } });
}

export async function getCourseStudents(req, res) {
  const data = await listCourseStudents(req.course._id, req.query);
  res.json({ data });
}

export async function postEnrollment(req, res) {
  const enrollment = await enrolStudent(req.course._id, req.body?.studentId);
  res.status(201).json({ data: { enrollment } });
}

export async function postBulkEnrollment(req, res) {
  const data = await enrolStudents(req.course._id, req.body?.studentIds);
  res.status(201).json({ data });
}

export async function patchEnrollment(req, res) {
  const enrollment = await updateEnrollment(req.params.enrollmentId, req.user.id, {
    status: req.body?.status,
  });
  res.json({ data: { enrollment } });
}
