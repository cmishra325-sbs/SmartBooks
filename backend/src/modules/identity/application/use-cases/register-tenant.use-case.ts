import crypto from "crypto";
import { dbPool } from "../../../../shared-kernel/database";
import { Result } from "../../../../shared-kernel/result";
import { Tenant } from "../../domain/entities/tenant";
import { User } from "../../domain/entities/user";
import { TenantRepository } from "../../domain/repositories/tenant-repository.interface";
import { UserRepository } from "../../domain/repositories/user-repository.interface";

/**
 * Request payload structure for tenant registration.
 */
export type RegisterTenantCommand = {
  tenantName: string;
  ownerEmail: string;
  ownerPasswordHash: string;
  ownerFirstName: string;
  ownerLastName: string;
};

/**
 * Response structure for successful registration.
 */
export type RegisterTenantDto = {
  tenantId: string;
  tenantName: string;
  ownerId: string;
  ownerEmail: string;
};

/**
 * Application Use Case that coordinates tenant registration.
 * Executes both Tenant and Owner User creation inside a single SQL transaction block.
 */
export class RegisterTenantUseCase {
  private readonly tenantRepo: TenantRepository;
  private readonly userRepo: UserRepository;

  constructor(tenantRepo: TenantRepository, userRepo: UserRepository) {
    this.tenantRepo = tenantRepo;
    this.userRepo = userRepo;
  }

  public async execute(command: RegisterTenantCommand): Promise<Result<RegisterTenantDto, string>> {
    // 1. Check if email is already taken in the database
    const existingUser = await this.userRepo.findByEmail(command.ownerEmail);
    if (existingUser) {
      return Result.fail(`Registration failed: Email address '${command.ownerEmail}' is already registered.`);
    }

    // 2. Generate UUIDs (using node crypto)
    const tenantId = crypto.randomUUID();
    const userId = crypto.randomUUID();

    // 3. Instantiate Domain Entities (triggers business validations)
    const tenantResult = Tenant.create(tenantId, command.tenantName);
    if (tenantResult.isFailure) {
      return Result.fail(tenantResult.error);
    }

    const userResult = User.create(
      userId,
      tenantId,
      command.ownerEmail,
      command.ownerPasswordHash,
      command.ownerFirstName,
      command.ownerLastName,
      "OWNER" // First user created is automatically assigned the OWNER role
    );
    if (userResult.isFailure) {
      return Result.fail(userResult.error);
    }

    const tenant = tenantResult.value;
    const user = userResult.value;

    // 4. Begin Database Transaction Block (ensures atomic writes)
    const client = await dbPool.connect();
    try {
      await client.query("BEGIN");

      // Save both aggregates sharing the same connection transaction client
      await this.tenantRepo.save(tenant, client);
      await this.userRepo.save(user, client);

      await client.query("COMMIT");
      
      // Return type-safe success DTO
      return Result.ok({
        tenantId: tenant.id,
        tenantName: tenant.name,
        ownerId: user.id,
        ownerEmail: user.email,
      });
    } catch (dbError: any) {
      await client.query("ROLLBACK");
      console.error(`[Use Case Error] Tenant registration failed during DB commit: ${dbError.message}`);
      return Result.fail("Registration failed due to a database database transaction error.");
    } finally {
      // Release the connection client back to the connection pool
      client.release();
    }
  }
}
