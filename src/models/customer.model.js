import mongoose from "mongoose";
import { CUSTOMER_STATUSES } from "../utils/usedConstants.js";

const customerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Customer name is required"],
      trim: true
    },
    email: {
      type: String,
      required: [true, "Customer email is required"],
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
    address: {
      type: String,
      trim: true,
      default: ""
    },
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
      default: null,
      index: true
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Assigned employee is required"],
      index: true
    },
    status: {
      type: Number,
      enum: {
        values: Object.values(CUSTOMER_STATUSES),
        message: "{VALUE} is not a valid customer status"
      },
      default: CUSTOMER_STATUSES.ACTIVE,
      index: true
    }
  },
  {
    timestamps: true
  }
);

customerSchema.index({ name: "text", company: "text", email: "text" });
customerSchema.index({ createdAt: -1 });

export const Customer = mongoose.model("Customer", customerSchema);
