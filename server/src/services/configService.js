import ClassificationConfig from "../models/ClassificationConfig.js";
import Course from "../models/Course.js";
import {
  DEFAULT_BOUNDARIES,
  DEFAULT_LAST_ACTIVITY_BANDS,
  DEFAULT_WEIGHTS,
} from "./scoring/defaults.js";
import { validateBands, validateBoundaries } from "./scoring/configValidation.js";
import { ScoringValidationError } from "./scoring/scoringEngine.js";
import { getActiveGlobalWeights } from "./globalWeightsService.js";

export const DEFAULT_SEED_NOTE = "Default prototype configuration";

function toPublicCourseConfig(config) {
  return {
    id: String(config._id),
    courseId: String(config.courseId),
    version: config.version,
    isActive: config.isActive,
    lastActivityBands: config.lastActivityBands,
    classificationBoundaries: config.classificationBoundaries,
    changeNote: config.changeNote,
    createdAt: config.createdAt,
    createdBy: String(config.createdBy),
    globalWeightsVersionAtSave: config.globalWeightsVersionAtSave ?? null,
  };
}

export function isLecturerConfiguredCourseConfig(config) {
  if (!config) {
    return false;
  }
  if (config.version > 1) {
    return true;
  }
  const note = String(config.changeNote || "").trim();
  return Boolean(note && note !== DEFAULT_SEED_NOTE);
}

export async function mergeEffectiveConfig(courseConfig, globalWeights) {
  const base = toPublicCourseConfig(courseConfig);
  return {
    ...base,
    weights: globalWeights.weights,
    activeIndicators: globalWeights.activeIndicators,
    globalWeightsVersion: globalWeights.version,
    globalWeightsId: globalWeights.id,
    configurationStatus: isLecturerConfiguredCourseConfig(courseConfig) ? "CONFIGURED" : "NOT_CONFIGURED",
    configurationSource: isLecturerConfiguredCourseConfig(courseConfig) ? "lecturer_saved" : "system_default",
  };
}

async function ensureCourseConfigDocument(courseId, lecturerId) {
  let config = await ClassificationConfig.findOne({ courseId, isActive: true });
  if (!config) {
    const latest = await ClassificationConfig.findOne({ courseId }).sort({ version: -1 });
    if (latest) {
      latest.isActive = true;
      await latest.save();
      config = latest;
    } else {
      const global = await getActiveGlobalWeights(lecturerId);
      config = await ClassificationConfig.create({
        courseId,
        version: 1,
        isActive: true,
        weights: global.weights,
        lastActivityBands: DEFAULT_LAST_ACTIVITY_BANDS,
        classificationBoundaries: DEFAULT_BOUNDARIES,
        createdBy: lecturerId,
        changeNote: DEFAULT_SEED_NOTE,
        globalWeightsVersionAtSave: global.version,
      });
    }
  }
  return config;
}

export async function getActiveConfig(courseId, lecturerId) {
  const [courseConfig, globalWeights] = await Promise.all([
    ensureCourseConfigDocument(courseId, lecturerId),
    getActiveGlobalWeights(lecturerId),
  ]);
  return mergeEffectiveConfig(courseConfig, globalWeights);
}

export async function listConfigVersions(courseId) {
  const versions = await ClassificationConfig.find({ courseId }).sort({ version: -1 });
  return versions.map(toPublicCourseConfig);
}

export async function createConfigVersion(courseId, lecturerId, input) {
  if (input?.weights) {
    throw new ScoringValidationError(
      "Activity indicator weights are managed globally in Settings. Remove weights from this request.",
    );
  }

  const lastActivityBands = validateBands(input.lastActivityBands || DEFAULT_LAST_ACTIVITY_BANDS);
  const classificationBoundaries = validateBoundaries(
    input.classificationBoundaries || DEFAULT_BOUNDARIES,
  );

  const globalWeights = await getActiveGlobalWeights(lecturerId);
  const latest = await ClassificationConfig.findOne({ courseId }).sort({ version: -1 });
  const version = latest ? latest.version + 1 : 1;

  await ClassificationConfig.updateMany({ courseId, isActive: true }, { isActive: false });

  const config = await ClassificationConfig.create({
    courseId,
    version,
    isActive: true,
    weights: globalWeights.weights,
    lastActivityBands,
    classificationBoundaries,
    createdBy: lecturerId,
    changeNote: String(input.changeNote || "").trim(),
    globalWeightsVersionAtSave: globalWeights.version,
  });

  return mergeEffectiveConfig(config, globalWeights);
}

export async function listCourseClassificationSettings(lecturerId) {
  const courses = await Course.find({ lecturerId, status: { $ne: "deleted" } })
    .sort({ code: 1 })
    .select("_id code name");
  const courseIds = courses.map((course) => course._id);
  const configs = await ClassificationConfig.find({ courseId: { $in: courseIds }, isActive: true });
  const configByCourse = new Map(configs.map((row) => [String(row.courseId), row]));

  return courses.map((course) => {
    const config = configByCourse.get(String(course._id));
    const configured = isLecturerConfiguredCourseConfig(config);
    return {
      id: String(course._id),
      code: course.code,
      name: course.name,
      configurationStatus: configured ? "CONFIGURED" : "NOT_CONFIGURED",
      courseConfigurationVersion: config?.version ?? null,
    };
  });
}

/** @deprecated use getActiveGlobalWeights — kept for tests reading legacy weight fields on course versions */
export function legacyWeightsFromConfig(config) {
  return config?.weights || DEFAULT_WEIGHTS;
}