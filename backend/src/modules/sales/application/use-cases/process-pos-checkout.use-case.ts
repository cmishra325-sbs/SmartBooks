import crypto from "crypto";
import { Money } from "../../../../shared-kernel/money";
import { Result } from "../../../../shared-kernel/result";
import { ItemRepository } from "../../../catalog/domain/repositories/item-repository.interface";
import { Bill } from "../../domain/entities/bill";
import { BillItem } from "../../domain/value-objects/bill-item";
import { BillPayment } from "../../domain/value-objects/bill-payment";
import { BillRepository } from "../../domain/repositories/bill-repository.interface";

export type POSCheckoutLine = {
  itemId: string;
  qty: number;
};

export type POSCheckoutPayment = {
  paymentMode: "CASH" | "UPI" | "CARD" | "LEDGER";
  amount: number;
  referenceNumber?: string | null;
};

export type ProcessPOSCheckoutCommand = {
  tenantId: string;
  customerId?: string | null;
  lines: POSCheckoutLine[];
  payments: POSCheckoutPayment[];
  isIntraState: boolean; // Determines CGST/SGST vs IGST split
};

/**
 * Application Use Case that coordinates high-speed POS billing checks,
 * taxes calculations, split payments validation, and database updates.
 */
export class ProcessPOSCheckoutUseCase {
  private readonly billRepo: BillRepository;
  private readonly itemRepo: ItemRepository;

  constructor(billRepo: BillRepository, itemRepo: ItemRepository) {
    this.billRepo = billRepo;
    this.itemRepo = itemRepo;
  }

  public async execute(command: ProcessPOSCheckoutCommand): Promise<Result<Bill, string>> {
    if (command.lines.length === 0) {
      return Result.fail("Cannot checkout: A bill must contain at least one line item.");
    }

    // 1. Generate new unique ID and retrieve sequential invoice number
    const billId = crypto.randomUUID();
    const nextSeq = await this.billRepo.getNextBillSequence(command.tenantId);
    
    // Format invoice series: e.g. "INV-2026-0001"
    const currentYear = new Date().getFullYear();
    const billNumber = `INV-${currentYear}-${String(nextSeq).padStart(4, "0")}`;

    // 2. Instantiate sales Bill aggregate root
    const billResult = Bill.create(billId, command.tenantId, billNumber, command.customerId);
    if (billResult.isFailure) {
      return Result.fail(billResult.error);
    }
    const bill = billResult.value;

    // 3. Translate lines and calculate GST splits
    for (const line of command.lines) {
      // Lookup the catalog details to prevent tampering from the frontend client
      const catalogItem = await this.itemRepo.findById(command.tenantId, line.itemId);
      if (!catalogItem) {
        return Result.fail(`Checkout failed: Catalog item ID '${line.itemId}' was not found.`);
      }

      const lineId = crypto.randomUUID();
      const lineItemResult = BillItem.create({
        id: lineId,
        itemId: catalogItem.id,
        name: catalogItem.name,
        qty: line.qty,
        unitPrice: catalogItem.salesPrice,
        taxRate: catalogItem.taxRate,
        isTaxInclusive: catalogItem.isTaxInclusive,
        isIntraState: command.isIntraState,
      });

      if (lineItemResult.isFailure) {
        return Result.fail(lineItemResult.error);
      }

      bill.addItem(lineItemResult.value);
    }

    // 4. Apply split payment entries
    for (const pay of command.payments) {
      const paymentId = crypto.randomUUID();
      const paymentResult = BillPayment.create(
        paymentId,
        pay.paymentMode,
        Money.create(pay.amount, "INR"),
        pay.referenceNumber
      );

      if (paymentResult.isFailure) {
        return Result.fail(paymentResult.error);
      }

      const applyResult = bill.applyPayment(paymentResult.value);
      if (applyResult.isFailure) {
        return Result.fail(applyResult.error);
      }
    }

    // 5. Commit aggregate transaction to database
    try {
      await this.billRepo.save(bill);
      return Result.ok(bill);
    } catch (error: any) {
      console.error(`[Use Case Error] POS Checkout failed during DB commit: ${error.message}`);
      return Result.fail("Failed to process checkout transaction due to a database error.");
    }
  }
}
