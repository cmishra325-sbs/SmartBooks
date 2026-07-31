import { PoolClient } from "pg";
import { dbPool } from "../../../../shared-kernel/database";
import { Account, AccountType } from "../../domain/entities/account";
import { AccountRepository } from "../../domain/repositories/account-repository.interface";

/**
 * PostgreSQL Implementation of the AccountRepository interface.
 */
export class PgAccountRepository implements AccountRepository {

  public async save(account: Account, client?: PoolClient): Promise<void> {
    const sql = `
      INSERT INTO accounting.accounts (id, tenant_id, code, name, acct_type, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (tenant_id, code)
      DO UPDATE SET
        name = EXCLUDED.name,
        acct_type = EXCLUDED.acct_type,
        updated_at = clock_timestamp();
    `;
    const params = [
      account.id,
      account.tenantId,
      account.code,
      account.name,
      account.type,
      account.createdAt,
      account.updatedAt,
    ];

    if (client) {
      await client.query(sql, params);
    } else {
      await dbPool.query(sql, params);
    }
  }

  public async findByCode(tenantId: string, code: string): Promise<Account | null> {
    const sql = `SELECT * FROM accounting.accounts WHERE tenant_id = $1 AND code = $2;`;
    const res = await dbPool.query(sql, [tenantId, code.trim()]);

    if (res.rows.length === 0) {
      return null;
    }

    return this.mapRowToAccount(res.rows[0]);
  }

  public async findById(tenantId: string, id: string): Promise<Account | null> {
    const sql = `SELECT * FROM accounting.accounts WHERE id = $1 AND tenant_id = $2;`;
    const res = await dbPool.query(sql, [id, tenantId]);

    if (res.rows.length === 0) {
      return null;
    }

    return this.mapRowToAccount(res.rows[0]);
  }

  private mapRowToAccount(row: any): Account {
    return Account.reconstitute({
      id: row.id,
      tenantId: row.tenant_id,
      code: row.code,
      name: row.name,
      type: row.acct_type as AccountType,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
}
