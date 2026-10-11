import dns from "node:dns";
import mongoose from "mongoose";
import { env } from "./env.js";

try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch {
}

export async function connectDatabase() {
  mongoose.set("strictQuery", true);

  try {
    await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000
    });
    console.info("MongoDB connected (Atlas URI)");
  } catch (primaryError) {
    console.warn(`Atlas connection failed: ${primaryError.message}`);
    console.info("Attempting local MongoDB fallback (mongodb://127.0.0.1:27017/crm_sales_db)...");

    try {
      await mongoose.connect("mongodb://127.0.0.1:27017/crm_sales_db", {
        serverSelectionTimeoutMS: 5000
      });
      console.info("MongoDB connected successfully via local MongoDB service!");
    } catch {
      throw primaryError;
    }
  }
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}
