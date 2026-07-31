import { Money } from "../../src/shared-kernel/money";
import { GSTIN } from "../../src/shared-kernel/gstin";
import { Result } from "../../src/shared-kernel/result";

// ─────────────────────────────────────────────────────────────
// Money
// ─────────────────────────────────────────────────────────────
describe("Money", () => {
  // ── Factory ────────────────────────────────────────────────
  describe("create()", () => {
    it("should create Money with a valid positive amount", () => {
      const m = Money.create(100, "INR");
      expect(m.amount).toBe(100);
      expect(m.currency).toBe("INR");
    });

    it("should default currency to INR when omitted", () => {
      const m = Money.create(50);
      expect(m.currency).toBe("INR");
    });

    it("should throw when amount is NaN", () => {
      expect(() => Money.create(NaN, "INR")).toThrow(
        "Money amount must be a valid number."
      );
    });

    it("should uppercase the currency code", () => {
      const m = Money.create(10, "usd");
      expect(m.currency).toBe("USD");
    });

    it("should round amount to 4 decimal places", () => {
      const m = Money.create(10.123456789, "INR");
      expect(m.amount).toBe(10.1235); // rounded at 4th decimal
    });

    it("should handle negative amounts", () => {
      const m = Money.create(-250.75, "INR");
      expect(m.amount).toBe(-250.75);
    });

    it("should handle large numbers like 9999999.99", () => {
      const m = Money.create(9999999.99, "INR");
      expect(m.amount).toBe(9999999.99);
    });
  });

  // ── zero() ─────────────────────────────────────────────────
  describe("zero()", () => {
    it("should create zero INR by default", () => {
      const m = Money.zero();
      expect(m.amount).toBe(0);
      expect(m.currency).toBe("INR");
    });

    it("should create zero for a specified currency", () => {
      const m = Money.zero("EUR");
      expect(m.amount).toBe(0);
      expect(m.currency).toBe("EUR");
    });
  });

  // ── Arithmetic ─────────────────────────────────────────────
  describe("add()", () => {
    it("should add two Money values in the same currency", () => {
      const result = Money.create(100, "INR").add(Money.create(250.50, "INR"));
      expect(result.amount).toBe(350.50);
      expect(result.currency).toBe("INR");
    });

    it("should throw on currency mismatch", () => {
      expect(() =>
        Money.create(100, "INR").add(Money.create(50, "USD"))
      ).toThrow(/Currency mismatch/);
    });
  });

  describe("subtract()", () => {
    it("should subtract two Money values", () => {
      const result = Money.create(500, "INR").subtract(
        Money.create(200.25, "INR")
      );
      expect(result.amount).toBe(299.75);
    });

    it("should allow result to go negative", () => {
      const result = Money.create(100, "INR").subtract(
        Money.create(300, "INR")
      );
      expect(result.amount).toBe(-200);
    });

    it("should throw on currency mismatch", () => {
      expect(() =>
        Money.create(100, "INR").subtract(Money.create(50, "EUR"))
      ).toThrow(/Currency mismatch/);
    });
  });

  describe("multiply()", () => {
    it("should multiply amount by a positive factor", () => {
      const result = Money.create(100, "INR").multiply(1.18);
      expect(result.amount).toBe(118);
    });

    it("should handle multiplication by zero", () => {
      const result = Money.create(999, "INR").multiply(0);
      expect(result.amount).toBe(0);
    });

    it("should handle multiplication by a fractional factor and round to 4 decimals", () => {
      // 33.33 * 0.3333 = 11.10888... → rounds to 11.1089
      const result = Money.create(33.33, "INR").multiply(0.3333);
      expect(result.amount).toBe(11.1089);
    });
  });

  // ── Equality & Comparison ──────────────────────────────────
  describe("equals()", () => {
    it("should return true for same amount and currency", () => {
      expect(
        Money.create(100, "INR").equals(Money.create(100, "INR"))
      ).toBe(true);
    });

    it("should return false for different amounts", () => {
      expect(
        Money.create(100, "INR").equals(Money.create(200, "INR"))
      ).toBe(false);
    });

    it("should return false for different currencies even if amounts match", () => {
      expect(
        Money.create(100, "INR").equals(Money.create(100, "USD"))
      ).toBe(false);
    });
  });

  describe("isGreaterThan()", () => {
    it("should return true when amount is greater", () => {
      expect(
        Money.create(200, "INR").isGreaterThan(Money.create(100, "INR"))
      ).toBe(true);
    });

    it("should return false when amounts are equal", () => {
      expect(
        Money.create(100, "INR").isGreaterThan(Money.create(100, "INR"))
      ).toBe(false);
    });

    it("should throw on currency mismatch", () => {
      expect(() =>
        Money.create(200, "INR").isGreaterThan(Money.create(100, "USD"))
      ).toThrow(/Currency mismatch/);
    });
  });

  describe("isLessThan()", () => {
    it("should return true when amount is smaller", () => {
      expect(
        Money.create(50, "INR").isLessThan(Money.create(100, "INR"))
      ).toBe(true);
    });

    it("should return false when amount is larger", () => {
      expect(
        Money.create(200, "INR").isLessThan(Money.create(100, "INR"))
      ).toBe(false);
    });
  });

  // ── Immutability ───────────────────────────────────────────
  describe("immutability", () => {
    it("should be frozen and reject mutations", () => {
      const m = Money.create(100, "INR");
      expect(() => {
        (m as any).amount = 999;
      }).toThrow();
    });
  });

  // ── format() ───────────────────────────────────────────────
  describe("format()", () => {
    it("should format INR with ₹ symbol", () => {
      const formatted = Money.create(1250.50, "INR").format();
      expect(formatted).toContain("₹");
      expect(formatted).toContain("1,250.50");
    });

    it("should format USD with $ symbol", () => {
      const formatted = Money.create(500, "USD").format();
      expect(formatted).toBe("$500.00");
    });

    it("should format EUR with € symbol", () => {
      const formatted = Money.create(99.99, "EUR").format();
      expect(formatted).toBe("€99.99");
    });

    it("should format unknown currency using its code as prefix", () => {
      const formatted = Money.create(42, "GBP").format();
      expect(formatted).toMatch(/^GBP\s/);
      expect(formatted).toContain("42.00");
    });

    it("should format zero amount correctly", () => {
      const formatted = Money.zero("INR").format();
      expect(formatted).toContain("₹");
      expect(formatted).toContain("0.00");
    });

    it("should format large number 9999999.99 with grouping", () => {
      const formatted = Money.create(9999999.99, "INR").format();
      expect(formatted).toContain("₹");
      // en-IN grouping: 99,99,999.99
      expect(formatted).toContain("99,99,999.99");
    });
  });
});

// ─────────────────────────────────────────────────────────────
// GSTIN
// ─────────────────────────────────────────────────────────────
describe("GSTIN", () => {
  const VALID_MH = "27AAPFU0939F1ZV"; // Maharashtra
  const VALID_DL = "07AAPFU0939F1ZV"; // Delhi
  const VALID_KA = "29AAPFU0939F1ZV"; // Karnataka

  describe("create()", () => {
    it("should create a valid GSTIN and store its value", () => {
      const g = GSTIN.create(VALID_MH);
      expect(g.value).toBe(VALID_MH);
    });

    it("should uppercase a lowercase input", () => {
      const g = GSTIN.create("27aapfu0939f1zv");
      expect(g.value).toBe("27AAPFU0939F1ZV");
    });

    it("should throw for a GSTIN that is too short", () => {
      expect(() => GSTIN.create("27AAPFU")).toThrow(/Invalid GSTIN format/);
    });

    it("should throw for a GSTIN that is too long", () => {
      expect(() => GSTIN.create("27AAPFU0939F1ZV9999")).toThrow(
        /Invalid GSTIN format/
      );
    });

    it("should throw for an empty string", () => {
      expect(() => GSTIN.create("")).toThrow(/Invalid GSTIN format/);
    });

    it("should throw for a random 15-char string that doesn't match the pattern", () => {
      expect(() => GSTIN.create("ABCDEFGHIJKLMNO")).toThrow(
        /Invalid GSTIN format/
      );
    });
  });

  describe("stateCode", () => {
    it("should extract 27 for Maharashtra", () => {
      expect(GSTIN.create(VALID_MH).stateCode).toBe("27");
    });

    it("should extract 07 for Delhi", () => {
      expect(GSTIN.create(VALID_DL).stateCode).toBe("07");
    });

    it("should extract 29 for Karnataka", () => {
      expect(GSTIN.create(VALID_KA).stateCode).toBe("29");
    });
  });

  describe("isSameStateAs()", () => {
    it("should return true for two GSTINs from the same state", () => {
      const a = GSTIN.create(VALID_MH);
      const b = GSTIN.create("27AAECR5055K1ZF"); // also Maharashtra
      expect(a.isSameStateAs(b)).toBe(true);
    });

    it("should return false for GSTINs from different states", () => {
      const mh = GSTIN.create(VALID_MH);
      const dl = GSTIN.create(VALID_DL);
      expect(mh.isSameStateAs(dl)).toBe(false);
    });
  });

  describe("immutability", () => {
    it("should be frozen and reject mutations", () => {
      const g = GSTIN.create(VALID_MH);
      expect(() => {
        (g as any).value = "CHANGED";
      }).toThrow();
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Result
// ─────────────────────────────────────────────────────────────
describe("Result", () => {
  describe("ok()", () => {
    it("should mark isSuccess as true and isFailure as false", () => {
      const r = Result.ok<string>("hello");
      expect(r.isSuccess).toBe(true);
      expect(r.isFailure).toBe(false);
    });

    it("should return the wrapped value via .value", () => {
      const r = Result.ok<number>(42);
      expect(r.value).toBe(42);
    });

    it("should work with object values", () => {
      const payload = { id: 1, name: "test" };
      const r = Result.ok(payload);
      expect(r.value).toEqual(payload);
    });

    it("should throw when accessing .error on a successful Result", () => {
      const r = Result.ok("success");
      expect(() => r.error).toThrow(
        /Cannot retrieve the error of a successful Result/
      );
    });
  });

  describe("fail()", () => {
    it("should mark isSuccess as false and isFailure as true", () => {
      const r = Result.fail<string>("something went wrong");
      expect(r.isSuccess).toBe(false);
      expect(r.isFailure).toBe(true);
    });

    it("should return the error via .error", () => {
      const r = Result.fail<string>("bad input");
      expect(r.error).toBe("bad input");
    });

    it("should work with error objects", () => {
      const err = { code: 404, message: "Not found" };
      const r = Result.fail(err);
      expect(r.error).toEqual(err);
    });

    it("should throw when accessing .value on a failed Result", () => {
      const r = Result.fail("oops");
      expect(() => r.value).toThrow(
        /Cannot retrieve the value of a failed Result/
      );
    });
  });

  describe("immutability", () => {
    it("should be frozen and reject mutations", () => {
      const r = Result.ok("data");
      expect(() => {
        (r as any).isSuccess = false;
      }).toThrow();
    });
  });
});
