/**
 * researchPapers.ts
 *
 * The Coach's research_paper_lookup tool: keyword search over curated
 * excerpts from practice-science papers and guitar pedagogy (papers.json).
 * Ported from FretAgent's server endpoint so it runs in the browser; the
 * scoring is the same (one point per query term found in an excerpt's text,
 * concepts, theme or applies_to), with two additions:
 *   - stopwords and one-letter tokens are dropped, since "how to practice
 *     for speed" otherwise scores nearly every excerpt on "to" and "for";
 *   - duplicate terms count once.
 */

import papers from './papers.json';

/** One curated excerpt in papers.json. */
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

/** One search hit, as returned to the model. */
export interface LookupResult {
  id: string;
  title: string;
  authors: string;
  year: number | null;
  theme: string;
  excerpt: string;
  relevance_score: number;
}

/** Most results returned per lookup. */
const MAX_RESULTS = 3;

const STOPWORDS = new Set(
  'a an and are as at be by can do for from how i in into is it its me my of on or so that the this to up use what when with you your'.split(
    ' ',
  ),
);

/**
 * Splits a query into distinct lowercase search terms.
 *
 * @param text - Free text.
 */
function terms(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''))
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/**
 * Scores one excerpt: the number of query terms found anywhere in its
 * searchable fields.
 *
 * @param entry - An excerpt from papers.json.
 * @param queryTerms - Distinct lowercase terms.
 */
function scoreEntry(entry: PaperEntry, queryTerms: string[]): number {
  const haystack = [
    entry.text,
    entry.metadata.concepts.join(' '),
    entry.metadata.theme,
    entry.metadata.applies_to.join(' '),
  ]
    .join(' ')
    .toLowerCase();
  return queryTerms.filter((t) => haystack.includes(t)).length;
}

/**
 * Finds the excerpts most relevant to a query.
 *
 * @param query - Free-text query from the model.
 * @param concepts - Optional extra keywords; multi-word concepts are matched whole.
 * @returns Up to three results, best first.
 */
export function searchPapers(query: string, concepts: string[] = []): LookupResult[] {
  const queryTerms = [
    ...new Set([...concepts.map((c) => c.trim().toLowerCase()).filter(Boolean), ...terms(query)]),
  ];
  return (papers as PaperEntry[])
    .map((entry) => ({ entry, score: scoreEntry(entry, queryTerms) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESULTS)
    .map(({ entry, score }) => ({
      id: entry.id,
      title: entry.metadata.source_title,
      authors: entry.metadata.authors,
      year: entry.metadata.year,
      theme: entry.metadata.theme,
      excerpt: entry.text,
      relevance_score: score,
    }));
}
