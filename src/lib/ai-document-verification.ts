import { privateStorageProvider } from "@/lib/private-storage";
import { DOCUMENT_MIME_TYPES } from "@/lib/document-evidence";

type AgentProfile = {
  displayName: string;
  latinName: string;
  city: string;
  country: string;
  licenseType: string;
  licenseNumber: string | null;
  email: string;
};

type DocumentInput = {
  id: number;
  documentType: string;
  originalName: string;
  storageKey: string;
};

export type AIVerificationResult = {
  overallConfidence: number;
  riskLevel: "low" | "medium" | "high";
  recommendation: "pass" | "review" | "reject";
  summary: string;
  profileChecks: {
    nameMatch: "match" | "partial" | "mismatch" | "not_available";
    addressMatch: "match" | "partial" | "mismatch" | "not_available";
    licenseMatch: "match" | "partial" | "mismatch" | "not_available";
  };
  documents: Array<{
    documentId: number;
    documentType: string;
    classification: "match" | "unclear" | "mismatch";
    quality: "high" | "medium" | "low";
    extracted: {
      fullName: string | null;
      latinName: string | null;
      documentNumber: string | null;
      address: string | null;
      issuingAuthority: string | null;
      issueDate: string | null;
      expiryDate: string | null;
      licenseNumber: string | null;
    };
    validity: "valid" | "expired" | "unclear" | "not_applicable";
    tamperRisk: "low" | "medium" | "high" | "unclear";
    reasons: string[];
  }>;
  warnings: string[];
};

const enabled = process.env.AI_DOCUMENT_REVIEW_ENABLED === "true";
const apiKey = process.env.OPENAI_API_KEY;
const model = process.env.OPENAI_DOCUMENT_REVIEW_MODEL || "gpt-5.6-luna";

export function aiDocumentReviewConfigured(): boolean {
  return enabled && Boolean(apiKey);
}

const resultSchema = {
  type: "object",
  additionalProperties: false,
  required: ["overallConfidence", "riskLevel", "recommendation", "summary", "profileChecks", "documents", "warnings"],
  properties: {
    overallConfidence: { type: "number", minimum: 0, maximum: 100 },
    riskLevel: { type: "string", enum: ["low", "medium", "high"] },
    recommendation: { type: "string", enum: ["pass", "review", "reject"] },
    summary: { type: "string" },
    profileChecks: {
      type: "object",
      additionalProperties: false,
      required: ["nameMatch", "addressMatch", "licenseMatch"],
      properties: {
        nameMatch: { type: "string", enum: ["match", "partial", "mismatch", "not_available"] },
        addressMatch: { type: "string", enum: ["match", "partial", "mismatch", "not_available"] },
        licenseMatch: { type: "string", enum: ["match", "partial", "mismatch", "not_available"] },
      },
    },
    documents: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["documentId", "documentType", "classification", "quality", "extracted", "validity", "tamperRisk", "reasons"],
        properties: {
          documentId: { type: "integer" },
          documentType: { type: "string" },
          classification: { type: "string", enum: ["match", "unclear", "mismatch"] },
          quality: { type: "string", enum: ["high", "medium", "low"] },
          extracted: {
            type: "object",
            additionalProperties: false,
            required: ["fullName", "latinName", "documentNumber", "address", "issuingAuthority", "issueDate", "expiryDate", "licenseNumber"],
            properties: {
              fullName: { type: ["string", "null"] },
              latinName: { type: ["string", "null"] },
              documentNumber: { type: ["string", "null"] },
              address: { type: ["string", "null"] },
              issuingAuthority: { type: ["string", "null"] },
              issueDate: { type: ["string", "null"] },
              expiryDate: { type: ["string", "null"] },
              licenseNumber: { type: ["string", "null"] },
            },
          },
          validity: { type: "string", enum: ["valid", "expired", "unclear", "not_applicable"] },
          tamperRisk: { type: "string", enum: ["low", "medium", "high", "unclear"] },
          reasons: { type: "array", items: { type: "string" } },
        },
      },
    },
    warnings: { type: "array", items: { type: "string" } },
  },
} as const;

async function uploadToOpenAI(buffer: Buffer, filename: string, contentType: string): Promise<string> {
  const form = new FormData();
  form.append("purpose", "user_data");
  const blobBytes = Uint8Array.from(buffer).buffer;
  form.append("file", new Blob([blobBytes], { type: contentType }), filename);

  const response = await fetch("https://api.openai.com/v1/files", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!response.ok) throw new Error(`AI file upload failed (${response.status})`);
  const data = (await response.json()) as { id?: string };
  if (!data.id) throw new Error("AI file upload returned no file id");
  return data.id;
}

async function deleteOpenAIFile(fileId: string): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(`https://api.openai.com/v1/files/${encodeURIComponent(fileId)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(15000),
      });
      if (response.ok || response.status === 404) return;
    } catch {
      // Best-effort cleanup. Never expose provider file identifiers in logs/errors.
    }
  }
}

export function parseVerificationResponse(data: unknown, documents: DocumentInput[]): AIVerificationResult {
  const response = data as { status?: string; output?: Array<{ type: string; content?: Array<{ type: string; text?: string }> }> };
  if (response.status !== "completed" || !Array.isArray(response.output)) throw new Error("AI response incomplete");
  const parts = response.output.filter(item => item.type === "message").flatMap(item => item.content ?? []);
  if (parts.some(part => part.type === "refusal")) throw new Error("AI review refused");
  const text = parts.filter(part => part.type === "output_text").map(part => part.text ?? "").join("");
  let parsed: AIVerificationResult;
  try { parsed = JSON.parse(text); } catch { throw new Error("AI result is not valid JSON"); }

  type Schema = { type: string | readonly string[]; enum?: readonly unknown[]; required?: readonly string[]; properties?: Record<string, Schema>; items?: Schema; minimum?: number; maximum?: number; additionalProperties?: boolean };
  function valid(value: unknown, schema: Schema): boolean {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    const type = value === null ? "null" : Array.isArray(value) ? "array" : typeof value;
    if (!types.includes(type) && !(types.includes("integer") && Number.isInteger(value))) return false;
    if (schema.enum && !schema.enum.includes(value)) return false;
    if (typeof value === "number" && (!Number.isFinite(value) || value < (schema.minimum ?? -Infinity) || value > (schema.maximum ?? Infinity))) return false;
    if (Array.isArray(value)) return !!schema.items && value.every(item => valid(item, schema.items!));
    if (type === "object") {
      const record = value as Record<string, unknown>;
      return (schema.required ?? []).every(key => Object.hasOwn(record, key)) && Object.entries(record).every(([key, item]) => !!schema.properties?.[key] && valid(item, schema.properties[key]));
    }
    return true;
  }

  if (!valid(parsed, resultSchema) || parsed.documents.length !== documents.length ||
    new Set(parsed.documents.map(doc => doc.documentId)).size !== documents.length ||
    parsed.documents.some(doc => !documents.some(input => input.id === doc.documentId && input.documentType === doc.documentType))) {
    throw new Error("AI result violates the evidence contract");
  }
  return parsed;
}

export async function analyzeAgentDocuments(
  agent: AgentProfile,
  documents: DocumentInput[],
): Promise<AIVerificationResult> {
  if (!aiDocumentReviewConfigured()) {
    throw new Error("AI document review is not enabled");
  }
  if (!documents.length) throw new Error("No verification documents available");
  if (documents.length > 4) throw new Error("Too many documents for one verification run");

  const uploaded: string[] = [];
  try {
    const inputs: Array<Record<string, unknown>> = [
      {
        type: "input_text",
        text: [
          "You are the AI evidence-analysis layer for THE JOURNEY travel-agent trust system.",
          "Analyze the supplied verification documents against the supplied agent profile.",
          "Extract visible facts, compare them, identify inconsistencies, and flag possible tampering signals.",
          "Do not claim legal authenticity or government verification. You only provide evidence analysis and risk signals.",
          "A phone number cannot be considered verified from a document; phone ownership requires a separate OTP flow.",
          "Address differences are not automatic fraud: use partial/mismatch and explain the reason.",
          "Never invent a value that is not legible or present; use null or not_available.",
          `Agent profile: ${JSON.stringify({
            displayName: agent.displayName,
            latinName: agent.latinName,
            city: agent.city,
            country: agent.country,
            licenseType: agent.licenseType,
            licenseNumber: agent.licenseNumber,
            email: agent.email,
          })}`,
          `Expected document types: ${documents.map((d) => `${d.id}:${d.documentType}`).join(", ")}`,
        ].join("\n"),
      },
    ];

    for (const document of documents) {
      const signed = await privateStorageProvider.getPresignedDownloadUrl(document.storageKey, 300);
      const fileResponse = await fetch(signed.downloadUrl, { cache: "no-store" });
      if (!fileResponse.ok) throw new Error(`Unable to read private document ${document.id}`);
      const buffer = Buffer.from(await fileResponse.arrayBuffer());
      if (buffer.byteLength > 10 * 1024 * 1024) throw new Error(`Document ${document.id} exceeds the allowed size`);
      const contentType = fileResponse.headers.get("content-type") || "application/octet-stream";
      if (!DOCUMENT_MIME_TYPES.includes(contentType) || buffer.byteLength === 0) throw new Error("Unsupported private document");
      const fileId = await uploadToOpenAI(buffer, document.originalName, contentType);
      uploaded.push(fileId);
      inputs.push({ type: "input_file", file_id: fileId, filename: document.originalName });
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        store: false,
        input: [{ role: "user", content: inputs }],
        text: {
          format: {
            type: "json_schema",
            name: "journey_agent_verification",
            strict: true,
            schema: resultSchema,
          },
        },
      }),
    });
    if (!response.ok) throw new Error(`AI verification failed (${response.status})`);

    return parseVerificationResponse(await response.json(), documents);
  } finally {
    await Promise.all(uploaded.map(deleteOpenAIFile));
  }
}
