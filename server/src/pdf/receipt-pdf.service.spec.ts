import { ReceiptPdfService } from './receipt-pdf.service';
import type { ReceiptPdfPayload } from './interfaces/receipt-pdf.interface';

describe('ReceiptPdfService', () => {
  let service: ReceiptPdfService;

  beforeEach(() => {
    service = new ReceiptPdfService();
  });

  const basePayload: ReceiptPdfPayload = {
    shopName: 'ZakPOS Demo Store',
    shopAddress: '123 Main St, Dhaka',
    documentNumber: 'INV-20261014-0001',
    documentTitle: 'TAX INVOICE',
    date: new Date('2026-10-14T10:30:00Z'),
    customerName: 'Jane Doe',
    customerPhone: '01700000000',
    lines: [
      { name: 'Tea 500g', qty: 2, unitPrice: 120, amount: 240 },
      { name: 'Sugar 1kg', qty: 1, unitPrice: 90, amount: 90 },
    ],
    subtotal: 330,
    discount: 30,
    tax: 45,
    total: 345,
    paymentMethod: 'bKash',
    currency: 'BDT',
    notes: 'Visit again',
  };

  it('renders a non-empty PDF buffer starting with the %PDF header', async () => {
    const bytes = await service.render(basePayload);

    expect(Buffer.isBuffer(bytes)).toBe(true);
    expect(bytes.length).toBeGreaterThan(0);
    expect(bytes.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });

  it('renders an empty-line-items payload without throwing', async () => {
    const bytes = await service.render({
      ...basePayload,
      lines: [],
      discount: 0,
      tax: 0,
      paymentMethod: null,
      notes: null,
    });

    expect(bytes.length).toBeGreaterThan(0);
    expect(bytes.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });

  it('accepts a narrow 58mm slip width', async () => {
    const bytes = await service.render({ ...basePayload, widthMm: 58 });
    expect(bytes.length).toBeGreaterThan(0);
  });
});
