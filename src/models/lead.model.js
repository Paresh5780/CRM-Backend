import mongoose from "mongoose";
import { LEAD_SOURCES, LEAD_STATUSES, LEAD_PRIORITIES } from "../utils/usedConstants.js";

const leadSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Lead name is required"],
      trim: true
    },
    email: {
      type: String,
      required: [true, "Lead email is required"],
      lowercase: true,
      trim: true,
      index: true
    },
    phone: {
      type: String,
      trim: true,
      default: ""
    },
    company: {
      type: String,
      trim: true,
      default: ""
    },
    source: {
      type: Number,
      enum: {
        values: Object.values(LEAD_SOURCES),
        message: "{VALUE} is not a valid lead source"
      },
      default: LEAD_SOURCES.WEBSITE,
      index: true
    },
    status: {
      type: Number,
      enum: {
        values: Object.values(LEAD_STATUSES),
        message: "{VALUE} is not a valid lead status"
      },
      default: LEAD_STATUSES.NEW,
      index: true
    },
    priority: {
      type: Number,
      enum: {
        values: Object.values(LEAD_PRIORITIES),
        message: "{VALUE} is not a valid lead priority"
      },
      default: LEAD_PRIORITIES.MEDIUM,
      index: true
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true
    },
    description: {
      type: String,
      trim: true,
      default: ""
    },
    convertedCustomerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default: null
    },
    convertedDealId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Deal",
      default: null
    }
  },
  {
    timestamps: true
  }
);

leadSchema.index({ name: "text", company: "text", email: "text" });
leadSchema.index({ createdAt: -1 });
leadSchema.index({ assignedTo: 1, status: 1 });
leadSchema.index({ source: 1, status: 1 });

export const Lead = mongoose.model("Lead", leadSchema);
