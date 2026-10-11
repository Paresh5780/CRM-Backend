import { Timeline } from "../models/timeline.model.js";

export async function recordTimeline({
  entityType,
  entityId,
  action,
  performedBy,
  previousValue = null,
  newValue = null,
  metadata = {}
}) {
  try {
    await Timeline.create({
      entityType,
      entityId,
      action,
      performedBy,
      previousValue,
      newValue,
      metadata
    });
  } catch (error) {
    console.error("Timeline recording failed:", error.message);
  }
}
