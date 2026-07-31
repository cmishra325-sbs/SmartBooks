import { Money } from "../../../../shared-kernel/money";
import { Result } from "../../../../shared-kernel/result";
import { BillItem } from "../value-objects/bill-item";
import { BillPayment } from "../value-objects/bill-payment";

export type BillStatus = "DRAFT" | "UNPAID" | "PARTIALLY_PAID" | "PAID" | "CANCELLED";

/**
 * Bill Aggregate Root representing a sales transaction invoice.
 * Manages item lines, POS split payments, totals calculations, and tax validation.
 */
export class Bill {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly billNumber: string;
  public readonly customerId: string | null;
  
  private _items: BillItem[] = [];
  private _payments: BillPayment[] = [];
  
  private _subtotal: Money;
  private _taxTotal: Money;
  private _discountTotal: Money;
  private _grandTotal: Money;
  private _status: BillStatus;
  
  public readonly createdAt: Date;
  public readonly updatedAt: Date;

  private constructor(params: {
    id: string;
    tenantId: string;
    billNumber: string;
    customerId: string | null;
    items: BillItem[];
    payments: BillPayment[];
    subtotal: Money;
    taxTotal: Money;
    discountTotal: Money;
    grandTotal: Money;
    status: BillStatus;
    createdAt: Date;
    updatedAt: Date;
  }) {
    this.id = params.id;
    this.tenantId = params.tenantId;
    this.billNumber = params.billNumber;
    this.customerId = params.customerId;
    this._items = params.items;
    this._payments = params.payments;
    this._subtotal = params.subtotal;
    this._taxTotal = params.taxTotal;
    this._discountTotal = params.discountTotal;
    this._grandTotal = params.grandTotal;
    this._status = params.status;
    this.createdAt = params.createdAt;
    this.updatedAt = params.updatedAt;
  }

  /**
   * Factory method to create a new Sales Bill.
   */
  public static create(
    id: string,
    tenantId: string,
    billNumber: string,
    customerId?: string | null
  ): Result<Bill, string> {
    if (!billNumber.trim()) {
      return Result.fail("Bill invoice number is required.");
    }

    const now = new Date();
    const zeroMoney = Money.zero("INR");

    return Result.ok(
      new Bill({
        id,
        tenantId,
        billNumber: billNumber.trim(),
        customerId: customerId || null,
        items: [],
        payments: [],
        subtotal: zeroMoney,
        taxTotal: zeroMoney,
        discountTotal: zeroMoney,
        grandTotal: zeroMoney,
        status: "UNPAID",
        createdAt: now,
        updatedAt: now,
      })
    );
  }

  /**
   * Reconstitutes the Bill aggregate from database rows (Infrastructure mapper).
   */
  public static reconstitute(params: {
    id: string;
    tenantId: string;
    billNumber: string;
    customerId: string | null;
    items: BillItem[];
    payments: BillPayment[];
    subtotal: Money;
    taxTotal: Money;
    discountTotal: Money;
    grandTotal: Money;
    status: BillStatus;
    createdAt: Date;
    updatedAt: Date;
  }): Bill {
    return new Bill(params);
  }

  // Getters
  public get items(): readonly BillItem[] { return this._items; }
  public get payments(): readonly BillPayment[] { return this._payments; }
  public get subtotal(): Money { return this._subtotal; }
  public get taxTotal(): Money { return this._taxTotal; }
  public get discountTotal(): Money { return this._discountTotal; }
  public get grandTotal(): Money { return this._grandTotal; }
  public get status(): BillStatus { return this._status; }

  /**
   * Sum of all payments currently made on this invoice.
   */
  public get paidAmount(): Money {
    const currency = this.grandTotal.currency;
    const totalAmount = this._payments.reduce((sum, pay) => sum + pay.amount.amount, 0);
    return Money.create(totalAmount, currency);
  }

  /**
   * Remaining amount to fully settle this invoice.
   */
  public get balanceDue(): Money {
    return this.grandTotal.subtract(this.paidAmount);
  }

  /**
   * Add a line item to this bill. Automatically recalculates all totals.
   */
  public addItem(item: BillItem): void {
    this._items.push(item);
    this.recalculateTotals();
  }

  /**
   * Apply a payment slice (e.g. Cash, UPI split payment).
   * Enforces that payment does not exceed the remaining balance due.
   */
  public applyPayment(payment: BillPayment): Result<void, string> {
    if (this._status === "PAID") {
      return Result.fail("Cannot apply payment: This invoice is already fully paid.");
    }

    // Round to 2 decimal places (Paise level) for payment validation
    const remainingAmount = Math.round(this.balanceDue.amount * 100) / 100;
    const paymentAmount = Math.round(payment.amount.amount * 100) / 100;

    if (paymentAmount > remainingAmount) {
      const remainingMoney = Money.create(remainingAmount, this.grandTotal.currency);
      return Result.fail(
        `Payment rejected: Applied amount ${payment.amount.format()} exceeds the remaining balance due of ${remainingMoney.format()}.`
      );
    }

    this._payments.push(payment);
    this.updateStatusBasedOnPayments();
    
    return Result.ok(undefined);
  }

  /**
   * Recalculates the billing totals from all line items.
   */
  private recalculateTotals(): void {
    const currency = this._items.length > 0 ? this._items[0].unitPrice.currency : "INR";
    
    let subtotalSum = 0;
    let taxSum = 0;

    for (const item of this._items) {
      subtotalSum += item.subtotal.amount;
      taxSum += item.cgstAmount.amount + item.sgstAmount.amount + item.igstAmount.amount;
    }

    this._subtotal = Money.create(subtotalSum, currency);
    this._taxTotal = Money.create(taxSum, currency);
    
    // grand_total = subtotal + tax - discount (discounting placeholder at 0 for now)
    const totalAmount = subtotalSum + taxSum - this._discountTotal.amount;
    this._grandTotal = Money.create(totalAmount, currency);
    
    this.updateStatusBasedOnPayments();
  }

  /**
   * Updates billing payment status depending on amount paid.
   */
  private updateStatusBasedOnPayments(): void {
    // Round to 2 decimal places (Paise level) for payment settlements
    const paid = Math.round(this.paidAmount.amount * 100) / 100;
    const total = Math.round(this._grandTotal.amount * 100) / 100;

    if (total === 0) {
      this._status = "UNPAID";
    } else if (paid >= total) {
      this._status = "PAID";
    } else if (paid > 0) {
      this._status = "PARTIALLY_PAID";
    } else {
      this._status = "UNPAID";
    }
  }
}
