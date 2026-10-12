import { Injectable, Logger } from '@nestjs/common';

/** Default OpenAI-compatible endpoint when OPENAI_BASE_URL is unset. */
const DEFAULT_OPENAI_BASE = 'https://api.openai.com/v1';
/** Default model when LLM_MODEL is unset. */
const DEFAULT_LLM_MODEL = 'gpt-4o-mini';
/** Hard ceiling for one chat-completions round-trip. */
const LLM_TIMEOUT_MS = 8000;

/**
 * Raw plan fields as the LLM was instructed to return them. Everything is
 * `string | number | null`-wide on purpose: this is UNTRUSTED input and the
 * caller (ask.service) validates/whitelists every field before use.
 */
export interface LlmReportPlan {
  reportType: string | null;
  from: string | null;
  to: string | null;
  shopName: string | null;
  limit: number | null;
  sortBy: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asArray(value: unknown): readonly unknown[] | null {
  return Array.isArray(value) ? (value as readonly unknown[]) : null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function finiteNumberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Pull `choices[0].message.content` out of a chat-completions response. */
function extractMessageContent(payload: unknown): string | null {
  if (!isRecord(payload)) {
    return null;
  }
  const choices = asArray(payload['choices']);
  if (choices === null) {
    return null;
  }
  const first = choices[0];
  if (!isRecord(first)) {
    return null;
  }
  const message = first['message'];
  if (!isRecord(message)) {
    return null;
  }
  return stringOrNull(message['content']);
}

/** Narrow the parsed JSON object into an LlmReportPlan (no validation yet). */
export function normalizeLlmPlan(plan: unknown): LlmReportPlan {
  if (!isRecord(plan)) {
    return {
      reportType: null,
      from: null,
      to: null,
      shopName: null,
      limit: null,
      sortBy: null,
    };
  }
  return {
    reportType: stringOrNull(plan['reportType']),
    from: stringOrNull(plan['from']),
    to: stringOrNull(plan['to']),
    shopName: stringOrNull(plan['shopName']),
    limit: finiteNumberOrNull(plan['limit']),
    sortBy: stringOrNull(plan['sortBy']),
  };
}

/**
 * System prompt: forces one strict JSON object. `today` anchors relative
 * date phrases; every value is treated as untrusted on the way back in.
 */
function buildSystemPrompt(todayIso: string): string {
  return [
    'You are a report router for a point-of-sale system. Today is ' +
      todayIso +
      '. From the user question, output ONE JSON object and nothing else, with exactly these keys:',
    '{"reportType": "sales-summary" | "top-products" | "sales-by-category" | "payment-methods" | "inventory-valuation",',
    '"from": "YYYY-MM-DD", "to": "YYYY-MM-DD", "shopName": string or null,',
    '"limit": number or null, "sortBy": "revenue" | "qty" or null}.',
    'reportType is required; use the closest match for what the user asks.',
    'from/to are inclusive day boundaries; when the user does not mention dates, use the last 30 days.',
    'inventory-valuation has no date range but still return from/to as described.',
    'shopName is the shop the user means, verbatim if quoted, else best effort; null when not specified.',
    'limit only matters for top-products (default 10); sortBy only matters for top-products.',
    'Never invent keys. Never wrap the JSON in markdown.',
  ].join('\n');
}

/**
 * Thin OpenAI-compatible chat-completions client built on the global fetch —
 * no extra dependencies. Entirely optional: when OPENAI_API_KEY is unset,
 * `isEnabled()` is false and the caller uses the keyword parser. The API key
 * is never logged.
 */
@Injectable()
export class LlmClient {
  private readonly logger = new Logger(LlmClient.name);

  isEnabled(): boolean {
    return (process.env.OPENAI_API_KEY ?? '').trim() !== '';
  }

  private baseUrl(): string {
    const url = process.env.OPENAI_BASE_URL;
    return (url && url.trim()) || DEFAULT_OPENAI_BASE;
  }

  private model(): string {
    const model = process.env.LLM_MODEL;
    return (model && model.trim()) || DEFAULT_LLM_MODEL;
  }

  /**
   * Returns the raw plan fields on success, or null on ANY failure (missing
   * key, network error, timeout, non-2xx, malformed JSON) so the caller can
   * fall back to the keyword parser transparently.
   */
  async extractPlan(
    question: string,
    todayIso: string,
  ): Promise<LlmReportPlan | null> {
    const apiKey = (process.env.OPENAI_API_KEY ?? '').trim();
    if (apiKey === '') {
      return null;
    }
    try {
      const response = await fetch(`${this.baseUrl()}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: this.model(),
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: buildSystemPrompt(todayIso) },
            { role: 'user', content: question },
          ],
        }),
        signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
      });
      if (!response.ok) {
        // Status only — never log headers/auth.
        this.logger.warn(
          `LLM plan request failed with status ${response.status}`,
        );
        return null;
      }
      const payload: unknown = await response.json();
      const content = extractMessageContent(payload);
      if (content === null) {
        this.logger.warn('LLM plan response contained no message content');
        return null;
      }
      const parsed: unknown = JSON.parse(content);
      return normalizeLlmPlan(parsed);
    } catch (error) {
      this.logger.warn(
        `LLM plan extraction failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }
}
