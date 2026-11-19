import {
  listStudentCommunications,
  sendStudentMessage,
} from "../services/studentCommunicationService.js";
import { validateSendStudentMessageInput } from "../validators/studentCommunicationValidators.js";

export async function getStudentCommunications(req, res) {
  const data = await listStudentCommunications(req.params.studentId, req.user.id, req.query);
  res.json({ data });
}

export async function postStudentCommunication(req, res) {
  const input = validateSendStudentMessageInput(req.body);
  const result = await sendStudentMessage(req.params.studentId, req.user.id, input);
  res.status(201).json({ data: result });
}