import { Money } from "../../../../shared-kernel/money";
import { Result } from "../../../../shared-kernel/result";

export type PaymentMode = "CASH" | "UPI" | "CARD" | "LEDGER";

/**
 * Value Object representing a single payment mode slice in a split-payment POS bill.
 */
export class BillPayment {
  public readonly id: string;
  public readonly paymentMode: PaymentMode;
  public readonly amount: Money;
  public readonly referenceNumber: string | null;
  public readonly createdAt: Date;

  private constructor(id: string, paymentMode: PaymentMode, amount: Money, referenceNumber: string | null, createdAt: Date) {
    this.id = id;
    this.paymentMode = paymentMode;
    this.amount = amount;
    this.referenceNumber = referenceNumber;
    this.createdAt = createdAt;
    Object.freeze(this);
  }

  /**
   * Factory method to create a payment entry with validation.
   */
  public static create(
    id: string,
    paymentMode: PaymentMode,
    amount: Money,
    referenceNumber?: string | null
  ): Result<BillPayment, string> {
    if (amount.amount <= 0) {
      return Result.fail("Payment amount must be greater than zero.");
    }

    // Reference checking for electronic tracking
    if ((paymentMode === "UPI" || paymentMode === "CARD") && !referenceNumber) {
      return Result.fail(`Reference details (e.g. transaction ID) are required for ${paymentMode} payments.`);
    }

    return Result.ok(new BillPayment(id, paymentMode, amount, referenceNumber || null, new Date()));
  }

  /**
   * Reconstitutes the value object from database records.
   */
  public static reconstitute(
    id: string,
    paymentMode: PaymentMode,
    amount: Money,
    referenceNumber: string | null,
    createdAt: Date
  ): BillPayment {
    return new BillPayment(id, paymentMode, amount, referenceNumber, createdAt);
  }
}
