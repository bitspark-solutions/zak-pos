/**
 * Unit tests for the pure add-product helpers (npm test -> jest + ts-jest).
 * Covers the CSV payload builder that product-import/commit consumes
 * (digit barcodes vs non-digit -> SKU fallback, escaping, money parsing),
 * the opening-stock IN payload mapper, form validation and the role gate.
 */
import {
  AddProductForm,
  buildOpeningStockPayload,
  buildProductImportCsv,
  canCreateProduct,
  csvCell,
  isScannableBarcode,
  parseAmountInput,
  resolveUnit,
  validateAddProductForm,
} from './product-helpers';

const baseForm: AddProductForm = {
  barcode: '8801111000015',
  name: 'Green Tea 500g',
  basePrice: '120',
  defaultCost: '45',
  unit: 'pcs',
  otherUnit: '',
  isWeighted: false,
  categoryName: null,
  stockQty: '',
  stockCost: '',
};

describe('parseAmountInput', () => {
  it('parses money strings, rejects garbage/negatives/empty', () => {
    expect(parseAmountInput('120')).toBe(120);
    expect(parseAmountInput(' 49.5 ')).toBe(49.5);
    expect(parseAmountInput('0')).toBe(0);
    expect(parseAmountInput('')).toBeNull();
    expect(parseAmountInput('abc')).toBeNull();
    expect(parseAmountInput('-5')).toBeNull();
  });

  it('rounds to 2 decimals', () => {
    expect(parseAmountInput('10.005')).toBe(10.01);
  });
});

describe('isScannableBarcode', () => {
  it('accepts pure-digit codes only (server keeps digits)', () => {
    expect(isScannableBarcode('8801111000015')).toBe(true);
    expect(isScannableBarcode(' 12345 ')).toBe(true);
    expect(isScannableBarcode('AB-123')).toBe(false);
    expect(isScannableBarcode('')).toBe(false);
  });
});

describe('validateAddProductForm', () => {
  it('requires name and a valid basePrice', () => {
    expect(validateAddProductForm(baseForm)).toEqual({});
    expect(validateAddProductForm({ ...baseForm, name: '  ' })).toEqual({
      name: 'Give the product a name.',
    });
    expect(validateAddProductForm({ ...baseForm, basePrice: '' })).toEqual({
      basePrice: 'Enter a valid selling price (0 or more).',
    });
    expect(
      validateAddProductForm({ name: '', basePrice: 'x' })
    ).toEqual({
      name: 'Give the product a name.',
      basePrice: 'Enter a valid selling price (0 or more).',
    });
  });
});

describe('resolveUnit', () => {
  it('maps the Other chip to free text, falling back to pcs', () => {
    expect(resolveUnit({ unit: 'kg', otherUnit: '' })).toBe('kg');
    expect(resolveUnit({ unit: 'other', otherUnit: ' drum ' })).toBe('drum');
    expect(resolveUnit({ unit: 'other', otherUnit: '' })).toBe('pcs');
  });
});

describe('csvCell', () => {
  it('quotes and doubles embedded quotes, flattens newlines', () => {
    expect(csvCell('Tea, green')).toBe('"Tea, green"');
    expect(csvCell('5" pipe')).toBe('"5"" pipe"');
    expect(csvCell('line1\nline2')).toBe('"line1 line2"');
  });
});

describe('buildProductImportCsv', () => {
  it('builds a header + one data row with the digit barcode attached', () => {
    const csv = buildProductImportCsv(baseForm);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe('"Name","Barcode","Sku","Price","Cost","Unit","Category"');
    expect(lines[1]).toBe(
      '"Green Tea 500g","8801111000015","","120","45","pcs",""'
    );
  });

  it('routes a non-digit code to the Sku column (Barcode would drop it)', () => {
    const csv = buildProductImportCsv({ ...baseForm, barcode: 'AB-123' });
    expect(csv.split('\n')[1]).toContain('"AB-123"');
    const cells = csv.split('\n')[1].split('","');
    expect(cells[1]).toBe(''); // Barcode column empty
  });

  it('omits blank cost/price/stock-independent fields', () => {
    const csv = buildProductImportCsv({ ...baseForm, defaultCost: '', categoryName: 'Drinks' });
    expect(csv.split('\n')[1]).toBe(
      '"Green Tea 500g","8801111000015","","120","","pcs","Drinks"'
    );
  });
});

describe('buildOpeningStockPayload', () => {
  it('returns null when qty is blank/zero or shop is missing', () => {
    expect(buildOpeningStockPayload('shop-1', 'p-1', { stockQty: '', stockCost: '', defaultCost: '5' })).toBeNull();
    expect(buildOpeningStockPayload('shop-1', 'p-1', { stockQty: '0', stockCost: '', defaultCost: '5' })).toBeNull();
    expect(buildOpeningStockPayload(null, 'p-1', { stockQty: '10', stockCost: '5', defaultCost: '' })).toBeNull();
  });

  it('builds an IN movement with unitCost fallback to defaultCost', () => {
    expect(
      buildOpeningStockPayload('shop-1', 'p-1', { stockQty: '10', stockCost: '', defaultCost: '45' })
    ).toEqual({
      shopId: 'shop-1',
      productId: 'p-1',
      quantity: 10,
      type: 'IN',
      unitCost: 45,
      notes: 'Opening stock (mobile add product)',
    });
    expect(
      buildOpeningStockPayload('shop-1', 'p-1', { stockQty: '10', stockCost: '50', defaultCost: '45' })
    ).toMatchObject({ unitCost: 50 });
    expect(
      buildOpeningStockPayload('shop-1', 'p-1', { stockQty: '10', stockCost: '', defaultCost: '' })
    ).toMatchObject({ unitCost: 0 });
  });
});

describe('canCreateProduct', () => {
  it('allows owner/manager roles and product:create permission', () => {
    expect(canCreateProduct({ role: 'owner' })).toBe(true);
    expect(canCreateProduct({ role: 'manager' })).toBe(true);
    expect(canCreateProduct({ role: 'cashier' })).toBe(false);
    expect(canCreateProduct({ role: 'cashier', permissions: ['product:create'] })).toBe(true);
    expect(canCreateProduct({ role: 'owner', permissions: ['sale:read'] })).toBe(false);
    expect(canCreateProduct(null)).toBe(false);
  });
});
