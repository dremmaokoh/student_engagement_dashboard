import { createConfigVersion, getActiveConfig, listConfigVersions } from "../services/configService.js";

export async function getClassificationConfig(req, res) {
  const config = await getActiveConfig(req.course._id, req.user.id);
  res.json({ data: { config } });
}

export async function postClassificationConfig(req, res) {
  const config = await createConfigVersion(req.course._id, req.user.id, req.body || {});
  res.status(201).json({ data: { config } });
}

export async function getClassificationConfigVersions(req, res) {
  const versions = await listConfigVersions(req.course._id);
  res.json({ data: { versions } });
}
