import { Result } from "../../../../shared-kernel/result";

/**
 * User Role types
 */
export type UserRole = "OWNER" | "CASHIER" | "ACCOUNTANT" | "USER";

/**
 * User Domain Entity representing an authenticated platform profile.
 */
export class User {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly email: string;
  public readonly passwordHash: string;
  private _firstName: string;
  private _lastName: string;
  private _role: UserRole;
  private _isActive: boolean;
  public readonly createdAt: Date;
  public readonly updatedAt: Date;

  private constructor(
    id: string,
    tenantId: string,
    email: string,
    passwordHash: string,
    firstName: string,
    lastName: string,
    role: UserRole,
    isActive: boolean,
    createdAt: Date,
    updatedAt: Date
  ) {
    this.id = id;
    this.tenantId = tenantId;
    this.email = email;
    this.passwordHash = passwordHash;
    this._firstName = firstName;
    this._lastName = lastName;
    this._role = role;
    this._isActive = isActive;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  /**
   * Factory method to create a new User.
   */
  public static create(
    id: string,
    tenantId: string,
    email: string,
    passwordHash: string,
    firstName: string,
    lastName: string,
    role: UserRole = "USER"
  ): Result<User, string> {
    const cleanEmail = email.toLowerCase().trim();
    const cleanFirstName = firstName.trim();
    const cleanLastName = lastName.trim();

    // Simple email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return Result.fail(`Invalid email address format: '${email}'`);
    }

    if (!cleanFirstName || !cleanLastName) {
      return Result.fail("User first and last name must not be empty.");
    }

    if (!passwordHash) {
      return Result.fail("Password hash is required.");
    }

    const now = new Date();
    return Result.ok(
      new User(id, tenantId, cleanEmail, passwordHash, cleanFirstName, cleanLastName, role, true, now, now)
    );
  }

  /**
   * Factory method to reconstruct User from database records.
   */
  public static reconstitute(
    id: string,
    tenantId: string,
    email: string,
    passwordHash: string,
    firstName: string,
    lastName: string,
    role: UserRole,
    isActive: boolean,
    createdAt: Date,
    updatedAt: Date
  ): User {
    return new User(id, tenantId, email, passwordHash, firstName, lastName, role, isActive, createdAt, updatedAt);
  }

  // Getters
  public get firstName(): string {
    return this._firstName;
  }

  public get lastName(): string {
    return this._lastName;
  }

  public get role(): UserRole {
    return this._role;
  }

  public get isActive(): boolean {
    return this._isActive;
  }

  // Business operations
  public deactivate(): void {
    this._isActive = false;
  }

  public activate(): void {
    this._isActive = true;
  }

  public changeRole(newRole: UserRole): void {
    this._role = newRole;
  }
}
