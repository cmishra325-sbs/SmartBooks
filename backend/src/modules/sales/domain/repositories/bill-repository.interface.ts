import { Bill } from "../entities/bill";

export interface BillRepository {
  /**
   * Save or update a sales bill aggregate, including line items and payment mode splits.
   * Runs inside an active transactional connection if provided.
   */
  save(bill: Bill, client?: any): Promise<void>;

  /**
   * Fetch a sales bill by ID under a specific tenant.
   */
  findById(tenantId: string, id: string): Promise<Bill | null>;

  /**
   * Fetch the current running sequential count of bills for a tenant.
   * Used to generate sequential invoice numbers (e.g. BILL-0024).
   */
  getNextBillSequence(tenantId: string): Promise<number>;
}
