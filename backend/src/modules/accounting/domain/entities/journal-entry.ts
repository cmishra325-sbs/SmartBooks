import { Result } from "../../../../shared-kernel/result";
import { LedgerPosting } from "../value-objects/ledger-posting";

/**
 * JournalEntry Aggregate Root representing a double-entry transaction record.
 * Validates that debits exactly balance credits at transaction commit time.
 */
export class JournalEntry {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly referenceId: string | null;
  public readonly referenceType: string | null;
  public readonly narration: string | null;
  private readonly _postings: LedgerPosting[];
  public readonly postedAt: Date;
  public readonly createdAt: Date;

  private constructor(params: {
    id: string;
    tenantId: string;
    referenceId: string | null;
    referenceType: string | null;
    narration: string | null;
    postings: LedgerPosting[];
    postedAt: Date;
    createdAt: Date;
  }) {
    this.id = params.id;
    this.tenantId = params.tenantId;
    this.referenceId = params.referenceId;
    this.referenceType = params.referenceType;
    this.narration = params.narration;
    this._postings = params.postings;
    this.postedAt = params.postedAt;
    this.createdAt = params.createdAt;
  }

  /**
   * Factory method to create and validate a balanced double-entry JournalEntry.
   */
  public static create(params: {
    id: string;
    tenantId: string;
    referenceId?: string | null;
    referenceType?: string | null;
    narration?: string | null;
    postings: LedgerPosting[];
    postedAt?: Date;
  }): Result<JournalEntry, string> {
    if (params.postings.length < 2) {
      return Result.fail("A double-entry journal posting must contain at least 2 lines (one debit and one credit).");
    }

    // Sum debits and credits, rounding to 2 decimal places to prevent float-rounding errors
    const totalDebits = params.postings.reduce((sum, post) => sum + post.debitAmount.amount, 0);
    const totalCredits = params.postings.reduce((sum, post) => sum + post.creditAmount.amount, 0);

    const roundedDebits = Math.round(totalDebits * 100) / 100;
    const roundedCredits = Math.round(totalCredits * 100) / 100;

    if (roundedDebits !== roundedCredits) {
      return Result.fail(
        `Double-entry imbalance: Sum of Debits (${roundedDebits}) must exactly equal sum of Credits (${roundedCredits}). Difference: ${Math.abs(roundedDebits - roundedCredits)}`
      );
    }

    const now = new Date();
    return Result.ok(
      new JournalEntry({
        id: params.id,
        tenantId: params.tenantId,
        referenceId: params.referenceId || null,
        referenceType: params.referenceType || null,
        narration: params.narration || null,
        postings: params.postings,
        postedAt: params.postedAt || now,
        createdAt: now,
      })
    );
  }

  /**
   * Reconstitutes the JournalEntry aggregate from database row listings.
   */
  public static reconstitute(params: {
    id: string;
    tenantId: string;
    referenceId: string | null;
    referenceType: string | null;
    narration: string | null;
    postings: LedgerPosting[];
    postedAt: Date;
    createdAt: Date;
  }): JournalEntry {
    return new JournalEntry(params);
  }

  // Getters
  public get postings(): readonly LedgerPosting[] {
    return this._postings;
  }
}
