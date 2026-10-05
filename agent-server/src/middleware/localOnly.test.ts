/**
 * Unit tests for the local-only request predicate that guards POST /api/agent.
 *
 * The HTTP-level behaviour (403 through a tunnel, 200 locally) is covered in
 * routes/agent.test.ts; these tests pin down the address / header rules,
 * including non-loopback peers that cannot be simulated from a loopback test.
 */

import { describe, expect, it } from "vitest";
import { isLocalRequest } from "./localOnly.js";

describe("isLocalRequest", () => {
  it.each(["127.0.0.1", "::1", "::ffff:127.0.0.1"])("accepts the loopback address %s", (address) => {
    expect(isLocalRequest(address, {})).toBe(true);
  });

  it.each(["192.168.1.20", "10.0.0.5", "::ffff:192.168.1.20", "203.0.113.7"])(
    "rejects the non-loopback address %s",
    (address) => {
      expect(isLocalRequest(address, {})).toBe(false);
    },
  );

  it("rejects a request with no known remote address", () => {
    expect(isLocalRequest(undefined, {})).toBe(false);
  });

  it("rejects a loopback request that carries X-Forwarded-For (tunnel/proxy traffic)", () => {
    expect(isLocalRequest("127.0.0.1", { "x-forwarded-for": "1.2.3.4" })).toBe(false);
  });

  it("rejects a loopback request that carries a standard Forwarded header", () => {
    expect(isLocalRequest("127.0.0.1", { forwarded: "for=1.2.3.4" })).toBe(false);
  });

  it("rejects a loopback request with an empty X-Forwarded-For header", () => {
    expect(isLocalRequest("::1", { "x-forwarded-for": "" })).toBe(false);
  });
});
