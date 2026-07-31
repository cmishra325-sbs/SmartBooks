import { Money } from '../../src/shared-kernel/money';
import { BillItem } from '../../src/modules/sales/domain/value-objects/bill-item';
import { BillPayment } from '../../src/modules/sales/domain/value-objects/bill-payment';
import { Bill } from '../../src/modules/sales/domain/entities/bill';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Shorthand to create INR Money. */
const inr = (amount: number) => Money.create(amount, 'INR');

/** Create a valid BillItem with sensible defaults, overridable via `overrides`. */
function makeItem(overrides: Partial<Parameters<typeof BillItem.create>[0]> = {}) {
  const defaults: Parameters<typeof BillItem.create>[0] = {
    id: 'item-1',
    itemId: 'prod-1',
    name: 'Widget',
    qty: 1,
    unitPrice: inr(100),
    taxRate: 18,
    isTaxInclusive: false,
    isIntraState: true,
  };
  return BillItem.create({ ...defaults, ...overrides });
}

/** Create a valid BillPayment. */
function makePayment(
  amount: number,
  mode: 'CASH' | 'UPI' | 'CARD' | 'LEDGER' = 'CASH',
  ref?: string,
  id = 'pay-1'
) {
  return BillPayment.create(id, mode, inr(amount), ref);
}

// ─── 1. BillItem ──────────────────────────────────────────────────────────────

describe('BillItem', () => {
  describe('happy-path creation', () => {
    it('creates a valid intra-state tax-inclusive item with correct GST split', () => {
      // qty=5, unitPrice=₹10, taxRate=18%, isTaxInclusive=true, isIntraState=true
      // grandTotal = 5 × 10 = ₹50, subtotal = 50 / 1.18, tax = 50 - subtotal
      const result = makeItem({
        qty: 5,
        unitPrice: inr(10),
        taxRate: 18,
        isTaxInclusive: true,
        isIntraState: true,
      });

      expect(result.isSuccess).toBe(true);
      const item = result.value;

      expect(item.grandTotal.amount).toBeCloseTo(50, 2);
      // CGST and SGST should each be half the total tax
      const totalTax = item.cgstAmount.amount + item.sgstAmount.amount;
      expect(item.cgstAmount.amount).toBeCloseTo(item.sgstAmount.amount, 4);
      expect(totalTax).toBeCloseTo(50 - 50 / 1.18, 2);
      // IGST must be zero for intra-state
      expect(item.igstAmount.amount).toBe(0);
    });

    it('creates a valid inter-state item — full tax goes to IGST', () => {
      const result = makeItem({
        qty: 5,
        unitPrice: inr(10),
        taxRate: 18,
        isTaxInclusive: true,
        isIntraState: false,
      });

      expect(result.isSuccess).toBe(true);
      const item = result.value;

      expect(item.igstAmount.amount).toBeCloseTo(50 - 50 / 1.18, 2);
      expect(item.cgstAmount.amount).toBe(0);
      expect(item.sgstAmount.amount).toBe(0);
    });

    it('calculates tax-exclusive correctly (tax added on top)', () => {
      // unitPrice=₹100, qty=1, taxRate=18%, isTaxInclusive=false
      const result = makeItem({
        unitPrice: inr(100),
        qty: 1,
        taxRate: 18,
        isTaxInclusive: false,
      });

      expect(result.isSuccess).toBe(true);
      const item = result.value;

      expect(item.subtotal.amount).toBeCloseTo(100, 2);
      const expectedTax = 18; // 100 × 18%
      const totalTax = item.cgstAmount.amount + item.sgstAmount.amount + item.igstAmount.amount;
      expect(totalTax).toBeCloseTo(expectedTax, 2);
      expect(item.grandTotal.amount).toBeCloseTo(118, 2);
    });

    it('back-calculates subtotal from tax-inclusive price', () => {
      // unitPrice=₹118, qty=1, taxRate=18%, isTaxInclusive=true
      const result = makeItem({
        unitPrice: inr(118),
        qty: 1,
        taxRate: 18,
        isTaxInclusive: true,
      });

      expect(result.isSuccess).toBe(true);
      const item = result.value;

      expect(item.subtotal.amount).toBeCloseTo(100, 2);
      expect(item.grandTotal.amount).toBeCloseTo(118, 2);
    });

    it('adds no tax when GST rate is zero', () => {
      const result = makeItem({ taxRate: 0 });

      expect(result.isSuccess).toBe(true);
      const item = result.value;

      expect(item.cgstAmount.amount).toBe(0);
      expect(item.sgstAmount.amount).toBe(0);
      expect(item.igstAmount.amount).toBe(0);
      expect(item.subtotal.amount).toBe(item.grandTotal.amount);
    });

    it('handles large quantities correctly (qty=10000)', () => {
      const result = makeItem({
        qty: 10000,
        unitPrice: inr(25),
        taxRate: 12,
        isTaxInclusive: false,
        isIntraState: true,
      });

      expect(result.isSuccess).toBe(true);
      const item = result.value;

      // subtotal = 10000 × 25 = 250000, tax = 250000 × 0.12 = 30000
      expect(item.subtotal.amount).toBeCloseTo(250000, 2);
      expect(item.grandTotal.amount).toBeCloseTo(280000, 2);
      expect(item.cgstAmount.amount).toBeCloseTo(15000, 2);
      expect(item.sgstAmount.amount).toBeCloseTo(15000, 2);
    });
  });

  describe('validation failures', () => {
    it('rejects negative quantity', () => {
      const result = makeItem({ qty: -3 });
      expect(result.isFailure).toBe(true);
      expect(result.error).toMatch(/quantity/i);
    });

    it('rejects zero quantity', () => {
      const result = makeItem({ qty: 0 });
      expect(result.isFailure).toBe(true);
      expect(result.error).toMatch(/quantity/i);
    });

    it('rejects negative tax rate', () => {
      const result = makeItem({ taxRate: -5 });
      expect(result.isFailure).toBe(true);
      expect(result.error).toMatch(/gst rate/i);
    });

    it('rejects tax rate above 100%', () => {
      const result = makeItem({ taxRate: 150 });
      expect(result.isFailure).toBe(true);
      expect(result.error).toMatch(/gst rate/i);
    });
  });
});

// ─── 2. BillPayment ──────────────────────────────────────────────────────────

describe('BillPayment', () => {
  describe('happy-path creation', () => {
    it('creates a valid CASH payment without a reference number', () => {
      const result = makePayment(500, 'CASH');
      expect(result.isSuccess).toBe(true);
      expect(result.value.paymentMode).toBe('CASH');
      expect(result.value.amount.amount).toBe(500);
      expect(result.value.referenceNumber).toBeNull();
    });

    it('creates a valid UPI payment with a reference number', () => {
      const result = makePayment(200, 'UPI', 'TXN-12345');
      expect(result.isSuccess).toBe(true);
      expect(result.value.paymentMode).toBe('UPI');
      expect(result.value.referenceNumber).toBe('TXN-12345');
    });

    it('creates a valid CARD payment with a reference number', () => {
      const result = makePayment(300, 'CARD', 'AUTH-99887');
      expect(result.isSuccess).toBe(true);
      expect(result.value.paymentMode).toBe('CARD');
      expect(result.value.referenceNumber).toBe('AUTH-99887');
    });

    it('allows CASH payment with an optional reference number', () => {
      const result = makePayment(100, 'CASH', 'RECEIPT-001');
      expect(result.isSuccess).toBe(true);
      expect(result.value.referenceNumber).toBe('RECEIPT-001');
    });
  });

  describe('validation failures', () => {
    it('rejects UPI payment without reference number', () => {
      const result = makePayment(200, 'UPI');
      expect(result.isFailure).toBe(true);
      expect(result.error).toMatch(/reference/i);
    });

    it('rejects CARD payment without reference number', () => {
      const result = makePayment(300, 'CARD');
      expect(result.isFailure).toBe(true);
      expect(result.error).toMatch(/reference/i);
    });

    it('rejects zero payment amount', () => {
      const result = makePayment(0, 'CASH');
      expect(result.isFailure).toBe(true);
      expect(result.error).toMatch(/amount/i);
    });

    it('rejects negative payment amount', () => {
      const result = makePayment(-50, 'CASH');
      expect(result.isFailure).toBe(true);
      expect(result.error).toMatch(/amount/i);
    });
  });
});

// ─── 3. Bill (Aggregate Root) ─────────────────────────────────────────────────

describe('Bill', () => {
  /** Create a fresh empty Bill with defaults. */
  function makeBill(billNumber = 'INV-001', customerId?: string) {
    return Bill.create('bill-1', 'tenant-1', billNumber, customerId);
  }

  /** Build a successful BillItem and return the unwrapped value. */
  function itemValue(overrides: Partial<Parameters<typeof BillItem.create>[0]> = {}): BillItem {
    const r = makeItem(overrides);
    if (r.isFailure) throw new Error(`Test setup: BillItem.create failed — ${r.error}`);
    return r.value;
  }

  /** Build a successful BillPayment and return the unwrapped value. */
  function paymentValue(
    amount: number,
    mode: 'CASH' | 'UPI' | 'CARD' | 'LEDGER' = 'CASH',
    ref?: string,
    id = 'pay-1'
  ): BillPayment {
    const r = BillPayment.create(id, mode, inr(amount), ref);
    if (r.isFailure) throw new Error(`Test setup: BillPayment.create failed — ${r.error}`);
    return r.value;
  }

  describe('creation', () => {
    it('creates a valid bill with UNPAID status and zero totals', () => {
      const result = makeBill();
      expect(result.isSuccess).toBe(true);

      const bill = result.value;
      expect(bill.status).toBe('UNPAID');
      expect(bill.items).toHaveLength(0);
      expect(bill.payments).toHaveLength(0);
      expect(bill.grandTotal.amount).toBe(0);
      expect(bill.subtotal.amount).toBe(0);
      expect(bill.taxTotal.amount).toBe(0);
    });

    it('rejects empty bill number', () => {
      const result = makeBill('');
      expect(result.isFailure).toBe(true);
      expect(result.error).toMatch(/bill/i);
    });

    it('rejects whitespace-only bill number', () => {
      const result = makeBill('   ');
      expect(result.isFailure).toBe(true);
      expect(result.error).toMatch(/bill/i);
    });
  });

  describe('addItem & totals recalculation', () => {
    it('recalculates totals after adding a single item', () => {
      const bill = makeBill().value;
      // tax-exclusive: unitPrice=100, qty=1, taxRate=18 → subtotal=100, tax=18, grand=118
      const item = itemValue({
        unitPrice: inr(100),
        qty: 1,
        taxRate: 18,
        isTaxInclusive: false,
        isIntraState: true,
      });

      bill.addItem(item);

      expect(bill.items).toHaveLength(1);
      expect(bill.subtotal.amount).toBeCloseTo(100, 2);
      expect(bill.taxTotal.amount).toBeCloseTo(18, 2);
      expect(bill.grandTotal.amount).toBeCloseTo(118, 2);
    });

    it('accumulates subtotal and tax correctly for multiple items', () => {
      const bill = makeBill().value;

      // Item A: ₹100 × 2 @ 18% exclusive → subtotal=200, tax=36
      const itemA = itemValue({
        id: 'i1',
        qty: 2,
        unitPrice: inr(100),
        taxRate: 18,
        isTaxInclusive: false,
        isIntraState: true,
      });

      // Item B: ₹50 × 3 @ 12% exclusive → subtotal=150, tax=18
      const itemB = itemValue({
        id: 'i2',
        itemId: 'prod-2',
        name: 'Gadget',
        qty: 3,
        unitPrice: inr(50),
        taxRate: 12,
        isTaxInclusive: false,
        isIntraState: true,
      });

      bill.addItem(itemA);
      bill.addItem(itemB);

      expect(bill.items).toHaveLength(2);
      expect(bill.subtotal.amount).toBeCloseTo(350, 2); // 200 + 150
      expect(bill.taxTotal.amount).toBeCloseTo(54, 2);  // 36 + 18
      expect(bill.grandTotal.amount).toBeCloseTo(404, 2);
    });
  });

  describe('applyPayment & status lifecycle', () => {
    it('partial payment changes status to PARTIALLY_PAID', () => {
      const bill = makeBill().value;
      bill.addItem(itemValue({ unitPrice: inr(100), qty: 1, taxRate: 0 }));
      // grandTotal = ₹100

      const payResult = bill.applyPayment(paymentValue(40));
      expect(payResult.isSuccess).toBe(true);
      expect(bill.status).toBe('PARTIALLY_PAID');
    });

    it('full payment changes status to PAID', () => {
      const bill = makeBill().value;
      bill.addItem(itemValue({ unitPrice: inr(100), qty: 1, taxRate: 0 }));

      const payResult = bill.applyPayment(paymentValue(100));
      expect(payResult.isSuccess).toBe(true);
      expect(bill.status).toBe('PAID');
    });

    it('rejects payment on an already PAID bill', () => {
      const bill = makeBill().value;
      bill.addItem(itemValue({ unitPrice: inr(100), qty: 1, taxRate: 0 }));
      bill.applyPayment(paymentValue(100));

      const secondPay = bill.applyPayment(paymentValue(10, 'CASH', undefined, 'pay-2'));
      expect(secondPay.isFailure).toBe(true);
      expect(secondPay.error).toMatch(/already fully paid/i);
    });

    it('rejects payment exceeding balance due', () => {
      const bill = makeBill().value;
      bill.addItem(itemValue({ unitPrice: inr(100), qty: 1, taxRate: 0 }));

      const result = bill.applyPayment(paymentValue(150));
      expect(result.isFailure).toBe(true);
      expect(result.error).toMatch(/exceeds/i);
    });

    it('handles split payments: ₹20 CASH + ₹30 UPI on ₹50 bill = PAID', () => {
      const bill = makeBill().value;
      bill.addItem(itemValue({ unitPrice: inr(50), qty: 1, taxRate: 0 }));

      const pay1 = bill.applyPayment(paymentValue(20, 'CASH', undefined, 'pay-1'));
      expect(pay1.isSuccess).toBe(true);
      expect(bill.status).toBe('PARTIALLY_PAID');

      const pay2 = bill.applyPayment(paymentValue(30, 'UPI', 'UPI-REF-001', 'pay-2'));
      expect(pay2.isSuccess).toBe(true);
      expect(bill.status).toBe('PAID');
    });

    it('balanceDue reflects remaining amount after partial payment', () => {
      const bill = makeBill().value;
      bill.addItem(itemValue({ unitPrice: inr(200), qty: 1, taxRate: 0 }));
      // grandTotal = ₹200

      bill.applyPayment(paymentValue(75));
      expect(bill.balanceDue.amount).toBeCloseTo(125, 2);
      expect(bill.paidAmount.amount).toBeCloseTo(75, 2);
    });
  });
});
