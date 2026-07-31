import crypto from "crypto";
import { Money } from "../../../../shared-kernel/money";
import { Result } from "../../../../shared-kernel/result";
import { Bill } from "../../../sales/domain/entities/bill";
import { Account } from "../../domain/entities/account";
import { JournalEntry } from "../../domain/entities/journal-entry";
import { LedgerPosting } from "../../domain/value-objects/ledger-posting";
import { AccountRepository } from "../../domain/repositories/account-repository.interface";
import { JournalEntryRepository } from "../../domain/repositories/journal-entry-repository.interface";

export type PostSalesBillLedgerCommand = {
  tenantId: string;
  bill: Bill; // The processed sales bill aggregate
};

/**
 * Application Use Case that translates an operational POS billing event
 * into a balanced double-entry General Ledger posting.
 */
export class PostSalesBillLedgerUseCase {
  private readonly accountRepo: AccountRepository;
  private readonly journalRepo: JournalEntryRepository;

  constructor(accountRepo: AccountRepository, journalRepo: JournalEntryRepository) {
    this.accountRepo = accountRepo;
    this.journalRepo = journalRepo;
  }

  public async execute(command: PostSalesBillLedgerCommand): Promise<Result<JournalEntry, string>> {
    const { tenantId, bill } = command;

    // 1. Resolve and ensure the Chart of Accounts accounts exist (auto-seed if missing)
    const cashAcct = await this.getOrCreateAccount(tenantId, "10100", "Cash-in-Hand", "ASSET");
    const salesAcct = await this.getOrCreateAccount(tenantId, "40100", "Sales Revenue", "REVENUE");
    
    // GST Output Accounts
    const cgstAcct = await this.getOrCreateAccount(tenantId, "20201", "Output CGST Account", "LIABILITY");
    const sgstAcct = await this.getOrCreateAccount(tenantId, "20202", "Output SGST Account", "LIABILITY");
    const igstAcct = await this.getOrCreateAccount(tenantId, "20203", "Output IGST Account", "LIABILITY");

    const postings: LedgerPosting[] = [];

    // 2. Debit: Cash Account (Asset increase) for the grand total paid
    const debitRes = LedgerPosting.debit(crypto.randomUUID(), cashAcct.id, bill.grandTotal);
    if (debitRes.isFailure) return Result.fail(debitRes.error);
    postings.push(debitRes.value);

    // 3. Credit: Revenue Account (Revenue increase) for subtotal
    const creditRevRes = LedgerPosting.credit(crypto.randomUUID(), salesAcct.id, bill.subtotal);
    if (creditRevRes.isFailure) return Result.fail(creditRevRes.error);
    postings.push(creditRevRes.value);

    // 4. Credits for tax outputs (if tax amounts exist)
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;

    for (const item of bill.items) {
      totalCgst += item.cgstAmount.amount;
      totalSgst += item.sgstAmount.amount;
      totalIgst += item.igstAmount.amount;
    }

    const currency = bill.grandTotal.currency;

    if (totalCgst > 0) {
      const cgstMoney = Money.create(totalCgst, currency);
      const taxRes = LedgerPosting.credit(crypto.randomUUID(), cgstAcct.id, cgstMoney);
      if (taxRes.isFailure) return Result.fail(taxRes.error);
      postings.push(taxRes.value);
    }

    if (totalSgst > 0) {
      const sgstMoney = Money.create(totalSgst, currency);
      const taxRes = LedgerPosting.credit(crypto.randomUUID(), sgstAcct.id, sgstMoney);
      if (taxRes.isFailure) return Result.fail(taxRes.error);
      postings.push(taxRes.value);
    }

    if (totalIgst > 0) {
      const igstMoney = Money.create(totalIgst, currency);
      const taxRes = LedgerPosting.credit(crypto.randomUUID(), igstAcct.id, igstMoney);
      if (taxRes.isFailure) return Result.fail(taxRes.error);
      postings.push(taxRes.value);
    }

    // 5. Instantiate Journal Entry (performs double-entry balancing validations)
    const journalId = crypto.randomUUID();
    const entryResult = JournalEntry.create({
      id: journalId,
      tenantId,
      referenceId: bill.id,
      referenceType: "SALES_BILL",
      narration: `Automated ledger posting for Sales Invoice ${bill.billNumber}`,
      postings,
    });

    if (entryResult.isFailure) {
      return Result.fail(entryResult.error);
    }

    const journalEntry = entryResult.value;

    // 6. Save to PostgreSQL ledger
    try {
      await this.journalRepo.save(journalEntry);
      return Result.ok(journalEntry);
    } catch (error: any) {
      console.error(`[Use Case Error] Ledger posting failed during DB commit: ${error.message}`);
      return Result.fail("Failed to post journal entry to the database ledger.");
    }
  }

  /**
   * Helper utility to resolve an account or create it on the fly.
   */
  private async getOrCreateAccount(
    tenantId: string,
    code: string,
    name: string,
    type: "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE"
  ): Promise<Account> {
    const existing = await this.accountRepo.findByCode(tenantId, code);
    if (existing) {
      return existing;
    }

    const id = crypto.randomUUID();
    const result = Account.create({ id, tenantId, code, name, type });
    if (result.isFailure) {
      throw new Error(`Failed to seed default account: ${result.error}`);
    }

    const account = result.value;
    await this.accountRepo.save(account);
    console.log(`[Accounting Seed] Created account '${name}' (Code: ${code}) for tenant ${tenantId}.`);
    return account;
  }
}
