import { BadRequestException, Injectable } from '@nestjs/common';
import { LlmClient } from './llm-client';
import type { LlmReportPlan } from './llm-client';
import { ReportsService } from './reports.service';
import {
  clampLimit,
  formatDateOnly,
  interpretSpec,
  isReportType,
  isValidIsoDate,
  matchShopByName,
  parseQuestion,
  toResolvedSpec,
} from './nl-parser';
import type { AskReportDto } from './dto/ask.dto';
import type {
  AskEngine,
  AskReportResponse,
  ResolvedReportSpec,
  TenantShopOption,
} from './interfaces/reports.interface';

/** Shown in the 400 when no reportType can be resolved. */
const UNSUPPORTED_QUESTION_MESSAGE =
  'Could not map that question to a report. Supported topics: sales summary, ' +
  'top products, sales by category, payment methods, inventory valuation. ' +
  'Example: "top 5 products by revenue last 7 days".';

/** Hard length ceiling for the raw LLM prompt (DTO already enforces 1..500). */
const MAX_QUESTION_LENGTH = 500;

/**
 * Orchestrates POST /reports/ask:
 *   (a) when OPENAI_API_KEY is configured, try LLM plan extraction first;
 *   (b) ALWAYS fall back to the deterministic keyword parser (nl-parser) —
 *       transparently, on any exception or invalid LLM output.
 * The produced ResolvedReportSpec is executed by ReportsService, so the
 * envelope in the answer is byte-for-byte the same shape as the GET endpoint.
 */
@Injectable()
export class AskService {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly llmClient: LlmClient,
  ) {}

  async ask(dto: AskReportDto, tenantId: string): Promise<AskReportResponse> {
    const question = (dto.question ?? '').trim();
    if (question === '' || question.length > MAX_QUESTION_LENGTH) {
      throw new BadRequestException(
        'question must be a non-empty string of at most 500 characters',
      );
    }
    const explicitShopId =
      dto.shopId !== undefined && dto.shopId.trim() !== ''
        ? dto.shopId.trim()
        : undefined;

    const shops = await this.reportsService.listTenantShops(tenantId);
    const now = new Date();

    const resolved = await this.resolveSpec(
      question,
      shops,
      explicitShopId,
      now,
    );
    if (resolved === null) {
      throw new BadRequestException(UNSUPPORTED_QUESTION_MESSAGE);
    }

    const report = await this.reportsService.buildReport(
      resolved.spec,
      tenantId,
    );
    const shopName =
      resolved.spec.shopId === null
        ? null
        : (shops.find((shop) => shop.id === resolved.spec.shopId)?.name ??
          null);

    return {
      interpretation: interpretSpec(resolved.spec, shopName),
      engine: resolved.engine,
      report,
    };
  }

  private async resolveSpec(
    question: string,
    shops: readonly TenantShopOption[],
    explicitShopId: string | undefined,
    now: Date,
  ): Promise<{ spec: ResolvedReportSpec; engine: AskEngine } | null> {
    if (this.llmClient.isEnabled()) {
      let plan: LlmReportPlan | null = null;
      try {
        plan = await this.llmClient.extractPlan(question, formatDateOnly(now));
      } catch {
        plan = null; // belt & braces: the client already swallows its errors
      }
      const spec = this.planToSpec(plan, shops, explicitShopId);
      if (spec !== null) {
        return { spec, engine: 'llm' };
      }
      // Unusable plan: fall through to the keyword parser transparently.
    }

    const parsed = parseQuestion(question, { shops, now, explicitShopId });
    const spec = toResolvedSpec(parsed);
    if (spec === null) {
      return null;
    }
    return { spec, engine: 'keyword' };
  }

  /**
   * Whitelist gate for the UNTRUSTED LLM plan: every field is validated and
   * narrowed; any violation voids the plan so the keyword parser takes over.
   */
  private planToSpec(
    plan: LlmReportPlan | null,
    shops: readonly TenantShopOption[],
    explicitShopId: string | undefined,
  ): ResolvedReportSpec | null {
    if (plan === null || !isReportType(plan.reportType)) {
      return null;
    }
    if (
      !isValidIsoDate(plan.from) ||
      !isValidIsoDate(plan.to) ||
      plan.from > plan.to
    ) {
      return null;
    }
    const sortBy = plan.sortBy === 'qty' ? 'qty' : 'revenue';
    const shopId =
      explicitShopId ??
      (plan.shopName !== null
        ? (matchShopByName(plan.shopName, shops)?.id ?? null)
        : null);

    return {
      reportType: plan.reportType,
      from: plan.from,
      to: plan.to,
      shopId,
      groupBy: 'day',
      limit: clampLimit(plan.limit),
      sortBy,
    };
  }
}
