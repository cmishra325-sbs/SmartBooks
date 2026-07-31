/**
 * Immutable Value Object representing monetary values.
 * Prevents precision errors and encapsulates currency boundaries.
 */
export class Money {
  public readonly amount: number; // Stored to 4 decimal places
  public readonly currency: string;

  private constructor(amount: number, currency: string = "INR") {
    // Round to 4 decimal places to prevent float accumulation issues
    this.amount = Math.round(amount * 10000) / 10000;
    this.currency = currency.toUpperCase();
    Object.freeze(this);
  }

  /**
   * Factory method to create Money instance.
   */
  public static create(amount: number, currency: string = "INR"): Money {
    if (isNaN(amount)) {
      throw new Error("Money amount must be a valid number.");
    }
    return new Money(amount, currency);
  }

  /**
   * Factory method for zero balance.
   */
  public static zero(currency: string = "INR"): Money {
    return new Money(0, currency);
  }

  public add(other: Money): Money {
    this.checkCurrencyCompatibility(other);
    return new Money(this.amount + other.amount, this.currency);
  }

  public subtract(other: Money): Money {
    this.checkCurrencyCompatibility(other);
    return new Money(this.amount - other.amount, this.currency);
  }

  public multiply(factor: number): Money {
    return new Money(this.amount * factor, this.currency);
  }

  public equals(other: Money): boolean {
    return this.currency === other.currency && this.amount === other.amount;
  }

  public isGreaterThan(other: Money): boolean {
    this.checkCurrencyCompatibility(other);
    return this.amount > other.amount;
  }

  public isLessThan(other: Money): boolean {
    this.checkCurrencyCompatibility(other);
    return this.amount < other.amount;
  }

  /**
   * Enforce that calculations only occur inside the same currency context.
   */
  private checkCurrencyCompatibility(other: Money): void {
    if (this.currency !== other.currency) {
      throw new Error(
        `Currency mismatch: Operations between ${this.currency} and ${other.currency} require a conversion rate.`
      );
    }
  }

  /**
   * Return rounded currency string for human presentation (e.g. "₹1,250.50").
   */
  public format(): string {
    const symbols: Record<string, string> = { INR: "₹", USD: "$", EUR: "€" };
    const prefix = symbols[this.currency] || `${this.currency} `;
    
    // Format to standard 2 decimal places for display purposes
    const formattedAmount = this.amount.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    
    return `${prefix}${formattedAmount}`;
  }
}
