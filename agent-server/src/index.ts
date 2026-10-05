/**
 * FretAgent Express server entry point.
 *
 * Loads environment variables, creates the Express application via
 * createApp(), and starts the HTTP server on PORT (default 3001).
 * Kept thin so the app can be imported by tests without side-effects.
 */

import http from "http";
import dotenv from "dotenv";
import { createApp } from "./app.js";

dotenv.config({ path: "./.env" });

const app = createApp();
const PORT = Number(process.env.PORT ?? 3001);

const server = http.createServer(app);

server.listen(PORT, "0.0.0.0", () => {
  console.log(`FretAgent server running on http://localhost:${PORT}`);
});

server.on("error", (err) => {
  console.error("Server error:", err.message);
  process.exit(1);
});
