import mongoose from "mongoose";
import { DEAL_STAGES, STAGE_DEFAULT_PROBABILITIES } from "../utils/usedConstants.js";

const dealSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Deal name is required"],
      trim: true
    },
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
      default: null,
      index: true
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: [true, "Customer reference is required"],
      index: true
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Assigned employee is required"],
      index: true
    },
    value: {
      type: Number,
      required: [true, "Deal value is required"],
      min: [0.01, "Deal value must be greater than zero"]
    },
    probability: {
      type: Number,
      min: [0, "Probability must be at least 0"],
      max: [100, "Probability cannot exceed 100"],
      default: 10
    },
    expectedRevenue: {
      type: Number,
      default: 0
    },
    stage: {
      type: Number,
      enum: {
        values: Object.values(DEAL_STAGES),
        message: "{VALUE} is not a valid deal stage"
      },
      default: DEAL_STAGES.QUALIFICATION,
      index: true
    },
    expectedClosingDate: {
      type: Date,
      default: null
    },
    lossReason: {
      type: String,
      trim: true,
      default: ""
    },
    description: {
      type: String,
      trim: true,
      default: ""
    }
  },
  {
    timestamps: true
  }
);

dealSchema.pre("save", function (next) {
  if (this.stage === DEAL_STAGES.WON) {
    this.probability = 100;
  } else if (this.stage === DEAL_STAGES.LOST) {
    this.probability = 0;
  }

  const rawRevenue = this.value * (this.probability / 100);
  this.expectedRevenue = Math.round(rawRevenue * 100) / 100;
  next();
});

dealSchema.index({ name: "text", description: "text" });
dealSchema.index({ createdAt: -1 });
dealSchema.index({ value: 1 });
dealSchema.index({ assignedTo: 1, stage: 1 });
dealSchema.index({ stage: 1, value: 1 });

export const Deal = mongoose.model("Deal", dealSchema);
