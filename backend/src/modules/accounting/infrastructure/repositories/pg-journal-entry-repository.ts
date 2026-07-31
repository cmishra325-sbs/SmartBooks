import { PoolClient } from "pg";
import { dbPool } from "../../../../shared-kernel/database";
import { Money } from "../../../../shared-kernel/money";
import { JournalEntry } from "../../domain/entities/journal-entry";
import { LedgerPosting } from "../../domain/value-objects/ledger-posting";
import { JournalEntryRepository } from "../../domain/repositories/journal-entry-repository.interface";

/**
 * PostgreSQL Implementation of the JournalEntryRepository interface.
 * Coordinates double-entry ledger persistence atomically.
 */
export class PgJournalEntryRepository implements JournalEntryRepository {

  public async save(entry: JournalEntry, client?: PoolClient): Promise<void> {
    const activeClient = client || (await dbPool.connect());
    const isLocalTransaction = !client;

    try {
      if (isLocalTransaction) {
        await activeClient.query("BEGIN");
      }

      // 1. Save Journal Entry Master
      const journalSql = `
        INSERT INTO accounting.journal_entries (
          id, tenant_id, reference_id, reference_type, narration, posted_at, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id)
        DO UPDATE SET
          narration = EXCLUDED.narration,
          posted_at = EXCLUDED.posted_at;
      `;
      await activeClient.query(journalSql, [
        entry.id,
        entry.tenantId,
        entry.referenceId,
        entry.referenceType,
        entry.narration,
        entry.postedAt,
        entry.createdAt,
      ]);

      // 2. Refresh Posting Lines (delete old lines, insert current lines)
      await activeClient.query(`DELETE FROM accounting.ledger_postings WHERE journal_entry_id = $1;`, [entry.id]);

      const postingSql = `
        INSERT INTO accounting.ledger_postings (id, journal_entry_id, account_id, debit_amount, credit_amount)
        VALUES ($1, $2, $3, $4, $5);
      `;
      for (const posting of entry.postings) {
        await activeClient.query(postingSql, [
          posting.id,
          entry.id,
          posting.accountId,
          posting.debitAmount.amount,
          posting.creditAmount.amount,
        ]);
      }

      if (isLocalTransaction) {
        await activeClient.query("COMMIT");
      }
    } catch (error) {
      if (isLocalTransaction) {
        await activeClient.query("ROLLBACK");
      }
      throw error;
    } finally {
      if (isLocalTransaction) {
        (activeClient as any).release();
      }
    }
  }

  public async findById(tenantId: string, id: string): Promise<JournalEntry | null> {
    // 1. Fetch Journal Entry Master
    const entryRes = await dbPool.query(
      `SELECT * FROM accounting.journal_entries WHERE id = $1 AND tenant_id = $2;`,
      [id, tenantId]
    );
    if (entryRes.rows.length === 0) {
      return null;
    }
    const entryRow = entryRes.rows[0];

    // 2. Fetch Posting Lines
    const postingsRes = await dbPool.query(
      `SELECT * FROM accounting.ledger_postings WHERE journal_entry_id = $1;`,
      [id]
    );
    const postings = postingsRes.rows.map((row) =>
      LedgerPosting.reconstitute(
        row.id,
        row.account_id,
        Money.create(Number(row.debit_amount), "INR"),
        Money.create(Number(row.credit_amount), "INR")
      )
    );

    return JournalEntry.reconstitute({
      id: entryRow.id,
      tenantId: entryRow.tenant_id,
      referenceId: entryRow.reference_id,
      referenceType: entryRow.reference_type,
      narration: entryRow.narration,
      postings,
      postedAt: entryRow.posted_at,
      createdAt: entryRow.created_at,
    });
  }
}
