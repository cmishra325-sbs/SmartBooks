import { PoolClient } from "pg";
import { dbPool } from "../../../../shared-kernel/database";
import { User, UserRole } from "../../domain/entities/user";
import { UserRepository } from "../../domain/repositories/user-repository.interface";

/**
 * PostgreSQL Implementation of the UserRepository interface.
 * Handles database rows translation to User domain aggregates.
 */
export class PgUserRepository implements UserRepository {
  
  public async save(user: User, client?: PoolClient): Promise<void> {
    const sql = `
      INSERT INTO identity.users (
        id, tenant_id, email, password_hash, first_name, last_name, user_role, is_active, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (id)
      DO UPDATE SET
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        user_role = EXCLUDED.user_role,
        is_active = EXCLUDED.is_active,
        updated_at = clock_timestamp();
    `;
    const params = [
      user.id,
      user.tenantId,
      user.email,
      user.passwordHash,
      user.firstName,
      user.lastName,
      user.role,
      user.isActive,
      user.createdAt,
      user.updatedAt,
    ];

    if (client) {
      await client.query(sql, params);
    } else {
      await dbPool.query(sql, params);
    }
  }

  public async findByEmail(email: string): Promise<User | null> {
    const sql = `SELECT * FROM identity.users WHERE email = $1;`;
    const res = await dbPool.query(sql, [email.toLowerCase().trim()]);

    if (res.rows.length === 0) {
      return null;
    }

    const row = res.rows[0];
    return this.mapRowToUser(row);
  }

  public async findById(id: string): Promise<User | null> {
    const sql = `SELECT * FROM identity.users WHERE id = $1;`;
    const res = await dbPool.query(sql, [id]);

    if (res.rows.length === 0) {
      return null;
    }

    const row = res.rows[0];
    return this.mapRowToUser(row);
  }

  private mapRowToUser(row: any): User {
    return User.reconstitute(
      row.id,
      row.tenant_id,
      row.email,
      row.password_hash,
      row.first_name,
      row.last_name,
      row.user_role as UserRole,
      row.is_active,
      row.created_at,
      row.updated_at
    );
  }
}
