/**
 * Value Object representing an Indian GSTIN (Goods and Services Tax Identification Number).
 * Encapsulates validation rules and exposes State Codes for Place of Supply (POS) tax checks.
 */
export class GSTIN {
  public readonly value: string;
  public readonly stateCode: string;

  private constructor(value: string) {
    this.value = value.toUpperCase().trim();
    this.stateCode = this.value.substring(0, 2);
    Object.freeze(this);
  }

  /**
   * Factory method to create and validate a GSTIN.
   */
  public static create(value: string): GSTIN {
    const sanitized = value.toUpperCase().trim();
    
    // Standard Indian GSTIN Regex: 15 characters
    const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    
    if (!gstinRegex.test(sanitized)) {
      throw new Error(`Invalid GSTIN format: '${value}'. Must be a valid 15-character Indian GSTIN.`);
    }
    
    return new GSTIN(sanitized);
  }

  /**
   * Determine if the supply is intra-state (same state code) or inter-state.
   */
  public isSameStateAs(other: GSTIN): boolean {
    return this.stateCode === other.stateCode;
  }
}
