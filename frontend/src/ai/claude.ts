/**
 * claude.ts
 *
 * The one place the app builds a Claude client and turns its errors into
 * copy. Every request goes straight from the browser to api.anthropic.com
 * with the user's own key (see apiKey.ts); there is no proxy.
 */

import Anthropic from '@anthropic-ai/sdk';

/** Model for every Claude feature in the app. */
export const CLAUDE_MODEL = 'claude-sonnet-5-5';

/**
 * Server-side refusal fallback: a declined request is re-run on the model
 * Anthropic recommends for that refusal category, inside the same call.
 * This header pairs with `fallbacks: 'default'` (the array form uses a
 * different header and 400s with this one).
 */
export const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

/**
 * Builds a client for one feature.
 *
 * dangerouslyAllowBrowser is the SDK's acknowledgement that the key is in the
 * page. That's the design here: it's the user's own key in their own browser,
 * never a key shipped in the build.
 *
 * @param apiKey - The user's Anthropic API key.
 */
export function createClaudeClient(apiKey: string): Anthropic {
  return new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
    maxRetries: 2,
    timeout: 120_000,
  });
}

/** True for a request we cancelled ourselves (unmount, superseded, Stop). */
export function isCancelledRequest(err: unknown): boolean {
  return err instanceof Anthropic.APIUserAbortError || (err instanceof DOMException && err.name === 'AbortError');
}

/**
 * Turns an SDK error into a message with a next step. Typed classes, not
 * message matching, per the SDK's error model.
 *
 * @param err - Anything thrown by a Claude call.
 */
export function describeClaudeError(err: unknown): string {
  if (err instanceof Anthropic.APIConnectionTimeoutError) return 'Anthropic took too long to respond. Try again.';
  if (err instanceof Anthropic.APIConnectionError) {
    return "Couldn't reach Anthropic. Check your internet connection and try again.";
  }
  if (err instanceof Anthropic.AuthenticationError) return 'Anthropic rejected that API key. Clear it and set it again.';
  if (err instanceof Anthropic.PermissionDeniedError) return "This API key doesn't have permission to use that model.";
  if (err instanceof Anthropic.NotFoundError) return `The requested model wasn't found (${err.message}).`;
  if (err instanceof Anthropic.RateLimitError) return 'Rate limited by Anthropic. Wait a moment, then try again.';
  if (err instanceof Anthropic.APIError) {
    if (err.status === 413) return 'The conversation is too long to send. Start a new one.';
    if (err.status !== undefined && err.status >= 500) {
      return `Anthropic's API is having trouble right now (${err.status}). Try again in a minute.`;
    }
    return `Request failed: ${err.message}`;
  }
  return err instanceof Error && err.message ? err.message : 'Something went wrong. Try again.';
}
