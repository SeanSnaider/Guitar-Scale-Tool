/**
 * FretAgent Express application factory.
 *
 * Exports the fully configured Express app WITHOUT binding to a port so it
 * can be used by both the production entry-point (index.ts) and the test
 * suite (app.listen(0) + fetch) without port conflicts.
 *
 * Mounts:
 *   GET  /api/health                  — liveness probe
 *   POST /api/agent                   — Subconscious streaming agent (local-only)
 *   POST /api/tools/music-theory      — music theory lookup tool
 *   POST /api/tools/research-papers   — research paper lookup tool
 */

import express from "express";
import cors from "cors";
import { requireLocalRequest } from "./middleware/localOnly.js";
import { agentRouter } from "./routes/agent.js";
import { musicTheoryRouter } from "./tools/musicTheory.js";
import { researchPapersRouter } from "./tools/researchPapers.js";

/**
 * Creates and returns a configured Express application instance.
 *
 * @returns Configured Express app ready for HTTP server attachment or tests.
 */
export function createApp() {
  const app = express();

  app.use(
    cors({ origin: process.env.CORS_ORIGIN ?? "http://localhost:5173" }),
  );
  app.use(express.json({ type: "*/*" }));

  /** Simple liveness probe — returns { status: "ok" }. */
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // The agent spends the owner's Subconscious credits, so it must not be
  // reachable through the public ngrok tunnel or the LAN — see localOnly.ts.
  app.use("/api/agent", requireLocalRequest, agentRouter);
  app.use("/api/tools", musicTheoryRouter);
  app.use("/api/tools", researchPapersRouter);

  return app;
}
