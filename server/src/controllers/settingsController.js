import { listCourseClassificationSettings } from "../services/configService.js";
import {
  createGlobalWeightsVersion,
  getActiveGlobalWeights,
  listGlobalWeightVersions,
} from "../services/globalWeightsService.js";

export async function getIndicatorWeights(req, res) {
  const weights = await getActiveGlobalWeights(req.user.id);
  res.json({ data: { weights } });
}

export async function postIndicatorWeights(req, res) {
  const weights = await createGlobalWeightsVersion(req.user.id, req.body || {});
  res.status(201).json({ data: { weights } });
}

export async function getIndicatorWeightVersions(req, res) {
  const versions = await listGlobalWeightVersions(req.user.id);
  res.json({ data: { versions } });
}

export async function getCourseClassificationTable(req, res) {
  const courses = await listCourseClassificationSettings(req.user.id);
  res.json({ data: { courses } });
}