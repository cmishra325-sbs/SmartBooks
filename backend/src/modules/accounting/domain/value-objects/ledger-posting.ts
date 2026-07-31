import { Money } from "../../../../shared-kernel/money";
import { Result } from "../../../../shared-kernel/result";

/**
 * Value Object representing a single posting line (split debit or credit) inside a Journal Entry.
 */
export class LedgerPosting {
  public readonly id: string;
  public readonly accountId: string;
  public readonly debitAmount: Money;
  public readonly creditAmount: Money;

  private constructor(id: string, accountId: string, debitAmount: Money, creditAmount: Money) {
    this.id = id;
    this.accountId = accountId;
    this.debitAmount = debitAmount;
    this.creditAmount = creditAmount;
    Object.freeze(this);
  }

  /**
   * Factory method to create a debit posting entry.
   */
  public static debit(id: string, accountId: string, amount: Money): Result<LedgerPosting, string> {
    if (amount.amount <= 0) {
      return Result.fail("Debit posting amount must be greater than zero.");
    }
    return Result.ok(new LedgerPosting(id, accountId, amount, Money.zero(amount.currency)));
  }

  /**
   * Factory method to create a credit posting entry.
   */
  public static credit(id: string, accountId: string, amount: Money): Result<LedgerPosting, string> {
    if (amount.amount <= 0) {
      return Result.fail("Credit posting amount must be greater than zero.");
    }
    return Result.ok(new LedgerPosting(id, accountId, Money.zero(amount.currency), amount));
  }

  /**
   * Reconstitutes ledger posting row records.
   */
  public static reconstitute(id: string, accountId: string, debitAmount: Money, creditAmount: Money): LedgerPosting {
    return new LedgerPosting(id, accountId, debitAmount, creditAmount);
  }
}
