import crypto from "crypto";
import { Money } from "../../../../shared-kernel/money";
import { Result } from "../../../../shared-kernel/result";
import { Item, ItemType } from "../../domain/entities/item";
import { ItemRepository } from "../../domain/repositories/item-repository.interface";

/**
 * Command payload structure for creating a catalog item.
 */
export type CreateItemCommand = {
  tenantId: string;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  itemType: ItemType;
  unitOfMeasure?: string;
  hsnCode?: string | null;
  purchasePriceAmount: number;
  salesPriceAmount: number;
  taxRate: number; // e.g. 18.00
  isTaxInclusive: boolean;
};

/**
 * Application Use Case that coordinates Catalog Item creation.
 * Enforces multi-tenant barcode uniqueness.
 */
export class CreateItemUseCase {
  private readonly itemRepo: ItemRepository;

  constructor(itemRepo: ItemRepository) {
    this.itemRepo = itemRepo;
  }

  public async execute(command: CreateItemCommand): Promise<Result<Item, string>> {
    // 1. If a barcode is provided, verify it is unique within this tenant context
    if (command.barcode) {
      const existingItem = await this.itemRepo.findByBarcode(command.tenantId, command.barcode);
      if (existingItem) {
        return Result.fail(
          `Catalog error: An item with barcode '${command.barcode}' already exists in your workspace.`
        );
      }
    }

    // 2. Generate new unique ID
    const itemId = crypto.randomUUID();

    // 3. Create Money value objects for prices
    const purchasePrice = Money.create(command.purchasePriceAmount, "INR");
    const salesPrice = Money.create(command.salesPriceAmount, "INR");

    // 4. Instantiate Item domain aggregate
    const itemResult = Item.create({
      id: itemId,
      tenantId: command.tenantId,
      name: command.name,
      sku: command.sku,
      barcode: command.barcode,
      itemType: command.itemType,
      unitOfMeasure: command.unitOfMeasure,
      hsnCode: command.hsnCode,
      purchasePrice,
      salesPrice,
      taxRate: command.taxRate,
      isTaxInclusive: command.isTaxInclusive,
    });

    if (itemResult.isFailure) {
      return Result.fail(itemResult.error);
    }

    const item = itemResult.value;

    // 5. Commit to database using SQL repository adapter
    try {
      await this.itemRepo.save(item);
      return Result.ok(item);
    } catch (error: any) {
      console.error(`[Use Case Error] Catalog creation failed in DB commit: ${error.message}`);
      return Result.fail("Failed to save the catalog item to the database.");
    }
  }
}
