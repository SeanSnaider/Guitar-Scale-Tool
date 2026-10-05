/**
 * Regression tests for POST /api/tools/research-papers.
 *
 * Exercised over HTTP against the real Express app. Covers request
 * validation (non-string query, non-array concepts) and query tokenisation
 * (stopwords and very short tokens must not match every entry).
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { postJson, startTestServer } from "../test/httpHelpers.js";
import type { TestServer } from "../test/httpHelpers.js";

/** Shape of a successful research-papers response. */
interface LookupResponse {
  results: { id: string; relevance_score: number }[];
  total_found: number;
}

let server: TestServer;

/**
 * Call the research papers tool.
 *
 * @param body - Tool request body.
 * @returns HTTP status and decoded JSON body.
 */
async function search(body: unknown): Promise<{ status: number; data: LookupResponse & { error?: string } }> {
  const res = await postJson(`${server.baseUrl}/api/tools/research-papers`, body);
  const text = await res.text();
  let data: LookupResponse & { error?: string };
  try {
    data = JSON.parse(text) as LookupResponse & { error?: string };
  } catch {
    data = { results: [], total_found: -1, error: text };
  }
  return { status: res.status, data };
}

beforeAll(async () => {
  server = await startTestServer();
});

afterAll(async () => {
  await server.close();
});

describe("research-papers tokenisation", () => {
  it("returns no results for a query made only of a one-letter word", async () => {
    const { status, data } = await search({ query: "a" });
    expect(status).toBe(200);
    expect(data.total_found).toBe(0);
  });

  it("returns no results for a query made only of stopwords", async () => {
    const { data } = await search({ query: "for the in of and" });
    expect(data.total_found).toBe(0);
  });

  it("ranks the matching entry first for a precise query", async () => {
    const { data } = await search({ query: "contextual interference" });
    expect(data.results[0]?.id).toBe("contextual-interference-blocked-vs-random");
  });

  it("does not let stopwords inflate relevance scores", async () => {
    const noisy = await search({ query: "what is the contextual interference effect for a guitarist" });
    const contentOnly = await search({ query: "contextual interference effect guitarist" });
    expect(noisy.data.results[0]?.id).toBe("contextual-interference-blocked-vs-random");
    expect(noisy.data.results).toEqual(contentOnly.data.results);
  });

  it("splits on punctuation so hyphenated or comma-joined terms still match", async () => {
    const { data } = await search({ query: "caged,fretboard" });
    expect(data.results.map((r) => r.id)).toContain("caged-system-overview");
  });

  it("still accepts the request wrapped in a parameters object", async () => {
    const { status, data } = await search({ parameters: { query: "deliberate practice" } });
    expect(status).toBe(200);
    expect(data.results[0]?.id).toBe("ericsson-1993-dp-definition");
  });
});

describe("research-papers validation", () => {
  it("rejects a non-array concepts value with 400", async () => {
    const { status } = await search({ query: "practice", concepts: "x" });
    expect(status).toBe(400);
  });

  it("rejects a non-string query with 400", async () => {
    const { status } = await search({ query: 5 });
    expect(status).toBe(400);
  });

  it("rejects a missing query with 400", async () => {
    const { status } = await search({});
    expect(status).toBe(400);
  });

  it("accepts a valid concepts array", async () => {
    const { status, data } = await search({ query: "scale shapes", concepts: ["minor pentatonic"] });
    expect(status).toBe(200);
    expect(data.results[0]?.id).toBe("pentatonic-shapes-fretboard");
  });
});
