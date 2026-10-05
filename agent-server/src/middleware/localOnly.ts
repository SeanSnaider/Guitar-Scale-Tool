/**
 * Local-only access guard for endpoints that spend the owner's API credits.
 *
 * Why this exists: the README has users expose port 3001 publicly via ngrok
 * (TOOL_BASE_URL) so the remote Subconscious service can call back into
 * /api/tools/*. That tunnel exposes every route on the port, including
 * POST /api/agent, which would let anyone on the internet start agent runs
 * billed to the owner's SUBCONSCIOUS_API_KEY. The server also binds 0.0.0.0,
 * so the endpoint is reachable from the LAN too.
 *
 * Rule: a request is "local" only when BOTH hold:
 *   1. The TCP peer is a loopback address. This rejects LAN clients.
 *   2. No forwarding header (X-Forwarded-For / Forwarded) is present.
 *      ngrok's agent runs on this machine, so tunnelled requests arrive
 *      from 127.0.0.1 — but ngrok always adds X-Forwarded-For. The Vite dev
 *      proxy (frontend/vite.config.ts) does NOT add it, because http-proxy's
 *      `xfwd` option defaults to false and is not enabled there.
 *
 * Header presence (not its value) is what matters: a forwarding header can be
 * spoofed to look local, but a genuinely local client has no reason to send
 * one, so any such header is treated as remote.
 *
 * Tool endpoints are intentionally NOT guarded: they serve static lookup data
 * and must stay reachable through the tunnel for the agent's tool calls.
 */

import type { IncomingHttpHeaders } from "node:http";
import type { NextFunction, Request, Response } from "express";

/** Peer addresses Node reports for loopback connections (IPv4, IPv6, IPv4-mapped IPv6). */
const LOOPBACK_ADDRESSES: ReadonlySet<string> = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

/** Headers whose presence means the request was relayed by a proxy or tunnel. */
const FORWARDING_HEADERS = ["x-forwarded-for", "forwarded"] as const;

/**
 * Decide whether a request originates from this machine without a proxy hop.
 *
 * @param remoteAddress - The socket's peer address (req.socket.remoteAddress).
 * @param headers - The request headers.
 * @returns True only for a loopback peer with no forwarding headers.
 */
export function isLocalRequest(remoteAddress: string | undefined, headers: IncomingHttpHeaders): boolean {
  if (remoteAddress === undefined || !LOOPBACK_ADDRESSES.has(remoteAddress)) return false;
  return FORWARDING_HEADERS.every((name) => headers[name] === undefined);
}

/**
 * Express middleware that rejects non-local requests with 403 JSON.
 *
 * @param req - Incoming request.
 * @param res - Response used to send the 403.
 * @param next - Continues to the guarded router for local requests.
 */
export function requireLocalRequest(req: Request, res: Response, next: NextFunction): void {
  if (isLocalRequest(req.socket.remoteAddress, req.headers)) {
    next();
    return;
  }
  res.status(403).json({
    error: "This endpoint only accepts requests from the local machine (not via a proxy or tunnel).",
  });
}
