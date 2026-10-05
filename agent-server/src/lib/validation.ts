/**
 * Shared request-validation helpers.
 *
 * Route handlers validate their bodies with zod schemas; this module turns a
 * ZodError into a single readable message suitable for a 400 JSON response
 * (e.g. "goal: Expected string, received number").
 */

import type { ZodError } from "zod";

/**
 * Format a ZodError as a human-readable, semicolon-separated message.
 *
 * @param error - The validation error returned by schema.safeParse().
 * @returns One "path: message" entry per issue, joined with "; ".
 */
export function formatZodError(error: ZodError): string {
  return error.issues
    .map((issue) => (issue.path.length > 0 ? `${issue.path.join(".")}: ${issue.message}` : issue.message))
    .join("; ");
}
