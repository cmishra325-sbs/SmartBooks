import { Result } from "../../../../shared-kernel/result";

/**
 * Tenant Status Types
 */
export type TenantStatus = "ACTIVE" | "SUSPENDED" | "DELETED";

/**
 * Tenant Domain Entity representing a subscribing business.
 */
export class Tenant {
  public readonly id: string;
  private _name: string;
  private _status: TenantStatus;
  public readonly createdAt: Date;
  public readonly updatedAt: Date;

  private constructor(id: string, name: string, status: TenantStatus, createdAt: Date, updatedAt: Date) {
    this.id = id;
    this._name = name;
    this._status = status;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  /**
   * Factory method to create a new Tenant domain object.
   */
  public static create(id: string, name: string): Result<Tenant, string> {
    const sanitizedName = name.trim();
    
    if (!sanitizedName) {
      return Result.fail("Tenant name cannot be empty.");
    }
    
    if (sanitizedName.length < 3) {
      return Result.fail("Tenant name must be at least 3 characters long.");
    }

    const now = new Date();
    return Result.ok(new Tenant(id, sanitizedName, "ACTIVE", now, now));
  }

  /**
   * Factory method to reconstruct Tenant from database rows (Infrastructure layer mapper).
   */
  public static reconstitute(
    id: string,
    name: string,
    status: TenantStatus,
    createdAt: Date,
    updatedAt: Date
  ): Tenant {
    return new Tenant(id, name, status, createdAt, updatedAt);
  }

  // Getters
  public get name(): string {
    return this._name;
  }

  public get status(): TenantStatus {
    return this._status;
  }

  /**
   * Suspend a tenant (e.g. billing failure).
   */
  public suspend(): void {
    this._status = "SUSPENDED";
  }

  /**
   * Activate a suspended tenant.
   */
  public activate(): void {
    this._status = "ACTIVE";
  }
}
