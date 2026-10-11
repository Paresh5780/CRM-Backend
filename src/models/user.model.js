import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { ROLES } from "../utils/usedConstants.js";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      index: true
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false
    },
    phone: {
      type: String,
      trim: true,
      default: ""
    },
    role: {
      type: Number,
      enum: {
        values: Object.values(ROLES),
        message: "{VALUE} is not a valid role"
      },
      default: ROLES.SALES_EXECUTIVE,
      index: true
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    }
  },
  {
    timestamps: true
  }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toJSON = function () {
  const userObject = this.toObject();
  delete userObject.password;
  delete userObject.__v;
  return userObject;
};

export const User = mongoose.model("User", userSchema);
