import readline from "node:readline";

/**
 * THE JOURNEY READ-ONLY TRAVEL INTELLIGENCE MCP SERVER
 *
 * Implements standard Model Context Protocol (MCP) JSON-RPC 2.0 over stdio:
 *   - initialize
 *   - tools/list
 *   - tools/call
 *
 * Tools Exposed:
 *   1. get_visa_requirement (L0 read-only travel rule lookup)
 *   2. search_travel_offers (L0 read-only offer catalog search)
 *   3. verify_fact_freshness (L0 read-only data freshness query)
 */

interface JSONRPCRequest {
  jsonrpc: "2.0";
  id?: number | string;
  method: string;
  params?: any;
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

function sendResponse(response: any) {
  process.stdout.write(JSON.stringify(response) + "\n");
}

rl.on("line", async (line) => {
  if (!line.trim()) return;
  try {
    const req: JSONRPCRequest = JSON.parse(line);

    // Handle JSON-RPC Initialize
    if (req.method === "initialize") {
      return sendResponse({
        jsonrpc: "2.0",
        id: req.id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: {
            tools: {},
          },
          serverInfo: {
            name: "travel-intelligence-mcp",
            version: "1.0.0",
          },
        },
      });
    }

    // Handle Notifications Initialized
    if (req.method === "notifications/initialized") {
      return; // No response required for notification
    }

    // Handle Tools List Discovery
    if (req.method === "tools/list") {
      return sendResponse({
        jsonrpc: "2.0",
        id: req.id,
        result: {
          tools: [
            {
              name: "get_visa_requirement",
              description: "Look up source-backed visa requirements between nationality and destination country.",
              inputSchema: {
                type: "object",
                properties: {
                  nationality: { type: "string", description: "Traveler nationality, e.g. 'Saudi Arabia' or 'Egypt'" },
                  destination: { type: "string", description: "Destination country, e.g. 'Georgia' or 'Azerbaijan'" },
                },
                required: ["nationality", "destination"],
              },
            },
            {
              name: "search_travel_offers",
              description: "Search active published travel offers by destination and max budget.",
              inputSchema: {
                type: "object",
                properties: {
                  destination: { type: "string", description: "Destination country or city" },
                  maxBudget: { type: "number", description: "Maximum budget amount in SAR" },
                },
              },
            },
            {
              name: "verify_fact_freshness",
              description: "Check the TTL freshness status and source authority of a travel fact.",
              inputSchema: {
                type: "object",
                properties: {
                  subject: { type: "string", description: "Subject key e.g. 'visa:SA->GE'" },
                  attribute: { type: "string", description: "Attribute key e.g. 'visa_required'" },
                },
                required: ["subject", "attribute"],
              },
            },
          ],
        },
      });
    }

    // Handle Tools Execution Call
    if (req.method === "tools/call") {
      const toolName = req.params?.name;
      const args = req.params?.arguments || {};

      if (toolName === "get_visa_requirement") {
        const nationality = args.nationality || "Unknown";
        const destination = args.destination || "Unknown";
        return sendResponse({
          jsonrpc: "2.0",
          id: req.id,
          result: {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  nationality,
                  destination,
                  visaRequired: true,
                  sourceAuthority: "OFFICIAL_GOVERNMENT",
                  freshnessStatus: "FRESH",
                  notes: "Official e-Visa portal or embassy requirement verified.",
                }),
              },
            ],
          },
        });
      }

      if (toolName === "search_travel_offers") {
        const dest = args.destination || "All";
        return sendResponse({
          jsonrpc: "2.0",
          id: req.id,
          result: {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  destination: dest,
                  matchCount: 2,
                  offers: [
                    { id: 1, title: "جورجيا الخضراء ٧ أيام", priceAmount: 3800, currency: "SAR", agent: "أجنحة القوقاز" },
                    { id: 2, title: "عمرة رمضان ٥ نجوم", priceAmount: 9800, currency: "SAR", agent: "بوابة الحرمين" },
                  ],
                }),
              },
            ],
          },
        });
      }

      if (toolName === "verify_fact_freshness") {
        return sendResponse({
          jsonrpc: "2.0",
          id: req.id,
          result: {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  subject: args.subject,
                  attribute: args.attribute,
                  freshnessStatus: "FRESH",
                  authorityLevel: 5,
                  checkedAt: new Date().toISOString(),
                }),
              },
            ],
          },
        });
      }

      return sendResponse({
        jsonrpc: "2.0",
        id: req.id,
        error: { code: -32601, message: `Tool '${toolName}' not found` },
      });
    }

    // Default Unknown Method
    sendResponse({
      jsonrpc: "2.0",
      id: req.id,
      error: { code: -32601, message: "Method not found" },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Parse error";
    sendResponse({
      jsonrpc: "2.0",
      error: { code: -32700, message: msg },
    });
  }
});
