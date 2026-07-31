import dotenv from "dotenv";
import { Money } from "./shared-kernel/money";
import { GSTIN } from "./shared-kernel/gstin";
import { Result } from "./shared-kernel/result";
import { testConnection, query } from "./shared-kernel/database";

// Load environment variables
dotenv.config();

async function bootstrap() {
  console.log("==================================================");
  console.log("  SmartBooks Enterprise SaaS Platform - Booting   ");
  console.log("==================================================");
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`Port Configured: ${process.env.PORT || 3000}`);
  
  // Verify Shared Kernel Value Objects compilation
  const price = Money.create(1250.50, "INR");
  console.log(`\n[Test Invariant] Money formatted successfully: ${price.format()}`);

  const supplierGstin = GSTIN.create("27AAAAA1111A1Z1");
  const storeGstin = GSTIN.create("27BBBBB2222B2Z2");
  
  const isIntraState = supplierGstin.isSameStateAs(storeGstin);
  console.log(`[Test Invariant] GSTIN state code matched: ${supplierGstin.stateCode}`);
  console.log(`[Test Invariant] Transaction is Intra-State (CGST+SGST applicable): ${isIntraState}`);

  // Test Database Connection
  console.log("\n[Database] Connecting to PostgreSQL database...");
  const isDbConnected = await testConnection();
  if (isDbConnected) {
    console.log("🟢 [Database] Connection established successfully!");
    
    // Execute database migrations
    try {
      const { runMigration } = require("./shared-kernel/migrate");
      await runMigration();

      // Initialize Repositories and Use Case for Verification
      const { PgTenantRepository } = require("./modules/identity/infrastructure/repositories/pg-tenant-repository");
      const { PgUserRepository } = require("./modules/identity/infrastructure/repositories/pg-user-repository");
      const { RegisterTenantUseCase } = require("./modules/identity/application/use-cases/register-tenant.use-case");

      const tenantRepo = new PgTenantRepository();
      const userRepo = new PgUserRepository();
      const registerUseCase = new RegisterTenantUseCase(tenantRepo, userRepo);

      console.log("\n[Use Case] Registering test tenant 'Mishra Distributors'...");
      
      const email = "owner@mishra.com";
      const registerResult = await registerUseCase.execute({
        tenantName: "Mishra Distributors",
        ownerEmail: email,
        ownerPasswordHash: "pbkdf2_sha256_hash_value_123456",
        ownerFirstName: "Chandan",
        ownerLastName: "Mishra"
      });

      let activeTenantId = "";

      if (registerResult.isSuccess) {
        console.log("🟢 [Use Case] Registration completed successfully!");
        console.log(`[Use Case] Tenant ID: ${registerResult.value.tenantId}`);
        console.log(`[Use Case] Owner User ID: ${registerResult.value.ownerId}`);
        activeTenantId = registerResult.value.tenantId;
      } else {
        console.log("🔴 [Use Case] Registration failed!");
        console.log(`[Use Case] Error Details: ${registerResult.error}`);
        
        // Retrieve the existing user profile from the database to prove it was successfully saved earlier
        const existingUser = await userRepo.findByEmail(email);
        if (existingUser) {
          console.log(`\n[Database Check] Verified record in DB: User '${existingUser.firstName} ${existingUser.lastName}' is registered under Tenant ID '${existingUser.tenantId}'.`);
          activeTenantId = existingUser.tenantId;
        }
      }

      // Catalog Use Case Verification
      if (activeTenantId) {
        const { PgItemRepository } = require("./modules/catalog/infrastructure/repositories/pg-item-repository");
        const { CreateItemUseCase } = require("./modules/catalog/application/use-cases/create-item.use-case");

        const itemRepo = new PgItemRepository();
        const createItemUseCase = new CreateItemUseCase(itemRepo);

        console.log("\n[Use Case] Creating catalog item 'Parle-G Gold Biscuit'...");
        
        const barcode = "8901725181222";
        const itemResult = await createItemUseCase.execute({
          tenantId: activeTenantId,
          name: "Parle-G Gold Biscuit 100g",
          sku: "PARLE-G-GOLD-100",
          barcode: barcode,
          itemType: "PRODUCT",
          unitOfMeasure: "PCS",
          hsnCode: "1905",
          purchasePriceAmount: 8.50,
          salesPriceAmount: 10.00,
          taxRate: 18.00, // 18% GST
          isTaxInclusive: true
        });

        let itemToSell = null;

        if (itemResult.isSuccess) {
          console.log("🟢 [Use Case] Catalog item created successfully!");
          console.log(`[Use Case] Item ID: ${itemResult.value.id}`);
          console.log(`[Use Case] Sales Price (Formatted): ${itemResult.value.salesPrice.format()}`);
          itemToSell = itemResult.value;
        } else {
          console.log("🔴 [Use Case] Catalog item creation failed!");
          console.log(`[Use Case] Error Details: ${itemResult.error}`);
          
          // Verify record exists in DB using barcode index lookup
          const existingItem = await itemRepo.findByBarcode(activeTenantId, barcode);
          if (existingItem) {
            console.log(`\n[Database Check] Verified record in DB: Item '${existingItem.name}' is registered with sales price ${existingItem.salesPrice.format()} and GST rate ${existingItem.taxRate}%.`);
            itemToSell = existingItem;
          }
        }

        // POS Checkout Use Case Verification
        if (itemToSell) {
          const { PgBillRepository } = require("./modules/sales/infrastructure/repositories/pg-bill-repository");
          const { ProcessPOSCheckoutUseCase } = require("./modules/sales/application/use-cases/process-pos-checkout.use-case");

          const billRepo = new PgBillRepository();
          const checkoutUseCase = new ProcessPOSCheckoutUseCase(billRepo, itemRepo);

          console.log("\n[Use Case] Processing POS Checkout (Split Payments & GST Calculation)...");
          const checkoutResult = await checkoutUseCase.execute({
            tenantId: activeTenantId,
            lines: [{ itemId: itemToSell.id, qty: 5 }],
            payments: [
              { paymentMode: "CASH", amount: 20.00 },
              { paymentMode: "UPI", amount: 30.00, referenceNumber: "upi_tx_9876543210" }
            ],
            isIntraState: true // CGST + SGST applied
          });

          if (checkoutResult.isSuccess) {
            const bill = checkoutResult.value;
            console.log("🟢 [Use Case] POS Checkout processed successfully!");
            console.log(`[Use Case] Invoice Number: ${bill.billNumber}`);
            console.log(`[Use Case] Invoice Status: ${bill.status}`);
            console.log(`[Use Case] Subtotal: ${bill.subtotal.format()}`);
            console.log(`[Use Case] GST Tax: ${bill.taxTotal.format()}`);
            console.log(`[Use Case] Grand Total: ${bill.grandTotal.format()}`);
            console.log(`[Use Case] Total Paid: ${bill.paidAmount.format()}`);
            console.log(`[Use Case] GST Split Breakdown:`);
            console.log(`  - CGST: ${bill.items[0].cgstAmount.format()}`);
            console.log(`  - SGST: ${bill.items[0].sgstAmount.format()}`);
            console.log(`  - IGST: ${bill.items[0].igstAmount.format()}`);

            // Accounting General Ledger Posting Verification
            const { PgAccountRepository } = require("./modules/accounting/infrastructure/repositories/pg-account-repository");
            const { PgJournalEntryRepository } = require("./modules/accounting/infrastructure/repositories/pg-journal-entry-repository");
            const { PostSalesBillLedgerUseCase } = require("./modules/accounting/application/use-cases/post-sales-bill-ledger.use-case");

            const accountRepo = new PgAccountRepository();
            const journalRepo = new PgJournalEntryRepository();
            const postLedgerUseCase = new PostSalesBillLedgerUseCase(accountRepo, journalRepo);

            console.log("\n[Use Case] Posting Sales Transaction to General Ledger (Double-Entry)...");
            const postResult = await postLedgerUseCase.execute({
              tenantId: activeTenantId,
              bill: bill
            });

            if (postResult.isSuccess) {
              const journal = postResult.value;
              console.log("🟢 [Use Case] Double-entry general ledger posted successfully!");
              console.log(`[Use Case] Journal Entry ID: ${journal.id}`);
              console.log(`[Use Case] Narration: ${journal.narration}`);
              console.log(`[Use Case] Ledger Posting splits:`);
              
              for (const posting of journal.postings) {
                const account = await accountRepo.findById(activeTenantId, posting.accountId);
                if (account) {
                  const debitStr = posting.debitAmount.amount > 0 ? posting.debitAmount.format() : "-";
                  const creditStr = posting.creditAmount.amount > 0 ? posting.creditAmount.format() : "-";
                  console.log(`  * Account: ${account.name} (${account.code}) | Debit: ${debitStr} | Credit: ${creditStr}`);
                }
              }
            } else {
              console.log("🔴 [Use Case] Double-entry general ledger posting failed!");
              console.log(`[Use Case] Error Details: ${postResult.error}`);
            }

            // AI Invoice Parser Service Verification
            console.log("\n[AI Service] Starting Gemini Purchase Invoice OCR Parser Verification...");
            const { GeminiInvoiceParserService } = require("./modules/ai/application/services/gemini-invoice-parser.service");
            const aiParser = new GeminiInvoiceParserService();

            const isDummyKey = !process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === "your_gemini_api_key_here";
            
            if (isDummyKey) {
              console.log("⚠️ [AI Service] Skipped live Gemini API test because API Key is not configured in .env.");
              console.log("[AI Service] Simulated structured output from a scanned purchase bill:");
              console.log(JSON.stringify({
                supplierName: "Haldiram Foods International",
                invoiceNumber: "HF-2026-9812",
                invoiceDate: "2026-07-25",
                items: [
                  { name: "Almond Bhujia 150g", qty: 20, unitPrice: 85.00, hsnCode: "2106", taxRate: 12.00 },
                  { name: "Kaju Katli 250g", qty: 10, unitPrice: 220.00, hsnCode: "2106", taxRate: 5.00 }
                ],
                subtotal: 3900.00,
                taxTotal: 314.00,
                grandTotal: 4214.00
              }, null, 2));
            } else {
              // 1x1 transparent png image representation to check connection
              const dummyBase64Image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
              const aiResult = await aiParser.parseInvoice(dummyBase64Image, "image/png");
              
              if (aiResult.isSuccess) {
                console.log("🟢 [AI Service] Live connection and structured parsing succeeded!");
                console.log(`[AI Service] Scanned Supplier: ${aiResult.value.supplierName}`);
                console.log(`[AI Service] Invoice Details: ${JSON.stringify(aiResult.value, null, 2)}`);
              } else {
                console.log("🔴 [AI Service] Live connection failed!");
                console.log(`[AI Service] Error Details: ${aiResult.error}`);
              }
            }
          } else {
            console.log("🔴 [Use Case] POS Checkout failed!");
            console.log(`[Use Case] Error Details: ${checkoutResult.error}`);
          }
        }
      }
    } catch (err: any) {
      console.error(`[Database Error] Schema check failed: ${err.message}`);
    }
  } else {
    console.log("🔴 [Database] Connection failed!");
    console.log("\n--- DATABASE SETUP REQUIRED ---");
    console.log("To resolve this, please do one of the following:");
    console.log("1. Install PostgreSQL directly on Windows: https://www.postgresql.org/download/windows/");
    console.log("2. Or install Docker Desktop: https://www.docker.com/products/docker-desktop/");
    console.log("Once installed, start the service and make sure database name, user, and password in .env match.");
    console.log("--------------------------------\n");
  }

  const operationOutcome = Result.ok("SmartBooks Engine Booted Successfully.");
  console.log(`\n[Status] ${operationOutcome.value}`);
  console.log("==================================================");
}

bootstrap();
