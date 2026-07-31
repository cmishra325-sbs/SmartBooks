import { PoolClient } from "pg";
import { dbPool } from "../../../../shared-kernel/database";
import { Money } from "../../../../shared-kernel/money";
import { Bill, BillStatus } from "../../domain/entities/bill";
import { BillItem } from "../../domain/value-objects/bill-item";
import { BillPayment, PaymentMode } from "../../domain/value-objects/bill-payment";
import { BillRepository } from "../../domain/repositories/bill-repository.interface";

/**
 * PostgreSQL Implementation of the BillRepository interface.
 * Coordinates persistence for the entire Bill aggregate (Master + Items + Payments).
 */
export class PgBillRepository implements BillRepository {

  public async save(bill: Bill, client?: PoolClient): Promise<void> {
    const activeClient = client || (await dbPool.connect());
    const isLocalTransaction = !client;

    try {
      if (isLocalTransaction) {
        await activeClient.query("BEGIN");
      }

      // 1. Save Bill Master
      const billSql = `
        INSERT INTO sales.bills (
          id, tenant_id, bill_number, customer_id, subtotal, tax_total, discount_total, grand_total, paid_amount, status, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (id)
        DO UPDATE SET
          subtotal = EXCLUDED.subtotal,
          tax_total = EXCLUDED.tax_total,
          discount_total = EXCLUDED.discount_total,
          grand_total = EXCLUDED.grand_total,
          paid_amount = EXCLUDED.paid_amount,
          status = EXCLUDED.status,
          updated_at = clock_timestamp();
      `;
      await activeClient.query(billSql, [
        bill.id,
        bill.tenantId,
        bill.billNumber,
        bill.customerId,
        bill.subtotal.amount,
        bill.taxTotal.amount,
        bill.discountTotal.amount,
        bill.grandTotal.amount,
        bill.paidAmount.amount,
        bill.status,
        bill.createdAt,
        bill.updatedAt,
      ]);

      // 2. Refresh Line Items (delete old lines, insert current lines)
      await activeClient.query(`DELETE FROM sales.bill_items WHERE bill_id = $1;`, [bill.id]);
      
      const itemSql = `
        INSERT INTO sales.bill_items (
          id, bill_id, item_id, name, qty, unit_price, tax_rate, cgst_amount, sgst_amount, igst_amount, subtotal, grand_total
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12);
      `;
      for (const item of bill.items) {
        await activeClient.query(itemSql, [
          item.id,
          bill.id,
          item.itemId,
          item.name,
          item.qty,
          item.unitPrice.amount,
          item.taxRate,
          item.cgstAmount.amount,
          item.sgstAmount.amount,
          item.igstAmount.amount,
          item.subtotal.amount,
          item.grandTotal.amount,
        ]);
      }

      // 3. Refresh Split Payments
      await activeClient.query(`DELETE FROM sales.bill_payments WHERE bill_id = $1;`, [bill.id]);
      
      const paymentSql = `
        INSERT INTO sales.bill_payments (
          id, bill_id, payment_mode, amount, reference_number, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6);
      `;
      for (const pay of bill.payments) {
        await activeClient.query(paymentSql, [
          pay.id,
          bill.id,
          pay.paymentMode,
          pay.amount.amount,
          pay.referenceNumber,
          pay.createdAt,
        ]);
      }

      if (isLocalTransaction) {
        await activeClient.query("COMMIT");
      }
    } catch (error) {
      if (isLocalTransaction) {
        await activeClient.query("ROLLBACK");
      }
      throw error;
    } finally {
      if (isLocalTransaction) {
        // Release client back to pool if instantiated locally
        (activeClient as any).release();
      }
    }
  }

  public async findById(tenantId: string, id: string): Promise<Bill | null> {
    // 1. Fetch Bill Master
    const billRes = await dbPool.query(
      `SELECT * FROM sales.bills WHERE id = $1 AND tenant_id = $2;`,
      [id, tenantId]
    );
    if (billRes.rows.length === 0) {
      return null;
    }
    const billRow = billRes.rows[0];

    // 2. Fetch Line Items
    const itemsRes = await dbPool.query(
      `SELECT * FROM sales.bill_items WHERE bill_id = $1;`,
      [id]
    );
    const items = itemsRes.rows.map((row) =>
      BillItem.reconstitute({
        id: row.id,
        itemId: row.item_id,
        name: row.name,
        qty: Number(row.qty),
        unitPrice: Money.create(Number(row.unit_price), "INR"),
        taxRate: Number(row.tax_rate),
        cgstAmount: Money.create(Number(row.cgst_amount), "INR"),
        sgstAmount: Money.create(Number(row.sgst_amount), "INR"),
        igstAmount: Money.create(Number(row.igst_amount), "INR"),
        subtotal: Money.create(Number(row.subtotal), "INR"),
        grandTotal: Money.create(Number(row.grand_total), "INR"),
      })
    );

    // 3. Fetch Payments
    const payRes = await dbPool.query(
      `SELECT * FROM sales.bill_payments WHERE bill_id = $1;`,
      [id]
    );
    const payments = payRes.rows.map((row) =>
      BillPayment.reconstitute(
        row.id,
        row.payment_mode as PaymentMode,
        Money.create(Number(row.amount), "INR"),
        row.reference_number,
        row.created_at
      )
    );

    return Bill.reconstitute({
      id: billRow.id,
      tenantId: billRow.tenant_id,
      billNumber: billRow.bill_number,
      customerId: billRow.customer_id,
      items,
      payments,
      subtotal: Money.create(Number(billRow.subtotal), "INR"),
      taxTotal: Money.create(Number(billRow.tax_total), "INR"),
      discountTotal: Money.create(Number(billRow.discount_total), "INR"),
      grandTotal: Money.create(Number(billRow.grand_total), "INR"),
      status: billRow.status as BillStatus,
      createdAt: billRow.created_at,
      updatedAt: billRow.updated_at,
    });
  }

  public async getNextBillSequence(tenantId: string): Promise<number> {
    const res = await dbPool.query(
      `SELECT COUNT(*) FROM sales.bills WHERE tenant_id = $1;`,
      [tenantId]
    );
    return Number(res.rows[0].count) + 1;
  }
}
