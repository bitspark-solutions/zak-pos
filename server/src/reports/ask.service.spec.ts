import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AskService } from './ask.service';
import { ReportsService } from './reports.service';
import { LlmClient } from './llm-client';
import type { LlmReportPlan } from './llm-client';
import { addIsoDays, formatDateOnly, resolveDateRange } from './nl-parser';
import type {
  ReportEnvelope,
  ResolvedReportSpec,
  TenantShopOption,
} from './interfaces/reports.interface';

const TENANT = 'tenant-1';

const SHOPS: TenantShopOption[] = [
  { id: 'shop-1', name: 'Main Store' },
  { id: 'shop-2', name: 'Downtown' },
];

function fakeEnvelope(
  reportType: ResolvedReportSpec['reportType'],
): ReportEnvelope {
  return {
    reportType,
    rows: [],
  } as unknown as ReportEnvelope;
}

function validPlan(overrides: Partial<LlmReportPlan> = {}): LlmReportPlan {
  return {
    reportType: 'sales-summary',
    from: '2026-01-01',
    to: '2026-01-31',
    shopName: null,
    limit: null,
    sortBy: null,
    ...overrides,
  };
}

describe('AskService', () => {
  let service: AskService;

  const mockReportsService = {
    listTenantShops: jest.fn(),
    buildReport: jest.fn(),
  };
  const mockLlmClient = {
    isEnabled: jest.fn(),
    extractPlan: jest.fn(),
  };

  const lastSpec = (): ResolvedReportSpec =>
    mockReportsService.buildReport.mock.calls[0][0] as ResolvedReportSpec;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockLlmClient.isEnabled.mockReturnValue(false);
    mockLlmClient.extractPlan.mockResolvedValue(null);
    mockReportsService.listTenantShops.mockResolvedValue(SHOPS);
    mockReportsService.buildReport.mockResolvedValue(
      fakeEnvelope('sales-summary'),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AskService,
        { provide: ReportsService, useValue: mockReportsService },
        { provide: LlmClient, useValue: mockLlmClient },
      ],
    }).compile();

    service = module.get<AskService>(AskService);
  });

  // -------------------------------------------------------------------------
  // keyword engine (always available)
  // -------------------------------------------------------------------------

  describe('keyword parser engine', () => {
    it('resolves "top 5 products by quantity last 7 days" to a top-products spec', async () => {
      mockReportsService.buildReport.mockResolvedValue(
        fakeEnvelope('top-products'),
      );
      const now = new Date();
      const expectedRange = resolveDateRange(
        'top 5 products by quantity last 7 days',
        now,
      );

      const result = await service.ask(
        { question: 'top 5 products by quantity last 7 days' },
        TENANT,
      );

      expect(result.engine).toBe('keyword');
      expect(lastSpec()).toEqual<ResolvedReportSpec>({
        reportType: 'top-products',
        from: expectedRange.from,
        to: expectedRange.to,
        shopId: null,
        groupBy: 'day',
        limit: 5,
        sortBy: 'qty',
      });
      expect(mockLlmClient.extractPlan).not.toHaveBeenCalled();
    });

    it('defaults to the last 30 days and yesterday works per phrase', async () => {
      await service.ask({ question: 'how were sales yesterday' }, TENANT);
      const yesterday = addIsoDays(formatDateOnly(new Date()), -1);
      expect(lastSpec()).toMatchObject({
        reportType: 'sales-summary',
        from: yesterday,
        to: yesterday,
      });

      mockReportsService.buildReport.mockClear();
      await service.ask({ question: 'monthly revenue trend' }, TENANT);
      const today = formatDateOnly(new Date());
      expect(lastSpec()).toMatchObject({
        reportType: 'sales-summary',
        from: addIsoDays(today, -29),
        to: today,
      });
    });

    it('fuzzy-matches a shop name and honours an explicit shopId override', async () => {
      await service.ask(
        { question: 'sales at the downtown branch this month' },
        TENANT,
      );
      expect(lastSpec().shopId).toBe('shop-2');

      mockReportsService.buildReport.mockClear();
      await service.ask(
        { question: 'sales at the downtown branch', shopId: 'shop-1' },
        TENANT,
      );
      expect(lastSpec().shopId).toBe('shop-1');
    });

    it('answers 400 listing the supported topics when nothing resolves', async () => {
      await expect(
        service.ask({ question: 'tell me about the weather' }, TENANT),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.ask({ question: 'tell me about the weather' }, TENANT),
      ).rejects.toThrow(
        /sales summary.*top products.*sales by category.*payment methods.*inventory valuation/s,
      );
      expect(mockReportsService.buildReport).not.toHaveBeenCalled();
    });

    it('rejects blank and overlong questions with 400', async () => {
      await expect(
        service.ask({ question: '    ' }, TENANT),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.ask({ question: 'x'.repeat(501) }, TENANT),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mockReportsService.buildReport).not.toHaveBeenCalled();
    });

    it('produces the pinned interpretation sentence', async () => {
      const result = await service.ask({ question: 'top products' }, TENANT);
      const today = formatDateOnly(new Date());
      expect(result.interpretation).toBe(
        `Top products by revenue from ${addIsoDays(today, -29)} to ${today}`,
      );
    });
  });

  // -------------------------------------------------------------------------
  // LLM engine + transparent fallback
  // -------------------------------------------------------------------------

  describe('LLM engine', () => {
    it('uses a valid LLM plan and reports engine=llm', async () => {
      mockLlmClient.isEnabled.mockReturnValue(true);
      mockLlmClient.extractPlan.mockResolvedValue(
        validPlan({
          reportType: 'top-products',
          shopName: 'Downtown',
          limit: 5,
          sortBy: 'qty',
        }),
      );
      mockReportsService.buildReport.mockResolvedValue(
        fakeEnvelope('top-products'),
      );

      const result = await service.ask(
        { question: 'which products sold best?' },
        TENANT,
      );

      expect(mockLlmClient.extractPlan).toHaveBeenCalledWith(
        'which products sold best?',
        formatDateOnly(new Date()),
      );
      expect(result.engine).toBe('llm');
      expect(lastSpec()).toEqual<ResolvedReportSpec>({
        reportType: 'top-products',
        from: '2026-01-01',
        to: '2026-01-31',
        shopId: 'shop-2',
        groupBy: 'day',
        limit: 5,
        sortBy: 'qty',
      });
    });

    it('an explicit body shopId overrides even the LLM shopName', async () => {
      mockLlmClient.isEnabled.mockReturnValue(true);
      mockLlmClient.extractPlan.mockResolvedValue(
        validPlan({ shopName: 'Downtown' }),
      );

      const result = await service.ask(
        { question: 'weekly sales', shopId: 'shop-1' },
        TENANT,
      );

      expect(result.engine).toBe('llm');
      expect(lastSpec().shopId).toBe('shop-1');
    });

    it('falls back to the keyword parser when the LLM throws', async () => {
      mockLlmClient.isEnabled.mockReturnValue(true);
      mockLlmClient.extractPlan.mockRejectedValue(new Error('network down'));

      const result = await service.ask(
        { question: 'cash vs card yesterday' },
        TENANT,
      );

      expect(result.engine).toBe('keyword');
      expect(lastSpec()).toMatchObject({
        reportType: 'payment-methods',
      });
    });

    it('falls back when the plan has an unknown reportType', async () => {
      mockLlmClient.isEnabled.mockReturnValue(true);
      mockLlmClient.extractPlan.mockResolvedValue(
        validPlan({ reportType: 'employee-of-the-month' }),
      );

      const result = await service.ask({ question: 'sales summary' }, TENANT);

      expect(result.engine).toBe('keyword');
      expect(lastSpec().reportType).toBe('sales-summary');
    });

    it('falls back when the plan dates are malformed', async () => {
      mockLlmClient.isEnabled.mockReturnValue(true);
      mockLlmClient.extractPlan.mockResolvedValue(
        validPlan({ from: '31/01/2026', to: 'not-a-date' }),
      );

      const result = await service.ask(
        { question: 'how are sales this month' },
        TENANT,
      );

      expect(result.engine).toBe('keyword');
      expect(lastSpec().reportType).toBe('sales-summary');
    });

    it('400s when the LLM fails AND the keyword parser matches nothing', async () => {
      mockLlmClient.isEnabled.mockReturnValue(true);
      mockLlmClient.extractPlan.mockResolvedValue(null);

      await expect(
        service.ask({ question: 'who is the president' }, TENANT),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('passes every resolved field through to the ReportsService envelope', async () => {
      const envelope = fakeEnvelope('sales-summary');
      mockReportsService.buildReport.mockResolvedValue(envelope);

      const result = await service.ask({ question: 'daily sales' }, TENANT);

      // Response envelope keys are exactly {interpretation, engine, report}.
      expect(Object.keys(result).sort()).toEqual([
        'engine',
        'interpretation',
        'report',
      ]);
      expect(result.report).toBe(envelope);
      expect(mockReportsService.buildReport).toHaveBeenCalledWith(
        expect.objectContaining({ reportType: 'sales-summary' }),
        TENANT,
      );
    });
  });
});
