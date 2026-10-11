import { Router } from "express";
import mongoose from "mongoose";

const router = Router();

router.get("/", (req, res) => {
  const databaseState = mongoose.connection.readyState;
  const databaseConnected = databaseState === 1;

  res.status(databaseConnected ? 200 : 503).json({
    success: databaseConnected,
    message: databaseConnected ? "API is healthy" : "Database is not connected",
    data: {
      service: "crm-sales-api",
      environment: process.env.NODE_ENV || "development",
      database: databaseConnected ? "connected" : "disconnected",
      uptimeSeconds: Math.floor(process.uptime())
    }
  });
});

export default router;
