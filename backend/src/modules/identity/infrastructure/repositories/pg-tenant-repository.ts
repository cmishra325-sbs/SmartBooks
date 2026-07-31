import { PoolClient } from "pg";
import { dbPool } from "../../../../shared-kernel/database";
import { Tenant, TenantStatus } from "../../domain/entities/tenant";
import { TenantRepository } from "../../domain/repositories/tenant-repository.interface";

/**
 * PostgreSQL Implementation of the TenantRepository interface.
 * Handles database rows translation to Tenant domain aggregates.
 */
export class PgTenantRepository implements TenantRepository {
  
  public async save(tenant: Tenant, client?: PoolClient): Promise<void> {
    const sql = `
      INSERT INTO identity.tenants (id, name, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (id) 
      DO UPDATE SET 
        name = EXCLUDED.name,
        status = EXCLUDED.status,
        updated_at = clock_timestamp();
    `;
    const params = [
      tenant.id,
      tenant.name,
      tenant.status,
      tenant.createdAt,
      tenant.updatedAt,
    ];

    // If an active transaction client is provided, execute using it.
    // Otherwise, execute using the global database connection pool.
    if (client) {
      await client.query(sql, params);
    } else {
      await dbPool.query(sql, params);
    }
  }

  public async findById(id: string): Promise<Tenant | null> {
    const sql = `SELECT * FROM identity.tenants WHERE id = $1;`;
    const res = await dbPool.query(sql, [id]);

    if (res.rows.length === 0) {
      return null;
    }

    const row = res.rows[0];
    return Tenant.reconstitute(
      row.id,
      row.name,
      row.status as TenantStatus,
      row.created_at,
      row.updated_at
    );
  }
}
