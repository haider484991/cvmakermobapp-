/**
 * Regression test for the "Reasoning is mandatory" production failure.
 *
 * Seen live 2026-08-27: three errors in three minutes from one user. Every
 * structured AI call sends `reasoning: {enabled:false}` (added in v1.13.0 to
 * stop reasoning tokens eating the max_tokens budget and truncating JSON), and
 * openai/gpt-5-mini — position 2 in the fallback chain — rejects that outright
 * with a 400. Reproduced against the live API on both gpt-5-mini and gpt-5-nano.
 *
 * The matcher is what makes the recovery fire, so it is tested directly: too
 * strict and the retry silently stops working the next time the upstream
 * message is reworded, too loose and unrelated 400s get retried pointlessly.
 */

import { isReasoningMandatoryError } from '@/lib/openrouterErrors';

describe('isReasoningMandatoryError', () => {
  it('matches the exact message seen in production', () => {
    expect(
      isReasoningMandatoryError('Reasoning is mandatory for this endpoint and cannot be disabled.'),
    ).toBe(true);
  });

  it('survives rewording, casing and partial phrasing', () => {
    expect(isReasoningMandatoryError('reasoning is MANDATORY here')).toBe(true);
    expect(isReasoningMandatoryError('Reasoning cannot be disabled for this model')).toBe(true);
    expect(isReasoningMandatoryError('This endpoint requires reasoning; it is mandatory.')).toBe(true);
  });

  it('does NOT match unrelated errors — those must fail loudly, not retry', () => {
    expect(isReasoningMandatoryError('Provider returned error')).toBe(false);
    expect(isReasoningMandatoryError('Rate limit exceeded')).toBe(false);
    expect(isReasoningMandatoryError('models must have 3 items or fewer')).toBe(false);
    expect(
      isReasoningMandatoryError(
        "Response input messages must contain the word 'json' in some form to use 'text.format'",
      ),
    ).toBe(false);
    // "mandatory" alone is not enough — it must be about reasoning.
    expect(isReasoningMandatoryError('The model parameter is mandatory')).toBe(false);
  });

  it('handles missing input without throwing', () => {
    expect(isReasoningMandatoryError(undefined)).toBe(false);
    expect(isReasoningMandatoryError(null)).toBe(false);
    expect(isReasoningMandatoryError('')).toBe(false);
  });
});
