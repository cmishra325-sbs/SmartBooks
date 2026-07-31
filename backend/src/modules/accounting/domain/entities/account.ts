import { Result } from "../../../../shared-kernel/result";

export type AccountType = "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";

/**
 * Account Domain Entity representing a ledger account in the Chart of Accounts (COA).
 */
export class Account {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly code: string;
  public readonly name: string;
  public readonly type: AccountType;
  public readonly createdAt: Date;
  public readonly updatedAt: Date;

  private constructor(
    id: string,
    tenantId: string,
    code: string,
    name: string,
    type: AccountType,
    createdAt: Date,
    updatedAt: Date
  ) {
    this.id = id;
    this.tenantId = tenantId;
    this.code = code;
    this.name = name;
    this.type = type;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  /**
   * Factory method to create a new Account aggregate.
   */
  public static create(params: {
    id: string;
    tenantId: string;
    code: string;
    name: string;
    type: AccountType;
  }): Result<Account, string> {
    const cleanCode = params.code.trim();
    const cleanName = params.name.trim();

    if (!cleanCode) {
      return Result.fail("Account code is required.");
    }
    if (!cleanName) {
      return Result.fail("Account name is required.");
    }

    const now = new Date();
    return Result.ok(new Account(params.id, params.tenantId, cleanCode, cleanName, params.type, now, now));
  }

  /**
   * Factory method to reconstruct Account from database rows.
   */
  public static reconstitute(params: {
    id: string;
    tenantId: string;
    code: string;
    name: string;
    type: AccountType;
    createdAt: Date;
    updatedAt: Date;
  }): Account {
    return new Account(
      params.id,
      params.tenantId,
      params.code,
      params.name,
      params.type,
      params.createdAt,
      params.updatedAt
    );
  }
}
