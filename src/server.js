
import app from "./app.js";
import { env } from "./config/env.js";
import { connectDatabase, disconnectDatabase } from "./config/db.js";
import { seedAdmin } from "./config/seedAdmin.js";

let server;


async function start() {
  await connectDatabase();
  await seedAdmin();

  server = app.listen(env.PORT, () => {
    console.info(`CRM Sales API listening on port ${env.PORT}`);
  });
}

async function shutdown(signal) {
  console.info(`${signal} received; shutting down`);
  if (server) {
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
  } else {
    await disconnectDatabase().catch(() => { });
    process.exit(0);
  }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

start().catch((error) => {
  console.error("Failed to start server:", error.message);
  process.exit(1);
});
