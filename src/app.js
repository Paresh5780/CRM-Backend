import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./config/swagger.js";
import { env } from "./config/env.js";
import healthRoutes from "./routes/health.routes.js";
import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import leadRoutes from "./routes/lead.routes.js";
import customerRoutes from "./routes/customer.routes.js";
import dealRoutes from "./routes/deal.routes.js";
import activityRoutes from "./routes/activity.routes.js";
import timelineRoutes from "./routes/timeline.routes.js";
import analyticsRoutes from "./routes/analytics.routes.js";
import { notFoundHandler } from "./middleware/notFound.js";
import { errorHandler } from "./middleware/errorHandler.js";

const app = express();

app.disable("x-powered-by");
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || env.corsOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Origin is not allowed by CORS"));
  },
  credentials: true
}));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));
app.use(rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.RATE_LIMIT_MAX,
  standardHeaders: "draft-7",
  legacyHeaders: false
}));

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "CRM Sales Management API",
    data: { health: "/api/v1/health" }
  });
});

app.use("/api/v1/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, { customSiteTitle: "CRM Sales API Docs" }));
app.use("/api/v1/health", healthRoutes);
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/leads", leadRoutes);
app.use("/api/v1/customers", customerRoutes);
app.use("/api/v1/deals", dealRoutes);
app.use("/api/v1/activities", activityRoutes);
app.use("/api/v1/timeline", timelineRoutes);
app.use("/api/v1/analytics", analyticsRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
