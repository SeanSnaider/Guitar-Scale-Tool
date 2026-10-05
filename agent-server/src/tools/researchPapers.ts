/**
 * Research paper lookup tool endpoint.
 *
 * Exposes POST /api/tools/research-papers for the Subconscious agent to call.
 * Searches curated excerpts from practice methodology and music theory research,
 * returning the most relevant passages for a given query.
 *
 * Request bodies are validated with zod (400 on invalid input). Queries are
 * tokenised on non-alphanumeric characters with short tokens and common
 * English stopwords removed, because substring matching on words like "a" or
 * "for" would match nearly every entry and drown out real relevance.
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import papers from "../data/papers.json" with { type: "json" };
import { formatZodError } from "../lib/validation.js";

export const researchPapersRouter = Router();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PaperEntry {
  id: string;
  text: string;
  metadata: {
    source_id: string;
    source_title: string;
    authors: string;
    year: number | null;
    venue: string;
    bucket: string;
    theme: string;
    concepts: string[];
    applies_to: string[];
  };
}

/** Schema for the tool request body (optionally wrapped in `parameters`). */
const lookupRequestSchema = z.object({
  query: z
    .string({ required_error: "is required", invalid_type_error: "must be a string" })
    .trim()
    .min(1, "is required"),
  concepts: z.array(z.string(), { invalid_type_error: "must be an array of strings" }).optional(),
});

interface LookupResult {
  id: string;
  title: string;
  authors: string;
  year: number | null;
  theme: string;
  excerpt: string;
  relevance_score: number;
}

// ---------------------------------------------------------------------------
// Query tokenisation
// ---------------------------------------------------------------------------

/** Tokens shorter than this substring-match too broadly to be useful. */
const MIN_TERM_LENGTH = 3;

/** Common English function words (3+ letters) that carry no topical meaning. */
const STOPWORDS: ReadonlySet<string> = new Set([
  "the", "and", "for", "are", "but", "not", "you", "your", "with", "from", "this", "that",
  "these", "those", "what", "which", "who", "whom", "how", "why", "when", "where", "can",
  "could", "should", "would", "will", "does", "did", "has", "have", "had", "was", "were",
  "been", "being", "into", "onto", "about", "than", "then", "there", "their", "them", "they",
  "its", "our", "out", "any", "all", "some", "more", "most", "very", "just", "also", "over",
  "such", "only", "own", "same", "too", "via", "per",
]);

/**
 * Split free text into lowercase search terms, dropping short tokens and stopwords.
 *
 * @param text - Free-text query.
 * @returns Meaningful lowercase terms (may contain duplicates).
 */
function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length >= MIN_TERM_LENGTH && !STOPWORDS.has(token));
}

/**
 * Build the deduplicated term list for a search.
 * Query words are tokenised; concepts are kept as whole (lowercased) phrases
 * so multi-word concepts like "minor pentatonic" still match as phrases.
 *
 * @param query - Free-text query.
 * @param concepts - Extra keyword phrases.
 * @returns Unique search terms.
 */
export function buildSearchTerms(query: string, concepts: string[] = []): string[] {
  const conceptTerms = concepts
    .map((concept) => concept.trim().toLowerCase())
    .filter((concept) => concept.length >= MIN_TERM_LENGTH && !STOPWORDS.has(concept));
  return [...new Set([...tokenise(query), ...conceptTerms])];
}

// ---------------------------------------------------------------------------
// Search logic
// ---------------------------------------------------------------------------

/**
 * Score a single paper entry against the query terms.
 *
 * @param entry - A single paper entry from papers.json.
 * @param queryTerms - Unique lowercase search terms (see buildSearchTerms).
 * @returns Count of query terms found across the entry's searchable fields.
 */
function scoreEntry(entry: PaperEntry, queryTerms: string[]): number {
  const combined = [
    entry.text,
    entry.metadata.concepts.join(" "),
    entry.metadata.theme,
    entry.metadata.applies_to.join(" "),
  ]
    .join(" ")
    .toLowerCase();

  let score = 0;
  for (const term of queryTerms) {
    if (combined.includes(term)) score += 1;
  }
  return score;
}

/**
 * Search all papers for entries relevant to the query.
 * Returns up to 3 results sorted by relevance score descending.
 *
 * @param query - Free-text query from the agent.
 * @param concepts - Optional extra keywords to boost matching.
 * @returns Sorted array of the top matching results.
 */
export function searchPapers(query: string, concepts: string[] = []): LookupResult[] {
  const queryTerms = buildSearchTerms(query, concepts);
  if (queryTerms.length === 0) return [];

  const results: LookupResult[] = [];

  for (const entry of papers as PaperEntry[]) {
    const score = scoreEntry(entry, queryTerms);
    if (score > 0) {
      results.push({
        id: entry.id,
        title: entry.metadata.source_title,
        authors: entry.metadata.authors,
        year: entry.metadata.year,
        theme: entry.metadata.theme,
        excerpt: entry.text,
        relevance_score: score,
      });
    }
  }

  results.sort((a, b) => b.relevance_score - a.relevance_score);
  return results.slice(0, 3);
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

researchPapersRouter.post("/research-papers", (req: Request, res: Response) => {
  const body: unknown = req.body?.parameters ?? req.body ?? {};
  const parsed = lookupRequestSchema.safeParse(body);
  if (!parsed.success) {
    res.status(400).json({ error: formatZodError(parsed.error) });
    return;
  }

  try {
    const results = searchPapers(parsed.data.query, parsed.data.concepts);
    res.json({ results, total_found: results.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});
