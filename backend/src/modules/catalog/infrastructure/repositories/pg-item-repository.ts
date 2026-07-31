import { PoolClient } from "pg";
import { dbPool } from "../../../../shared-kernel/database";
import { Money } from "../../../../shared-kernel/money";
import { Item, ItemType } from "../../domain/entities/item";
import { ItemRepository } from "../../domain/repositories/item-repository.interface";

/**
 * PostgreSQL Implementation of the ItemRepository interface.
 * Handles database rows translation to Item domain aggregates.
 */
export class PgItemRepository implements ItemRepository {
  
  public async save(item: Item, client?: PoolClient): Promise<void> {
    const sql = `
      INSERT INTO catalog.items (
        id, tenant_id, name, sku, barcode, item_type, unit_of_measure, hsn_code,
        purchase_price, sales_price, tax_rate, is_tax_inclusive, is_deleted, version, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      ON CONFLICT (id)
      DO UPDATE SET
        name = EXCLUDED.name,
        sku = EXCLUDED.sku,
        barcode = EXCLUDED.barcode,
        unit_of_measure = EXCLUDED.unit_of_measure,
        hsn_code = EXCLUDED.hsn_code,
        purchase_price = EXCLUDED.purchase_price,
        sales_price = EXCLUDED.sales_price,
        tax_rate = EXCLUDED.tax_rate,
        is_tax_inclusive = EXCLUDED.is_tax_inclusive,
        is_deleted = EXCLUDED.is_deleted,
        version = catalog.items.version + 1,
        updated_at = clock_timestamp();
    `;
    const params = [
      item.id,
      item.tenantId,
      item.name,
      item.sku,
      item.barcode,
      item.itemType,
      item.unitOfMeasure,
      item.hsnCode,
      item.purchasePrice.amount, // Numeric precision saved as decimal number
      item.salesPrice.amount,
      item.taxRate,
      item.isTaxInclusive,
      item.isDeleted,
      item.version,
      item.createdAt,
      item.updatedAt,
    ];

    if (client) {
      await client.query(sql, params);
    } else {
      await dbPool.query(sql, params);
    }
  }

  public async findById(tenantId: string, id: string): Promise<Item | null> {
    // Scoped to tenantId to enforce security partition
    const sql = `SELECT * FROM catalog.items WHERE id = $1 AND tenant_id = $2;`;
    const res = await dbPool.query(sql, [id, tenantId]);

    if (res.rows.length === 0) {
      return null;
    }

    return this.mapRowToItem(res.rows[0]);
  }

  public async findByBarcode(tenantId: string, barcode: string): Promise<Item | null> {
    const sql = `
      SELECT * FROM catalog.items 
      WHERE barcode = $1 AND tenant_id = $2 AND is_deleted = false;
    `;
    const res = await dbPool.query(sql, [barcode.trim(), tenantId]);

    if (res.rows.length === 0) {
      return null;
    }

    return this.mapRowToItem(res.rows[0]);
  }

  private mapRowToItem(row: any): Item {
    return Item.reconstitute({
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      sku: row.sku,
      barcode: row.barcode,
      itemType: row.item_type as ItemType,
      unitOfMeasure: row.unit_of_measure,
      hsnCode: row.hsn_code,
      purchasePrice: Money.create(Number(row.purchase_price), "INR"),
      salesPrice: Money.create(Number(row.sales_price), "INR"),
      taxRate: Number(row.tax_rate),
      isTaxInclusive: row.is_tax_inclusive,
      isDeleted: row.is_deleted,
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
}
