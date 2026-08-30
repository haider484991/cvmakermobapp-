/**
 * Pure error predicates for the OpenRouter client.
 *
 * Split out of openrouter.ts purely so it is testable: that module reaches
 * Expo's virtual env at import time, which Jest cannot transform, so anything
 * imported alongside it becomes untestable. Everything here is a plain string
 * function with no runtime dependencies — the same shape as the rest of the
 * tested services in this codebase.
 */

/**
 * Does this error mean the endpoint refuses to have reasoning switched off?
 *
 * Seen live 2026-08-27: `openai/gpt-5-mini` (position 2 in the fallback chain)
 * hard-400s on `reasoning: {enabled:false}` with "Reasoning is mandatory for
 * this endpoint and cannot be disabled." Reproduced on gpt-5-nano too.
 *
 * Matched on the message because OpenRouter surfaces it as an ordinary 400
 * with no distinguishing code. Deliberately loose — both concepts, any order,
 * any casing — so a reworded upstream message does not silently stop the
 * retry from firing. Still strict enough that unrelated 400s (rate limits,
 * bad params) fall through and fail loudly instead of being retried.
 */
export function isReasoningMandatoryError(message?: string | null): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return m.includes('reasoning') && (m.includes('mandatory') || m.includes('cannot be disabled'));
}
