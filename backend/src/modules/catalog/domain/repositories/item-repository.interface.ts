import { Item } from "../entities/item";

export interface ItemRepository {
  /**
   * Save or update an item aggregate root.
   * Multi-tenant context is validated before saving.
   */
  save(item: Item, client?: any): Promise<void>;

  /**
   * Retrieve an item by ID, scoped to a specific tenant.
   */
  findById(tenantId: string, id: string): Promise<Item | null>;

  /**
   * Retrieve an item by barcode scanner input, scoped to a specific tenant.
   * Used for high-speed POS checkouts.
   */
  findByBarcode(tenantId: string, barcode: string): Promise<Item | null>;
}
