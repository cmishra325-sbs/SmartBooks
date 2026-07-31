import { JournalEntry } from "../entities/journal-entry";

export interface JournalEntryRepository {
  /**
   * Save a journal entry and its postings atomically to the ledger.
   */
  save(entry: JournalEntry, client?: any): Promise<void>;

  /**
   * Fetch a journal entry by ID.
   */
  findById(tenantId: string, id: string): Promise<JournalEntry | null>;
}
