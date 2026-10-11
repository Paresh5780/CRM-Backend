import mongoose from "mongoose";
import { ENTITY_TYPES } from "../utils/usedConstants.js";

const timelineSchema = new mongoose.Schema(
  {
    entityType: {
      type: Number,
      enum: {
        values: Object.values(ENTITY_TYPES),
        message: "{VALUE} is not a valid entity type"
      },
      required: [true, "Entity type is required"]
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, "Entity ID is required"]
    },
    action: {
      type: String,
      required: [true, "Action is required"],
      trim: true
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Performed by user is required"]
    },
    previousValue: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    newValue: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true
  }
);

timelineSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });

export const Timeline = mongoose.model("Timeline", timelineSchema);
