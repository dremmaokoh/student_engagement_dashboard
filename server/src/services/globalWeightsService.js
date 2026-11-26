import LecturerIndicatorWeights from "../models/LecturerIndicatorWeights.js";
import { DEFAULT_ACTIVE_INDICATORS, DEFAULT_WEIGHTS } from "./scoring/defaults.js";
import { normalizeIndicatorConfiguration } from "./scoring/configValidation.js";

function toPublicWeights(row) {
  const stored = row.activeIndicators || {};
  return {
    id: String(row._id),
    lecturerId: String(row.lecturerId),
    version: row.version,
    isActive: row.isActive,
    weights: row.weights,
    activeIndicators: {
      lastActivity: stored.lastActivity !== false,
      materialAccess: stored.materialAccess !== false,
      assignmentSubmission: stored.assignmentSubmission !== false,
    },
    changeNote: row.changeNote,
    createdAt: row.createdAt,
    createdBy: String(row.createdBy),
  };
}

export async function getActiveGlobalWeights(lecturerId) {
  let config = await LecturerIndicatorWeights.findOne({ lecturerId, isActive: true });
  if (!config) {
    const latest = await LecturerIndicatorWeights.findOne({ lecturerId }).sort({ version: -1 });
    if (latest) {
      latest.isActive = true;
      await latest.save();
      config = latest;
    } else {
      config = await LecturerIndicatorWeights.create({
        lecturerId,
        version: 1,
        isActive: true,
        weights: DEFAULT_WEIGHTS,
        activeIndicators: DEFAULT_ACTIVE_INDICATORS,
        createdBy: lecturerId,
        changeNote: "Default configuration",
      });
    }
  }
  return toPublicWeights(config);
}

export async function listGlobalWeightVersions(lecturerId) {
  const versions = await LecturerIndicatorWeights.find({ lecturerId }).sort({ version: -1 });
  return versions.map(toPublicWeights);
}

export async function createGlobalWeightsVersion(lecturerId, input) {
  const { weights, activeIndicators } = normalizeIndicatorConfiguration({
    weights: input.weights || DEFAULT_WEIGHTS,
    activeIndicators: input.activeIndicators,
  });
  const latest = await LecturerIndicatorWeights.findOne({ lecturerId }).sort({ version: -1 });
  const version = latest ? latest.version + 1 : 1;

  await LecturerIndicatorWeights.updateMany({ lecturerId, isActive: true }, { isActive: false });

  const config = await LecturerIndicatorWeights.create({
    lecturerId,
    version,
    isActive: true,
    weights,
    activeIndicators,
    createdBy: lecturerId,
    changeNote: String(input.changeNote || "").trim(),
  });

  return toPublicWeights(config);
}