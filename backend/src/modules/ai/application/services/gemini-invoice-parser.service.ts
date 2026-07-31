import { Result } from "../../../../shared-kernel/result";

export type ExtractedInvoiceItem = {
  name: string;
  qty: number;
  unitPrice: number;
  hsnCode?: string | null;
  taxRate: number; // e.g. 18.00
};

export type ExtractedInvoiceDto = {
  supplierName: string;
  invoiceNumber: string;
  invoiceDate: string; // ISO or raw text
  items: ExtractedInvoiceItem[];
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
};

/**
 * Service that connects to the Google Gemini API to perform
 * invoice document OCR extraction using Structured Outputs (JSON Schema).
 */
export class GeminiInvoiceParserService {
  private readonly apiKey: string;
  private readonly apiUrl: string;

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || "";
    // Using gemini-1.5-flash for fast and cost-effective document processing
    this.apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.apiKey}`;
  }

  /**
   * Parse a base64-encoded invoice image or PDF and return structured purchase details.
   */
  public async parseInvoice(
    base64Data: string,
    mimeType: string = "image/jpeg"
  ): Promise<Result<ExtractedInvoiceDto, string>> {
    if (!this.apiKey || this.apiKey === "your_gemini_api_key_here") {
      return Result.fail("AI Service Error: Google Gemini API Key is not configured. Please set GEMINI_API_KEY in your .env file.");
    }

    try {
      console.log("[AI Service] Dispatching invoice parse request to Google Gemini API...");
      
      const prompt = `
        You are an expert Indian B2B retail accounting auditor.
        Analyze this purchase invoice image and extract the structured invoice details.
        
        Rules:
        1. Extract the legal business name of the Supplier (the seller, NOT the buyer).
        2. Identify the invoice or bill reference number.
        3. Extract the line items. Ensure unitPrice matches the rate per unit before tax if possible.
        4. Look for Indian GST HSN Codes and GST tax percentages (e.g. 5%, 12%, 18%, 28%) and set the taxRate accordingly.
        5. Verify that Subtotal, Tax Total, and Grand Total amounts align with the invoice page.
      `;

      // Define the exact JSON schema we require Gemini to return
      const jsonSchema = {
        type: "OBJECT",
        properties: {
          supplierName: { type: "STRING" },
          invoiceNumber: { type: "STRING" },
          invoiceDate: { type: "STRING" },
          items: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                name: { type: "STRING" },
                qty: { type: "NUMBER" },
                unitPrice: { type: "NUMBER" },
                hsnCode: { type: "STRING" },
                taxRate: { type: "NUMBER" }
              },
              required: ["name", "qty", "unitPrice", "taxRate"]
            }
          },
          subtotal: { type: "NUMBER" },
          taxTotal: { type: "NUMBER" },
          grandTotal: { type: "NUMBER" }
        },
        required: ["supplierName", "invoiceNumber", "items", "subtotal", "taxTotal", "grandTotal"]
      };

      const payload = {
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType,
                  data: base64Data
                }
              }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: jsonSchema
        }
      };

      const response = await fetch(this.apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[AI Service Error] API request failed: Status ${response.status} | Details: ${errorText}`);
        return Result.fail(`Gemini API connection error (HTTP ${response.status}).`);
      }

      const resBody = (await response.json()) as any;
      
      // Parse the JSON string returned by Gemini inside the text parts
      const jsonText = resBody.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!jsonText) {
        console.error("[AI Service Error] Response structure is missing text parts:", JSON.stringify(resBody));
        return Result.fail("Gemini failed to return valid structured data.");
      }

      const extractedData = JSON.parse(jsonText) as ExtractedInvoiceDto;
      
      console.log(`🟢 [AI Service] Document parsed successfully from supplier '${extractedData.supplierName}'.`);
      return Result.ok(extractedData);
    } catch (error: any) {
      console.error("[AI Service Error] Request encountered an exception:", error.message);
      return Result.fail(`Invoice parsing failed: ${error.message}`);
    }
  }
}
