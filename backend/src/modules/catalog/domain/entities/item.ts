import { Money } from "../../../../shared-kernel/money";
import { Result } from "../../../../shared-kernel/result";

export type ItemType = "PRODUCT" | "SERVICE" | "BUNDLE";

/**
 * Item Aggregate Root representing a product, service, or bundle in the catalog.
 */
export class Item {
  public readonly id: string;
  public readonly tenantId: string;
  private _name: string;
  private _sku: string | null;
  private _barcode: string | null;
  public readonly itemType: ItemType;
  private _unitOfMeasure: string;
  private _hsnCode: string | null;
  private _purchasePrice: Money;
  private _salesPrice: Money;
  private _taxRate: number; // e.g. 18.00 representing 18% GST
  private _isTaxInclusive: boolean;
  private _isDeleted: boolean;
  public readonly version: number;
  public readonly createdAt: Date;
  public readonly updatedAt: Date;

  private constructor(
    id: string,
    tenantId: string,
    name: string,
    sku: string | null,
    barcode: string | null,
    itemType: ItemType,
    unitOfMeasure: string,
    hsnCode: string | null,
    purchasePrice: Money,
    salesPrice: Money,
    taxRate: number,
    isTaxInclusive: boolean,
    isDeleted: boolean,
    version: number,
    createdAt: Date,
    updatedAt: Date
  ) {
    this.id = id;
    this.tenantId = tenantId;
    this._name = name;
    this._sku = sku;
    this._barcode = barcode;
    this.itemType = itemType;
    this._unitOfMeasure = unitOfMeasure;
    this._hsnCode = hsnCode;
    this._purchasePrice = purchasePrice;
    this._salesPrice = salesPrice;
    this._taxRate = taxRate;
    this._isTaxInclusive = isTaxInclusive;
    this._isDeleted = isDeleted;
    this.version = version;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  /**
   * Factory method to create a new Item with validation invariants.
   */
  public static create(params: {
    id: string;
    tenantId: string;
    name: string;
    sku?: string | null;
    barcode?: string | null;
    itemType: ItemType;
    unitOfMeasure?: string;
    hsnCode?: string | null;
    purchasePrice: Money;
    salesPrice: Money;
    taxRate: number;
    isTaxInclusive: boolean;
  }): Result<Item, string> {
    const cleanName = params.name.trim();
    if (!cleanName) {
      return Result.fail("Item name must not be empty.");
    }

    if (params.taxRate < 0 || params.taxRate > 100) {
      return Result.fail("GST tax rate must be between 0% and 100%.");
    }

    if (params.purchasePrice.isGreaterThan(params.salesPrice)) {
      // In B2B, a warning might occur, but we allow it as long as values are positive
      console.warn(`[Catalog Warning] Item '${cleanName}' purchase price exceeds sales price.`);
    }

    const now = new Date();
    return Result.ok(
      new Item(
        params.id,
        params.tenantId,
        cleanName,
        params.sku || null,
        params.barcode || null,
        params.itemType,
        params.unitOfMeasure || "PCS",
        params.hsnCode || null,
        params.purchasePrice,
        params.salesPrice,
        params.taxRate,
        params.isTaxInclusive,
        false, // Not deleted
        1,     // Initial version
        now,
        now
      )
    );
  }

  /**
   * Factory method to reconstitute Item from database rows.
   */
  public static reconstitute(params: {
    id: string;
    tenantId: string;
    name: string;
    sku: string | null;
    barcode: string | null;
    itemType: ItemType;
    unitOfMeasure: string;
    hsnCode: string | null;
    purchasePrice: Money;
    salesPrice: Money;
    taxRate: number;
    isTaxInclusive: boolean;
    isDeleted: boolean;
    version: number;
    createdAt: Date;
    updatedAt: Date;
  }): Item {
    return new Item(
      params.id,
      params.tenantId,
      params.name,
      params.sku,
      params.barcode,
      params.itemType,
      params.unitOfMeasure,
      params.hsnCode,
      params.purchasePrice,
      params.salesPrice,
      params.taxRate,
      params.isTaxInclusive,
      params.isDeleted,
      params.version,
      params.createdAt,
      params.updatedAt
    );
  }

  // Getters
  public get name(): string { return this._name; }
  public get sku(): string | null { return this._sku; }
  public get barcode(): string | null { return this._barcode; }
  public get unitOfMeasure(): string { return this._unitOfMeasure; }
  public get hsnCode(): string | null { return this._hsnCode; }
  public get purchasePrice(): Money { return this._purchasePrice; }
  public get salesPrice(): Money { return this._salesPrice; }
  public get taxRate(): number { return this._taxRate; }
  public get isTaxInclusive(): boolean { return this._isTaxInclusive; }
  public get isDeleted(): boolean { return this._isDeleted; }

  // Business Mutations
  public updatePrice(newPurchasePrice: Money, newSalesPrice: Money): void {
    this._purchasePrice = newPurchasePrice;
    this._salesPrice = newSalesPrice;
  }

  public softDelete(): void {
    this._isDeleted = true;
  }
}
