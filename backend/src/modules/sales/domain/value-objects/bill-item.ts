import { Money } from "../../../../shared-kernel/money";
import { Result } from "../../../../shared-kernel/result";

/**
 * Value Object representing a line item in a sales bill.
 * Encapsulates the math for prices, discounts, and Indian GST splits.
 */
export class BillItem {
  public readonly id: string;
  public readonly itemId: string;
  public readonly name: string;
  public readonly qty: number;
  public readonly unitPrice: Money;
  public readonly taxRate: number; // e.g. 18.00
  
  // Calculated tax breakdowns (saved to 4 decimals)
  public readonly cgstAmount: Money;
  public readonly sgstAmount: Money;
  public readonly igstAmount: Money;
  
  public readonly subtotal: Money;   // Row value before GST
  public readonly grandTotal: Money; // Row value after GST

  private constructor(params: {
    id: string;
    itemId: string;
    name: string;
    qty: number;
    unitPrice: Money;
    taxRate: number;
    cgstAmount: Money;
    sgstAmount: Money;
    igstAmount: Money;
    subtotal: Money;
    grandTotal: Money;
  }) {
    this.id = params.id;
    this.itemId = params.itemId;
    this.name = params.name;
    this.qty = params.qty;
    this.unitPrice = params.unitPrice;
    this.taxRate = params.taxRate;
    this.cgstAmount = params.cgstAmount;
    this.sgstAmount = params.sgstAmount;
    this.igstAmount = params.igstAmount;
    this.subtotal = params.subtotal;
    this.grandTotal = params.grandTotal;
    Object.freeze(this);
  }

  /**
   * Factory method to create a BillItem and calculate CGST, SGST, or IGST splits.
   */
  public static create(params: {
    id: string;
    itemId: string;
    name: string;
    qty: number;
    unitPrice: Money;
    taxRate: number; // GST Percent, e.g. 18
    isTaxInclusive: boolean;
    isIntraState: boolean; // True = CGST + SGST (within state), False = IGST (inter-state)
  }): Result<BillItem, string> {
    if (params.qty <= 0) {
      return Result.fail("Quantity must be greater than zero.");
    }
    if (params.taxRate < 0 || params.taxRate > 100) {
      return Result.fail("GST rate must be between 0% and 100%.");
    }

    const currency = params.unitPrice.currency;
    const totalRawSales = params.unitPrice.amount * params.qty;

    let subtotalAmount: number;
    let taxAmount: number;

    if (params.isTaxInclusive) {
      // Formula: Subtotal = Total / (1 + GST%)
      subtotalAmount = totalRawSales / (1 + params.taxRate / 100);
      taxAmount = totalRawSales - subtotalAmount;
    } else {
      // Formula: Subtotal = Total, GST added on top
      subtotalAmount = totalRawSales;
      taxAmount = totalRawSales * (params.taxRate / 100);
    }

    const subtotal = Money.create(subtotalAmount, currency);
    const grandTotal = Money.create(subtotalAmount + taxAmount, currency);

    // Calculate Indian GST splits
    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    if (params.isIntraState) {
      // Intra-state splits GST 50/50 between CGST and SGST
      cgst = taxAmount / 2;
      sgst = taxAmount / 2;
    } else {
      // Inter-state applies full GST to IGST
      igst = taxAmount;
    }

    return Result.ok(
      new BillItem({
        id: params.id,
        itemId: params.itemId,
        name: params.name,
        qty: params.qty,
        unitPrice: params.unitPrice,
        taxRate: params.taxRate,
        cgstAmount: Money.create(cgst, currency),
        sgstAmount: Money.create(sgst, currency),
        igstAmount: Money.create(igst, currency),
        subtotal,
        grandTotal,
      })
    );
  }

  /**
   * Reconstitutes the value object from database rows.
   */
  public static reconstitute(params: {
    id: string;
    itemId: string;
    name: string;
    qty: number;
    unitPrice: Money;
    taxRate: number;
    cgstAmount: Money;
    sgstAmount: Money;
    igstAmount: Money;
    subtotal: Money;
    grandTotal: Money;
  }): BillItem {
    return new BillItem(params);
  }
}
