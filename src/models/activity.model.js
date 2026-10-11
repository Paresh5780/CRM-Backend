import mongoose from "mongoose";
import { ACTIVITY_TYPES, ACTIVITY_STATUSES, ENTITY_TYPES } from "../utils/usedConstants.js";

const activitySchema = new mongoose.Schema(
  {
    type: {
      type: Number,
      enum: {
        values: Object.values(ACTIVITY_TYPES),
        message: "{VALUE} is not a valid activity type"
      },
      required: [true, "Activity type is required"]
    },
    title: {
      type: String,
      required: [true, "Activity title is required"],
      trim: true
    },
    description: {
      type: String,
      trim: true,
      default: ""
    },
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
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Assigned user is required"],
      index: true
    },
    dueDate: {
      type: Date,
      default: null
    },
    status: {
      type: Number,
      enum: {
        values: [ACTIVITY_STATUSES.PENDING, ACTIVITY_STATUSES.COMPLETED],
        message: "{VALUE} is not a valid activity status"
      },
      default: ACTIVITY_STATUSES.PENDING
    },
    completedAt: {
      type: Date,
      default: null
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Created by user is required"]
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

activitySchema.virtual("computedStatus").get(function () {
  if (
    this.status === ACTIVITY_STATUSES.PENDING &&
    this.dueDate &&
    new Date(this.dueDate) < new Date()
  ) {
    return ACTIVITY_STATUSES.OVERDUE;
  }
  return this.status;
});

activitySchema.index({ entityType: 1, entityId: 1 });
activitySchema.index({ assignedTo: 1, status: 1 });
activitySchema.index({ assignedTo: 1, status: 1, dueDate: 1 });
activitySchema.index({ dueDate: 1 });
activitySchema.index({ createdAt: -1 });

export const Activity = mongoose.model("Activity", activitySchema);
