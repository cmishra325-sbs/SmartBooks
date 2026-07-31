import { Account } from "../entities/account";

export interface AccountRepository {
  /**
   * Save a ledger account to the Chart of Accounts.
   */
  save(account: Account, client?: any): Promise<void>;

  /**
   * Find an account by its unique ledger code within a tenant workspace.
   */
  findByCode(tenantId: string, code: string): Promise<Account | null>;

  /**
   * Find an account by its unique ID.
   */
  findById(tenantId: string, id: string): Promise<Account | null>;
}
