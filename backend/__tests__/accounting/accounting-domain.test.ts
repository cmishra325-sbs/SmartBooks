import { Account } from '../../src/modules/accounting/domain/entities/account';
import { LedgerPosting } from '../../src/modules/accounting/domain/value-objects/ledger-posting';
import { JournalEntry } from '../../src/modules/accounting/domain/entities/journal-entry';
import { Money } from '../../src/shared-kernel/money';

// ---------------------------------------------------------------------------
// Account
// ---------------------------------------------------------------------------
describe('Account', () => {
  const baseParams = {
    id: 'acc-001',
    tenantId: 'tenant-001',
    code: '10100',
    name: 'Cash-in-Hand',
    type: 'ASSET' as const,
  };

  describe('create — happy paths', () => {
    it('should create a valid ASSET account with code "10100" and name "Cash-in-Hand"', () => {
      const result = Account.create(baseParams);

      expect(result.isSuccess).toBe(true);
      const account = result.value;
      expect(account.id).toBe('acc-001');
      expect(account.tenantId).toBe('tenant-001');
      expect(account.code).toBe('10100');
      expect(account.name).toBe('Cash-in-Hand');
      expect(account.type).toBe('ASSET');
      expect(account.createdAt).toBeInstanceOf(Date);
      expect(account.updatedAt).toBeInstanceOf(Date);
    });

    it('should create a valid LIABILITY account', () => {
      const result = Account.create({ ...baseParams, id: 'acc-002', type: 'LIABILITY', code: '20100', name: 'Accounts Payable' });

      expect(result.isSuccess).toBe(true);
      expect(result.value.type).toBe('LIABILITY');
      expect(result.value.name).toBe('Accounts Payable');
    });

    it('should create a valid REVENUE account', () => {
      const result = Account.create({ ...baseParams, id: 'acc-003', type: 'REVENUE', code: '40100', name: 'Sales Revenue' });

      expect(result.isSuccess).toBe(true);
      expect(result.value.type).toBe('REVENUE');
    });

    it('should trim leading/trailing whitespace from code and name', () => {
      const result = Account.create({ ...baseParams, code: '  10100  ', name: '  Cash-in-Hand  ' });

      expect(result.isSuccess).toBe(true);
      expect(result.value.code).toBe('10100');
      expect(result.value.name).toBe('Cash-in-Hand');
    });
  });

  describe('create — validation failures', () => {
    it('should fail when code is an empty string', () => {
      const result = Account.create({ ...baseParams, code: '' });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('code');
    });

    it('should fail when code contains only whitespace', () => {
      const result = Account.create({ ...baseParams, code: '   ' });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('code');
    });

    it('should fail when name is an empty string', () => {
      const result = Account.create({ ...baseParams, name: '' });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('name');
    });

    it('should fail when name contains only whitespace', () => {
      const result = Account.create({ ...baseParams, name: '   ' });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('name');
    });
  });
});

// ---------------------------------------------------------------------------
// LedgerPosting
// ---------------------------------------------------------------------------
describe('LedgerPosting', () => {
  const postingId = 'lp-001';
  const accountId = 'acc-cash';

  describe('debit — happy paths', () => {
    it('should create a debit posting with debitAmount set and creditAmount zero', () => {
      const amount = Money.create(500);
      const result = LedgerPosting.debit(postingId, accountId, amount);

      expect(result.isSuccess).toBe(true);
      const posting = result.value;
      expect(posting.id).toBe(postingId);
      expect(posting.accountId).toBe(accountId);
      expect(posting.debitAmount.amount).toBe(500);
      expect(posting.creditAmount.amount).toBe(0);
    });

    it('should handle a large debit amount (₹99,99,999.99)', () => {
      const amount = Money.create(9999999.99);
      const result = LedgerPosting.debit('lp-big', accountId, amount);

      expect(result.isSuccess).toBe(true);
      expect(result.value.debitAmount.amount).toBe(9999999.99);
    });

    it('should handle a small debit amount (₹0.01)', () => {
      const amount = Money.create(0.01);
      const result = LedgerPosting.debit('lp-small', accountId, amount);

      expect(result.isSuccess).toBe(true);
      expect(result.value.debitAmount.amount).toBe(0.01);
    });
  });

  describe('credit — happy paths', () => {
    it('should create a credit posting with creditAmount set and debitAmount zero', () => {
      const amount = Money.create(750.50);
      const result = LedgerPosting.credit(postingId, accountId, amount);

      expect(result.isSuccess).toBe(true);
      const posting = result.value;
      expect(posting.debitAmount.amount).toBe(0);
      expect(posting.creditAmount.amount).toBe(750.50);
    });
  });

  describe('debit / credit — validation failures', () => {
    it('should fail when debit amount is zero', () => {
      const result = LedgerPosting.debit(postingId, accountId, Money.create(0));

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('greater than zero');
    });

    it('should fail when debit amount is negative', () => {
      const result = LedgerPosting.debit(postingId, accountId, Money.create(-100));

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('greater than zero');
    });

    it('should fail when credit amount is zero', () => {
      const result = LedgerPosting.credit(postingId, accountId, Money.create(0));

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('greater than zero');
    });

    it('should fail when credit amount is negative', () => {
      const result = LedgerPosting.credit(postingId, accountId, Money.create(-50));

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('greater than zero');
    });
  });
});

// ---------------------------------------------------------------------------
// JournalEntry
// ---------------------------------------------------------------------------
describe('JournalEntry', () => {
  // Helper: unwrap a Result<LedgerPosting> or throw
  function posting(result: ReturnType<typeof LedgerPosting.debit>): LedgerPosting {
    if (result.isFailure) throw new Error(`Posting setup failed: ${result.error}`);
    return result.value;
  }

  const tenantId = 'tenant-001';

  describe('create — balanced entries (happy paths)', () => {
    it('should succeed with a simple balanced entry (Debit ₹100 + Credit ₹100)', () => {
      const debit = posting(LedgerPosting.debit('lp-1', 'acc-cash', Money.create(100)));
      const credit = posting(LedgerPosting.credit('lp-2', 'acc-revenue', Money.create(100)));

      const result = JournalEntry.create({ id: 'je-001', tenantId, postings: [debit, credit] });

      expect(result.isSuccess).toBe(true);
      expect(result.value.postings).toHaveLength(2);
    });

    it('should succeed with multiple debits balancing a single credit (₹50 + ₹50 = ₹100)', () => {
      const d1 = posting(LedgerPosting.debit('lp-1', 'acc-cash', Money.create(50)));
      const d2 = posting(LedgerPosting.debit('lp-2', 'acc-bank', Money.create(50)));
      const c1 = posting(LedgerPosting.credit('lp-3', 'acc-revenue', Money.create(100)));

      const result = JournalEntry.create({ id: 'je-002', tenantId, postings: [d1, d2, c1] });

      expect(result.isSuccess).toBe(true);
      expect(result.value.postings).toHaveLength(3);
    });

    it('should succeed with complex split (Debit ₹1000 = Credit ₹847.46 + ₹76.27 + ₹76.27)', () => {
      const d = posting(LedgerPosting.debit('lp-1', 'acc-cash', Money.create(1000)));
      const c1 = posting(LedgerPosting.credit('lp-2', 'acc-revenue', Money.create(847.46)));
      const c2 = posting(LedgerPosting.credit('lp-3', 'acc-cgst', Money.create(76.27)));
      const c3 = posting(LedgerPosting.credit('lp-4', 'acc-sgst', Money.create(76.27)));

      const result = JournalEntry.create({ id: 'je-003', tenantId, postings: [d, c1, c2, c3] });

      expect(result.isSuccess).toBe(true);
      expect(result.value.postings).toHaveLength(4);
    });

    it('should handle floating-point edge case (₹33.33 + ₹33.33 + ₹33.34 = ₹100)', () => {
      const d1 = posting(LedgerPosting.debit('lp-1', 'acc-a', Money.create(33.33)));
      const d2 = posting(LedgerPosting.debit('lp-2', 'acc-b', Money.create(33.33)));
      const d3 = posting(LedgerPosting.debit('lp-3', 'acc-c', Money.create(33.34)));
      const c  = posting(LedgerPosting.credit('lp-4', 'acc-revenue', Money.create(100)));

      const result = JournalEntry.create({ id: 'je-fp', tenantId, postings: [d1, d2, d3, c] });

      expect(result.isSuccess).toBe(true);
    });

    it('should pass when very small sub-penny rounding (₹0.001 diff) cancels out after 2-decimal rounding', () => {
      // 33.333... rounds to 33.33 at 2dp; 3 × 33.3333 = 99.9999 ≈ 100.00 at 2dp
      // We use amounts that after Money's 4dp rounding still balance at JE's 2dp rounding
      const d1 = posting(LedgerPosting.debit('lp-1', 'acc-a', Money.create(33.3333)));
      const d2 = posting(LedgerPosting.debit('lp-2', 'acc-b', Money.create(33.3333)));
      const d3 = posting(LedgerPosting.debit('lp-3', 'acc-c', Money.create(33.3334)));
      const c  = posting(LedgerPosting.credit('lp-4', 'acc-revenue', Money.create(100)));

      const result = JournalEntry.create({ id: 'je-rounding', tenantId, postings: [d1, d2, d3, c] });

      expect(result.isSuccess).toBe(true);
    });
  });

  describe('create — metadata fields', () => {
    it('should store narration correctly', () => {
      const d = posting(LedgerPosting.debit('lp-1', 'acc-cash', Money.create(200)));
      const c = posting(LedgerPosting.credit('lp-2', 'acc-rev', Money.create(200)));

      const result = JournalEntry.create({
        id: 'je-narr',
        tenantId,
        postings: [d, c],
        narration: 'Sale of goods to customer ABC',
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value.narration).toBe('Sale of goods to customer ABC');
    });

    it('should store referenceId and referenceType correctly', () => {
      const d = posting(LedgerPosting.debit('lp-1', 'acc-cash', Money.create(500)));
      const c = posting(LedgerPosting.credit('lp-2', 'acc-rev', Money.create(500)));

      const result = JournalEntry.create({
        id: 'je-ref',
        tenantId,
        postings: [d, c],
        referenceId: 'bill-42',
        referenceType: 'SALES_BILL',
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value.referenceId).toBe('bill-42');
      expect(result.value.referenceType).toBe('SALES_BILL');
    });

    it('should default optional fields to null when omitted', () => {
      const d = posting(LedgerPosting.debit('lp-1', 'acc-cash', Money.create(100)));
      const c = posting(LedgerPosting.credit('lp-2', 'acc-rev', Money.create(100)));

      const result = JournalEntry.create({ id: 'je-defaults', tenantId, postings: [d, c] });

      expect(result.isSuccess).toBe(true);
      expect(result.value.referenceId).toBeNull();
      expect(result.value.referenceType).toBeNull();
      expect(result.value.narration).toBeNull();
    });
  });

  describe('create — validation failures', () => {
    it('should fail when postings array is empty', () => {
      const result = JournalEntry.create({ id: 'je-empty', tenantId, postings: [] });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('at least 2');
    });

    it('should fail with a single posting', () => {
      const d = posting(LedgerPosting.debit('lp-1', 'acc-cash', Money.create(100)));

      const result = JournalEntry.create({ id: 'je-single', tenantId, postings: [d] });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('at least 2');
    });

    it('should fail when debits and credits are unbalanced (Debit ₹100, Credit ₹90)', () => {
      const d = posting(LedgerPosting.debit('lp-1', 'acc-cash', Money.create(100)));
      const c = posting(LedgerPosting.credit('lp-2', 'acc-rev', Money.create(90)));

      const result = JournalEntry.create({ id: 'je-unbal', tenantId, postings: [d, c] });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('imbalance');
    });
  });
});
